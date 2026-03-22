// ================================================================
// stocks.js — Finnhub API (분당 60회, 하루 제한 없음)
// ================================================================

import { CONFIG } from './config.js';

const CACHE_KEY      = 'stock_data';
const CACHE_TIME_KEY = 'stock_time';
const BASE           = 'https://finnhub.io/api/v1';

const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchQuote(sym) {
  const res  = await fetch(`${BASE}/quote?symbol=${sym}&token=${CONFIG.FINNHUB_KEY}`);
  const data = await res.json();
  if (!data.c || data.c === 0) throw new Error('invalid');
  const change    = data.c - data.pc;
  const changePct = data.pc ? (change / data.pc) * 100 : 0;
  return { price: data.c, change: changePct };
}

async function fetchRSI(sym) {
  try {
    // Finnhub technical indicator — from/to 필요 (최근 30일)
    const to   = Math.floor(Date.now() / 1000);
    const from = to - 60 * 24 * 3600; // 60일 전
    const res  = await fetch(
      `${BASE}/indicator?symbol=${sym}&resolution=D&from=${from}&to=${to}&indicator=rsi&timeperiod=14&token=${CONFIG.FINNHUB_KEY}`
    );
    const data = await res.json();
    // rsi 배열의 마지막 값
    const rsiArr = data?.technicalAnalysis?.rsi;
    if (!rsiArr?.length) return null;
    return parseFloat(rsiArr[rsiArr.length - 1].toFixed(1));
  } catch(e) { return null; }
}

export async function loadStocks() {
  const now       = Date.now();
  const lastFetch = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0');

  if ((now - lastFetch) < CONFIG.STOCK_CACHE_HOURS * 3600000) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) { renderStocks(JSON.parse(cached)); return; }
  }

  if (!CONFIG.FINNHUB_KEY) { _renderPlaceholder(); return; }

  _renderLoading();

  const results = CONFIG.TICKERS.map(t => ({ ...t, price:null, change:null, rsi:null }));

  // 주가 + RSI 병렬 호출 (분당 60회니까 딜레이 최소화)
  for (let i = 0; i < CONFIG.TICKERS.length; i++) {
    const sym = CONFIG.TICKERS[i].sym;
    try {
      const [quote, rsi] = await Promise.all([
        fetchQuote(sym),
        fetchRSI(sym),
      ]);
      results[i] = { ...results[i], ...quote, rsi };
    } catch(e) {
      console.warn(`[stocks] ${sym}:`, e.message);
    }
    renderStocks(results, true);
    if (i < CONFIG.TICKERS.length - 1) await delay(300);
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
        <div class="s-rsi">RSI <span class="rsi-val">${s.rsi!=null?s.rsi:'--'}</span></div>
      </div>`;
  }).join('');

  if (!partial) {
    document.getElementById('stock-updated').textContent =
      '업데이트: ' + new Date().toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }
}
