#!/usr/bin/env node
'use strict'
const path = require('node:path')
const { readText, readJson, readJsonl, writeJsonl, parseArgs } = require('../lib/io')
const { parseCsv } = require('../lib/csv')
const { normalize, validate, sortAndDedupe, pseudonymize } = require('../lib/dataset')
const a = parseArgs(process.argv.slice(2)); if (!a.input || !a.output || !a.mapping) throw new Error('usage: prepare-dataset --input FILE --mapping FILE --output FILE [--source NAME] [--pseudonym-salt SALT | --pseudonym-salt-file FILE]')
const mapping = readJson(a.mapping); const ext = path.extname(a.input).toLowerCase(); const raw = ext === '.csv' ? parseCsv(readText(a.input)) : readJsonl(a.input)
let rows = raw.map(r => normalize(r, mapping, a.source || path.basename(a.input))); const bad = rows.map((r, i) => [i + 1, validate(r)]).filter(x => x[1].length)
if (bad.length) throw new Error(`invalid normalized observations: ${bad.slice(0, 10).map(([i,e]) => `${i}:${e.join(',')}`).join(' ')}`)
rows = sortAndDedupe(rows); const salt = a['pseudonym-salt-file'] ? readText(a['pseudonym-salt-file']).trim() : a['pseudonym-salt']; if (salt) rows = pseudonymize(rows, salt); writeJsonl(a.output, rows); console.log(JSON.stringify({ written: rows.length, output: a.output }))
