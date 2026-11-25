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

  var doneTitle = document.getElementById('h8');
  var doneLede = document.getElementById('done-lede');
  var doneEmail = document.getElementById('done-email');
  var doneFine = document.getElementById('done-fine');
  var doneDl = document.getElementById('done-dl');
  var doneDlWrap = document.getElementById('done-dl-wrap');

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
    reportBtn.textContent = 'Sending\u2026';

    var payload = buildPayload();
    saveSubmission(payload);

    /* The report is made here, in the background, and posted with the submission so the
       receiver can store the row and email the attachment. Nothing is shown on screen. */
    var pdf = null;
    try {
      pdf = buildReportPdf(payload);
      track('pdf_built', { sessionId: state.sessionId, bytes: pdf.length });
    } catch (err) {
      pdf = null;
      track('pdf_failed', { sessionId: state.sessionId, error: String(err) });
    }

    deliverReport(payload, pdf).then(function () {
      state.submitted = true;
      track('submit', payload);
      showSent(payload, null, true);
    }, function (err) {
      state.submitted = true;
      track('submit_unsent', {
        sessionId: state.sessionId,
        reason: String((err && err.message) || err)
      });
      showSent(payload, pdf, false);
    });
  });

  /* ---------- the PDF: built quietly, emailed by the receiver ---------- */

  var PDF_W = 595.28;
  var PDF_H = 841.89;
  var PDF_M = 48;
  var PDF_INNER = PDF_W - PDF_M * 2;

  var WIN_ANSI = {
    '\u2018': 0x91, '\u2019': 0x92, '\u201c': 0x93, '\u201d': 0x94,
    '\u2013': 0x96, '\u2014': 0x97, '\u2026': 0x85, '\u00b7': 0xb7,
    '\u00b0': 0xb0, '\u00a0': 0x20, '\u2022': 0x95
  };

  var TIME_POINTS = [
    'Requests arrive missing a detail \u2014 the certificate holder\u2019s full name and address, the additional insured wording, or the dates. Someone has to go back to the requester or the insured before anything can be issued.',
    'The certificate goes out with the wrong limits, entity name or address, and the whole thing is reissued. That is the round trip that never shows up on a timesheet.',
    'Chasing the answer \u2014 following up with the insured, the lender or the certificate holder, often more than once, before the request can be closed.'
  ];

  var measureCanvas = null;

  function pdfText(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      var mapped = WIN_ANSI[str.charAt(i)];
      if (mapped) out += String.fromCharCode(mapped);
      else if (code >= 32 && code < 127) out += str.charAt(i);
      else out += '?';
    }
    return out.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function pdfWidth(str, size, bold) {
    if (!measureCanvas) measureCanvas = document.createElement('canvas');
    var ctx = measureCanvas.getContext('2d');
    ctx.font = (bold ? 'bold ' : '') + size + 'px Arial, Helvetica, sans-serif';
    return ctx.measureText(str).width;
  }

  function wrapText(str, size, bold, maxWidth) {
    var words = String(str).split(/\s+/);
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (!line || pdfWidth(test, size, bold) <= maxWidth) line = test;
      else { lines.push(line); line = words[i]; }
    }
    if (line) lines.push(line);
    return lines;
  }

  function Page() {
    this.ops = [];
    this.y = PDF_H - 56;
    this.content = function () { return this.ops.join('\n'); };
  }

  Page.prototype.text = function (str, o) {
    o = o || {};
    var size = o.size || 10.5;
    var bold = !!o.bold;
    var gray = typeof o.gray === 'number' ? o.gray : 0;
    var x = typeof o.x === 'number' ? o.x : PDF_M;
    var y = typeof o.y === 'number' ? o.y : this.y;
    var track = typeof o.track === 'number' ? ' ' + o.track + ' Tc' : '';
    this.ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf' + track + ' ' +
      gray.toFixed(3) + ' g 1 0 0 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Tm (' +
      pdfText(str) + ') Tj ET');
  };

  Page.prototype.block = function (str, o) {
    o = o || {};
    var size = o.size || 10.5;
    var bold = !!o.bold;
    var lh = o.lh || size * 1.5;
    var indent = o.indent || 0;
    var lines = wrapText(str, size, bold, PDF_INNER - indent);
    for (var i = 0; i < lines.length; i++) {
      if (i) this.y -= lh;
      this.text(lines[i], { size: size, bold: bold, gray: o.gray, x: PDF_M + indent });
    }
    this.y -= lh;
  };

  Page.prototype.heading = function (str, size) {
    var lines = wrapText(str, size, true, PDF_INNER);
    for (var i = 0; i < lines.length; i++) {
      if (i) this.y -= size * 1.22;
      this.text(lines[i], { size: size, bold: true });
    }
    this.y -= size * 1.45;
  };

  Page.prototype.section = function (label) {
    this.text(label.toUpperCase(), { size: 8, bold: true, gray: 0.45, track: 1.1 });
    this.y -= 19;
  };

  Page.prototype.rule = function (gray, gap) {
    var y = (this.y + (gap || 0)).toFixed(2);
    this.ops.push((gray || 0.85).toFixed(3) + ' G 0.7 w ' + PDF_M + ' ' + y + ' m ' +
      (PDF_W - PDF_M).toFixed(2) + ' ' + y + ' l S');
  };

  function buildReportPdf(p) {
    var r = p.results;
    var a = p.answers;
    var when = new Date(p.timestamp);

    /* ---- page one ---- */
    var one = new Page();
    one.heading('Certificate Workload Report for ' + p.agency, 18);
    one.text(MONTHS[when.getMonth()] + ' ' + when.getDate() + ', ' + when.getFullYear() +
      ' \u00b7 Prepared for ' + p.name, { size: 9.5, gray: 0.4 });
    one.y -= 14;
    one.rule(0.82);
    one.y -= 40;

    one.text('About ' + Math.round(r.monthlyHours) + ' hours a month,', { size: 19, gray: 0.25 });
    one.y -= 36;
    one.text('roughly ' + money(r.monthlyCost), { size: 30, bold: true });
    one.y -= 52;

    one.section('Your answers');

    var rows = [
      ['Certificate requests per week', a.requestsPerWeek.label || ''],
      ['Minutes per request', a.minutesEach.label || ''],
      ['How often one needs redoing', a.redos.label || ''],
      ['Who handles them', a.handledBy.label || ''],
      ['Management system', a.managementSystem.label || '']
    ];

    rows.forEach(function (item) {
      one.text(item[0], { size: 10.5, gray: 0.3 });
      one.text(item[1], { size: 10.5, bold: true, x: PDF_W - PDF_M - pdfWidth(item[1], 10.5, true) });
      one.y -= 8;
      one.rule(0.87);
      one.y -= 16;
    });

    one.y -= 14;
    one.section('How this was calculated');
    one.block(count(r.requestsPerWeek) + ' requests a week at ' + count(r.minutesEach) +
      ' minutes each is about ' + hrs(r.baseWeeklyHours) + ' hours, plus ' +
      hrs(r.redoWeeklyHours) + ' hours for redos. That is ' +
      hrs(r.monthlyHours) + ' hours a month, and at $' + r.hourlyRate + ' an hour it comes to ' +
      money(r.monthlyCost) + '.', { size: 10.5, lh: 15.5, gray: 0.1 });
    one.y -= 6;
    one.block('Everything above is an estimate built from the five answers given \u2014 not a quote, ' +
      'and not an industry benchmark. Change the hourly rate to see it at your own loaded cost.',
      { size: 10.5, lh: 15.5, gray: 0.4 });

    pageFooter(one);

    /* ---- page two ---- */
    var two = new Page();
    two.heading('What it means', 18);
    two.y -= 8;

    two.section('Where the time usually goes');
    TIME_POINTS.forEach(function (point) {
      var lines = wrapText(point, 10.5, false, PDF_INNER - 16);
      for (var i = 0; i < lines.length; i++) {
        if (i === 0) two.text('\u2022', { size: 10.5, gray: 0.45 });
        two.text(lines[i], { size: 10.5, gray: 0.1, x: PDF_M + 16 });
        two.y -= 15.5;
      }
      two.y -= 10;
    });

    two.y -= 12;
    two.section('What 10 hours back would mean');
    two.block(tenHoursText(r.monthlyHours), { size: 10.5, lh: 15.5, gray: 0.1 });

    /* next-step box */
    var boxBody = 'Want to see what AI extracts from your real requests? Send 10 past requests ' +
      'with names removed and I\u2019ll send back what it finds, free.';
    var who = BRAND.name + ' \u00b7 ' + BRAND.email;
    var pad = 18;
    var bodyLines = wrapText(boxBody, 10.5, false, PDF_INNER - pad * 2);
    var top = two.y + 6;
    var labelY = top - pad - 8;
    var bodyY = labelY - 22;
    var whoY = bodyY - (bodyLines.length - 1) * 15.5 - 18;
    var bottom = whoY - 8;
    var boxH = top - bottom;

    two.ops.push('0.9 w 0 g ' + PDF_M + ' ' + bottom.toFixed(2) + ' ' + PDF_INNER.toFixed(2) + ' ' +
      boxH.toFixed(2) + ' re S');
    two.text('NEXT STEP', { size: 8, bold: true, y: labelY, track: 1.1 });
    bodyLines.forEach(function (line, i) {
      two.text(line, { size: 10.5, gray: 0.1, y: bodyY - i * 15.5 });
    });
    two.text(who, { size: 10.5, bold: true, y: whoY });
    two.y = bottom - 24;

    pageFooter(two);

    return makePdf([one.content(), two.content()]);
  }

  function pageFooter(page) {
    page.text(BRAND.name + ' \u00b7 ' + BRAND.email, { size: 8.5, gray: 0.45, y: 62 });
    page.ops.push('0.87 G 0.7 w ' + PDF_M + ' 74 m ' + (PDF_W - PDF_M).toFixed(2) + ' 74 l S');
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

  function makePdf(contents) {
    var count = contents.length;
    var total = 4 + count * 2;
    var bodies = {};
    var kids = [];
    var i;

    for (i = 0; i < count; i++) kids.push((5 + i * 2) + ' 0 R');

    bodies[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    bodies[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + count + ' >>';
    bodies[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    bodies[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    for (i = 0; i < count; i++) {
      var pageObj = 5 + i * 2;
      var contentObj = pageObj + 1;
      bodies[pageObj] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PDF_W + ' ' + PDF_H + ']' +
        ' /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + contentObj + ' 0 R >>';
      bodies[contentObj] = '<< /Length ' + contents[i].length + ' >>\nstream\n' + contents[i] +
        '\nendstream';
    }

    var bytes = [];
    function push(str) {
      for (var j = 0; j < str.length; j++) bytes.push(str.charCodeAt(j) & 0xff);
    }

    var offsets = [];
    push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
    for (var n = 1; n <= total; n++) {
      offsets[n] = bytes.length;
      push(n + ' 0 obj\n' + bodies[n] + '\nendobj\n');
    }

    var startxref = bytes.length;
    push('xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n');
    for (n = 1; n <= total; n++) {
      push(('0000000000' + offsets[n]).slice(-10) + ' 00000 n \n');
    }
    push('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R >>\nstartxref\n' + startxref +
      '\n%%EOF\n');

    return new Uint8Array(bytes);
  }

  function toBase64(bytes) {
    var chunk = 0x8000;
    var out = '';
    for (var i = 0; i < bytes.length; i += chunk) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return window.btoa(out);
  }

  function pdfFileName(p) {
    var slug = String(p.agency || 'agency').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return 'certificate-workload-report-' + (slug || 'agency') + '.pdf';
  }

  function el(id) { return document.getElementById(id); }

  /* The visitor never sees the report on screen: it is emailed. If the send fails we
     hand them the same file to download, so nobody is left without their report. */
  function showSent(payload, pdf, sent) {

    doneEmail.textContent = payload.email;
    doneTitle.textContent = sent
      ? 'That\u2019s it \u2014 your report is on the way.'
      : 'Your report is ready.';
    doneLede.textContent = sent
      ? 'Your two-page report is being emailed now. It usually lands within a minute \u2014 if it is not there, check your spam folder.'
      : 'The email did not go through just now. Download your two-page report below \u2014 it is built from the answers you just gave.';
    doneFine.textContent = sent
      ? 'An estimate from your answers, not a quote.'
      : 'An estimate from your answers, not a quote.';

    if (pdf) {
      var blob = new Blob([pdf], { type: 'application/pdf' });
      doneDl.href = URL.createObjectURL(blob);
      doneDl.download = pdfFileName(payload);
      doneDlWrap.hidden = false;
    }

    setStep(8);
  }

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
        monthlyCost: Math.round(c.cost),
        requestsPerWeek: c.requests,
        minutesEach: c.minutes,
        baseWeeklyHours: round(c.baseWeekly),
        redoWeeklyHours: round(c.redoWeekly)
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

  /* Posts the submission and the attached report to the receiver, which stores the row and
     emails the PDF. Resolves only when both happened; rejects so the page can hand over the
     file instead. */
  function deliverReport(payload, pdf) {
    if (!SHEET_ENDPOINT) {
      track('save_skipped', { reason: 'no endpoint' });
      return Promise.reject(new Error('not-configured'));
    }

    var body = {};
    Object.keys(payload).forEach(function (key) { body[key] = payload[key]; });
    if (pdf) {
      body.pdf = toBase64(pdf);
      body.pdfName = pdfFileName(payload);
    }

    return fetch(SHEET_ENDPOINT, {
      method: 'POST',
      /* text/plain keeps this a simple request, so there is no CORS preflight */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error('Send failed: ' + res.status);
      return res.text();
    }).then(function (text) {
      var out;
      try { out = JSON.parse(text); } catch (err) { out = null; }
      if (!out) throw new Error('unexpected reply');
      if (out.ok === false) throw new Error(out.error || 'send failed');
      return payload;
    });
  }

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
