(() => {
  'use strict';

  const TIME_ZONE = 'Europe/Berlin';
  let wellnessActive = false;

  function regionClock(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(date).slice(0,3).toLowerCase();
    return {
      dateKey: `${parts.year}-${parts.month}-${parts.day}`,
      dayKey: weekday,
      minutes: Number(parts.hour) * 60 + Number(parts.minute)
    };
  }

  function toMinutes(value) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  const originalOpeningState = window.openingState;
  if (typeof originalOpeningState === 'function') {
    window.openingState = function openingStateRegional(place, date = new Date()) {
      if (!place.weeklyHours) return {code:'na', label:'Heute planbar'};
      const now = regionClock(date);
      if (place.scheduleValidFrom && now.dateKey < place.scheduleValidFrom) return {code:'closed', label:'Saisonal geschlossen'};
      if (place.scheduleValidTo && now.dateKey > place.scheduleValidTo) return {code:'closed', label:'Saisonal geschlossen'};

      const slots = place.weeklyHours[now.dayKey] || [];
      for (const slot of slots) {
        const [from, to] = slot.split('-');
        const start = toMinutes(from);
        const end = toMinutes(to);
        if (now.minutes >= start && now.minutes < end) {
          if (place.vertical === 'lifestyle' && start === 0 && end === 1440) return {code:'open', label:'Heute zugänglich'};
          return {code:'open', label:`Jetzt offen · bis ${to}`};
        }
        if (now.minutes < start) {
          const delta = start - now.minutes;
          if (delta <= 120) return {code:'soon', label:`Öffnet ${from}`};
          return {code:'closed', label:`Heute ab ${from}`};
        }
      }
      return {code:'closed', label:slots.length ? 'Heute geschlossen' : 'Heute Ruhetag'};
    };
  }

  const originalMatchesMode = window.matchesMode;
  if (typeof originalMatchesMode === 'function') {
    window.matchesMode = function matchesModeWithWellness(place, mode) {
      if (mode === 'wellness') return (place.tags || []).includes('wellness');
      return originalMatchesMode(place, mode);
    };
  }

  const originalIconFor = window.iconFor;
  if (typeof originalIconFor === 'function') {
    window.iconFor = function iconForExpanded(place) {
      const category = (place.category || '').toLowerCase();
      if (category.includes('wellness') || category.includes('sauna')) return '♨️';
      if (category.includes('höhle') || category.includes('hoehle')) return '🕳️';
      if (category.includes('mineralquelle') || category.includes('quelle')) return '⛲';
      if (category.includes('angeln')) return '🎣';
      if (category.includes('werksführung') || category.includes('werksfuehrung')) return '🏭';
      return originalIconFor(place);
    };
  }

  function enhanceLifestyleFilter(root = document) {
    const eyebrow = root.querySelector('.head .eyebrow');
    if (!eyebrow || !/HOY LIFESTYLE/i.test(eyebrow.textContent || '')) return;
    const line = root.querySelector('.filterline');
    if (!line || line.querySelector('[data-filter="wellness"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.filter = 'wellness';
    button.textContent = 'Wellness';
    if (wellnessActive) button.classList.add('active');
    line.appendChild(button);
  }

  function refreshRegionalTimestamp(root = document) {
    const label = root.querySelector('.hero-copy .eyebrow');
    if (!label) return;
    label.textContent = new Intl.DateTimeFormat('de-DE', {
      timeZone: TIME_ZONE,
      weekday: 'long', hour: '2-digit', minute: '2-digit'
    }).format(new Date());
  }

  document.addEventListener('click', event => {
    const filter = event.target.closest('[data-filter]');
    const nav = event.target.closest('[data-nav]');
    const mode = event.target.closest('[data-mode]');

    if (mode?.dataset.mode === 'wellness' && typeof window.setTab === 'function') {
      wellnessActive = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.setTab('lifestyle', 'wellness');
      return;
    }

    if (filter) wellnessActive = filter.dataset.filter === 'wellness';
    else if (nav) wellnessActive = nav.dataset.filter === 'wellness';
    else if (mode) wellnessActive = false;
  }, true);

  let queued = false;
  function queueEnhance() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhanceLifestyleFilter();
      refreshRegionalTimestamp();
    });
  }

  new MutationObserver(queueEnhance).observe(document.body, {childList:true, subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueEnhance, {once:true});
  else queueEnhance();
})();
