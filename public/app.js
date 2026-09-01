'use strict'

const state = { targets: [], ascending: true }
const el = id => document.getElementById(id)
const riskRank = { alarm: 0, warn: 1, none: 2, unknown: 3 }

function number(v, digits = 2, suffix = '') { return Number.isFinite(v) ? `${v.toFixed(digits)}${suffix}` : '—' }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }
function safeText(v) { return (v == null || v === '') ? '—' : escapeHtml(v) }
function tcpa(v) { if (!Number.isFinite(v)) return '—'; return v < 0 ? 'Past' : `${v.toFixed(1)} min` }
function confidence(v) { return Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—' }
function votes(v) { return v && Number.isFinite(v.alarm) ? `${v.alarm}/${v.warn}/${v.none}` : '—' }

function comparator(key) {
  const numeric = (a, b, field, missing = Infinity) => (Number.isFinite(a[field]) ? a[field] : missing) - (Number.isFinite(b[field]) ? b[field] : missing)
  if (key === 'risk') return (a,b) => (riskRank[a.risk] ?? 9) - (riskRank[b.risk] ?? 9) || numeric(a,b,'cpaNm') || numeric(a,b,'tcpaMinutes')
  if (key === 'distance') return (a,b) => numeric(a,b,'rangeNm')
  if (key === 'cpa') return (a,b) => numeric(a,b,'cpaNm')
  if (key === 'tcpa') return (a,b) => numeric(a,b,'tcpaMinutes')
  if (key === 'predictedCpa') return (a,b) => numeric(a,b,'predictedCpaNm')
  if (key === 'predictedTcpa') return (a,b) => numeric(a,b,'predictedTcpaMinutes')
  if (key === 'confidence') return (a,b) => numeric(a,b,'predictionConfidence', -Infinity)
  if (key === 'speed') return (a,b) => numeric(a,b,'speedKnots')
  if (key === 'age') return (a,b) => numeric(a,b,'ageSeconds')
  if (key === 'mmsi') return (a,b) => String(a.mmsi || '').localeCompare(String(b.mmsi || ''), undefined, { numeric:true })
  return (a,b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity:'base' })
}

function visibleTargets() {
  const filter = el('filter').value
  const query = el('search').value.trim().toLowerCase()
  let rows = state.targets.filter(t => {
    if (filter === 'danger' && !['alarm','warn'].includes(t.risk)) return false
    if (filter === 'alarm' && t.risk !== 'alarm') return false
    if (filter === 'warn' && t.risk !== 'warn') return false
    if (filter === 'clear' && t.risk !== 'none') return false
    return !query || `${t.name || ''} ${t.mmsi || ''} ${t.context || ''}`.toLowerCase().includes(query)
  })
  rows.sort(comparator(el('sort').value))
  if (!state.ascending) rows.reverse()
  return rows
}

function render() {
  const rows = visibleTargets()
  el('countAll').textContent = state.targets.length
  el('countAlarm').textContent = state.targets.filter(t => t.risk === 'alarm').length
  el('countWarn').textContent = state.targets.filter(t => t.risk === 'warn').length
  const ranges = state.targets.map(t => t.rangeNm).filter(Number.isFinite)
  el('nearest').textContent = ranges.length ? Math.min(...ranges).toFixed(2) : '—'
  el('targets').innerHTML = rows.length ? rows.map(t => `
    <tr class="${t.risk === 'alarm' ? 'alarm-row' : t.risk === 'warn' ? 'warn-row' : ''}">
      <td><span class="badge ${escapeHtml(t.risk)}">${escapeHtml(t.risk)}</span></td>
      <td><span class="target-name">${safeText(t.name || t.mmsi || 'Unnamed target')}</span><span class="target-context">${safeText(t.context)}</span></td>
      <td>${safeText(t.mmsi)}</td><td>${number(t.rangeNm,2,' NM')}</td><td>${number(t.cpaNm,2,' NM')}</td><td>${tcpa(t.tcpaMinutes)}</td>
      <td>${number(t.predictedCpaNm,2,' NM')}</td><td>${tcpa(t.predictedTcpaMinutes)}</td><td>${confidence(t.predictionConfidence)}</td><td>${safeText(t.riskSource)}<span class="target-context">votes A/W/N ${votes(t.predictionVotes)}</span></td>
      <td>${number(t.speedKnots,1,' kn')}</td><td>${number(t.courseDegrees,0,'°')}</td><td class="${t.stale ? 'muted' : ''}">${number(t.ageSeconds,0,' s')}</td>
    </tr>`).join('') : '<tr><td colspan="13" class="empty">No targets match this view.</td></tr>'
}

async function refresh() {
  try {
    const response = await fetch('/plugins/signalk-ais-guard/targets', { cache:'no-store', credentials:'same-origin' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    state.targets = Array.isArray(data.targets) ? data.targets : []
    const mode = data.ownVesselMode || 'unknown'
    el('connection').textContent = data.ownVesselReady ? `Live — ${mode}${data.anchorWatchActive ? ' / anchor watch' : ''}` : 'Waiting for own vessel'
    el('connection').classList.remove('offline')
    el('notice').classList.toggle('hidden', data.ownVesselReady)
    el('notice').textContent = data.ownVesselReady ? '' : 'Own-vessel navigation is incomplete and no anchored/moored station-keeping state is available. Distances and CPA/TCPA may be unavailable.'
    document.body.dataset.prediction = data.predictiveAiEnabled ? 'enabled' : 'disabled'
    render()
  } catch (err) {
    el('connection').textContent = 'Disconnected'
    el('connection').classList.add('offline')
    el('notice').classList.remove('hidden')
    el('notice').textContent = `Unable to read AIS Guard data: ${err.message}`
  }
}

for (const id of ['sort','filter','search']) el(id).addEventListener(id === 'search' ? 'input' : 'change', render)
el('direction').addEventListener('click', () => { state.ascending = !state.ascending; el('direction').textContent = state.ascending ? '↑ Asc' : '↓ Desc'; render() })
refresh(); setInterval(refresh, 2000)
