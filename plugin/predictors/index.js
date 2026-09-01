'use strict'
const adaptive = require('./adaptive-turn-acceleration')
const constantVelocity = require('./constant-velocity')
const constantTurnRate = require('./constant-turn-rate')
const { INTERFACE_ID, INTERFACE_VERSION, assertPredictor, normalizeReport } = require('./interface')
const { runPredictors, majorityRisk, ensembleSummary } = require('./ensemble')

const BUILT_INS = Object.freeze([constantVelocity, constantTurnRate, adaptive])

function createRegistry(initial = BUILT_INS) {
  const map = new Map()
  function register(predictor) {
    assertPredictor(predictor)
    if (map.has(predictor.id)) throw new Error(`trajectory predictor already registered: ${predictor.id}`)
    map.set(predictor.id, predictor)
    return () => map.delete(predictor.id)
  }
  function list() { return Array.from(map.values()) }
  function select(ids) {
    const wanted = new Set(Array.isArray(ids) && ids.length ? ids : list().map(p => p.id))
    return list().filter(p => wanted.has(p.id))
  }
  for (const predictor of initial) register(predictor)
  return { register, list, select, get: id => map.get(id) || null }
}

function selectedPredictors(ids) { return createRegistry().select(ids) }

module.exports = { INTERFACE_ID, INTERFACE_VERSION, BUILT_INS, createRegistry, selectedPredictors, assertPredictor, normalizeReport, runPredictors, majorityRisk, ensembleSummary }
