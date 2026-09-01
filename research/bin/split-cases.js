#!/usr/bin/env node
'use strict'
const path = require('node:path'); const { readJsonl, writeJsonl, writeJson, parseArgs, ensureDir } = require('../lib/io'); const { splitCases } = require('../lib/cases')
const a = parseArgs(process.argv.slice(2)); if (!a.input || !a.output) throw new Error('usage: split-cases --input FILE --output DIR [--seed TEXT] [--train 0.6 --validation 0.2 --test 0.2]')
const ratios = { train: Number(a.train || 0.6), validation: Number(a.validation || 0.2), test: Number(a.test || 0.2) }; if (Math.abs(ratios.train + ratios.validation + ratios.test - 1) > 1e-9) throw new Error('split ratios must sum to 1')
const split = splitCases(readJsonl(a.input), ratios, a.seed || 'ais-guard-v1'); ensureDir(a.output); for (const [k,v] of Object.entries(split)) writeJsonl(path.join(a.output, `${k}.jsonl`), v); writeJson(path.join(a.output, 'split.json'), { schema: 'signalk-ais-guard.split/1', seed: a.seed || 'ais-guard-v1', ratios, counts: Object.fromEntries(Object.entries(split).map(([k,v]) => [k,v.length])), grouping: 'groupId' }); console.log(JSON.stringify(Object.fromEntries(Object.entries(split).map(([k,v]) => [k,v.length]))))
