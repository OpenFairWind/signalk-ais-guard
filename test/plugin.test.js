'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const factory = require('../plugin')

function mockApp() {
  const raised = []; const cleared = []; let callback
  return {
    raised, cleared,
    debug() {}, error() {}, setPluginStatus() {}, setPluginError() {},
    notifications: { raise(o) { raised.push(o); return `id-${raised.length}` }, clear(id) { cleared.push(id) } },
    subscriptionmanager: { subscribe(_s, unsubs, _err, cb) { callback = cb; unsubs.push(() => {}) } },
    emit(delta) { callback(delta) }
  }
}

test('exports complete plugin interface and schema defaults', () => {
  const p = factory(mockApp())
  assert.equal(p.id, 'signalk-ais-guard')
  assert.equal(typeof p.start, 'function'); assert.equal(typeof p.stop, 'function')
  const s = p.schema(); assert.equal(s.type, 'object')
  for (const v of Object.values(s.properties)) assert.ok(Object.hasOwn(v, 'default'))
})



test('exposes versioned trajectory predictor registration interface', () => {
  const p = factory(mockApp())
  assert.equal(p.trajectoryPredictorInterface.id, 'signalk-ais-guard.trajectory-predictor')
  assert.equal(p.trajectoryPredictorInterface.version, '1.0.0')
  const unregister = p.registerTrajectoryPredictor({
    interface: p.trajectoryPredictorInterface.id,
    interfaceVersion: p.trajectoryPredictorInterface.version,
    id: 'test-predictor', version: '1.0.0', name: 'Test predictor',
    predict() { return { status: 'abstain', reason: 'test' } }
  })
  assert.ok(p.getTrajectoryPredictors().some(x => x.id === 'test-predictor'))
  unregister()
  assert.equal(p.getTrajectoryPredictors().some(x => x.id === 'test-predictor'), false)
})
test('start and restart with empty config are safe', () => {
  const p = factory(mockApp())
  p.start({}); p.stop(); p.start({}); p.stop()
})

test('stale own-vessel navigation makes risk assessment unavailable', () => {
  const app = mockApp(); const p = factory(app); p.start({ targetStaleSeconds: 10 })
  const oldTimestamp = new Date(Date.now() - 11000).toISOString()
  app.emit({context:'vessels.self', updates:[{timestamp:oldTimestamp, values:[
    {path:'navigation.position',value:{latitude:0,longitude:0}},
    {path:'navigation.speedOverGround',value:5},
    {path:'navigation.courseOverGroundTrue',value:Math.PI/2}
  ]}]})
  assert.equal(p._test.targetSnapshot().ownVesselReady, false)
  p.stop()
})

test('future navigation timestamps are clamped to server receipt time', () => {
  const app = mockApp(); const p = factory(app); p.start({})
  const before = Date.now()
  app.emit({context:'vessels.self', updates:[{timestamp:'2999-01-01T00:00:00.000Z', values:[
    {path:'navigation.position',value:{latitude:0,longitude:0}},
    {path:'navigation.speedOverGround',value:1},
    {path:'navigation.courseOverGroundTrue',value:0}
  ]}]})
  const own = p._test.getOwn()
  assert.ok(own.navLastSeen >= before)
  assert.ok(own.navLastSeen <= Date.now())
  assert.ok(own.history.every(sample => sample.t <= Date.now()))
  p.stop()
})

test('raises and clears managed notification for a head-on AIS target', () => {
  const app = mockApp(); const p = factory(app); p.start({})
  app.emit({context:'vessels.self', updates:[{values:[
    {path:'navigation.position',value:{latitude:0,longitude:0}},
    {path:'navigation.speedOverGround',value:5},
    {path:'navigation.courseOverGroundTrue',value:Math.PI/2}
  ]}]})
  app.emit({context:'vessels.urn:mrn:imo:mmsi:123456789', updates:[{values:[
    {path:'name',value:'TEST TARGET'}, {path:'mmsi',value:'123456789'},
    {path:'navigation.position',value:{latitude:0,longitude:.01}},
    {path:'navigation.speedOverGround',value:5},
    {path:'navigation.courseOverGroundTrue',value:3*Math.PI/2}
  ]}]})
  p._test.evaluate()
  assert.equal(app.raised.length, 1)
  assert.match(app.raised[0].message, /CPA/)
  assert.equal(app.raised[0].state, 'alarm')
  app.emit({context:'vessels.urn:mrn:imo:mmsi:123456789', updates:[{values:[{path:'navigation.courseOverGroundTrue',value:Math.PI/2}]}]})
  p._test.evaluate()
  assert.equal(app.cleared.length, 1)
  p.stop()
})

test('target snapshot exposes normalized metrics used by the WebApp', () => {
  const app = mockApp(); const p = factory(app); p.start({})
  app.emit({context:'vessels.self', updates:[{values:[
    {path:'navigation.position',value:{latitude:0,longitude:0}},
    {path:'navigation.speedOverGround',value:4},
    {path:'navigation.courseOverGroundTrue',value:Math.PI/2}
  ]}]})
  app.emit({context:'vessels.urn:mrn:imo:mmsi:987654321', updates:[{values:[
    {path:'name',value:'WEB TARGET'}, {path:'mmsi',value:'987654321'},
    {path:'navigation.position',value:{latitude:0,longitude:.02}},
    {path:'navigation.speedOverGround',value:3},
    {path:'navigation.courseOverGroundTrue',value:3*Math.PI/2}
  ]}]})
  const snapshot = p._test.targetSnapshot()
  assert.equal(snapshot.ownVesselReady, true)
  assert.equal(snapshot.targetCount, 1)
  assert.equal(snapshot.targets[0].name, 'WEB TARGET')
  assert.equal(snapshot.targets[0].mmsi, '987654321')
  assert.equal(Number.isFinite(snapshot.targets[0].rangeNm), true)
  assert.equal(Number.isFinite(snapshot.targets[0].cpaNm), true)
  assert.equal(Number.isFinite(snapshot.targets[0].tcpaMinutes), true)
  assert.match(snapshot.targets[0].risk, /^(alarm|warn|none)$/)
  p.stop()
})

test('registerWithRouter exposes a readonly targets endpoint and OpenAPI', () => {
  const app = mockApp(); const p = factory(app)
  let route; let accessLevel
  const readonlyRouter = { get(path, handler) { route = { path, handler }; return this } }
  const router = { access(level) { accessLevel = level; return readonlyRouter } }
  p.registerWithRouter(router)
  assert.equal(accessLevel, 'readonly')
  assert.equal(route.path, '/targets')
  let statusCode; let body
  route.handler({}, { status(code) { statusCode = code; return this }, json(value) { body = value; return this } })
  assert.equal(statusCode, 200)
  assert.ok(Array.isArray(body.targets))
  const api = p.getOpenApi()
  assert.ok(api.paths['/targets'].get)
})

test('predictive mode exposes predicted metrics and confidence after history accumulates', () => {
  const app = mockApp(); const p = factory(app); p.start({ predictiveAiEnabled: true, predictionMinimumConfidence: 0.5 })
  const now = Date.now()
  for (let i = 0; i < 5; i += 1) {
    const timestamp = new Date(now - (4 - i) * 10000).toISOString()
    app.emit({context:'vessels.self', updates:[{timestamp, values:[
      {path:'navigation.position',value:{latitude:0,longitude:0}},
      {path:'navigation.speedOverGround',value:4},
      {path:'navigation.courseOverGroundTrue',value:Math.PI/2}
    ]}]})
    app.emit({context:'vessels.urn:mrn:imo:mmsi:111222333', updates:[{timestamp, values:[
      {path:'name',value:'PREDICT TARGET'}, {path:'mmsi',value:'111222333'},
      {path:'navigation.position',value:{latitude:0,longitude:.02}},
      {path:'navigation.speedOverGround',value:4},
      {path:'navigation.courseOverGroundTrue',value:3*Math.PI/2}
    ]}]})
  }
  const snapshot = p._test.targetSnapshot(now)
  const target = snapshot.targets[0]
  assert.equal(snapshot.predictiveAiEnabled, true)
  assert.ok(Number.isFinite(target.predictedCpaNm))
  assert.ok(Number.isFinite(target.predictedTcpaMinutes))
  assert.ok(target.predictionConfidence >= 0.5)
  assert.match(target.riskSource, /^(prediction-ensemble|cpa-tcpa|classical)$/)
  assert.equal(Array.isArray(target.predictorReports), true)
  assert.equal(target.predictorReports.length, 3)
  assert.ok(target.predictionVotes)
  p.stop()
})

test('Freeboard plotter manifest is versioned and advertises read-only UI contributions', () => {
  const p = factory(mockApp())
  const manifest = p._test.plotterManifest()
  assert.equal(manifest.apiVersion, '1')
  assert.ok(manifest.requires.includes('widgets'))
  assert.ok(manifest.requires.includes('panels.iframe'))
  assert.ok(manifest.requires.includes('buttons'))
  assert.equal(manifest.widgets[0].url, '/plotterext/signalk-ais-guard/widget.html')
  assert.equal(manifest.panels[0].url, '/plotterext/signalk-ais-guard/panel.html')
})

test('Freeboard ResourceSet contains representative paths and closest-approach point for predictive hazards', () => {
  const app = mockApp(); const p = factory(app); p.start({ predictiveAiEnabled: true, predictionMinimumConfidence: 0.5 })
  const now = Date.now()
  for (let i = 0; i < 5; i += 1) {
    const timestamp = new Date(now - (4 - i) * 10000).toISOString()
    app.emit({context:'vessels.self', updates:[{timestamp, values:[
      {path:'navigation.position',value:{latitude:0,longitude:0}},
      {path:'navigation.speedOverGround',value:4},
      {path:'navigation.courseOverGroundTrue',value:Math.PI/2}
    ]}]})
    app.emit({context:'vessels.urn:mrn:imo:mmsi:222333444', updates:[{timestamp, values:[
      {path:'name',value:'OVERLAY TARGET'}, {path:'mmsi',value:'222333444'},
      {path:'navigation.position',value:{latitude:0,longitude:.02}},
      {path:'navigation.speedOverGround',value:4},
      {path:'navigation.courseOverGroundTrue',value:3*Math.PI/2}
    ]}]})
  }
  const snapshot = p._test.targetSnapshot(now)
  assert.ok(snapshot.targets[0].representativePredictor)
  assert.ok(snapshot.targets[0].predictedOwnPath.length > 1)
  assert.ok(snapshot.targets[0].predictedTargetPath.length > 1)
  assert.ok(snapshot.targets[0].predictedClosestApproachPoint)
  const resource = p._test.riskOverlayResource(now)
  assert.equal(resource.type, 'ResourceSet')
  assert.equal(resource.values.type, 'FeatureCollection')
  assert.ok(resource.values.features.some(f => f.geometry.type === 'LineString' && f.properties.styleRef === 'selfPath'))
  assert.ok(resource.values.features.some(f => f.geometry.type === 'LineString' && /Path$/.test(f.properties.styleRef) && f.properties.styleRef !== 'selfPath'))
  assert.ok(resource.values.features.some(f => f.geometry.type === 'Point'))
  p.stop()
})

test('anchor-watch state keeps AIS Guard active with position-only own vessel data', () => {
  const app = mockApp(); const p = factory(app); p.start({ predictiveAiEnabled: false })
  app.emit({ context:'vessels.self', updates:[{ values:[
    { path:'navigation.position', value:{ latitude:0, longitude:0 } },
    { path:'navigation.anchor.state', value:'on' },
    { path:'navigation.anchor.position', value:{ latitude:0, longitude:0 } }
  ]}]})
  app.emit({ context:'vessels.urn:mrn:imo:mmsi:333444555', updates:[{ values:[
    { path:'name', value:'ANCHORAGE TRAFFIC' },
    { path:'navigation.position', value:{ latitude:0, longitude:0.01 } },
    { path:'navigation.speedOverGround', value:5 },
    { path:'navigation.courseOverGroundTrue', value:3*Math.PI/2 }
  ]}]})
  assert.equal(p._test.stationKeepingStatus().mode, 'anchored')
  assert.equal(p._test.targetSnapshot().ownVesselReady, true)
  assert.equal(p._test.targetSnapshot().anchorWatchActive, true)
  p._test.evaluate()
  assert.equal(app.raised.length, 1)
  assert.equal(app.raised[0].state, 'alarm')
  p.stop()
})

test('navigation.state moored keeps AIS Guard active without own SOG/COG', () => {
  const app = mockApp(); const p = factory(app); p.start({ predictiveAiEnabled: false })
  app.emit({ context:'vessels.self', updates:[{ values:[
    { path:'navigation.position', value:{ latitude:0, longitude:0 } },
    { path:'navigation.state', value:'moored' }
  ]}]})
  app.emit({ context:'vessels.urn:mrn:imo:mmsi:444555666', updates:[{ values:[
    { path:'navigation.position', value:{ latitude:0.005, longitude:0 } },
    { path:'navigation.speedOverGround', value:4 },
    { path:'navigation.courseOverGroundTrue', value:Math.PI }
  ]}]})
  const snapshot = p._test.targetSnapshot()
  assert.equal(snapshot.ownVesselReady, true)
  assert.equal(snapshot.ownVesselMode, 'moored')
  p._test.evaluate()
  assert.equal(app.raised.length, 1)
  p.stop()
})

test('anchor position supports legacy anchor-watch plugins without navigation.anchor.state', () => {
  const app = mockApp(); const p = factory(app); p.start({ predictiveAiEnabled: false })
  app.emit({ context:'vessels.self', updates:[{ values:[
    { path:'navigation.position', value:{ latitude:0, longitude:0 } },
    { path:'navigation.anchor.position', value:{ latitude:0, longitude:0 } }
  ]}]})
  assert.equal(p._test.stationKeepingStatus().anchorWatchActive, true)
  assert.equal(p._test.effectiveOwnRecord().speed, 0)
  p.stop()
})

test('anchor-watch off does not fabricate own motion when SOG/COG are absent', () => {
  const app = mockApp(); const p = factory(app); p.start({ predictiveAiEnabled: false })
  app.emit({ context:'vessels.self', updates:[{ values:[
    { path:'navigation.position', value:{ latitude:0, longitude:0 } },
    { path:'navigation.anchor.state', value:'off' },
    { path:'navigation.anchor.position', value:null }
  ]}]})
  const snapshot = p._test.targetSnapshot()
  assert.equal(snapshot.ownVesselReady, false)
  assert.equal(snapshot.anchorWatchActive, false)
  p.stop()
})

test('predictor ensemble remains operational while anchored with no own SOG/COG', () => {
  const app = mockApp(); const p = factory(app); p.start({ predictiveAiEnabled: true, predictionMinimumConfidence: 0.5 })
  const now = Date.now()
  for (let i = 0; i < 5; i += 1) {
    const timestamp = new Date(now - (4 - i) * 10000).toISOString()
    app.emit({ context:'vessels.self', updates:[{ timestamp, values:[
      { path:'navigation.position', value:{ latitude:0, longitude:0 } },
      { path:'navigation.anchor.state', value:'on' },
      { path:'navigation.anchor.position', value:{ latitude:0, longitude:0 } }
    ]}]})
    app.emit({ context:'vessels.urn:mrn:imo:mmsi:555666777', updates:[{ timestamp, values:[
      { path:'navigation.position', value:{ latitude:0, longitude:0.02 } },
      { path:'navigation.speedOverGround', value:4 },
      { path:'navigation.courseOverGroundTrue', value:3*Math.PI/2 }
    ]}]})
  }
  const target = p._test.targetSnapshot(now).targets[0]
  assert.ok(Number.isFinite(target.predictedCpaNm))
  assert.ok(Number.isFinite(target.predictedTcpaMinutes))
  assert.ok(target.predictorReports.filter(r => r.eligible).length >= 2)
  p.stop()
})
