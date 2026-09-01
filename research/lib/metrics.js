'use strict'
const { localOffsetMeters } = require('../../plugin/risk')
function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null }
function mae(xs) { return mean(xs.map(Math.abs)) }
function distance(a, b) { const o = localOffsetMeters(a, b); return o ? Math.hypot(o.x, o.y) : null }
function interpolatePath(path, seconds) {
  if (!Array.isArray(path) || !path.length) return null
  if (seconds <= path[0].seconds) return path[0].position
  for (let i = 1; i < path.length; i += 1) { const a = path[i - 1], b = path[i]; if (seconds <= b.seconds) { const q = (seconds - a.seconds) / Math.max(1e-9, b.seconds - a.seconds); return { latitude: a.position.latitude + q * (b.position.latitude - a.position.latitude), longitude: a.position.longitude + q * (b.position.longitude - a.position.longitude) } } }
  return path.at(-1).position
}
function pathErrors(path, future, anchorTime) { const es = []; for (const r of future) { const p = interpolatePath(path, (r.t - anchorTime) / 1000); const e = p && distance(p, r.position); if (Number.isFinite(e)) es.push(e) } return { adeM: mean(es), fdeM: es.length ? es.at(-1) : null, samples: es.length } }
function confusionInit() { return { alarm: { alarm: 0, warn: 0, none: 0, unknown: 0 }, warn: { alarm: 0, warn: 0, none: 0, unknown: 0 }, none: { alarm: 0, warn: 0, none: 0, unknown: 0 } } }
function addConfusion(m, truth, predicted) { if (m[truth] && m[truth][predicted] !== undefined) m[truth][predicted] += 1 }
module.exports = { mean, mae, distance, interpolatePath, pathErrors, confusionInit, addConfusion }
