'use strict'
const { stableHash } = require('./io')
const { normalizePosition } = require('../../plugin/risk')
const SCHEMA = 'signalk-ais-guard.research-observation/1'
function valueAt(raw, key) { return key == null ? undefined : raw[key] }
function number(v) { const n = Number(v); return Number.isFinite(n) ? n : null }
function timestampMs(v) { if (typeof v === 'number' && Number.isFinite(v)) return v > 1e12 ? v : v * 1000; const n = Number(v); if (Number.isFinite(n) && String(v).trim() !== '') return n > 1e12 ? n : n * 1000; const t = Date.parse(v); return Number.isFinite(t) ? t : null }
function normalize(raw, mapping, source = 'unknown') {
  const t = timestampMs(valueAt(raw, mapping.timestamp)); const mmsiRaw = valueAt(raw, mapping.mmsi)
  const lat = number(valueAt(raw, mapping.latitude)); const lon = number(valueAt(raw, mapping.longitude))
  let speed = number(valueAt(raw, mapping.speed)); let course = number(valueAt(raw, mapping.course))
  if (mapping.speedUnit === 'knots' && speed != null) speed *= 0.5144444444444445
  if (mapping.courseUnit !== 'radians' && course != null) course *= Math.PI / 180
  const rec = { schema: SCHEMA, t, mmsi: mmsiRaw == null ? '' : String(mmsiRaw).trim(), position: { latitude: lat, longitude: lon }, speed, course, source }
  for (const [out, input] of Object.entries(mapping.optional || {})) if (valueAt(raw, input) != null && valueAt(raw, input) !== '') rec[out] = valueAt(raw, input)
  return rec
}
function validate(r) {
  const errors = []
  if (!r || r.schema !== SCHEMA) errors.push('schema')
  if (!Number.isFinite(r && r.t)) errors.push('timestamp')
  if (!r || !/^\d{7,9}$/.test(String(r.mmsi || ''))) errors.push('mmsi')
  if (!normalizePosition(r && r.position)) errors.push('position')
  if (!Number.isFinite(r && r.speed) || r.speed < 0 || r.speed > 60) errors.push('speed')
  if (!Number.isFinite(r && r.course)) errors.push('course')
  return errors
}
function sortAndDedupe(rows) {
  const map = new Map()
  for (const r of rows) map.set(`${r.mmsi}|${r.t}`, r)
  return Array.from(map.values()).sort((a, b) => a.t - b.t || String(a.mmsi).localeCompare(String(b.mmsi)))
}
function stats(rows) {
  const vessels = new Map(); let minT = Infinity; let maxT = -Infinity
  for (const r of rows) { vessels.set(r.mmsi, (vessels.get(r.mmsi) || 0) + 1); minT = Math.min(minT, r.t); maxT = Math.max(maxT, r.t) }
  return { schema: 'signalk-ais-guard.dataset-stats/1', observations: rows.length, vessels: vessels.size, start: Number.isFinite(minT) ? new Date(minT).toISOString() : null, end: Number.isFinite(maxT) ? new Date(maxT).toISOString() : null, perVessel: Object.fromEntries([...vessels.entries()].sort()) }
}
function pseudonymize(rows, salt) { return rows.map(r => ({ ...r, mmsi: String(parseInt(stableHash(`${salt}:${r.mmsi}`).slice(0, 12), 16) % 900000000 + 100000000) })) }
module.exports = { SCHEMA, normalize, validate, sortAndDedupe, stats, pseudonymize }
