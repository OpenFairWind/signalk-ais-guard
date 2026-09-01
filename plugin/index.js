'use strict'

const { computeCpa, classifyRisk } = require('./risk')
const { INTERFACE_ID, INTERFACE_VERSION, createRegistry, runPredictors, majorityRisk, ensembleSummary } = require('./predictors')
const { representativeReport } = require('./predictors/ensemble')
const fs = require('fs')
const path = require('path')
const openApi = require('./openapi.json')

const DEFAULTS = Object.freeze({
  evaluationIntervalSeconds: 2,
  targetStaleSeconds: 90,
  maxTargetRangeNm: 12,
  warnCpaNm: 1.0,
  alarmCpaNm: 0.5,
  immediateRangeNm: 0.15,
  maxTcpaMinutes: 20,
  minimumTargetSpeedKnots: 0.2,
  notificationMethods: ['visual', 'sound'],
  includePosition: true,
  repeatMinutes: 5,
  predictiveAiEnabled: false,
  predictionHistorySeconds: 180,
  predictionMinimumSamples: 4,
  predictionMinimumHistorySeconds: 20,
  predictionHorizonMinutes: 20,
  predictionStepSeconds: 5,
  predictionMinimumConfidence: 0.55,
  predictionMinimumVotes: 2,
  predictionPredictors: ['constant-velocity', 'constant-turn-rate', 'adaptive-turn-acceleration'],
  predictionMaxTurnRateDegreesPerMinute: 30,
  predictionMaxAccelerationMps2: 0.25,
  freeboardRiskOverlayEnabled: true,
  freeboardOverlayOwnPath: true,
  freeboardOverlayRiskyPaths: true,
  freeboardOverlayClosestApproachPoints: true,
  anchorWatchIntegrationEnabled: true,
  stationKeepingGuardEnabled: true,
  stationKeepingSpeedThresholdKnots: 0.5,
  stationKeepingForceZeroOwnSpeed: true
})
const KNOTS_PER_MPS = 1.9438444924406
const PLOTTER_ASSET_BASE = '/plotterext/signalk-ais-guard'
const RISK_RESOURCE_TYPE = 'aisGuardRiskOverlay'

function schema() {
  return {
    type: 'object',
    title: 'AIS Guard',
    additionalProperties: false,
    properties: {
      evaluationIntervalSeconds: { type: 'number', title: 'Evaluation interval (seconds)', minimum: 0.5, maximum: 60, default: DEFAULTS.evaluationIntervalSeconds },
      targetStaleSeconds: { type: 'number', title: 'Ignore AIS targets older than (seconds)', minimum: 10, maximum: 3600, default: DEFAULTS.targetStaleSeconds },
      maxTargetRangeNm: { type: 'number', title: 'Maximum target range (NM)', minimum: 0.1, maximum: 100, default: DEFAULTS.maxTargetRangeNm },
      warnCpaNm: { type: 'number', title: 'Warning CPA threshold (NM)', minimum: 0.01, maximum: 10, default: DEFAULTS.warnCpaNm },
      alarmCpaNm: { type: 'number', title: 'Alarm CPA threshold (NM)', minimum: 0.01, maximum: 10, default: DEFAULTS.alarmCpaNm },
      immediateRangeNm: { type: 'number', title: 'Immediate alarm range (NM)', minimum: 0.01, maximum: 5, default: DEFAULTS.immediateRangeNm },
      maxTcpaMinutes: { type: 'number', title: 'Maximum TCPA horizon (minutes)', minimum: 1, maximum: 120, default: DEFAULTS.maxTcpaMinutes },
      minimumTargetSpeedKnots: { type: 'number', title: 'Minimum target speed for prediction (knots)', minimum: 0, maximum: 20, default: DEFAULTS.minimumTargetSpeedKnots },
      notificationMethods: { type: 'array', title: 'Notification methods', default: DEFAULTS.notificationMethods, uniqueItems: true, items: { type: 'string', enum: ['visual', 'sound'] } },
      includePosition: { type: 'boolean', title: 'Include own-vessel position in notifications', default: DEFAULTS.includePosition },
      repeatMinutes: { type: 'number', title: 'Re-notify ongoing danger after (minutes)', minimum: 0, maximum: 120, default: DEFAULTS.repeatMinutes },
      predictiveAiEnabled: { type: 'boolean', title: 'Enable trajectory predictor ensemble', default: DEFAULTS.predictiveAiEnabled },
      predictionHistorySeconds: { type: 'number', title: 'Prediction history window (seconds)', minimum: 30, maximum: 1800, default: DEFAULTS.predictionHistorySeconds },
      predictionMinimumSamples: { type: 'integer', title: 'Minimum samples for confident prediction', minimum: 3, maximum: 30, default: DEFAULTS.predictionMinimumSamples },
      predictionMinimumHistorySeconds: { type: 'number', title: 'Minimum history duration (seconds)', minimum: 5, maximum: 600, default: DEFAULTS.predictionMinimumHistorySeconds },
      predictionHorizonMinutes: { type: 'number', title: 'Prediction horizon (minutes)', minimum: 1, maximum: 60, default: DEFAULTS.predictionHorizonMinutes },
      predictionStepSeconds: { type: 'number', title: 'Prediction step (seconds)', minimum: 1, maximum: 30, default: DEFAULTS.predictionStepSeconds },
      predictionMinimumConfidence: { type: 'number', title: 'Minimum prediction confidence', minimum: 0, maximum: 1, default: DEFAULTS.predictionMinimumConfidence },
      predictionMinimumVotes: { type: 'integer', title: 'Minimum eligible predictor votes', minimum: 1, maximum: 20, default: DEFAULTS.predictionMinimumVotes },
      predictionPredictors: { type: 'array', title: 'Enabled trajectory predictor IDs', description: 'Predictor IDs registered against the AIS Guard Trajectory Predictor Interface v1.', default: DEFAULTS.predictionPredictors, uniqueItems: true, items: { type: 'string', minLength: 1 } },
      predictionMaxTurnRateDegreesPerMinute: { type: 'number', title: 'Maximum learned turn rate (degrees/minute)', minimum: 1, maximum: 180, default: DEFAULTS.predictionMaxTurnRateDegreesPerMinute },
      predictionMaxAccelerationMps2: { type: 'number', title: 'Maximum learned acceleration (m/s²)', minimum: 0.01, maximum: 2, default: DEFAULTS.predictionMaxAccelerationMps2 },
      freeboardRiskOverlayEnabled: { type: 'boolean', title: 'Publish Freeboard-SK risk overlay ResourceSet', default: DEFAULTS.freeboardRiskOverlayEnabled },
      freeboardOverlayOwnPath: { type: 'boolean', title: 'Overlay representative own-vessel predicted path', default: DEFAULTS.freeboardOverlayOwnPath },
      freeboardOverlayRiskyPaths: { type: 'boolean', title: 'Overlay predicted paths for warning/alarm targets', default: DEFAULTS.freeboardOverlayRiskyPaths },
      freeboardOverlayClosestApproachPoints: { type: 'boolean', title: 'Overlay predicted closest-approach points', default: DEFAULTS.freeboardOverlayClosestApproachPoints },
      anchorWatchIntegrationEnabled: { type: 'boolean', title: 'Use Signal K anchor-watch state', description: 'Recognize navigation.anchor.state/position and keep AIS collision guard active while anchored.', default: DEFAULTS.anchorWatchIntegrationEnabled },
      stationKeepingGuardEnabled: { type: 'boolean', title: 'Guard while anchored, moored, or stationary', description: 'Allows collision assessment with position-only own-vessel data when an anchor/moored state is known, and tolerates missing COG at near-zero SOG.', default: DEFAULTS.stationKeepingGuardEnabled },
      stationKeepingSpeedThresholdKnots: { type: 'number', title: 'Near-stationary SOG threshold (knots)', minimum: 0, maximum: 5, default: DEFAULTS.stationKeepingSpeedThresholdKnots },
      stationKeepingForceZeroOwnSpeed: { type: 'boolean', title: 'Treat explicit anchored/moored own vessel as stationary', description: 'Suppresses GPS-jitter SOG/COG in collision calculations and predictors while navigation.anchor or navigation.state reports anchored/moored.', default: DEFAULTS.stationKeepingForceZeroOwnSpeed }
    }
  }
}

function makeConfig(input = {}) {
  const cfg = { ...DEFAULTS, ...(input || {}) }
  if (cfg.alarmCpaNm > cfg.warnCpaNm) cfg.warnCpaNm = cfg.alarmCpaNm
  if (cfg.immediateRangeNm > cfg.warnCpaNm) cfg.immediateRangeNm = cfg.warnCpaNm
  if (!Array.isArray(cfg.notificationMethods) || cfg.notificationMethods.length === 0) cfg.notificationMethods = ['visual']
  return cfg
}

function contextKey(delta) {
  return typeof delta.context === 'string' ? delta.context : ''
}

function targetId(context) {
  const raw = context.replace(/^vessels\./, '') || 'unknown'
  return raw.replace(/[^A-Za-z0-9_-]/g, '_')
}

module.exports = function aisGuard(app) {
  let cfg = makeConfig()
  let unsubscribes = []
  let timer = null
  let own = {}
  const targets = new Map()
  const active = new Map()
  const predictorRegistry = createRegistry()

  const plugin = {
    id: 'signalk-ais-guard',
    name: 'AIS Guard',
    description: 'Continuously evaluates AIS targets using CPA/TCPA plus an optional pluggable trajectory-predictor ensemble with majority-vote risk assessment and raises Signal K collision-risk notifications.',
    schema,
    uiSchema: () => ({ notificationMethods: { 'ui:widget': 'checkboxes' } })
  }

  plugin.trajectoryPredictorInterface = Object.freeze({ id: INTERFACE_ID, version: INTERFACE_VERSION })
  plugin.registerTrajectoryPredictor = predictor => predictorRegistry.register(predictor)
  plugin.getTrajectoryPredictors = () => predictorRegistry.list().map(p => ({ id: p.id, version: p.version, name: p.name, description: p.description || '' }))

  function logError(err) {
    const message = err instanceof Error ? err.message : String(err)
    if (typeof app.setPluginError === 'function') app.setPluginError(message)
    else if (typeof app.error === 'function') app.error(message)
  }

  function appendHistory(record, timestamp) {
    if (!record.position || !Number.isFinite(record.speed) || !Number.isFinite(record.course)) return
    if (!Array.isArray(record.history)) record.history = []
    const t = Number.isFinite(timestamp) ? timestamp : Date.now()
    const last = record.history.at(-1)
    if (last && t <= last.t) return
    record.history.push({ t, position: { latitude: record.position.latitude, longitude: record.position.longitude }, speed: record.speed, course: record.course })
    const cutoff = t - Math.max(cfg.predictionHistorySeconds * 1000 * 2, 600000)
    record.history = record.history.filter(sample => sample.t >= cutoff).slice(-240)
  }

  function predictionOptions() {
    return {
      historySeconds: cfg.predictionHistorySeconds,
      minimumSamples: cfg.predictionMinimumSamples,
      minimumHistorySeconds: cfg.predictionMinimumHistorySeconds,
      horizonMinutes: Math.min(cfg.predictionHorizonMinutes, cfg.maxTcpaMinutes),
      stepSeconds: cfg.predictionStepSeconds,
      staleSeconds: cfg.targetStaleSeconds,
      maxTurnRateDegreesPerMinute: cfg.predictionMaxTurnRateDegreesPerMinute,
      maxAccelerationMps2: cfg.predictionMaxAccelerationMps2
    }
  }


  function normalizedNavigationState(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : ''
  }

  function recordAnchorWatchActive(record) {
    if (!cfg.anchorWatchIntegrationEnabled) return false
    const state = normalizedNavigationState(record.anchorState)
    if (['on', 'active', 'watching', 'set', 'armed'].includes(state)) return true
    if (['off', 'inactive', 'raised', 'disabled'].includes(state)) return false
    return !!(record.anchorPosition && Number.isFinite(record.anchorPosition.latitude) && Number.isFinite(record.anchorPosition.longitude))
  }

  function anchorWatchActive() { return recordAnchorWatchActive(own) }

  function stationKeepingStatus() {
    const navState = normalizedNavigationState(own.navigationState)
    const anchored = anchorWatchActive() || navState === 'anchored'
    const moored = navState === 'moored'
    const speedKnots = Number.isFinite(own.speed) ? own.speed * KNOTS_PER_MPS : null
    const nearStationary = Number.isFinite(speedKnots) && speedKnots <= cfg.stationKeepingSpeedThresholdKnots
    const mode = anchored ? 'anchored' : moored ? 'moored' : nearStationary ? 'stationary' : 'underway'
    return { mode, anchored, moored, nearStationary, anchorWatchActive: anchorWatchActive(), navigationState: navState || null, speedKnots }
  }

  function effectiveOwnRecord(now = Date.now()) {
    if (!own.position) return null
    const navigationTimestamp = own.navLastSeen || own.lastSeen
    if (!Number.isFinite(navigationTimestamp) || now - navigationTimestamp > cfg.targetStaleSeconds * 1000) return null
    const status = stationKeepingStatus()
    const explicitStationKeeping = cfg.stationKeepingGuardEnabled && (status.anchored || status.moored)
    if (explicitStationKeeping && cfg.stationKeepingForceZeroOwnSpeed) {
      const history = Array.isArray(own.history) ? own.history.map(sample => ({ ...sample, speed: 0, course: 0 })) : []
      if (!history.length) history.push({ t: own.navLastSeen || own.lastSeen || now, position: own.position, speed: 0, course: 0 })
      return { ...own, speed: 0, course: 0, history }
    }
    if (Number.isFinite(own.speed) && Number.isFinite(own.course)) return own
    if (cfg.stationKeepingGuardEnabled && status.nearStationary) return { ...own, speed: 0, course: 0, history: Array.isArray(own.history) ? own.history.map(sample => ({ ...sample, speed: 0, course: 0 })) : [] }
    return null
  }

  function consume(delta) {
    const context = contextKey(delta)
    if (!context.startsWith('vessels.')) return
    const isSelf = context === 'vessels.self'
    const record = isSelf ? own : (targets.get(context) || { context })
    let touched = false
    let navigationTouched = false
    let newestTimestamp = 0
    for (const update of delta.updates || []) {
      const receivedAt = Date.now()
      const parsedTimestamp = Date.parse(update.timestamp || delta.timestamp || '')
      // Bound sender clock skew so future samples cannot remain artificially
      // fresh or enter predictor history after the evaluation instant.
      const timestamp = Number.isFinite(parsedTimestamp) ? Math.min(parsedTimestamp, receivedAt) : receivedAt
      newestTimestamp = Math.max(newestTimestamp, timestamp)
      for (const pv of update.values || []) {
        if (pv.path === 'navigation.position') { record.position = pv.value; record.positionAt = timestamp; touched = true; navigationTouched = true }
        else if (pv.path === 'navigation.speedOverGround') { record.speed = pv.value; record.motionAt = timestamp; touched = true; navigationTouched = true }
        else if (pv.path === 'navigation.courseOverGroundTrue') { record.course = pv.value; record.motionAt = timestamp; touched = true; navigationTouched = true }
        else if (isSelf && pv.path === 'navigation.anchor.state') { record.anchorState = pv.value; record.anchorStateAt = timestamp; touched = true }
        else if (isSelf && pv.path === 'navigation.anchor.position') { record.anchorPosition = pv.value; record.anchorStateAt = timestamp; touched = true }
        else if (isSelf && pv.path === 'navigation.anchor.currentRadius') { record.anchorCurrentRadius = pv.value; touched = true }
        else if (isSelf && pv.path === 'navigation.anchor.maxRadius') { record.anchorMaxRadius = pv.value; touched = true }
        else if (isSelf && pv.path === 'navigation.state') { record.navigationState = pv.value; record.navigationStateAt = timestamp; touched = true }
        else if (isSelf && pv.path === 'notifications.navigation.anchor') { record.anchorNotification = pv.value; touched = true }
        else if (pv.path === 'name') { record.name = pv.value; touched = true }
        else if (pv.path === 'mmsi') { record.mmsi = pv.value; touched = true }
        else if (pv.path === '' && pv.value && typeof pv.value === 'object') {
          if (pv.value.name) record.name = pv.value.name
          if (pv.value.mmsi) record.mmsi = pv.value.mmsi
          touched = true
        }
      }
    }
    if (touched) {
      record.lastSeen = Date.now()
      if (navigationTouched) {
        record.navLastSeen = Math.min(record.lastSeen, newestTimestamp || record.lastSeen)
        const state = normalizedNavigationState(record.navigationState)
        const explicitStationKeeping = isSelf && cfg.stationKeepingGuardEnabled && (recordAnchorWatchActive(record) || state === 'anchored' || state === 'moored')
        if (explicitStationKeeping && record.position) {
          record.history = Array.isArray(record.history) ? record.history : []
          record.history.push({ t: record.navLastSeen, position: { ...record.position }, speed: 0, course: 0 })
          const cutoff = record.navLastSeen - cfg.predictionHistorySeconds * 1000
          record.history = record.history.filter(sample => sample.t >= cutoff).slice(-240)
        } else appendHistory(record, record.navLastSeen)
      }
      if (isSelf) own = record
      else targets.set(context, record)
    }
  }

  function assessTarget(target, now = Date.now()) {
    const effectiveOwn = effectiveOwnRecord(now)
    if (!effectiveOwn || !target.position || !Number.isFinite(target.speed) || !Number.isFinite(target.course)) {
      return { metrics: null, prediction: null, predictorReports: [], risk: { level: 'unknown', state: 'normal', reason: 'insufficient-data', source: 'none' } }
    }
    const metrics = computeCpa(effectiveOwn, target)
    if (!metrics) return { metrics: null, prediction: null, predictorReports: [], risk: { level: 'unknown', state: 'normal', reason: 'insufficient-data', source: 'none' } }
    let classical = classifyRisk(metrics, cfg)
    const movingEnough = target.speed * KNOTS_PER_MPS >= cfg.minimumTargetSpeedKnots
    if (!movingEnough && metrics.rangeNm > cfg.immediateRangeNm) classical = { ...classical, level: 'none', state: 'normal', reason: 'below-minimum-speed' }
    if (metrics.rangeNm > cfg.maxTargetRangeNm) classical = { ...classical, level: 'none', state: 'normal', reason: 'outside-monitoring-range' }
    classical = { ...classical, source: classical.level === 'none' ? 'classical' : 'cpa-tcpa' }

    let predictorReports = []
    let prediction = null
    let predictive = { level: 'unknown', state: 'normal', reason: 'prediction-disabled', source: 'prediction-ensemble', eligibleVotes: 0, votes: { alarm: 0, warn: 0, none: 0 } }
    let risk = classical
    if (cfg.predictiveAiEnabled && movingEnough && metrics.rangeNm <= cfg.maxTargetRangeNm) {
      const predictors = predictorRegistry.select(cfg.predictionPredictors)
      predictorReports = runPredictors(
        predictors,
        { own: effectiveOwn, target, options: predictionOptions(), now },
        report => ({ ...classifyRisk({ rangeNm: metrics.rangeNm, cpaNm: report.cpaNm, tcpaMinutes: report.tcpaMinutes }, cfg), source: `predictor:${report.predictor.id}` }),
        cfg.predictionMinimumConfidence
      )
      predictive = majorityRisk(predictorReports, cfg.predictionMinimumVotes)
      const summary = ensembleSummary(predictorReports)
      prediction = summary.eligibleCount ? {
        cpaNm: summary.cpaNm,
        tcpaMinutes: summary.tcpaMinutes,
        confidence: summary.confidence,
        model: 'majority-ensemble-v1',
        eligibleCount: summary.eligibleCount,
        reportCount: summary.reportCount,
        votes: predictive.votes
      } : null
      // The ensemble is authoritative when quorum is met. Classical CPA/TCPA remains the documented fallback when the ensemble cannot form a quorum.
      risk = predictive.level === 'unknown' ? { ...classical, reason: `ensemble-fallback:${predictive.reason}` } : predictive
    }
    return { metrics, prediction, predictorReports, risk, classicalRisk: classical, predictiveRisk: predictive }
  }

  function targetSnapshot(now = Date.now()) {
    const ownReady = !!effectiveOwnRecord(now)
    const ownStatus = stationKeepingStatus()
    const result = []
    for (const [context, target] of targets) {
      const ageSeconds = Math.max(0, (now - (target.navLastSeen || target.lastSeen || now)) / 1000)
      const stale = ageSeconds > cfg.targetStaleSeconds
      const assessment = ownReady ? assessTarget(target, now) : { metrics: null, prediction: null, risk: { level: 'unknown', reason: 'insufficient-data', source: 'none' } }
      const { metrics, prediction, predictorReports = [], risk } = assessment
      const representative = representativeReport(predictorReports)
      result.push({
        context,
        name: target.name || null,
        mmsi: target.mmsi ? String(target.mmsi) : null,
        risk: stale ? 'unknown' : risk.level,
        reason: stale ? 'stale' : risk.reason,
        riskSource: stale ? 'none' : risk.source,
        rangeNm: metrics ? +metrics.rangeNm.toFixed(3) : null,
        cpaNm: metrics ? +metrics.cpaNm.toFixed(3) : null,
        tcpaMinutes: metrics ? +metrics.tcpaMinutes.toFixed(2) : null,
        predictedCpaNm: prediction ? +prediction.cpaNm.toFixed(3) : null,
        predictedTcpaMinutes: prediction ? +prediction.tcpaMinutes.toFixed(2) : null,
        predictionConfidence: prediction ? +prediction.confidence.toFixed(3) : null,
        predictionModel: prediction ? prediction.model : null,
        predictionVotes: prediction ? prediction.votes : null,
        representativePredictor: representative ? representative.predictor : null,
        predictedOwnPath: representative ? representative.ownPath : null,
        predictedTargetPath: representative ? representative.targetPath : null,
        predictedClosestApproachPoint: representative ? representative.closestApproachPoint : null,
        predictorReports: predictorReports.map(report => ({ predictor: report.predictor, status: report.status, eligible: !!report.eligible, reason: report.reason, cpaNm: Number.isFinite(report.cpaNm) ? +report.cpaNm.toFixed(3) : null, tcpaMinutes: Number.isFinite(report.tcpaMinutes) ? +report.tcpaMinutes.toFixed(2) : null, confidence: Number.isFinite(report.confidence) ? +report.confidence.toFixed(3) : null, risk: report.risk && report.risk.level ? report.risk.level : 'unknown' })),
        speedKnots: Number.isFinite(target.speed) ? +(target.speed * KNOTS_PER_MPS).toFixed(2) : null,
        courseDegrees: Number.isFinite(target.course) ? +((((target.course * 180 / Math.PI) % 360) + 360) % 360).toFixed(1) : null,
        position: target.position || null,
        ageSeconds: +ageSeconds.toFixed(1),
        stale
      })
    }
    return { generatedAt: new Date(now).toISOString(), ownVesselReady: ownReady, ownVesselMode: ownStatus.mode, anchorWatchActive: ownStatus.anchorWatchActive, navigationState: ownStatus.navigationState, predictiveAiEnabled: cfg.predictiveAiEnabled, predictorInterfaceVersion: INTERFACE_VERSION, enabledPredictors: predictorRegistry.select(cfg.predictionPredictors).map(p => ({ id: p.id, version: p.version, name: p.name })), targetCount: result.length, targets: result }
  }


  function riskOverlayResource(now = Date.now()) {
    const snap = targetSnapshot(now)
    const hazardous = snap.targets.filter(t => !t.stale && (t.risk === 'warn' || t.risk === 'alarm') && Array.isArray(t.predictedTargetPath))
    const features = []
    let selfCandidate = null
    for (const t of hazardous) {
      if (!selfCandidate || (t.predictionConfidence || 0) > (selfCandidate.predictionConfidence || 0)) selfCandidate = t
      const styleRef = t.risk === 'alarm' ? 'alarmPath' : 'warningPath'
      if (cfg.freeboardOverlayRiskyPaths) features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: t.predictedTargetPath.map(p => [p.position.longitude, p.position.latitude]) },
        properties: { styleRef, name: `${t.name || t.mmsi || t.context} predicted path`, risk: t.risk, mmsi: t.mmsi, cpaNm: t.predictedCpaNm, tcpaMinutes: t.predictedTcpaMinutes, confidence: t.predictionConfidence, predictor: t.representativePredictor && t.representativePredictor.id }
      })
      if (cfg.freeboardOverlayClosestApproachPoints && t.predictedClosestApproachPoint) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [t.predictedClosestApproachPoint.longitude, t.predictedClosestApproachPoint.latitude] },
          properties: { styleRef: t.risk === 'alarm' ? 'alarmPoint' : 'warningPoint', name: `${t.name || t.mmsi || t.context} predicted closest approach`, risk: t.risk, cpaNm: t.predictedCpaNm, tcpaMinutes: t.predictedTcpaMinutes, confidence: t.predictionConfidence, semantic: 'predicted-closest-approach-midpoint' }
        })
      }
    }
    if (cfg.freeboardOverlayOwnPath && selfCandidate && Array.isArray(selfCandidate.predictedOwnPath)) {
      features.unshift({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: selfCandidate.predictedOwnPath.map(p => [p.position.longitude, p.position.latitude]) },
        properties: { styleRef: 'selfPath', name: 'Own vessel representative predicted path', predictor: selfCandidate.representativePredictor && selfCandidate.representativePredictor.id, confidence: selfCandidate.predictionConfidence }
      })
    }
    return {
      type: 'ResourceSet',
      name: 'AIS Guard live collision-risk overlay',
      description: 'Read-only predicted paths for hazardous AIS encounters. The point symbol is the midpoint between predicted vessel positions at closest approach; it is not a guaranteed collision location.',
      styles: {
        default: { width: 2, stroke: '#f0ad4e', fill: '#f0ad4e' },
        selfPath: { width: 3, stroke: '#32a8ff', fill: '#32a8ff', lineDash: [8, 4] },
        warningPath: { width: 3, stroke: '#f0ad4e', fill: '#f0ad4e', lineDash: [8, 4] },
        alarmPath: { width: 4, stroke: '#ff3b30', fill: '#ff3b30', lineDash: [8, 3] },
        warningPoint: { width: 7, stroke: '#f0ad4e', fill: '#f0ad4e' },
        alarmPoint: { width: 9, stroke: '#ff3b30', fill: '#ff3b30' }
      },
      values: { type: 'FeatureCollection', features: cfg.freeboardRiskOverlayEnabled ? features : [] },
      generatedAt: snap.generatedAt,
      hazardousTargetCount: hazardous.length
    }
  }

  function plotterManifest() {
    return {
      name: 'AIS Guard',
      description: 'Collision-risk status and predicted-encounter visualization for Signal K chartplotters.',
      version: '1.6.0',
      apiVersion: '1',
      requires: ['widgets', 'panels.iframe', 'buttons'],
      optional: ['map', 'resources', 'nightMode'],
      widgets: [{ id: 'risk-status', title: 'AIS Guard Risk', type: 'iframe', url: `${PLOTTER_ASSET_BASE}/widget.html`, size: '1x1', lifecycle: 'whileEnabled' }],
      panels: [{ id: 'risk-panel', title: 'AIS Guard Risks', type: 'iframe', url: `${PLOTTER_ASSET_BASE}/panel.html`, lifecycle: 'keepAlive' }],
      buttons: [{ id: 'open-risk-panel', title: 'AIS Guard Risks', slot: 'mapToolbar', icon: 'warning', action: { type: 'togglePanel', panel: 'risk-panel' } }]
    }
  }

  function mountPlotterAssets() {
    if (typeof app.use !== 'function' || plugin._plotterAssetsMounted) return
    const root = path.join(__dirname, '..', 'plotterext')
    app.use(PLOTTER_ASSET_BASE, (req, res, next) => {
      try {
        const rel = decodeURIComponent((req.path || req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'panel.html'
        if (!/^[A-Za-z0-9._-]+$/.test(rel)) return next ? next() : undefined
        const file = path.join(root, rel)
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next ? next() : undefined
        const ext = path.extname(file)
        const contentType = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'application/javascript; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream'
        if (typeof res.type === 'function') res.type(contentType)
        else if (typeof res.setHeader === 'function') res.setHeader('Content-Type', contentType)
        if (typeof res.sendFile === 'function') return res.sendFile(file)
        const bytes = fs.readFileSync(file)
        if (typeof res.end === 'function') return res.end(bytes)
      } catch (err) { if (next) return next(err) }
    })
    plugin._plotterAssetsMounted = true
  }

  function registerPlotterResources() {
    if (typeof app.registerResourceProvider !== 'function' || plugin._plotterResourcesRegistered) return
    app.registerResourceProvider({
      type: 'plotterExtensions',
      methods: {
        listResources: async () => ({ [plugin.id]: plotterManifest() }),
        getResource: async id => id === plugin.id ? plotterManifest() : null,
        setResource: async () => { throw new Error('read-only') },
        deleteResource: async () => { throw new Error('read-only') }
      }
    })
    app.registerResourceProvider({
      type: RISK_RESOURCE_TYPE,
      methods: {
        listResources: async () => ({ 'live-risk-overlay': riskOverlayResource() }),
        getResource: async id => id === 'live-risk-overlay' ? riskOverlayResource() : null,
        setResource: async () => { throw new Error('read-only') },
        deleteResource: async () => { throw new Error('read-only') }
      }
    })
    plugin._plotterResourcesRegistered = true
  }

  plugin.registerWithRouter = function registerWithRouter(router) {
    const register = router && typeof router.access === 'function' ? router.access('readonly') : router
    if (!register || typeof register.get !== 'function') return
    register.get('/targets', (_req, res) => res.status(200).json(targetSnapshot()))
  }

  plugin.getOpenApi = () => openApi

  function notificationPath(context) {
    return `notifications.navigation.collision.ais.${targetId(context)}`
  }

  function clearNotification(context) {
    const item = active.get(context)
    if (!item) return
    try {
      if (item.id && app.notifications && typeof app.notifications.clear === 'function') app.notifications.clear(item.id)
      else if (typeof app.handleMessage === 'function') {
        app.handleMessage(plugin.id, { context: 'vessels.self', updates: [{ values: [{ path: notificationPath(context), value: { state: 'normal', method: [], message: 'AIS collision risk clear.' } }] }] })
      }
    } catch (err) {
      if (typeof app.debug === 'function') app.debug(`Unable to clear managed notification: ${err.message || err}`)
    }
    active.delete(context)
  }

  function raiseNotification(target, risk, metrics, prediction) {
    const context = target.context
    const previous = active.get(context)
    const now = Date.now()
    const repeatMs = cfg.repeatMinutes * 60000
    if (previous && previous.level === risk.level && (repeatMs === 0 || now - previous.notifiedAt < repeatMs)) return
    if (previous && previous.level !== risk.level) clearNotification(context)

    const label = target.name || target.mmsi || targetId(context)
    const tcpa = metrics.tcpaMinutes >= 0 ? `${metrics.tcpaMinutes.toFixed(1)} min` : 'past'
    const predicted = prediction ? ` Ensemble median CPA ${prediction.cpaNm.toFixed(2)} NM in ${prediction.tcpaMinutes.toFixed(1)} min; votes alarm/warn/none ${prediction.votes.alarm}/${prediction.votes.warn}/${prediction.votes.none}.` : ''
    const message = `AIS ${risk.level.toUpperCase()}: ${label}; range ${metrics.rangeNm.toFixed(2)} NM, CPA ${metrics.cpaNm.toFixed(2)} NM, TCPA ${tcpa}.${predicted} Source: ${risk.source}. Maintain a proper lookout and verify visually/radar.`
    const data = { targetContext: context, mmsi: target.mmsi || null, name: target.name || null, rangeNm: +metrics.rangeNm.toFixed(3), cpaNm: +metrics.cpaNm.toFixed(3), tcpaMinutes: +metrics.tcpaMinutes.toFixed(2), reason: risk.reason, riskSource: risk.source, predictedCpaNm: prediction ? +prediction.cpaNm.toFixed(3) : null, predictedTcpaMinutes: prediction ? +prediction.tcpaMinutes.toFixed(2) : null, predictionConfidence: prediction ? +prediction.confidence.toFixed(3) : null, predictionModel: prediction ? prediction.model : null, predictionVotes: prediction ? prediction.votes : null }
    let id = null
    try {
      if (app.notifications && typeof app.notifications.raise === 'function') {
        id = app.notifications.raise({ state: risk.state, message, path: notificationPath(context).replace(/^notifications\./, ''), includePosition: cfg.includePosition, includeCreatedAt: true, data })
      } else if (typeof app.handleMessage === 'function') {
        app.handleMessage(plugin.id, { context: 'vessels.self', updates: [{ values: [{ path: notificationPath(context), value: { state: risk.state, method: cfg.notificationMethods, message, data } }] }] })
      }
      active.set(context, { id, level: risk.level, notifiedAt: now })
    } catch (err) { logError(err) }
  }

  function evaluate() {
    const now = Date.now()
    const effectiveOwn = effectiveOwnRecord(now)
    if (!effectiveOwn) {
      if (typeof app.setPluginStatus === 'function') app.setPluginStatus(`Running: waiting for own-vessel navigation data or anchored/moored state; ${targets.size} AIS targets seen`)
      return
    }
    let dangerous = 0
    for (const [context, target] of targets) {
      if (now - (target.navLastSeen || target.lastSeen || 0) > cfg.targetStaleSeconds * 1000) {
        targets.delete(context); clearNotification(context); continue
      }
      if (!target.position || !Number.isFinite(target.speed) || !Number.isFinite(target.course)) { clearNotification(context); continue }
      const { metrics, prediction, risk } = assessTarget(target, now)
      if (!metrics || metrics.rangeNm > cfg.maxTargetRangeNm) { clearNotification(context); continue }
      if (risk.level === 'none' || risk.level === 'unknown') clearNotification(context)
      else { dangerous += 1; raiseNotification(target, risk, metrics, prediction) }
    }
    const ownStatus = stationKeepingStatus()
    if (typeof app.setPluginStatus === 'function') app.setPluginStatus(`Monitoring ${targets.size} AIS target(s); ${dangerous} hazardous; own mode ${ownStatus.mode}${ownStatus.anchorWatchActive ? ' (anchor watch active)' : ''}; predictor ensemble ${cfg.predictiveAiEnabled ? 'enabled' : 'disabled'}`)
  }

  plugin.start = function start(options = {}) {
    plugin.stop()
    cfg = makeConfig(options)
    own = {}
    targets.clear()
    active.clear()
    mountPlotterAssets()
    registerPlotterResources()
    if (app.subscriptionmanager && typeof app.subscriptionmanager.subscribe === 'function') {
      const subscription = {
        context: 'vessels.*',
        subscribe: [
          { path: 'navigation.position' },
          { path: 'navigation.speedOverGround' },
          { path: 'navigation.courseOverGroundTrue' },
          { path: 'navigation.anchor.state' },
          { path: 'navigation.anchor.position' },
          { path: 'navigation.anchor.currentRadius' },
          { path: 'navigation.anchor.maxRadius' },
          { path: 'navigation.state' },
          { path: 'notifications.navigation.anchor' },
          { path: 'name' },
          { path: 'mmsi' }
        ]
      }
      app.subscriptionmanager.subscribe(subscription, unsubscribes, logError, consume)
    }
    timer = setInterval(evaluate, Math.max(500, cfg.evaluationIntervalSeconds * 1000))
    if (timer && typeof timer.unref === 'function') timer.unref()
    if (typeof app.setPluginStatus === 'function') app.setPluginStatus('Running: waiting for navigation and AIS data')
  }

  plugin.stop = function stop() {
    if (timer) { clearInterval(timer); timer = null }
    for (const fn of unsubscribes) { try { fn() } catch (_) {} }
    unsubscribes = []
    for (const context of Array.from(active.keys())) clearNotification(context)
    if (typeof app.setPluginStatus === 'function') app.setPluginStatus('Stopped')
  }

  plugin._test = { consume, evaluate, targetSnapshot, assessTarget, appendHistory, stationKeepingStatus, effectiveOwnRecord, getTargets: () => targets, getOwn: () => own, getActive: () => active, getPredictorRegistry: () => predictorRegistry, makeConfig, riskOverlayResource, plotterManifest }
  return plugin
}
