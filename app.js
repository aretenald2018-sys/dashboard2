// ================================================================
// app.js — 앱 진입점
// 변경: 퀘스트 명칭, 분기/월간 추가, 사후편집 모달
// ================================================================

import { loadAll, saveGoal, deleteGoal, getGoals,
         saveQuest, deleteQuest, getQuests, dateKey,
         TODAY }                                    from './data.js';
import { loadStocks }                               from './stocks.js';
import { getDietRec, getWorkoutRec,
         analyzeGoalFeasibility }                   from './ai.js';
import { renderCalendar, changeYear }               from './render-calendar.js';
import { renderStats, setPeriod, exportCSV }        from './render-stats.js';
import { renderHome }                               from './render-home.js';
import { renderWine, openWineModal, closeWineModal,
         saveWineFromModal, deleteWineFromModal,
         searchVivinoRating, searchWineImage,
         analyzeWinePreference, bulkSearchVivino,
         searchCriticRatings }                      from './render-wine.js';
import {
  openSheet, closeSheet, toggleCF, confirmSheet,
  openExercisePicker, closeExercisePicker,
  openExerciseEditor, closeExerciseEditor,
  saveExerciseFromEditor, deleteExerciseFromEditor,
  runAnalyzeDiet,
} from './sheet.js';

// ── 탭 전환 ──────────────────────────────────────────────────────
let _currentTab = 'home';

function switchTab(tab) {
  _currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach((b,i) =>
    b.classList.toggle('active', ['home','calendar','wine','stats'][i] === tab)
  );
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'stats')    renderStats();
  if (tab === 'calendar') renderCalendar();
  if (tab === 'wine')     renderWine();
}

function renderAll() {
  renderHome();
  if (_currentTab === 'calendar') renderCalendar();
  if (_currentTab === 'stats')    renderStats();
}

document.addEventListener('sheet:saved', renderAll);

// ── 목표 모달 ────────────────────────────────────────────────────
function openGoalModal() {
  document.getElementById('goal-label').value           = '';
  document.getElementById('goal-dday').value            = '';
  document.getElementById('goal-use-condition').checked = false;
  document.getElementById('goal-condition-wrap').style.display = 'none';
  document.getElementById('goal-workout-per-week').value = '';
  document.getElementById('goal-diet-ok-pct').value     = '';
  document.getElementById('goal-modal').classList.add('open');
}

function closeGoalModal(e) {
  if (e && e.target !== document.getElementById('goal-modal')) return;
  document.getElementById('goal-modal').classList.remove('open');
}

function toggleGoalCondition() {
  const checked = document.getElementById('goal-use-condition').checked;
  document.getElementById('goal-condition-wrap').style.display = checked ? 'block' : 'none';
}

async function saveGoalFromModal() {
  const label = document.getElementById('goal-label').value.trim();
  const dday  = document.getElementById('goal-dday').value;
  if (!label) { alert('목표 이름을 입력해주세요.'); return; }

  const useCondition = document.getElementById('goal-use-condition').checked;
  const condition = useCondition ? {
    workoutPerWeek: parseInt(document.getElementById('goal-workout-per-week').value) || null,
    dietOkPct:      parseInt(document.getElementById('goal-diet-ok-pct').value)      || null,
  } : null;

  await saveGoal({ id:`goal_${Date.now()}`, label, dday:dday||null, condition, aiAnalysis:null });
  document.getElementById('goal-modal').classList.remove('open');
  renderAll();
}

async function deleteGoalItem(id) {
  if (!confirm('목표를 삭제할까요?')) return;
  await deleteGoal(id);
  renderAll();
}

async function analyzeGoalFeasibilityHandler(id) {
  const goal = getGoals().find(g => g.id === id);
  if (!goal) return;
  const btns = document.querySelectorAll(`[onclick="analyzeGoalFeasibility('${id}')"]`);
  btns.forEach(b => { b.disabled=true; b.textContent='분석 중...'; });
  try {
    const result = await analyzeGoalFeasibility(goal);
    await saveGoal({ ...goal, aiAnalysis: result });
    renderAll();
  } catch(e) {
    alert('분석 실패: ' + e.message);
    btns.forEach(b => { b.disabled=false; b.textContent='✨ AI 실현가능성 분석'; });
  }
}

// ── 퀘스트 추가 모달 ─────────────────────────────────────────────
function openQuestModal() {
  document.getElementById('quest-title').value         = '';
  document.getElementById('quest-type').value          = 'daily';
  document.getElementById('quest-target').value        = '1';
  document.getElementById('quest-auto').checked        = false;
  document.getElementById('quest-auto-wrap').style.display    = 'none';
  document.getElementById('quest-target-wrap').style.display  = 'none';
  document.getElementById('quest-modal').classList.add('open');
  onQuestTypeChange(); // 초기 상태 반영
}

function closeQuestModal(e) {
  if (e && e.target !== document.getElementById('quest-modal')) return;
  document.getElementById('quest-modal').classList.remove('open');
}

function onQuestTypeChange() {
  const type = document.getElementById('quest-type').value;
  // 일간은 target 숨김 (1회성 고정), 나머지는 표시
  document.getElementById('quest-target-wrap').style.display = type === 'daily' ? 'none' : 'block';
}

function onQuestAutoChange() {
  const checked = document.getElementById('quest-auto').checked;
  document.getElementById('quest-auto-wrap').style.display = checked ? 'block' : 'none';
}

async function saveQuestFromModal() {
  const title    = document.getElementById('quest-title').value.trim();
  const type     = document.getElementById('quest-type').value;
  const target   = type === 'daily' ? 1 : (parseInt(document.getElementById('quest-target').value) || 1);
  const isAuto   = document.getElementById('quest-auto').checked;
  const autoType = document.getElementById('quest-auto-type')?.value || 'workout';

  if (!title) { alert('퀘스트 이름을 입력해주세요.'); return; }

  await saveQuest({
    id:       `quest_${Date.now()}`,
    title, type, target,
    auto:     isAuto,
    autoType: isAuto ? autoType : null,
    checks:   {},
  });
  document.getElementById('quest-modal').classList.remove('open');
  renderAll();
}

// ── 퀘스트 편집 모달 ─────────────────────────────────────────────
function openQuestEditModal(id) {
  const quest = getQuests().find(q => q.id === id);
  if (!quest) return;

  document.getElementById('quest-edit-id').value      = id;
  document.getElementById('quest-edit-title').value   = quest.title;
  document.getElementById('quest-edit-target').value  = quest.target || 1;

  // 일간은 target 숨김
  document.getElementById('quest-edit-target-wrap').style.display =
    quest.type === 'daily' ? 'none' : 'block';

  document.getElementById('quest-edit-modal').classList.add('open');
}

function closeQuestEditModal(e) {
  if (e && e.target !== document.getElementById('quest-edit-modal')) return;
  document.getElementById('quest-edit-modal').classList.remove('open');
}

async function saveQuestEdit() {
  const id     = document.getElementById('quest-edit-id').value;
  const title  = document.getElementById('quest-edit-title').value.trim();
  const target = parseInt(document.getElementById('quest-edit-target').value) || 1;
  if (!title) { alert('퀘스트 이름을 입력해주세요.'); return; }

  const quest = getQuests().find(q => q.id === id);
  if (!quest) return;

  await saveQuest({ ...quest, title, target: quest.type === 'daily' ? 1 : target });
  document.getElementById('quest-edit-modal').classList.remove('open');
  renderAll();
}

async function deleteQuestItem(id) {
  if (!confirm('퀘스트를 삭제할까요?')) return;
  await deleteQuest(id);
  renderAll();
}

async function toggleQuestCheck(id, type) {
  const quest = getQuests().find(q => q.id === id);
  if (!quest || quest.auto) return;

  const todayKey = dateKey(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  const checks   = { ...(quest.checks || {}) };
  checks[todayKey] = !checks[todayKey];

  await saveQuest({ ...quest, checks });
  renderAll();
}

// ── CSV 내보내기 ─────────────────────────────────────────────────
function openExportModal() {
  document.getElementById('export-modal').classList.add('open');
}
function closeExportModal(e) {
  if (e && e.target !== document.getElementById('export-modal')) return;
  document.getElementById('export-modal').classList.remove('open');
}
function runExportCSV(period) {
  exportCSV(period);
  document.getElementById('export-modal').classList.remove('open');
}

// ── 설정 모달 ────────────────────────────────────────────────────
function openSettingsModal() {
  document.getElementById('cfg-anthropic').value    = localStorage.getItem('cfg_anthropic')    || '';
  document.getElementById('cfg-alphavantage').value = localStorage.getItem('cfg_alphavantage') || '';
  document.getElementById('settings-modal').classList.add('open');
}
function closeSettingsModal(e) {
  if (e && e.target !== document.getElementById('settings-modal')) return;
  document.getElementById('settings-modal').classList.remove('open');
}
function saveSettings() {
  const anthropic    = document.getElementById('cfg-anthropic').value.trim();
  const alphavantage = document.getElementById('cfg-alphavantage').value.trim();
  if (anthropic)    localStorage.setItem('cfg_anthropic',    anthropic);
  if (alphavantage) localStorage.setItem('cfg_alphavantage', alphavantage);
  document.getElementById('settings-modal').classList.remove('open');
  if (alphavantage) loadStocks();
}

window.openSettingsModal  = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings       = saveSettings;

async function init() {
  await loadAll();
  renderHome();
  renderCalendar();
  loadStocks();
  document.getElementById('loading').classList.add('hidden');
  setTimeout(() => openSettingsModal(), 600);
  setTimeout(() => {
    document.querySelectorAll('.today-cell')[0]
      ?.scrollIntoView({ behavior:'smooth', block:'center' });
  }, 400);
}
init();

// ── window 등록 ──────────────────────────────────────────────────
window.switchTab                = switchTab;
window.changeYear               = changeYear;
window.setPeriod                = setPeriod;
window.getDietRec               = getDietRec;
window.getWorkoutRec            = getWorkoutRec;
window.openSheet                = openSheet;
window.closeSheet               = closeSheet;
window.toggleCF                 = toggleCF;
window.confirmSheet             = confirmSheet;
window.runAnalyzeDiet           = runAnalyzeDiet;
window.openExercisePicker       = openExercisePicker;
window.closeExercisePicker      = closeExercisePicker;
window.openExerciseEditor       = openExerciseEditor;
window.closeExerciseEditor      = closeExerciseEditor;
window.saveExerciseFromEditor   = saveExerciseFromEditor;
window.deleteExerciseFromEditor = deleteExerciseFromEditor;
// 목표
window.openGoalModal            = openGoalModal;
window.closeGoalModal           = closeGoalModal;
window.saveGoalFromModal        = saveGoalFromModal;
window.deleteGoalItem           = deleteGoalItem;
window.analyzeGoalFeasibility   = analyzeGoalFeasibilityHandler;
window.toggleGoalCondition      = toggleGoalCondition;
// 퀘스트
window.openQuestModal           = openQuestModal;
window.closeQuestModal          = closeQuestModal;
window.saveQuestFromModal       = saveQuestFromModal;
window.openQuestEditModal       = openQuestEditModal;
window.closeQuestEditModal      = closeQuestEditModal;
window.saveQuestEdit            = saveQuestEdit;
window.deleteQuestItem          = deleteQuestItem;
window.toggleQuestCheck         = toggleQuestCheck;
window.onQuestTypeChange        = onQuestTypeChange;
window.onQuestAutoChange        = onQuestAutoChange;
// CSV
window.openExportModal          = openExportModal;
window.closeExportModal         = closeExportModal;
window.runExportCSV             = runExportCSV;
// 와인
window.openWineModal            = openWineModal;
window.closeWineModal           = closeWineModal;
window.saveWineFromModal        = saveWineFromModal;
window.deleteWineFromModal      = deleteWineFromModal;
window.searchVivinoRating       = searchVivinoRating;
window.searchWineImage          = searchWineImage;
window.searchCriticRatings      = searchCriticRatings;
window.analyzeWinePreference    = analyzeWinePreference;
window.bulkSearchVivino         = bulkSearchVivino;
