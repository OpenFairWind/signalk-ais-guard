'use strict'
// Compatibility facade retained for consumers/tests from v1.2.x.
const adaptive = require('./predictors/adaptive-turn-acceleration')
const { angleDelta, estimateMotion } = require('./predictors/kinematic')
const { normalizeReport } = require('./predictors/interface')
function predictClosestApproach(own, target, options = {}, now = Date.now()) {
  const report = normalizeReport(adaptive, adaptive.predict({ own, target, options, now }))
  if (report.status !== 'ok') return null
  return { cpaM: report.cpaM, cpaNm: report.cpaNm, tcpaSeconds: report.tcpaSeconds, tcpaMinutes: report.tcpaMinutes, confidence: report.confidence, own: report.diagnostics.own, target: report.diagnostics.target, model: 'adaptive-turn-acceleration-v1' }
}
module.exports = { angleDelta, estimateMotion, predictClosestApproach }
