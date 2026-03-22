// ================================================================
// stocks.js
// 의존성: config.js
// 역할: Alpha Vantage API 호출 + 주가 렌더
// 외부에서 사용: import { loadStocks } from './stocks.js'
// ================================================================

import { CONFIG } from './config.js';

const CACHE_KEY      = 'stock_data';
const CACHE_TIME_KEY = 'stock_time';

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── 단일 종목 호출 ────────────────────────────────────────────────
async function fetchTicker(sym) {
  const key = CONFIG.ALPHAVANTAGE_KEY;

  const quoteRes  = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${key}`);
  const quoteData = await quoteRes.json();
  const q         = quoteData['Global Quote'];
  if (!q?.['05. price']) throw new Error('quota or invalid');

  const price  = parseFloat(q['05. price']);
  const change = parseFloat(q['10. change percent']?.replace('%','') || '0');

  await delay(1200);

  const rsiRes  = await fetch(`https://www.alphavantage.co/query?function=RSI&symbol=${sym}&interval=daily&time_period=14&series_type=close&apikey=${key}`);
  const rsiData = await rsiRes.json();
  const rsiVals = rsiData['Technical Analysis: RSI'];
  const latestKey = rsiVals ? Object.keys(rsiVals)[0] : null;
  const rsi = latestKey ? parseFloat(rsiVals[latestKey]['RSI']) : null;

  return { sym, price, change, rsi };
}

// ── 전체 종목 순차 로드 ──────────────────────────────────────────
export async function loadStocks() {
  const now       = Date.now();
  const lastFetch = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0');
  const valid     = (now - lastFetch) < CONFIG.STOCK_CACHE_HOURS * 3600000;

  if (valid) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) { renderStocks(JSON.parse(cached)); return; }
  }

  if (CONFIG.ALPHAVANTAGE_KEY === 'YOUR_ALPHAVANTAGE_KEY') {
    _renderPlaceholder(); return;
  }

  _renderLoading();

  const results = [];
  for (const t of CONFIG.TICKERS) {
    try {
      results.push({ ...t, ...await fetchTicker(t.sym) });
    } catch(e) {
      console.warn(`[stocks] ${t.sym}:`, e.message);
      results.push({ ...t, price:null, change:null, rsi:null });
    }
    renderStocks(results, true);
    await delay(1200);
  }

  localStorage.setItem(CACHE_KEY, JSON.stringify(results));
  localStorage.setItem(CACHE_TIME_KEY, String(now));
  renderStocks(results);
}

// ── 렌더 ─────────────────────────────────────────────────────────
function _renderLoading() {
  document.getElementById('stock-row').innerHTML = CONFIG.TICKERS.map(t => `
    <div class="stock-chip">
      <div class="s-ticker">${t.sym}</div><div class="s-name">${t.name}</div>
      <div class="s-price" style="color:var(--muted)">로딩중...</div>
      <div class="s-change change-flat">-</div>
      <div class="s-rsi">RSI <span class="rsi-val">-</span></div>
    </div>`).join('');
}

function _renderPlaceholder() {
  document.getElementById('stock-row').innerHTML = CONFIG.TICKERS.map(t => `
    <div class="stock-chip">
      <div class="s-ticker">${t.sym}</div><div class="s-name">${t.name}</div>
      <div class="s-price" style="color:var(--muted)">--.--</div>
      <div class="s-change change-flat">API 키 필요</div>
      <div class="s-rsi">RSI <span class="rsi-val">--</span></div>
    </div>`).join('');
}

export function renderStocks(data, partial = false) {
  document.getElementById('stock-row').innerHTML = data.map(s => {
    if (!s.price) return `
      <div class="stock-chip">
        <div class="s-ticker">${s.sym}</div><div class="s-name">${s.name}</div>
        <div class="s-price" style="color:var(--muted)">오류</div>
        <div class="s-change change-flat">-</div>
        <div class="s-rsi">RSI <span class="rsi-val">--</span></div>
      </div>`;
    const chgClass = s.change>0?'change-up':s.change<0?'change-down':'change-flat';
    const chgSign  = s.change>0?'+':'';
    return `
      <div class="stock-chip">
        <div class="s-ticker">${s.sym}</div><div class="s-name">${s.name}</div>
        <div class="s-price">$${s.price.toFixed(2)}</div>
        <div class="s-change ${chgClass}">${chgSign}${s.change.toFixed(2)}%</div>
        <div class="s-rsi">RSI <span class="rsi-val">${s.rsi!=null?s.rsi.toFixed(1):'--'}</span></div>
      </div>`;
  }).join('');

  if (!partial) {
    document.getElementById('stock-updated').textContent =
      '업데이트: ' + new Date().toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }
}
