'use strict'
const { INTERFACE_ID, INTERFACE_VERSION } = require('./interface')
const { simpleLatestModel, closestApproachFromModels } = require('./kinematic')
module.exports = {
  interface: INTERFACE_ID, interfaceVersion: INTERFACE_VERSION,
  id: 'constant-velocity', version: '1.0.0', name: 'Constant velocity',
  description: 'Numerical trajectory projection holding latest SOG and COG constant.',
  predict({ own, target, options, now }) {
    const ownModel = simpleLatestModel(own, options, now); const targetModel = simpleLatestModel(target, options, now)
    if (!ownModel || !targetModel) return { status: 'abstain', reason: 'insufficient-motion-data' }
    const result = closestApproachFromModels(ownModel, targetModel, options)
    if (!result) return { status: 'abstain', reason: 'geometry-unavailable' }
    return { status: 'ok', reason: 'constant-velocity-projection', cpaM: result.cpaM, tcpaSeconds: result.tcpaSeconds, confidence: result.confidence, ownPath: result.ownPath, targetPath: result.targetPath, ownCpaPosition: result.ownCpaPosition, targetCpaPosition: result.targetCpaPosition, closestApproachPoint: result.closestApproachPoint }
  }
}
