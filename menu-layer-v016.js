(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const BASE_MENU_REQUEST = /(?:^|\/)data\/menus-25km-c\.json(?:[?#]|$)/;
  const EXTRA_MENU_URLS = [
    'data/menus-25km-d.json?v=0.22.0',
    'data/menus-25km-e.json?v=0.22.0',
    'data/menus-25km-f.json?v=0.22.0',
    'data/menus-25km-g.json?v=0.22.0',
    'data/menus-25km-h.json?v=0.22.0'
  ];

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!BASE_MENU_REQUEST.test(url)) return nativeFetch(input, init);

    const baseResponse = await nativeFetch(input, init);
    if (!baseResponse.ok) return baseResponse;

    try {
      const extraResponses = await Promise.all(EXTRA_MENU_URLS.map(extraUrl => nativeFetch(extraUrl, {cache:'no-store'})));
      if (extraResponses.some(response => !response.ok)) return baseResponse;

      const [baseDoc, ...extraDocs] = await Promise.all([
        baseResponse.clone().json(),
        ...extraResponses.map(response => response.json())
      ]);

      const merged = {
        ...baseDoc,
        version: '0.22.0',
        menus: [...(baseDoc.menus || []), ...extraDocs.flatMap(doc => doc.menus || [])],
        links: [...(baseDoc.links || []), ...extraDocs.flatMap(doc => doc.links || [])]
      };

      return new Response(JSON.stringify(merged), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-HOY-Menu-Layer': 'stadtkyll-0.22'
        }
      });
    } catch (error) {
      console.warn('HOY 0.22 menu extension unavailable; using previous menu layer.', error);
      return baseResponse;
    }
  };
})();
