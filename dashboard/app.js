// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, its filters, a per-protocol detail view with the model's own
// inputs and the protocol's farm plan, and the live-token protocols set apart. No network:
// every byte it shows is in data.js. The value model and the farm plans are the same
// derivations main.ts writes to board.json, recomputed here from the snapshot figures.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('app');
  var state = { q: '', category: 'all', chain: 'all', watchOnly: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
  var BOARD_MAX = DATA.rows.length ? DATA.rows[0].implied_value_usd : 1;

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    return 'x' + n.toFixed(2);
  }

  // The model in one function: the page recomputes a row from the snapshot figures and checks
  // the number board.json carries, so the page's code and the board's data are visibly the same
  // arithmetic. TVL enters with a power below 1: each extra dollar of locked value is worth a
  // little less than the last. Chain breadth and standing inside the protocol's own category
  // are the two further factors, both from the snapshot's figures alone.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (1 - model.maturity_floor) * (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days);
    var chains = row.chains ? row.chains.length : 0;
    var chainMult = 1 + model.chain_step * Math.min(Math.max(chains - 1, 0), model.chain_cap);
    var share = row.category_total_usd ? row.tvl_usd / row.category_total_usd : 0;
    var categoryMult = 1 + model.category_weight * Math.min(share, model.category_share_cap);
    var base = model.tvl_scale * Math.pow(Math.max(row.tvl_usd, 0), model.tvl_power);
    return {
      implied: Math.max(1, Math.round(base * growthMult * maturity * chainMult * categoryMult)),
      base: base,
      growth: growth,
      growthMult: growthMult,
      maturity: maturity,
      chainMult: chainMult,
      categoryMult: categoryMult,
      share: share
    };
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // ---- Farm plans: the same derivation main.ts writes to board.json. ----
  // Category picks the action, the TVL band picks the capital, the first chain picks the gas
  // band, age picks the hold. No name is special-cased and no URL is invented.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 1e9) return 200;
    if (p.tvl_usd >= 1e8) return 120;
    if (p.tvl_usd >= 25e6) return 80;
    return 50;
  }
  var CHEAP_CHAINS = ['arbitrum', 'optimism', 'base', 'blast', 'zksync', 'polygon', 'linea', 'scroll', 'mantle', 'mode', 'fraxtal', 'ink', 'unichain', 'worldchain', 'abstract', 'soneium', 'bnb', 'bsc', 'avalanche', 'gnosis'];
  function gasBand(chain) {
    var c = chain.toLowerCase();
    if (c === 'ethereum') return { low: 8, high: 15 };
    if (c === 'solana') return { low: 0, high: 1 };
    if (c === 'bitcoin') return { low: 2, high: 5 };
    if (CHEAP_CHAINS.indexOf(c) >= 0) return { low: 1, high: 3 };
    return { low: 2, high: 5 };
  }
  function gasNote(chain) {
    var band = gasBand(chain);
    if (band.high <= 1) return 'under $1 of fees on ' + chain;
    return '$' + band.low + ' to $' + band.high + ' of gas on ' + chain;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 60;
    if (age < 180) return 90;
    if (age < 365) return 60;
    return 45;
  }
  function familyOf(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'lend';
    if (c.indexOf('bridge') >= 0) return 'bridge';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'stake';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'perp';
    if (c.indexOf('dex') >= 0) return 'dex';
    if (c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0 || c.indexOf('leveraged') >= 0) return 'vault';
    if (c.indexOf('rwa') >= 0 || c.indexOf('real world') >= 0) return 'rwa';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'curator';
    if (c.indexOf('basis') >= 0) return 'basis';
    if (c.indexOf('prediction') >= 0) return 'predict';
    if (c.indexOf('insurance') >= 0) return 'insure';
    if (c === 'chain') return 'chain';
    if (c.indexOf('liquidity manager') >= 0) return 'manager';
    return 'general';
  }
  function openAction(p, capital, chain) {
    var name = p.name;
    switch (familyOf(p)) {
      case 'lend': return 'Lend $' + capital + " of USDC into " + name + "'s market on " + chain + ' and leave it supplied; borrow a small amount against it only if you want a second qualifying action.';
      case 'bridge': return 'Bridge $' + capital + ' of USDC into ' + chain + ' through ' + name + ', then use the bridged funds inside the destination app instead of bridging straight back.';
      case 'stake': return 'Stake $' + capital + ' through ' + name + ' on ' + chain + ' and hold the receipt token in the same wallet for the whole window.';
      case 'perp': return 'Post $' + capital + ' of USDC as collateral on ' + name + ' (' + chain + '), open one small low-leverage position, and close it within the same week.';
      case 'dex': return 'Add $' + capital + " of two-sided liquidity to " + name + "'s largest pool on " + chain + ' and keep the position in range.';
      case 'vault': return 'Deposit $' + capital + " into " + name + "'s highest-TVL vault on " + chain + ' and hold the vault shares.';
      case 'rwa': return 'Buy $' + capital + " of " + name + "'s tokenised asset on " + chain + ' and hold it in the farming wallet.';
      case 'curator': return 'Allocate $' + capital + ' to a ' + name + ' curator vault on ' + chain + ' and hold the shares for the full window.';
      case 'basis': return 'Deposit $' + capital + " into " + name + "'s basis vault on " + chain + ' and hold the position through at least one full funding cycle.';
      case 'predict': return 'Fund the account with $' + capital + ' and take one small position on ' + name + '; keep the stake small enough to lose.';
      case 'insure': return 'Buy $' + capital + ' of cover through ' + name + ' on ' + chain + ' and keep the policy active for the window.';
      case 'chain': return 'Bridge $' + capital + ' to the ' + name + ' chain and use its core app: one swap, one liquidity position, and one vote if governance is live.';
      case 'manager': return 'Deposit $' + capital + ' into a ' + name + '-managed position on ' + chain + ' and leave rebalancing to the manager.';
      default: return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open for the full window.';
    }
  }
  function weeklyAction(p, chain) {
    var name = p.name;
    switch (familyOf(p)) {
      case 'lend': return 'Once a week, adjust the position: add a little supply, repay part of any borrow, or claim and re-supply rewards.';
      case 'bridge': return 'Once a week, bridge a small amount ($10 to $25) through ' + name + ' in either direction and interact with the destination app.';
      case 'stake': return 'Once a week, add a small top-up to the stake, or restake any rewards the protocol distributes.';
      case 'perp': return 'Once a week, open and close one small hedged trade so the account shows regular activity.';
      case 'dex': return 'Once a week, make one swap through ' + name + "'s pools on " + chain + ' and check the liquidity position is still in range.';
      case 'vault': case 'curator': case 'basis': return 'Once a week, deposit a small top-up or harvest and re-deposit rewards into the same vault.';
      case 'chain': return 'Once a week, use one more app on the ' + name + ' chain: a swap, a stake, or a governance vote.';
      default: return 'Once a week, repeat one real action inside ' + name + ': a deposit, a swap, a vote, or a claim.';
    }
  }
  function stepText(text, cost, time) {
    var s = text + ' Cost: ' + cost + '. Time: ' + time + '.';
    if (s.length > 600) s = s.slice(0, 597) + '...';
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasNote(chain);
    var exitAfter = hold + 30;
    return [
      stepText('Set up a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.', 'no cost to create the wallet', '5 minutes'),
      stepText(openAction(p, capital, chain), '$' + capital + ' of capital plus ' + gas + ' for the deposit transaction', '15 minutes to set up'),
      stepText(weeklyAction(p, chain), gas + ' a week for one transaction', '10 minutes a week'),
      stepText('After 30 days, check the position still qualifies: still supplied, still in range where that applies, and any points balance moving. If the protocol changed its program, follow the new rules from its own announcements only.', 'no fee to check; ' + gas + ' if one adjustment transaction is needed', '15 minutes, once'),
      stepText('Hold the position for at least ' + hold + ' days without withdrawing, so the activity is counted in more than one snapshot window.', 'the $' + capital + ' stays in the position; about ' + gas + ' a week of upkeep', hold + ' days'),
      stepText('Exit only when the protocol itself publishes a claim or points page and this wallet shows a balance on it. If no claim page exists after ' + exitAfter + ' days, unwind anyway and treat the position as a plain deposit. Never pay anyone to claim for you, and never sign a claim transaction reached from any link but the protocol\'s own site.', gas + ' to claim, only if a claim opens', '20 minutes when the claim opens'),
      stepText('Write the wallet address, the dates and every transaction hash in a farm log, then unwind in reverse order: claim, withdraw, and move the funds back to cold storage.', gas + ' to unwind', '15 minutes')
    ];
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watch') === '1') state.watchOnly = true;
    if (params.get('tab') === 'live') state.tab = 'live';
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchOnly) params.set('watch', '1');
    if (state.tab === 'live') params.set('tab', 'live');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watchOnly && !r.on_watchlist) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function signalsLine(r) {
    var chains = r.chains ? r.chains.length : 0;
    var parts = [(r.category || 'Other'), chains + (chains === 1 ? ' chain' : ' chains')];
    if (r.category_rank !== null && r.category_rank !== undefined && r.category_size) {
      parts.push('#' + r.category_rank + ' of ' + r.category_size + ' in ' + (r.category || 'Other'));
    }
    parts.push(r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain');
    return parts.join(' \u00b7 ');
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' },
        el('span', { class: 'sweep', 'aria-hidden': 'true' }),
        el('div', null, el('b', { text: 'TOKEN RADAR' }), el('span', { text: 'Pre-token protocols, ranked by implied value' }))
      ),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'Model ' + DATA.model_version }),
        el('span', { text: DATA.board_size + ' rows' })
      )
    );
  }

  function hero() {
    return el('section', { class: 'hero' },
      el('div', null,
        el('h1', { text: 'What would each pre-token protocol be worth if it launched today?' }),
        el('p', null,
          'Every protocol on this board ',
          el('b', { text: 'records no token' }),
          ' in the snapshot, and none is an exchange, a bridge, a versioned pool or a named wrapped or staked product. The watchlist — at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record — is the floor, and the early radar adds ' + DATA.early_size + ' smaller pre-token protocols below it. Implied value is this entry\u2019s model, not a price and not a prediction that a token is coming.'
        )
      ),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('span', { text: 'Watchlist covered' }), el('b', null, el('em', { text: String(DATA.watchlist_size) }), ' / ' + DATA.watchlist_size)),
        el('div', { class: 'stat' }, el('span', { text: 'Pre-token rows' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'stat' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'stat' }, el('span', { text: 'Combined implied value' }), el('b', { text: fmtUsd(DATA.total_implied_usd) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var watchBox = el('input', { type: 'checkbox', id: 'watch', checked: state.watchOnly ? 'checked' : null });
    watchBox.addEventListener('change', function () { state.watchOnly = watchBox.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token board', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token (' + DATA.live_size + ')', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('label', { class: 'check', for: 'watch' }, watchBox, 'Watchlist only'),
      el('div', { class: 'field' }, el('label', { text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' of ' + DATA.board_size + ' rows' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' \u2193' : ' \u2191' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches those filters' }),
        el('p', { text: 'Clear the search or widen the filters to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchOnly = false; writeHash(); render(); } })
      ));
    }
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num' + (r.rank <= 3 ? ' rank-top' : ''), text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: signalsLine(r) })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / BOARD_MAX) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: r.on_watchlist ? 'badge watch' : 'badge', text: r.on_watchlist ? 'Watchlist' : 'Early' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'caption', text: 'Pre-token protocols, strongest implied value first. Bars are scaled to the board\u2019s top row, so filtering never rescales them. Select a row for its model breakdown and farm plan.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Board' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'badge live', text: 'Already trades' })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' \u00b7 ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) })
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'caption', text: 'These protocols already have a token that trades, so their market cap is a market fact, not a model. They are set apart from the pre-token ranking and never ranked by implied value.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Token' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { text: 'One function scores every row, from the snapshot figures alone. No protocol name is special-cased and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( ', el('b', { text: String(m.tvl_scale) }), ' \u00d7 tvl_usd ^ ', el('b', { text: String(m.tvl_power) }),
        ' \u00d7 (1 + clamp(change_7d, ', el('b', { text: String(m.growth_floor) }), ', ', el('b', { text: String(m.growth_cap) }), ') / 100 \u00d7 ', el('b', { text: String(m.growth_weight) }),
        ') \u00d7 (', el('b', { text: String(m.maturity_floor) }), ' + ', el('b', { text: (1 - m.maturity_floor).toFixed(2) }), ' \u00d7 min(age_days, ', el('b', { text: String(m.maturity_days) }), ') / ', el('b', { text: String(m.maturity_days) }),
        ') \u00d7 (1 + ', el('b', { text: String(m.chain_step) }), ' \u00d7 min(chains \u2212 1, ', el('b', { text: String(m.chain_cap) }),
        ')) \u00d7 (1 + ', el('b', { text: String(m.category_weight) }), ' \u00d7 min(category share, ', el('b', { text: String(m.category_share_cap) }), ')) )'
      ),
      el('ul', null,
        el('li', null, el('b', { text: 'Size. ' }), 'The power below 1 on TVL means a protocol ten times larger is worth about eight times as much, not ten: each extra dollar of locked value counts for a little less.'),
        el('li', null, el('b', { text: 'Momentum. ' }), 'Seven-day growth is clamped so one explosive week cannot carry a row, and a steep fall cannot sink one either.'),
        el('li', null, el('b', { text: 'Maturity. ' }), 'Age is the time since DefiLlama first listed the protocol; an unlisted age is treated as ' + m.unknown_age_days + ' days. A longer record with no token on it earns the full factor.'),
        el('li', null, el('b', { text: 'Reach. ' }), 'Each chain past the first adds ' + (m.chain_step * 100) + '%, capped at ' + m.chain_cap + ' extra chains: more chains, more surfaces the protocol runs on.'),
        el('li', null, el('b', { text: 'Standing. ' }), 'The protocol\u2019s share of its own category\u2019s TVL across the whole snapshot, capped at ' + (m.category_share_cap * 100) + '%: dominating a niche is worth more than the same TVL spread thin. A protocol with no category recorded gets no standing bonus.')
      ),
      el('p', { text: 'Select any row to see its own numbers recomputed in the page, factor by factor.' })
    );
  }

  function foot() {
    return el('footer', { class: 'foot' },
      el('span', { text: 'Data: ' + DATA.source + '. The snapshot is frozen; every run reads the same bytes.' }),
      el('span', { text: 'A protocol is shown as pre-token only because its snapshot record carries no token: the record is not proof, and a protocol on this board may still have a token its record does not carry. Nothing here is a prediction that a token will be issued, or investment advice.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); render(); });

  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var calc = impliedOf(row, DATA.model);
    var matches = calc.implied === row.implied_value_usd;
    var standing = (row.category_rank !== null && row.category_rank !== undefined && row.category_size)
      ? '#' + row.category_rank + ' of ' + row.category_size + ' \u00b7 ' + (calc.share * 100).toFixed(1) + '% of category TVL'
      : 'no category recorded, so no standing bonus';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'kicker', text: 'RANK ' + row.rank + ' OF ' + DATA.board_size + (row.on_watchlist ? ' \u00b7 WATCHLIST' : ' \u00b7 EARLY RADAR') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' \u00b7 ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + (row.listed_at ? ' \u00b7 listed ' + row.listed_at : '') + ' \u00b7 records no token' })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value, factor by factor' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token on record' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String(row.chains ? row.chains.length : 0) })),
        el('div', null, el('span', { text: 'Category standing' }), el('b', { class: 'num', text: standing })),
        el('div', { class: 'factor' }, el('span', { text: 'Base: 1.6 \u00d7 TVL ^ 0.9' }), el('b', { class: 'num', text: fmtUsd(calc.base) })),
        el('div', { class: 'factor' }, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: fmtMult(calc.growthMult) })),
        el('div', { class: 'factor' }, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: fmtMult(calc.maturity) })),
        el('div', { class: 'factor' }, el('span', { text: 'Chain multiplier' }), el('b', { class: 'num', text: fmtMult(calc.chainMult) })),
        el('div', { class: 'factor' }, el('span', { text: 'Category multiplier' }), el('b', { class: 'num', text: fmtMult(calc.categoryMult) })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      (function () {
        var line = el('p', { class: 'check-line' });
        if (matches) {
          line.appendChild(document.createTextNode('This page recomputes the row as '));
          line.appendChild(el('b', { text: fmtUsd(calc.implied) }));
          line.appendChild(document.createTextNode(', the same number the board carries. Model ' + DATA.model_version + ': an estimate, not a price.'));
        } else {
          line.textContent = 'This page recomputes the row as ' + fmtUsd(calc.implied) + ', which differs from the board: the data would be stale.';
        }
        return line;
      })()
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      })),
      el('p', { class: 'note', text: 'The plan follows from this protocol\u2019s own record — its category, its chains, its size and its age — not from a list of names. Gas bands are per-transaction estimates for the first chain at the time of the snapshot; the exit step names when to claim and when to unwind even if no claim opens.' })
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(hero());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(foot());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected && !dialog.open) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
