// Mobile menu
const menuBtn = document.getElementById('menu-btn');
const nav = document.getElementById('main-nav');
function setMenu(open) {
  nav.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', open);
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
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
  let text = 'Opens Monday 8 am';
  if (OPEN_DAYS.includes(now.weekday) && now.mins >= 480 && now.mins < 1140) {
    open = true;
    text = 'Open now until 7 pm';
  } else if (OPEN_DAYS.includes(now.weekday) && now.mins < 480) {
    text = 'Opens today 8 am';
  } else if (['Mon', 'Tue', 'Wed'].includes(now.weekday)) {
    text = 'Opens tomorrow 8 am';
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
      msg.textContent = `Please fill in: ${missing.join(', ')}.`;
      return;
    }
    msg.classList.add('ok');
    msg.textContent = `${form.dataset.ok || 'Thanks! We received your request.'} (Demo: nothing was sent.)`;
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
  const WEEKDAYS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
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
  const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const fmtShort = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const fmtTime = (h) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'pm' : 'am'}`;
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
      const b = chip(fmtTime(h), pick.time === h, () => { pick.time = h; renderTimes(); }, taken ? `${fmtTime(h)}, taken` : null);
      b.disabled = taken;
      timeRow.appendChild(b);
    });
  };
  const renderDays = () => {
    dayRow.innerHTML = '';
    clinicDays(8).forEach((d) => {
      const key = dayKey(d);
      dayRow.appendChild(chip(`${wdOf(d)}<small>${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</small>`,
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
    }, `${n} ${n === 1 ? 'visit' : 'visits'} a week`)));
    [4, 6, 8, 12].forEach((n) => weeks.appendChild(chip(`${n} weeks`, plan.weeks === n, () => { plan.weeks = n; renderPlan(); })));
    OPEN_DAYS.forEach((wd) => days.appendChild(chip(wd, plan.days.includes(wd), () => {
      if (plan.days.includes(wd)) plan.days = plan.days.filter((x) => x !== wd);
      else { plan.days.push(wd); if (plan.days.length > plan.per) plan.days.shift(); }
      plan.days.sort((x, y) => OPEN_DAYS.indexOf(x) - OPEN_DAYS.indexOf(y));
      renderPlan();
    }, WEEKDAYS[wd])));
    SLOTS.forEach((h) => time.appendChild(chip(fmtTime(h), plan.time === h, () => { plan.time = h; renderPlan(); })));
    const left = plan.per - plan.days.length;
    document.getElementById('plan-days-need').textContent = left > 0 ? `(pick ${left} more)` : '';
    const visits = planVisits();
    if (!visits.length) {
      list.innerHTML = `<p class="muted small">Pick ${plan.per} ${plan.per === 1 ? 'day' : 'days'} and a time to see all ${plan.per * plan.weeks} visits.</p>`;
      return;
    }
    const moved = visits.filter((v) => v.moved).length;
    list.innerHTML = `<p class="plan-sum"><strong>${visits.length} visits</strong>, ${fmtShort(visits[0].date)} to ${fmtShort(visits[visits.length - 1].date)}${moved ? `. ${moved} moved to the closest open time (marked).` : '. All at your time.'}</p>
      <ol class="plan-visits">${visits.map((v) => `<li${v.moved ? ' class="moved"' : ''}><span>${fmtShort(v.date)}</span><span>${v.h === null ? 'We will call' : fmtTime(v.h)}${v.moved ? ' *' : ''}</span></li>`).join('')}</ol>`;
  };

  const setMode = () => {
    const k = kind();
    singleBox.hidden = k === 'plan';
    planBox.hidden = k !== 'plan';
    submitBtn.textContent = { first: 'Book evaluation', next: 'Book visit', plan: 'Book my plan' }[k];
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
        bookMsg.textContent = `Please pick ${plan.per} ${plan.per === 1 ? 'day' : 'days'} and a time.`;
        return;
      }
    } else if (pick.day === null || pick.time === null) {
      bookMsg.textContent = 'Please pick a day and a time.';
      return;
    }
    const missing = missingFields(bookForm);
    if (missing.length) {
      bookMsg.textContent = `Please fill in: ${missing.join(', ')}.`;
      return;
    }
    bookMsg.classList.add('ok');
    const demo = ' (Demo: nothing was sent.)';
    if (k === 'plan') bookMsg.textContent = `Your plan is booked at our ${clinic()} clinic: ${visits.length} visits starting ${fmtDay(visits[0].date)}. We'll text or call to confirm, and you can change any visit by calling us.${demo}`;
    else if (k === 'next') bookMsg.textContent = `You're booked at our ${clinic()} clinic on ${fmtDay(pick.date)} at ${fmtTime(pick.time)}. See you then!${demo}`;
    else bookMsg.textContent = `You're booked at our ${clinic()} clinic on ${fmtDay(pick.date)} at ${fmtTime(pick.time)}. We'll call to confirm your insurance.${demo}`;
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
    else if (shown) result.textContent = `Good news: ${shown === 1 ? 'we work with this plan' : `${shown} matching plans`}. We'll confirm your coverage before your first visit.`;
    else result.textContent = "We didn't find that plan in our list. Call us and we'll check. Cash rates are also available.";
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
