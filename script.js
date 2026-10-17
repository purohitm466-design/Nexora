'use strict';
(() => {
/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (tag, a = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(a)) {
    if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  e.append(...kids);
  return e;
};
const pad = n => String(n).padStart(2, '0');
const fmtT = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtN = n => Math.round(n).toLocaleString();
const last = a => a[a.length - 1];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- Demo data (all fictional) ---------- */
const SEV = ['Low', 'Medium', 'High', 'Critical'];
const GLYPH = { Low: '●', Medium: '▲', High: '◆', Critical: '✖' };
const STATUS = ['Open', 'Investigating', 'Mitigated', 'Resolved'];
const CATS = ['Network', 'Endpoint', 'Identity', 'Application'];
const TYPES = ['Port scan', 'Brute-force attempt', 'Malware signature', 'Phishing link', 'DDoS burst', 'Policy violation', 'Data exfiltration pattern', 'Unusual login'];
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const now = Date.now();
const EVENTS = Array.from({ length: 48 }, (_, i) => ({
  id: 'EVT-' + (4800 + i), type: pick(TYPES),
  source: `10.${Math.floor(rnd() * 250)}.${Math.floor(rnd() * 250)}.${Math.floor(rnd() * 250)}`,
  severity: pick(SEV), category: pick(CATS), status: pick(STATUS),
  time: new Date(now - i * 37 * 60000 - Math.floor(rnd() * 20) * 60000)
}));
const THREATS = ['Obsidian Loader', 'Violet Relay', 'Cipher Worm', 'Ghostline C2', 'Argon Stealer', 'Nimbus Phish Kit', 'Halcyon Botnet', 'Rift Ransom', 'Echo Tunnel', 'Lattice Scanner', 'Mirage Dropper', 'Sable Backdoor'].map((n, i) => ({
  id: 'THR-' + (210 + i), name: n, category: pick(['Malware', 'Phishing', 'Botnet', 'Ransomware', 'Recon']),
  severity: pick(SEV), source: pick(['Simulated Feed A', 'Simulated Feed B', 'Internal sensor (demo)', 'Honeypot (demo)']),
  time: new Date(now - i * 5400000), status: pick(['Active', 'Monitoring', 'Contained']),
  desc: `Fictional record describing ${n} behavior patterns, created only to demonstrate this interface.`
}));
const gen = (n, b, v) => Array.from({ length: n }, () => b + (rnd() - 0.5) * v);
const sim = { threats: 1284, blocked: 932, threat: gen(24, 40, 50), inn: gen(24, 620, 300), out: gen(24, 310, 160), hl: gen(24, 97.5, 2), sc: gen(24, 86, 4) };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TREND = { det: [42, 55, 38, 61, 70, 33, 47], mit: [39, 50, 36, 52, 60, 31, 44] };
const NODES = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2, r = i === 0 ? 0 : 0.15 + rnd() * 0.25;
  return { name: 'NODE-' + pad(i), role: i === 0 ? 'Core gateway' : ['Server', 'Workstation', 'IoT sensor', 'Database'][i % 4], ip: `10.0.${i}.${10 + i * 3}`,
    bx: 0.5 + Math.cos(a) * r * 1.1, by: 0.5 + Math.sin(a) * r * 0.95, ph: rnd() * 6.28, bad: [4, 11, 17].includes(i) };
});
const LINKS = NODES.slice(1).map((_, k) => { const i = k + 1; return [i, i < 6 ? 0 : Math.floor(rnd() * i)]; });

/* ---------- State & settings ---------- */
const ACC = { cyan: 'Cyan', blue: 'Blue', purple: 'Purple' };
const DEF = { accent: 'cyan', density: 'comfortable', anim: true, notify: true, showNet: true, showEvents: true };
const KEY = 'nexora.settings.v1';
const state = { view: 'overview', paused: false,
  ev: { q: '', sev: '', st: '', cat: '', k: 'time', d: -1, page: 1 }, lg: { q: '', sev: '', st: '', cat: '', k: 'time', d: -1, page: 1 }, th: { q: '', sev: 'All' } };
const loadS = () => {
  const s = { ...DEF };
  try {
    const o = JSON.parse(localStorage.getItem(KEY));
    if (o && typeof o === 'object') {
      if (typeof o.accent === 'string' && Object.hasOwn(ACC, o.accent)) s.accent = o.accent;
      if (o.density === 'compact' || o.density === 'comfortable') s.density = o.density;
      for (const k of ['anim', 'notify', 'showNet', 'showEvents']) if (typeof o[k] === 'boolean') s[k] = o[k];
    }
  } catch { /* invalid or missing storage: use defaults */ }
  return s;
};
let S = loadS();
const saveS = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('Preferences could not be saved in this browser.', 'warn'); } };
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const animOn = () => S.anim && !mq.matches;
let T = {};
const readTheme = () => {
  const c = getComputedStyle(document.documentElement), g = n => c.getPropertyValue(n).trim();
  T = { accent: g('--accent'), accent2: g('--accent2'), muted: g('--muted'), line: g('--line'), text: g('--text'), sev: [g('--low'), g('--med'), g('--high'), g('--crit')] };
};

/* ---------- UI primitives ---------- */
function toast(msg, type = 'ok') {
  const t = h('div', { class: 'toast ' + type, role: 'status', text: msg });
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3800);
}
const sevBadge = s => h('span', { class: 'sev s-' + s, text: `${GLYPH[s]} ${s}` });
const pill = s => h('span', { class: 'pill', text: s });
function openModal(title, rows, note) {
  $('#modal-title').textContent = title;
  $('#modal-body').replaceChildren(...rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', {}, v)]));
  $('#modal-note').textContent = note || 'Simulated demo record. Not real security data.';
  $('#modal').showModal();
}
const eventModal = e => openModal(e.id, [['Type', e.type], ['Source', e.source], ['Severity', sevBadge(e.severity)], ['Category', e.category], ['Timestamp', fmtT(e.time)], ['Status', pill(e.status)]]);

/* ---------- Canvas charts ---------- */
function setup(c) {
  const r = c.getBoundingClientRect(), d = devicePixelRatio || 1, W = Math.round(r.width * d), H = Math.round(r.height * d);
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const x = c.getContext('2d');
  x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, r.width, r.height);
  return { x, w: r.width, H: r.height };
}
const hourLab = i => (i === 23 ? 'now' : `-${23 - i}h`);
const sevCounts = () => SEV.map(s => EVENTS.filter(e => e.severity === s).length);
const CH = {
  threat: { type: 'line', lab: hourLab, series: () => [{ n: 'Threats detected', v: sim.threat, c: T.accent }] },
  traffic: { type: 'line', lab: hourLab, series: () => [{ n: 'Inbound', v: sim.inn, c: T.accent }, { n: 'Outbound (dashed)', v: sim.out, c: T.accent2, dash: true }] },
  trend: { type: 'bars', lab: i => DAYS[i], series: () => [{ n: 'Detected', v: TREND.det, c: T.accent }, { n: 'Mitigated', v: TREND.mit, c: T.accent2 }] },
  sev: { type: 'donut' }
};
function drawLine(c, ch) {
  const { x, w, H } = setup(c), ss = ch.series(), p = { l: 40, r: 12, t: 12, b: 24 }, iw = w - p.l - p.r, ih = H - p.t - p.b;
  const n = ss[0].v.length, max = Math.max(1, ...ss.flatMap(s => s.v)) * 1.15;
  x.font = '11px system-ui'; x.fillStyle = T.muted; x.strokeStyle = T.line; x.lineWidth = 1; x.textAlign = 'right';
  for (let i = 0; i <= 4; i++) { const y = p.t + (ih * i) / 4; x.beginPath(); x.moveTo(p.l, y); x.lineTo(w - p.r, y); x.stroke(); x.fillText(Math.round(max * (1 - i / 4)), p.l - 6, y + 4); }
  x.textAlign = 'center';
  for (let i = 23; i >= 0; i -= w < 480 ? 8 : 4) x.fillText(ch.lab(i), p.l + (iw * i) / (n - 1), H - 6);
  ss.forEach(s => {
    const pts = s.v.map((v, i) => [p.l + (iw * i) / (n - 1), p.t + ih * (1 - v / max)]);
    x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
    x.strokeStyle = s.c; x.lineWidth = 2; x.setLineDash(s.dash ? [6, 4] : []); x.stroke(); x.setLineDash([]);
    if (!s.dash) { const g = x.createLinearGradient(0, p.t, 0, H); g.addColorStop(0, s.c + '55'); g.addColorStop(1, s.c + '00'); x.lineTo(pts[n - 1][0], p.t + ih); x.lineTo(pts[0][0], p.t + ih); x.fillStyle = g; x.fill(); }
    if (c._h != null) { x.beginPath(); x.arc(pts[c._h][0], pts[c._h][1], 4, 0, 7); x.fillStyle = s.c; x.fill(); }
  });
  if (c._h != null) { const hx = p.l + (iw * c._h) / (n - 1); x.strokeStyle = T.muted; x.beginPath(); x.moveTo(hx, p.t); x.lineTo(hx, p.t + ih); x.stroke(); }
  c._g = { l: p.l, iw, n };
}
function drawBars(c, ch) {
  const { x, w, H } = setup(c), ss = ch.series(), p = { l: 34, r: 8, t: 12, b: 24 }, iw = w - p.l - p.r, ih = H - p.t - p.b, n = ss[0].v.length;
  const max = Math.max(...ss.flatMap(s => s.v)) * 1.15, gw = iw / n, bw = Math.min(22, (gw * 0.7) / ss.length);
  x.font = '11px system-ui'; x.fillStyle = T.muted; x.strokeStyle = T.line; x.textAlign = 'right';
  for (let i = 0; i <= 4; i++) { const y = p.t + (ih * i) / 4; x.beginPath(); x.moveTo(p.l, y); x.lineTo(w - p.r, y); x.stroke(); x.fillText(Math.round(max * (1 - i / 4)), p.l - 6, y + 4); }
  for (let i = 0; i < n; i++) {
    const cx = p.l + gw * i + gw / 2; x.fillStyle = T.muted; x.textAlign = 'center'; x.fillText(ch.lab(i), cx, H - 6);
    ss.forEach((s, j) => { const bh = (ih * s.v[i]) / max, bx = cx - (bw * ss.length) / 2 + bw * j; x.globalAlpha = c._h == null || c._h === i ? 1 : 0.45; x.fillStyle = s.c; x.fillRect(bx, p.t + ih - bh, bw - 2, bh); });
    x.globalAlpha = 1;
  }
  c._g = { l: p.l, iw, n };
}
function drawDonut(c) {
  const { x, w, H } = setup(c), cnt = sevCounts(), tot = cnt.reduce((a, b) => a + b, 0) || 1, cx = w / 2, cy = H / 2, R = Math.min(w, H) / 2 - 8;
  let a0 = -Math.PI / 2;
  cnt.forEach((v, i) => { const a1 = a0 + (v / tot) * Math.PI * 2; x.beginPath(); x.arc(cx, cy, R, a0, a1); x.arc(cx, cy, R * 0.62, a1, a0, true); x.closePath(); x.fillStyle = T.sev[i]; x.fill(); x.strokeStyle = '#0b1222'; x.lineWidth = 2; x.stroke(); a0 = a1; });
  x.fillStyle = T.text; x.textAlign = 'center'; x.font = '700 22px system-ui'; x.fillText(tot, cx, cy + 4); x.font = '11px system-ui'; x.fillStyle = T.muted; x.fillText('events', cx, cy + 20);
}
const charts = [];
function drawChart(o) {
  if (!o.c.offsetParent) return;
  const ch = CH[o.key];
  (ch.type === 'line' ? drawLine : ch.type === 'bars' ? drawBars : drawDonut)(o.c, ch);
}
function mountCharts() {
  $$('[data-chart]').forEach(root => {
    const key = root.dataset.chart, ch = CH[key], c = h('canvas', { role: 'img', 'aria-label': root.dataset.title + '. Simulated data.' });
    root.classList.add('panel');
    const lg = h('ul', { class: 'legend' });
    if (ch.type === 'donut') { const cn = sevCounts(), t = cn.reduce((a, b) => a + b, 0); SEV.forEach((s, i) => lg.append(h('li', {}, h('span', { class: 'sw s-' + s }), `${GLYPH[s]} ${s}: ${cn[i]} (${Math.round((cn[i] / t) * 100)}%)`))); }
    else ['', 'a2'].slice(0, 2).forEach((cls, i) => { const names = key === 'trend' ? ['Detected', 'Mitigated'] : key === 'traffic' ? ['Inbound', 'Outbound (dashed line)'] : ['Threats detected']; if (names[i]) lg.append(h('li', {}, h('span', { class: 'sw ' + cls }), names[i])); });
    root.append(h('h3', { text: root.dataset.title }), h('div', { class: 'chart' }, c), lg, h('p', { class: 'muted small', text: 'Simulated demo data' }));
    const o = { c, key }; charts.push(o); ro.observe(c.parentElement);
    if (ch.type !== 'donut') {
      const move = e => {
        const g = c._g; if (!g) return;
        const r = c.getBoundingClientRect(), px = e.clientX - r.left - g.l;
        const i = clamp(ch.type === 'line' ? Math.round((px / g.iw) * (g.n - 1)) : Math.floor(px / (g.iw / g.n)), 0, g.n - 1);
        if (c._h !== i) { c._h = i; drawChart(o); }
        showTip(`${ch.lab(i)}: ` + ch.series().map(s => `${s.n.replace(' (dashed)', '')} ${fmtN(s.v[i])}`).join(', '), e.clientX, e.clientY);
      };
      c.addEventListener('pointermove', move); c.addEventListener('pointerdown', move);
      c.addEventListener('pointerleave', () => { c._h = null; hideTip(); drawChart(o); });
    }
  });
}
function showTip(t, px, py) {
  const tip = $('#tip'); tip.textContent = t; tip.hidden = false;
  const w = tip.offsetWidth, hh = tip.offsetHeight;
  tip.style.left = clamp(px + 12, 8, innerWidth - w - 8) + 'px';
  tip.style.top = clamp(py - hh - 12, 8, innerHeight - hh - 8) + 'px';
}
const hideTip = () => { $('#tip').hidden = true; };
function spark(c, v) {
  const { x, w, H } = setup(c), mn = Math.min(...v), mx = Math.max(...v) || 1;
  x.beginPath(); v.forEach((y, i) => { const px = (w * i) / (v.length - 1), py = H - 3 - ((y - mn) / (mx - mn || 1)) * (H - 6); i ? x.lineTo(px, py) : x.moveTo(px, py); });
  x.strokeStyle = T.accent; x.lineWidth = 1.5; x.stroke();
}
let raf = 0;
const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(redrawAll); });
function redrawAll() { charts.forEach(drawChart); nets.forEach(n => (n.dirty = true)); cards.forEach(f => f()); }

/* ---------- Stat cards ---------- */
const cards = [];
const MAIN = [
  { icon: '⚠', label: 'Total Threats Detected', val: () => fmtN(sim.threats), trend: '▲ 4.2% vs last week', tone: 'bad', spark: () => sim.threat },
  { icon: '⇅', label: 'Network Activity', val: () => fmtN(last(sim.inn) + last(sim.out)) + ' Mbps', trend: '▲ 8.1% vs last hour', tone: 'good', spark: () => sim.inn },
  { icon: '♥', label: 'System Health', val: () => last(sim.hl).toFixed(1) + '%', trend: '▲ 0.3% vs yesterday', tone: 'good', spark: () => sim.hl },
  { icon: '◈', label: 'Security Score', val: () => Math.round(last(sim.sc)) + ' / 100', trend: '▼ 1.2 pts vs last week', tone: 'bad', spark: () => sim.sc }
];
const NET = [
  { icon: '↓', label: 'Inbound (Mbps)', val: () => fmtN(last(sim.inn)), trend: 'Simulated reading', tone: 'good', spark: () => sim.inn },
  { icon: '↑', label: 'Outbound (Mbps)', val: () => fmtN(last(sim.out)), trend: 'Simulated reading', tone: 'good', spark: () => sim.out },
  { icon: '◉', label: 'Connected nodes', val: () => String(NODES.length), trend: '3 flagged as suspicious', tone: 'bad', spark: () => sim.hl },
  { icon: '⛔', label: 'Blocked connections', val: () => fmtN(sim.blocked), trend: 'Simulated counter', tone: 'good', spark: () => sim.threat }
];
function statCard(cfg) {
  const val = h('div', { class: 'val' }), tr = h('div', { class: 'trend ' + cfg.tone }), sp = h('canvas', { 'aria-hidden': 'true' });
  const el = h('article', { class: 'card' }, h('div', { class: 'stat-head' }, h('i', { 'aria-hidden': 'true', text: cfg.icon }), h('span', { text: cfg.label })), val, tr, h('div', { class: 'spark' }, sp));
  tr.textContent = cfg.trend;
  cards.push(() => { val.textContent = cfg.val(); if (sp.offsetParent) spark(sp, cfg.spark()); });
  return el;
}
function mountCards() {
  $$('[data-cards]').forEach(r => r.append(...(r.dataset.cards === 'main' ? MAIN : NET).map(statCard)));
}

/* ---------- Tables (events + logs) ---------- */
const TABLES = { ev: { name: 'events', size: 8, f: ['sev', 'st'] }, lg: { name: 'activity logs', size: 12, f: ['sev', 'cat', 'st'] } };
const FOPT = { sev: ['Severity', SEV], st: ['Status', STATUS], cat: ['Category', CATS] };
const COLS = [['id', 'Event ID'], ['type', 'Event Type'], ['source', 'Source'], ['severity', 'Severity'], ['time', 'Timestamp'], ['status', 'Status']];
const sortVal = (e, k) => (k === 'time' ? +e.time : k === 'severity' ? SEV.indexOf(e.severity) : e[k]);
function filtered(st) {
  const q = st.q.trim().toLowerCase();
  return EVENTS.filter(e => (!st.sev || e.severity === st.sev) && (!st.st || e.status === st.st) && (!st.cat || e.category === st.cat) &&
    (!q || [e.id, e.type, e.source, e.status, e.category, e.severity].some(v => v.toLowerCase().includes(q))))
    .sort((a, b) => { const x = sortVal(a, st.k), y = sortVal(b, st.k); return (x > y ? 1 : x < y ? -1 : 0) * st.d; });
}
function buildTable(root) {
  const p = root.dataset.table, cfg = TABLES[p], st = state[p];
  const q = h('input', { type: 'search', placeholder: 'Search ' + cfg.name + '…', 'aria-label': 'Search ' + cfg.name, maxlength: '60', autocomplete: 'off' });
  q.addEventListener('input', () => { st.q = q.value; st.page = 1; render(); });
  const sels = cfg.f.map(k => {
    const [l, o] = FOPT[k], s = h('select', { 'aria-label': 'Filter by ' + l.toLowerCase() }, h('option', { value: '', text: l + ': all' }), ...o.map(v => h('option', { value: v, text: v })));
    s.addEventListener('change', () => { st[k] = s.value; st.page = 1; render(); });
    return s;
  });
  const clr = h('button', { class: 'btn ghost', type: 'button', text: 'Clear filters' });
  clr.addEventListener('click', () => { Object.assign(st, { q: '', sev: '', st: '', cat: '', page: 1 }); q.value = ''; sels.forEach(s => (s.value = '')); render(); toast('Filters cleared.'); });
  const tb = h('tbody'), ths = COLS.map(([k, l]) => {
    const b = h('button', { class: 'sort', type: 'button', text: l });
    b.addEventListener('click', () => { st.d = st.k === k ? -st.d : 1; st.k = k; render(); });
    return [k, h('th', { scope: 'col' }, b)];
  });
  const table = h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ...ths.map(t => t[1]), h('th', { scope: 'col', text: 'Actions' }))), tb);
  const wrap = h('div', { class: 'tbl-wrap' }, table);
  const empty = h('div', { class: 'empty', role: 'status' }, h('strong', { text: 'No matching events' }), h('span', { text: 'Try a different search or clear the filters.' }));
  const info = h('span', { class: 'muted small', role: 'status' }), prev = h('button', { class: 'btn ghost sm', type: 'button', text: '‹ Prev' }), next = h('button', { class: 'btn ghost sm', type: 'button', text: 'Next ›' });
  prev.addEventListener('click', () => { st.page--; render(); }); next.addEventListener('click', () => { st.page++; render(); });
  const pager = h('div', { class: 'pager' }, info, h('span', {}, prev, ' ', next));
  const row = e => {
    const b = h('button', { class: 'btn sm', type: 'button', 'aria-label': 'View details for ' + e.id, text: 'Details' });
    b.addEventListener('click', () => eventModal(e));
    const c = (l, v) => h('td', { 'data-label': l }, v);
    return h('tr', {}, c('Event ID', e.id), c('Event Type', e.type), c('Source', e.source), c('Severity', sevBadge(e.severity)), c('Timestamp', fmtT(e.time)), c('Status', pill(e.status)), c('Actions', b));
  };
  function render() {
    const rows = filtered(st), pages = Math.max(1, Math.ceil(rows.length / cfg.size));
    st.page = clamp(st.page, 1, pages);
    const s = (st.page - 1) * cfg.size;
    tb.replaceChildren(...rows.slice(s, s + cfg.size).map(row));
    wrap.hidden = pager.hidden = !rows.length; empty.hidden = rows.length > 0;
    info.textContent = rows.length ? `Showing ${s + 1}–${Math.min(s + cfg.size, rows.length)} of ${rows.length} (simulated)` : '';
    prev.disabled = st.page <= 1; next.disabled = st.page >= pages;
    ths.forEach(([k, th]) => th.setAttribute('aria-sort', k === st.k ? (st.d > 0 ? 'ascending' : 'descending') : 'none'));
  }
  st.qi = q;
  root.append(h('div', { class: 'toolbar' }, q, ...sels, clr), wrap, empty, pager);
  render();
}

/* ---------- Threat intelligence ---------- */
function renderThreats() {
  const st = state.th, q = st.q.trim().toLowerCase();
  const rows = THREATS.filter(t => (st.sev === 'All' || t.severity === st.sev) && (!q || [t.id, t.name, t.category, t.source, t.status].some(v => v.toLowerCase().includes(q))));
  $('#th-grid').replaceChildren(...rows.map(t => {
    const b = h('button', { class: 'tcard', type: 'button', 'aria-label': `${t.name}, ${t.severity} severity. Open details` },
      h('strong', { text: t.name }), h('span', { class: 'muted small', text: `${t.id} · ${t.category}` }), h('span', {}, sevBadge(t.severity), ' ', pill(t.status)), h('span', { class: 'muted small', text: fmtT(t.time) }));
    b.addEventListener('click', () => openModal(t.name, [['ID', t.id], ['Category', t.category], ['Severity', sevBadge(t.severity)], ['Source', t.source], ['Timestamp', fmtT(t.time)], ['Status', pill(t.status)], ['Summary', t.desc]]));
    return b;
  }));
  $('#th-empty').hidden = rows.length > 0;
}
function mountThreats() {
  const stat = (l, v) => h('article', { class: 'card' }, h('div', { class: 'stat-head', text: l }), h('div', { class: 'val', text: String(v) }));
  $('#th-cards').append(stat('Tracked threats', THREATS.length), stat('Critical / High', THREATS.filter(t => t.severity === 'Critical' || t.severity === 'High').length), stat('Active', THREATS.filter(t => t.status === 'Active').length), stat('Contained', THREATS.filter(t => t.status === 'Contained').length));
  ['All', ...SEV].forEach(s => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(s === 'All'), text: s === 'All' ? 'All' : `${GLYPH[s]} ${s}` });
    b.addEventListener('click', () => { state.th.sev = s; $$('#th-chips .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b))); renderThreats(); });
    $('#th-chips').append(b);
  });
  $('#th-q').addEventListener('input', e => { state.th.q = e.target.value; renderThreats(); });
  renderThreats();
}

/* ---------- Network visualization ---------- */
const nets = [];
function createNet(root) {
  const c = h('canvas', { role: 'img', 'aria-label': 'Animated simulated network map. Select a node for details.' });
  const info = h('p', { class: 'net-info', text: 'Select a node to see details (simulated). Nodes with a dashed ring are flagged suspicious in the demo data.' });
  root.append(h('div', { class: 'net-stage' }, c), info); ro.observe(c.parentElement);
  const parts = Array.from({ length: 36 }, () => ({ l: Math.floor(rnd() * LINKS.length), t: rnd(), s: 0.002 + rnd() * 0.004 }));
  const net = { c, dirty: true, sel: -1, hov: -1, pos: [] };
  net.step = (t, live) => { if (live) parts.forEach(p => { p.t += p.s; if (p.t > 1) { p.t = 0; p.l = Math.floor(rnd() * LINKS.length); } }); net.t = live ? t : net.t || 0; };
  net.draw = () => {
    const { x, w, H } = setup(c), m = 24, t = net.t || 0;
    net.pos = NODES.map(n => [m + (n.bx + Math.sin(t / 2200 + n.ph) * 0.012) * (w - 2 * m), m + (n.by + Math.cos(t / 2600 + n.ph) * 0.012) * (H - 2 * m)]);
    x.lineWidth = 1;
    LINKS.forEach(([a, b]) => { x.strokeStyle = NODES[a].bad || NODES[b].bad ? T.sev[3] + '88' : T.accent + '44'; x.beginPath(); x.moveTo(...net.pos[a]); x.lineTo(...net.pos[b]); x.stroke(); });
    parts.forEach(p => { const [a, b] = LINKS[p.l], [x1, y1] = net.pos[a], [x2, y2] = net.pos[b]; x.fillStyle = NODES[a].bad || NODES[b].bad ? T.sev[3] : T.accent2; x.beginPath(); x.arc(x1 + (x2 - x1) * p.t, y1 + (y2 - y1) * p.t, 2.2, 0, 7); x.fill(); });
    NODES.forEach((n, i) => {
      const [px, py] = net.pos[i], r = i === 0 ? 9 : 5.5;
      x.beginPath(); x.arc(px, py, r, 0, 7); x.fillStyle = n.bad ? T.sev[3] : T.accent; x.fill();
      if (n.bad) { x.setLineDash([3, 3]); x.strokeStyle = T.sev[3]; x.beginPath(); x.arc(px, py, r + 6, 0, 7); x.stroke(); x.setLineDash([]); }
      if (i === net.sel || i === net.hov) { x.strokeStyle = T.text; x.lineWidth = 2; x.beginPath(); x.arc(px, py, r + 3, 0, 7); x.stroke(); x.lineWidth = 1; }
    });
  };
  const hit = e => { const r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; return net.pos.findIndex(([px, py]) => Math.hypot(px - mx, py - my) < 14); };
  c.addEventListener('pointermove', e => { const i = hit(e); if (i !== net.hov) { net.hov = i; c.style.cursor = i >= 0 ? 'pointer' : 'default'; net.dirty = true; } });
  c.addEventListener('click', e => {
    const i = hit(e); if (i < 0) return;
    const n = NODES[i], deg = LINKS.filter(l => l.includes(i)).length;
    net.sel = i; net.dirty = true;
    info.textContent = `${n.name} · ${n.role} · ${n.ip} · ${deg} links · ${n.bad ? 'FLAGGED suspicious (simulated)' : 'healthy (simulated)'}`;
  });
  nets.push(net);
}
let lastFrame = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (document.hidden || t - lastFrame < 32) return;
  lastFrame = t;
  const live = animOn() && !state.paused;
  nets.forEach(n => { if (!n.c.offsetParent) return; if (live || n.dirty) { n.step(t, live); n.draw(); n.dirty = false; } });
}

/* ---------- Simulation tick, notifications ---------- */
const notifs = [{ m: 'Welcome to the NEXORA demo. All alerts are simulated.', t: new Date(), r: false }, { m: 'Sample alert: Unusual login pattern (fictional).', t: new Date(now - 600000), r: false }];
function renderNotifs() {
  const un = notifs.filter(n => !n.r).length, b = $('#notif-badge');
  b.hidden = !un; b.textContent = un;
  $('#notif-list').replaceChildren(...notifs.slice(0, 12).map(n => h('li', { class: n.r ? '' : 'unread' }, n.m, h('time', { text: fmtT(n.t) }))));
}
function tick() {
  if (state.paused || document.hidden) return;
  const push = (a, v, lo, hi) => { a.push(clamp(v, lo, hi)); a.shift(); };
  push(sim.threat, last(sim.threat) + (rnd() - 0.5) * 20, 5, 95); push(sim.inn, last(sim.inn) + (rnd() - 0.5) * 90, 300, 950);
  push(sim.out, last(sim.out) + (rnd() - 0.5) * 60, 120, 520); push(sim.hl, last(sim.hl) + (rnd() - 0.5) * 0.6, 94, 99.9); push(sim.sc, last(sim.sc) + (rnd() - 0.5) * 1.2, 80, 92);
  sim.threats += Math.round(rnd() * 4); sim.blocked += Math.round(rnd() * 9);
  const a = pick(NODES), b = pick(NODES);
  if (a !== b) {
    const d = new Date(), li = h('li', { text: `[SIM] ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${a.name} → ${b.name}: ${pick(['TLS handshake allowed', 'blocked by demo policy', 'DNS lookup', 'flagged for review'])}` });
    const ul = $('#net-events'); ul.prepend(li); while (ul.children.length > 8) ul.lastChild.remove();
  }
  if (S.notify && rnd() < 0.3) {
    const sv = pick(SEV), m = `Simulated ${sv.toLowerCase()} event: ${pick(TYPES)} from ${pick(EVENTS).source}`;
    notifs.unshift({ m, t: new Date(), r: false }); renderNotifs();
    if (sv === 'High' || sv === 'Critical') toast(m, 'warn');
  }
  charts.forEach(o => { if (CH[o.key].type === 'line') drawChart(o); }); cards.forEach(f => f());
}

/* ---------- Reports ---------- */
const repRows = () => { const v = $('#rep-range').value, hrs = v === 'all' ? Infinity : Number(v); return EVENTS.filter(e => now - e.time <= hrs * 3600000); };
function barRow(label, n, tot) { const r = h('div', { class: 'bar' }, h('span', { text: label }), h('i', {}), h('span', { text: String(n) })); r.children[1].parentElement.style.setProperty('--w', '0'); r.children[1].style.setProperty('--w', Math.round((n / (tot || 1)) * 100) + '%'); return r; }
function renderReport() {
  const rows = repRows(), out = $('#rep-out');
  $('#rep-meta').textContent = `Range: ${$('#rep-range').selectedOptions[0].text} · Generated ${fmtT(new Date())}`;
  if (!rows.length) { out.replaceChildren(h('div', { class: 'empty' }, h('strong', { text: 'No events in this range' }), h('span', { text: 'Choose a wider range to generate a report.' }))); return; }
  const by = (k, list) => list.map(v => [v, rows.filter(e => e[k] === v).length]);
  const types = TYPES.map(t => [t, rows.filter(e => e.type === t).length]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  out.replaceChildren(h('p', { text: `${rows.length} simulated events in range. Top event type: ${types[0][0]}.` }),
    h('h4', { text: 'By severity' }), h('div', { class: 'bars' }, ...by('severity', SEV).map(([l, n]) => barRow(`${GLYPH[l]} ${l}`, n, rows.length))),
    h('h4', { text: 'By status' }), h('div', { class: 'bars' }, ...by('status', STATUS).map(([l, n]) => barRow(l, n, rows.length))),
    h('h4', { text: 'Top event types' }), h('div', { class: 'bars' }, ...types.map(([l, n]) => barRow(l, n, rows.length))));
}
function downloadCSV() {
  const rows = repRows();
  if (!rows.length) { toast('No events in this range. Nothing to export.', 'warn'); return; }
  try {
    const q = v => { let s = String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const lines = [['Event ID', 'Event Type', 'Source', 'Severity', 'Category', 'Timestamp', 'Status'].map(q).join(','), ...rows.map(e => [e.id, e.type, e.source, e.severity, e.category, e.time.toISOString(), e.status].map(q).join(','))];
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const d = new Date(), a = h('a', { href: url, download: `nexora-demo-report-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`CSV downloaded (${rows.length} simulated events).`);
  } catch { toast('The CSV file could not be created.', 'error'); }
}

/* ---------- Navigation, drawer, dropdowns ---------- */
const VIEWS = ['overview', 'threats', 'network', 'logs', 'reports', 'settings'];
function show(v, push = true) {
  if (!VIEWS.includes(v)) v = 'overview';
  state.view = v;
  $$('.view').forEach(s => (s.hidden = s.id !== 'view-' + v));
  $$('.nav-btn').forEach(b => { const on = b.dataset.view === v; b.classList.toggle('active', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); });
  closeNav(); hideTip();
  if (push) history.replaceState(null, '', '#' + v);
  if (v === 'reports') renderReport();
  scrollTo(0, 0);
  requestAnimationFrame(redrawAll);
}
function openNav() { $('#sidebar').classList.add('open'); $('#scrim').hidden = false; document.body.classList.add('lock'); $('#menu-btn').setAttribute('aria-expanded', 'true'); $('.nav-btn.active')?.focus(); }
function closeNav() { $('#sidebar').classList.remove('open'); $('#scrim').hidden = true; document.body.classList.remove('lock'); $('#menu-btn').setAttribute('aria-expanded', 'false'); }
const DDS = [['notif-btn', 'notif-panel'], ['prof-btn', 'prof-menu']];
function closeDD() { DDS.forEach(([b, p]) => { $('#' + p).hidden = true; $('#' + b).setAttribute('aria-expanded', 'false'); }); }
const SHORTCUTS = 'Shortcuts: / focus search · 1–6 switch sections · Esc close panels.';

/* ---------- Settings ---------- */
function applySettings() {
  const r = document.documentElement;
  r.dataset.accent = S.accent; r.dataset.density = S.density; r.dataset.anim = S.anim ? 'on' : 'off';
  readTheme();
  $('#ov-net').hidden = !S.showNet; $('#ov-events').hidden = !S.showEvents;
  $('#set-density').value = S.density; $('#set-anim').checked = S.anim; $('#set-notify').checked = S.notify; $('#set-net').checked = S.showNet; $('#set-events').checked = S.showEvents;
  $$('#accents .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.accent === S.accent)));
  requestAnimationFrame(redrawAll);
}
function mountSettings() {
  Object.entries(ACC).forEach(([k, l]) => { const b = h('button', { class: 'chip', type: 'button', 'data-accent': k, 'aria-pressed': 'false', text: l }); b.addEventListener('click', () => { S.accent = k; saveS(); applySettings(); }); $('#accents').append(b); });
  $('#set-density').addEventListener('change', e => { S.density = e.target.value === 'compact' ? 'compact' : 'comfortable'; saveS(); applySettings(); });
  [['set-anim', 'anim'], ['set-notify', 'notify'], ['set-net', 'showNet'], ['set-events', 'showEvents']].forEach(([id, k]) => $('#' + id).addEventListener('change', e => { S[k] = e.target.checked; saveS(); applySettings(); }));
  $('#set-reset').addEventListener('click', () => { if (!confirm('Reset all preferences to their defaults?')) return; S = { ...DEF }; try { localStorage.removeItem(KEY); } catch { /* ignore */ } applySettings(); toast('Settings reset to defaults.'); });
}

/* ---------- Init ---------- */
function init() {
  mountCards(); mountCharts(); $$('[data-table]').forEach(buildTable); $$('[data-net]').forEach(createNet); mountThreats(); mountSettings(); renderNotifs();
  applySettings();
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
  $('.brand').addEventListener('click', e => { e.preventDefault(); show('overview'); });
  $('#menu-btn').addEventListener('click', () => ($('#sidebar').classList.contains('open') ? closeNav() : openNav()));
  $('#scrim').addEventListener('click', closeNav);
  addEventListener('resize', () => { if (innerWidth >= 768) closeNav(); });
  DDS.forEach(([b, p]) => $('#' + b).addEventListener('click', e => { e.stopPropagation(); const open = $('#' + p).hidden; closeDD(); $('#' + p).hidden = !open; $('#' + b).setAttribute('aria-expanded', String(open)); }));
  document.addEventListener('click', e => { if (!e.target.closest('.dd')) closeDD(); });
  $('#notif-clear').addEventListener('click', () => { notifs.forEach(n => (n.r = true)); renderNotifs(); });
  $('#prof-menu').addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return; closeDD();
    if (a === 'settings') show('settings'); else if (a === 'keys') toast(SHORTCUTS); else openModal('About this demo', [['Purpose', 'Frontend portfolio demonstration'], ['Data', 'All values are simulated and fictional'], ['Stack', 'HTML, CSS, vanilla JavaScript']], 'No data is collected or transmitted.');
  });
  $('#modal-x').addEventListener('click', () => $('#modal').close());
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') e.target.close(); });
  $('#g-q').addEventListener('input', e => { state.lg.q = e.target.value; state.lg.page = 1; state.lg.qi.value = e.target.value; state.lg.qi.dispatchEvent(new Event('input')); if (state.view !== 'logs') show('logs'); });
  $('#pause-btn').addEventListener('click', e => { state.paused = !state.paused; e.target.textContent = state.paused ? 'Resume demo' : 'Pause demo'; e.target.setAttribute('aria-pressed', String(state.paused)); toast(state.paused ? 'Simulation paused.' : 'Simulation resumed.'); });
  $('#rep-gen').addEventListener('click', e => { const b = e.target; b.disabled = true; b.textContent = 'Generating…'; $('#rep-out').replaceChildren(h('span', { class: 'spin', role: 'status', 'aria-label': 'Generating report' })); setTimeout(() => { renderReport(); b.disabled = false; b.textContent = 'Generate report'; toast('Report generated.'); }, 600); });
  $('#rep-range').addEventListener('change', renderReport);
  $('#rep-csv').addEventListener('click', downloadCSV);
  $('#rep-print').addEventListener('click', () => { renderReport(); print(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDD(); closeNav(); return; }
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); $('#g-q').focus(); } else if (/^[1-6]$/.test(e.key)) show(VIEWS[e.key - 1]); else if (e.key === '?') toast(SHORTCUTS);
  });
  const clk = () => { const d = new Date(); $('#clock').textContent = d.toLocaleTimeString([], { hour12: false }); $('#date').textContent = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };
  clk(); setInterval(clk, 1000); setInterval(tick, 3500);
  mq.addEventListener?.('change', () => nets.forEach(n => (n.dirty = true)));
  show(location.hash.slice(1), false);
  requestAnimationFrame(loop);
  setTimeout(() => { $('#boot').classList.add('done'); }, 600);
}
init();
})();
