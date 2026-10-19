import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
const manifest=JSON.parse(await fs.readFile('dist/.vite/manifest.json','utf8'));
const eager=new Set();function visit(key){if(eager.has(key))return;eager.add(key);for(const dependency of manifest[key].imports??[])visit(dependency);}visit('index.html');
assert.ok(![...eager].some(key=>/charts|AdminPage|BookPage|ChatPage/.test(key)),'Public entry must not eagerly import portal pages or charts');
let bytes=0,gzip=0;for(const key of eager){const data=await fs.readFile('dist/'+manifest[key].file);bytes+=data.length;gzip+=gzipSync(data).length;}
assert.ok(bytes<500000,'Initial JavaScript must stay below 500 KB');
for(const page of ['AdminPage','BookPage','ChatPage','DashboardPage','ResidentFeeRecordsPage'])assert.equal(manifest[`src/app/components/${page}.tsx`]?.isDynamicEntry,true,`${page} must load on demand`);
for(const file of ['banoy-chatbot.webp','officials/brgylagasit.webp'])assert.ok((await fs.stat('dist/'+file)).size<65000,`${file} must stay compressed`);
console.log(`PASS: Initial JavaScript ${bytes} bytes (${gzip} gzip); portal pages and charts load on demand.`);
