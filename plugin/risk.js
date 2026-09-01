'use strict'

const EARTH_RADIUS_M = 6371008.8
const NM_M = 1852

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizePosition(position) {
  if (!position || !finiteNumber(position.latitude) || !finiteNumber(position.longitude)) return null
  if (position.latitude < -90 || position.latitude > 90 || position.longitude < -180 || position.longitude > 180) return null
  return { latitude: position.latitude, longitude: position.longitude }
}

function localOffsetMeters(origin, point) {
  const a = normalizePosition(origin)
  const b = normalizePosition(point)
  if (!a || !b) return null
  const lat0 = ((a.latitude + b.latitude) / 2) * Math.PI / 180
  let dLon = (b.longitude - a.longitude) * Math.PI / 180
  if (dLon > Math.PI) dLon -= 2 * Math.PI
  if (dLon < -Math.PI) dLon += 2 * Math.PI
  const dLat = (b.latitude - a.latitude) * Math.PI / 180
  return { x: EARTH_RADIUS_M * dLon * Math.cos(lat0), y: EARTH_RADIUS_M * dLat }
}

function velocity(speed, course) {
  if (!finiteNumber(speed) || !finiteNumber(course) || speed < 0) return null
  return { x: speed * Math.sin(course), y: speed * Math.cos(course) }
}

function computeCpa(own, target) {
  const r = localOffsetMeters(own.position, target.position)
  const vo = velocity(own.speed, own.course)
  const vt = velocity(target.speed, target.course)
  if (!r || !vo || !vt) return null
  const rv = { x: vt.x - vo.x, y: vt.y - vo.y }
  const vv = rv.x * rv.x + rv.y * rv.y
  const rangeM = Math.hypot(r.x, r.y)
  let tcpaSeconds = 0
  if (vv > 1e-8) tcpaSeconds = -((r.x * rv.x + r.y * rv.y) / vv)
  const closest = {
    x: r.x + rv.x * Math.max(0, tcpaSeconds),
    y: r.y + rv.y * Math.max(0, tcpaSeconds)
  }
  return {
    rangeM,
    rangeNm: rangeM / NM_M,
    cpaM: Math.hypot(closest.x, closest.y),
    cpaNm: Math.hypot(closest.x, closest.y) / NM_M,
    tcpaSeconds,
    tcpaMinutes: tcpaSeconds / 60,
    closing: tcpaSeconds > 0
  }
}

function classifyRisk(metrics, cfg) {
  if (!metrics) return { level: 'none', state: 'normal', reason: 'insufficient-data' }
  const imminent = metrics.rangeNm <= cfg.immediateRangeNm
  const future = metrics.tcpaMinutes >= 0 && metrics.tcpaMinutes <= cfg.maxTcpaMinutes
  if (imminent || (future && metrics.cpaNm <= cfg.alarmCpaNm)) {
    return { level: 'alarm', state: 'alarm', reason: imminent ? 'immediate-range' : 'cpa-tcpa' }
  }
  if (future && metrics.cpaNm <= cfg.warnCpaNm) {
    return { level: 'warn', state: 'warn', reason: 'cpa-tcpa' }
  }
  return { level: 'none', state: 'normal', reason: 'clear' }
}

module.exports = { NM_M, normalizePosition, localOffsetMeters, computeCpa, classifyRisk }
