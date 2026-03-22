// ================================================================
// render-calendar.js
// 의존성: config.js, data.js
// 역할: 달력 탭 렌더링
// 외부에서 사용: import { renderCalendar, changeYear } from './render-calendar.js'
// ================================================================

import { MONTHS, DAYS }                                          from './config.js';
import { getMuscles, getCF, dietDayOk, getExList,
         daysInMonth, isToday, isFuture }                        from './data.js';
import { openSheet }                                             from './sheet.js';
import { MUSCLES }                                               from './config.js';

let _currentYear = new Date().getFullYear();
export const getCurrentYear = () => _currentYear;

export function changeYear(delta) {
  _currentYear += delta;
  renderCalendar();
}

export function renderCalendar() {
  document.getElementById('year-label').textContent = _currentYear + '년';
  const cal = document.getElementById('calendar');
  cal.innerHTML = '';

  for (let m = 0; m < 12; m++) {
    const days = daysInMonth(_currentYear, m);
    const sec  = document.createElement('div'); sec.className = 'month-section';
    const hdr  = document.createElement('div'); hdr.className = 'month-header';
    hdr.textContent = _currentYear + '년 ' + MONTHS[m];
    sec.appendChild(hdr);

    const wrap  = document.createElement('div'); wrap.className = 'grid-wrap';
    const table = document.createElement('table'); table.className = 'grid-table';
    table.appendChild(_makeHead(_currentYear, m, days));

    const tbody = document.createElement('tbody');
    tbody.appendChild(_gymRow(_currentYear, m, days));
    tbody.appendChild(_cfRow(_currentYear, m, days));
    tbody.appendChild(_dietRow(_currentYear, m, days));
    table.appendChild(tbody);

    wrap.appendChild(table); sec.appendChild(wrap); cal.appendChild(sec);
  }
}

// ── 내부 빌더 ─────────────────────────────────────────────────────
function _makeHead(year, m, days) {
  const thead = document.createElement('thead');
  const hrow  = document.createElement('tr');
  const eTh   = document.createElement('th'); eTh.style.minWidth = '52px'; hrow.appendChild(eTh);
  for (let d = 1; d <= days; d++) {
    const th  = document.createElement('th');
    const dow = new Date(year, m, d).getDay();
    const col = dow===0?'#f87171':dow===6?'#60a5fa':'#6b7280';
    th.innerHTML = `<span style="color:${col};display:block;font-size:9px">${DAYS[dow]}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:9px">${d}</span>`;
    hrow.appendChild(th);
  }
  thead.appendChild(hrow);
  return thead;
}

function _gymRow(year, m, days) {
  const row = document.createElement('tr');
  const lbl = document.createElement('td'); lbl.className='row-label'; lbl.textContent='🏋️ 헬스'; row.appendChild(lbl);
  for (let d = 1; d <= days; d++) {
    const muscles = getMuscles(year, m, d);
    const cell    = _makeCell(year, m, d);
    if (muscles.length) {
      cell.classList.add('gym-on');
      const ic = document.createElement('span'); ic.className='cell-icon'; ic.textContent='🏋️'; cell.appendChild(ic);
      const dots = document.createElement('div'); dots.className='muscle-dots';
      muscles.slice(0,4).forEach(mid => {
        const mc  = MUSCLES.find(x => x.id===mid);
        const dot = document.createElement('div'); dot.className='muscle-dot';
        dot.style.background = mc?.color || '#888'; dots.appendChild(dot);
      });
      cell.appendChild(dots);
    }
    const td = document.createElement('td'); td.appendChild(cell); row.appendChild(td);
  }
  return row;
}

function _cfRow(year, m, days) {
  const row = document.createElement('tr');
  const lbl = document.createElement('td'); lbl.className='row-label'; lbl.textContent='🔥 크핏'; row.appendChild(lbl);
  for (let d = 1; d <= days; d++) {
    const cell = _makeCell(year, m, d);
    if (getCF(year, m, d)) {
      cell.classList.add('cf-on');
      const ic = document.createElement('span'); ic.className='cell-icon'; ic.textContent='🔥'; cell.appendChild(ic);
    }
    const td = document.createElement('td'); td.appendChild(cell); row.appendChild(td);
  }
  return row;
}

function _dietRow(year, m, days) {
  const row = document.createElement('tr');
  const lbl = document.createElement('td'); lbl.className='row-label'; lbl.textContent='🥗 식단'; row.appendChild(lbl);
  for (let d = 1; d <= days; d++) {
    const dok  = dietDayOk(year, m, d);
    const cell = _makeCell(year, m, d);
    if (dok === true)  { cell.classList.add('diet-ok');  const ic=document.createElement('span');ic.className='cell-icon';ic.textContent='✅';cell.appendChild(ic); }
    if (dok === false) { cell.classList.add('diet-bad'); const ic=document.createElement('span');ic.className='cell-icon';ic.textContent='❌';cell.appendChild(ic); }
    const td = document.createElement('td'); td.appendChild(cell); row.appendChild(td);
  }
  return row;
}

function _makeCell(y, m, d) {
  const cell = document.createElement('div'); cell.className = 'cell';
  if (isToday(y,m,d))  cell.classList.add('today-cell');
  if (isFuture(y,m,d)) cell.classList.add('future');
  const dn = document.createElement('div'); dn.className='day-num'; dn.textContent=d; cell.appendChild(dn);
  cell.addEventListener('click', () => { if (!isFuture(y,m,d)) openSheet(y,m,d); });
  return cell;
}
