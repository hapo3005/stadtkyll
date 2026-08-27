import fs from 'node:fs';

const places = JSON.parse(fs.readFileSync('data/places.json','utf8'));
const payload = JSON.parse(fs.readFileSync('data/menus.json','utf8'));
const placeIds = new Set(places.map(place => place.id));
const errors = [];
const seenMenus = new Set();
const seenItems = new Set();

if (!Array.isArray(payload.menus) || payload.menus.length === 0) errors.push('menus must be a non-empty array');

for (const menu of payload.menus || []) {
  if (!menu.placeId) errors.push('menu missing placeId');
  if (seenMenus.has(menu.placeId)) errors.push(`duplicate menu placeId: ${menu.placeId}`);
  seenMenus.add(menu.placeId);
  if (!placeIds.has(menu.placeId)) errors.push(`menu references unknown place: ${menu.placeId}`);
  if (!menu.source?.url || !menu.source?.label || !menu.source?.checkedAt) errors.push(`menu source incomplete: ${menu.placeId}`);
  if (!Array.isArray(menu.items) || menu.items.length === 0) errors.push(`menu has no items: ${menu.placeId}`);

  for (const item of menu.items || []) {
    const key = `${menu.placeId}:${item.id}`;
    if (!item.id || !item.name || !item.category) errors.push(`menu item missing required fields: ${key}`);
    if (seenItems.has(key)) errors.push(`duplicate menu item id: ${key}`);
    seenItems.add(key);
    if (!Number.isFinite(item.price) || item.price < 0) errors.push(`invalid price: ${key}`);
    if (item.availableDays && (!Array.isArray(item.availableDays) || item.availableDays.some(day => !['mon','tue','wed','thu','fri','sat','sun'].includes(day)))) {
      errors.push(`invalid availableDays: ${key}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const itemCount = (payload.menus || []).reduce((sum,menu) => sum + menu.items.length,0);
console.log(`Validated ${payload.menus.length} menus with ${itemCount} structured items.`);
