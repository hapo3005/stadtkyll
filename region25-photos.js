(() => {
  'use strict';

  const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
  const TARGETS = [
    [/der stier burger/, 50.346680, 6.572354],
    [/mersin/, 50.344690, 6.577605],
    [/bielenhof-alm/, 50.333762, 6.639252],
    [/restaurant bei cemo/, 50.286784, 6.567938],
    [/forsthaus kasselburg/, 50.238518, 6.683960],
    [/kiyo sushi/, 50.223604, 6.656812],
    [/big papa burger/, 50.223844, 6.642763],
    [/costa verde/, 50.221808, 6.666735]
  ];
  const cache = new Map();

  const normalise = value => (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const radians = value => value * Math.PI / 180;

  function targetFor(title) {
    const text = normalise(title);
    const found = TARGETS.find(([pattern]) => pattern.test(text));
    return found ? { lat: found[1], lng: found[2] } : null;
  }

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

  function pick(items, target, title) {
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
      source: viewerUrl(best.item),
      alt: `Straßenansicht in unmittelbarer Nähe von ${title}`
    };
  }

  async function streetPhoto(title) {
    const target = targetFor(title);
    if (!target) return null;
    const key = normalise(title);
    if (cache.has(key)) return cache.get(key);

    const promise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      try {
        const url = new URL('https://api.openstreetcam.org/2.0/photo/');
        url.searchParams.set('lat', target.lat);
        url.searchParams.set('lng', target.lng);
        url.searchParams.set('radius', '120');
        url.searchParams.set('zoomLevel', '18');
        url.searchParams.set('join', 'sequence');
        url.searchParams.set('orderBy', 'id');
        url.searchParams.set('orderDirection', 'desc');
        const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) return null;
        const payload = await response.json();
        return pick(payload?.result?.data || payload?.currentPageItems || payload?.osv?.photos || [], target, title);
      } catch (_) {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();

    cache.set(key, promise);
    return promise;
  }

  function attribution(source) {
    const wrap = document.createElement('span');
    wrap.className = 'photo-credit';
    const sourceLink = document.createElement('a');
    sourceLink.href = source;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.textContent = 'Foto: © Grab and KartaView Contributors';
    const licenseLink = document.createElement('a');
    licenseLink.href = LICENSE_URL;
    licenseLink.target = '_blank';
    licenseLink.rel = 'noopener noreferrer';
    licenseLink.textContent = ' · CC BY-SA 4.0';
    wrap.append(sourceLink, licenseLink);
    return wrap;
  }

  async function upgradeFigure(figure, title) {
    if (!figure || figure.dataset.radiusPhoto === 'loading' || figure.dataset.radiusPhoto === 'ready') return;
    figure.dataset.radiusPhoto = 'loading';
    const photo = await streetPhoto(title);
    if (!photo || !figure.isConnected) {
      figure.dataset.radiusPhoto = 'fallback';
      return;
    }
    const img = figure.querySelector('img');
    const overlay = figure.querySelector('.photo-overlay');
    if (!img || !overlay) return;
    img.src = photo.src;
    img.alt = photo.alt;
    overlay.replaceChildren();
    const badge = document.createElement('span');
    badge.className = 'photo-context';
    badge.textContent = 'Echte Straßenansicht · nahe Betrieb';
    overlay.append(badge, attribution(photo.source));
    figure.dataset.radiusPhoto = 'ready';
  }

  async function upgradePopup(popup, title) {
    if (popup.dataset.radiusPhoto) return;
    popup.dataset.radiusPhoto = 'loading';
    const photo = await streetPhoto(title);
    if (!photo || !popup.isConnected) {
      popup.dataset.radiusPhoto = 'fallback';
      return;
    }
    const wrap = popup.querySelector('.popup-photo');
    const img = wrap?.querySelector('img');
    if (wrap && img) {
      wrap.href = photo.source;
      img.src = photo.src;
      img.alt = photo.alt;
      popup.dataset.radiusPhoto = 'ready';
    }
  }

  function scan(root = document) {
    root.querySelectorAll('.card').forEach(card => {
      const title = card.querySelector('h3')?.textContent?.trim();
      if (targetFor(title)) upgradeFigure(card.querySelector('.place-photo'), title);
    });
    root.querySelectorAll('.detail').forEach(detail => {
      const title = detail.querySelector('h2')?.textContent?.trim();
      if (targetFor(title)) upgradeFigure(detail.querySelector('.place-photo'), title);
    });
    root.querySelectorAll('.leaflet-popup-content').forEach(popup => {
      const title = popup.querySelector('strong, b, h3, h4')?.textContent?.trim();
      if (targetFor(title)) upgradePopup(popup, title);
    });
  }

  let queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan();
    });
  }

  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, { once: true });
  else queue();
})();
