#!/usr/bin/env node
'use strict'
const { readJsonl, writeJsonl, parseArgs } = require('../lib/io'); const { buildCases } = require('../lib/cases')
const a = parseArgs(process.argv.slice(2)); if (!a.input || !a.output) throw new Error('usage: build-cases --input FILE --output FILE [--own-mmsi MMSI] [--history-seconds 180] [--horizon-seconds 1200] [--anchor-stride-seconds 30] [--sync-tolerance-seconds 5] [--max-range-nm 6]')
const n = k => a[k] == null ? undefined : Number(a[k]); const opts = { ownMmsi: a['own-mmsi'], historySeconds: n('history-seconds'), horizonSeconds: n('horizon-seconds'), anchorStrideSeconds: n('anchor-stride-seconds'), syncToleranceSeconds: n('sync-tolerance-seconds'), maxRangeNm: n('max-range-nm'), minimumHistorySamples: n('minimum-history-samples') }; for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k]
const cases = buildCases(readJsonl(a.input), opts); writeJsonl(a.output, cases); console.log(JSON.stringify({ cases: cases.length, output: a.output }))
