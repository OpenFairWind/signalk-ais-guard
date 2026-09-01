'use strict'
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
async function refresh(){
  const status=document.getElementById('status'),box=document.getElementById('targets')
  try{
    const r=await fetch('/signalk/v2/api/resources/aisGuardRiskOverlay',{credentials:'include',cache:'no-store'})
    if(!r.ok)throw new Error(String(r.status))
    const j=await r.json();const x=j['live-risk-overlay']||Object.values(j)[0]
    const fs=x?.values?.features||[]
    const paths=fs.filter(f=>f.geometry?.type==='LineString'&&f.properties?.styleRef!=='selfPath')
    status.textContent=`${paths.length} hazardous target${paths.length===1?'':'s'}`
    box.innerHTML=paths.map(f=>{const p=f.properties||{};return `<div class="card ${esc(p.risk)}"><strong>${esc((p.name||'AIS target').replace(/ predicted path$/,''))}</strong> — ${esc(String(p.risk||'unknown').toUpperCase())}<div class="muted">Predicted CPA ${esc(p.cpaNm??'—')} NM · TCPA ${esc(p.tcpaMinutes??'—')} min · confidence ${p.confidence==null?'—':Math.round(p.confidence*100)+'%'} · representative ${esc(p.predictor||'—')}</div></div>`}).join('')||'<p class="muted">No current warning/alarm target has an eligible predicted path.</p>'
  }catch(e){status.textContent='AIS Guard overlay resource unavailable';box.innerHTML='<p class="muted">Confirm the plugin is enabled and this Freeboard session has read access to Signal K resources.</p>'}
}
refresh();setInterval(refresh,2000)
