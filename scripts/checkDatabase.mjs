// Verifies the app can write to /history and /events (writes one test row each, reads back, deletes).
// Usage: node scripts/checkDatabase.mjs
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, get, remove, serverTimestamp, query, limitToLast } from 'firebase/database';
const app = initializeApp({ databaseURL: 'https://smart-iot-workstation-default-rtdb.firebaseio.com' });
const db = getDatabase(app);
const h = await push(ref(db, 'history'), { ts: serverTimestamp(), client_ts: Date.now(), gas_level: 1, temperature: 1, humidity: 1, water: 'DRY', _test: true });
const e = await push(ref(db, 'events'),  { ts: serverTimestamp(), type: 'TEST', smoke: 0, time: new Date().toISOString(), _test: true });
const hv = (await get(h)).val(), ev = (await get(e)).val();
console.log('history write OK, server ts =', new Date(hv.ts).toISOString());
console.log('events  write OK, server ts =', new Date(ev.ts).toISOString());
const last = await get(query(ref(db, 'events'), limitToLast(50)));
console.log('events limitToLast(50) query OK, count =', last.size);
await remove(h); await remove(e);
console.log('test records removed:', (await get(h)).exists() === false && (await get(e)).exists() === false);
process.exit(0);
