'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { computeCpa, classifyRisk, localOffsetMeters } = require('../plugin/risk')

const east = Math.PI / 2
const west = 3 * Math.PI / 2

test('local offset handles antimeridian', () => {
  const r = localOffsetMeters({latitude: 0, longitude: 179.999}, {latitude: 0, longitude: -179.999})
  assert.ok(r.x > 0 && r.x < 300)
})

test('head-on encounter produces near-zero CPA and positive TCPA', () => {
  const own = { position: {latitude: 0, longitude: 0}, speed: 5, course: east }
  const target = { position: {latitude: 0, longitude: 0.01}, speed: 5, course: west }
  const m = computeCpa(own, target)
  assert.ok(m.cpaNm < 0.02)
  assert.ok(m.tcpaMinutes > 1 && m.tcpaMinutes < 3)
})

test('diverging target has negative TCPA', () => {
  const own = { position: {latitude: 0, longitude: 0}, speed: 5, course: west }
  const target = { position: {latitude: 0, longitude: 0.01}, speed: 5, course: east }
  assert.ok(computeCpa(own, target).tcpaMinutes < 0)
})

test('risk thresholds distinguish alarm warning and clear', () => {
  const cfg = { immediateRangeNm: .15, maxTcpaMinutes: 20, alarmCpaNm: .5, warnCpaNm: 1 }
  assert.equal(classifyRisk({rangeNm: 2, cpaNm: .2, tcpaMinutes: 10}, cfg).level, 'alarm')
  assert.equal(classifyRisk({rangeNm: 2, cpaNm: .8, tcpaMinutes: 10}, cfg).level, 'warn')
  assert.equal(classifyRisk({rangeNm: 2, cpaNm: .2, tcpaMinutes: -1}, cfg).level, 'none')
})
