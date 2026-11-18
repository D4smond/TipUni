// store.js
// Saves everything in localStorage under one key. This stands in for the
// database until TipUni moves to Supabase: the rest of the app only talks
// to these functions, so swapping the storage later doesn't touch the UI.

(function (root) {
  const KEY = 'tipuni.v1';

  // the "people already on TipUni" for the demo, so the feed isn't empty
  const SEED_USERS = [
    { id: 'u_amara', name: 'Amara K.', email: 'amara.k@mail.bcu.ac.uk', university: 'Birmingham City University', workRights: 'yes', dob: '2003-05-14' },
    { id: 'u_ben', name: 'Ben O.', email: 'ben.o@mail.bcu.ac.uk', university: 'Birmingham City University', workRights: 'yes', dob: '2004-09-02' },
    { id: 'u_chloe', name: 'Chloe M.', email: 'chloe.m@mail.bcu.ac.uk', university: 'Birmingham City University', workRights: 'unsure', dob: '2005-01-20' }
  ];

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function blank() {
    return { users: SEED_USERS, tasks: seedTasks(Date.now()), ledger: [], reports: [], me: null, clockOffset: 0 };
  }

  function seedTasks(now) {
    const day = 24 * 60 * 60 * 1000;
    const task = (id, posterId, title, category, when, where, price, ageDays) => ({
      id, posterId, title, category, when, where, price, details: '',
      status: 'open', doerId: null, createdAt: now - ageDays * day, history: []
    });
    return [
      task('t_wifi', 'u_ben', 'Set up my laptop for eduroam', 'Tech help', 'Today, after 4pm', 'Curzon Building', 1200, 0.1),
      task('t_boxes', 'u_chloe', 'Help carry boxes up to my flat', 'Moving', 'Saturday, 2pm', 'Jennens Court', 3000, 0.4),
      task('t_print', 'u_amara', 'Print and bind my dissertation', 'Study admin', 'Tomorrow morning', 'Kenrick Library', 800, 0.6),
      task('t_parcel', 'u_ben', 'Collect a parcel from the post office', 'Errands', 'Today', 'Corporation Street', 800, 0.8),
      task('t_food', 'u_amara', 'Grab two meal deals for the library', 'Food runs', 'Now', 'Kenrick Library', 600, 0.05)
    ];
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : blank();
    } catch (err) {
      // private browsing or a corrupted value: start fresh rather than crash
      console.warn('Could not read saved data, starting fresh', err);
      return blank();
    }
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Could not save', err);
    }
  }

  const Store = {
    uid,

    // the demo clock can be pushed forward to show the 72-hour auto-release
    now() {
      return Date.now() + (state.clockOffset || 0);
    },
    skipHours(hours) {
      state.clockOffset = (state.clockOffset || 0) + hours * 60 * 60 * 1000;
      save();
    },

    get users() { return state.users; },
    get tasks() { return state.tasks; },
    get ledger() { return state.ledger; },

    user(id) { return state.users.find(u => u.id === id) || null; },
    task(id) { return state.tasks.find(t => t.id === id) || null; },
    me() { return state.me ? this.user(state.me) : null; },

    signIn(userId) {
      state.me = userId;
      save();
    },

    addUser(user) {
      state.users = [...state.users, user];
      state.me = user.id;
      // give a new account one task that's already been done for them, so
      // the confirm-and-pay step can be tried straight away
      const now = this.now();
      state.tasks = [{
        id: uid('t'), posterId: user.id, title: 'Carry boxes up to my flat', category: 'Moving',
        when: 'Saturday, 2pm', where: 'Jennens Court', price: 3000, details: 'About 10 boxes, second floor, there is a lift.',
        status: 'done', doerId: 'u_amara', createdAt: now - 26 * 3600e3, heldAt: now - 25 * 3600e3, doneAt: now - 2 * 3600e3,
        history: [
          { status: 'open', by: user.id, at: now - 26 * 3600e3 },
          { status: 'held', by: 'u_amara', at: now - 25 * 3600e3 },
          { status: 'done', by: 'u_amara', at: now - 2 * 3600e3 }
        ]
      }, ...state.tasks];
      state.ledger = [...state.ledger, { taskId: state.tasks[0].id, type: 'hold', amount: 3000, at: now - 25 * 3600e3 }];
      save();
    },

    addTask(task) {
      state.tasks = [task, ...state.tasks];
      save();
    },

    // apply the result of one of the Rules actions
    apply(result) {
      if (result.task) state.tasks = state.tasks.map(t => (t.id === result.task.id ? result.task : t));
      if (result.ledger && result.ledger.length) state.ledger = [...state.ledger, ...result.ledger];
      save();
    },

    replaceTasks(tasks, ledger) {
      state.tasks = tasks;
      if (ledger && ledger.length) state.ledger = [...state.ledger, ...ledger];
      save();
    },

    report(taskId, byId) {
      state.reports = [...(state.reports || []), { taskId, by: byId, at: this.now() }];
      save();
    },

    reset() {
      state = blank();
      save();
    }
  };

  root.Store = Store;
})(window);
