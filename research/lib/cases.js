'use strict'
const { localOffsetMeters } = require('../../plugin/risk')
const { stableHash } = require('./io')
const CASE_SCHEMA = 'signalk-ais-guard.research-case/1'
function distanceM(a, b) { const o = localOffsetMeters(a.position, b.position); return o ? Math.hypot(o.x, o.y) : Infinity }
function nearest(list, t, tolMs) { let best = null; let d = Infinity; for (const r of list) { const x = Math.abs(r.t - t); if (x < d) { best = r; d = x } } return d <= tolMs ? best : null }
function truthFromFuture(ownFuture, targetFuture, anchorT, tolMs) {
  let best = null
  for (const o of ownFuture) { const t = nearest(targetFuture, o.t, tolMs); if (!t) continue; const d = distanceM(o, t); if (!best || d < best.cpaM) best = { cpaM: d, tcpaSeconds: Math.max(0, (Math.max(o.t, t.t) - anchorT) / 1000), ownPosition: o.position, targetPosition: t.position } }
  return best
}
function buildCases(rows, opts = {}) {
  const historyMs = (opts.historySeconds || 180) * 1000; const futureMs = (opts.horizonSeconds || 1200) * 1000
  const tolMs = (opts.syncToleranceSeconds || 5) * 1000; const strideMs = (opts.anchorStrideSeconds || 30) * 1000
  const minHistory = opts.minimumHistorySamples || 4; const maxRangeM = (opts.maxRangeNm || 6) * 1852
  const by = new Map(); for (const r of rows) { if (!by.has(r.mmsi)) by.set(r.mmsi, []); by.get(r.mmsi).push(r) }
  for (const list of by.values()) list.sort((a, b) => a.t - b.t)
  const ids = [...by.keys()].sort(); const cases = []; const lastAnchorByOwn = new Map()
  const anchors = rows.filter(r => !opts.ownMmsi || String(r.mmsi) === String(opts.ownMmsi)).sort((a, b) => a.t - b.t)
  for (const ownAnchor of anchors) {
    const previousAnchor = lastAnchorByOwn.get(ownAnchor.mmsi) ?? -Infinity
    if (ownAnchor.t - previousAnchor < strideMs) continue
    lastAnchorByOwn.set(ownAnchor.mmsi, ownAnchor.t)
    const ownList = by.get(ownAnchor.mmsi)
    for (const targetId of ids) {
      if (targetId === ownAnchor.mmsi) continue
      if (!opts.ownMmsi && String(ownAnchor.mmsi) > String(targetId)) continue
      const targetList = by.get(targetId); const ta = nearest(targetList, ownAnchor.t, tolMs)
      if (!ta || distanceM(ownAnchor, ta) > maxRangeM) continue
      const ownHistory = ownList.filter(r => r.t <= ownAnchor.t && r.t >= ownAnchor.t - historyMs)
      const targetHistory = targetList.filter(r => r.t <= ownAnchor.t && r.t >= ownAnchor.t - historyMs)
      const ownFuture = ownList.filter(r => r.t > ownAnchor.t && r.t <= ownAnchor.t + futureMs)
      const targetFuture = targetList.filter(r => r.t > ownAnchor.t && r.t <= ownAnchor.t + futureMs)
      if (ownHistory.length < minHistory || targetHistory.length < minHistory || !ownFuture.length || !targetFuture.length) continue
      const truth = truthFromFuture(ownFuture, targetFuture, ownAnchor.t, tolMs); if (!truth) continue
      const day = new Date(ownAnchor.t).toISOString().slice(0, 10); const groupId = `${ownAnchor.mmsi}-${targetId}-${day}`
      const id = stableHash(`${groupId}:${ownAnchor.t}`).slice(0, 20)
      cases.push({ schema: CASE_SCHEMA, id, groupId, anchorTime: ownAnchor.t, own: { mmsi: ownAnchor.mmsi, history: ownHistory, future: ownFuture }, target: { mmsi: targetId, history: targetHistory, future: targetFuture }, truth })
    }
  }
  return cases
}
function splitCases(cases, ratios = { train: 0.6, validation: 0.2, test: 0.2 }, seed = 'ais-guard') {
  const out = { train: [], validation: [], test: [] }
  const groups = new Map(); for (const c of cases) { if (!groups.has(c.groupId)) groups.set(c.groupId, []); groups.get(c.groupId).push(c) }
  const ordered = [...groups.entries()].sort((a, b) => stableHash(`${seed}:${a[0]}`).localeCompare(stableHash(`${seed}:${b[0]}`)))
  const n = ordered.length; let nTrain = Math.round(n * ratios.train); let nVal = Math.round(n * ratios.validation)
  if (n >= 3) { nTrain = Math.max(1, Math.min(n - 2, nTrain)); nVal = Math.max(1, Math.min(n - nTrain - 1, nVal)) }
  else { nTrain = Math.min(n, Math.max(1, nTrain)); nVal = Math.min(n - nTrain, nVal) }
  ordered.forEach(([id, rows], i) => { const key = i < nTrain ? 'train' : i < nTrain + nVal ? 'validation' : 'test'; out[key].push(...rows) })
  return out
}
module.exports = { CASE_SCHEMA, buildCases, splitCases, truthFromFuture }
