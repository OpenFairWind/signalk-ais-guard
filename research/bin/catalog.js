#!/usr/bin/env node
'use strict'
const fs = require('node:fs')
const { readJson, writeJson, sha256File, parseArgs } = require('../lib/io')
const a = parseArgs(process.argv.slice(2)); if (!a.catalog) throw new Error('usage: catalog --catalog FILE [--add DATASET --name NAME --source TEXT --license TEXT] | [--verify] | [--list]')
let catalog = fs.existsSync(a.catalog) ? readJson(a.catalog) : { schema: 'signalk-ais-guard.dataset-catalog/1', datasets: [] }
if (a.add) {
  if (!a.name) throw new Error('--name is required with --add')
  const entry = { name: String(a.name), path: String(a.add), sha256: sha256File(a.add), bytes: fs.statSync(a.add).size, source: a.source || null, license: a.license || null, notes: a.notes || null }
  catalog.datasets = catalog.datasets.filter(d => d.name !== entry.name); catalog.datasets.push(entry); catalog.datasets.sort((x,y)=>x.name.localeCompare(y.name)); writeJson(a.catalog,catalog); console.log(JSON.stringify(entry,null,2))
} else if (a.verify) {
  const results = catalog.datasets.map(d => ({ name:d.name, path:d.path, exists:fs.existsSync(d.path), expected:d.sha256, actual:fs.existsSync(d.path)?sha256File(d.path):null })).map(r=>({...r,valid:r.exists&&r.actual===r.expected}))
  console.log(JSON.stringify({valid:results.every(r=>r.valid),results},null,2)); if(!results.every(r=>r.valid)) process.exitCode=2
} else { console.log(JSON.stringify(catalog,null,2)) }
