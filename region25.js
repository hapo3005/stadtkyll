(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const PLACES_REQUEST = /(?:^|\/)data\/places\.json(?:[?#]|$)/;
  const LAYERS = [
    'data/places-25km.json?v=0.17.0',
    'data/places-25km-more.json?v=0.17.0',
    'data/places-25km-extra.json?v=0.17.0',
    'data/places-25km-special.json?v=0.17.0',
    'data/places-25km-moto-dog.json?v=0.17.0',
    'data/places-25km-depth.json?v=0.17.0',
    'data/places-25km-v011.json?v=0.17.0',
    'data/places-25km-v012.json?v=0.17.0',
    'data/places-25km-v016.json?v=0.17.0'
  ];
  const DOG_FRIENDLY_NAMES = [
    'bielenhof-alm',
    'forsthaus kasselburg',
    'restaurant woods',
    'bistro am see',
    'la sirena',
    'woodstock',
    'restaurant bei cemo',
    'kronenburger see',
    'eifel-blick hasenberg',
    'eifel-blick steffeln',
    'steffelner drees',
    'naturkundemuseum gerolstein',
    'kurpark stadtkyll',
    'gerolsteiner dolomiten',
    'erwins brauhaus',
    'birgeler hof'
  ];
  const MOTORCYCLE_STOP_NAMES = [
    'historischer burgort kronenburg',
    'kronenburger see',
    'eifel-blick hasenberg',
    'eifel-blick steffeln',
    'historische wassermuhle birgel',
    'bielenhof-alm',
    'forsthaus kasselburg',
    'vulkangarten steffeln',
    'stadtcafe gerolstein',
    'cafe doppelfeld',
    'woodstock',
    'bistro am see',
    'pizzeria mamma maria',
    'mamma maria',
    'im flecken',
    'balkan grill',
    'poseidon',
    'erwins brauhaus',
    'birgeler hof',
    'bei lonnen',
    'mausefalle',
    'zur neroburg',
    'lo stivale',
    'taverna romana',
    'ob dr bruck',
    'zwoelfender',
    'groner hof',
    'kupferschmiede',
    'el rancho'
  ];

  const normalise = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  function addDogContext(place) {
    const name = normalise(place?.name);
    if (!DOG_FRIENDLY_NAMES.some(candidate => name.includes(candidate))) return place;
    const tags = Array.from(new Set([...(place.tags || []), 'hund']));
    return {
      ...place,
      tags,
      dogFriendly: place.dogFriendly || {
        source: 'Gerolsteiner Land · Hundefreundliche Gastronomie/Ausflüge',
        sourceUrl: place.vertical === 'gastro'
          ? 'https://www.gerolsteiner-land.de/ausflugsziele/urlaub-hund/restaurants'
          : 'https://www.gerolsteiner-land.de/ausflugsziele/urlaub-hund/ausflugsziele',
        checkedAt: '2026-08-26'
      }
    };
  }

  function addMotorcycleContext(place) {
    const name = normalise(place?.name);
    if (!MOTORCYCLE_STOP_NAMES.some(candidate => name.includes(candidate))) return place;
    const tags = Array.from(new Set([...(place.tags || []), 'motorrad']));
    return {
      ...place,
      tags,
      motorcycleCuration: place.motorcycleCuration || {
        source: 'HOY lokale Kuratierung',
        checkedAt: '2026-08-26',
        note: 'Straßennaher Tourstopp; keine Betreiber-Zertifizierung als bikerfreundlich.'
      }
    };
  }

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
      }).map(addDogContext).map(addMotorcycleContext);

      return new Response(JSON.stringify(merged), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-HOY-Region-Layer': 'stadtkyll-25km-v017'
        }
      });
    } catch (error) {
      console.warn('HOY 25-km layers unavailable; using Stadtkyll core only.', error);
      return baseResponse;
    }
  };
})();
