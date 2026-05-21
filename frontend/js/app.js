const API = '/api';

// ── Stage config ─────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'applied',     label: 'Applied',     color: '#7A9E9F' },
  { key: 'submitted',   label: 'Submitted',   color: '#6B8F71' },
  { key: 'interviewed', label: 'Interviewed', color: '#8B7355' },
  { key: 'offer',       label: 'Offer',       color: '#7A8C5E' },
  { key: 'rejected',    label: 'Rejected',    color: '#B5767A' },
];

// ── App state ─────────────────────────────────────────────────────────────────
const state = {
  entries:    [],
  stats:      null,
  page:       1,
  totalPages: 1,
  total:      0,
  filters:    { status: '', source: '', search: '' },
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const api = {
  list:   (params) => apiFetch(`/applications?${new URLSearchParams(params)}`),
  stats:  ()       => apiFetch('/applications/stats'),
  create: (body)   => apiFetch('/applications',      { method: 'POST',   body: JSON.stringify(body) }),
  update: (id, b)  => apiFetch(`/applications/${id}`,{ method: 'PATCH',  body: JSON.stringify(b) }),
  remove: (id)     => apiFetch(`/applications/${id}`,{ method: 'DELETE' }),
  parse:  (url)    => apiFetch('/parse',             { method: 'POST',   body: JSON.stringify({ url }) }),
};

// ── Load everything ───────────────────────────────────────────────────────────

async function loadAll() {
  const [listRes, statsRes] = await Promise.all([
    api.list({
      page:   state.page,
      limit:  50,
      status: state.filters.status,
      source: state.filters.source,
      search: state.filters.search,
    }),
    api.stats(),
  ]);

  state.entries    = listRes;
  state.stats      = statsRes;

  renderMetrics();
  renderFunnel();
  renderTable();
  updateHeaderCount();
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function renderMetrics() {
  const f = state.stats?.funnel || {};
  document.getElementById('metrics-grid').innerHTML = STAGES.map(s => {
    const n = s.key === 'applied' ? (f.total ?? 0) : (f[s.key] ?? 0);
    return `<div class="metric">
      <div class="metric-label">${s.label}</div>
      <div class="metric-value" style="color:${s.color}">${n}</div>
    </div>`;
  }).join('');
}

// ── Funnel ────────────────────────────────────────────────────────────────────

function renderFunnel() {
  const f     = state.stats?.funnel || {};
  const total = f.total || 1;

  const counts = {
    applied:     f.total       || 0,
    submitted:   f.submitted   || 0,
    interviewed: f.interviewed || 0,
    offer:       f.offer       || 0,
    rejected:    f.rejected    || 0,
  };

  const el = document.getElementById('funnel-wrap');
  el.innerHTML = '';

  STAGES.forEach((s, i) => {
    const n   = counts[s.key];
    const pct = Math.round((n / total) * 100);

    const row = document.createElement('div');
    row.className = 'stage-row';
    row.innerHTML = `
      <div class="stage-label">${s.label}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.max(5, pct)}%;background:${s.color}">${n}</div>
      </div>
      <div class="stage-pct">${pct}%</div>
    `;
    el.appendChild(row);

    if (i < STAGES.length - 1 && s.key !== 'rejected') {
      const arrow = document.createElement('div');
      arrow.className = 'arrow-row';
      arrow.innerHTML = '<i class="ti ti-chevron-down"></i>';
      el.appendChild(arrow);
    }
  });
}

// ── Table ─────────────────────────────────────────────────────────────────────

function renderTable() {
  const tbody = document.getElementById('app-tbody');

  if (!state.entries.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No applications yet. Paste a job URL above to get started.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = state.entries.map(e => {
    const st = STAGES.find(s => s.key === e.status);
    const link = e.url
      ? `<a href="${esc(e.url)}" target="_blank" rel="noopener" style="color:var(--c-blue);display:flex;align-items:center">
           <i class="ti ti-external-link"></i>
         </a>`
      : '';

    return `<tr>
      <td class="cell-company">${esc(e.company)}</td>
      <td class="cell-role">${esc(e.role)}</td>
      <td class="cell-jobid">${esc(e.job_id)}</td>
      <td class="cell-source">${esc(e.source)}</td>
      <td>
        <select class="inline-select"
          onchange="updateStatus(${e.id}, this.value)"
          style="background:${st.color}18;color:${st.color};border-color:${st.color}44">
          ${STAGES.map(s =>
            `<option value="${s.key}" ${s.key === e.status ? 'selected' : ''}>${s.label}</option>`
          ).join('')}
        </select>
      </td>
      <td class="cell-date">${e.applied_at}</td>
      <td>${link}</td>
      <td class="cell-actions">
        <button class="btn-ghost" onclick="deleteEntry(${e.id}, '${esc(e.company)}')" title="Delete">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function updateHeaderCount() {
  const el = document.getElementById('header-meta');
  if (el) el.textContent = `${state.entries.length} applications`;
}

// ── URL parse + add flow ──────────────────────────────────────────────────────

async function fetchJobFromUrl() {
  const url = document.getElementById('inp-url').value.trim();
  if (!url) { setStatus('Paste a job URL first.', 'error'); return; }

  setStatus('Fetching and parsing…', 'loading');
  document.getElementById('btn-fetch').disabled = true;
  showSkeleton();

  try {
    const parsed = await api.parse(url);
    showPreviewFields();
    document.getElementById('f-company').value      = parsed.company || '';
    document.getElementById('f-role').value         = parsed.role    || '';
    document.getElementById('f-jobid').value        = parsed.jobId   || '';
    document.getElementById('f-source').value       = parsed.source  || 'Company Website';
    document.getElementById('f-url-stored').value   = url;

    setStatus('Details extracted — review and confirm.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
    hidePreview();
  } finally {
    document.getElementById('btn-fetch').disabled = false;
  }
}

async function confirmAdd() {
  const company = document.getElementById('f-company').value.trim();
  const role    = document.getElementById('f-role').value.trim();
  const status  = document.getElementById('f-status').value;
  const jobId   = document.getElementById('f-jobid').value.trim();
  const source  = document.getElementById('f-source').value.trim();
  const url     = document.getElementById('f-url-stored').value.trim();

  if (!company) { document.getElementById('f-company').focus(); return; }

  try {
    document.getElementById('btn-confirm').disabled = true;
    await api.create({ company, role, job_id: jobId, url, status, source, notes: '' });
    clearPreview();
    toast(`Added ${company}`);
    await loadAll();
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    document.getElementById('btn-confirm').disabled = false;
  }
}

// ── Status update ─────────────────────────────────────────────────────────────

async function updateStatus(id, status) {
  try {
    await api.update(id, { status });
    await loadAll();
  } catch (err) {
    toast(err.message);
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteEntry(id, company) {
  if (!confirm(`Remove "${company}" from your tracker?`)) return;
  try {
    await api.remove(id);
    toast(`Removed ${company}`);
    await loadAll();
  } catch (err) {
    toast(err.message);
  }
}

// ── Filters ───────────────────────────────────────────────────────────────────

function applyFilter(key, value) {
  state.filters[key] = value;
  state.page = 1;
  loadAll();
}

let searchDebounce;
function onSearch(value) {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.filters.search = value;
    state.page = 1;
    loadAll();
  }, 300);
}

// ── Preview card helpers ──────────────────────────────────────────────────────

function showSkeleton() {
  document.getElementById('preview-card').classList.add('visible');
  document.getElementById('preview-fields').innerHTML = `
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
  `;
  document.getElementById('preview-actions').innerHTML = '';
}

function showPreviewFields() {
  document.getElementById('preview-fields').innerHTML = `
    <div class="field">
      <label for="f-company">Company</label>
      <input id="f-company" type="text" placeholder="Company name"/>
    </div>
    <div class="field">
      <label for="f-role">Role</label>
      <input id="f-role" type="text" placeholder="Job title"/>
    </div>
    <div class="field">
      <label for="f-jobid">Job ID</label>
      <input id="f-jobid" type="text" placeholder="Req ID"/>
    </div>
    <div class="field">
      <label for="f-source">Source</label>
      <select id="f-source">
        <option>LinkedIn</option>
        <option>Indeed</option>
        <option>Greenhouse</option>
        <option>Lever</option>
        <option>Workday</option>
        <option>Company Website</option>
        <option>Referral</option>
        <option>Other</option>
      </select>
    </div>
    <div class="field full">
      <label for="f-status">Status</label>
      <select id="f-status">
        <option value="applied">Applied</option>
        <option value="submitted">Submitted</option>
        <option value="interviewed">Interviewed</option>
        <option value="offer">Offer</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>
    <input type="hidden" id="f-url-stored"/>
  `;
  document.getElementById('preview-actions').innerHTML = `
    <button onclick="clearPreview()">Cancel</button>
    <button class="btn-primary" id="btn-confirm" onclick="confirmAdd()">
      <i class="ti ti-plus"></i> Add to tracker
    </button>
  `;
}

function hidePreview() {
  document.getElementById('preview-card').classList.remove('visible');
}

function clearPreview() {
  hidePreview();
  document.getElementById('inp-url').value = '';
  setStatus('', '');
}

// ── Status message ────────────────────────────────────────────────────────────

function setStatus(msg, type) {
  const el = document.getElementById('status-msg');
  el.className = `status-msg${type ? ` ${type}` : ''}`;
  if (!msg) { el.innerHTML = ''; return; }
  const icon = type === 'loading' ? '<div class="spinner"></div>'
             : type === 'error'   ? '<i class="ti ti-alert-circle"></i>'
             : '<i class="ti ti-circle-check"></i>';
  el.innerHTML = `${icon} ${msg}`;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Keyboard shortcut ─────────────────────────────────────────────────────────

document.getElementById('inp-url').addEventListener('keydown', e => {
  if (e.key === 'Enter') fetchJobFromUrl();
});

// ── Boot ──────────────────────────────────────────────────────────────────────

loadAll();