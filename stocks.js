// ================================================================
// stocks.js
// 의존성: config.js
// 수정: 주가/RSI 분리 호출, RSI 실패해도 주가는 표시
// ================================================================

import { CONFIG } from './config.js';

const CACHE_KEY      = 'stock_data';
const CACHE_TIME_KEY = 'stock_time';

const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchQuote(sym) {
  const key  = CONFIG.ALPHAVANTAGE_KEY;
  const res  = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${key}`);
  const data = await res.json();
  const q    = data['Global Quote'];
  if (!q?.['05. price']) throw new Error('quota or invalid');
  return {
    price:  parseFloat(q['05. price']),
    change: parseFloat(q['10. change percent']?.replace('%','') || '0'),
  };
}

async function fetchRSI(sym) {
  try {
    const key  = CONFIG.ALPHAVANTAGE_KEY;
    const res  = await fetch(`https://www.alphavantage.co/query?function=RSI&symbol=${sym}&interval=daily&time_period=14&series_type=close&apikey=${key}`);
    const data = await res.json();
    const vals = data['Technical Analysis: RSI'];
    const k    = vals ? Object.keys(vals)[0] : null;
    return k ? parseFloat(vals[k]['RSI']) : null;
  } catch(e) { return null; }
}

export async function loadStocks() {
  const now       = Date.now();
  const lastFetch = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0');
  const valid     = (now - lastFetch) < CONFIG.STOCK_CACHE_HOURS * 3600000;

  if (valid) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) { renderStocks(JSON.parse(cached)); return; }
  }

  if (!CONFIG.ALPHAVANTAGE_KEY) { _renderPlaceholder(); return; }

  _renderLoading();

  const results = CONFIG.TICKERS.map(t => ({ ...t, price:null, change:null, rsi:null }));

  // 1단계: 주가 순차 (2초 간격)
  for (let i = 0; i < CONFIG.TICKERS.length; i++) {
    try {
      const q = await fetchQuote(CONFIG.TICKERS[i].sym);
      results[i] = { ...results[i], ...q };
      renderStocks(results, true);
    } catch(e) {
      console.warn(`[stocks] quote ${CONFIG.TICKERS[i].sym}:`, e.message);
    }
    if (i < CONFIG.TICKERS.length - 1) await delay(2000);
  }

  // 2단계: RSI 순차 (3초 간격, 실패해도 계속)
  await delay(3000);
  for (let i = 0; i < CONFIG.TICKERS.length; i++) {
    if (!results[i].price) continue;
    results[i].rsi = await fetchRSI(CONFIG.TICKERS[i].sym);
    renderStocks(results, true);
    if (i < CONFIG.TICKERS.length - 1) await delay(3000);
  }

  localStorage.setItem(CACHE_KEY, JSON.stringify(results));
  localStorage.setItem(CACHE_TIME_KEY, String(now));
  renderStocks(results);
}

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
      <div class="s-change change-flat">⚙️ 키 설정 필요</div>
      <div class="s-rsi">RSI <span class="rsi-val">--</span></div>
    </div>`).join('');
}

export function renderStocks(data, partial = false) {
  document.getElementById('stock-row').innerHTML = data.map(s => {
    if (!s.price) return `
      <div class="stock-chip">
        <div class="s-ticker">${s.sym}</div><div class="s-name">${s.name}</div>
        <div class="s-price" style="color:var(--muted)">로딩중...</div>
        <div class="s-change change-flat">-</div>
        <div class="s-rsi">RSI <span class="rsi-val">-</span></div>
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
