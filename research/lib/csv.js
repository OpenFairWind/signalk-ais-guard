'use strict'
function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1 }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row) }
  if (!rows.length) return []
  const header = rows.shift()
  return rows.filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}
module.exports = { parseCsv }
