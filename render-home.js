// ================================================================
// render-home.js
// 의존성: config.js, data.js
// 변경: 7번 streak 3종 분리, 11번 목표 진행률 카드
// ================================================================

import { MUSCLES }                                   from './config.js';
import { TODAY, getMuscles, getCF, getDiet, dietDayOk,
         getExercises, getExList, daysInMonth,
         calcStreaks, getGoals, getVolumeHistory,
         getCache }                                  from './data.js';

export function renderHome() {
  _renderStreaks();
  _renderGoals();
  _renderTodayDiet();
  _renderTodayWorkout();
}

// ── 7번: streak 3종 ──────────────────────────────────────────────
function _renderStreaks() {
  const { workout, diet, combined } = calcStreaks();
  document.getElementById('streak-workout').textContent  = workout;
  document.getElementById('streak-diet').textContent     = diet;
  document.getElementById('streak-combined').textContent = combined;

  // 상단 헤더 칩도 통합 streak으로 업데이트
  document.getElementById('h-streak').textContent = combined;

  // 전체 카운트
  let gymTotal=0, cfTotal=0, dietTotal=0;
  for (let y=2020; y<=2030; y++) for (let m=0; m<12; m++)
    for (let d=1; d<=daysInMonth(y,m); d++) {
      if (getMuscles(y,m,d).length) gymTotal++;
      if (getCF(y,m,d))             cfTotal++;
      if (dietDayOk(y,m,d)===true)  dietTotal++;
    }
  document.getElementById('h-gym').textContent  = gymTotal;
  document.getElementById('h-cf').textContent   = cfTotal;
  document.getElementById('h-diet').textContent = dietTotal;
}

// ── 11번: 목표 진행률 ────────────────────────────────────────────
function _renderGoals() {
  const goals = getGoals();
  const el    = document.getElementById('goals-section');
  if (!el) return;

  if (!goals.length) {
    el.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px">아직 설정된 목표가 없어요.</div>
      <button class="goal-add-btn" onclick="openGoalModal()">+ 목표 추가</button>`;
    return;
  }

  const ny = TODAY.getFullYear(), nm = TODAY.getMonth();

  const rows = goals.map(goal => {
    const { current, max } = _calcGoalProgress(goal, ny, nm);
    const pct     = max > 0 ? Math.min(Math.round((current/max)*100), 100) : 0;
    const done    = pct >= 100;
    const barColor= done ? 'var(--streak)' : 'var(--accent)';

    return `
      <div class="goal-row">
        <div class="goal-row-top">
          <span class="goal-label">${goal.label}</span>
          <span class="goal-value" style="color:${barColor}">
            ${done ? '✅ 달성!' : `${current} / ${max}${goal.unit}`}
          </span>
          <button class="goal-delete-btn" onclick="deleteGoalItem('${goal.id}')">✕</button>
        </div>
        <div class="goal-bar-wrap">
          <div class="goal-bar" style="width:${pct}%;background:${barColor}"></div>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = rows + `<button class="goal-add-btn" onclick="openGoalModal()">+ 목표 추가</button>`;
}

function _calcGoalProgress(goal, ny, nm) {
  const { workout, diet } = calcStreaks();
  switch (goal.type) {
    case 'monthly_workout': {
      let cnt = 0;
      for (let d=1; d<=daysInMonth(ny,nm); d++)
        if (getMuscles(ny,nm,d).length || getCF(ny,nm,d)) cnt++;
      return { current: cnt, max: goal.target };
    }
    case 'exercise_weight': {
      const history = getVolumeHistory(goal.exerciseId || '');
      const last    = history.slice(-1)[0];
      // 최고 세트 kg 근사: 볼륨 ÷ 평균 reps(10 가정)
      const kg = last ? Math.round(last.volume / 10) : 0;
      return { current: kg, max: goal.target };
    }
    case 'streak_workout':
      return { current: workout, max: goal.target };
    case 'streak_diet':
      return { current: diet, max: goal.target };
    case 'streak_combined':
      return { current: calcStreaks().combined, max: goal.target };
    default:
      return { current: 0, max: goal.target };
  }
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
