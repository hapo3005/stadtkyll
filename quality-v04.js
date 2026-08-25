(() => {
  'use strict';

  const ROOT_CLASS = 'hoy-quality-v04';
  document.documentElement.classList.add(ROOT_CLASS);

  function classifyCards(root = document) {
    root.querySelectorAll('.section > .cards > .card').forEach((card, index) => {
      const hasPlaceKind = !!card.querySelector('.kind');
      if (hasPlaceKind) {
        card.classList.add('card-featured');
        if (index === 0 && !card.dataset.qualityLead) card.dataset.qualityLead = '1';
      } else {
        card.classList.add('card-proof');
        card.classList.remove('card-featured');
        card.querySelector('.place-photo')?.remove();
      }
    });

    root.querySelectorAll('.list > .card').forEach(card => {
      card.classList.add('card-compact');
    });

    root.querySelectorAll('.card:not([data-quality-kind])').forEach(card => {
      const kind = card.querySelector('.kind')?.textContent || '';
      if (kind.includes('🍽️')) card.classList.add('card-gastro');
      else if (kind.trim()) card.classList.add('card-lifestyle');
      else card.classList.add('card-proof');
      card.dataset.qualityKind = '1';
    });
  }

  function cleanProofCards(root = document) {
    root.querySelectorAll('.card-proof').forEach(card => {
      card.querySelector('.place-photo')?.remove();
      card.querySelector('.status')?.remove();
    });
  }

  function refinePrototypeLabels(root = document) {
    const badge = root.querySelector('.region-badge');
    if (badge && !badge.dataset.qualityLabel) {
      badge.dataset.qualityLabel = '1';
      badge.textContent = 'STADTKYLL · EIFEL';
      badge.setAttribute('aria-label', 'HOY Region Stadtkyll Eifel');
    }

    root.querySelectorAll('.photo-context').forEach(label => {
      if (label.textContent.includes('Regionsfoto · noch kein Betriebsfoto')) {
        label.textContent = 'Regionsmotiv · Betriebsfoto folgt';
      }
    });
  }

  function refineConsumerCopy(root = document) {
    root.querySelectorAll('.editorial:not([data-consumer-copy])').forEach(editorial => {
      editorial.dataset.consumerCopy = '1';
      const eyebrow = editorial.querySelector('.eyebrow');
      const title = editorial.querySelector('h2');
      const copy = editorial.querySelector('p');
      const button = editorial.querySelector('button');
      if (eyebrow) eyebrow.textContent = 'DEINE EIFEL · HEUTE';
      if (title) title.innerHTML = 'Mehr erleben.<br>Weniger suchen.';
      if (copy) copy.innerHTML = '<b>Stadtkyll ist dein Ausgangspunkt.</b> Entdecke Essen, Natur, Kronenburg, Jünkerath und das Obere Kylltal passend zu dem, was jetzt für dich funktioniert.';
      if (button) button.textContent = 'Region entdecken';
    });

    root.querySelectorAll('.head').forEach(head => {
      const eyebrow = head.querySelector('.eyebrow');
      if (eyebrow?.textContent.trim() !== 'REGION 2') return;
      eyebrow.textContent = 'STADTKYLL · OBERES KYLLTAL';
      const copy = head.querySelector('p');
      if (copy) copy.textContent = 'Stadtkyll, Kronenburg, Jünkerath und die Eifel drumherum – auf einer Karte, ohne Umwege.';
    });

    root.querySelectorAll('.map-card').forEach(card => {
      const title = card.querySelector('h2');
      if (title?.textContent.trim() !== 'Stadtkyll zuerst.') return;
      title.textContent = 'Nah dran. Viel zu entdecken.';
      const copy = card.querySelector('p');
      if (copy) copy.textContent = 'Stadtkyll ist der Mittelpunkt. Kronenburg und Jünkerath sind schon dabei – weitere Ziele im Oberen Kylltal kommen dort hinzu, wo sie für deinen Tag wirklich relevant sind.';
    });

    root.querySelectorAll('.section').forEach(section => {
      const eyebrow = section.querySelector('.section-head .eyebrow');
      if (eyebrow?.textContent.trim() === 'PROOF-METRIK') section.remove();
    });
  }

  function refineSourceNote(root = document) {
    root.querySelectorAll('.source-note:not([data-quality-copy])').forEach(note => {
      note.dataset.qualityCopy = '1';
      note.innerHTML = '<strong>Daten & Vertrauen:</strong> Öffnungszeiten und dynamische Angaben zeigen ihren Prüfstand. Live-Signale werden nur als live bezeichnet, wenn sie tatsächlich live bestätigt sind.';
    });
  }

  let scheduled = false;
  function enhance() {
    scheduled = false;
    classifyCards();
    cleanProofCards();
    refinePrototypeLabels();
    refineConsumerCopy();
    refineSourceNote();
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleEnhance, { once: true });
  } else {
    scheduleEnhance();
  }
})();
