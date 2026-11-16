// Token Launch Radar — the board page. Reads window.RADAR (written beside
// this page by main.ts), renders the ranked board, wires the filters and
// sort, and opens a per-protocol detail view with the model's working and
// the farm plan. No network, no framework, no build step.

'use strict';

const R = window.RADAR;
const $ = (id) => document.getElementById(id);
const els = {
  meta: $('meta'), stats: $('stats'), count: $('count'), rows: $('rows'), empty: $('empty'),
  q: $('q'), status: $('f-status'), chain: $('f-chain'), cat: $('f-cat'), tvl: $('f-tvl'), sort: $('f-sort'),
  detail: $('detail'), scrim: $('scrim'), fine: $('fine'), valid: $('valid'),
};

const money = (n) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
};
const years = (days) => (days === null ? '—' : days < 60 ? `${days}d` : `${(days / 365.25).toFixed(1)}y`);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function changeCell(v) {
  if (v === null) return '<span class="flat">—</span>';
  const cls = v > 0.05 ? 'up' : v < -0.05 ? 'down' : 'flat';
  return `<span class="${cls}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
}

function rowHtml(r) {
  const pill = r.status === 'launched'
    ? '<span class="pill live">LAUNCHED</span>'
    : '<span class="pill pre">PRE-TOKEN</span>' + (r.on_watchlist ? '<span class="pill watch">WATCHLIST</span>' : '');
  const chains = r.chains.slice(0, 2).join(', ') + (r.chains.length > 2 ? ` +${r.chains.length - 2}` : '');
  const badge = r.status === 'pre-token' ? ` <span class="conf c${r.breakdown.confidence}">${r.breakdown.confidence}</span>` : '';
  return `<td class="num rank">${r.rank}</td>
    <td><span class="pname">${esc(r.name)}</span>${pill}<br><span class="pslug">${esc(r.slug)}</span></td>
    <td class="cat">${esc(r.category ?? '—')}</td>
    <td class="chains">${esc(chains)}</td>
    <td class="num">${money(r.tvl_usd)}</td>
    <td class="num">${changeCell(r.change_7d)}</td>
    <td class="num">${years(r.breakdown.age_days)}</td>
    <td class="num value">${money(r.implied_value_usd)}${badge}</td>`;
}

function currentRows() {
  const q = els.q.value.trim().toLowerCase();
  const status = els.status.value;
  const chain = els.chain.value;
  const cat = els.cat.value;
  const minTvl = Number(els.tvl.value || 0);
  const sort = els.sort.value;
  let rows = R.rows.filter((r) =>
    (status === 'all' || r.status === status) &&
    (chain === '' || r.chains.includes(chain)) &&
    (cat === '' || (r.category ?? '') === cat) &&
    r.tvl_usd >= minTvl &&
    (q === '' || r.name.toLowerCase().includes(q) || r.slug.includes(q)));
  if (sort === 'tvl') rows = [...rows].sort((a, b) => b.tvl_usd - a.tvl_usd);
  else if (sort === 'growth') rows = [...rows].sort((a, b) => (b.change_7d ?? -Infinity) - (a.change_7d ?? -Infinity));
  else if (sort === 'age') rows = [...rows].sort((a, b) => (b.breakdown.age_days ?? -1) - (a.breakdown.age_days ?? -1));
  return rows;
}

function render() {
  const rows = currentRows();
  els.rows.innerHTML = rows.map((r) => {
    const tr = document.createElement('tr');
    tr.className = (r.rank <= 3 ? 'top ' : '') + (r.status === 'launched' ? 'launched' : '');
    tr.dataset.slug = r.slug;
    tr.innerHTML = rowHtml(r);
    return tr.outerHTML;
  }).join('');
  els.empty.hidden = rows.length > 0;
  els.count.textContent = `${rows.length} contacts on screen · ${R.rows.length} ranked in all`;
  for (const tr of els.rows.querySelectorAll('tr')) {
    tr.addEventListener('click', () => openDetail(tr.dataset.slug));
  }
}

function factorRow(label, value, widthPct, shown) {
  return `<div class="factor"><span class="flabel">${label}</span><span class="fbar"><i style="width:${widthPct}%"></i></span><span class="fval">${shown}</span></div>`;
}

function openDetail(slug) {
  const r = R.rows.find((x) => x.slug === slug);
  if (!r) return;
  const b = r.breakdown;
  const multBar = Math.min(100, (b.base_multiple / 3) * 100);
  const momBar = Math.min(100, Math.max(0, ((b.momentum_factor - 0.85) / 0.3) * 100));
  const matBar = Math.min(100, ((b.maturity_factor - 1) / 0.5) * 100);
  const model = r.status === 'launched'
    ? `<p>This protocol's token already trades, so the radar carries it at its recorded market cap — an anchor, not a model output.</p>
       ${factorRow('Real mcap / TVL', b.base_multiple, multBar, `${b.base_multiple.toFixed(2)}×`)}`
    : `${factorRow('Category multiple', b.base_multiple, multBar, `${b.base_multiple.toFixed(2)}×`)}
       ${factorRow('Momentum (7d TVL)', b.momentum_factor, momBar, `${b.momentum_factor.toFixed(2)}×`)}
       ${factorRow('Maturity (time tokenless)', b.maturity_factor, matBar, `${b.maturity_factor.toFixed(2)}×`)}
       <p>TVL ${money(r.tvl_usd)} × ${b.base_multiple.toFixed(2)} × ${b.momentum_factor.toFixed(2)} × ${b.maturity_factor.toFixed(2)} = <b>${money(r.implied_value_usd)}</b> implied value. Size slope: ${b.size_slope.toFixed(3)}.</p>
       <p class="sub">The multiple is size-adjusted: market-cap/TVL falls as TVL grows, so the model corrects each peer to this protocol's size. Ratios are winsorised to the global 5–95 percentile band, and category statistics are shrunk toward the global median by peer count (${b.calibration_peers} peers, weight n/(n+6)).</p>
       <p class="sub">Honest band: the middle half of corrected peer outcomes gives ${money(b.value_low_usd)} – ${money(b.value_high_usd)}</p>`;
  els.detail.innerHTML = `
    <button class="close" id="d-close">✕ close</button>
    <h2>${esc(r.name)}</h2>
    <p class="sub">${esc(r.slug)} · rank #${r.rank} of ${R.rows.length} · ${r.status === 'launched' ? 'token already trades' : 'records no token yet'}${r.on_watchlist ? ' · on the house watchlist' : ''}</p>
    <div class="dgrid">
      <div class="dcell"><span>Implied value</span><b>${money(r.implied_value_usd)}</b></div>
      <div class="dcell"><span>Value band</span><b>${r.status === 'launched' ? money(r.mcap_usd) : `${money(b.value_low_usd)} – ${money(b.value_high_usd)}`}</b></div>
      <div class="dcell"><span>Confidence</span><b>${r.status === 'launched' ? '— (real price)' : `${b.confidence} · ${b.calibration_peers} peers`}</b></div>
      <div class="dcell"><span>TVL</span><b>${money(r.tvl_usd)}</b></div>
      <div class="dcell"><span>7d TVL change</span><b>${r.change_7d === null ? '—' : `${r.change_7d > 0 ? '+' : ''}${r.change_7d.toFixed(1)}%`}</b></div>
      <div class="dcell"><span>Running tokenless</span><b>${years(b.age_days)}</b></div>
      <div class="dcell"><span>Category</span><b>${esc(r.category ?? '—')}</b></div>
      <div class="dcell"><span>Chains</span><b>${r.chains.length}</b></div>
    </div>
    <p class="sub">Live on: ${esc(r.chains.join(', '))}${r.listed_at ? ` · tracked since ${esc(r.listed_at)}` : ''}${r.mcap_usd ? ` · market cap ${money(r.mcap_usd)}` : ''}</p>
    <h3>The model's working</h3>
    ${model}
    <h3>Farm plan — before ${r.status === 'launched' ? 'the next snapshot' : 'it launches'}</h3>
    <ol class="steps">${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
  els.detail.hidden = false;
  els.scrim.hidden = false;
  history.replaceState(null, '', `#p=${encodeURIComponent(slug)}`);
  $('d-close').addEventListener('click', closeDetail);
}

function closeDetail() {
  els.detail.hidden = true;
  els.scrim.hidden = true;
  history.replaceState(null, '', location.pathname + location.search);
}

function fillFilters() {
  const chains = new Set();
  const cats = new Set();
  for (const r of R.rows) {
    for (const c of r.chains) chains.add(c);
    if (r.category) cats.add(r.category);
  }
  for (const c of [...chains].sort()) els.chain.insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c)}</option>`);
  for (const c of [...cats].sort()) els.cat.insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c)}</option>`);
}

/**
 * Deep links: the page state lives in the hash so a view can be shared or
 * captured — #p=<slug> opens a protocol's detail, and chain=, cat=,
 * status=, tvl=, q= preset the filters (e.g. #status=pre-token&chain=Ethereum).
 */
function applyHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (params.has('chain')) els.chain.value = params.get('chain');
  if (params.has('cat')) els.cat.value = params.get('cat');
  if (params.has('status')) els.status.value = params.get('status');
  if (params.has('tvl')) els.tvl.value = params.get('tvl');
  if (params.has('q')) els.q.value = params.get('q');
  render();
  if (params.has('p')) openDetail(params.get('p'));
}

function init() {
  els.meta.textContent = `Snapshot as of ${R.as_of} · ${R.source}`;
  els.fine.textContent = `Board built from the sealed snapshot of ${R.as_of}: ${R.scanned} protocols scanned, all ${R.watchlist_size} watchlist protocols covered, ${R.pre_token_rows} pre-token rows and ${R.launched_rows} launched anchors ranked.`;
  if (R.validation && els.valid) {
    const { n, model, baseline } = R.validation;
    els.valid.textContent = `Model self-check, leave-one-out on the ${n} launched protocols this snapshot can grade: median error ×${(10 ** model.median_abs_log10).toFixed(1)}, ${model.within_3x}% within 3× — the naive category-median baseline scores ×${(10 ** baseline.median_abs_log10).toFixed(1)} and ${baseline.within_3x}%. Its middle-half band contained the real market cap in ${model.band_coverage_pct.toFixed(1)}% of cases (median band width ×${model.median_band_width.toFixed(2)}). The model re-grades itself on every run.`;
  }
  els.stats.innerHTML = [
    [R.scanned, 'protocols scanned'],
    [R.pre_token_rows, 'pre-token ranked'],
    [R.watchlist_size, 'watchlist covered'],
    [R.launched_rows, 'launched anchors'],
  ].map(([n, label]) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`).join('');
  fillFilters();
  for (const el of [els.q, els.status, els.chain, els.cat, els.tvl, els.sort]) el.addEventListener('input', render);
  els.scrim.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });
  applyHash();
  window.__radarReady = true;
}

init();
