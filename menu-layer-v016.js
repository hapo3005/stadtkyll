(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const BASE_MENU_REQUEST = /(?:^|\/)data\/menus-25km-c\.json(?:[?#]|$)/;
  const EXTRA_MENU_URL = 'data/menus-25km-d.json?v=0.16.0';

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!BASE_MENU_REQUEST.test(url)) return nativeFetch(input, init);

    const baseResponse = await nativeFetch(input, init);
    if (!baseResponse.ok) return baseResponse;

    try {
      const extraResponse = await nativeFetch(EXTRA_MENU_URL, {cache:'no-store'});
      if (!extraResponse.ok) return baseResponse;

      const [baseDoc, extraDoc] = await Promise.all([
        baseResponse.clone().json(),
        extraResponse.json()
      ]);

      const merged = {
        ...baseDoc,
        version: '0.16.0',
        menus: [...(baseDoc.menus || []), ...(extraDoc.menus || [])],
        links: [...(baseDoc.links || []), ...(extraDoc.links || [])]
      };

      return new Response(JSON.stringify(merged), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-HOY-Menu-Layer': 'stadtkyll-0.16'
        }
      });
    } catch (error) {
      console.warn('HOY 0.16 menu extension unavailable; using previous menu layer.', error);
      return baseResponse;
    }
  };
})();
