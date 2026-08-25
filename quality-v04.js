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
