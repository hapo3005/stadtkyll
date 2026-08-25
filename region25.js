(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const PLACES_REQUEST = /(?:^|\/)data\/places\.json(?:[?#]|$)/;

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!PLACES_REQUEST.test(url)) return nativeFetch(input, init);

    const baseResponse = await nativeFetch(input, init);
    if (!baseResponse.ok) return baseResponse;

    try {
      const extraResponse = await nativeFetch('data/places-25km.json?v=0.6.0', { cache: 'no-store' });
      if (!extraResponse.ok) return baseResponse;

      const [basePlaces, extraPlaces] = await Promise.all([
        baseResponse.clone().json(),
        extraResponse.json()
      ]);

      const ids = new Set();
      const merged = [...basePlaces, ...extraPlaces].filter(place => {
        if (!place?.id || ids.has(place.id)) return false;
        ids.add(place.id);
        return true;
      });

      return new Response(JSON.stringify(merged), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-HOY-Region-Layer': 'stadtkyll-25km-v06'
        }
      });
    } catch (error) {
      console.warn('HOY 25-km layer unavailable; using Stadtkyll core only.', error);
      return baseResponse;
    }
  };
})();
