(() => {
  'use strict';

  const PHOTOS = {
    stadtkyll: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Stadtkyll_%28Eifel%29%3B_Panoramablick_auf_Stadtkyll_b.jpg/1280px-Stadtkyll_%28Eifel%29%3B_Panoramablick_auf_Stadtkyll_b.jpg',
      alt: 'Panoramablick auf Stadtkyll in der Eifel',
      credit: 'Colling-architektur',
      license: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Stadtkyll_(Eifel);_Panoramablick_auf_Stadtkyll_b.jpg'
    },
    wirfttal: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Stadtkyll_%28Eifel%29%3B_Stausee_Wirfttal_a.jpg/1280px-Stadtkyll_%28Eifel%29%3B_Stausee_Wirfttal_a.jpg',
      alt: 'Stausee im Wirfttal bei Stadtkyll',
      credit: 'Colling-architektur',
      license: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Stadtkyll_(Eifel);_Stausee_Wirfttal_a.jpg'
    },
    kronenburg: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Dahlem%2C_Kronenburg%2C_2011-09_CN-01.JPG/1280px-Dahlem%2C_Kronenburg%2C_2011-09_CN-01.JPG',
      alt: 'Historischer Burgort Kronenburg in der Eifel',
      credit: 'Carschten',
      license: 'CC BY-SA 3.0 DE',
      source: 'https://commons.wikimedia.org/wiki/File:Dahlem,_Kronenburg,_2011-09_CN-01.JPG'
    },
    kronensee: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Kronenburger_See_001x.jpg/1280px-Kronenburger_See_001x.jpg',
      alt: 'Luftaufnahme des Kronenburger Sees',
      credit: 'Wolkenkratzer',
      license: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:Kronenburger_See_001x.jpg'
    },
    museum: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Eisenmuseum_und_Eisenbahnmuseum_J%C3%BCnkerath.jpg/1280px-Eisenmuseum_und_Eisenbahnmuseum_J%C3%BCnkerath.jpg',
      alt: 'Eisenmuseum und Eisenbahnmuseum Jünkerath',
      credit: 'Rosemoon',
      license: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Eisenmuseum_und_Eisenbahnmuseum_J%C3%BCnkerath.jpg'
    }
  };

  function normalise(value = '') {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
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

  function makeCredit(photo, compact = false) {
    const a = document.createElement('a');
    a.className = compact ? 'photo-credit compact' : 'photo-credit';
    a.href = photo.source;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = `Foto: ${photo.credit} · ${photo.license}`;
    a.setAttribute('aria-label', `Bildquelle ${photo.credit}, ${photo.license}, Wikimedia Commons`);
    return a;
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
      badge.textContent = options.gastro ? 'Regionsfoto · noch kein Betriebsfoto' : 'Regionsmotiv';
      overlay.appendChild(badge);
    }
    overlay.appendChild(makeCredit(photo));
    figure.appendChild(overlay);
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
    const close = panel.querySelector('.detail-close');
    const figure = makeFigure(heading.textContent.trim(), { detail: true });
    if (close?.nextSibling) panel.insertBefore(figure, close.nextSibling);
    else panel.prepend(figure);
  }

  function decoratePopups(root = document) {
    root.querySelectorAll('.leaflet-popup-content:not([data-photo-ready])').forEach(popup => {
      const text = popup.querySelector('strong, b, h3, h4')?.textContent || popup.textContent || '';
      if (!text.trim()) return;
      popup.dataset.photoReady = '1';
      const { photo } = photoForTitle(text);
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
