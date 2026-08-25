(() => {
  'use strict';

  const CC_BY_SA_40 = 'https://creativecommons.org/licenses/by-sa/4.0/';
  const CC_BY_SA_30 = 'https://creativecommons.org/licenses/by-sa/3.0/';
  const CC_BY_SA_30_DE = 'https://creativecommons.org/licenses/by-sa/3.0/de/';

  const PHOTOS = {
    stadtkyll: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Stadtkyll_%28Eifel%29%3B_Panoramablick_auf_Stadtkyll_b.jpg/1280px-Stadtkyll_%28Eifel%29%3B_Panoramablick_auf_Stadtkyll_b.jpg',
      alt: 'Panoramablick auf Stadtkyll in der Eifel',
      credit: 'Colling-architektur',
      license: 'CC BY-SA 3.0',
      licenseUrl: CC_BY_SA_30,
      provider: 'Wikimedia Commons',
      source: 'https://commons.wikimedia.org/wiki/File:Stadtkyll_(Eifel);_Panoramablick_auf_Stadtkyll_b.jpg'
    },
    wirfttal: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Stadtkyll_%28Eifel%29%3B_Stausee_Wirfttal_a.jpg/1280px-Stadtkyll_%28Eifel%29%3B_Stausee_Wirfttal_a.jpg',
      alt: 'Stausee im Wirfttal bei Stadtkyll',
      credit: 'Colling-architektur',
      license: 'CC BY-SA 3.0',
      licenseUrl: CC_BY_SA_30,
      provider: 'Wikimedia Commons',
      source: 'https://commons.wikimedia.org/wiki/File:Stadtkyll_(Eifel);_Stausee_Wirfttal_a.jpg'
    },
    kronenburg: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Dahlem%2C_Kronenburg%2C_2011-09_CN-01.JPG/1280px-Dahlem%2C_Kronenburg%2C_2011-09_CN-01.JPG',
      alt: 'Historischer Burgort Kronenburg in der Eifel',
      credit: 'Carschten',
      license: 'CC BY-SA 3.0 DE',
      licenseUrl: CC_BY_SA_30_DE,
      provider: 'Wikimedia Commons',
      source: 'https://commons.wikimedia.org/wiki/File:Dahlem,_Kronenburg,_2011-09_CN-01.JPG'
    },
    kronensee: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Kronenburger_See_001x.jpg/1280px-Kronenburger_See_001x.jpg',
      alt: 'Luftaufnahme des Kronenburger Sees',
      credit: 'Wolkenkratzer',
      license: 'CC BY-SA 4.0',
      licenseUrl: CC_BY_SA_40,
      provider: 'Wikimedia Commons',
      source: 'https://commons.wikimedia.org/wiki/File:Kronenburger_See_001x.jpg'
    },
    museum: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Eisenmuseum_und_Eisenbahnmuseum_J%C3%BCnkerath.jpg/1280px-Eisenmuseum_und_Eisenbahnmuseum_J%C3%BCnkerath.jpg',
      alt: 'Eisenmuseum und Eisenbahnmuseum Jünkerath',
      credit: 'Rosemoon',
      license: 'CC BY-SA 3.0',
      licenseUrl: CC_BY_SA_30,
      provider: 'Wikimedia Commons',
      source: 'https://commons.wikimedia.org/wiki/File:Eisenmuseum_und_Eisenbahnmuseum_J%C3%BCnkerath.jpg'
    }
  };

  const GASTRO_POINTS = [
    [/la sirena/, 50.352199, 6.526412],
    [/bistro am see/, 50.339441, 6.535642],
    [/woodstock/, 50.347183, 6.530781],
    [/pannekooche/, 50.351024, 6.528759],
    [/doppelfeld/, 50.350235, 6.528722],
    [/kebab grill deniz|\bdeniz\b/, 50.349285, 6.530441],
    [/hildes futter/, 50.351349, 6.527975],
    [/restaurant woods|landal wirfttal/, 50.338995, 6.537349]
  ];

  const streetPhotoCache = new Map();

  function normalise(value = '') {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  }

  function photoForTitle(title = '') {
    const text = normalise(title);
    if (/eisenmuseum|eisenbahnmuseum/.test(text)) return { photo: PHOTOS.museum, exact: true };
    if (/kronenburger see/.test(text)) return { photo: PHOTOS.kronensee, exact: true };
    if (/historischer burgort kronenburg/.test(text)) return { photo: PHOTOS.kronenburg, exact: true };
    if (/panorama-tour kyll|entdeckerroute/.test(text)) return { photo: PHOTOS.kronensee, exact: false };
    if (/wasserpfad|wirft|woods|bistro am see/.test(text)) return { photo: PHOTOS.wirfttal, exact: /wasserpfad/.test(text) };
    if (/sy 2/.test(text)) return { photo: PHOTOS.wirfttal, exact: false };
    return { photo: PHOTOS.stadtkyll, exact: false };
  }

  function gastroPoint(title = '') {
    const text = normalise(title);
    const found = GASTRO_POINTS.find(([pattern]) => pattern.test(text));
    return found ? { lat: found[1], lng: found[2] } : null;
  }

  function radians(value) { return value * Math.PI / 180; }

  function distanceMeters(aLat, aLng, bLat, bLng) {
    const r = 6371000;
    const dLat = radians(bLat - aLat);
    const dLng = radians(bLng - aLng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(x));
  }

  function bearingDegrees(aLat, aLng, bLat, bLng) {
    const y = Math.sin(radians(bLng - aLng)) * Math.cos(radians(bLat));
    const x = Math.cos(radians(aLat)) * Math.sin(radians(bLat)) - Math.sin(radians(aLat)) * Math.cos(radians(bLat)) * Math.cos(radians(bLng - aLng));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function angleDifference(a, b) {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  function imageUrl(item = {}) {
    const raw = item.fileurlProc || item.fileUrlProc || item.fileurl || item.fileUrl || item.fileurlLTh || item.fileUrlLTh || item.filepath || '';
    return typeof raw === 'string' ? raw.replace(/^http:\/\//, 'https://') : '';
  }

  function viewerUrl(item = {}) {
    const sequenceId = item.sequenceId || item.sequence_id || item.sequence?.id;
    const sequenceIndex = item.sequenceIndex ?? item.sequence_index ?? 0;
    return sequenceId ? `https://kartaview.org/details/${sequenceId}/${sequenceIndex}/track-info` : 'https://kartaview.org/';
  }

  function pickStreetPhoto(items, target, title) {
    const candidates = (items || []).map(item => {
      const lat = Number(item.lat ?? item.matchLat ?? item.match_lat);
      const lng = Number(item.lng ?? item.matchLng ?? item.match_lng);
      const src = imageUrl(item);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !src) return null;
      const distance = distanceMeters(lat, lng, target.lat, target.lng);
      if (distance > 140) return null;
      const heading = Number(item.heading);
      const fov = Number(item.fieldOfView ?? item.field_of_view ?? item.sequence?.fieldOfView);
      const bearing = bearingDegrees(lat, lng, target.lat, target.lng);
      const directionPenalty = Number.isFinite(heading) && fov !== 360 ? angleDifference(heading, bearing) * 0.9 : 0;
      return { item, src, score: distance + directionPenalty };
    }).filter(Boolean).sort((a, b) => a.score - b.score);

    const best = candidates[0];
    if (!best) return null;
    return {
      src: best.src,
      alt: `Straßenansicht in unmittelbarer Nähe von ${title}`,
      credit: '© Grab and KartaView Contributors',
      license: 'CC BY-SA 4.0',
      licenseUrl: CC_BY_SA_40,
      provider: 'KartaView',
      source: viewerUrl(best.item),
      street: true
    };
  }

  async function fetchStreetPhoto(title) {
    const point = gastroPoint(title);
    if (!point) return null;
    const key = normalise(title);
    if (streetPhotoCache.has(key)) return streetPhotoCache.get(key);

    const promise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      try {
        const url = new URL('https://api.openstreetcam.org/2.0/photo/');
        url.searchParams.set('lat', point.lat);
        url.searchParams.set('lng', point.lng);
        url.searchParams.set('radius', '120');
        url.searchParams.set('zoomLevel', '18');
        url.searchParams.set('join', 'sequence');
        url.searchParams.set('orderBy', 'id');
        url.searchParams.set('orderDirection', 'desc');
        const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) return null;
        const payload = await response.json();
        const items = payload?.result?.data || payload?.currentPageItems || payload?.osv?.photos || [];
        return pickStreetPhoto(items, point, title);
      } catch (_) {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();

    streetPhotoCache.set(key, promise);
    return promise;
  }

  function makeCredit(photo, compact = false) {
    const wrap = document.createElement('span');
    wrap.className = compact ? 'photo-credit compact' : 'photo-credit';
    wrap.setAttribute('aria-label', `Bildquelle ${photo.credit}, ${photo.license}, ${photo.provider || 'Quelle'}`);

    const source = document.createElement('a');
    source.href = photo.source;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = `Foto: ${photo.credit}`;
    wrap.appendChild(source);

    const license = document.createElement('a');
    license.href = photo.licenseUrl || photo.source;
    license.target = '_blank';
    license.rel = 'noopener noreferrer';
    license.textContent = ` · ${photo.license}`;
    wrap.appendChild(license);
    return wrap;
  }

  function applyPhotoToFigure(figure, photo, title, label) {
    if (!figure || !photo) return;
    const img = figure.querySelector('img');
    const overlay = figure.querySelector('.photo-overlay');
    if (!img || !overlay) return;

    img.src = photo.src;
    img.alt = photo.alt || title;
    img.onerror = null;
    overlay.replaceChildren();

    if (label) {
      const badge = document.createElement('span');
      badge.className = 'photo-context';
      badge.textContent = label;
      overlay.appendChild(badge);
    }
    overlay.appendChild(makeCredit(photo));
    figure.dataset.photoProvider = photo.provider || 'unknown';
  }

  async function upgradeGastroFigure(figure, title) {
    const street = await fetchStreetPhoto(title);
    if (!street || !figure?.isConnected) return;
    applyPhotoToFigure(figure, street, title, 'Echte Straßenansicht · nahe Betrieb');
  }

  function makeFigure(title, options = {}) {
    const { photo, exact } = photoForTitle(title);
    const figure = document.createElement('figure');
    figure.className = options.detail ? 'place-photo detail-photo' : 'place-photo';

    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = exact ? photo.alt : `${photo.alt} – regionales Kontextfoto`;
    img.loading = options.hero ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => figure.remove(), { once: true });
    figure.appendChild(img);

    const overlay = document.createElement('div');
    overlay.className = 'photo-overlay';
    if (!exact && options.contextLabel !== false) {
      const badge = document.createElement('span');
      badge.className = 'photo-context';
      badge.textContent = options.gastro ? 'Regionsmotiv · echte Ansicht wird geladen' : 'Regionsmotiv';
      overlay.appendChild(badge);
    }
    overlay.appendChild(makeCredit(photo));
    figure.appendChild(overlay);

    if (options.gastro && gastroPoint(title)) queueMicrotask(() => upgradeGastroFigure(figure, title));
    return figure;
  }

  function decorateHero(root = document) {
    const hero = root.querySelector('.hero:not([data-photo-ready])');
    if (!hero) return;
    hero.dataset.photoReady = '1';
    hero.classList.add('photo-hero');
    hero.style.setProperty('--hero-photo', `url("${PHOTOS.stadtkyll.src}")`);
    const credit = makeCredit(PHOTOS.stadtkyll, true);
    credit.classList.add('hero-photo-credit');
    hero.appendChild(credit);
  }

  function decorateCards(root = document) {
    root.querySelectorAll('.card:not([data-photo-ready])').forEach(card => {
      const heading = card.querySelector('h3');
      if (!heading) return;
      const title = heading.textContent.trim();
      const isGastro = !!card.querySelector('.kind')?.textContent?.includes('🍽️');
      card.dataset.photoReady = '1';
      card.insertBefore(makeFigure(title, { gastro: isGastro }), card.firstChild);
    });
  }

  function decorateDetail(root = document) {
    const panel = root.querySelector('.detail:not([data-photo-ready])');
    if (!panel) return;
    const heading = panel.querySelector('h2');
    if (!heading) return;
    panel.dataset.photoReady = '1';
    const title = heading.textContent.trim();
    const isGastro = !!gastroPoint(title);
    const close = panel.querySelector('.detail-close');
    const figure = makeFigure(title, { detail: true, gastro: isGastro });
    if (close?.nextSibling) panel.insertBefore(figure, close.nextSibling);
    else panel.prepend(figure);
  }

  function decoratePopups(root = document) {
    root.querySelectorAll('.leaflet-popup-content:not([data-photo-ready])').forEach(popup => {
      const text = popup.querySelector('strong, b, h3, h4')?.textContent || popup.textContent || '';
      if (!text.trim()) return;
      popup.dataset.photoReady = '1';
      const title = text.trim();
      const { photo } = photoForTitle(title);
      const wrap = document.createElement('a');
      wrap.className = 'popup-photo';
      wrap.href = photo.source;
      wrap.target = '_blank';
      wrap.rel = 'noopener noreferrer';
      const img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.alt;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => wrap.remove(), { once: true });
      wrap.appendChild(img);
      popup.prepend(wrap);

      if (gastroPoint(title)) {
        fetchStreetPhoto(title).then(street => {
          if (!street || !wrap.isConnected) return;
          img.src = street.src;
          img.alt = street.alt;
          wrap.href = street.source;
          wrap.title = `${street.credit} · ${street.license}`;
        });
      }
    });
  }

  let queued = false;
  function decorate() {
    queued = false;
    decorateHero();
    decorateCards();
    decorateDetail();
    decoratePopups();
  }

  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(decorate);
  }

  const observer = new MutationObserver(queueDecorate);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', queueDecorate, { once: true });
  } else {
    queueDecorate();
  }
})();
