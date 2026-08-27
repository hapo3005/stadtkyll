import fs from 'node:fs';

const placeFiles = [
  'data/places.json',
  'data/places-25km.json',
  'data/places-25km-more.json',
  'data/places-25km-extra.json',
  'data/places-25km-special.json',
  'data/places-25km-moto-dog.json',
  'data/places-25km-depth.json',
  'data/places-25km-v011.json',
  'data/places-25km-v012.json',
  'data/places-25km-v016.json',
  'data/places-25km-v018.json'
];
const menuFiles = [
  'data/menus.json',
  'data/menus-25km-a.json',
  'data/menus-25km-b.json',
  'data/menus-25km-c.json',
  'data/menus-25km-d.json',
  'data/menus-25km-e.json'
];

const readJson = file => JSON.parse(fs.readFileSync(file,'utf8'));
const places = placeFiles.flatMap(readJson);
const docs = menuFiles.map(readJson);
const placeIds = new Set(places.map(place => place.id));
const errors = [];
const seenMenus = new Set();
const seenItems = new Set();
const seenLinks = new Set();
let itemCount = 0;
let menuCount = 0;
let linkCount = 0;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function normalizeItem(raw,menu,index) {
  if (!Array.isArray(raw)) return raw;
  const [category,name,price,description='',tags='',availability='',season=''] = raw;
  return {
    id:`${menu.placeId}-${index + 1}`,
    category,name,price,description,
    tags:tags ? String(tags).split('|').filter(Boolean) : [],
    availability,season
  };
}

for (const doc of docs) {
  if (!Array.isArray(doc.menus)) errors.push('menu document missing menus array');
  for (const menu of doc.menus || []) {
    menuCount += 1;
    if (!menu.placeId) errors.push('menu missing placeId');
    if (seenMenus.has(menu.placeId)) errors.push(`duplicate menu placeId: ${menu.placeId}`);
    seenMenus.add(menu.placeId);
    if (!placeIds.has(menu.placeId)) errors.push(`menu references unknown place: ${menu.placeId}`);
    if (!menu.source?.url || !menu.source?.label || !menu.source?.checkedAt) errors.push(`menu source incomplete: ${menu.placeId}`);
    if (!Array.isArray(menu.items) || menu.items.length === 0) errors.push(`menu has no items: ${menu.placeId}`);
    if (menu.validFrom && !isoDate.test(menu.validFrom)) errors.push(`invalid validFrom: ${menu.placeId}`);
    if (menu.validTo && !isoDate.test(menu.validTo)) errors.push(`invalid validTo: ${menu.placeId}`);
    if (menu.validFrom && menu.validTo && menu.validFrom > menu.validTo) errors.push(`invalid menu validity range: ${menu.placeId}`);

    for (const [index,raw] of (menu.items || []).entries()) {
      const item = normalizeItem(raw,menu,index);
      const key = `${menu.placeId}:${item.id}`;
      itemCount += 1;
      if (!item.id || !item.name || !item.category) errors.push(`menu item missing required fields: ${key}`);
      if (seenItems.has(key)) errors.push(`duplicate menu item id: ${key}`);
      seenItems.add(key);
      if (!Number.isFinite(item.price) || item.price < 0) errors.push(`invalid price: ${key}`);
      if (item.availableDays && (!Array.isArray(item.availableDays) || item.availableDays.some(day => !['mon','tue','wed','thu','fri','sat','sun'].includes(day)))) {
        errors.push(`invalid availableDays: ${key}`);
      }
    }
  }

  for (const link of doc.links || []) {
    linkCount += 1;
    if (!link.placeId) errors.push('menu link missing placeId');
    if (seenLinks.has(link.placeId)) errors.push(`duplicate menu link placeId: ${link.placeId}`);
    seenLinks.add(link.placeId);
    if (seenMenus.has(link.placeId)) errors.push(`menu link duplicates structured menu: ${link.placeId}`);
    if (!placeIds.has(link.placeId)) errors.push(`menu link references unknown place: ${link.placeId}`);
    if (!link.source?.url || !link.source?.label || !link.source?.checkedAt) errors.push(`menu link source incomplete: ${link.placeId}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${menuCount} menus with ${itemCount} structured items and ${linkCount} original-menu links.`);
