'use strict'

const INTERFACE_ID = 'signalk-ais-guard.trajectory-predictor'
const INTERFACE_VERSION = '1.0.0'
const VALID_STATUS = new Set(['ok', 'abstain'])

function assertPredictor(predictor) {
  if (!predictor || typeof predictor !== 'object') throw new TypeError('predictor must be an object')
  for (const key of ['id', 'version', 'name']) {
    if (typeof predictor[key] !== 'string' || !predictor[key].trim()) throw new TypeError(`predictor.${key} must be a non-empty string`)
  }
  if (predictor.interface !== INTERFACE_ID) throw new TypeError(`predictor.interface must be ${INTERFACE_ID}`)
  if (predictor.interfaceVersion !== INTERFACE_VERSION) throw new TypeError(`unsupported predictor interface version ${predictor.interfaceVersion}`)
  if (typeof predictor.predict !== 'function') throw new TypeError('predictor.predict must be a function')
  return predictor
}

function normalizeReport(predictor, raw) {
  const base = {
    schema: `${INTERFACE_ID}/report@1`,
    predictor: { id: predictor.id, version: predictor.version, name: predictor.name },
    status: 'abstain',
    reason: 'unspecified'
  }
  if (!raw || typeof raw !== 'object') return { ...base, reason: 'invalid-report' }
  if (!VALID_STATUS.has(raw.status)) return { ...base, reason: 'invalid-status' }
  if (raw.status === 'abstain') return { ...base, status: 'abstain', reason: String(raw.reason || 'abstained') }

  const cpaM = Number(raw.cpaM)
  const tcpaSeconds = Number(raw.tcpaSeconds)
  const confidence = Number(raw.confidence)
  if (!Number.isFinite(cpaM) || cpaM < 0 || !Number.isFinite(tcpaSeconds) || tcpaSeconds < 0 || !Number.isFinite(confidence)) {
    return { ...base, reason: 'invalid-numerics' }
  }
  return {
    ...base,
    status: 'ok',
    reason: String(raw.reason || 'prediction-available'),
    cpaM,
    cpaNm: cpaM / 1852,
    tcpaSeconds,
    tcpaMinutes: tcpaSeconds / 60,
    confidence: Math.max(0, Math.min(1, confidence)),
    diagnostics: raw.diagnostics && typeof raw.diagnostics === 'object' ? raw.diagnostics : {},
    ownPath: Array.isArray(raw.ownPath) ? raw.ownPath : null,
    targetPath: Array.isArray(raw.targetPath) ? raw.targetPath : null,
    ownCpaPosition: raw.ownCpaPosition || null,
    targetCpaPosition: raw.targetCpaPosition || null,
    closestApproachPoint: raw.closestApproachPoint || null
  }
}

module.exports = { INTERFACE_ID, INTERFACE_VERSION, assertPredictor, normalizeReport }
