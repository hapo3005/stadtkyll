import fs from 'node:fs';

const files = ['data/events.json','data/events-local.json'];
const docs = files.map(file => JSON.parse(fs.readFileSync(file,'utf8')));
const errors = [];
const ids = new Set();
let total = 0;
let local = 0;
let ring = 0;
const categories = new Set();
const locations = new Set();
const iso = /^\d{4}-\d{2}-\d{2}$/;

for (const doc of docs) {
  if (!Array.isArray(doc.events)) errors.push('event document missing events array');
  if (!doc.source?.label || !doc.source?.url || !doc.source?.checkedAt) errors.push('event document source incomplete');
  for (const event of doc.events || []) {
    total += 1;
    if (!event.id || ids.has(event.id)) errors.push(`missing or duplicate event id: ${event.id}`);
    ids.add(event.id);
    if (!event.title || !event.location || !event.category || !event.summary) errors.push(`${event.id}: required event content missing`);
    if (!iso.test(event.startDate || '') || !iso.test(event.endDate || '')) errors.push(`${event.id}: invalid event dates`);
    if (event.startDate > event.endDate) errors.push(`${event.id}: startDate after endDate`);
    if (!event.dateLabel) errors.push(`${event.id}: dateLabel missing`);
    const scope = event.scope || (event.id.startsWith('nbr-') ? 'ring' : 'local');
    if (!['local','ring'].includes(scope)) errors.push(`${event.id}: invalid scope ${scope}`);
    if (scope === 'local') {
      local += 1;
      if (!event.source?.label || !event.source?.url || !event.source?.checkedAt) errors.push(`${event.id}: local event requires explicit source`);
    } else ring += 1;
    categories.add(event.category);
    locations.add(event.location);
  }
}

if (local < 20) errors.push(`regional event coverage too low: ${local}`);
if (categories.size < 8) errors.push(`event category diversity too low: ${categories.size}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${total} events: ${local} local/regional, ${ring} Nürburgring; ${categories.size} categories across ${locations.size} locations.`);
