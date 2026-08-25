import fs from 'node:fs';

const files = [
  new URL('../data/places-25km.json', import.meta.url),
  new URL('../data/places-25km-more.json', import.meta.url),
  new URL('../data/places-25km-extra.json', import.meta.url),
  new URL('../data/places-25km-special.json', import.meta.url),
  new URL('../data/places-25km-moto-dog.json', import.meta.url),
  new URL('../data/places-25km-depth.json', import.meta.url),
  new URL('../data/places-25km-v011.json', import.meta.url),
  new URL('../data/places-25km-v012.json', import.meta.url)
];
const layers = files.map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
const places = layers.flat();
const CENTER = { lat: 50.350553, lng: 6.529506 };
const MAX_KM = 25.5;
const DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
const MOTO_WINDOWS = new Set(['short','half','full']);
const timeRange = /^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$|^00:00-24:00$/;

function fail(message) {
  console.error(`25-km validation failed: ${message}`);
  process.exit(1);
}

function distanceKm(a, b) {
  const R = 6371;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

if (layers.some(layer => !Array.isArray(layer) || layer.length === 0)) fail('all 25-km data layers must be non-empty arrays');

const ids = new Set();
let maxDistance = 0;
let gastro = 0;
let lifestyle = 0;
let dog = 0;
let motorcycle = 0;
let motorsport = 0;
let wellness = 0;
let rain = 0;
let evening = 0;
let motoShort = 0;
let motoHalf = 0;
let motoFull = 0;

for (const place of places) {
  if (!place.id || ids.has(place.id)) fail(`missing or duplicate id across radius layers: ${place.id}`);
  ids.add(place.id);
  if (!['gastro','lifestyle'].includes(place.vertical)) fail(`${place.id}: invalid vertical`);
  if (!place.name || !place.category || !place.town || !place.summary) fail(`${place.id}: required consumer content missing`);
  if (!place.location || !Number.isFinite(place.location.lat) || !Number.isFinite(place.location.lng)) fail(`${place.id}: valid coordinates required`);
  if (!place.source?.label || !place.source?.url || !place.source?.type || !place.source?.checkedAt) fail(`${place.id}: provenance incomplete`);

  const km = distanceKm(CENTER, place.location);
  maxDistance = Math.max(maxDistance, km);
  if (km > MAX_KM) fail(`${place.id}: ${km.toFixed(1)} km from Stadtkyll exceeds ${MAX_KM} km guardrail`);

  if (place.weeklyHours) {
    for (const day of DAYS) {
      if (!Array.isArray(place.weeklyHours[day])) fail(`${place.id}: weeklyHours.${day} missing`);
      for (const range of place.weeklyHours[day]) {
        if (!timeRange.test(range)) fail(`${place.id}: invalid time range ${range}`);
      }
    }
    if (place.dynamicStatus !== 'source-based') fail(`${place.id}: scheduled entries must remain source-based until live verified`);
  }

  if (place.scheduleValidFrom && !/^\d{4}-\d{2}-\d{2}$/.test(place.scheduleValidFrom)) fail(`${place.id}: invalid scheduleValidFrom`);
  if (place.scheduleValidTo && !/^\d{4}-\d{2}-\d{2}$/.test(place.scheduleValidTo)) fail(`${place.id}: invalid scheduleValidTo`);
  if (place.motoWindow && !MOTO_WINDOWS.has(place.motoWindow)) fail(`${place.id}: invalid motoWindow ${place.motoWindow}`);

  const tags = new Set(place.tags || []);
  if (tags.has('hund')) dog += 1;
  if (tags.has('motorrad')) motorcycle += 1;
  if (tags.has('motorsport')) motorsport += 1;
  if (tags.has('wellness')) wellness += 1;
  if (tags.has('regen') || tags.has('indoor')) rain += 1;
  if (tags.has('abend') || tags.has('abendessen')) evening += 1;
  if (place.motoWindow === 'short') motoShort += 1;
  if (place.motoWindow === 'half') motoHalf += 1;
  if (place.motoWindow === 'full') motoFull += 1;

  if (place.vertical === 'gastro') gastro += 1;
  else lifestyle += 1;
}

console.log(`Validated ${places.length} 25-km additions across ${layers.length} layers: ${gastro} gastro, ${lifestyle} lifestyle, max ${maxDistance.toFixed(1)} km.`);
console.log(`Special-interest coverage in explicit data: ${dog} dog, ${motorcycle} motorcycle, ${motorsport} motorsport, ${wellness} wellness, ${rain} rain/indoor, ${evening} evening.`);
console.log(`Explicit motorcycle windows: ${motoShort} short, ${motoHalf} half-day, ${motoFull} full-day.`);
