#!/usr/bin/env node
'use strict'
const { readJsonl, writeJson, parseArgs } = require('../lib/io'); const { stats } = require('../lib/dataset')
const a = parseArgs(process.argv.slice(2)); if (!a.input) throw new Error('usage: dataset-stats --input FILE [--output FILE]'); const s = stats(readJsonl(a.input)); if (a.output) writeJson(a.output, s); else console.log(JSON.stringify(s, null, 2))
