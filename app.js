const state = {
  region: null,
  places: [],
  tab: 'today',
  filter: 'all',
  query: ''
};

const view = document.querySelector('#view');
const bottom = document.querySelector('#bottom');
const detail = document.querySelector('#detail');
const toast = document.querySelector('#toast');

const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];

function esc(value='') {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function todayClock(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function toMinutes(hhmm) {
  const [h,m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(hhmm) {
  return hhmm.replace(':', ':');
}

function openingState(place, date = new Date()) {
  if (!place.weeklyHours) return {code:'na', label:'Aktivität'};
  const slots = place.weeklyHours[dayKeys[date.getDay()]] || [];
  const now = todayClock(date);
  for (const slot of slots) {
    const [from,to] = slot.split('-');
    const start = toMinutes(from);
    const end = toMinutes(to);
    if (now >= start && now < end) return {code:'open',label:`Jetzt offen · bis ${formatTime(to)}`};
    if (now < start) {
      const delta = start - now;
      if (delta <= 120) return {code:'soon',label:`Öffnet ${formatTime(from)}`};
      return {code:'closed',label:`Heute ab ${formatTime(from)}`};
    }
  }
  return {code:'closed',label:slots.length ? 'Heute geschlossen' : 'Heute Ruhetag'};
}

function checkedAge(source) {
  if (!source?.checkedAt) return null;
  const checked = new Date(`${source.checkedAt}T12:00:00`);
  const days = Math.floor((Date.now() - checked.getTime()) / 86400000);
  return Math.max(0, days);
}

function trustLabel(place) {
  const days = checkedAge(place.source);
  if (days === null) return 'Quelle vorhanden';
  if (days === 0) return 'Quelle heute geprüft';
  if (days === 1) return 'Quelle gestern geprüft';
  return `Quelle vor ${days} Tagen geprüft`;
}

function routeUrl(place) {
  const q = place.address || `${place.name}, ${place.town || state.region.shortLabel}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function sourceLink(place) {
  return place.source?.url ? `<a href="${esc(place.source.url)}" target="_blank" rel="noopener">${esc(place.source.label)}</a>` : esc(place.source?.label || 'Quelle');
}

function iconFor(place) {
  if (place.vertical === 'gastro') return '🍽️';
  const c = (place.category || '').toLowerCase();
  if (c.includes('rad')) return '🚲';
  if (c.includes('natur')) return '🌲';
  if (c.includes('wandern')) return '🥾';
  return '✨';
}

function nav() {
  const items = [
    ['today','⌁','Heute'],
    ['gastro','🍴','Gastro'],
    ['lifestyle','✦','Erleben'],
    ['region','◎','Region']
  ];
  bottom.innerHTML = items.map(([id,icon,label]) => `
    <button type="button" data-nav="${id}" class="${state.tab===id?'active':''}" aria-current="${state.tab===id?'page':'false'}">
      <span aria-hidden="true">${icon}</span>${label}
    </button>`).join('');
}

function setTab(tab, filter='all') {
  state.tab = tab;
  state.filter = filter;
  state.query = '';
  render();
  view.scrollTop = 0;
}

function modeButtons() {
  return `<div class="quick">${state.region.modes.map(mode => `
    <button class="chip ${state.filter===mode.id?'active':''}" type="button" data-mode="${mode.id}">${mode.icon} ${esc(mode.label)}</button>
  `).join('')}</div>`;
}

function matchesMode(place, mode) {
  if (mode === 'all') return true;
  if (mode === 'open') return place.vertical === 'gastro' && openingState(place).code === 'open';
  if (mode === 'food') return place.vertical === 'gastro';
  if (mode === 'outdoor') return place.vertical === 'lifestyle' && (place.tags || []).includes('draussen');
  if (mode === 'family') return (place.tags || []).includes('familie');
  if (mode === 'rain') return (place.tags || []).includes('regen');
  return true;
}

function matchesQuery(place) {
  if (!state.query.trim()) return true;
  const haystack = [place.name,place.category,place.town,place.summary,...(place.tags||[])].join(' ').toLowerCase();
  return haystack.includes(state.query.trim().toLowerCase());
}

function card(place) {
  const open = openingState(place);
  const status = place.vertical === 'gastro'
    ? `<span class="status ${open.code}">${esc(open.label)}</span>`
    : `<span class="status">Heute planbar</span>`;
  const facts = place.facts ? Object.values(place.facts).slice(0,3) : [];
  const tags = [...facts,...(place.tags||[]).slice(0,2)];
  return `<article class="card">
    <div class="card-top">
      <div>
        <span class="kind">${iconFor(place)} ${esc(place.category)}</span>
        <h3>${esc(place.name)}</h3>
        <p>${esc(place.summary)}</p>
      </div>
      ${status}
    </div>
    <div class="meta-row">${tags.map(tag => `<span class="pill">${esc(tag)}</span>`).join('')}</div>
    <div class="trust">
      <span><strong>${esc(place.town || state.region.shortLabel)}</strong> · ${esc(trustLabel(place))}</span>
      <span>${place.dynamicStatus==='source-based'?'nicht live':'offiziell'}</span>
    </div>
    <div class="card-actions">
      <button type="button" data-detail="${esc(place.id)}">Details</button>
      <a class="accent" href="${routeUrl(place)}" target="_blank" rel="noopener">Route</a>
    </div>
  </article>`;
}

function renderHome() {
  const gastro = state.places.filter(p => p.vertical === 'gastro');
  const lifestyle = state.places.filter(p => p.vertical === 'lifestyle');
  const openNow = gastro.filter(p => openingState(p).code === 'open');
  const soon = gastro.filter(p => ['open','soon'].includes(openingState(p).code));
  const recommendations = (openNow.length ? openNow : soon).slice(0,3);
  const now = new Intl.DateTimeFormat('de-DE',{weekday:'long',hour:'2-digit',minute:'2-digit'}).format(new Date());
  view.innerHTML = `
    <section class="hero">
      <div class="hero-top">
        <div class="brand"><b>H<em>O</em>Y</b><small>STADTKYLL · EIFEL</small></div>
        <div class="region-badge">Region 2 · Proof</div>
      </div>
      <div class="hero-copy">
        <span class="eyebrow">${esc(now)}</span>
        <h1>Was geht<br>heute?</h1>
        <p>Nicht suchen. Entscheiden. Essen, rausgehen oder etwas entdecken – jetzt in Stadtkyll.</p>
      </div>
      <div class="now-panel">
        <div class="now-grid">
          <div class="metric good"><small>Jetzt offen*</small><strong>${openNow.length}</strong></div>
          <div class="metric"><small>Gastro erfasst</small><strong>${gastro.length}</strong></div>
          <div class="metric"><small>Erlebnisse</small><strong>${lifestyle.length}</strong></div>
        </div>
        <button class="primary" type="button" data-nav="gastro" data-filter="open">Zeig mir, was jetzt geht</button>
      </div>
    </section>
    ${modeButtons()}
    <section class="section">
      <div class="section-head"><div><span class="eyebrow">HOY NOW</span><h2>${recommendations.length?'Jetzt interessant':'Als Nächstes'}</h2></div><button type="button" data-nav="gastro">Alle Gastro</button></div>
      <p class="section-copy">* „Jetzt offen“ wird aus zuletzt geprüften Quellen berechnet und ist noch kein Händler-Live-Signal.</p>
      <div class="cards">${recommendations.length ? recommendations.map(card).join('') : gastro.slice(0,3).map(card).join('')}</div>
    </section>
    <section class="section">
      <div class="section-head"><div><span class="eyebrow">RAUS & LOS</span><h2>Heute erleben</h2></div><button type="button" data-nav="lifestyle">Alle Ideen</button></div>
      <div class="cards">${lifestyle.slice(0,3).map(card).join('')}</div>
    </section>
    <section class="editorial">
      <span class="eyebrow">REGION-2-TEST</span>
      <h2>Gleiche HOY-Idee.<br>Andere Region.</h2>
      <p><b>Stadtkyll ist kein eigener Produkt-Fork.</b> Gastro und Lifestyle werden über regionale Daten konfiguriert. Genau daran messen wir, wie replizierbar HOY wirklich ist.</p>
    </section>
    <div class="source-note">Datenstand Bootstrap: 25.08.2026. Dynamische Angaben werden bewusst mit Herkunft und Aktualitätsstatus gezeigt. Live-Verifizierung folgt als eigener Layer.</div>
  `;
}

function filterHeader(title, eyebrow, copy, placeholder) {
  return `<header class="head"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${copy}</p><div class="searchline"><input id="search" type="search" value="${esc(state.query)}" placeholder="${placeholder}" aria-label="Suche"><button type="button" data-search>Finden</button></div></header>`;
}

function renderGastro() {
  let items = state.places.filter(p => p.vertical === 'gastro').filter(p => matchesMode(p,state.filter)).filter(matchesQuery);
  items.sort((a,b) => {
    const rank = {open:0,soon:1,closed:2,na:3};
    return rank[openingState(a).code] - rank[openingState(b).code] || a.name.localeCompare(b.name,'de');
  });
  const filters = [['all','Alle'],['open','Jetzt offen'],['family','Familie']];
  view.innerHTML = `${filterHeader('Essen. Jetzt.','HOY GASTRO','Was ist heute wirklich eine Option? Quellenstatus statt blindem Öffnungszeiten-Vertrauen.','Restaurant oder Küche')}
    <div class="filterline">${filters.map(([id,label])=>`<button class="${state.filter===id?'active':''}" data-filter="${id}">${label}</button>`).join('')}</div>
    <div class="list">${items.length?items.map(card).join(''):'<div class="empty">Dafür gibt es im aktuellen Datenstand noch keinen Treffer.</div>'}</div>`;
}

function renderLifestyle() {
  let items = state.places.filter(p => p.vertical === 'lifestyle').filter(p => matchesMode(p,state.filter)).filter(matchesQuery);
  const filters = [['all','Alle'],['outdoor','Draußen'],['family','Mit Kindern']];
  view.innerHTML = `${filterHeader('Raus. Heute.','HOY LIFESTYLE','Keine endlose Sehenswürdigkeitenliste – Ideen, die zum heutigen Zeitfenster und Kontext passen sollen.','Wandern, Rad, Natur …')}
    <div class="filterline">${filters.map(([id,label])=>`<button class="${state.filter===id?'active':''}" data-filter="${id}">${label}</button>`).join('')}</div>
    <div class="list">${items.length?items.map(card).join(''):'<div class="empty">Dafür gibt es im aktuellen Datenstand noch keinen Treffer.</div>'}</div>`;
}

function renderRegion() {
  view.innerHTML = `<header class="head"><span class="eyebrow">REGION 2</span><h1>Oberes Kylltal</h1><p>Der erste Transfer-Test außerhalb La Manga: klein genug für hohe Datenqualität, touristisch genug für einen echten HOY-Nutzen.</p></header>
    <section class="map-card"><span class="eyebrow">STARTCLUSTER</span><h2>Stadtkyll zuerst.</h2><p>Kerngebiet bewusst eng halten. Erst wenn Datenqualität, Nutzung und regionale Konfiguration funktionieren, wird Richtung Gerolstein erweitert.</p><div class="towns">${state.region.cluster.map(t=>`<span>${esc(t)}</span>`).join('')}<span>→ Gerolstein später</span></div></section>
    <section class="section"><div class="section-head"><div><span class="eyebrow">PROOF-METRIK</span><h2>Was wir beweisen wollen</h2></div></div><div class="cards">
      <article class="card"><h3>Core-Reuse</h3><p>HOY-App-Shell, Entscheidungslogik, Trust-Modell und Komponenten sollen regionsneutral bleiben.</p><div class="meta-row"><span class="pill good">Ziel 80–90 % Core</span></div></article>
      <article class="card"><h3>Region als Datenlayer</h3><p>Orte, Kategorien, Quellen und regionale Modi liegen außerhalb der UI-Logik und können ersetzt werden.</p><div class="meta-row"><span class="pill good">bereits angelegt</span></div></article>
      <article class="card"><h3>Live-Trust statt Behauptung</h3><p>Statische Quellen dürfen nicht wie Echtzeitdaten aussehen. Händler-/Crowd-Verifikation wird später separat ergänzt.</p><div class="meta-row"><span class="pill">Trust Gate</span></div></article>
    </div></section>`;
}

function showDetail(id) {
  const place = state.places.find(p => p.id === id);
  if (!place) return;
  const open = openingState(place);
  const facts = place.facts || {};
  detail.innerHTML = `<div class="detail"><button class="detail-close" type="button" data-close aria-label="Schließen">×</button><span class="eyebrow">${esc(place.category)}</span><h2>${esc(place.name)}</h2><p class="lede">${esc(place.summary)}</p><dl>
    <dt>Ort</dt><dd>${esc(place.town || state.region.shortLabel)}</dd>
    ${place.address?`<dt>Adresse</dt><dd>${esc(place.address)}</dd>`:''}
    ${place.vertical==='gastro'?`<dt>Status</dt><dd>${esc(open.label)} · quellbasiert, nicht live</dd>`:''}
    ${Object.entries(facts).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
    <dt>Datenquelle</dt><dd>${sourceLink(place)}</dd>
    <dt>Prüfstand</dt><dd>${esc(place.source?.checkedAt || 'unbekannt')}</dd>
  </dl><div class="card-actions"><a href="${routeUrl(place)}" class="accent" target="_blank" rel="noopener">Route öffnen</a></div></div>`;
  detail.showModal();
}

function surprise() {
  const pool = state.places.filter(p => p.vertical === 'lifestyle' || openingState(p).code === 'open');
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  showDetail(pick.id);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(()=>toast.classList.remove('show'),1800);
}

function render() {
  nav();
  if (!state.region) return;
  if (state.tab === 'today') renderHome();
  if (state.tab === 'gastro') renderGastro();
  if (state.tab === 'lifestyle') renderLifestyle();
  if (state.tab === 'region') renderRegion();
}

document.addEventListener('click', event => {
  const navBtn = event.target.closest('[data-nav]');
  if (navBtn) return setTab(navBtn.dataset.nav, navBtn.dataset.filter || 'all');
  const mode = event.target.closest('[data-mode]');
  if (mode) {
    if (mode.dataset.mode === 'surprise') return surprise();
    if (mode.dataset.mode === 'food') return setTab('gastro','all');
    state.filter = mode.dataset.mode;
    return render();
  }
  const filter = event.target.closest('[data-filter]');
  if (filter) { state.filter = filter.dataset.filter; return render(); }
  const detailBtn = event.target.closest('[data-detail]');
  if (detailBtn) return showDetail(detailBtn.dataset.detail);
  if (event.target.closest('[data-close]')) return detail.close();
  if (event.target.closest('[data-search]')) {
    const input = document.querySelector('#search');
    state.query = input?.value || '';
    return render();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target?.id === 'search') {
    state.query = event.target.value;
    render();
  }
});

async function boot() {
  view.innerHTML = '<div class="loading">HOY Stadtkyll wird geladen …</div>';
  try {
    const [regionRes,placesRes] = await Promise.all([fetch('data/region.json'),fetch('data/places.json')]);
    if (!regionRes.ok || !placesRes.ok) throw new Error('Daten konnten nicht geladen werden');
    state.region = await regionRes.json();
    state.places = await placesRes.json();
    render();
  } catch (error) {
    console.error(error);
    view.innerHTML = '<div class="empty"><strong>HOY konnte die Regionsdaten nicht laden.</strong><br>Bitte die Seite neu laden.</div>';
    showToast('Regionsdaten nicht verfügbar');
  }
}

boot();
