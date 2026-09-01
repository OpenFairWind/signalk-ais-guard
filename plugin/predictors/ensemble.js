'use strict'
const { assertPredictor, normalizeReport } = require('./interface')

const RANK = { none: 0, warn: 1, alarm: 2 }
function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
function runPredictors(predictors, input, classify, minimumConfidence = 0) {
  return predictors.map(p => {
    const predictor = assertPredictor(p)
    let report
    try { report = normalizeReport(predictor, predictor.predict(input)) }
    catch (err) { report = normalizeReport(predictor, { status: 'abstain', reason: `error:${err && err.message ? err.message : String(err)}` }) }
    if (report.status !== 'ok') return { ...report, eligible: false, risk: { level: 'unknown', state: 'normal', reason: report.reason } }
    if (report.confidence < minimumConfidence) return { ...report, eligible: false, reason: 'below-minimum-confidence', risk: { level: 'unknown', state: 'normal', reason: 'below-minimum-confidence' } }
    return { ...report, eligible: true, risk: classify(report) }
  })
}
function majorityRisk(reports, minimumVotes = 1) {
  const eligible = reports.filter(r => r.eligible && RANK[r.risk && r.risk.level] !== undefined)
  const n = eligible.length
  const votes = { alarm: 0, warn: 0, none: 0 }
  for (const r of eligible) votes[r.risk.level] += 1
  if (n < Math.max(1, minimumVotes)) return { level: 'unknown', state: 'normal', reason: 'ensemble-insufficient-quorum', source: 'prediction-ensemble', eligibleVotes: n, requiredVotes: Math.max(1, minimumVotes), votes }
  let level
  if (votes.alarm > n / 2) level = 'alarm'
  else if ((votes.alarm + votes.warn) > n / 2) level = 'warn'
  else if (votes.none > n / 2) level = 'none'
  else return { level: 'unknown', state: 'normal', reason: 'ensemble-no-majority', source: 'prediction-ensemble', eligibleVotes: n, requiredVotes: Math.max(1, minimumVotes), votes }
  return { level, state: level === 'alarm' ? 'alarm' : level === 'warn' ? 'warn' : 'normal', reason: 'predictor-majority', source: 'prediction-ensemble', eligibleVotes: n, requiredVotes: Math.max(1, minimumVotes), votes }
}
function representativeReport(reports) {
  const eligible = reports.filter(r => r.eligible && Array.isArray(r.ownPath) && Array.isArray(r.targetPath))
  eligible.sort((a, b) => (b.confidence || 0) - (a.confidence || 0) || a.predictor.id.localeCompare(b.predictor.id))
  return eligible[0] || null
}
function ensembleSummary(reports) {
  const eligible = reports.filter(r => r.eligible)
  return {
    cpaNm: median(eligible.map(r => r.cpaNm)),
    tcpaMinutes: median(eligible.map(r => r.tcpaMinutes)),
    confidence: median(eligible.map(r => r.confidence)),
    eligibleCount: eligible.length,
    reportCount: reports.length
  }
}
module.exports = { runPredictors, majorityRisk, ensembleSummary, representativeReport }
