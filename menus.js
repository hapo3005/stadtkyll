(() => {
  'use strict';

  const DATA_URLS = [
    'data/menus.json',
    'data/menus-25km-a.json',
    'data/menus-25km-b.json',
    'data/menus-25km-c.json'
  ];
  const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
  const detailEl = document.querySelector('#detail');
  const viewEl = document.querySelector('#view');
  let payload = null;
  let activePlaceId = null;
  let activeMenuFilter = 'all';
  let dishQuery = '';
  let menusPromise = null;
  let queued = false;
  let finderOrigin = null;
  let finderOriginMode = 'region';
  const decision = {
    now:false,
    evening:false,
    vegetarian:false,
    breakfast:false,
    delivery:false,
    takeaway:false,
    near15:false,
    maxPrice:null
  };

  const escHtml = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const money = value => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);
  const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

  function berlinDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA',{
      timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(date);
    const value = type => parts.find(part => part.type === type)?.value || '';
    const weekday = value('weekday').slice(0,3).toLowerCase();
    const dayMap = {sun:'sun',mon:'mon',tue:'tue',wed:'wed',thu:'thu',fri:'fri',sat:'sat'};
    return {
      key:`${value('year')}-${value('month')}-${value('day')}`,
      day:dayMap[weekday] || dayKeys[date.getDay()],
      minutes:Number(value('hour')) * 60 + Number(value('minute'))
    };
  }

  function toMinutes(hhmm) {
    const [h,m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
  }

  function normalizeItem(item, menu, index) {
    if (!Array.isArray(item)) return item;
    const [category,name,price,description='',tags='',availability='',season=''] = item;
    return {
      id:`${menu.placeId}-${index + 1}`,
      category,
      name,
      price,
      ...(description ? {description} : {}),
      ...(tags ? {tags:String(tags).split('|').map(tag => tag.trim()).filter(Boolean)} : {}),
      ...(availability ? {availability} : {}),
      ...(season ? {season} : {})
    };
  }

  function normalizeMenu(menu) {
    return {...menu,items:(menu.items || []).map((item,index) => normalizeItem(item,menu,index))};
  }

  function mergeDocuments(docs) {
    const menus = docs.flatMap(doc => doc?.menus || []).map(normalizeMenu);
    const links = docs.flatMap(doc => doc?.links || []);
    const version = docs.map(doc => doc?.version).filter(Boolean).sort().at(-1) || '0.22.0';
    return {version,menus,links};
  }

  function loadMenus() {
    if (!menusPromise) {
      menusPromise = Promise.all(DATA_URLS.map(url => fetch(url,{cache:'no-store'}).then(res => {
        if (!res.ok) throw new Error(`Menüquelle nicht verfügbar: ${url}`);
        return res.json();
      })))
        .then(docs => (payload = mergeDocuments(docs)))
        .catch(error => {
          console.warn('HOY Menü-Layer konnte nicht vollständig geladen werden.',error);
          return null;
        });
    }
    return menusPromise;
  }

  function menuIsCurrent(menu) {
    const today = berlinDateParts().key;
    if (menu.validFrom && today < menu.validFrom) return false;
    if (menu.validTo && today > menu.validTo) return false;
    return true;
  }

  function currentMenus() {
    return (payload?.menus || []).filter(menuIsCurrent);
  }

  function menuFor(placeId) {
    return currentMenus().find(menu => menu.placeId === placeId) || null;
  }

  function menuLinkFor(placeId) {
    return payload?.links?.find(link => link.placeId === placeId) || null;
  }

  function placeFor(placeId) {
    try { return state?.places?.find(place => place.id === placeId) || null; } catch { return null; }
  }

  function todayKey() { return berlinDateParts().day; }

  function isToday(item) {
    return Array.isArray(item.availableDays) && item.availableDays.includes(todayKey());
  }

  function minPrice(menu) {
    const values = menu.items.map(item => Number(item.price)).filter(Number.isFinite);
    return values.length ? Math.min(...values) : null;
  }

  function priceLabel(item) {
    const prefix = norm(item.availability).includes('ab-preis') ? 'ab ' : '';
    return `${prefix}${money(item.price)}`;
  }

  function coverageLabel(menu) {
    const labels = {
      'structured-selection':'Strukturierter Ausschnitt',
      'operator-pdf':'Betreiber-PDF',
      'operator-order-system-structured-selection':'Betreiber-Bestellsystem',
      'operator-menu-and-breakfast':'Betreiberkarte + Frühstück',
      'operator-current-offers':'Aktuelle Betreiberangebote',
      'time-bounded-weekly-special':'Zeitgebundene Wochenkarte',
      'time-bounded-event-menu':'Zeitgebundenes Event-Menü'
    };
    return labels[menu.coverage] || 'Betreiberkarte';
  }

  function sourceAge(entry) {
    const checked = entry?.source?.checkedAt;
    if (!checked) return 'Prüfdatum unbekannt';
    const today = new Date(`${berlinDateParts().key}T12:00:00+02:00`);
    const checkedDate = new Date(`${checked}T12:00:00+02:00`);
    const days = Math.max(0,Math.floor((today.getTime() - checkedDate.getTime()) / 86400000));
    if (days === 0) return 'heute geprüft';
    if (days === 1) return 'gestern geprüft';
    return `vor ${days} Tagen geprüft`;
  }

  function scheduleApplies(place) {
    const key = berlinDateParts().key;
    if (place?.scheduleValidFrom && key < place.scheduleValidFrom) return false;
    if (place?.scheduleValidTo && key > place.scheduleValidTo) return false;
    return true;
  }

  function sourceOpening(place) {
    if (!place?.weeklyHours) return {code:'na',label:'Heute planbar'};
    if (!scheduleApplies(place)) return {code:'closed',label:'Saisonal geschlossen'};
    const now = berlinDateParts();
    const slots = place.weeklyHours[now.day] || [];
    for (const slot of slots) {
      const [from,to] = slot.split('-');
      const start = toMinutes(from);
      const end = toMinutes(to);
      if (now.minutes >= start && now.minutes < end) return {code:'open',label:`laut Quelle offen · bis ${to}`};
      if (now.minutes < start) return {code:'soon',label:`laut Quelle ab ${from}`};
    }
    return {code:'closed',label:slots.length ? 'laut Quelle heute geschlossen' : 'laut Quelle heute Ruhetag'};
  }

  function openInEvening(place) {
    if (!place?.weeklyHours || !scheduleApplies(place)) return false;
    const slots = place.weeklyHours[berlinDateParts().day] || [];
    return slots.some(slot => {
      const [from,to] = slot.split('-');
      const start = toMinutes(from);
      const end = toMinutes(to);
      return start < 22 * 60 && end > 17 * 60;
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

  function activeOrigin() {
    if (finderOrigin) return finderOrigin;
    try {
      if (state?.region?.center) return {lat:state.region.center.lat,lng:state.region.center.lng};
    } catch {}
    return null;
  }

  function proximity(place) {
    const km = distanceKm(activeOrigin(),place?.location);
    if (km === null) return {km:null,minutes:null};
    const minutes = Math.max(3,Math.round(km * 1.7));
    return {km,minutes};
  }

  function isVegetarian(item) {
    return (item.tags || []).some(tag => ['vegan','vegetarisch'].some(key => norm(tag).startsWith(key)));
  }

  function isBreakfast(item) {
    const text = norm(`${item.category} ${item.name}`);
    return text.includes('fruhstuck') || text.includes('frühstück');
  }

  function itemMatches(item,filter) {
    if (filter === 'all') return true;
    if (filter === 'today') return isToday(item);
    if (filter === 'under10') return Number(item.price) <= 10;
    if (filter === 'under15') return Number(item.price) <= 15;
    if (filter === 'vegetarian') return isVegetarian(item);
    if (filter.startsWith('cat:')) return item.category === filter.slice(4);
    return true;
  }

  function categoryFilters(menu) {
    const categories = [...new Set(menu.items.map(item => item.category))];
    const hasToday = menu.items.some(isToday);
    const hasVeg = menu.items.some(isVegetarian);
    return [
      ['all','Alles'],
      ...(hasToday ? [['today','Heute']] : []),
      ['under10','≤ 10 €'],
      ['under15','≤ 15 €'],
      ...(hasVeg ? [['vegetarian','Vegetarisch']] : []),
      ...categories.map(cat => [`cat:${cat}`,cat])
    ];
  }

  function itemMarkup(item) {
    const today = isToday(item);
    const badges = [
      ...(today ? ['Heute'] : []),
      ...(item.limited && today ? ['solange Vorrat'] : []),
      ...(item.season ? [item.season] : []),
      ...(item.availability ? [item.availability] : [])
    ];
    return `<article class="menu-item ${today ? 'is-today' : ''}" data-menu-item data-price="${Number(item.price)}" data-category="${escHtml(item.category)}">
      <div class="menu-item-main">
        <span class="menu-item-cat">${escHtml(item.category)}</span>
        <h4>${escHtml(item.name)}</h4>
        ${item.description ? `<p>${escHtml(item.description)}</p>` : ''}
        ${badges.length ? `<div class="menu-item-badges">${badges.map(b => `<span>${escHtml(b)}</span>`).join('')}</div>` : ''}
      </div>
      <strong>${escHtml(priceLabel(item))}</strong>
    </article>`;
  }

  function menuDetailMarkup(menu) {
    const filtered = menu.items.filter(item => itemMatches(item,activeMenuFilter));
    const todaySpecials = menu.items.filter(isToday);
    const filters = categoryFilters(menu);
    const validity = menu.validTo ? ` · gültig bis ${new Intl.DateTimeFormat('de-DE').format(new Date(`${menu.validTo}T12:00:00`))}` : '';
    return `<section class="hoy-menu-detail" data-hoy-menu-detail data-menu-place="${escHtml(menu.placeId)}" data-menu-filter-state="${escHtml(activeMenuFilter)}">
      <div class="menu-detail-head">
        <div><span class="eyebrow">HOY SPEISEKARTE</span><h3>Was bekommst du hier?</h3></div>
        <span class="menu-count">${menu.items.length} erfasst</span>
      </div>
      ${todaySpecials.length ? `<div class="menu-today-callout"><span>HEUTE</span><strong>${escHtml(todaySpecials[0].name)}</strong><b>${escHtml(priceLabel(todaySpecials[0]))}</b><small>${todaySpecials[0].limited ? 'laut Betreiber · solange Vorrat' : 'laut Betreiber'}</small></div>` : ''}
      <div class="menu-filterbar">${filters.map(([id,label]) => `<button type="button" data-menu-filter="${escHtml(id)}" class="${activeMenuFilter===id?'active':''}">${escHtml(label)}</button>`).join('')}</div>
      <div class="menu-items">${filtered.length ? filtered.map(itemMarkup).join('') : '<div class="menu-empty">Für diesen Filter gibt es in der strukturierten Karte noch keinen Treffer.</div>'}</div>
      <div class="menu-trustbox">
        <div><strong>${escHtml(coverageLabel(menu))}</strong><span>${escHtml(sourceAge(menu))}${escHtml(validity)} · quellbasiert, nicht live</span></div>
        <a href="${escHtml(menu.source.url)}" target="_blank" rel="noopener">Originalkarte ↗</a>
      </div>
      ${menu.source.note ? `<p class="menu-source-note">${escHtml(menu.source.note)}</p>` : ''}
    </section>`;
  }

  function menuLinkDetailMarkup(link) {
    const stale = link.coverage === 'stale-operator-menu-page';
    return `<section class="hoy-menu-detail" data-hoy-menu-detail data-menu-place="${escHtml(link.placeId)}" data-menu-filter-state="link">
      <div class="menu-detail-head">
        <div><span class="eyebrow">HOY SPEISEKARTE</span><h3>${stale ? 'Historische Karte vorhanden' : 'Originalkarte gefunden'}</h3></div>
        <span class="menu-count ${stale ? 'is-stale' : ''}">${stale ? 'ALT' : 'Original'}</span>
      </div>
      <div class="menu-empty">${stale ? 'Diese Betreiberkarte ist noch online, ihr Preisstand ist aber historisch. HOY verwendet ihre Preise bewusst nicht für aktuelle Entscheidungen.' : 'Für diesen Betrieb ist eine aktuelle bzw. aktuell verlinkte Speisekarte gefunden. Einzelgerichte und Preise werden erst dann in die HOY-Suche übernommen, wenn sie zuverlässig strukturiert werden können.'}</div>
      <div class="menu-trustbox">
        <div><strong>${escHtml(link.source.label)}</strong><span>${escHtml(sourceAge(link))} · ${stale ? 'historische Quelle' : 'Originalquelle'}</span></div>
        <a href="${escHtml(link.source.url)}" target="_blank" rel="noopener">${stale ? 'Quelle ansehen ↗' : 'Speisekarte ↗'}</a>
      </div>
      ${link.source.note ? `<p class="menu-source-note">${escHtml(link.source.note)}</p>` : ''}
    </section>`;
  }

  function decorateDetail() {
    if (!payload || !detailEl?.open || !activePlaceId) return;
    const menu = menuFor(activePlaceId);
    const link = menu ? null : menuLinkFor(activePlaceId);
    const old = detailEl.querySelector('[data-hoy-menu-detail]');
    if (!menu && !link) { old?.remove(); return; }
    const stateKey = menu ? activeMenuFilter : 'link';
    if (old?.dataset.menuPlace === activePlaceId && old?.dataset.menuFilterState === stateKey) return;
    const detailBody = detailEl.querySelector('.detail');
    if (!detailBody) return;
    const temp = document.createElement('div');
    temp.innerHTML = menu ? menuDetailMarkup(menu) : menuLinkDetailMarkup(link);
    const next = temp.firstElementChild;
    if (old) old.replaceWith(next);
    else {
      const actions = detailBody.querySelector('.card-actions');
      if (actions) actions.insertAdjacentElement('beforebegin',next);
      else detailBody.appendChild(next);
    }
  }

  function menuSignal(menu) {
    const min = minPrice(menu);
    const today = menu.items.find(isToday);
    return `<div class="menu-signal" data-menu-signal data-menu-place="${escHtml(menu.placeId)}">
      <span>HOY SPEISEKARTE</span>
      <strong>${today ? `Heute: ${escHtml(today.name)} · ${escHtml(priceLabel(today))}` : `${menu.items.length} Gerichte${min !== null ? ` · ab ${money(min)}` : ''}`}</strong>
      <small>${escHtml(coverageLabel(menu))} · ${escHtml(sourceAge(menu))}</small>
    </div>`;
  }

  function menuLinkSignal(link) {
    const stale = link.coverage === 'stale-operator-menu-page';
    return `<div class="menu-signal ${stale ? 'is-stale' : ''}" data-menu-signal data-menu-place="${escHtml(link.placeId)}">
      <span>HOY SPEISEKARTE</span>
      <strong>${stale ? 'Historische Betreiberkarte' : 'Originalkarte verfügbar'}</strong>
      <small>${stale ? 'Preise nicht als aktuell verwendet' : `noch nicht strukturiert · ${sourceAge(link)}`}</small>
    </div>`;
  }

  function decorateCards() {
    if (!payload || !viewEl) return;
    viewEl.querySelectorAll('[data-detail]').forEach(button => {
      const card = button.closest('.card');
      if (!card) return;
      const placeId = button.dataset.detail;
      const menu = menuFor(placeId);
      const link = menu ? null : menuLinkFor(placeId);
      const existing = card.querySelector('[data-menu-signal]');
      if (!menu && !link) { existing?.remove(); return; }
      if (existing?.dataset.menuPlace === placeId) return;
      existing?.remove();
      const trust = card.querySelector('.trust');
      if (trust) trust.insertAdjacentHTML('beforebegin',menu ? menuSignal(menu) : menuLinkSignal(link));
    });
  }

  function dishHaystack(menu,item) {
    return norm([menu.placeName,item.name,item.category,item.description,...(item.tags || [])].filter(Boolean).join(' '));
  }

  function activeDecisionCount() {
    return ['now','evening','vegetarian','breakfast','delivery','takeaway','near15'].filter(key => decision[key]).length + (decision.maxPrice ? 1 : 0);
  }

  function filterDishResult(menu,item,place,q) {
    if (q && !dishHaystack(menu,item).includes(q)) return false;
    if (decision.maxPrice && Number(item.price) > decision.maxPrice) return false;
    if (decision.vegetarian && !isVegetarian(item)) return false;
    if (decision.breakfast && !isBreakfast(item)) return false;
    if (decision.delivery && !(place?.tags || []).includes('lieferservice')) return false;
    if (decision.takeaway && !(place?.tags || []).includes('takeaway')) return false;
    if (decision.now && sourceOpening(place).code !== 'open') return false;
    if (decision.evening && !openInEvening(place)) return false;
    if (decision.near15 && (proximity(place).minutes === null || proximity(place).minutes > 15)) return false;
    return true;
  }

  function dishResults(query) {
    let q = norm(query);
    const priceMatch = q.match(/(?:unter|bis|max\.?|≤)\s*(\d{1,3})\s*€?/);
    const queryMax = priceMatch ? Number(priceMatch[1]) : null;
    if (queryMax) q = q.replace(priceMatch[0],'').trim();
    const out = [];
    currentMenus().forEach(menu => {
      menu.items.forEach(item => {
        const place = placeFor(menu.placeId);
        if (queryMax && Number(item.price) > queryMax) return;
        if (!filterDishResult(menu,item,place,q)) return;
        out.push({menu,item,place,near:proximity(place),opening:sourceOpening(place)});
      });
    });
    out.sort((a,b) => {
      const score = result => {
        let value = 0;
        if (result.opening.code === 'open') value -= 30;
        if (isToday(result.item)) value -= 20;
        if (decision.evening && openInEvening(result.place)) value -= 10;
        if (q && norm(result.item.name).includes(q)) value -= 12;
        if (result.near.minutes !== null) value += Math.min(30,result.near.minutes) * .35;
        value += Number(result.item.price) * .08;
        return value;
      };
      return score(a)-score(b) || a.item.price-b.item.price || a.item.name.localeCompare(b.item.name,'de');
    });
    return out.slice(0,24);
  }

  function dishResultMarkup(result) {
    const origin = finderOriginMode === 'user' ? 'von dir' : 'ab Stadtkyll';
    const near = result.near.minutes !== null ? ` · ca. ${result.near.minutes} Min.* ${origin}` : '';
    const service = [
      ...(result.place?.tags || []).includes('lieferservice') ? ['Lieferung'] : [],
      ...(result.place?.tags || []).includes('takeaway') ? ['Takeaway'] : []
    ].join(' · ');
    return `<button type="button" class="dish-result" data-menu-open="${escHtml(result.menu.placeId)}">
      <span class="dish-result-top"><b>${escHtml(result.item.name)}</b><strong>${escHtml(priceLabel(result.item))}</strong></span>
      <span>${escHtml(result.menu.placeName)} · ${escHtml(result.item.category)}</span>
      <small>${isToday(result.item) ? 'Heute · ' : ''}${escHtml(result.opening.label)}${escHtml(near)}${service ? ` · ${escHtml(service)}` : ''}</small>
    </button>`;
  }

  function decisionLabel() {
    const labels = [];
    if (decision.now) labels.push('jetzt offen');
    if (decision.evening) labels.push('heute Abend');
    if (decision.breakfast) labels.push('Frühstück');
    if (decision.vegetarian) labels.push('vegetarisch');
    if (decision.delivery) labels.push('Lieferung');
    if (decision.takeaway) labels.push('Takeaway');
    if (decision.maxPrice) labels.push(`≤ ${decision.maxPrice} €`);
    if (decision.near15) labels.push('≤ 15 Min.*');
    return labels;
  }

  function renderDishFinder(panel) {
    if (!panel || !payload) return;
    const shouldSearch = dishQuery.trim() || activeDecisionCount();
    const results = shouldSearch ? dishResults(dishQuery) : [];
    const list = panel.querySelector('[data-dish-results]');
    const summary = panel.querySelector('[data-dish-summary]');
    if (!list) return;
    panel.querySelectorAll('[data-decision]').forEach(button => {
      const key = button.dataset.decision;
      const active = key === 'price15' ? decision.maxPrice === 15 : key === 'price20' ? decision.maxPrice === 20 : !!decision[key];
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active ? 'true' : 'false');
    });
    const locate = panel.querySelector('[data-menu-locate]');
    if (locate) locate.textContent = finderOriginMode === 'user' ? '⌖ Deine Position aktiv' : '⌖ Nähe ab Stadtkyll';
    if (summary) {
      if (!shouldSearch) summary.innerHTML = 'Kombiniere mehrere Kriterien – HOY sucht dann konkrete Gerichte über alle gültigen Speisekarten hinweg.';
      else {
        const places = new Set(results.map(result => result.menu.placeId)).size;
        const applied = decisionLabel();
        summary.innerHTML = `<strong>${results.length}${results.length === 24 ? '+' : ''} passende Gerichte</strong> · ${places} Betriebe${applied.length ? ` · ${escHtml(applied.join(' · '))}` : ''}`;
      }
    }
    list.innerHTML = shouldSearch
      ? (results.length ? results.map(dishResultMarkup).join('') : '<div class="menu-empty">Keine Kombination erfüllt derzeit alle gewählten Kriterien. Ein Kriterium entfernen oder Preisgrenze erhöhen.</div>')
      : '<div class="dish-hint">Beispiel: <b>Heute Abend</b> + <b>Vegetarisch</b> + <b>≤ 15 €</b>. Oder suche direkt nach Pizza, Schnitzel, Frühstück …</div>';
  }

  function injectDishFinder() {
    if (!payload || !viewEl) return;
    const head = [...viewEl.querySelectorAll('.head')].find(el => el.querySelector('.eyebrow')?.textContent.trim() === 'HOY GASTRO');
    if (!head || viewEl.querySelector('#hoy-dish-finder')) return;
    const structured = currentMenus();
    const currentItemCount = structured.reduce((sum,menu) => sum + menu.items.length,0);
    const allItemCount = (payload.menus || []).reduce((sum,menu) => sum + menu.items.length,0);
    const panel = document.createElement('section');
    panel.id = 'hoy-dish-finder';
    panel.className = 'dish-finder';
    panel.innerHTML = `<div class="dish-finder-head"><span class="eyebrow">HOY DECIDE</span><h2>Sag, was passen muss.</h2><p>Gericht, Preis, Zeitpunkt und Nähe werden gemeinsam bewertet – nicht nacheinander durchsucht.</p></div>
      <div class="dish-search"><input type="search" data-dish-input value="${escHtml(dishQuery)}" placeholder="Pizza, Schnitzel, Curry …" aria-label="Gericht suchen"><button type="button" data-dish-submit>Finden</button></div>
      <div class="decision-label">ZEIT & SITUATION</div>
      <div class="dish-quick decision-row">
        <button type="button" data-decision="now">● Jetzt offen*</button>
        <button type="button" data-decision="evening">Heute Abend*</button>
        <button type="button" data-decision="breakfast">Frühstück</button>
        <button type="button" data-decision="delivery">Lieferung</button>
        <button type="button" data-decision="takeaway">Takeaway</button>
      </div>
      <div class="decision-label">PREIS & ESSEN</div>
      <div class="dish-quick decision-row">
        <button type="button" data-decision="price15">≤ 15 €</button>
        <button type="button" data-decision="price20">≤ 20 €</button>
        <button type="button" data-decision="vegetarian">Vegetarisch</button>
        <button type="button" data-dish-query="Pizza">Pizza</button>
        <button type="button" data-dish-query="Burger">Burger</button>
        <button type="button" data-dish-query="Schnitzel">Schnitzel</button>
      </div>
      <div class="decision-location">
        <button type="button" data-decision="near15">≤ 15 Min.*</button>
        <button type="button" data-menu-locate>⌖ Nähe ab Stadtkyll</button>
        <button type="button" data-decision-reset>Zurücksetzen</button>
      </div>
      <div class="dish-summary" data-dish-summary></div>
      <div class="dish-results" data-dish-results></div>
      <div class="dish-finder-foot">${allItemCount} strukturierte Preispositionen · ${currentItemCount} derzeit im Gültigkeitsfenster · ${(payload.links || []).length} weitere Originalkarten. *Öffnung ist quellbasiert, nicht live. Fahrzeit ist eine transparente Näherung aus Luftlinie und lokalem Straßenfaktor – keine Navigation. Standort wird nur nach Klick verwendet und nicht gespeichert.</div>`;
    const filterLine = head.nextElementSibling;
    if (filterLine) filterLine.insertAdjacentElement('afterend',panel);
    else head.insertAdjacentElement('afterend',panel);
    renderDishFinder(panel);
  }

  function enhanceSearch() {
    try {
      if (typeof matchesQuery !== 'function' || matchesQuery.__menuEnhanced) return;
      const original = matchesQuery;
      const enhanced = function(place) {
        if (original(place)) return true;
        const q = state.query?.trim().toLowerCase();
        if (!q) return true;
        const menu = menuFor(place.id);
        return !!menu?.items.some(item => dishHaystack(menu,item).includes(norm(q)));
      };
      enhanced.__menuEnhanced = true;
      matchesQuery = enhanced;
    } catch {}
  }

  function decorate() {
    if (!payload) return;
    enhanceSearch();
    decorateCards();
    injectDishFinder();
    decorateDetail();
  }

  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; decorate(); });
  }

  function resetDecision() {
    Object.keys(decision).forEach(key => { decision[key] = key === 'maxPrice' ? null : false; });
    dishQuery = '';
  }

  function useFinderLocation() {
    if (!navigator.geolocation) {
      try { showToast('Standort ist in diesem Browser nicht verfügbar'); } catch {}
      return;
    }
    try { showToast('Standortfreigabe wird angefragt …'); } catch {}
    navigator.geolocation.getCurrentPosition(position => {
      finderOrigin = {lat:position.coords.latitude,lng:position.coords.longitude};
      finderOriginMode = 'user';
      try { showToast('Nähe wird jetzt von deiner Position berechnet'); } catch {}
      renderDishFinder(document.querySelector('#hoy-dish-finder'));
    },() => {
      try { showToast('Standort wurde nicht freigegeben'); } catch {}
    },{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
  }

  document.addEventListener('click',event => {
    const detailButton = event.target.closest('[data-detail]');
    if (detailButton) {
      activePlaceId = detailButton.dataset.detail;
      activeMenuFilter = 'all';
      setTimeout(queueDecorate,0);
      return;
    }

    const menuFilter = event.target.closest('[data-menu-filter]');
    if (menuFilter) {
      activeMenuFilter = menuFilter.dataset.menuFilter;
      decorateDetail();
      return;
    }

    const decisionButton = event.target.closest('[data-decision]');
    if (decisionButton) {
      const key = decisionButton.dataset.decision;
      if (key === 'price15') decision.maxPrice = decision.maxPrice === 15 ? null : 15;
      else if (key === 'price20') decision.maxPrice = decision.maxPrice === 20 ? null : 20;
      else decision[key] = !decision[key];
      renderDishFinder(document.querySelector('#hoy-dish-finder'));
      return;
    }

    if (event.target.closest('[data-decision-reset]')) {
      resetDecision();
      const panel = document.querySelector('#hoy-dish-finder');
      const input = panel?.querySelector('[data-dish-input]');
      if (input) input.value = '';
      renderDishFinder(panel);
      return;
    }

    if (event.target.closest('[data-menu-locate]')) {
      useFinderLocation();
      return;
    }

    const queryButton = event.target.closest('[data-dish-query]');
    if (queryButton) {
      dishQuery = dishQuery === queryButton.dataset.dishQuery ? '' : queryButton.dataset.dishQuery;
      const panel = document.querySelector('#hoy-dish-finder');
      const input = panel?.querySelector('[data-dish-input]');
      if (input) input.value = dishQuery;
      renderDishFinder(panel);
      return;
    }

    if (event.target.closest('[data-dish-submit]')) {
      const panel = document.querySelector('#hoy-dish-finder');
      dishQuery = panel?.querySelector('[data-dish-input]')?.value || '';
      renderDishFinder(panel);
      return;
    }

    const dishOpen = event.target.closest('[data-menu-open]');
    if (dishOpen) {
      activePlaceId = dishOpen.dataset.menuOpen;
      activeMenuFilter = 'all';
      try { showDetail(activePlaceId); } catch {}
      setTimeout(queueDecorate,0);
    }
  },true);

  document.addEventListener('keydown',event => {
    if (event.key !== 'Enter' || !event.target.matches('[data-dish-input]')) return;
    dishQuery = event.target.value;
    renderDishFinder(document.querySelector('#hoy-dish-finder'));
  });

  new MutationObserver(queueDecorate).observe(document.body,{childList:true,subtree:true});
  loadMenus().then(queueDecorate);
})();
