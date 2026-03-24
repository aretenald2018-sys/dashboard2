// ================================================================
// render-home.js
// 변경: 통합 대시보드, 주간/일간 숙제, 목표 개편
// ================================================================

import { MUSCLES }                                   from './config.js';
import { TODAY, getMuscles, getCF, getDiet, dietDayOk,
         getExercises, getExList, daysInMonth,
         calcStreaks, getGoals, getVolumeHistory,
         getCache, getQuests, dateKey }               from './data.js';

export function renderHome() {
  _renderDashboard();
  _renderQuests();
  _renderGoals();
  _renderTodayDiet();
  _renderTodayWorkout();
}

// ── 통합 대시보드 ─────────────────────────────────────────────────
function _renderDashboard() {
  const { workout, diet, combined } = calcStreaks();

  let gymTotal=0, cfTotal=0, dietTotal=0;
  for (let y=2020; y<=2030; y++) for (let m=0; m<12; m++)
    for (let d=1; d<=daysInMonth(y,m); d++) {
      if (getMuscles(y,m,d).length) gymTotal++;
      if (getCF(y,m,d))             cfTotal++;
      if (dietDayOk(y,m,d)===true)  dietTotal++;
    }

  document.getElementById('dash-workout-streak').textContent = workout;
  document.getElementById('dash-workout-total').textContent  = gymTotal;
  document.getElementById('dash-diet-streak').textContent    = diet;
  document.getElementById('dash-diet-total').textContent     = dietTotal;
  document.getElementById('dash-combined-streak').textContent = combined;
  document.getElementById('dash-cf-total').textContent       = cfTotal;
}

// ── 숙제 렌더링 ──────────────────────────────────────────────────
function _renderQuests() {
  const quests = getQuests();
  const daily  = quests.filter(q => q.type === 'daily');
  const weekly = quests.filter(q => q.type === 'weekly');

  _renderQuestSection('daily-quests',  daily,  'daily');
  _renderQuestSection('weekly-quests', weekly, 'weekly');
}

function _renderQuestSection(elId, quests, type) {
  const el = document.getElementById(elId);
  if (!el) return;

  const todayKey  = dateKey(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  const weekStart = _getWeekStart();

  // 자동 연동 숙제 상태 계산
  const y=TODAY.getFullYear(), m=TODAY.getMonth(), d=TODAY.getDate();
  const autoWorkoutDone = getMuscles(y,m,d).length > 0 || getCF(y,m,d);
  const autoDietDone    = dietDayOk(y,m,d) === true;

  // 주간 숙제면 이번 주 완료 횟수 계산
  function _weeklyCount(quest) {
    if (!quest.auto) {
      let cnt = 0;
      for (let i=0; i<7; i++) {
        const dd = new Date(weekStart); dd.setDate(dd.getDate()+i);
        const k  = dateKey(dd.getFullYear(), dd.getMonth(), dd.getDate());
        if (quest.checks?.[k]) cnt++;
      }
      return cnt;
    }
    // 자동 연동 주간
    let cnt = 0;
    for (let i=0; i<7; i++) {
      const dd = new Date(weekStart); dd.setDate(dd.getDate()+i);
      const yy=dd.getFullYear(), mm=dd.getMonth(), ddd=dd.getDate();
      if (quest.autoType === 'workout' && (getMuscles(yy,mm,ddd).length > 0 || getCF(yy,mm,ddd))) cnt++;
      if (quest.autoType === 'diet'    && dietDayOk(yy,mm,ddd) === true) cnt++;
    }
    return cnt;
  }

  if (!quests.length) {
    el.innerHTML = `<div class="quest-empty">아직 숙제가 없어요. + 버튼으로 추가하세요.</div>`;
    return;
  }

  el.innerHTML = quests.map(quest => {
    let done = false;
    let pct  = 0;
    let label = '';

    if (type === 'daily') {
      if (quest.auto) {
        done = quest.autoType === 'workout' ? autoWorkoutDone : autoDietDone;
      } else {
        done = !!quest.checks?.[todayKey];
      }
      pct   = done ? 100 : 0;
      label = done ? '완료' : '미완';
    } else {
      // 주간
      const target = quest.weeklyTarget || 7;
      const cnt    = _weeklyCount(quest);
      pct   = Math.min(Math.round((cnt / target) * 100), 100);
      done  = pct >= 100;
      label = `${cnt}/${target}`;
    }

    const barColor = done ? 'var(--streak)' : pct > 50 ? 'var(--accent)' : 'var(--gym)';
    const autoTag  = quest.auto ? `<span class="quest-auto-tag">자동</span>` : '';

    return `
      <div class="quest-row ${done ? 'done' : ''}" data-id="${quest.id}" data-type="${type}">
        <div class="quest-row-top">
          <div class="quest-check ${done ? 'checked' : ''}" onclick="toggleQuestCheck('${quest.id}','${type}')">
            ${done ? '✓' : ''}
          </div>
          <span class="quest-title">${quest.title}</span>
          ${autoTag}
          <span class="quest-label" style="color:${barColor}">${label}</span>
          <button class="quest-delete-btn" onclick="deleteQuestItem('${quest.id}')">✕</button>
        </div>
        <div class="quest-bar-wrap">
          <div class="quest-bar" style="width:${pct}%;background:${barColor}"></div>
        </div>
      </div>`;
  }).join('');
}

function _getWeekStart() {
  const d = new Date(TODAY);
  const day = d.getDay(); // 0=일
  const diff = day === 0 ? -6 : 1 - day; // 월요일 기준
  d.setDate(d.getDate() + diff);
  return d;
}

// ── 목표 진행률 ──────────────────────────────────────────────────
function _renderGoals() {
  const goals = getGoals();
  const el    = document.getElementById('goals-section');
  if (!el) return;

  if (!goals.length) {
    el.innerHTML = `
      <div class="quest-empty">아직 설정된 목표가 없어요.</div>
      <button class="goal-add-btn" onclick="openGoalModal()">+ 목표 추가</button>`;
    return;
  }

  const rows = goals.map(goal => {
    const today    = new Date();
    const ddayDate = goal.dday ? new Date(goal.dday) : null;
    const daysLeft = ddayDate ? Math.ceil((ddayDate - today) / 86400000) : null;
    const ddayStr  = daysLeft === null  ? ''
                   : daysLeft > 0  ? `D-${daysLeft}`
                   : daysLeft === 0 ? 'D-Day!'
                   : `D+${Math.abs(daysLeft)}`;
    const ddayColor = daysLeft !== null && daysLeft <= 7 ? 'var(--diet-bad)' : 'var(--accent)';

    const ai = goal.aiAnalysis;
    const aiHtml = ai ? `
      <div class="goal-ai-result">
        <div class="goal-ai-row">
          <span class="goal-ai-label">실현가능성</span>
          <span class="goal-ai-val" style="color:${ai.feasibility>=70?'var(--streak)':ai.feasibility>=40?'var(--accent)':'var(--diet-bad)'}">${ai.feasibility}%</span>
        </div>
        <div class="goal-ai-row">
          <span class="goal-ai-label">현실적 완료일</span>
          <span class="goal-ai-val">${ai.realisticDate}</span>
        </div>
        ${ai.summary ? `<div class="goal-ai-summary">${ai.summary}</div>` : ''}
        <button class="goal-reanalyze-btn" onclick="analyzeGoalFeasibility('${goal.id}')">🔄 재분석</button>
      </div>` : `
      <button class="goal-analyze-btn" onclick="analyzeGoalFeasibility('${goal.id}')">✨ AI 실현가능성 분석</button>`;

    return `
      <div class="goal-row">
        <div class="goal-row-top">
          <span class="goal-label">${goal.label}</span>
          ${ddayStr ? `<span class="goal-dday" style="color:${ddayColor}">${ddayStr}</span>` : ''}
          <button class="goal-delete-btn" onclick="deleteGoalItem('${goal.id}')">✕</button>
        </div>
        ${goal.condition ? `<div class="goal-condition">조건: 주 ${goal.condition.workoutPerWeek||'-'}회 운동 / 식단OK ${goal.condition.dietOkPct||'-'}%</div>` : ''}
        ${aiHtml}
      </div>`;
  }).join('');

  el.innerHTML = rows + `<button class="goal-add-btn" onclick="openGoalModal()">+ 목표 추가</button>`;
}

// ── 오늘 식단 ────────────────────────────────────────────────────
function _renderTodayDiet() {
  const y=TODAY.getFullYear(), m=TODAY.getMonth(), d=TODAY.getDate();
  const diet = getDiet(y, m, d);
  const el   = document.getElementById('today-diet-summary');

  if (!diet.breakfast && !diet.lunch && !diet.dinner) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted)">아직 식단 기록이 없어요.</div>';
    return;
  }

  const totalKcal = (diet.bKcal||0)+(diet.lKcal||0)+(diet.dKcal||0);
  const meals = [
    { label:'☀️ 아침', val:diet.breakfast, ok:diet.bOk, kcal:diet.bKcal, reason:diet.bReason },
    { label:'🌤 점심', val:diet.lunch,     ok:diet.lOk, kcal:diet.lKcal, reason:diet.lReason },
    { label:'🌙 저녁', val:diet.dinner,    ok:diet.dOk, kcal:diet.dKcal, reason:diet.dReason },
  ].filter(x => x.val);

  el.innerHTML = meals.map(ml => `
    <div style="margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;color:var(--muted2);width:44px;flex-shrink:0">${ml.label}</span>
        <span style="font-size:12px;flex:1;color:var(--text)">${ml.val}</span>
        ${ml.ok===null  ? '<span class="diet-badge pending" style="font-size:9px">미분석</span>'
        : ml.ok===true  ? '<span class="diet-badge ok"      style="font-size:9px">OK</span>'
                        : '<span class="diet-badge bad"     style="font-size:9px">NG</span>'}
        ${ml.kcal ? `<span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted)">${ml.kcal}kcal</span>` : ''}
      </div>
      ${ml.reason && ml.ok !== null ? `<div class="diet-reason${ml.ok?'':' bad'}" style="margin-left:52px">${ml.reason}</div>` : ''}
    </div>`).join('')
    + `<div style="font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace">총 ${totalKcal}kcal</div>`;
}

// ── 오늘 운동 ────────────────────────────────────────────────────
function _renderTodayWorkout() {
  const y=TODAY.getFullYear(), m=TODAY.getMonth(), d=TODAY.getDate();
  const exEntries = getExercises(y, m, d);
  const cf        = getCF(y, m, d);
  const el        = document.getElementById('today-workout-summary');

  if (!exEntries.length && !cf) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted)">아직 운동 기록이 없어요.</div>';
    return;
  }

  const tags = exEntries.map(entry => {
    const ex  = getExList().find(x => x.id === entry.exerciseId);
    const mc  = MUSCLES.find(x => x.id === entry.muscleId);
    const vol = entry.sets.reduce((s,set)=>s+(set.kg||0)*(set.reps||0), 0);
    return `<span style="background:${mc?.color||'#888'}22;border:1px solid ${mc?.color||'#888'};
      border-radius:12px;padding:3px 8px;font-size:11px;color:${mc?.color||'#888'}">
      ${ex?.name||entry.exerciseId}
      ${vol ? `<span style="font-size:9px;opacity:.8">${vol.toLocaleString()}v</span>` : ''}
    </span>`;
  });
  if (cf) tags.push(`<span style="background:var(--cf-dim);border:1px solid var(--cf);
    border-radius:12px;padding:3px 8px;font-size:11px;color:var(--cf)">크로스핏</span>`);

  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px">${tags.join('')}</div>`;
}
