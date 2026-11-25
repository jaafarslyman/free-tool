/* Certificate Workload Check
 * Flow: welcome -> 5 questions -> results -> email gate -> confirmation
 * All state lives in `state`; progress is written to localStorage after every answer.
 */
(function () {
  'use strict';

  var MONTH_FACTOR = 4.33;
  var STORE = 'coi-check.v1';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var ADVANCE_MS = 190;

  /* Where a finished submission is saved: the Apps Script web app URL (see README).
     Left empty, the report is still built in the browser but nothing is stored. */
  var SHEET_ENDPOINT = '';

  var BRAND = {
    name: 'Jaafar Slyman',
    email: 'jaafarslyman85@gmail.com'
  };

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------- answer ranges -> midpoints ---------- */

  var CONFIG = {
    requests: {
      lt10:  { label: 'Under 10', value: 5 },
      r1025: { label: '10\u201325', value: 17.5 },
      r2550: { label: '25\u201350', value: 37.5 },
      gt50:  { label: '50+', value: 60 }
    },
    minutes: {
      m10:   { label: 'Under 10', value: 7 },
      m1020: { label: '10\u201320', value: 15 },
      m2030: { label: '20\u201330', value: 25 },
      m30:   { label: '30+', value: 40 }
    },
    redo: {
      rarely:    { label: 'Rarely', value: 0.1 },
      sometimes: { label: 'Sometimes', value: 0.25 },
      often:     { label: 'Often', value: 0.5 }
    },
    handler: {
      csr:      { label: 'A CSR' },
      am:       { label: 'An account manager' },
      producer: { label: 'A producer' },
      owner:    { label: 'The owner' }
    },
    system: {
      epic:     { label: 'Applied Epic' },
      hawksoft: { label: 'HawkSoft' },
      ezlynx:   { label: 'EZLynx' },
      nowcerts: { label: 'NowCerts' },
      other:    { label: 'Other' }
    }
  };

  var ICONS = {
    user:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.2" r="3.6"/><path d="M5.2 20.2c.4-3.5 3.2-6.1 6.8-6.1s6.4 2.6 6.8 6.1"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6 3.6 8 12 12.4 20.4 8 12 3.6Z"/><path d="m4.8 12.6 7.2 3.8 7.2-3.8"/><path d="m4.8 16.6 7.2 3.8 7.2-3.8"/></svg>',
    clock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 2.1"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 4.6v5h-5"/><path d="M19.8 9.6A8.1 8.1 0 0 0 5.3 7.4"/><path d="M3.8 19.4v-5h5"/><path d="M4.2 14.4a8.1 8.1 0 0 0 14.5 2.2"/></svg>',
    users:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.2" cy="8.6" r="3.2"/><path d="M3.6 19.8c0-3.1 2.5-5.6 5.6-5.6s5.6 2.5 5.6 5.6"/><path d="M16.2 6a3.2 3.2 0 0 1 0 5.9"/><path d="M17.6 14.7c1.8.9 3 2.8 3 5.1"/></svg>',
    screen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.9" y="4.4" width="18.2" height="12.6" rx="2.4"/><path d="M9.4 20.4h5.2"/><path d="M12 17.1v3.3"/></svg>'
  };

  var MILESTONES = [
    { label: 'Your name', icon: 'user' },
    { label: 'Requests per week', icon: 'layers' },
    { label: 'Minutes each', icon: 'clock' },
    { label: 'Redos', icon: 'repeat' },
    { label: 'Who handles', icon: 'users' },
    { label: 'Management system', icon: 'screen' }
  ];

  var COUNTERS = ['Step 1 of 6', 'Step 2 of 6', 'Step 3 of 6', 'Step 4 of 6', 'Step 5 of 6', 'Step 6 of 6', 'Results', 'Report', ''];

  /* ---------- elements ---------- */

  var card = document.getElementById('card');
  var stage = document.getElementById('stage');
  var progress = document.getElementById('progress');
  var backBtn = document.getElementById('back');
  var counter = document.getElementById('counter');

  var startForm = document.getElementById('start-form');
  var nameInput = document.getElementById('first-name');
  var nameErr = document.getElementById('name-err');
  var startBtn = document.getElementById('start-btn');

  var costOut = document.getElementById('r-cost');
  var subOut = document.getElementById('r-sub');
  var breakOut = document.getElementById('r-break');
  var rateInput = document.getElementById('rate');
  var rateOut = document.getElementById('rate-out');
  var toReport = document.getElementById('to-report');

  var reportForm = document.getElementById('report-form');
  var emailInput = document.getElementById('email');
  var agencyInput = document.getElementById('agency');
  var reportErr = document.getElementById('report-err');
  var reportBtn = document.getElementById('report-btn');
  var printBtn = document.getElementById('print-btn');

  var panels = Array.prototype.slice
    .call(document.querySelectorAll('.panel'))
    .sort(function (a, b) { return +a.dataset.step - +b.dataset.step; });

  var nodes = [];
  var trackFill;
  var busy = false;

  var state = {
    step: 0,
    name: '',
    answers: {},
    rate: 30,
    email: '',
    agency: '',
    sessionId: uid(),
    startedAt: new Date().toISOString(),
    submitted: false
  };

  /* ---------- progress bar ---------- */

  progress.innerHTML =
    '<div class="track" aria-hidden="true"><span class="track-fill"></span></div>' +
    '<ol class="nodes">' +
    MILESTONES.map(function (m, i) {
      return '<li class="node" data-i="' + i + '" title="' + m.label + '">' + ICONS[m.icon] + '</li>';
    }).join('') +
    '</ol>';

  trackFill = progress.querySelector('.track-fill');
  nodes = Array.prototype.slice.call(progress.querySelectorAll('.node'));

  function paintProgress() {
    var step = state.step;
    var done = Math.min(step, 5);
    trackFill.style.width = (done / 5 * 100) + '%';
    nodes.forEach(function (node, i) {
      node.classList.toggle('is-done', i < step || step > 5);
      node.classList.toggle('is-current', i === step);
    });
    progress.setAttribute('aria-label', step <= 5 ? 'Step ' + (step + 1) + ' of 6' : 'Steps complete');
  }

  /* ---------- step changes ---------- */

  function setStep(next) {
    next = Math.max(0, Math.min(panels.length - 1, next));
    if (next === state.step) return;

    var dir = next > state.step ? 1 : -1;
    var prev = panels[state.step];
    var nxt = panels[next];

    prev.classList.remove('is-active');
    prev.classList.add(dir > 0 ? 'leave-left' : 'leave-right');

    nxt.classList.remove('leave-left', 'leave-right');
    nxt.classList.toggle('enter-back', dir < 0);
    nxt.style.transition = 'none';
    void nxt.offsetWidth;
    nxt.style.transition = '';

    state.step = next;
    if (next === 6) renderResults();
    stage.style.height = nxt.offsetHeight + 'px';

    window.requestAnimationFrame(function () {
      nxt.classList.add('is-active');
      nxt.classList.remove('enter-back');
    });

    paintProgress();
    updateChrome();
    paintSelections();
    track('progress', snapshot());

    var heading = nxt.querySelector('h1, h2');
    if (heading) window.setTimeout(function () {
      heading.focus({ preventScroll: true });
    }, 240);

    if (window.scrollY > 8) {
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function updateChrome() {
    counter.textContent = COUNTERS[state.step] || '';
    var canGoBack = state.step > 0 && state.step < 8;
    backBtn.classList.toggle('is-on', canGoBack);
    backBtn.tabIndex = canGoBack ? 0 : -1;
  }

  function paintSelections() {
    panels[state.step] && panels[state.step].querySelectorAll('.opt').forEach(function (opt) {
      opt.classList.toggle('is-selected', state.answers[opt.dataset.field] === opt.dataset.value);
    });
  }

  /* ---------- answers ---------- */

  panels.forEach(function (panel) {
    panel.addEventListener('click', function (event) {
      var opt = event.target.closest ? event.target.closest('.opt') : null;
      if (!opt || busy) return;

      var field = opt.dataset.field;
      var value = opt.dataset.value;
      state.answers[field] = value;

      paintSelections();
      saveProgress();
      track('answer', {
        field: field,
        value: value,
        label: CONFIG[field][value].label,
        step: state.step
      });

      busy = true;
      window.setTimeout(function () {
        busy = false;
        setStep(state.step + 1);
      }, ADVANCE_MS);
    });
  });

  backBtn.addEventListener('click', function () {
    if (busy) return;
    setStep(state.step - 1);
  });

  /* ---------- step 1: name ---------- */

  nameInput.addEventListener('input', function () {
    var clean = nameInput.value.trim();
    startBtn.disabled = !clean;
    if (nameErr.hidden) return;
    if (clean) {
      nameErr.hidden = true;
      nameInput.removeAttribute('aria-invalid');
    }
  });

  startForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var name = nameInput.value.trim();
    if (!name) {
      nameErr.hidden = false;
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.focus();
      return;
    }
    state.name = name;
    saveProgress();
    track('start', { name: state.name });
    setStep(1);
  });

  /* ---------- results ---------- */

  function calc() {
    var a = state.answers;
    var req = value('requests', a.requests);
    var minutes = value('minutes', a.minutes);
    var redoShare = value('redo', a.redo);

    var baseWeekly = req * minutes / 60;
    var redoWeekly = baseWeekly * redoShare;
    var weekly = baseWeekly + redoWeekly;
    var monthly = weekly * MONTH_FACTOR;

    return {
      requests: req,
      minutes: minutes,
      redoShare: redoShare,
      baseWeekly: baseWeekly,
      redoWeekly: redoWeekly,
      weekly: weekly,
      monthly: monthly,
      cost: monthly * state.rate
    };
  }

  function value(field, key) {
    return key && CONFIG[field][key] ? (CONFIG[field][key].value || 0) : 0;
  }

  function renderResults() {
    var c = calc();

    costOut.textContent = money(c.cost);
    subOut.textContent = 'About ' + hrs(c.weekly) + ' hours of work each week';

    breakOut.innerHTML = [
      row('Certificate requests per week', count(c.requests)),
      row('Minutes per request', c.minutes + ' min'),
      row('Time lost to redos each week', hrs(c.redoWeekly) + ' hrs'),
      row('Total hours per month', hrs(c.monthly) + ' hrs')
    ].join('');

    rateOut.textContent = '$' + state.rate;
    var pct = (+rateInput.value - +rateInput.min) / (+rateInput.max - +rateInput.min) * 100;
    rateInput.style.setProperty('--pct', pct + '%');
  }

  function row(label, value) {
    return '<div class="break-row"><span>' + label + '</span><span class="dots"></span><b>' + value + '</b></div>';
  }

  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function hrs(n) { return n.toFixed(1); }
  function count(n) { return Math.abs(n % 1) < 0.001 ? String(Math.round(n)) : n.toFixed(1); }

  rateInput.addEventListener('input', function () {
    state.rate = +rateInput.value;
    renderResults();
    saveProgress();
  });

  rateInput.addEventListener('change', function () {
    track('rate', { rate: state.rate });
  });

  toReport.addEventListener('click', function () {
    saveProgress();
    setStep(7);
  });

  /* ---------- email gate ---------- */

  [emailInput, agencyInput].forEach(function (input) {
    input.addEventListener('input', function () {
      if (reportErr.hidden) return;
      reportErr.hidden = true;
      emailInput.removeAttribute('aria-invalid');
      agencyInput.removeAttribute('aria-invalid');
    });
  });

  reportForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (reportBtn.disabled) return;

    var email = emailInput.value.trim();
    var agency = agencyInput.value.trim();

    if (!EMAIL_RE.test(email)) {
      reportErr.textContent = 'Please enter a valid email address.';
      reportErr.hidden = false;
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
      return;
    }
    if (!agency) {
      reportErr.textContent = 'Please add your agency name.';
      reportErr.hidden = false;
      agencyInput.setAttribute('aria-invalid', 'true');
      agencyInput.focus();
      return;
    }

    state.email = email;
    state.agency = agency;

    reportBtn.disabled = true;
    reportBtn.textContent = 'Saving\u2026';

    var payload = buildPayload();
    saveSubmission(payload);

    deliverReport(payload).then(function () {
      state.submitted = true;
      track('submit', payload);
      renderReport(payload);
      setStep(8);
    }).catch(function () {
      reportBtn.disabled = false;
      reportBtn.textContent = 'Get my report';
      reportErr.textContent = 'We couldn\u2019t save that just now. Please try again.';
      reportErr.hidden = false;
    });
  });

  /* ---------- printable report ---------- */

  function renderReport(p) {
    var c = calc();
    var r = p.results;
    var a = p.answers;
    var when = new Date(p.timestamp);

    el('rep-agency').textContent = p.agency;
    el('rep-meta').textContent = MONTHS[when.getMonth()] + ' ' + when.getDate() + ', ' +
      when.getFullYear() + ' \u00b7 Prepared for ' + p.name;

    el('rep-headline').innerHTML = 'About <b>' + Math.round(r.monthlyHours) +
      ' hours</b> a month, roughly <b>' + money(r.monthlyCost) + '</b>';

    var rows = [
      ['Certificate requests per week', a.requestsPerWeek.label],
      ['Minutes per request', a.minutesEach.label],
      ['How often one needs redoing', a.redos.label],
      ['Who handles them', a.handledBy.label],
      ['Management system', a.managementSystem.label]
    ];

    el('rep-table').innerHTML = rows.map(function (item) {
      return '<tr><th scope="row">' + item[0] + '</th><td>' + item[1] + '</td></tr>';
    }).join('');

    el('rep-calc').innerHTML =
      count(c.requests) + ' requests a week at ' + count(c.minutes) + ' minutes each is about ' +
      hrs(c.baseWeekly) + ' hours, plus ' + hrs(c.redoWeekly) + ' hours for redos. That is ' +
      hrs(r.monthlyHours) + ' hours a month, and at $' + r.hourlyRate +
      ' an hour it comes to <b>' + money(r.monthlyCost) + '</b>.<br /><br />' +
      'Everything here is an estimate built from your answers \u2014 not a quote, and not an ' +
      'industry benchmark.';

    el('rep-ten').textContent = tenHoursText(r.monthlyHours);

    el('rep-who').textContent = BRAND.name;
    var mail = el('rep-mail');
    mail.textContent = BRAND.email;
    mail.href = 'mailto:' + BRAND.email;
    el('rep-foot').textContent = BRAND.name + ' \u00b7 ' + BRAND.email;
  }

  function tenHoursText(monthly) {
    if (monthly >= 12) {
      return 'You are at ' + hrs(monthly) + ' hours a month. Getting 10 of those hours back is about ' +
        Math.round(10 / monthly * 100) + '% of the total \u2014 120 hours a year, close to three ' +
        'working weeks. That is enough to take renewals out of the last week of the month, or to keep ' +
        'new business moving without pulling someone off service work.';
    }
    return 'You are at ' + hrs(monthly) + ' hours a month, so 10 hours back is more than the whole job. ' +
      'In practice the win is steadier: a few hours back each week is around 120 hours a year \u2014 close ' +
      'to three working weeks \u2014 enough to protect renewals or keep new business moving.';
  }

  function el(id) { return document.getElementById(id); }

  /* ---------- payload & data capture ---------- */

  function buildPayload() {
    var c = calc();
    return {
      sessionId: state.sessionId,
      name: state.name,
      email: state.email,
      agency: state.agency,
      answers: {
        requestsPerWeek: {
          value: state.answers.requests || null,
          label: labelOf('requests', state.answers.requests),
          assumed: c.requests
        },
        minutesEach: {
          value: state.answers.minutes || null,
          label: labelOf('minutes', state.answers.minutes),
          assumed: c.minutes
        },
        redos: {
          value: state.answers.redo || null,
          label: labelOf('redo', state.answers.redo),
          assumed: c.redoShare
        },
        handledBy: {
          value: state.answers.handler || null,
          label: labelOf('handler', state.answers.handler)
        },
        managementSystem: {
          value: state.answers.system || null,
          label: labelOf('system', state.answers.system)
        }
      },
      results: {
        weeklyHours: round(c.weekly),
        monthlyHours: round(c.monthly),
        hourlyRate: state.rate,
        monthlyCost: Math.round(c.cost)
      },
      startedAt: state.startedAt,
      timestamp: new Date().toISOString()
    };
  }

  function labelOf(field, key) {
    return key && CONFIG[field][key] ? CONFIG[field][key].label : null;
  }

  function round(n) { return Math.round(n * 100) / 100; }

  function snapshot() {
    return {
      sessionId: state.sessionId,
      step: state.step,
      name: state.name,
      answers: state.answers,
      rate: state.rate,
      startedAt: state.startedAt,
      updatedAt: new Date().toISOString()
    };
  }

  function saveProgress() {
    write(STORE + '.progress', snapshot());
  }

  function saveSubmission(payload) {
    var all = read(STORE + '.submissions', []);
    all.push(payload);
    write(STORE + '.submissions', all.slice(-20));
  }

  function track(event, data) {
    var log = read(STORE + '.events', []);
    log.push({ event: event, at: new Date().toISOString(), data: data || null });
    write(STORE + '.events', log.slice(-300));
  }

  function read(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* private mode or full storage: the flow still works */
    }
  }

  function uid() {
    return 'cwc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Save the submission first. The report only opens once the row is stored. */
  function deliverReport(payload) {
    if (!SHEET_ENDPOINT) {
      return new Promise(function (resolve) {
        track('save_skipped', { reason: 'no endpoint' });
        window.setTimeout(function () { resolve(payload); }, 400);
      });
    }

    return fetch(SHEET_ENDPOINT, {
      method: 'POST',
      /* text/plain keeps this a simple request, so there is no CORS preflight */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('Save failed: ' + res.status);
      return res.text();
    }).then(function (text) {
      var out = null;
      try { out = JSON.parse(text); } catch (err) { out = null; }
      if (out && out.ok === false) throw new Error(out.error || 'Save failed');
      return payload;
    });
  }

  printBtn.addEventListener('click', function () {
    track('report_print', { sessionId: state.sessionId });
    window.print();
  });

  /* ---------- init ---------- */

  function measure() {
    var active = panels[state.step];
    if (active) stage.style.height = active.offsetHeight + 'px';
  }

  if (window.ResizeObserver) {
    var ro = new ResizeObserver(measure);
    panels.forEach(function (panel) { ro.observe(panel); });
  }
  window.addEventListener('resize', measure);

  renderResults();
  paintProgress();
  updateChrome();
  measure();
  window.requestAnimationFrame(measure);
  track('view', { sessionId: state.sessionId });
})();
