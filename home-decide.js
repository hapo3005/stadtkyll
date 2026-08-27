(() => {
  'use strict';

  const DATA_URLS = [
    'data/menus.json',
    'data/menus-25km-a.json',
    'data/menus-25km-b.json',
    'data/menus-25km-c.json'
  ];
  const viewEl = document.querySelector('#view');
  const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
  let payload = null;
  let queued = false;
  let activeMode = 'auto';

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const money = value => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);
  const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

  function berlinParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA',{
      timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(date);
    const get = type => parts.find(part => part.type === type)?.value || '';
    const day = get('weekday').slice(0,3).toLowerCase();
    return {
      key:`${get('year')}-${get('month')}-${get('day')}`,
      day:dayKeys.includes(day) ? day : dayKeys[date.getDay()],
      minutes:Number(get('hour')) * 60 + Number(get('minute')),
      hour:Number(get('hour'))
    };
  }

  function toMinutes(hhmm) {
    const [h,m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
  }

  function normalizeItem(raw, menu, index) {
    if (!Array.isArray(raw)) return raw;
    const [category,name,price,description='',tags='',availability='',season=''] = raw;
    return {
      id:`${menu.placeId}-${index + 1}`,
      category,name,price,description,
      tags:tags ? String(tags).split('|').map(tag => tag.trim()).filter(Boolean) : [],
      availability,season
    };
  }

  function normalizeMenu(menu) {
    return {...menu,items:(menu.items || []).map((item,index) => normalizeItem(item,menu,index))};
  }

  function mergeDocuments(docs) {
    return {menus:docs.flatMap(doc => doc?.menus || []).map(normalizeMenu)};
  }

  function menuIsCurrent(menu) {
    const today = berlinParts().key;
    if (menu.validFrom && today < menu.validFrom) return false;
    if (menu.validTo && today > menu.validTo) return false;
    return true;
  }

  function placeFor(placeId) {
    try { return state?.places?.find(place => place.id === placeId) || null; } catch { return null; }
  }

  function scheduleApplies(place) {
    const key = berlinParts().key;
    if (place?.scheduleValidFrom && key < place.scheduleValidFrom) return false;
    if (place?.scheduleValidTo && key > place.scheduleValidTo) return false;
    return true;
  }

  function opening(place) {
    if (!place?.weeklyHours) return {code:'na',label:'heute planbar'};
    if (!scheduleApplies(place)) return {code:'closed',label:'saisonal geschlossen'};
    const now = berlinParts();
    const slots = place.weeklyHours[now.day] || [];
    for (const slot of slots) {
      const [from,to] = slot.split('-');
      const start = toMinutes(from);
      const end = toMinutes(to);
      if (now.minutes >= start && now.minutes < end) return {code:'open',label:`laut Quelle offen · bis ${to}`};
      if (now.minutes < start) return {code:'soon',label:`laut Quelle ab ${from}`};
    }
    return {code:'closed',label:slots.length ? 'laut Quelle heute geschlossen' : 'laut Quelle Ruhetag'};
  }

  function eveningPossible(place) {
    if (!place?.weeklyHours || !scheduleApplies(place)) return false;
    const slots = place.weeklyHours[berlinParts().day] || [];
    return slots.some(slot => {
      const [from,to] = slot.split('-');
      return toMinutes(from) < 22 * 60 && toMinutes(to) > 17 * 60;
    });
  }

  function distanceKm(a,b) {
    if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return null;
    const R = 6371;
    const rad = value => value * Math.PI / 180;
    const dLat = rad(b.lat-a.lat);
    const dLng = rad(b.lng-a.lng);
    const h = Math.sin(dLat/2) ** 2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function proximity(place) {
    let center = null;
    try { if (state?.region?.center) center = {lat:state.region.center.lat,lng:state.region.center.lng}; } catch {}
    const km = distanceKm(center,place?.location);
    return km === null ? {km:null,minutes:null} : {km,minutes:Math.max(3,Math.round(km * 1.7))};
  }

  function isToday(item) {
    return Array.isArray(item.availableDays) && item.availableDays.includes(berlinParts().day);
  }

  function isBreakfast(item) {
    return norm(`${item.category} ${item.name}`).includes('fruhstuck');
  }

  function isVegetarian(item) {
    return (item.tags || []).some(tag => ['vegetarisch','vegan'].some(key => norm(tag).startsWith(key)));
  }

  function isStartPrice(item) {
    return norm(item.availability).includes('ab-preis');
  }

  function priceLabel(item) {
    return `${isStartPrice(item) ? 'ab ' : ''}${money(item.price)}`;
  }

  function autoContext() {
    const hour = berlinParts().hour;
    if (hour < 11) return {mode:'breakfast',eyebrow:'GUTEN MORGEN',title:'Was passt jetzt?',copy:'Frühstück und frühe Optionen, die laut Quelle heute passen.'};
    if (hour < 15) return {mode:'now',eyebrow:'JETZT ESSEN',title:'Was passt jetzt?',copy:'Konkrete Gerichte statt Restaurantlisten – priorisiert nach Öffnung, Nähe und Preis.'};
    if (hour < 17) return {mode:'budget',eyebrow:'JETZT ODER SPÄTER',title:'Was passt heute?',copy:'Gute, nahe Optionen mit belastbaren Preisen für den restlichen Tag.'};
    return {mode:'evening',eyebrow:'HEUTE ABEND',title:'Was passt jetzt?',copy:'Gerichte bei Betrieben, die laut Quellenlage heute Abend eine Option sind.'};
  }

  function effectiveMode() {
    return activeMode === 'auto' ? autoContext().mode : activeMode;
  }

  function candidateScore(candidate, mode) {
    let score = 0;
    const status = candidate.status;
    const item = candidate.item;
    const place = candidate.place;
    if (status.code === 'open') score -= 36;
    else if (status.code === 'soon') score -= 13;
    else score += 18;
    if (isToday(item)) score -= 22;
    if (candidate.near.minutes !== null) score += Math.min(35,candidate.near.minutes) * .36;
    score += Number(item.price) * .075;
    if (mode === 'breakfast') score += isBreakfast(item) ? -38 : 22;
    if (mode === 'evening') score += eveningPossible(place) ? -24 : 32;
    if (mode === 'budget') score += Number(item.price) <= 15 ? -18 : Number(item.price) <= 20 ? -7 : 12;
    if (mode === 'vegetarian') score += isVegetarian(item) ? -35 : 60;
    if (mode === 'now' && status.code !== 'open') score += 24;
    return score;
  }

  function candidates() {
    if (!payload) return [];
    const mode = effectiveMode();
    const out = [];
    payload.menus.filter(menuIsCurrent).forEach(menu => {
      const place = placeFor(menu.placeId);
      if (!place) return;
      const status = opening(place);
      const near = proximity(place);
      menu.items.forEach(item => {
        if (!Number.isFinite(Number(item.price))) return;
        if (mode === 'breakfast' && !isBreakfast(item)) return;
        if (mode === 'vegetarian' && !isVegetarian(item)) return;
        if (mode === 'evening' && !eveningPossible(place)) return;
        if (mode === 'now' && status.code !== 'open') return;
        if (mode === 'budget' && Number(item.price) > 20) return;
        out.push({menu,item,place,status,near});
      });
    });
    out.sort((a,b) => candidateScore(a,mode)-candidateScore(b,mode) || Number(a.item.price)-Number(b.item.price));
    return out;
  }

  function selectDiverse(limit = 5) {
    const pool = candidates();
    const selected = [];
    const places = new Set();
    const categories = new Map();
    for (const candidate of pool) {
      if (places.has(candidate.place.id)) continue;
      const category = norm(candidate.item.category);
      const seenCategory = categories.get(category) || 0;
      if (seenCategory >= 2) continue;
      selected.push(candidate);
      places.add(candidate.place.id);
      categories.set(category,seenCategory + 1);
      if (selected.length >= limit) break;
    }
    if (selected.length < Math.min(3,limit)) {
      for (const candidate of pool) {
        if (selected.some(entry => entry.item.id === candidate.item.id)) continue;
        selected.push(candidate);
        if (selected.length >= limit) break;
      }
    }
    return selected;
  }

  function why(candidate) {
    const reasons = [];
    if (candidate.status.code === 'open') reasons.push('laut Quelle jetzt offen*');
    else if (effectiveMode() === 'evening' && eveningPossible(candidate.place)) reasons.push('heute Abend*');
    if (isToday(candidate.item)) reasons.push('heute');
    if (isBreakfast(candidate.item)) reasons.push('Frühstück');
    if (isVegetarian(candidate.item)) reasons.push('vegetarisch');
    if (Number(candidate.item.price) <= 15) reasons.push('≤ 15 €');
    if (candidate.near.minutes !== null && candidate.near.minutes <= 15) reasons.push('nah');
    return reasons.slice(0,3);
  }

  function cardMarkup(candidate,index) {
    const reasons = why(candidate);
    const near = candidate.near.minutes !== null ? `ca. ${candidate.near.minutes} Min.* ab Stadtkyll` : candidate.place.town;
    return `<button type="button" class="home-decide-card ${index === 0 ? 'is-lead' : ''}" data-home-menu-open="${esc(candidate.place.id)}">
      <span class="home-decide-top"><small>${esc(candidate.item.category)}</small><strong>${esc(priceLabel(candidate.item))}</strong></span>
      <b>${esc(candidate.item.name)}</b>
      <span class="home-decide-place">${esc(candidate.place.name)}</span>
      <span class="home-decide-meta">${esc(candidate.status.label)} · ${esc(near)}</span>
      ${reasons.length ? `<span class="home-decide-reasons">${reasons.map(reason => `<i>${esc(reason)}</i>`).join('')}</span>` : ''}
    </button>`;
  }

  function contextCopy() {
    if (activeMode === 'auto') return autoContext();
    const copy = {
      now:{eyebrow:'JETZT ESSEN',title:'Was passt jetzt?',copy:'Nur Betriebe, die nach veröffentlichter Quellenlage gerade geöffnet sind.'},
      evening:{eyebrow:'HEUTE ABEND',title:'Was passt später?',copy:'Konkrete Gerichte bei Betrieben mit passendem Zeitfenster heute Abend.'},
      budget:{eyebrow:'GUT & BEZAHLBAR',title:'Bis 20 Euro',copy:'Konkrete Gerichte bis 20 €, nach Nähe und Quellenstatus sortiert.'},
      vegetarian:{eyebrow:'VEGETARISCH',title:'Was passt ohne Fleisch?',copy:'Nur Gerichte, die in der strukturierten Quelle als vegetarisch oder vegan markiert sind.'}
    };
    return copy[activeMode] || autoContext();
  }

  function renderPanel(panel) {
    if (!panel || !payload) return;
    const picks = selectDiverse(5);
    const ctx = contextCopy();
    const cards = panel.querySelector('[data-home-decide-results]');
    const eyebrow = panel.querySelector('[data-home-decide-eyebrow]');
    const title = panel.querySelector('[data-home-decide-title]');
    const copy = panel.querySelector('[data-home-decide-copy]');
    if (eyebrow) eyebrow.textContent = ctx.eyebrow;
    if (title) title.textContent = ctx.title;
    if (copy) copy.textContent = ctx.copy;
    panel.querySelectorAll('[data-home-mode]').forEach(button => button.classList.toggle('active',button.dataset.homeMode === activeMode));
    if (cards) cards.innerHTML = picks.length ? picks.map(cardMarkup).join('') : '<div class="home-decide-empty">Für diesen Kontext gibt es im aktuell gültigen Menübestand noch keine sichere Empfehlung.</div>';
  }

  function inject() {
    if (!payload || !viewEl) return;
    let tab = null;
    try { tab = state?.tab; } catch {}
    const existing = viewEl.querySelector('#hoy-home-decide');
    if (tab !== 'today') { existing?.remove(); return; }
    if (existing) { renderPanel(existing); return; }
    const nowSection = [...viewEl.querySelectorAll('.section')].find(section => section.querySelector('.eyebrow')?.textContent.trim() === 'HOY NOW');
    if (!nowSection) return;
    const panel = document.createElement('section');
    panel.id = 'hoy-home-decide';
    panel.className = 'home-decide';
    panel.innerHTML = `<div class="home-decide-head">
      <div><span class="eyebrow" data-home-decide-eyebrow>HOY DECIDE</span><h2 data-home-decide-title>Was passt jetzt?</h2><p data-home-decide-copy></p></div>
      <button type="button" data-home-open-gastro>Mehr entscheiden</button>
    </div>
    <div class="home-decide-modes" aria-label="HOY Decide Kontext">
      <button type="button" data-home-mode="auto" class="active">Für jetzt</button>
      <button type="button" data-home-mode="now">Jetzt offen*</button>
      <button type="button" data-home-mode="evening">Heute Abend*</button>
      <button type="button" data-home-mode="budget">≤ 20 €</button>
      <button type="button" data-home-mode="vegetarian">Vegetarisch</button>
    </div>
    <div class="home-decide-results" data-home-decide-results></div>
    <div class="home-decide-trust">* Öffnung und Fahrminuten sind bewusst keine Live-/Routingdaten: Öffnung basiert auf geprüften Quellen, Fahrzeit auf einer transparenten regionalen Näherung ab Stadtkyll. Preise stammen aus den strukturierten Menüquellen.</div>`;
    nowSection.insertAdjacentElement('afterend',panel);
    renderPanel(panel);
  }

  function queueInject() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; inject(); });
  }

  document.addEventListener('click',event => {
    const mode = event.target.closest('[data-home-mode]');
    if (mode) {
      activeMode = mode.dataset.homeMode;
      renderPanel(document.querySelector('#hoy-home-decide'));
      return;
    }
    const item = event.target.closest('[data-home-menu-open]');
    if (item) {
      try { showDetail(item.dataset.homeMenuOpen); } catch {}
      return;
    }
    if (event.target.closest('[data-home-open-gastro]')) {
      try { setTab('gastro','all'); } catch {}
    }
  },true);

  new MutationObserver(queueInject).observe(document.body,{childList:true,subtree:true});

  Promise.all(DATA_URLS.map(url => fetch(url,{cache:'no-store'}).then(response => {
    if (!response.ok) throw new Error(`Menüquelle nicht verfügbar: ${url}`);
    return response.json();
  })))
    .then(docs => { payload = mergeDocuments(docs); queueInject(); })
    .catch(error => console.warn('HOY Homepage Decide konnte nicht geladen werden.',error));
})();
