(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const PLACES_REQUEST = /(?:^|\/)data\/places\.json(?:[?#]|$)/;
  const LAYERS = [
    'data/places-25km.json?v=0.8.0',
    'data/places-25km-more.json?v=0.8.0',
    'data/places-25km-extra.json?v=0.8.0'
  ];

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!PLACES_REQUEST.test(url)) return nativeFetch(input, init);

    const baseResponse = await nativeFetch(input, init);
    if (!baseResponse.ok) return baseResponse;

    try {
      const layerResponses = await Promise.all(
        LAYERS.map(layer => nativeFetch(layer, { cache: 'no-store' }))
      );
      if (layerResponses.some(response => !response.ok)) return baseResponse;

      const [basePlaces, ...extraLayers] = await Promise.all([
        baseResponse.clone().json(),
        ...layerResponses.map(response => response.json())
      ]);

      const ids = new Set();
      const merged = [basePlaces, ...extraLayers].flat().filter(place => {
        if (!place?.id || ids.has(place.id)) return false;
        ids.add(place.id);
        return true;
      });

      return new Response(JSON.stringify(merged), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-HOY-Region-Layer': 'stadtkyll-25km-v08'
        }
      });
    } catch (error) {
      console.warn('HOY 25-km layers unavailable; using Stadtkyll core only.', error);
      return baseResponse;
    }
  };
})();
