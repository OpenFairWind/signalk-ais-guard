#!/usr/bin/env node
'use strict'
const { readJsonl, parseArgs } = require('../lib/io'); const { validate, stats } = require('../lib/dataset')
const a = parseArgs(process.argv.slice(2)); if (!a.input) throw new Error('usage: validate-dataset --input FILE')
const rows = readJsonl(a.input); const errors = []; rows.forEach((r,i) => { const e = validate(r); if (e.length) errors.push({ line: i + 1, errors: e }) })
console.log(JSON.stringify({ valid: errors.length === 0, errors: errors.slice(0, 100), stats: stats(rows) }, null, 2)); if (errors.length) process.exitCode = 2
