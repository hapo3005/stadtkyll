(() => {
  'use strict';

  function refine25kmCopy(root = document) {
    const regionHead = [...root.querySelectorAll('.head')].find(head =>
      /STADTKYLL|OBERES KYLLTAL|REGION 2/i.test(head.querySelector('.eyebrow')?.textContent || '')
      && /Oberes Kylltal/i.test(head.querySelector('h1')?.textContent || '')
    );
    if (regionHead && !regionHead.dataset.radiusCopy) {
      regionHead.dataset.radiusCopy = '1';
      const eyebrow = regionHead.querySelector('.eyebrow');
      const copy = regionHead.querySelector('p');
      if (eyebrow) eyebrow.textContent = 'STADTKYLL · BIS 25 KM';
      if (copy) copy.textContent = 'Stadtkyll als Mittelpunkt, starke Optionen bis rund 25 km – von Kronenburg und Jünkerath bis Hillesheim, Gerolstein, Steffeln, Birgel und Blankenheim.';
    }

    root.querySelectorAll('.map-card:not([data-radius-copy])').forEach(card => {
      const title = card.querySelector('h2');
      if (!title || !/Nah dran|Stadtkyll zuerst/i.test(title.textContent)) return;
      card.dataset.radiusCopy = '1';
      title.textContent = 'Dein 25-km-Radius.';
      const eyebrow = card.querySelector('.eyebrow');
      const copy = card.querySelector('p');
      if (eyebrow) eyebrow.textContent = 'MEHR OPTIONEN · KLAR KURATIERT';
      if (copy) copy.textContent = 'Stadtkyll bleibt der Mittelpunkt. HOY ergänzt gezielt die stärksten Gastro- und Erlebnisoptionen im Radius, statt dir ein unübersichtliches Branchenverzeichnis zu zeigen.';
      card.querySelectorAll('.towns span').forEach(span => {
        if (/Gerolstein später/i.test(span.textContent)) span.remove();
      });
    });

    root.querySelectorAll('.editorial:not([data-radius-copy])').forEach(editorial => {
      editorial.dataset.radiusCopy = '1';
      const copy = editorial.querySelector('p');
      if (copy) copy.innerHTML = '<b>Stadtkyll ist dein Ausgangspunkt.</b> HOY verbindet den Ort jetzt mit starken Optionen im Umkreis von rund 25 km – damit du mehr Auswahl hast, ohne länger suchen zu müssen.';
    });
  }

  let queued = false;
  function enhance() {
    queued = false;
    refine25kmCopy();
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(enhance);
  }

  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, { once: true });
  else queue();
})();
