// ================================================================
// app.js — 앱 진입점
// 변경: 11번 목표 모달 핸들러, 13번 CSV 내보내기 핸들러 추가
// ================================================================

import { loadAll, saveGoal, deleteGoal, getGoals } from './data.js';
import { loadStocks }                              from './stocks.js';
import { getDietRec, getWorkoutRec }               from './ai.js';
import { renderCalendar, changeYear }              from './render-calendar.js';
import { renderStats, setPeriod, exportCSV }       from './render-stats.js';
import { renderHome }                              from './render-home.js';
import { renderWine, openWineModal, closeWineModal,
         saveWineFromModal, deleteWineFromModal,
         searchVivinoRating, searchWineImage,
         analyzeWinePreference, bulkSearchVivino,
         searchCriticRatings }  from './render-wine.js';
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

// ── 11번: 목표 모달 ──────────────────────────────────────────────
function openGoalModal() {
  document.getElementById('goal-modal').classList.add('open');
}

function closeGoalModal(e) {
  if (e && e.target !== document.getElementById('goal-modal')) return;
  document.getElementById('goal-modal').classList.remove('open');
}

async function saveGoalFromModal() {
  const type   = document.getElementById('goal-type').value;
  const target = parseInt(document.getElementById('goal-target').value);
  const label  = document.getElementById('goal-label').value.trim();
  if (!label || !target || target <= 0) { alert('목표 이름과 수치를 입력해주세요.'); return; }

  const unitMap = {
    monthly_workout: '일', exercise_weight: 'kg',
    streak_workout: '일', streak_diet: '일', streak_combined: '일',
  };

  await saveGoal({
    id:     `goal_${Date.now()}`,
    type,
    label,
    target,
    unit: unitMap[type] || '',
  });

  document.getElementById('goal-modal').classList.remove('open');
  renderAll();
}

async function deleteGoalItem(id) {
  if (!confirm('목표를 삭제할까요?')) return;
  await deleteGoal(id);
  renderAll();
}

// ── 13번: CSV 내보내기 ───────────────────────────────────────────
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
  document.getElementById('cfg-anthropic').value = localStorage.getItem('cfg_anthropic') || '';
  document.getElementById('cfg-finnhub').value   = localStorage.getItem('cfg_finnhub')   || '';
  document.getElementById('settings-modal').classList.add('open');
}

function closeSettingsModal(e) {
  if (e && e.target !== document.getElementById('settings-modal')) return;
  document.getElementById('settings-modal').classList.remove('open');
}

function saveSettings() {
  const anthropic = document.getElementById('cfg-anthropic').value.trim();
  const finnhub   = document.getElementById('cfg-finnhub').value.trim();
  if (anthropic) localStorage.setItem('cfg_anthropic', anthropic);
  if (finnhub)   localStorage.setItem('cfg_finnhub',   finnhub);
  document.getElementById('settings-modal').classList.remove('open');
  if (finnhub) loadStocks();
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

  // 항상 설정 모달 오픈 (키 확인/재입력용)
  setTimeout(() => openSettingsModal(), 600);

  setTimeout(() => {
    document.querySelectorAll('.today-cell')[0]
      ?.scrollIntoView({ behavior:'smooth', block:'center' });
  }, 400);
}

init();

// ── window 등록 (HTML onclick용만) ───────────────────────────────
window.switchTab              = switchTab;
window.changeYear             = changeYear;
window.setPeriod              = setPeriod;
window.getDietRec             = getDietRec;
window.getWorkoutRec          = getWorkoutRec;
window.openSheet              = openSheet;
window.closeSheet             = closeSheet;
window.toggleCF               = toggleCF;
window.confirmSheet           = confirmSheet;
window.runAnalyzeDiet         = runAnalyzeDiet;
window.openExercisePicker     = openExercisePicker;
window.closeExercisePicker    = closeExercisePicker;
window.openExerciseEditor     = openExerciseEditor;
window.closeExerciseEditor    = closeExerciseEditor;
window.saveExerciseFromEditor = saveExerciseFromEditor;
window.deleteExerciseFromEditor = deleteExerciseFromEditor;
// 목표
window.openGoalModal    = openGoalModal;
window.closeGoalModal   = closeGoalModal;
window.saveGoalFromModal= saveGoalFromModal;
window.deleteGoalItem   = deleteGoalItem;
// CSV
window.openExportModal  = openExportModal;
window.closeExportModal = closeExportModal;
window.runExportCSV     = runExportCSV;
// 와인
window.openWineModal        = openWineModal;
window.closeWineModal       = closeWineModal;
window.saveWineFromModal    = saveWineFromModal;
window.deleteWineFromModal  = deleteWineFromModal;
window.searchVivinoRating    = searchVivinoRating;
window.searchWineImage       = searchWineImage;
window.searchCriticRatings   = searchCriticRatings;
window.analyzeWinePreference = analyzeWinePreference;
window.bulkSearchVivino      = bulkSearchVivino;
