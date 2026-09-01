'use strict'
const { INTERFACE_ID, INTERFACE_VERSION } = require('./interface')
const { estimateMotion, closestApproachFromModels } = require('./kinematic')
module.exports = {
  interface: INTERFACE_ID, interfaceVersion: INTERFACE_VERSION,
  id: 'constant-turn-rate', version: '1.0.0', name: 'Constant turn rate',
  description: 'Short-horizon kinematic projection using recent bounded turn-rate while holding speed constant.',
  predict({ own, target, options, now }) {
    const ownModel = estimateMotion(own, options, now); const targetModel = estimateMotion(target, options, now)
    if (!ownModel || !targetModel) return { status: 'abstain', reason: 'insufficient-motion-data' }
    ownModel.acceleration = 0; targetModel.acceleration = 0
    const result = closestApproachFromModels(ownModel, targetModel, options)
    if (!result) return { status: 'abstain', reason: 'geometry-unavailable' }
    return { status: 'ok', reason: 'constant-turn-rate-projection', cpaM: result.cpaM, tcpaSeconds: result.tcpaSeconds, confidence: result.confidence, ownPath: result.ownPath, targetPath: result.targetPath, ownCpaPosition: result.ownCpaPosition, targetCpaPosition: result.targetCpaPosition, closestApproachPoint: result.closestApproachPoint,
      diagnostics: { ownTurnRateRadPerSecond: ownModel.turnRate, targetTurnRateRadPerSecond: targetModel.turnRate } }
  }
}
