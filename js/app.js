// app.js
// Screens, routing and button handling. Rules (rules.js) decide what's
// allowed; Store (store.js) remembers it; this file just shows it.
//
// Routes are hash-based so it works on GitHub Pages with no server:
//   #/            landing page
//   #/join        sign up
//   #/feed        open tasks
//   #/post        post a task
//   #/task/<id>   one task
//   #/me          my tasks, profile and demo tools

(function () {
  const R = window.Rules;
  const S = window.Store;
  const root = document.getElementById('root');

  // bits of screen state that don't belong in storage
  const ui = { filter: 'All', joinStep: 'details', pendingUser: null, code: null, disputing: false, error: '' };

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  // anything typed by a user goes through this before it touches innerHTML
  function esc(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const CAT_CLASS = { 'Errands': 'cat-errands', 'Study admin': 'cat-study', 'Tech help': 'cat-tech', 'Moving': 'cat-moving', 'Food runs': 'cat-food' };

  const STATUS_LABEL = {
    open: 'Open', held: 'In progress', done: 'Waiting for confirmation',
    paid: 'Paid', disputed: 'In dispute', cancelled: 'Cancelled', refunded: 'Refunded'
  };

  function initials(name) {
    return String(name || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  function firstName(user) {
    return user ? user.name.split(' ')[0] : 'Someone';
  }

  function timeAgo(ms) {
    const mins = Math.round((S.now() - ms) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours + ' h ago';
    return Math.round(hours / 24) + ' d ago';
  }

  function toast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.getElementById('toasts').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 2600);
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  // small inline icons (stroke only, so they pick up currentColor)
  const icon = {
    lock: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    back: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    feed: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/></svg>',
    plus: '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    me: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    flag: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4h12l-1.5 4L17 12H5"/></svg>',
    check: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
  };

  function tabbar(current) {
    const tab = (hash, name, svg) =>
      `<a href="${hash}" aria-label="${name}" ${current === hash ? 'aria-current="page"' : ''}>${svg}</a>`;
    return `<nav class="tabbar" aria-label="Main">${tab('#/feed', 'Tasks', icon.feed)}${tab('#/post', 'Post a task', icon.plus)}${tab('#/me', 'My tasks', icon.me)}</nav>`;
  }

  // ---------------------------------------------------------------------------
  // landing page
  // ---------------------------------------------------------------------------

  function landing() {
    const start = S.me() ? '#/feed' : '#/join';
    return `
    <header class="site-header">
      <nav class="site-nav" aria-label="Site">
        <a href="#/" class="logo">tipuni<span>.</span></a>
        <div class="site-nav-links">
          <a href="#how" data-action="scroll" data-target="how">How it works</a>
          <a href="#safety" data-action="scroll" data-target="safety">Safety</a>
          <a href="#categories" data-action="scroll" data-target="categories">Tasks</a>
          <a href="${start}" class="btn btn-dark btn-small">${S.me() ? 'Open the app' : 'Get started'}</a>
        </div>
      </nav>
    </header>
    <main>
      <section class="wrap hero">
        <div class="hero-copy">
          <p class="badge">Verified uni emails only</p>
          <h1>Post it.<br>Pick it.<br><mark>Get paid.</mark></h1>
          <p class="lead">The task marketplace for your campus. Need a hand with a move, a parcel or a dodgy laptop? Post it. Got a free afternoon? Pick one up and get paid by a fellow student.</p>
          <div class="hero-actions">
            <a href="${S.me() ? '#/post' : '#/join'}" class="btn btn-dark">Post a task</a>
            <a href="${start}" class="btn btn-yellow">Find tasks near you</a>
          </div>
        </div>
        <div class="hero-stack" aria-hidden="true">
          <div class="hero-card cat-study"><div class="row"><span class="chip-cat">Study admin</span><span class="price">£8</span></div><p>Print and bind my dissertation</p></div>
          <div class="hero-card cat-moving"><div class="row"><span class="chip-cat">Moving</span><span class="price">£30</span></div><p>Help carry boxes to halls, Saturday</p></div>
          <div class="hero-card cat-tech"><div class="row"><span class="chip-cat">Tech help</span><span class="price">£12</span></div><p>Set up my laptop for uni Wi-Fi</p></div>
          <div class="held-card"><div><p class="label">PAYMENT HELD</p><p class="text">Released when the job's done</p></div><span class="lock" style="color: var(--ink)">${icon.lock}</span></div>
        </div>
      </section>

      <section id="how" class="section-dark">
        <div class="wrap">
          <h2 class="big">Three taps.<br>That's the whole thing.</h2>
          <div class="steps">
            <div class="step cat-errands"><span class="num">01</span><div><h3>Post</h3><p>Say what you need, when, and what you'll pay. Takes about a minute.</p></div></div>
            <div class="step cat-study"><span class="num">02</span><div><h3>Pick</h3><p>Another student picks it up. You can see their ratings before they start.</p></div></div>
            <div class="step cat-moving"><span class="num">03</span><div><h3>Paid</h3><p>Money is held safely and released the moment you confirm it's done.</p></div></div>
          </div>
        </div>
      </section>

      <section id="safety" class="safety">
        <div class="wrap">
          <div class="safety-copy">
            <h2 class="big">Strangers?<br>No. Coursemates.</h2>
            <p>Everyone on TipUni signed up with a verified university email, so you're dealing with people from your uni, not strangers off the internet.</p>
          </div>
          <div class="safety-list">
            <div class="safety-item"><span class="icon cat-errands">${icon.check}</span><div><h3>Uni email only</h3><p>Sign-up needs an .ac.uk address and a code sent to it.</p></div></div>
            <div class="safety-item"><span class="icon cat-study">${icon.lock}</span><div><h3>Payment held until it's done</h3><p>You pay when someone picks your task, but they only receive it once you confirm, or automatically after 72 hours.</p></div></div>
            <div class="safety-item"><span class="icon cat-moving">★</span><div><h3>Ratings both ways</h3><p>Posters and doers rate each other after every task, so reliability shows.</p></div></div>
            <div class="safety-item"><span class="icon cat-tech">${icon.flag}</span><div><h3>Report, block, dispute</h3><p>If something goes wrong, the money stays held while it's sorted out. No essay writing or proofreading, ever.</p></div></div>
          </div>
        </div>
      </section>

      <section id="categories" class="categories">
        <div class="wrap">
          <h2 class="big">What people post</h2>
          <div class="cat-stack">
            ${[
              ['Errands', 'Collect a parcel, return a library book, queue for tickets'],
              ['Study admin', 'Printing, binding, library returns and pickups'],
              ['Tech help', 'Laptop setup, Wi-Fi, phone repairs, Excel rescues'],
              ['Moving', 'Carrying boxes, flat-pack furniture, end-of-term clear-outs'],
              ['Food runs', 'Late-night library snacks, grocery top-ups']
            ].map(([name, text]) => `<a href="${start}" class="cat-row ${CAT_CLASS[name]}"><span><strong>${name}</strong><span>${text}</span></span><span aria-hidden="true" style="font-size: 28px">→</span></a>`).join('')}
          </div>
        </div>
      </section>

      <section class="cta">
        <div class="wrap">
          <div class="cta-box">
            <h2>Your campus,<br><span>on call.</span></h2>
            <a href="${start}" class="btn btn-yellow">Join with your uni email</a>
          </div>
        </div>
      </section>
    </main>
    <footer class="site-footer">
      <div class="wrap">
        <span class="logo" style="font-size: 20px">tipuni<span>.</span></span>
        <span>A student project by Desmond Oghenebrume. Demo only: payments are simulated.</span>
      </div>
    </footer>`;
  }

  // ---------------------------------------------------------------------------
  // sign up
  // ---------------------------------------------------------------------------

  function join() {
    if (S.me()) return feedRedirect();
    const p = ui.pendingUser || {};
    const err = ui.error ? `<p class="error" role="alert">${esc(ui.error)}</p>` : '';

    if (ui.joinStep === 'code') {
      return `
      <div class="app">
        <div class="join-hero">
          <button class="back" data-action="join-back" aria-label="Back">${icon.back}</button>
          <h1>Check your<br>uni inbox.</h1>
          <p>We sent a 6-digit code to ${esc(p.email)}.</p>
        </div>
        <form class="panel" data-form="code" novalidate>
          ${err}
          <div class="field">
            <label class="label" for="code">Code</label>
            <input class="input" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" required>
          </div>
          <div class="demo-inbox">Demo inbox, since no email is really sent: your code is <strong>${ui.code}</strong></div>
          <button class="btn btn-dark btn-block" style="margin-top: 18px">Verify and continue</button>
        </form>
      </div>`;
    }

    const right = p.workRights || '';
    const seg = (value, label) => `<label><input type="radio" name="workRights" value="${value}" ${right === value ? 'checked' : ''}><span>${label}</span></label>`;
    return `
    <div class="app">
      <div class="join-hero">
        <a class="back" href="#/" aria-label="Back to the home page">${icon.back}</a>
        <h1>Join with your<br>uni email.</h1>
        <p>That's how we know you're from a uni.</p>
      </div>
      <form class="panel" data-form="join" novalidate>
        ${err}
        <div class="field">
          <label class="label" for="name">Your name</label>
          <input class="input" id="name" name="name" autocomplete="name" value="${esc(p.name || '')}" placeholder="Desmond O." required>
        </div>
        <div class="field">
          <label class="label" for="email">University email</label>
          <input class="input" id="email" name="email" type="email" autocomplete="email" value="${esc(p.email || '')}" placeholder="you@mail.bcu.ac.uk" required>
          <p class="hint" id="uni-line">Personal emails like Gmail won't work.</p>
        </div>
        <div class="field">
          <label class="label" for="dob">Date of birth</label>
          <input class="input" id="dob" name="dob" type="date" value="${esc(p.dob || '')}" required>
          <p class="hint">You need to be 18 or over.</p>
        </div>
        <fieldset class="field" style="border: none; padding: 0; margin: 0 0 18px">
          <legend class="label" style="margin-bottom: 8px">Can you take paid work in the UK?</legend>
          <div class="segmented">${seg('yes', 'Yes')}${seg('unsure', 'Not sure')}${seg('no', 'No')}</div>
          <p class="hint">Student visas usually don't allow self-employed work. You can still post tasks either way. If you're not sure, check with your university's international student advice team.</p>
        </fieldset>
        <button class="btn btn-dark btn-block">Send my code</button>
        <p class="hint" style="text-align: center; margin-top: 14px">By continuing you agree to the demo terms. Nothing here is real.</p>
      </form>
    </div>`;
  }

  // ---------------------------------------------------------------------------
  // feed
  // ---------------------------------------------------------------------------

  function feedRedirect() {
    setTimeout(() => go('#/feed'));
    return '';
  }

  function needsAccount() {
    return `<div class="app"><div class="empty" style="margin-top: 80px"><h2>Join first</h2><p>Sign up with your uni email to see and post tasks.</p><a class="btn btn-yellow" href="#/join">Join TipUni</a></div></div>`;
  }

  function taskCard(t, showStatus) {
    const poster = S.user(t.posterId);
    return `
    <a href="#/task/${esc(t.id)}" class="task-card ${CAT_CLASS[t.category]}">
      <div class="row"><span class="chip-cat">${esc(t.category)}</span><span class="price">${R.formatPrice(t.price)}</span></div>
      <h3>${esc(t.title)}</h3>
      <p class="meta">${esc(t.when)} · ${esc(t.where)} · by ${esc(firstName(poster))}</p>
      ${showStatus ? `<span class="status-pill">${STATUS_LABEL[t.status]}</span>` : ''}
    </a>`;
  }

  function feed() {
    const me = S.me();
    if (!me) return needsAccount();
    const filters = ['All', ...R.CATEGORIES];
    const open = S.tasks
      .filter(t => t.status === 'open' && t.posterId !== me.id)
      .filter(t => ui.filter === 'All' || t.category === ui.filter)
      .sort((a, b) => b.createdAt - a.createdAt);

    return `
    <div class="app">
      <div class="app-top">
        <p>${esc(me.university)} <span class="demo-tag">Demo</span></p>
        <a href="#/me" class="avatar" aria-label="My tasks">${esc(initials(me.name))}</a>
      </div>
      <h1 class="title">Tasks near you</h1>
      <div class="filters" role="group" aria-label="Filter by category">
        ${filters.map(f => `<button class="filter" data-action="filter" data-value="${esc(f)}" aria-pressed="${ui.filter === f}">${esc(f)}</button>`).join('')}
      </div>
      ${R.canDoPaidTasks(me) ? '' : '<div class="notice">You can post tasks, but picking up paid tasks is switched off because of your work-rights answer. You can change it on the My tasks screen.</div>'}
      ${open.length
        ? `<div class="stack">${open.map(t => taskCard(t, false)).join('')}</div>`
        : `<div class="empty"><h2>Nothing here right now</h2><p>New tasks appear here as people post them.</p><a class="btn btn-yellow btn-small" href="#/post">Post a task</a></div>`}
    </div>
    ${tabbar('#/feed')}`;
  }

  // ---------------------------------------------------------------------------
  // post a task
  // ---------------------------------------------------------------------------

  function post() {
    const me = S.me();
    if (!me) return needsAccount();
    const err = ui.error ? `<p class="error" role="alert">${esc(ui.error)}</p>` : '';
    const d = ui.draft || { category: 'Errands' };
    return `
    <div class="app">
      <h1 class="title">New task</h1>
      <form class="panel" data-form="post" novalidate>
        ${err}
        <div class="field">
          <label class="label" for="title">What do you need?</label>
          <input class="input" id="title" name="title" maxlength="80" value="${esc(d.title || '')}" placeholder="Carry boxes up to my flat" required>
          <p class="hint">No essay writing or proofreading. Arranging paid contract cheating is illegal in England.</p>
        </div>
        <fieldset class="field" style="border: none; padding: 0; margin: 0 0 18px">
          <legend class="label" style="margin-bottom: 8px">Category</legend>
          <div class="pills">
            ${R.CATEGORIES.map(c => `<label><input type="radio" name="category" value="${c}" ${d.category === c ? 'checked' : ''}><span class="${CAT_CLASS[c]}">${c}</span></label>`).join('')}
          </div>
        </fieldset>
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
          <div class="field"><label class="label" for="when">When</label><input class="input" id="when" name="when" value="${esc(d.when || '')}" placeholder="Sat, 2pm" required></div>
          <div class="field"><label class="label" for="where">Where</label><input class="input" id="where" name="where" value="${esc(d.where || '')}" placeholder="Jennens Court" required></div>
        </div>
        <div class="field">
          <label class="label" for="details">Details (optional)</label>
          <textarea class="input" id="details" name="details" maxlength="400" placeholder="Anything they should know">${esc(d.details || '')}</textarea>
        </div>
        <div class="field">
          <label class="label" for="price">You'll pay</label>
          <div class="price-box"><span aria-hidden="true">£</span><input id="price" name="price" inputmode="decimal" value="${esc(d.price || '')}" placeholder="10" required></div>
          <p class="hint">Minimum £5. Held safely until you confirm it's done.</p>
        </div>
        <button class="btn btn-dark btn-block">Post task</button>
      </form>
    </div>
    ${tabbar('#/post')}`;
  }

  // ---------------------------------------------------------------------------
  // task detail: what you see depends on who you are and where the task is
  // ---------------------------------------------------------------------------

  function progress(task) {
    const order = ['open', 'held', 'done', 'paid'];
    const at = order.indexOf(task.status === 'disputed' ? task.dispute.from : task.status);
    const steps = [['Posted', 0], ['Picked', 1], ['Done', 2], ['Paid', 3]];
    return `<ol class="progress" aria-label="Progress">${steps.map(([label, i]) =>
      `<li class="${i <= at ? 'done' : ''}"><span class="bar"></span>${label}</li>`).join('')}</ol>`;
  }

  function taskView(id) {
    const me = S.me();
    if (!me) return needsAccount();
    const t = S.task(id);
    if (!t) return `<div class="app"><div class="empty" style="margin-top: 80px"><h2>Task not found</h2><p>It may have been cancelled.</p><a class="btn btn-yellow btn-small" href="#/feed">Back to tasks</a></div></div>`;

    const poster = S.user(t.posterId);
    const doer = t.doerId ? S.user(t.doerId) : null;
    const isPoster = me.id === t.posterId;
    const isDoer = me.id === t.doerId;
    const other = isPoster ? doer : poster;
    const otherRating = other ? R.ratingFor(other.id, S.tasks) : null;
    const price = R.formatPrice(t.price);
    const hours = R.hoursUntilAutoRelease(t, S.now());

    let person = '';
    if (other) {
      const role = isPoster ? 'Picked your task' : (isDoer ? 'Posted this task' : 'Posted this task');
      const stars = otherRating.count ? ` · ★ ${otherRating.average} (${otherRating.count})` : ' · No ratings yet';
      person = `<div class="person"><span class="avatar avatar-lg">${esc(initials(other.name))}</span><div class="who"><p class="name">${esc(other.name)}</p><p class="sub">${role}${stars}</p></div></div>`;
    }

    // the dark "money" card explains where the money is right now
    let money = '';
    if (t.status === 'held') money = `${price} HELD|${isPoster ? `${esc(firstName(doer))} is on it. You'll be asked to confirm once it's done.` : `The money is held. You'll get it once ${esc(firstName(poster))} confirms.`}`;
    if (t.status === 'done') money = `${price} HELD|${isPoster ? `${esc(firstName(doer))} marked this done. Confirm and the money goes to ${esc(firstName(doer))} straight away. If you do nothing, it's released automatically in ${hours} hours.` : `Waiting for ${esc(firstName(poster))} to confirm. It pays out automatically in ${hours} hours if they don't.`}`;
    if (t.status === 'paid') money = `${price} ${t.autoReleased ? 'AUTO-RELEASED' : 'PAID'}|${isDoer ? 'This has been paid to you.' : `Paid to ${esc(firstName(doer))}.`}`;
    if (t.status === 'disputed') money = `${price} STILL HELD|Dispute opened: "${esc(t.dispute.reason)}". Nobody gets paid until it's sorted out.`;
    if (t.status === 'refunded') money = `${price} REFUNDED|The money went back to ${esc(firstName(poster))}.`;
    if (t.status === 'cancelled') money = `CANCELLED|${t.history.some(h => h.status === 'held') ? 'Any money held was refunded.' : 'Nothing was charged.'}`;
    const moneyCard = money ? (() => {
      const [label, text] = money.split('|');
      return `<div class="money"><span class="lock" style="color: var(--ink)">${icon.lock}</span><div><p class="label">${label}</p><p class="text">${text}</p></div></div>`;
    })() : '';

    // the buttons
    const a = [];
    const btn = (action, label, style = 'btn-yellow') => a.push(`<button class="btn ${style} btn-block" data-action="${action}" data-id="${esc(t.id)}">${label}</button>`);
    const ghost = (action, label) => a.push(`<button class="btn btn-ghost btn-block" data-action="${action}" data-id="${esc(t.id)}">${label}</button>`);

    if (t.status === 'open' && !isPoster) {
      if (R.canDoPaidTasks(me)) btn('pick', `Pick this task for ${price}`);
      else a.push('<div class="notice">Picking up paid tasks is switched off for your account because of your work-rights answer.</div>');
    }
    if (t.status === 'open' && isPoster) { a.push('<div class="notice">Waiting for someone to pick it up.</div>'); ghost('cancel', 'Cancel task'); }
    if (t.status === 'held' && isDoer) { btn('done', 'Mark as done'); ghost('withdraw', 'I can\'t do it any more'); }
    if (t.status === 'held' && isPoster) { ghost('cancel', 'Cancel and refund'); }
    if (t.status === 'done' && isPoster) btn('confirm', `Confirm and pay ${price}`);
    if (['held', 'done'].includes(t.status) && (isPoster || isDoer)) ghost('dispute-open', 'Something\'s not right: open a dispute');
    if (t.status === 'disputed') {
      a.push('<div class="notice">Demo only: in the real app someone from TipUni looks at the evidence and decides. Try either outcome:</div>');
      btn('resolve-release', 'Support decision: pay the doer', 'btn-dark');
      btn('resolve-refund', 'Support decision: refund the poster', 'btn-dark');
    }
    if (t.status === 'paid' && (isPoster || isDoer)) {
      const already = isPoster ? (t.ratings && t.ratings.ofDoer) : (t.ratings && t.ratings.ofPoster);
      if (already) a.push(`<div class="notice">You rated ${esc(firstName(other))} ${'★'.repeat(already)}</div>`);
      else a.push(`<div class="notice">How was it working with ${esc(firstName(other))}?<div class="stars" style="margin-top: 10px">${[1, 2, 3, 4, 5].map(n => `<button data-action="rate" data-id="${esc(t.id)}" data-stars="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div></div>`);
    }

    const disputeForm = ui.disputing === t.id ? `
      <form class="panel" data-form="dispute" data-id="${esc(t.id)}" novalidate>
        ${ui.error ? `<p class="error" role="alert">${esc(ui.error)}</p>` : ''}
        <div class="field"><label class="label" for="reason">What went wrong?</label><textarea class="input" id="reason" name="reason" required placeholder="The boxes were left in the hallway"></textarea><p class="hint">The money stays held while this is looked at. In the real app you'd add photos too.</p></div>
        <button class="btn btn-dark btn-block">Open dispute</button>
      </form>` : '';

    return `
    <div class="app">
      <div class="task-head ${CAT_CLASS[t.category]}">
        <div class="row">
          <a class="back" href="#/feed" aria-label="Back to tasks">${icon.back}</a>
          <span style="display: flex; align-items: center; gap: 10px"><span class="chip-cat">${esc(t.category)}</span>
          ${isPoster ? '' : `<button class="back" data-action="report" data-id="${esc(t.id)}" aria-label="Report this task">${icon.flag}</button>`}</span>
        </div>
        <h1>${esc(t.title)}</h1>
        <p class="meta">${esc(t.when)} · ${esc(t.where)} · posted ${timeAgo(t.createdAt)}</p>
        ${t.details ? `<p class="details">${esc(t.details)}</p>` : ''}
        <p class="big-price">${price}</p>
      </div>
      ${['cancelled', 'refunded'].includes(t.status) ? '' : progress(t)}
      ${person}
      ${moneyCard}
      <div class="actions">${a.join('')}</div>
      ${disputeForm}
    </div>
    ${tabbar('')}`;
  }

  // ---------------------------------------------------------------------------
  // my tasks
  // ---------------------------------------------------------------------------

  function mine() {
    const me = S.me();
    if (!me) return needsAccount();
    const posted = S.tasks.filter(t => t.posterId === me.id);
    const doing = S.tasks.filter(t => t.doerId === me.id);
    const rating = R.ratingFor(me.id, S.tasks);
    const rights = { yes: 'Can do paid tasks', unsure: 'Not sure about work rights', no: 'Posting only' };
    const section = (title, list, empty) => `
      <h2 class="list-title">${title}</h2>
      ${list.length ? `<div class="stack">${list.map(t => taskCard(t, true)).join('')}</div>` : `<div class="empty"><p style="margin: 0">${empty}</p></div>`}`;

    return `
    <div class="app">
      <h1 class="title">My tasks</h1>
      <div class="profile">
        <span class="avatar avatar-lg">${esc(initials(me.name))}</span>
        <div><p style="font-weight: 700; font-size: 17px">${esc(me.name)}</p><p class="hint">${esc(me.email)} · ${rating.count ? `★ ${rating.average} (${rating.count})` : 'No ratings yet'}</p><p class="hint">${rights[me.workRights]}</p></div>
      </div>
      ${section('Posted by you', posted, 'You haven\'t posted anything yet.')}
      ${section('You\'re doing', doing, 'Pick a task from the feed and it shows up here.')}

      <div class="demo-tools">
        <h2>Demo tools</h2>
        <p>These exist so you can see both sides of a task without a second phone.</p>
        <div class="row">
          <label class="sr-only" for="actAs">Act as</label>
          <select id="actAs" data-action="act-as">
            ${S.users.map(u => `<option value="${esc(u.id)}" ${u.id === me.id ? 'selected' : ''}>Act as ${esc(u.name)}</option>`).join('')}
          </select>
          <button class="btn btn-yellow" data-action="skip">Skip ahead 72 hours</button>
          <button class="btn btn-ghost" data-action="reset">Reset demo</button>
        </div>
      </div>
    </div>
    ${tabbar('#/me')}`;
  }

  // ---------------------------------------------------------------------------
  // rendering
  // ---------------------------------------------------------------------------

  function render() {
    // anything that's passed its 72 hours gets paid before we draw
    const auto = R.autoRelease(S.tasks, S.now());
    if (auto.released.length) {
      S.replaceTasks(auto.tasks, auto.ledger);
      toast(auto.released.length === 1 ? 'A task was paid out automatically' : `${auto.released.length} tasks were paid out automatically`);
    }

    const hash = location.hash || '#/';
    const [, page, id] = hash.split('/');
    window.Motion.cleanup();
    document.body.classList.toggle('is-landing', !page);

    let html;
    if (!page) html = landing();
    else if (page === 'join') html = join();
    else if (page === 'feed') html = feed();
    else if (page === 'post') html = post();
    else if (page === 'task') html = taskView(decodeURIComponent(id || ''));
    else if (page === 'me') html = mine();
    else html = landing();

    root.innerHTML = html;
    if (!page) window.Motion.landing();
    else if (page === 'feed' || page === 'me') window.Motion.stack('.task-card');
    else window.Motion.screen();
  }

  // ---------------------------------------------------------------------------
  // events (one listener each, so re-rendering never loses handlers)
  // ---------------------------------------------------------------------------

  function runAction(fn, okMessage) {
    const result = fn();
    if (!result.ok) { toast(result.error); return; }
    S.apply(result);
    if (okMessage) toast(okMessage);
    render();
  }

  root.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT') return;
    const me = S.me();
    const t = el.dataset.id ? S.task(el.dataset.id) : null;
    const now = S.now();

    switch (el.dataset.action) {
      case 'scroll':
        // in-page links on the landing page: scroll instead of changing the
        // hash, which the router would treat as a new page
        e.preventDefault();
        document.getElementById(el.dataset.target)?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'filter':
        ui.filter = el.dataset.value;
        render();
        break;
      case 'join-back':
        ui.joinStep = 'details'; ui.error = '';
        render();
        break;
      case 'pick':
        runAction(() => R.pick(t, me, now), `You picked it. ${R.formatPrice(t.price)} is now held.`);
        break;
      case 'done':
        runAction(() => R.markDone(t, me.id, now), 'Marked as done');
        break;
      case 'confirm':
        runAction(() => R.confirm(t, me.id, now), 'Paid. Thanks for using TipUni');
        break;
      case 'cancel':
        runAction(() => R.cancel(t, me.id, now), 'Task cancelled');
        break;
      case 'withdraw':
        runAction(() => R.withdraw(t, me.id, now), 'You backed out. The task is open again');
        break;
      case 'dispute-open':
        ui.disputing = t.id; ui.error = '';
        render();
        document.getElementById('reason')?.focus();
        break;
      case 'resolve-release':
        runAction(() => R.resolve(t, 'release', now), 'Dispute closed: doer paid');
        break;
      case 'resolve-refund':
        runAction(() => R.resolve(t, 'refund', now), 'Dispute closed: poster refunded');
        break;
      case 'rate':
        runAction(() => R.rate(t, me.id, Number(el.dataset.stars)), 'Thanks for rating');
        break;
      case 'report':
        S.report(t.id, me.id);
        toast('Reported. We\'ll take a look.');
        break;
      case 'skip':
        S.skipHours(R.AUTO_RELEASE_HOURS);
        toast('Skipped ahead 72 hours');
        render();
        break;
      case 'reset':
        S.reset();
        ui.joinStep = 'details'; ui.pendingUser = null;
        toast('Demo reset');
        go('#/');
        break;
    }
  });

  root.addEventListener('change', e => {
    if (e.target.dataset.action === 'act-as') {
      S.signIn(e.target.value);
      toast(`You're now acting as ${S.me().name}`);
      render();
    }
  });

  root.addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    const now = S.now();
    ui.error = '';

    if (form.dataset.form === 'join') {
      ui.pendingUser = data;
      const check = R.checkSignUp(data, now);
      if (!check.ok) { ui.error = check.error; render(); return; }
      ui.pendingUser.university = check.university;
      ui.code = String(Math.floor(100000 + Math.random() * 900000));
      ui.joinStep = 'code';
      render();
      document.getElementById('code')?.focus();
    }

    if (form.dataset.form === 'code') {
      if (String(data.code).trim() !== ui.code) { ui.error = 'That code doesn\'t match. Check the demo inbox below.'; render(); return; }
      const p = ui.pendingUser;
      S.addUser({ id: S.uid('u'), name: p.name.trim(), email: p.email.trim().toLowerCase(), dob: p.dob, workRights: p.workRights, university: p.university });
      ui.pendingUser = null; ui.joinStep = 'details';
      toast('Welcome to TipUni');
      go('#/feed');
    }

    if (form.dataset.form === 'post') {
      ui.draft = data;
      const task = {
        id: S.uid('t'), posterId: S.me().id, title: String(data.title).trim(), details: String(data.details || '').trim(),
        category: data.category, when: String(data.when).trim(), where: String(data.where).trim(),
        price: R.parsePrice(data.price), status: 'open', doerId: null, createdAt: now, history: [{ status: 'open', by: S.me().id, at: now }]
      };
      const check = R.checkTask(task);
      if (!check.ok) { ui.error = check.error; render(); return; }
      S.addTask(task);
      ui.draft = null;
      toast('Task posted');
      go('#/task/' + task.id);
    }

    if (form.dataset.form === 'dispute') {
      const t = S.task(form.dataset.id);
      const result = R.dispute(t, S.me().id, data.reason, now);
      if (!result.ok) { ui.error = result.error; render(); return; }
      ui.disputing = false;
      S.apply(result);
      toast('Dispute opened. The money stays held');
      render();
    }
  });

  // live hint under the email field: shows the university as you type
  root.addEventListener('input', e => {
    if (e.target.id !== 'email') return;
    const line = document.getElementById('uni-line');
    const check = R.checkUniEmail(e.target.value);
    if (check.ok) { line.className = 'ok-line'; line.innerHTML = icon.check + ' ' + esc(check.university); }
    else { line.className = 'hint'; line.textContent = 'Personal emails like Gmail won\'t work.'; }
  });

  window.addEventListener('hashchange', () => {
    ui.error = ''; ui.disputing = false;
    render();
    window.scrollTo(0, 0);
  });

  render();
})();
