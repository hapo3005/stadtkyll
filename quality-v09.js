(() => {
  'use strict';

  let activeSpecial = null;
  let placesPromise = null;
  const SPECIALS = {
    dog: { label: 'Mit Hund', icon: '🐕', tag: 'hund' },
    motorcycle: { label: 'Mit Motorrad', icon: '🏍️', tag: 'motorrad' },
    motorsport: { label: 'Motorsport', icon: '🏁', tag: 'motorsport' }
  };

  function loadPlaces() {
    if (!placesPromise) {
      placesPromise = fetch('data/places.json', { cache: 'no-store' })
        .then(response => response.ok ? response.json() : [])
        .catch(() => []);
    }
    return placesPromise;
  }

  const originalMatchesMode = window.matchesMode;
  if (typeof originalMatchesMode === 'function') {
    window.matchesMode = function matchesModeV09(place, mode) {
      if (SPECIALS[mode]) return (place.tags || []).includes(SPECIALS[mode].tag);
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

  async function enhanceCrossVertical(root = document) {
    root.querySelector('#special-cross-gastro')?.remove();
    if (!['dog', 'motorcycle'].includes(activeSpecial)) return;

    const eyebrow = root.querySelector('.head .eyebrow');
    const list = root.querySelector('.list');
    if (!eyebrow || !/HOY LIFESTYLE/i.test(eyebrow.textContent || '') || !list || typeof window.card !== 'function') return;

    const config = SPECIALS[activeSpecial];
    const places = await loadPlaces();
    if (!list.isConnected || activeSpecial !== (config.tag === 'hund' ? 'dog' : 'motorcycle')) return;

    const gastro = places
      .filter(place => place.vertical === 'gastro' && (place.tags || []).includes(config.tag))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (!gastro.length) return;

    const section = document.createElement('section');
    section.id = 'special-cross-gastro';
    section.className = 'section';
    const title = activeSpecial === 'dog' ? 'Hundefreundlich einkehren' : 'Einkehr auf der Motorradtour';
    const copy = activeSpecial === 'dog'
      ? 'Gastro, die von der Region ausdrücklich als hundefreundlich geführt wird.'
      : 'Straßennahe Stopps aus der lokalen HOY-Kuratierung – nicht als Betreiber-Zertifizierung „bikerfreundlich“ gemeint.';
    section.innerHTML = `<div class="section-head"><div><span class="eyebrow">${config.icon} ${config.label.toUpperCase()}</span><h2>${title}</h2></div><span>${gastro.length} Optionen</span></div><p class="section-copy">${copy}</p><div class="list">${gastro.map(window.card).join('')}</div>`;
    list.insertAdjacentElement('afterend', section);
  }

  async function enhanceDetail(root = document) {
    const detail = root.querySelector('.detail');
    const title = detail?.querySelector('h2')?.textContent?.trim();
    if (!detail || !title || detail.querySelector('[data-special-trust]')) return;

    const places = await loadPlaces();
    const place = places.find(item => item.name === title);
    if (!place || !detail.isConnected) return;

    const badges = [];
    if ((place.tags || []).includes('hund')) {
      badges.push('<span class="pill">🐕 Hund-Option · Quelle geprüft</span>');
    }
    if ((place.tags || []).includes('motorrad')) {
      badges.push('<span class="pill">🏍️ HOY Tourstopp</span>');
    }
    if ((place.tags || []).includes('motorsport')) {
      badges.push('<span class="pill">🏁 Motorsport</span>');
    }
    if (!badges.length) return;

    const row = document.createElement('div');
    row.dataset.specialTrust = 'true';
    row.className = 'meta-row';
    row.innerHTML = badges.join('');
    detail.querySelector('.lede')?.insertAdjacentElement('afterend', row);
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
      enhanceCrossVertical();
      enhanceDetail();
    });
  }

  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, { once: true });
  else queue();
})();
