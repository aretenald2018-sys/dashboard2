// ================================================================
// stocks.js — Alpha Vantage + RSI 직접 계산
// 주가: GLOBAL_QUOTE (1회/종목)
// RSI: TIME_SERIES_DAILY 종가 데이터로 JS 직접 계산 (1회/종목)
// 총 5종목 × 2회 = 10회/사이클, 하루 25회 한도 → 하루 2번 갱신 가능
// 캐시 8시간으로 실사용엔 문제 없음
// ================================================================

import { CONFIG } from './config.js';

const CACHE_KEY      = 'stock_data';
const CACHE_TIME_KEY = 'stock_time';
const BASE           = 'https://www.alphavantage.co/query';

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── RSI 직접 계산 (Wilder's Smoothing) ───────────────────────────
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;

  let gains = 0, losses = 0;

  // 첫 번째 평균
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains  += diff;
    else           losses -= diff;
  }

  let avgGain = gains  / period;
  let avgLoss = losses / period;

  // Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
}

// ── 주가 호출 ─────────────────────────────────────────────────────
async function fetchQuote(sym) {
  const res  = await fetch(`${BASE}?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${CONFIG.ALPHAVANTAGE_KEY}`);
  const data = await res.json();
  if (data['Information']) throw new Error('rate limit');
  const q = data['Global Quote'];
  if (!q?.['05. price']) throw new Error('invalid');
  return {
    price:  parseFloat(q['05. price']),
    change: parseFloat(q['10. change percent']?.replace('%', '') || '0'),
  };
}

// ── 일별 종가 데이터로 RSI 계산 ──────────────────────────────────
async function fetchRSI(sym, period = 14) {
  const res  = await fetch(`${BASE}?function=TIME_SERIES_DAILY&symbol=${sym}&outputsize=compact&apikey=${CONFIG.ALPHAVANTAGE_KEY}`);
  const data = await res.json();
  if (data['Information']) throw new Error('rate limit');
  const series = data['Time Series (Daily)'];
  if (!series) return null;

  // 날짜 오름차순 정렬 후 종가 배열 (최근 30일이면 충분)
  const closes = Object.keys(series)
    .sort()
    .slice(-30)
    .map(d => parseFloat(series[d]['4. close']));

  return calcRSI(closes, period);
}

// ── 전체 종목 순차 로드 ──────────────────────────────────────────
export async function loadStocks() {
  const now       = Date.now();
  const lastFetch = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0');

  if ((now - lastFetch) < CONFIG.STOCK_CACHE_HOURS * 3600000) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) { renderStocks(JSON.parse(cached)); return; }
  }

  if (!CONFIG.ALPHAVANTAGE_KEY) { _renderPlaceholder(); return; }

  _renderLoading();

  const results = CONFIG.TICKERS.map(t => ({ ...t, price:null, change:null, rsi:null }));

  for (let i = 0; i < CONFIG.TICKERS.length; i++) {
    const sym = CONFIG.TICKERS[i].sym;
    try {
      // 주가 먼저
      const quote = await fetchQuote(sym);
      results[i]  = { ...results[i], ...quote };
      renderStocks(results, true);

      await delay(1000); // 1초 간격

      // RSI (일별 데이터 기반 직접 계산)
      const rsi  = await fetchRSI(sym);
      results[i] = { ...results[i], rsi };
      renderStocks(results, true);
    } catch(e) {
      console.warn(`[stocks] ${sym}:`, e.message);
    }

    if (i < CONFIG.TICKERS.length - 1) await delay(1000);
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
    const chgClass = s.change > 0 ? 'change-up' : s.change < 0 ? 'change-down' : 'change-flat';
    const chgSign  = s.change > 0 ? '+' : '';
    return `
      <div class="stock-chip">
        <div class="s-ticker">${s.sym}</div><div class="s-name">${s.name}</div>
        <div class="s-price">$${s.price.toFixed(2)}</div>
        <div class="s-change ${chgClass}">${chgSign}${s.change.toFixed(2)}%</div>
        <div class="s-rsi">RSI <span class="rsi-val">${s.rsi != null ? s.rsi : '--'}</span></div>
      </div>`;
  }).join('');

  if (!partial) {
    document.getElementById('stock-updated').textContent =
      '업데이트: ' + new Date().toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
  }
}
