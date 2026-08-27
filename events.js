(() => {
  'use strict';

  const DATA_URLS = ['data/events.json?v=0.24.0','data/events-local.json?v=0.24.0'];
  let eventsPromise = null;
  let expanded = false;
  let queued = false;
  let filter = 'all';

  function esc(value = '') {
    return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function berlinDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function dayDistance(fromKey, toKey) {
    const from = Date.parse(`${fromKey}T00:00:00Z`);
    const to = Date.parse(`${toKey}T00:00:00Z`);
    return Math.round((to - from) / 86400000);
  }

  function timingLabel(event, todayKey) {
    if (event.startDate <= todayKey && event.endDate >= todayKey) return 'Läuft jetzt';
    const days = dayDistance(todayKey, event.startDate);
    if (days === 0) return 'Heute';
    if (days === 1) return 'Morgen';
    if (days > 1 && days <= 31) return `In ${days} Tagen`;
    return event.startDate.slice(0, 4) === todayKey.slice(0, 4) ? 'Vorausplanen' : event.startDate.slice(0, 4);
  }

  function normalizeDoc(doc) {
    return (doc?.events || []).map(event => ({
      ...event,
      scope:event.scope || (String(event.id || '').startsWith('nbr-') ? 'ring' : 'local'),
      source:event.source || doc.source || null
    }));
  }

  function loadEvents() {
    if (!eventsPromise) {
      eventsPromise = Promise.all(DATA_URLS.map(url => fetch(url,{cache:'no-store'}).then(response => response.ok ? response.json() : null)))
        .then(docs => {
          const events = docs.filter(Boolean).flatMap(normalizeDoc);
          const sources = docs.filter(Boolean).map(doc => doc.source).filter(Boolean);
          return {events,sources};
        })
        .catch(() => null);
    }
    return eventsPromise;
  }

  function priorityWeight(event) {
    if (event.priority === 'hero') return -3;
    if (event.priority === 'high') return -2;
    return 0;
  }

  function categoryText(event) {
    return `${event.category || ''} ${event.title || ''}`.toLowerCase();
  }

  function matchesFilter(event) {
    if (filter === 'all') return true;
    if (filter === 'local') return event.scope === 'local';
    if (filter === 'ring') return event.scope === 'ring';
    const text = categoryText(event);
    if (filter === 'family') return /famil|kinder|advent|st\. martin/.test(text);
    if (filter === 'culture') return /musik|jazz|konzert|theater|kultur|krimi|führung|geschichte/.test(text);
    if (filter === 'food') return /genuss|koch|dinner|markt|manufaktur/.test(text);
    return true;
  }

  function sortedUpcoming(payload,todayKey) {
    return (payload?.events || [])
      .filter(event => event.endDate >= todayKey)
      .filter(matchesFilter)
      .sort((a,b) => a.startDate.localeCompare(b.startDate)
        || (a.scope === b.scope ? 0 : a.scope === 'local' ? -1 : 1)
        || priorityWeight(a)-priorityWeight(b)
        || a.title.localeCompare(b.title,'de'));
  }

  function sourceLabel(event) {
    return event.scope === 'ring' ? 'NÜRBURGRING' : 'REGIONAL';
  }

  function sourceLink(event) {
    return event.source?.url || (event.scope === 'ring' ? 'https://www.nuerburgring.de/events' : 'https://www.gerolsteiner-land.de/veranstaltungen');
  }

  function heroMarkup(event,todayKey) {
    return `<article class="event-hero ${event.scope === 'local' ? 'is-local' : 'is-ring'}">
      <div class="event-hero-top">
        <div class="event-date-block"><span>${esc(timingLabel(event,todayKey))}</span><strong>${esc(event.dateLabel)}</strong></div>
        <span class="event-source-badge">${esc(sourceLabel(event))}</span>
      </div>
      <div class="event-venue">${esc(event.location)} · ${esc(event.category)}</div>
      <h3>${esc(event.title)}</h3>
      <p>${esc(event.summary)}</p>
      <div class="event-actions">
        <span>${event.scope === 'local' ? 'Lokaler Event-Radar' : 'Überregionaler Magnet'} · offiziell geprüft</span>
        <a href="${esc(sourceLink(event))}" target="_blank" rel="noopener">Quelle ↗</a>
      </div>
    </article>`;
  }

  function eventRow(event,todayKey) {
    return `<article class="event-row ${event.scope === 'local' ? 'is-local' : 'is-ring'}">
      <div class="event-row-date"><strong>${esc(event.dateLabel)}</strong><span>${esc(timingLabel(event,todayKey))}</span></div>
      <div class="event-row-copy">
        <span class="event-row-kicker">${esc(event.location)} · ${esc(event.category)} · ${esc(sourceLabel(event))}</span>
        <h4>${esc(event.title)}</h4>
        <p>${esc(event.summary)}</p>
        <a class="event-row-source" href="${esc(sourceLink(event))}" target="_blank" rel="noopener">Offizielle Quelle ↗</a>
      </div>
    </article>`;
  }

  function filterMarkup() {
    const options = [
      ['all','Alles'],['local','Regional'],['family','Familie'],['culture','Kultur'],['food','Genuss'],['ring','Nürburgring']
    ];
    return `<div class="event-filters" aria-label="Event-Kategorien">${options.map(([id,label]) => `<button type="button" data-event-filter="${id}" class="${filter === id ? 'active' : ''}">${label}</button>`).join('')}</div>`;
  }

  function renderSection(payload) {
    const todayKey = berlinDateKey();
    const upcoming = sortedUpcoming(payload,todayKey);
    if (!upcoming.length) return '';

    const hero = upcoming[0];
    const rest = expanded ? upcoming.slice(1) : upcoming.slice(1,5);
    const hiddenCount = Math.max(0,upcoming.length-5);
    const futureAll = (payload.events || []).filter(event => event.endDate >= todayKey);
    const localCount = futureAll.filter(event => event.scope === 'local').length;
    const ringCount = futureAll.filter(event => event.scope === 'ring').length;
    const checked = [...new Set((payload.sources || []).map(source => source.checkedAt).filter(Boolean))].sort().at(-1) || '';

    return `<section id="hoy-events" class="section event-section" aria-label="Kommende Veranstaltungen in der Region">
      <div class="section-head event-head">
        <div><span class="eyebrow">EVENT-RADAR</span><h2>Was passiert demnächst?</h2></div>
        ${upcoming.length > 5 ? `<button type="button" data-event-toggle>${expanded ? 'Weniger' : `Alle ${upcoming.length}`}</button>` : ''}
      </div>
      <p class="section-copy event-intro"><strong>Jetzt wirklich regional:</strong> lokale Feste, Führungen, Märkte, Familie, Genuss und Kultur neben den großen Nürburgring-Terminen.</p>
      ${filterMarkup()}
      ${heroMarkup(hero,todayKey)}
      <div class="event-list">${rest.map(event => eventRow(event,todayKey)).join('')}</div>
      ${!expanded && hiddenCount ? `<button type="button" class="event-more" data-event-toggle>+ ${hiddenCount} weitere Termine in dieser Auswahl</button>` : ''}
      <div class="event-trust"><span>${localCount} regionale · ${ringCount} Nürburgring-Termine vorausplanbar</span><span>Quellen geprüft ${esc(checked)}</span></div>
    </section>`;
  }

  async function inject() {
    const root = document.querySelector('#view');
    if (!root || !root.querySelector('.hero')) return;
    let tab = null;
    try { tab = state?.tab; } catch {}
    if (tab && tab !== 'today') return;

    const hoyNow = [...root.querySelectorAll('.section')]
      .find(section => section.querySelector('.section-head .eyebrow')?.textContent.trim() === 'HOY NOW');
    if (!hoyNow) return;

    const payload = await loadEvents();
    if (!payload || !hoyNow.isConnected) return;

    const old = root.querySelector('#hoy-events');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderSection(payload).trim();
    const section = wrapper.firstElementChild;
    if (!section) return;

    if (old) old.replaceWith(section);
    else hoyNow.insertAdjacentElement('afterend',section);
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; inject(); });
  }

  document.addEventListener('click',event => {
    const toggle = event.target.closest('[data-event-toggle]');
    if (toggle) {
      expanded = !expanded;
      inject();
      return;
    }
    const filterButton = event.target.closest('[data-event-filter]');
    if (filterButton) {
      filter = filterButton.dataset.eventFilter || 'all';
      expanded = false;
      inject();
    }
  });

  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',queue,{once:true});
  else queue();
})();
