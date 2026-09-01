'use strict'

const { localOffsetMeters } = require('../risk')
const TWO_PI = Math.PI * 2
const EARTH_RADIUS_M = 6371000

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)) }
function angleDelta(a, b) {
  let d = a - b
  while (d > Math.PI) d -= TWO_PI
  while (d < -Math.PI) d += TWO_PI
  return d
}
function linearStats(values) {
  if (!values.length) return { mean: 0, stdev: Infinity }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + ((v - mean) ** 2), 0) / values.length
  return { mean, stdev: Math.sqrt(variance) }
}
function motionSamples(record, options = {}, now = Date.now()) {
  const history = Array.isArray(record.history) ? record.history : []
  const windowMs = Math.max(10, options.historySeconds || 180) * 1000
  return history.filter(s => now - s.t <= windowMs && s.position && Number.isFinite(s.speed) && Number.isFinite(s.course)).sort((a, b) => a.t - b.t)
}
function latestMotion(record, samples, now) {
  return samples.at(-1) || (record.position && Number.isFinite(record.speed) && Number.isFinite(record.course)
    ? { t: record.navLastSeen || record.lastSeen || now, position: record.position, speed: record.speed, course: record.course }
    : null)
}
function estimateMotion(record, options = {}, now = Date.now()) {
  const samples = motionSamples(record, options, now)
  const latest = latestMotion(record, samples, now)
  if (!latest) return null
  const turnRates = []; const accelerations = []
  for (let i = 1; i < samples.length; i += 1) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000
    if (dt < 0.5 || dt > 120) continue
    turnRates.push(angleDelta(samples[i].course, samples[i - 1].course) / dt)
    accelerations.push((samples[i].speed - samples[i - 1].speed) / dt)
  }
  const turn = linearStats(turnRates); const accel = linearStats(accelerations)
  const duration = samples.length > 1 ? (samples.at(-1).t - samples[0].t) / 1000 : 0
  const countScore = clamp((samples.length - 1) / Math.max(1, (options.minimumSamples || 4) - 1), 0, 1)
  const durationScore = clamp(duration / Math.max(1, options.minimumHistorySeconds || 20), 0, 1)
  const freshnessScore = clamp(1 - ((now - latest.t) / Math.max(1000, (options.staleSeconds || 90) * 1000)), 0, 1)
  const turnNoiseScore = turnRates.length ? clamp(1 - turn.stdev / (2 * Math.PI / 180), 0, 1) : 0.35
  const accelNoiseScore = accelerations.length ? clamp(1 - accel.stdev / 0.15, 0, 1) : 0.35
  const confidence = clamp(0.30 * countScore + 0.25 * durationScore + 0.25 * freshnessScore + 0.10 * turnNoiseScore + 0.10 * accelNoiseScore, 0, 1)
  const maxTurnRate = (options.maxTurnRateDegreesPerMinute || 30) * Math.PI / 180 / 60
  const maxAcceleration = options.maxAccelerationMps2 || 0.25
  return { latest, turnRate: clamp(turn.mean, -maxTurnRate, maxTurnRate), acceleration: clamp(accel.mean, -maxAcceleration, maxAcceleration), confidence, sampleCount: samples.length, historySeconds: duration }
}
function simpleLatestModel(record, options = {}, now = Date.now()) {
  const samples = motionSamples(record, options, now); const latest = latestMotion(record, samples, now)
  if (!latest) return null
  const freshness = clamp(1 - ((now - latest.t) / Math.max(1000, (options.staleSeconds || 90) * 1000)), 0, 1)
  return { latest, turnRate: 0, acceleration: 0, confidence: 0.5 + 0.5 * freshness, sampleCount: samples.length || 1, historySeconds: samples.length > 1 ? (samples.at(-1).t - samples[0].t) / 1000 : 0 }
}
function stepMotion(state, dt) {
  const midCourse = state.course + state.turnRate * dt * 0.5
  const nextSpeed = Math.max(0, state.speed + state.acceleration * dt)
  const avgSpeed = Math.max(0, (state.speed + nextSpeed) / 2)
  return { x: state.x + avgSpeed * Math.sin(midCourse) * dt, y: state.y + avgSpeed * Math.cos(midCourse) * dt, speed: nextSpeed, course: state.course + state.turnRate * dt, turnRate: state.turnRate, acceleration: state.acceleration }
}
function offsetPosition(origin, x, y) {
  const lat0 = origin.latitude * Math.PI / 180
  return {
    latitude: origin.latitude + (y / EARTH_RADIUS_M) * 180 / Math.PI,
    longitude: origin.longitude + (x / (EARTH_RADIUS_M * Math.max(1e-9, Math.cos(lat0)))) * 180 / Math.PI
  }
}
function closestApproachFromModels(ownModel, targetModel, options = {}) {
  if (!ownModel || !targetModel) return null
  const offset = localOffsetMeters(ownModel.latest.position, targetModel.latest.position)
  if (!offset) return null
  const horizonSeconds = Math.max(60, (options.horizonMinutes || 20) * 60)
  const stepSeconds = clamp(options.stepSeconds || 5, 1, 60)
  const stride = Math.max(1, Math.ceil((horizonSeconds / stepSeconds) / 60))
  let os = { x: 0, y: 0, speed: ownModel.latest.speed, course: ownModel.latest.course, turnRate: ownModel.turnRate, acceleration: ownModel.acceleration }
  let ts = { x: offset.x, y: offset.y, speed: targetModel.latest.speed, course: targetModel.latest.course, turnRate: targetModel.turnRate, acceleration: targetModel.acceleration }
  let minM = Math.hypot(offset.x, offset.y); let minAt = 0; let minOwn = { ...os }; let minTarget = { ...ts }
  const ownPath = [{ seconds: 0, position: ownModel.latest.position }]
  const targetPath = [{ seconds: 0, position: targetModel.latest.position }]
  let i = 0
  for (let elapsed = stepSeconds; elapsed <= horizonSeconds; elapsed += stepSeconds) {
    i += 1; os = stepMotion(os, stepSeconds); ts = stepMotion(ts, stepSeconds)
    const d = Math.hypot(ts.x - os.x, ts.y - os.y)
    if (d < minM) { minM = d; minAt = elapsed; minOwn = { ...os }; minTarget = { ...ts } }
    if (i % stride === 0 || elapsed + stepSeconds > horizonSeconds) {
      ownPath.push({ seconds: elapsed, position: offsetPosition(ownModel.latest.position, os.x, os.y) })
      targetPath.push({ seconds: elapsed, position: offsetPosition(ownModel.latest.position, ts.x, ts.y) })
    }
  }
  const ownCpaPosition = offsetPosition(ownModel.latest.position, minOwn.x, minOwn.y)
  const targetCpaPosition = offsetPosition(ownModel.latest.position, minTarget.x, minTarget.y)
  const closestApproachPoint = { latitude: (ownCpaPosition.latitude + targetCpaPosition.latitude) / 2, longitude: (ownCpaPosition.longitude + targetCpaPosition.longitude) / 2 }
  return { cpaM: minM, tcpaSeconds: minAt, confidence: Math.min(ownModel.confidence, targetModel.confidence), ownModel, targetModel, ownPath, targetPath, ownCpaPosition, targetCpaPosition, closestApproachPoint }
}

module.exports = { angleDelta, estimateMotion, simpleLatestModel, closestApproachFromModels, offsetPosition }
