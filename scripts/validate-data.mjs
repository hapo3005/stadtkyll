import fs from 'node:fs';

const region = JSON.parse(fs.readFileSync('data/region.json','utf8'));
const places = JSON.parse(fs.readFileSync('data/places.json','utf8'));
const days = ['mon','tue','wed','thu','fri','sat','sun'];
const ids = new Set();

function fail(message) {
  console.error(`DATA ERROR: ${message}`);
  process.exitCode = 1;
}

if (!region.id || !region.center?.lat || !region.center?.lng) fail('region requires id and center coordinates');
if (!Array.isArray(region.cluster) || !region.cluster.includes('Stadtkyll')) fail('region cluster must include Stadtkyll');
if (!Array.isArray(places) || places.length < 1) fail('places must be a non-empty array');

for (const place of places) {
  if (!place.id) fail('place without id');
  if (ids.has(place.id)) fail(`duplicate id ${place.id}`);
  ids.add(place.id);

  if (!['gastro','lifestyle'].includes(place.vertical)) fail(`${place.id}: invalid vertical`);
  if (!place.name || !place.category || !place.town || !place.summary) fail(`${place.id}: missing core content`);
  if (!place.source?.label || !place.source?.url || !place.source?.checkedAt) fail(`${place.id}: incomplete source provenance`);

  if (place.location) {
    const {lat,lng} = place.location;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) fail(`${place.id}: invalid latitude`);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) fail(`${place.id}: invalid longitude`);
  }

  if (place.weeklyHours) {
    for (const day of days) {
      if (!Array.isArray(place.weeklyHours[day])) fail(`${place.id}: missing weeklyHours.${day}`);
      for (const slot of place.weeklyHours[day]) {
        if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(slot)) fail(`${place.id}: invalid time slot ${slot}`);
      }
    }
    if (place.dynamicStatus !== 'source-based') fail(`${place.id}: schedules must be marked source-based until live verified`);
  }

  if (place.scheduleValidFrom && Number.isNaN(Date.parse(place.scheduleValidFrom))) fail(`${place.id}: invalid scheduleValidFrom`);
  if (place.scheduleValidTo && Number.isNaN(Date.parse(place.scheduleValidTo))) fail(`${place.id}: invalid scheduleValidTo`);
}

const gastro = places.filter(p => p.vertical === 'gastro').length;
const lifestyle = places.filter(p => p.vertical === 'lifestyle').length;
const mapped = places.filter(p => p.location).length;
console.log(`Validated ${places.length} places: ${gastro} gastro, ${lifestyle} lifestyle, ${mapped} mapped.`);
