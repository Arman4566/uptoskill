// Proves the ledger is fair under concurrency. Run: npm run test:race
import assert from 'node:assert/strict';
import { pool, withTx } from '../db/pool.js';
import * as ledger from '../services/ledger.js';
import * as sessions from '../services/sessions.js';

const PARALLEL = 20;

async function makeUser(name, level, starter) {
  const email = `race_${name}_${Date.now()}@test.local`;
  return withTx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO users (name, email, password_hash, level) VALUES ($1,$2,'x',$3) RETURNING id`,
      [name, email, level]
    );
    if (starter) {
      await ledger.credit(c, { userId: rows[0].id, amount: starter, reason: 'starter', refType: 'user', refId: rows[0].id });
    }
    return rows[0].id;
  });
}

const count = async (sql, params) => (await pool.query(sql, params)).rows[0].n;
const balance = (id) => ledger.getBalance(pool, id);
const mk = (learnerId, mentorId, minutes = 45) => sessions.createRequest({
  learnerId, mentorId, minutes, title: 'Race test', problemText: 'Race test problem text',
});

await pool.query("DELETE FROM users WHERE email LIKE 'race\\_%@test.local'");
const learner = await makeUser('learner', 1, 10);
const mentor = await makeUser('mentor', 2, 0);

// Test A: 3 requests of 6 credits, learner has 10. Accept all at once -> exactly one may win.
const [s1, s2, s3] = await Promise.all([mk(learner, mentor), mk(learner, mentor), mk(learner, mentor)]);
const a = await Promise.allSettled([s1, s2, s3].map((s) => sessions.accept(s.id, mentor)));
const won = a.filter((r) => r.status === 'fulfilled');
assert.equal(won.length, 1, 'exactly one accept should succeed');
assert.equal(await balance(learner), 4, 'learner should have 10 - 6 = 4');
console.log('A ok: overspend blocked, learner balance 4');

// Test B: accept the SAME session 20x in parallel -> still one hold.
const acceptedId = won[0].value.id;
await Promise.allSettled(Array.from({ length: PARALLEL }, () => sessions.accept(acceptedId, mentor)));
assert.equal(await count("SELECT COUNT(*)::int n FROM credit_ledger WHERE reason='hold' AND ref_id=$1", [acceptedId]), 1);
assert.equal(await balance(learner), 4);
console.log('B ok: one hold row after 20 parallel accepts');

// Test C: complete the SAME session 20x in parallel -> one payout, mentor gets exactly 6.
await sessions.start(acceptedId, learner);
const c = await Promise.allSettled(Array.from({ length: PARALLEL }, () => sessions.complete(acceptedId, mentor)));
assert.ok(c.every((r) => r.status === 'fulfilled'), 'repeat completes are idempotent, not errors');
assert.equal(await count("SELECT COUNT(*)::int n FROM credit_ledger WHERE reason='payout' AND ref_id=$1", [acceptedId]), 1);
assert.equal(await balance(mentor), 6);
assert.equal(await balance(learner), 4);
console.log('C ok: one payout row after 20 parallel completes, mentor balance 6');

// Test D: cancel an accepted 2-credit session 20x in parallel -> hold released exactly once.
const s4 = await mk(learner, mentor, 15);
await sessions.accept(s4.id, mentor);
assert.equal(await balance(learner), 2);
await Promise.allSettled(Array.from({ length: PARALLEL }, () => sessions.cancel(s4.id, learner)));
assert.equal(await count("SELECT COUNT(*)::int n FROM credit_ledger WHERE reason='release' AND ref_id=$1", [s4.id]), 1);
assert.equal(await balance(learner), 4);
console.log('D ok: one release row after 20 parallel cancels, learner back to 4');

console.log('\nAll ledger race tests passed');
await pool.end();
