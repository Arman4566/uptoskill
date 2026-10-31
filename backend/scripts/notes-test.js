// End-to-end check of Jitsi lessons + tutor notes + notes PDF, over real HTTP.  Run: npm run test:notes  (needs DATABASE_URL)
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { pool, withTx } from '../db/pool.js';
import * as ledger from '../services/ledger.js';

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (token, method, path, body) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, type, json: type.includes('json') ? await res.json() : null, buf: type.includes('json') ? null : Buffer.from(await res.arrayBuffer()) };
};
const login = async (email) => (await call(null, 'POST', '/auth/login', { email, password: 'demo1234' })).json.token;
// a real 40x30 red PNG, as a data URL
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

const riya = await login('riya@demo.test'), neha = await login('neha@demo.test'), aman = await login('aman@demo.test');
const riyaId = (await call(riya, 'GET', '/me')).json.id;
await withTx((c) => ledger.credit(c, { userId: riyaId, amount: 200, reason: 'bonus', refType: 'notes_test', refId: Date.now() % 2000000000 }));

const nehaId = (await call(neha, 'GET', '/me')).json.id;
const created = await call(riya, 'POST', '/sessions', { mentorId: nehaId, minutes: 15, title: 'Notes test lesson', problemText: 'How do I stop my useEffect looping forever?' });
assert.equal(created.status, 201, JSON.stringify(created.json));
const sid = created.json.id;

// not open yet
assert.equal((await call(riya, 'POST', `/sessions/${sid}/video-token`)).json.error, 'LESSON_NOT_OPEN');
assert.equal((await call(neha, 'POST', `/sessions/${sid}/accept`)).status, 200);

// Jitsi join: both get the SAME private room, no keys needed, tutor starts the lesson
const tj = (await call(neha, 'POST', `/sessions/${sid}/video-token`)).json;
const sj = (await call(riya, 'POST', `/sessions/${sid}/video-token`)).json;
assert.equal(tj.provider, 'jitsi'); assert.equal(tj.role, 'tutor'); assert.equal(sj.role, 'student');
assert.equal(tj.roomName, sj.roomName); assert.match(tj.roomName, /^UpToSkill-\d+-[0-9a-f]{12}$/); assert.equal(tj.domain, 'meet.jit.si');
assert.equal((await call(null, 'GET', `/sessions/${sid}`)).status, 401);
assert.equal((await call(aman, 'POST', `/sessions/${sid}/video-token`)).status, 403, 'strangers cannot join');
assert.equal((await call(riya, 'GET', `/sessions/${sid}`)).json.status, 'in_progress');

// notes: tutor only
assert.equal((await call(riya, 'PUT', `/sessions/${sid}/notes`, { body: 'x', images: [] })).json.error, 'TUTOR_ONLY');
assert.equal((await call(riya, 'GET', `/sessions/${sid}/notes`)).json.error, 'TUTOR_ONLY');
assert.equal((await call(aman, 'GET', `/sessions/${sid}/notes`)).status, 403);
assert.equal((await call(neha, 'PUT', `/sessions/${sid}/notes`, { body: 'x', images: ['data:text/html;base64,AAAA'] })).json.error, 'BAD_IMAGE');
assert.equal((await call(neha, 'PUT', `/sessions/${sid}/notes`, { body: 'x', images: Array(9).fill(PNG) })).status, 400);
// a big but valid payload (several MB) must get through the bigger notes limit
const big = 'data:image/jpeg;base64,' + 'A'.repeat(1_000_000);
assert.equal((await call(neha, 'PUT', `/sessions/${sid}/notes`, { body: 'big', images: [big, big, big, big] })).status, 200);
const text = 'Step 1: put the object in useMemo.\nStep 2: add the dependency array. Rupee sign ₹ and Hindi नमस्ते must not crash.';
assert.equal((await call(neha, 'PUT', `/sessions/${sid}/notes`, { body: text, images: [PNG, PNG] })).status, 200);
const got = (await call(neha, 'GET', `/sessions/${sid}/notes`)).json;
assert.equal(got.body, text); assert.equal(got.images.length, 2);

// PDF is not available before the lesson ends
assert.equal((await call(riya, 'GET', `/sessions/${sid}/notes.pdf`)).json.error, 'LESSON_NOT_FINISHED');
assert.equal((await call(riya, 'POST', `/sessions/${sid}/complete`)).status, 403, 'only the tutor ends it');

// end the lesson: tutor is paid and the PDF appears for the student
const before = (await call(neha, 'GET', '/me')).json;
assert.equal((await call(neha, 'POST', `/sessions/${sid}/complete`)).status, 200);
await new Promise((r) => setTimeout(r, 1500)); // the PDF is built just after the payout
const list = (await call(riya, 'GET', '/sessions')).json;
assert.equal(list.find((s) => s.id === sid).has_notes, true, 'student sees the notes flag in the list');
const pdf = await call(riya, 'GET', `/sessions/${sid}/notes.pdf`);
assert.equal(pdf.status, 200); assert.equal(pdf.type, 'application/pdf');
assert.equal(pdf.buf.subarray(0, 5).toString(), '%PDF-'); assert.ok(pdf.buf.length > 1500, 'pdf has content');
assert.equal((await call(neha, 'GET', `/sessions/${sid}/notes.pdf`)).status, 200, 'tutor can download too');
assert.equal((await call(aman, 'GET', `/sessions/${sid}/notes.pdf`)).status, 403, 'strangers cannot');
assert.equal((await call(neha, 'PUT', `/sessions/${sid}/notes`, { body: 'late', images: [] })).json.error, 'NOTES_LOCKED');
const after = (await call(neha, 'GET', '/me')).json;
assert.equal(after.balance - before.balance, 95, 'tutor is paid the 95 they set; the 5 fee goes to the site');
console.log('payout ok; pdf bytes:', pdf.buf.length);
(await import('node:fs')).writeFileSync(process.env.PDF_OUT || '/dev/null', pdf.buf);

// a lesson with no notes gives no PDF
const c2 = await call(riya, 'POST', '/sessions', { mentorId: nehaId, minutes: 15, title: 'No notes lesson', problemText: 'A question that gets no notes at all.' });
const s2 = c2.json.id;
await call(neha, 'POST', `/sessions/${s2}/accept`); await call(neha, 'POST', `/sessions/${s2}/video-token`);
assert.equal((await call(neha, 'POST', `/sessions/${s2}/complete`)).status, 200);
await new Promise((r) => setTimeout(r, 500));
assert.equal((await call(riya, 'GET', `/sessions/${s2}/notes.pdf`)).json.error, 'NO_NOTES');
assert.equal((await call(riya, 'GET', '/sessions')).json.find((s) => s.id === s2).has_notes, false);

console.log('notes test passed');
server.close(); await pool.end();
process.exit(0);
