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

// Booking demo: sample openings for the next 8 clinic days
const bookForm = document.getElementById('book-form');
if (bookForm) {
  const dayRow = document.getElementById('day-row');
  const timeRow = document.getElementById('time-row');
  const bookMsg = document.getElementById('book-msg');
  const SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  let pick = { day: null, time: null };

  const clinicDays = (count) => {
    const now = pacificNow();
    const days = [];
    const date = new Date(Date.UTC(now.y, now.m - 1, now.d, 12));
    while (days.length < count) {
      date.setUTCDate(date.getUTCDate() + 1);
      const wd = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      if (OPEN_DAYS.includes(wd)) days.push(new Date(date));
    }
    return days;
  };
  const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const fmtTime = (h) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'pm' : 'am'}`;
  const clinic = () => bookForm.querySelector('input[name=clinic]:checked').value;

  const slotTaken = (dayIdx, h) => {
    const seed = dayIdx * 13 + h * 17 + clinic().length * 29;
    let t = seed + 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) % 10 < 3;
  };

  const renderTimes = () => {
    if (pick.day === null) return;
    timeRow.innerHTML = '';
    SLOTS.forEach((h) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = fmtTime(h);
      b.disabled = slotTaken(pick.day, h);
      b.setAttribute('aria-pressed', pick.time === h);
      if (b.disabled) b.setAttribute('aria-label', `${fmtTime(h)}, taken`);
      b.addEventListener('click', () => { pick.time = h; renderTimes(); });
      timeRow.appendChild(b);
    });
  };

  const renderDays = () => {
    dayRow.innerHTML = '';
    clinicDays(8).forEach((d, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('aria-pressed', pick.day === i);
      b.setAttribute('aria-label', fmtDay(d));
      b.innerHTML = `${d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}<small>${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</small>`;
      b.addEventListener('click', () => { pick = { day: i, time: null, date: d }; renderDays(); renderTimes(); });
      dayRow.appendChild(b);
    });
  };

  bookForm.querySelectorAll('input[name=clinic]').forEach((r) => r.addEventListener('change', () => {
    pick.time = null;
    renderTimes();
  }));
  renderDays();

  bookForm.addEventListener('submit', (e) => {
    e.preventDefault();
    bookMsg.classList.remove('ok');
    if (pick.day === null || pick.time === null) {
      bookMsg.textContent = 'Please pick a day and a time.';
      return;
    }
    const missing = missingFields(bookForm);
    if (missing.length) {
      bookMsg.textContent = `Please fill in: ${missing.join(', ')}.`;
      return;
    }
    bookMsg.classList.add('ok');
    bookMsg.textContent = `You're booked at our ${clinic()} clinic on ${fmtDay(pick.date)} at ${fmtTime(pick.time)}. We'll call to confirm your insurance. (Demo: nothing was sent.)`;
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
