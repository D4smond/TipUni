// Run with:  node --test   (from the project folder, Node 18+)

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');

const NOW = new Date('2026-11-18T12:00:00Z').getTime();
const poster = { id: 'p', workRights: 'yes' };
const doer = { id: 'd', workRights: 'yes' };

function openTask(overrides = {}) {
  return { id: 't1', posterId: 'p', title: 'Carry boxes up to my flat', category: 'Moving', when: 'Sat', where: 'Jennens Court', price: 3000, status: 'open', history: [], ...overrides };
}

// --- sign-up ---------------------------------------------------------------

test('uni emails are accepted, including subdomains', () => {
  assert.equal(R.checkUniEmail('d.o@mail.bcu.ac.uk').university, 'Birmingham City University');
  assert.equal(R.checkUniEmail('someone@ox.ac.uk').ok, true);
});

test('personal emails are refused', () => {
  assert.equal(R.checkUniEmail('desmond@gmail.com').ok, false);
  assert.equal(R.checkUniEmail('fake@ac.uk.evil.com').ok, false);
});

test('age is worked out properly around birthdays', () => {
  assert.equal(R.ageOn('2008-11-18', NOW), 18);
  assert.equal(R.ageOn('2008-11-19', NOW), 17);
});

test('under-18s cannot sign up', () => {
  const r = R.checkSignUp({ name: 'Sam', email: 'sam@bcu.ac.uk', dob: '2009-01-01', workRights: 'yes' }, NOW);
  assert.equal(r.ok, false);
});

test('students without work rights can post but not do paid tasks', () => {
  assert.equal(R.canDoPaidTasks({ workRights: 'no' }), false);
  assert.equal(R.canDoPaidTasks({ workRights: 'unsure' }), false);
  assert.equal(R.canDoPaidTasks({ workRights: 'yes' }), true);
});

// --- posting ---------------------------------------------------------------

test('essay writing and proofreading are blocked', () => {
  for (const title of ['Proofread my essay', 'Write my 2000 word assignment', 'Essay needs editing by Friday', 'Do my coursework']) {
    assert.equal(R.checkTask({ ...openTask(), title }).ok, false, title);
  }
});

test('printing a dissertation is allowed', () => {
  assert.equal(R.checkTask({ ...openTask(), category: 'Study admin', title: 'Print and bind my dissertation' }).ok, true);
});

test('age-restricted and medicine errands are blocked', () => {
  assert.equal(R.checkTask({ ...openTask(), category: 'Errands', title: 'Buy me a crate of beer' }).ok, false);
  assert.equal(R.checkTask({ ...openTask(), category: 'Errands', title: 'Pick up my prescription' }).ok, false);
});

test('price limits are enforced', () => {
  assert.equal(R.checkTask({ ...openTask(), price: 400 }).ok, false);
  assert.equal(R.checkTask({ ...openTask(), price: 500 }).ok, true);
  assert.equal(R.checkTask({ ...openTask(), price: 25000 }).ok, false);
});

test('prices parse from what people type', () => {
  assert.equal(R.parsePrice('£12.50'), 1250);
  assert.equal(R.parsePrice('30'), 3000);
  assert.ok(Number.isNaN(R.parsePrice('ten')));
  assert.equal(R.formatPrice(1250), '£12.50');
  assert.equal(R.formatPrice(3000), '£30');
});

// --- lifecycle -------------------------------------------------------------

test('happy path: pick, done, confirm, money held then released', () => {
  let ledger = [];
  let r = R.pick(openTask(), doer, NOW);
  assert.equal(r.task.status, 'held');
  ledger = ledger.concat(r.ledger);
  assert.equal(R.heldBalance(ledger, 't1'), 3000);

  r = R.markDone(r.task, 'd', NOW);
  r = R.confirm(r.task, 'p', NOW);
  ledger = ledger.concat(r.ledger);
  assert.equal(r.task.status, 'paid');
  assert.equal(R.heldBalance(ledger, 't1'), 0);
});

test('a task cannot be picked twice', () => {
  const first = R.pick(openTask(), doer, NOW);
  const second = R.pick(first.task, { id: 'x', workRights: 'yes' }, NOW);
  assert.equal(second.ok, false);
});

test('you cannot pick your own task, or pick without work rights', () => {
  assert.equal(R.pick(openTask(), poster, NOW).ok, false);
  assert.equal(R.pick(openTask(), { id: 'v', workRights: 'no' }, NOW).ok, false);
});

test('only the doer can mark done and only the poster can confirm', () => {
  const held = R.pick(openTask(), doer, NOW).task;
  assert.equal(R.markDone(held, 'p', NOW).ok, false);
  const done = R.markDone(held, 'd', NOW).task;
  assert.equal(R.confirm(done, 'd', NOW).ok, false);
});

test('money auto-releases after 72 hours, not before', () => {
  const done = R.markDone(R.pick(openTask(), doer, NOW).task, 'd', NOW).task;
  const early = R.autoRelease([done], NOW + 71 * R.HOUR);
  assert.equal(early.tasks[0].status, 'done');
  const late = R.autoRelease([done], NOW + 72 * R.HOUR);
  assert.equal(late.tasks[0].status, 'paid');
  assert.equal(late.ledger.length, 1);
});

test('a dispute stops the auto-release', () => {
  const done = R.markDone(R.pick(openTask(), doer, NOW).task, 'd', NOW).task;
  const disputed = R.dispute(done, 'p', 'The boxes were left in the hallway', NOW).task;
  const later = R.autoRelease([disputed], NOW + 100 * R.HOUR);
  assert.equal(later.tasks[0].status, 'disputed');
});

test('disputes resolve to a release or a refund', () => {
  const held = R.pick(openTask(), doer, NOW).task;
  const disputed = R.dispute(held, 'p', 'They never turned up at all', NOW).task;
  assert.equal(R.resolve(disputed, 'refund', NOW).task.status, 'refunded');
  assert.equal(R.resolve(disputed, 'release', NOW).task.status, 'paid');
});

test('cancelling a held task refunds it, withdrawing re-lists it', () => {
  const held = R.pick(openTask(), doer, NOW).task;
  const cancelled = R.cancel(held, 'p', NOW);
  assert.equal(cancelled.task.status, 'cancelled');
  assert.equal(cancelled.ledger[0].type, 'refund');

  const withdrawn = R.withdraw(held, 'd', NOW);
  assert.equal(withdrawn.task.status, 'open');
  assert.equal(withdrawn.task.doerId, null);
});

test('inputs are never mutated', () => {
  const task = openTask();
  R.pick(task, doer, NOW);
  assert.equal(task.status, 'open');
  assert.equal(task.history.length, 0);
});

// --- ratings ---------------------------------------------------------------

test('both sides can rate once after payment', () => {
  let t = R.confirm(R.markDone(R.pick(openTask(), doer, NOW).task, 'd', NOW).task, 'p', NOW).task;
  t = R.rate(t, 'p', 5).task;
  t = R.rate(t, 'd', 4).task;
  assert.equal(R.rate(t, 'p', 1).ok, false);
  assert.deepEqual(R.ratingFor('d', [t]), { average: 5, count: 1 });
});
