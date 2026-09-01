#!/usr/bin/env node
'use strict'
const { readJsonl, readJson, writeJson, parseArgs } = require('../lib/io'); const { run } = require('../lib/benchmark')
const a = parseArgs(process.argv.slice(2)); if (!a.input || !a.output) throw new Error('usage: benchmark --input CASES --output REPORT [--config FILE] [--predictors id,id]')
const options = a.config ? readJson(a.config) : {}; const ids = a.predictors ? String(a.predictors).split(',').filter(Boolean) : null; const report = run(readJsonl(a.input), options, ids); writeJson(a.output, report); console.log(JSON.stringify({ cases: report.cases, output: a.output, predictors: report.predictors.map(p => p.predictor.id) }))
