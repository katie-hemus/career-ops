/**
 * Career Ops Dashboard — app.js
 * Single-page dashboard for Katie Hemus & Claire job search pipeline.
 * Studio aesthetic: sage green, cream, charcoal. Vanilla JS, no framework.
 */

(function () {
  'use strict';

  /* ================================================================
   * Password gate — SHA-256 via SubtleCrypto
   * ================================================================ */

  var DEFAULT_HASH = '7ff15882d4da0c935a77ae57b38f50362e4acc84a825d53fd5427452949bc580';

  var GATE = document.getElementById('password-gate');
  var DASH = document.getElementById('dashboard');
  var FORM = document.getElementById('password-form');
  var INPUT = document.getElementById('password-input');
  var ERROR = document.getElementById('password-error');
  var LOCK_BTN = document.getElementById('lock-btn');

  var HASH_KEY = 'career_ops_hash';
  var UNLOCKED_KEY = 'career_ops_unlocked';

  console.log('Career Ops Dashboard: initializing');
  console.log('Gate found:', !!GATE, 'Dash found:', !!DASH, 'Form found:', !!FORM);

  async function sha256(text) {
    try {
      var enc = new TextEncoder().encode(text);
      var buf = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf))
        .map(function (b) { return b.toString(16).padStart(2, '0'); })
        .join('');
    } catch (err) {
      console.error('crypto.subtle failed:', err);
      // Fallback: basic hash using string char codes (not secure, just for this gate)
      return simpleHash(text);
    }
  }

  function simpleHash(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) {
      h = ((h << 5) - h) + text.charCodeAt(i);
      h |= 0;
    }
    // Prefix so it's distinct from the real SHA-256
    return 'simple_' + Math.abs(h).toString(16);
  }

  async function checkPassword(input) {
    var expected = localStorage.getItem(HASH_KEY) || DEFAULT_HASH;
    // If stored hash is a simple_ one, use simpleHash for comparison
    if (expected.indexOf('simple_') === 0) {
      return simpleHash(input) === expected;
    }
    try {
      var actual = await sha256(input);
      return actual === expected;
    } catch (err) {
      console.error('checkPassword error:', err);
      return false;
    }
  }

  function unlock() {
    GATE.classList.add('hidden');
    DASH.classList.remove('hidden');
    localStorage.setItem(UNLOCKED_KEY, '1');
    loadDashboard();
  }

  function lock() {
    DASH.classList.add('hidden');
    GATE.classList.remove('hidden');
    INPUT.value = '';
    ERROR.textContent = '';
    localStorage.removeItem(UNLOCKED_KEY);
  }

  FORM.addEventListener('submit', async function (e) {
    e.preventDefault();
    try {
      var pw = INPUT.value.trim();
      if (!pw) return;
      var ok = await checkPassword(pw);
      if (ok) {
        unlock();
      } else {
        ERROR.textContent = 'Wrong password. Try again.';
        INPUT.value = '';
        INPUT.focus();
      }
    } catch (err) {
      console.error('Form submit error:', err);
      ERROR.textContent = 'Something went wrong. Check console for details.';
    }
  });

  if (LOCK_BTN) {
    LOCK_BTN.addEventListener('click', lock);
  }

  // Check if already unlocked
  if (localStorage.getItem(UNLOCKED_KEY) === '1') {
    GATE.classList.add('hidden');
    DASH.classList.remove('hidden');
    loadDashboard();
  }

  /* ================================================================
   * Data loading & rendering
   * ================================================================ */

  var DATA_FILES = {
    katie: 'data/katie-roles.json',
    claire: 'data/claire-roles.json',
    jonny: 'data/jonny-roles.json'
  };

  var currentTab = 'katie';
  var currentData = null;
  var cache = {};

  async function loadData(person) {
    if (cache[person]) return cache[person];
    try {
      var resp = await fetch(DATA_FILES[person]);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var data = await resp.json();
      cache[person] = data;
      return data;
    } catch (err) {
      console.error('Failed to load data for', person, err);
      return null;
    }
  }

  async function loadDashboard() {
    var person = currentTab;
    var data = await loadData(person);
    if (!data) {
      document.getElementById('role-cards').innerHTML =
        '<div class="empty-state"><p>Failed to load data. Check the console for details.</p></div>';
      return;
    }
    currentData = data;
    renderAll(data);
  }

  /* ================================================================
   * Rendering
   * ================================================================ */

  function fmtSalary(amount) {
    if (amount == null || amount === undefined) return null;
    return '\u00A3' + amount.toLocaleString('en-GB');
  }

  function salaryDisplay(role, criteria) {
    var hasMin = role.salary.min != null;
    var hasMax = role.salary.max != null;
    if (!hasMin && !hasMax) return { text: 'Unpublished', cls: '' };
    if (hasMin && hasMax) {
      return { text: fmtSalary(role.salary.min) + ' \u2013 ' + fmtSalary(role.salary.max), cls: getSalaryCls(role, criteria) };
    }
    if (hasMin) return { text: 'From ' + fmtSalary(role.salary.min), cls: getSalaryCls(role, criteria) };
    return { text: 'Up to ' + fmtSalary(role.salary.max), cls: getSalaryCls(role, criteria) };
  }

  function getSalaryCls(role, criteria) {
    if (!role.salaryClears && role.salaryClears !== undefined) return '';
    if (role.salaryClears === true) return 'check';
    if (criteria && criteria.salaryFloor && role.salary.min != null && role.salary.min < criteria.salaryFloor) {
      if (role.salary.max != null && role.salary.max >= criteria.salaryFloor) return 'warn';
      return 'cross';
    }
    return '';
  }

  function getSalaryBorderClass(role, criteria) {
    if (role.salaryClears === true) return 'salary-clears';
    if (!criteria || !criteria.salaryFloor) return '';
    var min = role.salary.min;
    var max = role.salary.max;
    if (min != null && max != null && min < criteria.salaryFloor && max >= criteria.salaryFloor) {
      return 'salary-borderline';
    }
    if (min != null && min < criteria.salaryFloor && (max == null || max < criteria.salaryFloor)) {
      return 'salary-below';
    }
    if (role.salaryClears === false) return 'salary-below';
    return '';
  }

  function fitPillCls(score) {
    if (score == null) return '';
    if (score >= 4.0) return 'high';
    if (score >= 3.0) return 'mid';
    return 'low';
  }

  function renderCard(role, criteria) {
    var salary = salaryDisplay(role, criteria);
    var borderCls = getSalaryBorderClass(role, criteria);
    var fitCls = fitPillCls(role.fitScore);
    var hasUrl = role.url && role.url.indexOf('http') === 0;

    var salaryIcon = '';
    if (salary.cls === 'check') salaryIcon = '<span class="check">\u2713</span>';
    else if (salary.cls === 'warn') salaryIcon = '<span class="warn">\u26A0</span>';
    else if (salary.cls === 'cross') salaryIcon = '<span class="cross">\u2717</span>';

    var cultureHtml = '';
    if (role.culture && role.culture.glassdoor != null) {
      cultureHtml = '<span class="culture-badge">\u2B50 ' + role.culture.glassdoor + '</span>';
    }

    var inHouseHtml = '';
    if (role.inHouse !== undefined) {
      inHouseHtml = '<span class="badge ' + (role.inHouse ? 'badge-inhouse' : 'badge-agency') + '">' +
        (role.inHouse ? '\uD83C\uDFE2 In-house' : '\uD83D\uDCE2 Agency') + '</span>';
    }

    var notesHtml = '';
    if (role.notes) {
      notesHtml = '<p class="card-notes">' + escHtml(role.notes) + '</p>';
    }

    var linkHtml = '';
    if (hasUrl) {
      linkHtml = '<a href="' + escAttr(role.url) + '" class="card-link" target="_blank" rel="noopener">View Role \u2192</a>';
    }

    return '<div class="role-card ' + borderCls + '">' +
      '<div class="card-header">' +
        '<span class="card-company">' + escHtml(role.company) + '</span>' +
        '<span class="fit-pill ' + fitCls + '">' + (role.fitScore != null ? role.fitScore.toFixed(1) : '?') + '</span>' +
      '</div>' +
      '<p class="card-title">' + escHtml(role.title) + '</p>' +
      '<div class="badges">' +
        '<span class="badge badge-level">' + escHtml(role.level) + '</span>' +
        '<span class="badge badge-location">' + escHtml(role.location) + '</span>' +
        inHouseHtml +
      '</div>' +
      '<div class="card-meta">' +
        '<span class="salary-band">' + salaryIcon + ' ' + escHtml(salary.text) + '</span>' +
        cultureHtml +
      '</div>' +
      notesHtml +
      linkHtml +
    '</div>';
  }

  function renderProfileBar(data) {
    var c = data.candidate || 'Unknown';
    var p = data.profile || '';
    var crit = data.criteria || {};

    var criteriaHtml = '';
    if (crit.salaryFloor) {
      criteriaHtml += '<span><span class="icon">\uD83D\uDCB0</span> \u00A3' + crit.salaryFloor.toLocaleString() + '+ ' + (crit.currency || 'GBP') + '</span>';
    }
    if (crit.remotePreference) {
      var icon = crit.remotePreference === 'fully-remote' ? '\uD83C\uDFE0' : '\uD83C\uDFE2';
      criteriaHtml += '<span><span class="icon">' + icon + '</span> ' + formatPref(crit.remotePreference) + '</span>';
    }
    if (crit.prefersInHouse) {
      criteriaHtml += '<span><span class="icon">\uD83C\uDFE2</span> Prefers in-house</span>';
    }
    if (crit.cultureMandatory) {
      criteriaHtml += '<span><span class="icon">\uD83D\uDEE1\uFE0F</span> Culture check</span>';
    }

    return '<span class="name">' + escHtml(c) + '</span>' +
      '<span class="profile-tag">' + escHtml(p) + '</span>' +
      '<div class="criteria">' + criteriaHtml + '</div>';
  }

  function formatPref(pref) {
    if (pref === 'fully-remote') return 'Fully remote';
    if (pref === 'hybrid-london') return 'Hybrid London';
    if (pref === 'hybrid-manchester-or-fully-remote') return 'Hybrid Manchester / Remote';
    return pref;
  }

  function populateCompanyFilter(data) {
    var select = document.getElementById('filter-company');
    var currentVal = select.value;
    var companies = {};
    (data.roles || []).forEach(function (r) { companies[r.company] = true; });
    (data.unverified || []).forEach(function (r) { if (r.company) companies[r.company] = true; });
    (data.dropped || []).forEach(function (r) { if (r.company) companies[r.company] = true; });

    select.innerHTML = '<option value="">All</option>';
    Object.keys(companies).sort().forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    select.value = currentVal;
  }

  function applyFilters(data) {
    var salaryOnly = document.getElementById('filter-salary').checked;
    var minFit = parseFloat(document.getElementById('filter-fitscore').value) || 0;
    var company = document.getElementById('filter-company').value;
    var criteria = data.criteria || {};

    var roles = (data.roles || []).slice();
    if (salaryOnly) {
      roles = roles.filter(function (r) {
        if (r.salaryClears === true) return true;
        if (criteria.salaryFloor && r.salary.min != null && r.salary.max != null) {
          return r.salary.max >= criteria.salaryFloor;
        }
        return false;
      });
    }
    if (minFit > 0) {
      roles = roles.filter(function (r) { return r.fitScore != null && r.fitScore >= minFit; });
    }
    if (company) {
      roles = roles.filter(function (r) { return r.company === company; });
    }

    roles.sort(function (a, b) { return (b.fitScore || 0) - (a.fitScore || 0); });
    return roles;
  }

  function renderAll(data) {
    document.getElementById('candidate-profile').innerHTML = renderProfileBar(data);
    populateCompanyFilter(data);

    var roles = applyFilters(data);
    var grid = document.getElementById('role-cards');
    var criteria = data.criteria || {};

    if (roles.length === 0) {
      grid.innerHTML = '';
      document.getElementById('empty-state').classList.remove('hidden');
    } else {
      document.getElementById('empty-state').classList.add('hidden');
      grid.innerHTML = roles.map(function (r) { return renderCard(r, criteria); }).join('');
    }

    document.getElementById('role-count').textContent = roles.length + ' role' + (roles.length !== 1 ? 's' : '');

    // Checked-empty
    var checked = data.checkedEmpty || [];
    document.getElementById('checked-count').textContent = checked.length;
    document.getElementById('checked-list').innerHTML = checked.map(function (c) {
      return '<li><strong>' + escHtml(c.company) + '</strong> \u2014 ' + escHtml(c.detail) + '</li>';
    }).join('');
    var ceSection = document.querySelector('.checked-empty');
    if (ceSection) ceSection.classList.toggle('hidden', checked.length === 0);

    // Dead
    var dead = data.dead || [];
    var ds = document.getElementById('dead-section');
    if (ds) {
      document.getElementById('dead-count').textContent = dead.length;
      document.getElementById('dead-list').innerHTML = dead.map(function (r) {
        return '<li><strong>' + escHtml(r.company) + '</strong> \u2014 ' + escHtml(r.title) + ' (' + escHtml(r.notes || 'Closed') + ')</li>';
      }).join('');
      ds.classList.toggle('hidden', dead.length === 0);
    }

    // Unverified
    var unver = data.unverified || [];
    var us = document.getElementById('unverified-section');
    if (us) {
      document.getElementById('unverified-count').textContent = unver.length;
      document.getElementById('unverified-list').innerHTML = unver.map(function (r) {
        return '<li><strong>' + escHtml(r.company) + '</strong> \u2014 ' + escHtml(r.title) + ': ' + escHtml(r.notes || 'Unverified') + '</li>';
      }).join('');
      us.classList.toggle('hidden', unver.length === 0);
    }

    // Dropped
    var dropped = data.dropped || [];
    var dropSection = document.getElementById('dropped-section');
    if (dropSection) {
      document.getElementById('dropped-count').textContent = dropped.length;
      document.getElementById('dropped-list').innerHTML = dropped.map(function (r) {
        return '<li><strong>' + escHtml(r.company) + '</strong> \u2014 ' + escHtml(r.title) + ': ' + escHtml(r.reason || '') + '</li>';
      }).join('');
      dropSection.classList.toggle('hidden', dropped.length === 0);
    }

    document.getElementById('last-scan').textContent = data.lastScan || '\u2014';
  }

  /* ================================================================
   * Tab switching
   * ================================================================ */

  document.getElementById('tab-nav').addEventListener('click', function (e) {
    var btn = e.target.closest('.tab');
    if (!btn) return;
    var tab = btn.dataset.tab;
    if (tab === currentTab) return;

    document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    btn.classList.add('active');

    currentTab = tab;
    currentData = null;

    document.getElementById('filter-salary').checked = false;
    document.getElementById('filter-fitscore').value = '0';
    document.getElementById('filter-company').value = '';

    loadDashboard();
  });

  /* ================================================================
   * Filter change events
   * ================================================================ */

  function onFilterChange() {
    if (!currentData) return;
    var roles = applyFilters(currentData);
    var grid = document.getElementById('role-cards');
    var criteria = currentData.criteria || {};

    if (roles.length === 0) {
      grid.innerHTML = '';
      document.getElementById('empty-state').classList.remove('hidden');
    } else {
      document.getElementById('empty-state').classList.add('hidden');
      grid.innerHTML = roles.map(function (r) { return renderCard(r, criteria); }).join('');
    }
    document.getElementById('role-count').textContent = roles.length + ' role' + (roles.length !== 1 ? 's' : '');
  }

  document.getElementById('filter-salary').addEventListener('change', onFilterChange);
  document.getElementById('filter-fitscore').addEventListener('change', onFilterChange);
  document.getElementById('filter-company').addEventListener('change', onFilterChange);

  /* ================================================================
   * Utilities
   * ================================================================ */

  function escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})();
