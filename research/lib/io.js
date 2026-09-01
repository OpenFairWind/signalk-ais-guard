'use strict'
const fs = require('node:fs')
const crypto = require('node:crypto')

function readText(path) { return fs.readFileSync(path, 'utf8') }
function ensureDir(path) { fs.mkdirSync(path, { recursive: true }) }
function readJson(path) { return JSON.parse(readText(path)) }
function readJsonl(path) {
  return readText(path).split(/\r?\n/).filter(Boolean).map((line, i) => {
    try { return JSON.parse(line) } catch (e) { throw new Error(`${path}:${i + 1}: ${e.message}`) }
  })
}
function writeJson(path, value) { ensureDir(require('node:path').dirname(path)); fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n') }
function writeJsonl(path, rows) { ensureDir(require('node:path').dirname(path)); fs.writeFileSync(path, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')) }
function sha256File(path) { const h = crypto.createHash('sha256'); h.update(fs.readFileSync(path)); return h.digest('hex') }
function stableHash(text) { return crypto.createHash('sha256').update(String(text)).digest('hex') }
function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) { out._.push(a); continue }
    const k = a.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) out[k] = true
    else { out[k] = next; i += 1 }
  }
  return out
}
module.exports = { readText, readJson, readJsonl, writeJson, writeJsonl, sha256File, stableHash, parseArgs, ensureDir }
