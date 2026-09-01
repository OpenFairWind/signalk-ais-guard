'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { normalize, validate, sortAndDedupe } = require('../research/lib/dataset')
const { buildCases, splitCases } = require('../research/lib/cases')
const { run } = require('../research/lib/benchmark')

function obs(t, mmsi, x, y, speed, course) {
  const R = 6371000
  return { schema: 'signalk-ais-guard.research-observation/1', t, mmsi, position: { latitude: 40 + y / R * 180 / Math.PI, longitude: 14 + x / (R * Math.cos(40 * Math.PI / 180)) * 180 / Math.PI }, speed, course, source: 'test' }
}

test('research normalization converts knots/degrees and validates canonical data', () => {
  const r = normalize({ ts: '2026-01-01T00:00:00Z', id: '123456789', lat: '40', lon: '14', sog: '10', cog: '90' }, { timestamp: 'ts', mmsi: 'id', latitude: 'lat', longitude: 'lon', speed: 'sog', speedUnit: 'knots', course: 'cog', courseUnit: 'degrees' }, 'fixture')
  assert.equal(validate(r).length, 0)
  assert.ok(Math.abs(r.speed - 5.144444444444445) < 1e-9)
  assert.ok(Math.abs(r.course - Math.PI / 2) < 1e-12)
})

test('research deduplication is deterministic on MMSI and timestamp', () => {
  const a = obs(1000, '123456789', 0, 0, 1, 0); const b = { ...a, speed: 2 }
  const rows = sortAndDedupe([a, b])
  assert.equal(rows.length, 1); assert.equal(rows[0].speed, 2)
})

test('case construction keeps future observations out of predictor history', () => {
  const rows = []; const base = Date.UTC(2026,0,1)
  for (let s = 0; s <= 360; s += 10) { rows.push(obs(base+s*1000,'111111111',-1000+4*s,0,4,Math.PI/2)); rows.push(obs(base+s*1000,'222222222',1000-4*s,0,4,3*Math.PI/2)) }
  const cases = buildCases(rows, { historySeconds: 60, horizonSeconds: 120, anchorStrideSeconds: 60, minimumHistorySamples: 4, maxRangeNm: 5 })
  assert.ok(cases.length > 0)
  for (const c of cases) { assert.ok(c.own.history.every(r => r.t <= c.anchorTime)); assert.ok(c.target.history.every(r => r.t <= c.anchorTime)); assert.ok(c.own.future.every(r => r.t > c.anchorTime)); assert.ok(c.target.future.every(r => r.t > c.anchorTime)) }
})

test('group split never leaks a group across partitions', () => {
  const cases = []
  for (let g=0; g<12; g+=1) for (let i=0;i<3;i+=1) cases.push({ groupId:`g${g}`, id:`${g}-${i}` })
  const s = splitCases(cases, { train:0.6, validation:0.2, test:0.2 }, 'fixed')
  const where = new Map(); for (const [part, rows] of Object.entries(s)) for (const r of rows) { if (where.has(r.groupId)) assert.equal(where.get(r.groupId), part); else where.set(r.groupId, part) }
  assert.ok(s.train.length && s.validation.length && s.test.length)
})

test('benchmark executes production AGTPI predictors outside Signal K', () => {
  const base = Date.UTC(2026,0,1); const rows=[]
  for(let s=0;s<=300;s+=10){rows.push(obs(base+s*1000,'111111111',-1000+4*s,0,4,Math.PI/2));rows.push(obs(base+s*1000,'222222222',1000-4*s,0,4,3*Math.PI/2))}
  const cases=buildCases(rows,{historySeconds:60,horizonSeconds:120,anchorStrideSeconds:60,minimumHistorySamples:4,maxRangeNm:5})
  const report=run(cases.slice(0,2),{historySeconds:60,horizonMinutes:2,minimumSamples:4,minimumHistorySeconds:20,predictionMinimumVotes:2,immediateRangeNm:0.1,alarmCpaNm:0.25,warnCpaNm:0.5,maxTcpaMinutes:2})
  assert.equal(report.predictors.length,3); assert.ok(report.predictors.every(p=>p.cases===report.cases)); assert.ok(report.cases>0)
})
