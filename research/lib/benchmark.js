'use strict'
const { BUILT_INS } = require('../../plugin/predictors')
const { normalizeReport } = require('../../plugin/predictors/interface')
const { runPredictors, majorityRisk } = require('../../plugin/predictors/ensemble')
const { classifyRisk } = require('../../plugin/risk')
const { pathErrors, confusionInit, addConfusion, mae, mean } = require('./metrics')
function record(history) { const latest = history.at(-1); return { position: latest.position, speed: latest.speed, course: latest.course, lastSeen: latest.t, navLastSeen: latest.t, history: history.map(r => ({ t: r.t, position: r.position, speed: r.speed, course: r.course })) } }
function cfg(config = {}) { return { immediateRangeNm: config.immediateRangeNm ?? 0.1, alarmCpaNm: config.alarmCpaNm ?? 0.25, warnCpaNm: config.warnCpaNm ?? 0.5, maxTcpaMinutes: config.maxTcpaMinutes ?? 20 } }
function run(cases, options = {}, predictorIds = null) {
  const predictors = BUILT_INS.filter(p => !predictorIds || predictorIds.includes(p.id)); const riskCfg = cfg(options)
  const per = Object.fromEntries(predictors.map(p => [p.id, { predictor: { id: p.id, version: p.version }, cases: 0, ok: 0, abstain: 0, cpaErrorsM: [], tcpaErrorsS: [], ownAde: [], ownFde: [], targetAde: [], targetFde: [], confusion: confusionInit() }]))
  const ensemble = { cases: 0, eligible: 0, noDecision: 0, confusion: confusionInit() }
  for (const c of cases) {
    const input = { own: record(c.own.history), target: record(c.target.history), options, now: c.anchorTime }
    const rangeM = require('../../plugin/risk').localOffsetMeters(c.own.history.at(-1).position, c.target.history.at(-1).position); const rangeNm = rangeM ? Math.hypot(rangeM.x, rangeM.y) / 1852 : Infinity
    const truthRisk = classifyRisk({ rangeNm, cpaNm: c.truth.cpaM / 1852, tcpaMinutes: c.truth.tcpaSeconds / 60 }, riskCfg).level
    for (const p of predictors) {
      const s = per[p.id]; s.cases += 1; let report
      try { report = normalizeReport(p, p.predict(input)) } catch { report = { status: 'abstain' } }
      if (report.status !== 'ok') { s.abstain += 1; addConfusion(s.confusion, truthRisk, 'unknown'); continue }
      s.ok += 1; s.cpaErrorsM.push(report.cpaM - c.truth.cpaM); s.tcpaErrorsS.push(report.tcpaSeconds - c.truth.tcpaSeconds)
      const oe = pathErrors(report.ownPath, c.own.future, c.anchorTime); const te = pathErrors(report.targetPath, c.target.future, c.anchorTime)
      if (Number.isFinite(oe.adeM)) s.ownAde.push(oe.adeM); if (Number.isFinite(oe.fdeM)) s.ownFde.push(oe.fdeM); if (Number.isFinite(te.adeM)) s.targetAde.push(te.adeM); if (Number.isFinite(te.fdeM)) s.targetFde.push(te.fdeM)
      addConfusion(s.confusion, truthRisk, classifyRisk({ rangeNm, cpaNm: report.cpaNm, tcpaMinutes: report.tcpaMinutes }, riskCfg).level)
    }
    const reports = runPredictors(predictors, input, r => classifyRisk({ rangeNm, cpaNm: r.cpaNm, tcpaMinutes: r.tcpaMinutes }, riskCfg), options.predictionMinimumConfidence ?? 0)
    const maj = majorityRisk(reports, options.predictionMinimumVotes ?? 1); ensemble.cases += 1; if (maj.level === 'unknown') ensemble.noDecision += 1; else ensemble.eligible += 1; addConfusion(ensemble.confusion, truthRisk, maj.level)
  }
  const predictorsOut = Object.values(per).map(s => ({ predictor: s.predictor, cases: s.cases, coverage: s.cases ? s.ok / s.cases : 0, abstentions: s.abstain, cpaMaeM: mae(s.cpaErrorsM), tcpaMaeSeconds: mae(s.tcpaErrorsS), ownAdeM: mean(s.ownAde), ownFdeM: mean(s.ownFde), targetAdeM: mean(s.targetAde), targetFdeM: mean(s.targetFde), riskConfusion: s.confusion }))
  return { schema: 'signalk-ais-guard.benchmark/1', generatedAt: new Date().toISOString(), cases: cases.length, options, predictors: predictorsOut, ensemble: { ...ensemble, coverage: ensemble.cases ? ensemble.eligible / ensemble.cases : 0 } }
}
module.exports = { run }
