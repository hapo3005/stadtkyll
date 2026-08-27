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

  const escHtml = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const money = value => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);

  function berlinDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA',{
      timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'
    }).formatToParts(date);
    const value = type => parts.find(part => part.type === type)?.value || '';
    const weekday = value('weekday').slice(0,3).toLowerCase();
    const dayMap = {sun:'sun',mon:'mon',tue:'tue',wed:'wed',thu:'thu',fri:'fri',sat:'sat'};
    return {
      key:`${value('year')}-${value('month')}-${value('day')}`,
      day:dayMap[weekday] || dayKeys[date.getDay()]
    };
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
    return {version:'0.15.0',menus,links};
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

  function coverageLabel(menu) {
    if (menu.coverage === 'structured-selection') return 'Strukturierter Ausschnitt';
    if (menu.coverage === 'operator-pdf') return 'Betreiber-PDF';
    return 'Betreiberkarte';
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

  function itemMatches(item,filter) {
    if (filter === 'all') return true;
    if (filter === 'today') return isToday(item);
    if (filter === 'under10') return Number(item.price) <= 10;
    if (filter === 'under15') return Number(item.price) <= 15;
    if (filter === 'vegetarian') return (item.tags || []).some(tag => tag === 'vegan' || tag.startsWith('vegetarisch'));
    if (filter.startsWith('cat:')) return item.category === filter.slice(4);
    return true;
  }

  function categoryFilters(menu) {
    const categories = [...new Set(menu.items.map(item => item.category))];
    const hasToday = menu.items.some(isToday);
    const hasVeg = menu.items.some(item => (item.tags || []).some(tag => tag === 'vegan' || tag.startsWith('vegetarisch')));
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
      <strong>${money(item.price)}</strong>
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
      ${todaySpecials.length ? `<div class="menu-today-callout"><span>HEUTE</span><strong>${escHtml(todaySpecials[0].name)}</strong><b>${money(todaySpecials[0].price)}</b><small>${todaySpecials[0].limited ? 'laut Betreiber · solange Vorrat' : 'laut Betreiber'}</small></div>` : ''}
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
    return `<section class="hoy-menu-detail" data-hoy-menu-detail data-menu-place="${escHtml(link.placeId)}" data-menu-filter-state="link">
      <div class="menu-detail-head">
        <div><span class="eyebrow">HOY SPEISEKARTE</span><h3>Originalkarte gefunden</h3></div>
        <span class="menu-count">Original</span>
      </div>
      <div class="menu-empty">Für diesen Betrieb ist eine aktuelle bzw. aktuell verlinkte Speisekarte gefunden. Einzelgerichte und Preise werden erst dann in die HOY-Suche übernommen, wenn sie zuverlässig strukturiert werden können.</div>
      <div class="menu-trustbox">
        <div><strong>${escHtml(link.source.label)}</strong><span>${escHtml(sourceAge(link))} · Originalquelle</span></div>
        <a href="${escHtml(link.source.url)}" target="_blank" rel="noopener">Speisekarte ↗</a>
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
      <strong>${today ? `Heute: ${escHtml(today.name)} · ${money(today.price)}` : `${menu.items.length} Gerichte${min !== null ? ` · ab ${money(min)}` : ''}`}</strong>
      <small>${escHtml(coverageLabel(menu))} · ${escHtml(sourceAge(menu))}</small>
    </div>`;
  }

  function menuLinkSignal(link) {
    return `<div class="menu-signal" data-menu-signal data-menu-place="${escHtml(link.placeId)}">
      <span>HOY SPEISEKARTE</span>
      <strong>Originalkarte verfügbar</strong>
      <small>noch nicht strukturiert · ${escHtml(sourceAge(link))}</small>
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
    return [menu.placeName,item.name,item.category,item.description,...(item.tags || [])].filter(Boolean).join(' ').toLowerCase();
  }

  function dishResults(query) {
    const q = query.trim().toLowerCase();
    const under15 = ['≤15','≤ 15','unter 15','unter15'].includes(q);
    const under10 = ['≤10','≤ 10','unter 10','unter10'].includes(q);
    const out = [];
    currentMenus().forEach(menu => {
      menu.items.forEach(item => {
        const matches = !q || dishHaystack(menu,item).includes(q) || (under15 && item.price <= 15) || (under10 && item.price <= 10);
        if (matches) out.push({menu,item,place:placeFor(menu.placeId)});
      });
    });
    out.sort((a,b) => {
      const aToday = isToday(a.item) ? -1 : 0;
      const bToday = isToday(b.item) ? -1 : 0;
      return aToday - bToday || a.item.price - b.item.price || a.item.name.localeCompare(b.item.name,'de');
    });
    return out.slice(0,16);
  }

  function dishResultMarkup(result) {
    let status = '';
    try { if (result.place && typeof openingState === 'function') status = openingState(result.place).label; } catch {}
    return `<button type="button" class="dish-result" data-menu-open="${escHtml(result.menu.placeId)}">
      <span class="dish-result-top"><b>${escHtml(result.item.name)}</b><strong>${money(result.item.price)}</strong></span>
      <span>${escHtml(result.menu.placeName)} · ${escHtml(result.item.category)}</span>
      <small>${isToday(result.item) ? 'Heute · ' : ''}${escHtml(status || 'quellbasiert')}</small>
    </button>`;
  }

  function renderDishFinder(panel) {
    if (!panel || !payload) return;
    const results = dishResults(dishQuery);
    const list = panel.querySelector('[data-dish-results]');
    if (!list) return;
    list.innerHTML = dishQuery
      ? (results.length ? results.map(dishResultMarkup).join('') : '<div class="menu-empty">Kein Gericht in den bisher strukturierten Speisekarten gefunden.</div>')
      : '<div class="dish-hint">Suche z. B. nach <b>Pizza</b>, <b>Burger</b>, <b>Frühstück</b> oder nutze einen Preisfilter.</div>';
  }

  function injectDishFinder() {
    if (!payload || !viewEl) return;
    const head = [...viewEl.querySelectorAll('.head')].find(el => el.querySelector('.eyebrow')?.textContent.trim() === 'HOY GASTRO');
    if (!head || viewEl.querySelector('#hoy-dish-finder')) return;
    const structured = currentMenus();
    const itemCount = structured.reduce((sum,menu) => sum + menu.items.length,0);
    const panel = document.createElement('section');
    panel.id = 'hoy-dish-finder';
    panel.className = 'dish-finder';
    panel.innerHTML = `<div class="dish-finder-head"><span class="eyebrow">HOY MENU</span><h2>Such das Essen. Nicht das Restaurant.</h2><p>HOY durchsucht strukturierte Gerichte und Preise über mehrere Betriebe hinweg.</p></div>
      <div class="dish-search"><input type="search" data-dish-input placeholder="Pizza, Schnitzel, Frühstück …" aria-label="Gericht suchen"><button type="button" data-dish-submit>Finden</button></div>
      <div class="dish-quick">
        <button type="button" data-dish-query="Pizza">Pizza</button>
        <button type="button" data-dish-query="Pasta">Pasta</button>
        <button type="button" data-dish-query="Burger">Burger</button>
        <button type="button" data-dish-query="Schnitzel">Schnitzel</button>
        <button type="button" data-dish-query="Frühstück">Frühstück</button>
        <button type="button" data-dish-query="unter 15">≤ 15 €</button>
      </div>
      <div class="dish-results" data-dish-results></div>
      <div class="dish-finder-foot">Aktuell ${structured.length} strukturierte Karten · ${itemCount} Gerichte · ${(payload.links || []).length} weitere Originalkarten. Preise sind Quellenwerte, keine Live-Bestätigung.</div>`;
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
        return !!menu?.items.some(item => dishHaystack(menu,item).includes(q));
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

    const queryButton = event.target.closest('[data-dish-query]');
    if (queryButton) {
      dishQuery = queryButton.dataset.dishQuery;
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