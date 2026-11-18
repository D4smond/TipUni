// rules.js
// The rules of TipUni in one place: who can sign up, what can be posted,
// and how a task (and the money attached to it) moves from posted to paid.
//
// No DOM, no storage. Every function takes plain objects and returns new
// ones, so it can be tested with Node and reused when this moves to a real
// backend (the plan is Supabase + Stripe Connect).
//
// Money is always in pence (integers). £12.50 is 1250. Floats and money
// don't mix.

(function (root) {
  const HOUR = 60 * 60 * 1000;
  const AUTO_RELEASE_HOURS = 72;
  const MIN_PRICE = 500;    // £5, so nobody is asked to haul boxes for £1
  const MAX_PRICE = 20000;  // £200, anything bigger shouldn't be a student task

  const CATEGORIES = ['Errands', 'Study admin', 'Tech help', 'Moving', 'Food runs'];

  // A few domains so the sign-up screen can say "Birmingham City University"
  // instead of "bcu.ac.uk". Anything not listed just shows the domain.
  const UNIVERSITIES = {
    'bcu.ac.uk': 'Birmingham City University',
    'bham.ac.uk': 'University of Birmingham',
    'aston.ac.uk': 'Aston University',
    'wlv.ac.uk': 'University of Wolverhampton',
    'warwick.ac.uk': 'University of Warwick',
    'coventry.ac.uk': 'Coventry University'
  };

  // ---------------------------------------------------------------------------
  // Sign-up
  // ---------------------------------------------------------------------------

  // Returns { ok, university, error }. Accepts subdomains like
  // mail.bcu.ac.uk, because a lot of universities give students those.
  function checkUniEmail(email) {
    const clean = String(email || '').trim().toLowerCase();
    const match = clean.match(/^[^\s@]+@([a-z0-9-]+(\.[a-z0-9-]+)*\.ac\.uk)$/);
    if (!match) {
      return { ok: false, error: 'Use your university email, the one ending in .ac.uk.' };
    }
    const domain = match[1];
    // walk up the domain until something matches the list:
    // mail.bcu.ac.uk -> bcu.ac.uk
    const parts = domain.split('.');
    for (let i = 0; i < parts.length - 2; i++) {
      const candidate = parts.slice(i).join('.');
      if (UNIVERSITIES[candidate]) return { ok: true, university: UNIVERSITIES[candidate], domain: candidate };
    }
    return { ok: true, university: domain, domain };
  }

  // Age in whole years on a given date. dob is "YYYY-MM-DD".
  function ageOn(dob, now) {
    const [y, m, d] = String(dob).split('-').map(Number);
    if (!y || !m || !d) return NaN;
    const today = new Date(now);
    let age = today.getFullYear() - y;
    const birthdayPassed = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
    if (!birthdayPassed) age--;
    return age;
  }

  function checkSignUp({ name, email, dob, workRights }, now) {
    if (!name || name.trim().length < 2) return { ok: false, error: 'Add your name.' };
    const emailCheck = checkUniEmail(email);
    if (!emailCheck.ok) return emailCheck;
    const age = ageOn(dob, now);
    if (Number.isNaN(age)) return { ok: false, error: 'Add your date of birth.' };
    // payments need an adult on both sides, so under-18s can't join at all
    if (age < 18) return { ok: false, error: 'You need to be 18 or over to use TipUni.' };
    if (!['yes', 'no', 'unsure'].includes(workRights)) {
      return { ok: false, error: 'Tell us whether you can take paid work in the UK.' };
    }
    return { ok: true, university: emailCheck.university };
  }

  // Posting a task is fine for anyone. Doing paid tasks isn't: Student visa
  // holders usually can't be self-employed, so "no" and "not sure" are
  // blocked until they check with their university.
  function canDoPaidTasks(user) {
    return Boolean(user) && user.workRights === 'yes';
  }

  // ---------------------------------------------------------------------------
  // Posting
  // ---------------------------------------------------------------------------

  // Contract cheating is a criminal offence to provide or arrange in England
  // (Skills and Post-16 Education Act 2022), so anything that looks like
  // "write/edit my essay" is refused. "Print my dissertation" is fine.
  const ACADEMIC_WORDS = '(essay|assignment|dissertation|coursework|thesis|report|homework|lab report)';
  const WRITING_WORDS = '(write|writing|written|proofread|proof read|proof-read|edit|editing|rewrite|paraphrase|do my|complete my|finish my)';
  const BLOCKED = [
    { pattern: new RegExp(`\\b${WRITING_WORDS}\\b[^.]*\\b${ACADEMIC_WORDS}\\b`, 'i'), reason: 'TipUni can\'t be used for writing or editing academic work.' },
    { pattern: new RegExp(`\\b${ACADEMIC_WORDS}\\b[^.]*\\b${WRITING_WORDS}\\b`, 'i'), reason: 'TipUni can\'t be used for writing or editing academic work.' },
    { pattern: /\b(sit|take) my (exam|test|quiz)\b/i, reason: 'TipUni can\'t be used for exams or tests.' },
    { pattern: /\b(alcohol|beer|wine|vodka|cigarettes?|vapes?|tobacco)\b/i, reason: 'Age-restricted items can\'t be bought for other people.' },
    { pattern: /\b(prescription|medication|meds)\b/i, reason: 'Medicines and prescriptions can\'t be collected through TipUni.' }
  ];

  function screenText(text) {
    for (const rule of BLOCKED) {
      if (rule.pattern.test(text)) return rule.reason;
    }
    return null;
  }

  // Returns { ok, error }. price is in pence.
  function checkTask({ title, details = '', category, when, where, price }) {
    const t = String(title || '').trim();
    if (t.length < 6) return { ok: false, error: 'Give the task a short title (at least 6 characters).' };
    if (t.length > 80) return { ok: false, error: 'Keep the title under 80 characters.' };
    if (!CATEGORIES.includes(category)) return { ok: false, error: 'Pick a category.' };
    if (!when) return { ok: false, error: 'Say when it needs doing.' };
    if (!where || !String(where).trim()) return { ok: false, error: 'Say where it is.' };
    if (!Number.isInteger(price)) return { ok: false, error: 'Price needs to be a number.' };
    if (price < MIN_PRICE) return { ok: false, error: 'The minimum price is £5.' };
    if (price > MAX_PRICE) return { ok: false, error: 'The maximum price is £200.' };
    const blocked = screenText(t + ' ' + details);
    if (blocked) return { ok: false, error: blocked };
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // The task lifecycle
  //
  //   open --pick--> held --markDone--> done --confirm / 72h--> paid
  //     |              |                   |
  //   cancel        withdraw/cancel     dispute --> resolved (paid or refunded)
  //
  // "held" means the poster has paid and the money is sitting with the
  // payment provider, not with the doer yet. In the real version this is a
  // Stripe charge on the platform account with the transfer made later.
  //
  // Every action returns { ok, task, ledger } or { ok: false, error }, and
  // never changes the objects passed in.
  // ---------------------------------------------------------------------------

  function step(task, changes, by, now) {
    return {
      ...task,
      ...changes,
      history: [...(task.history || []), { status: changes.status || task.status, by, at: now }]
    };
  }

  function entry(task, type, now) {
    return { taskId: task.id, type, amount: task.price, at: now };
  }

  function pick(task, doer, now) {
    if (task.status !== 'open') return { ok: false, error: 'Someone has already picked this task.' };
    if (doer.id === task.posterId) return { ok: false, error: 'You can\'t pick your own task.' };
    if (!canDoPaidTasks(doer)) return { ok: false, error: 'Your account isn\'t set up to do paid tasks.' };
    const next = step(task, { status: 'held', doerId: doer.id, heldAt: now }, doer.id, now);
    return { ok: true, task: next, ledger: [entry(task, 'hold', now)] };
  }

  function markDone(task, userId, now) {
    if (task.status !== 'held') return { ok: false, error: 'This task isn\'t in progress.' };
    if (userId !== task.doerId) return { ok: false, error: 'Only the person doing the task can mark it done.' };
    return { ok: true, task: step(task, { status: 'done', doneAt: now }, userId, now), ledger: [] };
  }

  function confirm(task, userId, now) {
    if (task.status !== 'done') return { ok: false, error: 'This task hasn\'t been marked done yet.' };
    if (userId !== task.posterId) return { ok: false, error: 'Only the poster can confirm.' };
    return { ok: true, task: step(task, { status: 'paid', paidAt: now }, userId, now), ledger: [entry(task, 'release', now)] };
  }

  // Poster can cancel an open task for free, or a held one (refund).
  function cancel(task, userId, now) {
    if (userId !== task.posterId) return { ok: false, error: 'Only the poster can cancel.' };
    if (task.status === 'open') {
      return { ok: true, task: step(task, { status: 'cancelled' }, userId, now), ledger: [] };
    }
    if (task.status === 'held') {
      return { ok: true, task: step(task, { status: 'cancelled' }, userId, now), ledger: [entry(task, 'refund', now)] };
    }
    return { ok: false, error: 'It\'s too late to cancel. Open a dispute instead.' };
  }

  // Doer backs out before finishing: money goes back, task goes back up.
  function withdraw(task, userId, now) {
    if (task.status !== 'held' || userId !== task.doerId) return { ok: false, error: 'You can only back out of a task you\'re doing.' };
    const next = step(task, { status: 'open', doerId: null, heldAt: null, withdrawnBy: [...(task.withdrawnBy || []), userId] }, userId, now);
    return { ok: true, task: next, ledger: [entry(task, 'refund', now)] };
  }

  function dispute(task, userId, reason, now) {
    if (!['held', 'done'].includes(task.status)) return { ok: false, error: 'Only tasks in progress can be disputed.' };
    if (userId !== task.posterId && userId !== task.doerId) return { ok: false, error: 'Only the two people involved can open a dispute.' };
    if (!reason || reason.trim().length < 10) return { ok: false, error: 'Say what went wrong (a sentence is enough).' };
    const next = step(task, { status: 'disputed', dispute: { by: userId, reason: reason.trim(), at: now, from: task.status } }, userId, now);
    return { ok: true, task: next, ledger: [] };
  }

  // Someone at TipUni looks at the evidence and decides. Money stays held
  // until they do.
  function resolve(task, outcome, now) {
    if (task.status !== 'disputed') return { ok: false, error: 'There\'s no open dispute.' };
    if (outcome === 'release') {
      return { ok: true, task: step(task, { status: 'paid', paidAt: now, resolution: 'released' }, 'support', now), ledger: [entry(task, 'release', now)] };
    }
    if (outcome === 'refund') {
      return { ok: true, task: step(task, { status: 'refunded', resolution: 'refunded' }, 'support', now), ledger: [entry(task, 'refund', now)] };
    }
    return { ok: false, error: 'Unknown outcome.' };
  }

  // Posters forget to confirm. After 72 hours without a dispute the money
  // goes to the doer anyway, otherwise doers wait forever.
  function autoRelease(tasks, now) {
    const released = [];
    const ledger = [];
    const updated = tasks.map(task => {
      if (task.status === 'done' && now - task.doneAt >= AUTO_RELEASE_HOURS * HOUR) {
        const next = step(task, { status: 'paid', paidAt: now, autoReleased: true }, 'system', now);
        released.push(next.id);
        ledger.push(entry(task, 'release', now));
        return next;
      }
      return task;
    });
    return { tasks: updated, released, ledger };
  }

  function hoursUntilAutoRelease(task, now) {
    if (task.status !== 'done') return null;
    return Math.max(0, Math.ceil((task.doneAt + AUTO_RELEASE_HOURS * HOUR - now) / HOUR));
  }

  // ---------------------------------------------------------------------------
  // Ratings
  // ---------------------------------------------------------------------------

  function rate(task, userId, stars) {
    if (task.status !== 'paid') return { ok: false, error: 'You can rate once the task is paid.' };
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, error: 'Pick between 1 and 5 stars.' };
    const ratings = { ...(task.ratings || {}) };
    if (userId === task.posterId) {
      if (ratings.ofDoer) return { ok: false, error: 'You\'ve already rated this.' };
      ratings.ofDoer = stars;
    } else if (userId === task.doerId) {
      if (ratings.ofPoster) return { ok: false, error: 'You\'ve already rated this.' };
      ratings.ofPoster = stars;
    } else {
      return { ok: false, error: 'Only the two people involved can rate.' };
    }
    return { ok: true, task: { ...task, ratings } };
  }

  // Average rating a user has received, across tasks as poster and as doer.
  function ratingFor(userId, tasks) {
    const scores = [];
    for (const t of tasks) {
      if (t.doerId === userId && t.ratings && t.ratings.ofDoer) scores.push(t.ratings.ofDoer);
      if (t.posterId === userId && t.ratings && t.ratings.ofPoster) scores.push(t.ratings.ofPoster);
    }
    if (scores.length === 0) return { average: null, count: 0 };
    const average = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    return { average, count: scores.length };
  }

  // Money held for a task right now, worked out from the ledger rather
  // than trusted from a stored field.
  function heldBalance(ledger, taskId) {
    return ledger
      .filter(e => e.taskId === taskId)
      .reduce((sum, e) => sum + (e.type === 'hold' ? e.amount : -e.amount), 0);
  }

  function formatPrice(pence) {
    const pounds = pence / 100;
    return '£' + (Number.isInteger(pounds) ? pounds : pounds.toFixed(2));
  }

  // "£12.50" / "12.5" / "12" -> pence, or NaN
  function parsePrice(input) {
    const clean = String(input).replace(/[£,\s]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN;
    return Math.round(parseFloat(clean) * 100);
  }

  const api = {
    CATEGORIES, MIN_PRICE, MAX_PRICE, AUTO_RELEASE_HOURS, HOUR,
    checkUniEmail, ageOn, checkSignUp, canDoPaidTasks,
    screenText, checkTask,
    pick, markDone, confirm, cancel, withdraw, dispute, resolve, autoRelease, hoursUntilAutoRelease,
    rate, ratingFor, heldBalance, formatPrice, parsePrice
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
