(() => {
  'use strict';

  const DATA_URL = 'data/events.json';
  const SOURCE_URL = 'https://www.nuerburgring.de/events';
  let eventsPromise = null;
  let expanded = false;
  let queued = false;

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
    if (days > 1 && days <= 7) return `In ${days} Tagen`;
    if (days > 7 && days <= 31) return `In ${days} Tagen`;
    return event.startDate.slice(0, 4) === todayKey.slice(0, 4) ? 'Vorausplanen' : event.startDate.slice(0, 4);
  }

  function loadEvents() {
    if (!eventsPromise) {
      eventsPromise = fetch(DATA_URL, { cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .catch(() => null);
    }
    return eventsPromise;
  }

  function heroMarkup(event, todayKey) {
    return `<article class="event-hero">
      <div class="event-hero-top">
        <div class="event-date-block"><span>${esc(timingLabel(event, todayKey))}</span><strong>${esc(event.dateLabel)}</strong></div>
        <span class="event-source-badge">OFFIZIELL</span>
      </div>
      <div class="event-venue">${esc(event.location)} · ${esc(event.category)}</div>
      <h3>${esc(event.title)}</h3>
      <p>${esc(event.summary)}</p>
      <div class="event-actions">
        <span>Event-Radar · vorausplanbar</span>
        <a href="${SOURCE_URL}" target="_blank" rel="noopener">Offizieller Kalender ↗</a>
      </div>
    </article>`;
  }

  function eventRow(event, todayKey) {
    return `<article class="event-row">
      <div class="event-row-date"><strong>${esc(event.dateLabel)}</strong><span>${esc(timingLabel(event, todayKey))}</span></div>
      <div class="event-row-copy">
        <span class="event-row-kicker">${esc(event.location)} · ${esc(event.category)}</span>
        <h4>${esc(event.title)}</h4>
        <p>${esc(event.summary)}</p>
      </div>
    </article>`;
  }

  function renderSection(payload) {
    const todayKey = berlinDateKey();
    const upcoming = (payload?.events || [])
      .filter(event => event.endDate >= todayKey)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, 'de'));

    if (!upcoming.length) return '';
    const hero = upcoming[0];
    const rest = expanded ? upcoming.slice(1) : upcoming.slice(1, 4);
    const hiddenCount = Math.max(0, upcoming.length - 4);

    return `<section id="hoy-events" class="section event-section" aria-label="Kommende Veranstaltungen in der Region">
      <div class="section-head event-head">
        <div><span class="eyebrow">EVENT-RADAR</span><h2>Demnächst in der Eifel</h2></div>
        ${upcoming.length > 4 ? `<button type="button" data-event-toggle>${expanded ? 'Weniger' : `Alle ${upcoming.length}`}</button>` : ''}
      </div>
      <p class="section-copy event-intro"><strong>Nürburgring jetzt sichtbar:</strong> große Termine werden Wochen und Monate vorher gezeigt – als Planungslayer zusätzlich zu HOY NOW.</p>
      ${heroMarkup(hero, todayKey)}
      <div class="event-list">${rest.map(event => eventRow(event, todayKey)).join('')}</div>
      ${!expanded && hiddenCount ? `<button type="button" class="event-more" data-event-toggle>+ ${hiddenCount} weitere vorausplanbare Termine</button>` : ''}
      <div class="event-trust"><span>Quelle: <a href="${esc(payload.source?.url || SOURCE_URL)}" target="_blank" rel="noopener">${esc(payload.source?.label || 'Nürburgring')}</a></span><span>geprüft ${esc(payload.source?.checkedAt || '')}</span></div>
    </section>`;
  }

  async function inject() {
    const root = document.querySelector('#view');
    if (!root || !root.querySelector('.hero')) return;

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
    else hoyNow.insertAdjacentElement('afterend', section);
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      inject();
    });
  }

  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-event-toggle]');
    if (!toggle) return;
    expanded = !expanded;
    inject();
  });

  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, { once: true });
  else queue();
})();
