'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { angleDelta, estimateMotion, predictClosestApproach } = require('../plugin/predictor')

function history(now, position, speed, courses) {
  return courses.map((course, i) => ({
    t: now - (courses.length - 1 - i) * 10000,
    position,
    speed,
    course
  }))
}

test('angleDelta unwraps across north', () => {
  const d = angleDelta(1 * Math.PI / 180, 359 * Math.PI / 180)
  assert.ok(d > 0)
  assert.ok(d < 5 * Math.PI / 180)
})

test('adaptive motion model learns turn trend with confidence', () => {
  const now = Date.now()
  const record = {
    history: history(now, { latitude: 0, longitude: 0 }, 5, [350, 355, 0, 5, 10].map(v => v * Math.PI / 180))
  }
  const model = estimateMotion(record, { historySeconds: 180, minimumSamples: 4, minimumHistorySeconds: 20, staleSeconds: 90, maxTurnRateDegreesPerMinute: 60 }, now)
  assert.ok(model.turnRate > 0)
  assert.ok(model.confidence >= 0.55)
  assert.equal(model.sampleCount, 5)
})

test('predictClosestApproach returns auditable local trajectory result', () => {
  const now = Date.now()
  const own = {
    history: history(now, { latitude: 0, longitude: 0 }, 4, [90, 90, 90, 90, 90].map(v => v * Math.PI / 180))
  }
  const target = {
    history: history(now, { latitude: 0, longitude: 0.02 }, 4, [270, 270, 270, 270, 270].map(v => v * Math.PI / 180))
  }
  const result = predictClosestApproach(own, target, { historySeconds: 180, minimumSamples: 4, minimumHistorySeconds: 20, horizonMinutes: 20, stepSeconds: 5, staleSeconds: 90 }, now)
  assert.ok(result)
  assert.ok(result.cpaNm < 0.05)
  assert.ok(result.tcpaMinutes > 0)
  assert.ok(result.confidence >= 0.55)
  assert.equal(result.model, 'adaptive-turn-acceleration-v1')
})
