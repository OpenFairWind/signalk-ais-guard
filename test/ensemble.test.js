'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { INTERFACE_ID, INTERFACE_VERSION, createRegistry, runPredictors, majorityRisk } = require('../plugin/predictors')

function fake(id, level, confidence = 0.9) {
  const cpaNm = level === 'alarm' ? 0.2 : level === 'warn' ? 0.7 : 2
  return {
    interface: INTERFACE_ID, interfaceVersion: INTERFACE_VERSION,
    id, version: '1.0.0', name: id,
    predict() { return { status: 'ok', cpaM: cpaNm * 1852, tcpaSeconds: 300, confidence } }
  }
}
const classify = report => ({ level: report.cpaNm < 0.5 ? 'alarm' : report.cpaNm < 1 ? 'warn' : 'none', state: report.cpaNm < 0.5 ? 'alarm' : report.cpaNm < 1 ? 'warn' : 'normal', reason: 'test' })

test('registry validates the standard interface and prevents duplicate ids', () => {
  const registry = createRegistry([])
  registry.register(fake('p1', 'none'))
  assert.equal(registry.list().length, 1)
  assert.throws(() => registry.register(fake('p1', 'warn')), /already registered/)
  assert.throws(() => registry.register({ id: 'bad' }), /(version|interface)/)
})

test('ordinal majority reports alarm only with an alarm majority', () => {
  const reports = runPredictors([fake('a','alarm'), fake('b','alarm'), fake('c','warn')], {}, classify, 0.5)
  const result = majorityRisk(reports, 2)
  assert.equal(result.level, 'alarm')
  assert.deepEqual(result.votes, { alarm: 2, warn: 1, none: 0 })
})

test('ordinal majority reports warning when a majority reports at least warning', () => {
  const reports = runPredictors([fake('a','alarm'), fake('b','warn'), fake('c','none')], {}, classify, 0.5)
  assert.equal(majorityRisk(reports, 2).level, 'warn')
})

test('low-confidence reports abstain from the vote and quorum is enforced', () => {
  const reports = runPredictors([fake('a','alarm',0.2), fake('b','warn',0.9)], {}, classify, 0.5)
  const result = majorityRisk(reports, 2)
  assert.equal(result.level, 'unknown')
  assert.equal(result.reason, 'ensemble-insufficient-quorum')
  assert.equal(result.eligibleVotes, 1)
})


test('even split has no majority and must not be treated as clear', () => {
  const reports = runPredictors([fake('a','alarm'), fake('b','none')], {}, classify, 0.5)
  const result = majorityRisk(reports, 2)
  assert.equal(result.level, 'unknown')
  assert.equal(result.reason, 'ensemble-no-majority')
})
