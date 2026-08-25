(() => {
  'use strict';

  let activeSpecial = null;
  const SPECIALS = {
    dog: { label: 'Mit Hund', icon: '🐕' },
    motorcycle: { label: 'Mit Motorrad', icon: '🏍️' },
    motorsport: { label: 'Motorsport', icon: '🏁' }
  };

  const originalMatchesMode = window.matchesMode;
  if (typeof originalMatchesMode === 'function') {
    window.matchesMode = function matchesModeV09(place, mode) {
      if (mode === 'dog') return (place.tags || []).includes('hund');
      if (mode === 'motorcycle') return (place.tags || []).includes('motorrad');
      if (mode === 'motorsport') return (place.tags || []).includes('motorsport');
      return originalMatchesMode(place, mode);
    };
  }

  const originalIconFor = window.iconFor;
  if (typeof originalIconFor === 'function') {
    window.iconFor = function iconForV09(place) {
      const tags = place.tags || [];
      const category = (place.category || '').toLowerCase();
      if (tags.includes('motorsport') || category.includes('motorsport') || category.includes('kart')) return '🏁';
      if (tags.includes('motorrad') || category.includes('motorrad')) return '🏍️';
      if (category.includes('mit hund')) return '🐕';
      return originalIconFor(place);
    };
  }

  function enhanceLifestyleFilters(root = document) {
    const eyebrow = root.querySelector('.head .eyebrow');
    if (!eyebrow || !/HOY LIFESTYLE/i.test(eyebrow.textContent || '')) return;
    const line = root.querySelector('.filterline');
    if (!line) return;

    Object.entries(SPECIALS).forEach(([id, config]) => {
      if (line.querySelector(`[data-filter="${id}"]`)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.filter = id;
      button.textContent = `${config.icon} ${config.label}`;
      if (activeSpecial === id) button.classList.add('active');
      line.appendChild(button);
    });
  }

  document.addEventListener('click', event => {
    const mode = event.target.closest('[data-mode]');
    const filter = event.target.closest('[data-filter]');
    const nav = event.target.closest('[data-nav]');

    if (mode && SPECIALS[mode.dataset.mode] && typeof window.setTab === 'function') {
      activeSpecial = mode.dataset.mode;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.setTab('lifestyle', activeSpecial);
      return;
    }

    if (filter) activeSpecial = SPECIALS[filter.dataset.filter] ? filter.dataset.filter : null;
    else if (nav) activeSpecial = SPECIALS[nav.dataset.filter] ? nav.dataset.filter : null;
  }, true);

  let queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhanceLifestyleFilters();
    });
  }

  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, { once: true });
  else queue();
})();
