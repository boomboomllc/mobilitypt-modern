// Words come from window.T (set per language in the layout). English fallbacks keep this working alone.
const T = Object.assign({ locale: 'en-US', menu_open: 'Open menu', menu_close: 'Close menu' }, window.T || {});
const tf = (str, vars = {}) => str.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
const MENU_OPEN = document.getElementById('menu-btn')?.getAttribute('aria-label') || T.menu_open;

// Mobile menu
const menuBtn = document.getElementById('menu-btn');
const nav = document.getElementById('main-nav');
function setMenu(open) {
  nav.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', open);
  menuBtn.setAttribute('aria-label', open ? (T.menu_close || 'Close menu') : MENU_OPEN);
  menuBtn.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu');
}
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

// Clinic time (Pacific). Both clinics: Mon-Thu 8am-7pm.
const OPEN_DAYS = ['Mon', 'Tue', 'Wed', 'Thu'];
function pacificNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return {
    weekday: get('weekday'),
    y: Number(get('year')), m: Number(get('month')), d: Number(get('day')),
    mins: (Number(get('hour')) % 24) * 60 + Number(get('minute')),
  };
}

// Open / closed badges
(function () {
  const now = pacificNow();
  let open = false;
  let text = T.opens_monday;
  if (OPEN_DAYS.includes(now.weekday) && now.mins >= 480 && now.mins < 1140) {
    open = true;
    text = T.open_now;
  } else if (OPEN_DAYS.includes(now.weekday) && now.mins < 480) {
    text = T.opens_today;
  } else if (['Mon', 'Tue', 'Wed'].includes(now.weekday)) {
    text = T.opens_tomorrow;
  }
  document.querySelectorAll('[data-status]').forEach((el) => {
    el.textContent = text;
    el.classList.add(open ? 'is-open' : 'is-closed');
  });
})();

// Returns the labels of required fields left empty (marks them aria-invalid)
function missingFields(form) {
  const missing = [];
  form.querySelectorAll('[required]').forEach((input) => {
    const bad = input.type === 'checkbox' ? !input.checked : !input.value.trim();
    input.setAttribute('aria-invalid', bad);
    if (bad) {
      const label = input.closest('label');
      const text = label ? [...label.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : input.name;
      missing.push(text || input.name);
    }
  });
  return missing;
}

// Demo forms: validate, then say nothing was sent
document.querySelectorAll('[data-demo-form]').forEach((form) => {
  const msg = form.querySelector('.form-msg');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    msg.classList.remove('ok');
    const missing = missingFields(form);
    if (missing.length) {
      msg.textContent = `${T.fill_in} ${missing.join(', ')}.`;
      return;
    }
    msg.classList.add('ok');
    msg.textContent = `${form.dataset.ok || T.thanks} ${T.demo_sent}`;
  });
});

// Tabs (arrow keys move between tabs)
function selectTab(tab) {
  tab.parentElement.querySelectorAll('.tab').forEach((t) => {
    const on = t === tab;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.dataset.tab).hidden = !on;
  });
}
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tabs = [...tab.parentElement.querySelectorAll('.tab')];
    const next = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next);
    next.focus();
  });
});

// Booking demo: a first visit, a next visit, or a whole plan of care. Openings are samples.
const bookForm = document.getElementById('book-form');
if (bookForm) {
  const dayRow = document.getElementById('day-row');
  const timeRow = document.getElementById('time-row');
  const bookMsg = document.getElementById('book-msg');
  const submitBtn = document.getElementById('book-submit');
  const singleBox = bookForm.querySelector('[data-mode=single]');
  const planBox = bookForm.querySelector('[data-mode=plan]');
  const SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  let pick = { day: null, time: null };
  const plan = { per: 2, weeks: 6, days: [], time: null };

  const tomorrow = () => {
    const now = pacificNow();
    const date = new Date(Date.UTC(now.y, now.m - 1, now.d, 12));
    date.setUTCDate(date.getUTCDate() + 1);
    return date;
  };
  const wdOf = (d) => d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const clinicDays = (count) => {
    const days = [];
    const date = tomorrow();
    while (days.length < count) {
      if (OPEN_DAYS.includes(wdOf(date))) days.push(new Date(date));
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return days;
  };
  const L = T.locale;
  const fmtDay = (d) => d.toLocaleDateString(L, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const fmtShort = (d) => d.toLocaleDateString(L, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const wdLocal = (wd, style) => { const d = tomorrow(); while (wdOf(d) !== wd) d.setUTCDate(d.getUTCDate() + 1); return d.toLocaleDateString(L, { weekday: style, timeZone: 'UTC' }); };
  const fmtTime = (h) => (L.startsWith('en') ? `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'pm' : 'am'}` : new Date(Date.UTC(2000, 0, 1, h)).toLocaleTimeString(L, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }));
  const clinic = () => bookForm.querySelector('input[name=clinic]:checked').value;
  const kind = () => bookForm.querySelector('input[name=kind]:checked').value;
  const dayKey = (d) => Math.round(d.getTime() / 86400000);

  const slotTaken = (key, h) => {
    const seed = key * 13 + h * 17 + clinic().length * 29;
    let t = seed + 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) % 10 < 3;
  };

  const chip = (html, pressed, onClick, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.innerHTML = html;
    b.setAttribute('aria-pressed', pressed);
    if (label) b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    return b;
  };

  // One visit (first or next)
  const renderTimes = () => {
    if (pick.day === null) return;
    timeRow.innerHTML = '';
    SLOTS.forEach((h) => {
      const taken = slotTaken(pick.day, h);
      const b = chip(fmtTime(h), pick.time === h, () => { pick.time = h; renderTimes(); }, taken ? `${fmtTime(h)}, ${T.taken}` : null);
      b.disabled = taken;
      timeRow.appendChild(b);
    });
  };
  const renderDays = () => {
    dayRow.innerHTML = '';
    clinicDays(8).forEach((d) => {
      const key = dayKey(d);
      dayRow.appendChild(chip(`${d.toLocaleDateString(L, { weekday: 'short', timeZone: 'UTC' })}<small>${d.toLocaleDateString(L, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</small>`,
        pick.day === key, () => { pick = { day: key, time: null, date: d }; renderDays(); renderTimes(); }, fmtDay(d)));
    });
  };

  // Whole plan: same days and time each week; a full slot moves to the closest open hour that day
  const planVisits = () => {
    if (plan.days.length !== plan.per || plan.time === null) return [];
    const visits = [];
    const date = tomorrow();
    const total = plan.per * plan.weeks;
    while (visits.length < total) {
      if (plan.days.includes(wdOf(date))) {
        const key = dayKey(date);
        let h = plan.time;
        if (slotTaken(key, h)) {
          const open = SLOTS.filter((x) => !slotTaken(key, x)).sort((x, y) => Math.abs(x - plan.time) - Math.abs(y - plan.time));
          h = open.length ? open[0] : null;
        }
        visits.push({ date: new Date(date), h, moved: h !== plan.time });
      }
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return visits;
  };
  const renderPlan = () => {
    const per = document.getElementById('plan-per');
    const weeks = document.getElementById('plan-weeks');
    const days = document.getElementById('plan-days');
    const time = document.getElementById('plan-time');
    const list = document.getElementById('plan-list');
    per.innerHTML = ''; weeks.innerHTML = ''; days.innerHTML = ''; time.innerHTML = '';
    [1, 2, 3].forEach((n) => per.appendChild(chip(`${n}×`, plan.per === n, () => {
      plan.per = n; plan.days = plan.days.slice(0, n); renderPlan();
    }, `${n} ${n === 1 ? T.visit_week_1 : T.visit_week_n}`)));
    [4, 6, 8, 12].forEach((n) => weeks.appendChild(chip(`${n} ${T.weeks}`, plan.weeks === n, () => { plan.weeks = n; renderPlan(); })));
    OPEN_DAYS.forEach((wd) => days.appendChild(chip(wdLocal(wd, 'short'), plan.days.includes(wd), () => {
      if (plan.days.includes(wd)) plan.days = plan.days.filter((x) => x !== wd);
      else { plan.days.push(wd); if (plan.days.length > plan.per) plan.days.shift(); }
      plan.days.sort((x, y) => OPEN_DAYS.indexOf(x) - OPEN_DAYS.indexOf(y));
      renderPlan();
    }, wdLocal(wd, 'long'))));
    SLOTS.forEach((h) => time.appendChild(chip(fmtTime(h), plan.time === h, () => { plan.time = h; renderPlan(); })));
    const left = plan.per - plan.days.length;
    document.getElementById('plan-days-need').textContent = left > 0 ? tf(T.pick_more, { n: left }) : '';
    const visits = planVisits();
    if (!visits.length) {
      list.innerHTML = `<p class="muted small">${tf(plan.per === 1 ? T.pick_day_time_1 : T.pick_days_time, { n: plan.per, total: plan.per * plan.weeks })}</p>`;
      return;
    }
    const moved = visits.filter((v) => v.moved).length;
    list.innerHTML = `<p class="plan-sum">${tf(T.plan_summary, { total: visits.length, from: fmtShort(visits[0].date), to: fmtShort(visits[visits.length - 1].date) })} ${moved ? tf(T.plan_moved, { n: moved }) : T.plan_all}</p>
      <ol class="plan-visits">${visits.map((v) => `<li${v.moved ? ' class="moved"' : ''}><span>${fmtShort(v.date)}</span><span>${v.h === null ? T.we_will_call : fmtTime(v.h)}${v.moved ? ' *' : ''}</span></li>`).join('')}</ol>`;
  };

  const setMode = () => {
    const k = kind();
    singleBox.hidden = k === 'plan';
    planBox.hidden = k !== 'plan';
    submitBtn.textContent = { first: T.book_eval, next: T.book_visit, plan: T.book_plan }[k];
    bookMsg.textContent = '';
    if (k === 'plan') renderPlan();
  };
  bookForm.querySelectorAll('input[name=kind]').forEach((r) => r.addEventListener('change', setMode));
  bookForm.querySelectorAll('input[name=clinic]').forEach((r) => r.addEventListener('change', () => {
    pick.time = null;
    renderTimes();
    if (kind() === 'plan') renderPlan();
  }));
  renderDays();
  setMode();

  bookForm.addEventListener('submit', (e) => {
    e.preventDefault();
    bookMsg.classList.remove('ok');
    const k = kind();
    let visits = [];
    if (k === 'plan') {
      visits = planVisits();
      if (!visits.length) {
        bookMsg.textContent = tf(plan.per === 1 ? T.pick_plan_1 : T.pick_plan, { n: plan.per });
        return;
      }
    } else if (pick.day === null || pick.time === null) {
      bookMsg.textContent = T.pick_day_and_time;
      return;
    }
    const missing = missingFields(bookForm);
    if (missing.length) {
      bookMsg.textContent = `${T.fill_in} ${missing.join(', ')}.`;
      return;
    }
    bookMsg.classList.add('ok');
    const demo = ` ${T.demo_sent}`;
    if (k === 'plan') bookMsg.textContent = tf(T.booked_plan, { clinic: clinic(), total: visits.length, date: fmtDay(visits[0].date) }) + demo;
    else if (k === 'next') bookMsg.textContent = tf(T.booked_next, { clinic: clinic(), date: fmtDay(pick.date), time: fmtTime(pick.time) }) + demo;
    else bookMsg.textContent = tf(T.booked_first, { clinic: clinic(), date: fmtDay(pick.date), time: fmtTime(pick.time) }) + demo;
  });
}

// Insurance search (works for real: filters the list on the page)
const insInput = document.querySelector('[data-ins-search]');
if (insInput) {
  const items = [...document.querySelectorAll('[data-ins-list] li')];
  const result = document.querySelector('[data-ins-result]');
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  insInput.addEventListener('input', () => {
    const q = norm(insInput.value);
    let shown = 0;
    items.forEach((li) => {
      const hit = !q || norm(li.textContent).includes(q);
      li.hidden = !hit;
      if (hit) shown += 1;
    });
    if (!q) result.textContent = '';
    else if (shown) result.textContent = tf(T.ins_good, { what: shown === 1 ? T.ins_one : tf(T.ins_many, { n: shown }) });
    else result.textContent = T.ins_none;
  });
}

// Gentle reveal on scroll for elements marked .reveal
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
})();

// Body map: show the area the patient taps. Without JS every area shows as a list.
const bodymap = document.querySelector('[data-bodymap]');
if (bodymap) {
  const areas = [...bodymap.querySelectorAll('.bm-area')];
  const start = bodymap.querySelector('[data-bm-start]');
  areas.forEach((a) => { a.hidden = true; });
  const show = (key, focus) => {
    areas.forEach((a) => { a.hidden = a.id !== `area-${key}`; });
    start.hidden = true;
    bodymap.querySelectorAll('[data-area]').forEach((el) => el.setAttribute('aria-current', el.dataset.area === key));
    const panel = document.getElementById(`area-${key}`);
    if (focus && panel) {
      panel.focus({ preventScroll: true });
      if (matchMedia('(max-width: 860px)').matches) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  bodymap.querySelectorAll('[data-area]').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    show(el.dataset.area, true);
    history.replaceState(null, '', `#area-${el.dataset.area}`);
  }));
  const fromHash = location.hash.replace('#area-', '');
  if (fromHash && document.getElementById(`area-${fromHash}`)) show(fromHash, false);
}

// Copy buttons (fax numbers on the physicians page)
document.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
  const label = btn.textContent;
  try { await navigator.clipboard.writeText(btn.dataset.copy); btn.textContent = 'Copied'; } catch (e) { btn.textContent = btn.dataset.copy; }
  setTimeout(() => { btn.textContent = label; }, 2000);
}));

// Visit sheet: answers in the patient's language -> a sheet with English beside it. Nothing leaves the device.
const sheetBox = document.querySelector('[data-sheet]');
if (sheetBox) {
  const D = JSON.parse(document.getElementById('vs-data').textContent);
  const lang = sheetBox.dataset.lang;
  const bilingual = lang !== 'en';
  const form = document.getElementById('vs-form');
  const out = document.getElementById('vs-out');
  const sheet = document.getElementById('vs-sheet');
  const formStatus = document.getElementById('vs-form-status');
  const dialog = document.getElementById('vs-dialog');
  const picked = new Set();
  const esc = (x) => String(x).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // Body areas: dots and chips share one selection
  const syncAreas = () => sheetBox.querySelectorAll('[data-area]').forEach((el) => el.setAttribute('aria-pressed', picked.has(el.dataset.area)));
  sheetBox.querySelectorAll('[data-area]').forEach((el) => el.addEventListener('click', () => {
    const k = el.dataset.area;
    if (picked.has(k)) picked.delete(k); else picked.add(k);
    syncAreas();
    document.getElementById('vs-area-msg').textContent = '';
  }));

  const areaName = (list, k, other) => (k === 'other' ? other : (list.find((a) => a.key === k) || {}).name || k);
  const optLabel = (sheetData, q, v) => {
    const qq = sheetData.questions.find((x) => x.k === q.k);
    const o = qq && qq.options ? qq.options.find((x) => String(x.k) === String(v)) : null;
    return o ? o.l : v;
  };

  // On-device translation (Chrome's built-in Translator). Returns null when the browser can't.
  const translate = async (text) => {
    if (!text || !bilingual || !('Translator' in self)) return null;
    const run = async () => {
      const opts = { sourceLanguage: lang, targetLanguage: 'en' };
      if ((await Translator.availability(opts)) === 'unavailable') return null;
      const tr = await Translator.create(opts);
      return tr.translate(text);
    };
    try {
      return await Promise.race([run(), new Promise((r) => setTimeout(() => r(null), 15000))]);
    } catch (e) { return null; }
  };

  const row = (enQ, localQ, enA, localA, extra = '') => `
    <tr><th scope="row">${esc(enQ)}${bilingual ? `<span class="vs-local" lang="${lang}">${esc(localQ)}</span>` : ''}</th>
    <td><strong>${enA}</strong>${bilingual && localA ? `<span class="vs-local" lang="${lang}">${localA}</span>` : ''}${extra}</td></tr>`;

  const build = async () => {
    const fd = new FormData(form);
    const none = `<span class="vs-none">${esc(D.en.none)}</span>`;
    const rows = [];
    const areasEn = [...picked].map((k) => areaName(D.areasEn, k, D.en.other_area));
    const areasLo = [...picked].map((k) => areaName(D.areasLocal, k, D.local.other_area));
    rows.push(row(D.en.sheet_where, D.local.sheet_where, esc(areasEn.join(', ')), esc(areasLo.join(', '))));
    let notesRow = '';
    for (const q of D.local.questions) {
      const qEn = D.en.questions.find((x) => x.k === q.k);
      if (q.type === 'text') {
        const text = (fd.get(q.k) || '').trim();
        if (!text) { notesRow = row(qEn.label, q.label, none, ''); continue; }
        if (!bilingual) { notesRow = row(qEn.label, q.label, esc(text), ''); continue; }
        formStatus.textContent = D.local.translating;
        const en = await translate(text);
        formStatus.textContent = '';
        notesRow = en
          ? row(qEn.label, q.label, esc(en), esc(text), `<em class="vs-flag">${esc(D.en.sheet_notes_mt)}</em>`)
          : row(qEn.label, q.label, `<span lang="${lang}">${esc(text)}</span>`, '', `<em class="vs-flag">${esc(D.en.sheet_notes_original)}</em>`);
        continue;
      }
      const vals = fd.getAll(q.k);
      if (!vals.length) { rows.push(row(qEn.label, q.label, none, '')); continue; }
      if (q.type === 'scale') {
        rows.push(row(qEn.label, q.label, `<span class="vs-big">${esc(vals[0])} / 10</span>`, ''));
        continue;
      }
      let enA = vals.map((v) => optLabel(D.en, q, v)).join(', ');
      if (q.k === 'language' && vals[0] === 'mine') enA = `${enA} (${sheetBox.dataset.langName})`;
      rows.push(row(qEn.label, q.label, esc(enA), esc(vals.map((v) => optLabel(D.local, q, v)).join(', '))));
    }
    if (notesRow) rows.push(notesRow);
    const name = (fd.get('name') || '').trim();
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    sheet.innerHTML = `
      <header class="vs-head">
        <div><p class="vs-clinic">${esc(D.clinic)}</p><h2>${esc(D.en.sheet_title)}${bilingual ? `<span class="vs-local" lang="${lang}">${esc(D.local.sheet_title)}</span>` : ''}</h2></div>
        <dl>
          ${name ? `<dt>${esc(D.en.sheet_for)}</dt><dd>${esc(name)}</dd>` : ''}
          <dt>${esc(D.en.sheet_date)}</dt><dd>${today}</dd>
          ${bilingual ? `<dt>${esc(D.en.sheet_written)}</dt><dd>${esc(sheetBox.dataset.langName)}</dd>` : ''}
        </dl>
      </header>
      <table class="vs-table">${rows.join('')}</table>
      <p class="vs-foot">${esc(D.en.sheet_footer)} ${D.names.map((n, i) => `${esc(n)} ${esc(D.phones[i])}`).join(' · ')}</p>`;
  };

  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!picked.size) {
      document.getElementById('vs-area-msg').textContent = D.local.need_area;
      sheetBox.querySelector('.vs-chips .chip').focus();
      return;
    }
    busy = true;
    await build();
    busy = false;
    form.hidden = true;
    out.hidden = false;
    document.body.classList.add('has-sheet');
    sheet.focus({ preventScroll: true });
    out.scrollIntoView({ block: 'start' });
  });
  sheetBox.querySelector('[data-vs-edit]').addEventListener('click', () => {
    out.hidden = true;
    form.hidden = false;
    document.body.classList.remove('has-sheet');
    form.scrollIntoView({ block: 'start' });
  });
  sheetBox.querySelector('[data-vs-print]').addEventListener('click', () => window.print());
  sheetBox.querySelector('[data-vs-show]').addEventListener('click', () => {
    dialog.querySelector('.vs-dialog-body').innerHTML = sheet.innerHTML;
    dialog.showModal();
  });
}

// "My progress" tracker: check-ins live only in this browser (localStorage). Nothing is sent.
const pgBox = document.querySelector('[data-progress]');
if (pgBox) {
  const P = JSON.parse(document.getElementById('pg-data').textContent);
  const KEY = 'mobilitypt-progress-v1';
  const L = T.locale || 'en-US';
  const tfp = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);
  const load = () => {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.entries)) return d; } catch (e) { /* storage blocked */ }
    return { goal: '', entries: [] };
  };
  let data = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage blocked */ } };
  const todayKey = () => { const n = pacificNow(); return `${n.y}-${String(n.m).padStart(2, '0')}-${String(n.d).padStart(2, '0')}`; };
  const fmt = (k, long) => new Date(`${k}T12:00:00Z`).toLocaleDateString(L, long ? { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const esc = (x) => String(x).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  const chart = () => {
    const box = document.getElementById('pg-chart');
    const e = data.entries;
    if (!e.length) { box.innerHTML = `<p class="pg-empty">${esc(P.empty)}</p>`; return; }
    const small = matchMedia('(max-width: 600px)').matches;
    const W = 600, H = small ? 340 : 280, l = small ? 40 : 34, r = small ? 30 : 16, t = 14, b = small ? 44 : 34;
    const x = (i) => (e.length === 1 ? (l + W - r) / 2 : l + (i * (W - l - r)) / (e.length - 1));
    const y = (v) => t + ((10 - v) * (H - t - b)) / 10;
    const grid = [0, 2, 4, 6, 8, 10].map((v) => `<line x1="${l}" x2="${W - r}" y1="${y(v)}" y2="${y(v)}" class="pg-gl"/><text x="${l - 8}" y="${y(v) + 4}" class="pg-ax" text-anchor="end">${v}</text>`).join('');
    const line = (k, cls) => `<polyline class="${cls}" points="${e.map((d, i) => `${x(i)},${y(d[k])}`).join(' ')}"/>${e.map((d, i) => `<circle class="${cls}-dot" cx="${x(i)}" cy="${y(d[k])}" r="5"/>`).join('')}`;
    const step = Math.max(1, Math.ceil(e.length / (small ? 4 : 6)));
    const labels = e.map((d, i) => (((i % step === 0 && e.length - 1 - i >= step) || i === e.length - 1) ? `<text x="${x(i)}" y="${H - 10}" class="pg-ax" text-anchor="middle">${esc(fmt(d.d))}</text>` : '')).join('');
    const desc = `${P.pain}: ${e.map((d) => d.pain).join(', ')}. ${P.func}: ${e.map((d) => d.func).join(', ')}.`;
    box.innerHTML = `<svg class="pg-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(P.chart_h)}. ${esc(desc)}">${grid}${line('pain', 'pg-pain')}${line('func', 'pg-func')}${labels}</svg>`;
  };

  const summary = () => {
    const e = data.entries;
    const el = document.getElementById('pg-summary');
    if (e.length < 2) { el.innerHTML = e.length ? `<p>${esc(P.one)}</p>` : ''; return; }
    const a = e[0], z = e[e.length - 1];
    const date = fmt(a.d, true);
    const pk = z.pain < a.pain ? 'pain_down' : (z.pain > a.pain ? 'pain_up' : 'pain_same');
    const fk = z.func > a.func ? 'func_up' : (z.func < a.func ? 'func_down' : 'func_same');
    el.innerHTML = `
      <p class="pg-stat ${pk === 'pain_down' ? 'good' : ''}">${esc(tfp(P[pk], { from: a.pain, to: z.pain, n: Math.abs(a.pain - z.pain), date }))}</p>
      <p class="pg-stat ${fk === 'func_up' ? 'good' : ''}">${esc(tfp(P[fk], { from: a.func, to: z.func, n: Math.abs(z.func - a.func), date }))}</p>
      <p>${esc(tfp(P.checkins, { n: e.length }))} ${esc(P.keep_going)}</p>`;
  };

  const rows = () => {
    const tb = document.getElementById('pg-rows');
    tb.innerHTML = data.entries.slice().reverse().map((d) => `<tr><td>${esc(fmt(d.d, true))}</td><td>${d.pain}</td><td>${d.func}</td><td><button class="btn-link" type="button" data-del="${d.d}">${esc(P.delete)}</button></td></tr>`).join('');
    document.getElementById('pg-history-box').hidden = !data.entries.length;
  };

  const goalShow = () => {
    const g = document.getElementById('pg-goal-show');
    g.hidden = !data.goal;
    g.innerHTML = data.goal ? `<strong>${esc(P.goal_label)}:</strong> ${esc(data.goal)}` : '';
    document.querySelector('#pg-goal [name=goal]').value = data.goal || '';
  };

  const render = () => { chart(); summary(); rows(); goalShow(); };

  // Prefill today's answers if already checked in
  const prefill = () => {
    const today = data.entries.find((d) => d.d === todayKey());
    if (!today) return;
    pgBox.querySelector(`#pg-form input[name=pain][value="${today.pain}"]`).checked = true;
    pgBox.querySelector(`#pg-form input[name=func][value="${today.func}"]`).checked = true;
  };

  document.getElementById('pg-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const msg = document.getElementById('pg-msg');
    msg.classList.remove('ok');
    if (fd.get('pain') === null || fd.get('func') === null) { msg.textContent = P.need_both; return; }
    const entry = { d: todayKey(), pain: Number(fd.get('pain')), func: Number(fd.get('func')) };
    const i = data.entries.findIndex((d) => d.d === entry.d);
    if (i >= 0) data.entries[i] = entry; else data.entries.push(entry);
    data.entries.sort((p, q) => p.d.localeCompare(q.d));
    save();
    render();
    msg.classList.add('ok');
    msg.textContent = i >= 0 ? P.updated : P.saved;
  });

  document.getElementById('pg-goal').addEventListener('submit', (ev) => {
    ev.preventDefault();
    data.goal = new FormData(ev.target).get('goal').trim().slice(0, 200);
    save();
    goalShow();
  });

  document.getElementById('pg-rows').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-del]');
    if (!b) return;
    data.entries = data.entries.filter((d) => d.d !== b.dataset.del);
    save();
    render();
  });

  // Backup: download / restore a small JSON file (stays with the patient)
  const bmsg = document.getElementById('pg-backup-msg');
  document.getElementById('pg-download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'mobilitypt-progress', v: 1, ...data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `my-progress-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  document.getElementById('pg-restore').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    bmsg.classList.remove('ok');
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      const ok = d && d.app === 'mobilitypt-progress' && Array.isArray(d.entries)
        && d.entries.every((x) => /^\d{4}-\d\d-\d\d$/.test(x.d) && Number.isInteger(x.pain) && Number.isInteger(x.func) && x.pain >= 0 && x.pain <= 10 && x.func >= 0 && x.func <= 10);
      if (!ok) throw new Error('bad');
      const byDay = new Map(data.entries.map((x) => [x.d, x]));
      d.entries.forEach((x) => byDay.set(x.d, { d: x.d, pain: x.pain, func: x.func }));
      data = { goal: typeof d.goal === 'string' && d.goal ? d.goal.slice(0, 200) : data.goal, entries: [...byDay.values()].sort((p, q) => p.d.localeCompare(q.d)) };
      save();
      render();
      bmsg.classList.add('ok');
      bmsg.textContent = tfp(P.restored, { n: d.entries.length });
    } catch (e) { bmsg.textContent = P.bad_file; }
  });
  document.getElementById('pg-clear').addEventListener('click', () => {
    if (!window.confirm(P.clear_confirm)) return;
    data = { goal: '', entries: [] };
    save();
    pgBox.querySelectorAll('#pg-form input').forEach((i) => { i.checked = false; });
    render();
  });

  // Install button where the browser supports it (Chrome / Android); iPhone uses Share > Add to Home Screen
  let installEvt = null;
  const installBtn = document.getElementById('pg-install');
  window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); installEvt = ev; installBtn.hidden = false; });
  installBtn.addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; installBtn.hidden = true; });

  render();
  prefill();
}
