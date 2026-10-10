import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.env.MAP_TEST_URL ?? 'http://127.0.0.1:5177';
const fixture = JSON.parse(await readFile(new URL('./jointPlan.fixture.json', import.meta.url), 'utf8'));
for (const reducedMotion of ['reduce', 'no-preference'] as const) test(`city switch preserves plan and shows Budapest transport (${reducedMotion})`, async () => {
 const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge', headless: true });
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion });
 const errors: string[] = [];
 page.on('pageerror', e => errors.push(e.message));
 try {
  await page.route('**/*', async route => {
   const url = new URL(route.request().url());
   if (url.pathname === '/api/voice/status') return route.fulfill({json:{configured:false,localOnly:true,missing:[],model:'synthetic',reasoningModel:null,reason:'Synthetic local-only test'}});
   if (url.pathname === '/api/official-stations/') return route.fulfill({json:{stations:[{id:1,name:'Synthetic Debrecen sensor',station_type:0,lat:47.53,lng:21.62,pm25:10}]}});
   if (url.pathname === '/api/plans/noise-sites') return route.fulfill({json:{stations:[]}});
   if (url.pathname === '/traffic') return route.fulfill({json:{locations:[]}});
   if (url.pathname === '/api/plans/joint') return route.fulfill({json:fixture});
   if (url.pathname === '/api/plans/coverage') return route.fulfill({json:{installed:fixture.existingMetrics,chosen:fixture.existingMetrics,areaKm2:205}});
   if (url.pathname === '/api/transit/vehicles') return route.fulfill({json:{provider:'BKK · Budapest',feedTimestamp:Math.floor(Date.now()/1000),refreshSeconds:15,vehicles:[{id:'bus-1',vehicleId:'bus-1',mode:'bus',latitude:47.4979,longitude:19.0402,freshnessAt:Math.floor(Date.now()/1000),stale:false}]}});
   if (url.pathname.startsWith('/api/')) return route.fulfill({json:{available:false}});
   if (url.origin === origin) return route.continue();
   return route.abort();
  });
  await page.goto(origin);
  assert.equal(await page.getByRole('button',{name:'Planning preferences',exact:true}).count(),0);
  await page.getByRole('button',{name:'Voice',exact:true}).click();
  assert.equal(await page.getByText('GPT-Live 1 · Azure',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Collapse voice panel'}).click();
  await page.getByRole('button',{name:'Suggest 3 together',exact:true}).click();
  await page.getByRole('group',{name:'Build the network step by step'}).getByRole('button',{name:'+ 3',exact:true}).click();
  assert.equal(await page.locator('.joint-plan-marker').count(),3);
  const chooseCity = async (city: string) => { await page.getByRole('combobox',{name:'Map city'}).click(); await page.getByRole('option',{name:city,exact:true}).click(); };
  await chooseCity('Budapest');
  await page.getByRole('region',{name:'Live transport status'}).getByText('1 recent · 0 old / unverified',{exact:true}).waitFor();
  const marker = page.locator('.live-vehicle-marker');
  await page.waitForFunction(() => {
    const marker = document.querySelector('.live-vehicle-marker')?.getBoundingClientRect();
    const map = document.querySelector('.leaflet-container')?.getBoundingClientRect();
    return !!marker && !!map && marker.x >= map.x && marker.x < map.right && marker.y >= map.y && marker.y < map.bottom;
  });
  assert.equal(await marker.count(),1);
  assert.equal(await page.getByRole('complementary',{name:'Plan your network'}).isVisible(),false);
  assert.equal(await page.getByRole('button',{name:'Environmental overview'}).count(),0);
  assert.equal(await page.locator('.joint-plan-marker').count(),0);
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await chooseCity('Debrecen');
  await page.getByRole('complementary',{name:'Plan your network'}).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.joint-plan-marker').length === 3);
  assert.equal(await page.getByRole('region',{name:'Live transport status'}).count(),0);
  await page.setViewportSize({width:390,height:844});
  await chooseCity('Budapest');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({path:`/tmp/greenmind-budapest-${reducedMotion}.png`});
  assert.deepEqual(errors,[]);
 } finally { await browser.close(); }
});
