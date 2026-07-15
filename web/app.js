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

  /** Default hash for the shared password. Change this by setting the
   *  HASH attribute on the password-gate div, or via localStorage override. */
  const DEFAULT_HASH = 'c6ceac439b57c451faed895a27d648a1bbef61e43e0dd818740c7e20c24e465d';

  const GATE = document.getElementById('password-gate');
  const DASH = document.getElementById('dashboard');
  const FORM = document.getElementById('password-form');
  const INPUT = document.getElementById('password-input');
  const ERROR = document.getElementById('password-error');
  const LOCK_BTN = document.getElementById('lock-btn');

  const HASH_KEY = 'career_ops_pw_hash';
  const UNLOCKED_KEY = 'career_ops_unlocked';

  async function sha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function checkPassword(input) {
    const expected = localStorage.getItem(HASH_KEY) || DEFAULT_HASH;
    const actual = await sha256(input);
    return actual === expected;
  }

  function unlock() {
    GATE.classList.add('hidden');
    DASH.classList.remove('hidden');
    localStorage.setItem(UNLOCKED_KEY, '1');
    // Load data after unlock so we're not fetching behind the gate forever
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
    const pw = INPUT.value.trim();
    if (!pw) return;
    const ok = await checkPassword(pw);
    if (ok) {
      unlock();
    } else {
      ERROR.textContent = 'Wrong password. Try again.';
      INPUT.value = '';
      INPUT.focus();
    }
  });

  LOCK_BTN.addEventListener('click', lock);

  // Check if already unlocked
  if (localStorage.getItem(UNLOCKED_KEY) === '1') {
    GATE.classList.add('hidden');
    DASH.classList.remove('hidden');
    loadDashboard();
  }

  /* ================================================================
   * Data loading & rendering
   * ================================================================ */

  const DATA_FILES = {
    katie: 'data/katie-roles.json',
    claire: 'data/claire-roles.json'
  };

  let currentTab = 'katie';
  let currentData = null;
  let cache = {};

  async function loadData(person) {
    if (cache[person]) return cache[person];
    try {
      const resp = await fetch(DATA_FILES[person]);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      cache[person] = data;
      return data;
    } catch (err) {
      console.error('Failed to load data for', person, err);
      return null;
    }
  }

  async function loadDashboard() {
    const person = currentTab;
    const data = await loadData(person);
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

  /** Format salary for display */
  function fmtSalary(amount) {
    if (amount == null || amount === undefined) return null;
    return '£' + amount.toLocaleString('en-GB');
  }

  function salaryDisplay(role, criteria) {
    const hasMin = role.salary.min != null;
    const hasMax = role.salary.max != null;
    if (!hasMin && !hasMax) return { text: 'Unpublished', cls: '' };
    if (hasMin && hasMax) {
      const minS = fmtSalary(role.salary.min);
      const maxS = fmtSalary(role.salary.max);
      return { text: `${minS} – ${maxS}`, cls: getSalaryCls(role, criteria) };
    }
    if (hasMin) return { text: `From ${fmtSalary(role.salary.min)}`, cls: getSalaryCls(role, criteria) };
    return { text: `Up to ${fmtSalary(role.salary.max)}`, cls: getSalaryCls(role, criteria) };
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
    const min = role.salary.min;
    const max = role.salary.max;
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
    const salary = salaryDisplay(role, criteria);
    const borderCls = getSalaryBorderClass(role, criteria);
    const fitCls = fitPillCls(role.fitScore);
    const hasUrl = role.url && role.url.startsWith('http');

    let salaryIcon = '';
    if (salary.cls === 'check') salaryIcon = '<span class="check">✓</span>';
    else if (salary.cls === 'warn') salaryIcon = '<span class="warn">⚠</span>';
    else if (salary.cls === 'cross') salaryIcon = '<span class="cross">✗</span>';

    let cultureHtml = '';
    if (role.culture && role.culture.glassdoor != null) {
      cultureHtml = `<span class="culture-badge">⭐ ${role.culture.glassdoor}</span>`;
    }

    let notesHtml = '';
    if (role.notes) {
      notesHtml = `<p class="card-notes">${escHtml(role.notes)}</p>`;
    }

    let linkHtml = '';
    if (hasUrl) {
      linkHtml = `<a href="${escAttr(role.url)}" class="card-link" target="_blank" rel="noopener">View Role →</a>`;
    }

    return `
      <div class="role-card ${borderCls}">
        <div class="card-header">
          <span class="card-company">${escHtml(role.company)}</span>
          <span class="fit-pill ${fitCls}">${role.fitScore != null ? role.fitScore.toFixed(1) : '?'}</span>
        </div>
        <p class="card-title">${escHtml(role.title)}</p>
        <div class="badges">
          <span class="badge badge-level">${escHtml(role.level)}</span>
          <span class="badge badge-location">${escHtml(role.location)}</span>
        </div>
        <div class="card-meta">
          <span class="salary-band">${salaryIcon} ${escHtml(salary.text)}</span>
          ${cultureHtml}
        </div>
        ${notesHtml}
        ${linkHtml}
      </div>`;
  }

  function renderProfileBar(data) {
    const c = data.candidate || 'Unknown';
    const p = data.profile || '';
    const crit = data.criteria || {};

    let criteriaHtml = '';
    if (crit.salaryFloor) {
      criteriaHtml += `<span><span class="icon">💰</span> £${crit.salaryFloor.toLocaleString()}+ ${crit.currency || 'GBP'}</span>`;
    }
    if (crit.remotePreference) {
      const icon = crit.remotePreference === 'fully-remote' ? '🏠' : '🏢';
      criteriaHtml += `<span><span class="icon">${icon}</span> ${formatPref(crit.remotePreference)}</span>`;
    }
    if (crit.cultureMandatory) {
      criteriaHtml += `<span><span class="icon">🛡️</span> Culture check</span>`;
    }

    return `
      <span class="name">${escHtml(c)}</span>
      <span class="profile-tag">${escHtml(p)}</span>
      <div class="criteria">${criteriaHtml}</div>`;
  }

  function formatPref(pref) {
    if (pref === 'fully-remote') return 'Fully remote';
    if (pref === 'hybrid-london') return 'Hybrid London';
    return pref;
  }

  function populateCompanyFilter(data) {
    const select = document.getElementById('filter-company');
    const currentVal = select.value;
    const companies = new Set();
    (data.roles || []).forEach(r => companies.add(r.company));
    (data.unverified || []).forEach(r => { if (r.company) companies.add(r.company); });

    select.innerHTML = '<option value="">All</option>';
    Array.from(companies).sort().forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    select.value = currentVal;
  }

  function applyFilters(data) {
    const salaryOnly = document.getElementById('filter-salary').checked;
    const minFit = parseFloat(document.getElementById('filter-fitscore').value) || 0;
    const company = document.getElementById('filter-company').value;
    const criteria = data.criteria || {};

    let roles = data.roles || [];
    if (salaryOnly) {
      roles = roles.filter(r => {
        if (r.salaryClears === true) return true;
        if (criteria.salaryFloor && r.salary.min != null && r.salary.max != null) {
          return r.salary.max >= criteria.salaryFloor;
        }
        return false;
      });
    }
    if (minFit > 0) {
      roles = roles.filter(r => r.fitScore != null && r.fitScore >= minFit);
    }
    if (company) {
      roles = roles.filter(r => r.company === company);
    }

    // Sort by fit score desc
    roles.sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));

    return roles;
  }

  function renderAll(data) {
    // Profile bar
    document.getElementById('candidate-profile').innerHTML = renderProfileBar(data);

    // Company filter
    populateCompanyFilter(data);

    // Filter and render cards
    const roles = applyFilters(data);
    const grid = document.getElementById('role-cards');
    const criteria = data.criteria || {};

    if (roles.length === 0) {
      grid.innerHTML = '';
      document.getElementById('empty-state').classList.remove('hidden');
    } else {
      document.getElementById('empty-state').classList.add('hidden');
      grid.innerHTML = roles.map(r => renderCard(r, criteria)).join('');
    }

    document.getElementById('role-count').textContent = `${roles.length} role${roles.length !== 1 ? 's' : ''}`;

    // Checked-empty
    const checked = data.checkedEmpty || [];
    document.getElementById('checked-count').textContent = checked.length;
    document.getElementById('checked-list').innerHTML = checked.map(c =>
      `<li><strong>${escHtml(c.company)}</strong> — ${escHtml(c.detail)}</li>`
    ).join('');
    if (checked.length === 0) {
      document.querySelector('.checked-empty').classList.add('hidden');
    } else {
      document.querySelector('.checked-empty').classList.remove('hidden');
    }

    // Dead
    const dead = data.dead || [];
    document.getElementById('dead-count').textContent = dead.length;
    document.getElementById('dead-list').innerHTML = dead.map(r =>
      `<li><strong>${escHtml(r.company)}</strong> — ${escHtml(r.title)} (${escHtml(r.notes || 'Closed')})</li>`
    ).join('');
    if (dead.length === 0) {
      document.getElementById('dead-section').classList.add('hidden');
    } else {
      document.getElementById('dead-section').classList.remove('hidden');
    }

    // Unverified
    const unver = data.unverified || [];
    document.getElementById('unverified-count').textContent = unver.length;
    document.getElementById('unverified-list').innerHTML = unver.map(r =>
      `<li><strong>${escHtml(r.company)}</strong> — ${escHtml(r.title)}: ${escHtml(r.notes || 'Unverified')}</li>`
    ).join('');
    if (unver.length === 0) {
      document.getElementById('unverified-section').classList.add('hidden');
    } else {
      document.getElementById('unverified-section').classList.remove('hidden');
    }

    // Footer
    document.getElementById('last-scan').textContent = data.lastScan || '—';
  }

  /* ================================================================
   * Tab switching
   * ================================================================ */

  document.getElementById('tab-nav').addEventListener('click', function (e) {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const tab = btn.dataset.tab;
    if (tab === currentTab) return;

    // Update active state
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    currentTab = tab;
    currentData = null;

    // Reset filters
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
    // Re-populate role-cards only; profile bar stays
    const roles = applyFilters(currentData);
    const grid = document.getElementById('role-cards');
    const criteria = currentData.criteria || {};

    if (roles.length === 0) {
      grid.innerHTML = '';
      document.getElementById('empty-state').classList.remove('hidden');
    } else {
      document.getElementById('empty-state').classList.add('hidden');
      grid.innerHTML = roles.map(r => renderCard(r, criteria)).join('');
    }
    document.getElementById('role-count').textContent = `${roles.length} role${roles.length !== 1 ? 's' : ''}`;
  }

  document.getElementById('filter-salary').addEventListener('change', onFilterChange);
  document.getElementById('filter-fitscore').addEventListener('change', onFilterChange);
  document.getElementById('filter-company').addEventListener('change', onFilterChange);

  /* ================================================================
   * Utilities
   * ================================================================ */

  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})();
