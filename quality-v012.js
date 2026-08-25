(() => {
  'use strict';

  const TIME_ZONE = 'Europe/Berlin';
  const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=50.350553&longitude=6.529506&current=temperature_2m,precipitation,rain,weather_code&timezone=Europe%2FBerlin&forecast_days=1';
  const WEATHER_SOURCE = 'https://open-meteo.com/';
  let placesPromise = null;
  let weatherPromise = null;
  let activeEvening = false;
  let queued = false;

  function loadPlaces() {
    if (!placesPromise) {
      placesPromise = fetch('data/places.json', { cache: 'no-store' })
        .then(response => response.ok ? response.json() : [])
        .catch(() => []);
    }
    return placesPromise;
  }

  function loadWeather() {
    if (!weatherPromise) {
      weatherPromise = (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        try {
          const response = await fetch(WEATHER_URL, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
          if (!response.ok) return null;
          const payload = await response.json();
          const current = payload?.current;
          if (!current) return null;
          const code = Number(current.weather_code);
          const precipitation = Number(current.precipitation || 0);
          const rain = Number(current.rain || 0);
          const wetCodes = new Set([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99]);
          return {
            temperature: Number(current.temperature_2m),
            code,
            precipitation,
            rain,
            wet: precipitation > 0.1 || rain > 0.1 || wetCodes.has(code)
          };
        } catch (_) {
          return null;
        } finally {
          clearTimeout(timer);
        }
      })();
    }
    return weatherPromise;
  }

  function berlinContext(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    const dayMap = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    return {
      dateKey: `${parts.year}-${parts.month}-${parts.day}`,
      dayIndex: dayMap[String(parts.weekday || '').slice(0,3).toLowerCase()] ?? 0,
      minutes,
      hour: Number(parts.hour),
      daypart: minutes < 360 ? 'nacht' : minutes < 660 ? 'morgen' : minutes < 840 ? 'mittag' : minutes < 1080 ? 'nachmittag' : minutes < 1380 ? 'abend' : 'nacht'
    };
  }

  function scheduleValid(place, context) {
    if (place.scheduleValidFrom && context.dateKey < place.scheduleValidFrom) return false;
    if (place.scheduleValidTo && context.dateKey > place.scheduleValidTo) return false;
    return true;
  }

  function endMinutes(range) {
    const end = String(range || '').split('-')[1];
    if (!end) return null;
    if (end === '24:00') return 1440;
    const [hours, minutes] = end.split(':').map(Number);
    return hours * 60 + minutes;
  }

  function startMinutes(range) {
    const start = String(range || '').split('-')[0];
    if (!start) return null;
    const [hours, minutes] = start.split(':').map(Number);
    return hours * 60 + minutes;
  }

  function isEveningOption(place) {
    const tags = new Set(place.tags || []);
    const category = String(place.category || '').toLowerCase();
    if (tags.has('abend') || tags.has('abendessen')) return true;
    if (tags.has('indoor') && (category.includes('kino') || category.includes('escape') || category.includes('wellness'))) return true;
    if (!place.weeklyHours) return false;
    return Object.values(place.weeklyHours).flat().some(range => (endMinutes(range) || 0) >= 1230);
  }

  const previousMatchesMode = window.matchesMode;
  if (typeof previousMatchesMode === 'function') {
    window.matchesMode = function matchesModeV012(place, mode) {
      if (mode === 'evening') return isEveningOption(place);
      return previousMatchesMode(place, mode);
    };
  }

  function nextOpenMinutes(place, context) {
    if (!place.weeklyHours || !scheduleValid(place, context)) return null;
    const keys = ['sun','mon','tue','wed','thu','fri','sat'];
    for (let offset = 0; offset < 7; offset += 1) {
      const dayIndex = (context.dayIndex + offset) % 7;
      const slots = place.weeklyHours[keys[dayIndex]] || [];
      for (const range of slots) {
        const start = startMinutes(range);
        if (start === null) continue;
        if (offset === 0 && start <= context.minutes) continue;
        return offset * 1440 + start - (offset === 0 ? context.minutes : context.minutes);
      }
    }
    return null;
  }

  function sourceAgeDays(place) {
    if (!place.source?.checkedAt) return 999;
    const checked = Date.parse(`${place.source.checkedAt}T12:00:00Z`);
    if (!Number.isFinite(checked)) return 999;
    return Math.max(0, Math.floor((Date.now() - checked) / 86400000));
  }

  function scorePlace(place, context, weather) {
    if (!scheduleValid(place, context)) return -1000;
    const tags = new Set(place.tags || []);
    const category = String(place.category || '').toLowerCase();
    const status = typeof window.openingState === 'function' ? window.openingState(place) : { code:'na' };
    let score = 0;

    score += ({ open:52, soon:30, na:12, closed:-18 })[status.code] ?? 0;
    const age = sourceAgeDays(place);
    if (age <= 1) score += 8;
    else if (age <= 7) score += 5;
    else if (age <= 30) score += 2;

    if (status.code === 'closed') {
      const next = nextOpenMinutes(place, context);
      if (next !== null) {
        if (next <= 180) score += 22;
        else if (next <= 480) score += 12;
        else if (next <= 720) score += 6;
      }
    }

    if (weather?.wet) {
      if (tags.has('regen')) score += 26;
      if (tags.has('indoor')) score += 22;
      if (tags.has('wellness')) score += 12;
      if (tags.has('draussen')) score -= 18;
    } else if (weather) {
      if (tags.has('draussen')) score += 11;
      if (tags.has('aussicht') || tags.has('natur') || tags.has('wandern')) score += 6;
    }

    if (context.daypart === 'morgen') {
      if (tags.has('fruehstueck') || category.includes('café') || category.includes('cafe')) score += 20;
      if (tags.has('wandern') || tags.has('natur')) score += 8;
    } else if (context.daypart === 'mittag') {
      if (place.vertical === 'gastro' && (tags.has('mittagessen') || tags.has('cafe'))) score += 18;
      if (place.vertical === 'lifestyle' && tags.has('familie')) score += 8;
    } else if (context.daypart === 'nachmittag') {
      if (place.vertical === 'lifestyle') score += 15;
      if (tags.has('cafe') || tags.has('kuchen')) score += 12;
      if (tags.has('familie')) score += 7;
    } else if (context.daypart === 'abend') {
      if (place.vertical === 'gastro') score += 20;
      if (isEveningOption(place)) score += 18;
      if (tags.has('indoor')) score += 8;
      if (category.includes('kino') || category.includes('escape') || tags.has('wellness')) score += 12;
    } else if (context.daypart === 'nacht') {
      if (isEveningOption(place)) score += 8;
      if (tags.has('draussen') || tags.has('wandern') || tags.has('aussicht')) score -= 34;
      if (place.vertical === 'gastro' && status.code === 'open') score += 18;
    }

    if (place.vertical === 'lifestyle' && tags.has('reservierung') && status.code === 'open') score -= 3;
    return score;
  }

  function familyKey(place) {
    const category = String(place.category || '').toLowerCase();
    if (place.vertical === 'gastro') return 'gastro';
    if (category.includes('museum') || category.includes('krimi')) return 'culture';
    if (category.includes('wellness') || category.includes('sauna')) return 'wellness';
    if ((place.tags || []).includes('wandern') || (place.tags || []).includes('natur')) return 'outdoor';
    return category.split('·')[0].trim() || 'other';
  }

  function pickDiverse(scored, limit = 5) {
    const selected = [];
    const townCounts = new Map();
    const familyCounts = new Map();
    for (const item of scored) {
      if (selected.length >= limit) break;
      const town = item.place.town || '';
      const family = familyKey(item.place);
      if ((townCounts.get(town) || 0) >= 2) continue;
      if ((familyCounts.get(family) || 0) >= 2) continue;
      selected.push(item);
      townCounts.set(town, (townCounts.get(town) || 0) + 1);
      familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    }
    if (selected.length < Math.min(limit, scored.length)) {
      for (const item of scored) {
        if (selected.length >= limit) break;
        if (!selected.includes(item)) selected.push(item);
      }
    }
    return selected;
  }

  function reasonFor(place, context, weather) {
    const tags = new Set(place.tags || []);
    const status = typeof window.openingState === 'function' ? window.openingState(place) : { code:'na' };
    if (status.code === 'open') return 'HOY Pick · jetzt offen';
    if (status.code === 'soon') return 'HOY Pick · öffnet bald';
    if (weather?.wet && (tags.has('regen') || tags.has('indoor'))) return 'HOY Pick · gut bei Regen';
    if (context.daypart === 'abend' && isEveningOption(place)) return 'HOY Pick · passt heute Abend';
    if (status.code === 'closed') {
      const next = nextOpenMinutes(place, context);
      if (next !== null && next <= 720) return 'HOY Pick · als Nächstes';
    }
    return 'HOY Pick · passend zum Tageszeitfenster';
  }

  function daypartLabel(daypart) {
    return ({ morgen:'Morgen', mittag:'Mittag', nachmittag:'Nachmittag', abend:'Abend', nacht:'Nacht' })[daypart] || 'Jetzt';
  }

  async function enhanceSmartHome(root = document) {
    const hoySection = [...root.querySelectorAll('.section')].find(section => section.querySelector('.section-head .eyebrow')?.textContent.trim() === 'HOY NOW');
    if (!hoySection || typeof window.card !== 'function') return;

    const [places, weather] = await Promise.all([loadPlaces(), loadWeather()]);
    if (!hoySection.isConnected || !places.length) return;
    const context = berlinContext();
    const scored = places
      .map(place => ({ place, score: scorePlace(place, context, weather) }))
      .filter(item => item.score > -200)
      .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name, 'de'));
    const picks = pickDiverse(scored, 5);
    if (!picks.length) return;

    const signature = `${context.dateKey}:${context.hour}:${weather?.wet ? 'wet':'dry'}:${picks.map(item => item.place.id).join(',')}`;
    if (hoySection.dataset.smartSignature === signature) return;
    hoySection.dataset.smartSignature = signature;

    const title = hoySection.querySelector('.section-head h2');
    const copy = hoySection.querySelector('.section-copy');
    const cards = hoySection.querySelector('.cards');
    if (!title || !cards) return;

    const anyImmediate = picks.some(item => ['open','soon'].includes(window.openingState?.(item.place)?.code));
    title.textContent = anyImmediate ? 'Für jetzt ausgewählt' : 'Als Nächstes passend';

    const weatherText = weather ? (weather.wet ? 'Regen/Schauer erkannt · Indoor stärker gewichtet' : 'Trocken · Draußen stärker gewichtet') : 'Wetter nicht verfügbar · Zeit & Öffnung gewichtet';
    const tempText = weather && Number.isFinite(weather.temperature) ? ` · ${Math.round(weather.temperature)} °C` : '';
    if (copy) {
      copy.innerHTML = `<strong>${daypartLabel(context.daypart)}${tempText}</strong> · ${weatherText}. HOY priorisiert Öffnungsstatus, Tageszeit, Quellenfrische und Vielfalt. <a href="${WEATHER_SOURCE}" target="_blank" rel="noopener">Wetter: Open-Meteo</a>`;
      copy.classList.add('smart-context');
    }

    cards.innerHTML = picks.map(item => window.card(item.place)).join('');
    [...cards.querySelectorAll('.card')].forEach((cardNode, index) => {
      const reason = document.createElement('span');
      reason.className = 'hoy-pick-reason';
      reason.textContent = reasonFor(picks[index].place, context, weather);
      cardNode.querySelector('.meta-row')?.insertAdjacentElement('afterbegin', reason);
    });
  }

  function enhanceEveningFilter(root = document) {
    const eyebrow = root.querySelector('.head .eyebrow');
    if (!eyebrow || !/HOY LIFESTYLE/i.test(eyebrow.textContent || '')) return;
    const line = root.querySelector('.filterline');
    if (!line || line.querySelector('[data-filter="evening"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.filter = 'evening';
    button.textContent = '🌙 Abends';
    if (activeEvening) button.classList.add('active');
    line.appendChild(button);
  }

  async function enhanceEveningGastro(root = document) {
    const existing = root.querySelector('#evening-cross-gastro');
    const eyebrow = root.querySelector('.head .eyebrow');
    const list = root.querySelector('.list');
    if (!activeEvening || !eyebrow || !/HOY LIFESTYLE/i.test(eyebrow.textContent || '') || !list || typeof window.card !== 'function') {
      existing?.remove();
      return;
    }

    const places = await loadPlaces();
    if (!list.isConnected || !activeEvening) return;
    const gastro = places
      .filter(place => place.vertical === 'gastro' && isEveningOption(place))
      .sort((a, b) => {
        const rank = { open:0, soon:1, closed:2, na:3 };
        const aCode = window.openingState?.(a)?.code || 'na';
        const bCode = window.openingState?.(b)?.code || 'na';
        return rank[aCode] - rank[bCode] || a.name.localeCompare(b.name, 'de');
      });
    const signature = gastro.map(place => place.id).join(',');
    if (existing?.dataset.signature === signature) return;

    const section = existing || document.createElement('section');
    section.id = 'evening-cross-gastro';
    section.className = 'section';
    section.dataset.signature = signature;
    section.innerHTML = `<div class="section-head"><div><span class="eyebrow">🌙 ABENDS</span><h2>Heute Abend essen</h2></div><span>${gastro.length} Optionen</span></div><p class="section-copy">Restaurants und Einkehr, deren hinterlegte Zeiten bzw. Tags für den Abend passen. Öffnung bleibt quellbasiert, nicht live bestätigt.</p><div class="list">${gastro.map(window.card).join('')}</div>`;
    if (!existing) list.insertAdjacentElement('afterend', section);
  }

  document.addEventListener('click', event => {
    const mode = event.target.closest('[data-mode]');
    const filter = event.target.closest('[data-filter]');
    const nav = event.target.closest('[data-nav]');

    if (mode?.dataset.mode === 'evening' && typeof window.setTab === 'function') {
      activeEvening = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.setTab('lifestyle', 'evening');
      return;
    }

    if (filter) activeEvening = filter.dataset.filter === 'evening';
    else if (nav || mode) activeEvening = false;
  }, true);

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhanceSmartHome();
      enhanceEveningFilter();
      enhanceEveningGastro();
    });
  }

  new MutationObserver(queue).observe(document.body, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, { once:true });
  else queue();
})();
