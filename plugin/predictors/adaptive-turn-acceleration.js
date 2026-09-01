'use strict'
const { INTERFACE_ID, INTERFACE_VERSION } = require('./interface')
const { estimateMotion, closestApproachFromModels } = require('./kinematic')
module.exports = {
  interface: INTERFACE_ID, interfaceVersion: INTERFACE_VERSION,
  id: 'adaptive-turn-acceleration', version: '1.0.0', name: 'Adaptive turn/acceleration',
  description: 'Short-horizon kinematic extrapolation using bounded recent turn-rate and longitudinal-acceleration estimates.',
  predict({ own, target, options, now }) {
    const ownModel = estimateMotion(own, options, now); const targetModel = estimateMotion(target, options, now)
    if (!ownModel || !targetModel) return { status: 'abstain', reason: 'insufficient-motion-data' }
    const result = closestApproachFromModels(ownModel, targetModel, options)
    if (!result) return { status: 'abstain', reason: 'geometry-unavailable' }
    return { status: 'ok', reason: 'adaptive-kinematic-projection', cpaM: result.cpaM, tcpaSeconds: result.tcpaSeconds, confidence: result.confidence, ownPath: result.ownPath, targetPath: result.targetPath, ownCpaPosition: result.ownCpaPosition, targetCpaPosition: result.targetCpaPosition, closestApproachPoint: result.closestApproachPoint,
      diagnostics: { own: { turnRateRadPerSecond: ownModel.turnRate, accelerationMps2: ownModel.acceleration, sampleCount: ownModel.sampleCount, historySeconds: ownModel.historySeconds }, target: { turnRateRadPerSecond: targetModel.turnRate, accelerationMps2: targetModel.acceleration, sampleCount: targetModel.sampleCount, historySeconds: targetModel.historySeconds } } }
  }
}
