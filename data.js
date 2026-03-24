// ================================================================
// data.js
// 의존성: config.js
// 변경: quests 컬렉션 추가, goals 구조 개편 (D-day + 자유입력)
// ================================================================

import { initializeApp }    from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, deleteDoc,
  collection, getDocs, enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { CONFIG, MUSCLES } from './config.js';
import { INITIAL_WINES }  from './wine-data.js';

const app = initializeApp(CONFIG.FIREBASE);
const db  = getFirestore(app);

enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') console.warn('[data] 멀티탭 환경 — 오프라인 캐시 비활성');
  else if (err.code === 'unimplemented')  console.warn('[data] 브라우저가 오프라인 캐시 미지원');
});

let _cache   = {};
let _exList  = [];
let _goals   = [];
let _wines   = [];
let _quests  = [];

function _setSyncStatus(state) {
  const dot = document.getElementById('sync-dot');
  const txt = document.getElementById('sync-text');
  if (!dot || !txt) return;
  dot.className = 'sync-dot ' + state;
  txt.textContent = { ok:'동기화됨', syncing:'저장 중...', err:'오프라인 — 로컬 저장 후 자동 재시도' }[state] || state;
}

export async function loadAll() {
  try {
    const snap = await getDocs(collection(db, 'workouts'));
    snap.forEach(d => { _cache[d.id] = d.data(); });

    const exSnap = await getDocs(collection(db, 'exercises'));
    const custom = [];
    exSnap.forEach(d => custom.push(d.data()));
    const customIds = new Set(custom.map(e => e.id));
    const defaults  = CONFIG.DEFAULT_EXERCISES.filter(e => !customIds.has(e.id));
    _exList = _sortExList([...defaults, ...custom]);

    const goalSnap = await getDocs(collection(db, 'goals'));
    _goals = [];
    goalSnap.forEach(d => _goals.push(d.data()));

    const wineSnap = await getDocs(collection(db, 'wines'));
    _wines = [];
    wineSnap.forEach(d => _wines.push(d.data()));
    if (_wines.length === 0) {
      for (const wine of INITIAL_WINES) await setDoc(doc(db, 'wines', wine.id), wine);
      _wines = [...INITIAL_WINES];
    }

    const questSnap = await getDocs(collection(db, 'quests'));
    _quests = [];
    questSnap.forEach(d => _quests.push(d.data()));

    _setSyncStatus('ok');
  } catch(e) {
    _setSyncStatus('err');
    console.error('[data] loadAll:', e);
    _exList = [...CONFIG.DEFAULT_EXERCISES];
  }
}

export async function saveDay(key, data) {
  _setSyncStatus('syncing');
  const isEmpty = !data || (!data.exercises?.length && !data.cf && !data.memo && !data.breakfast && !data.lunch && !data.dinner);
  try {
    if (isEmpty) { delete _cache[key]; await deleteDoc(doc(db, 'workouts', key)); }
    else { _cache[key] = data; await setDoc(doc(db, 'workouts', key), data); }
    _setSyncStatus('ok');
  } catch(e) { _setSyncStatus('err'); console.error('[data] saveDay:', e); }
}

export async function saveExercise(ex) {
  try {
    await setDoc(doc(db, 'exercises', ex.id), ex);
    const idx = _exList.findIndex(e => e.id === ex.id);
    if (idx >= 0) _exList[idx] = ex; else _exList.push(ex);
    _exList = _sortExList(_exList);
  } catch(e) { console.error('[data] saveExercise:', e); }
}

export async function deleteExercise(id) {
  try { await deleteDoc(doc(db, 'exercises', id)); _exList = _exList.filter(e => e.id !== id); }
  catch(e) { console.error('[data] deleteExercise:', e); }
}

// goal: { id, label, dday(YYYY-MM-DD), condition:{workoutPerWeek,dietOkPct}|null, aiAnalysis|null }
export async function saveGoal(goal) {
  try {
    await setDoc(doc(db, 'goals', goal.id), goal);
    const idx = _goals.findIndex(g => g.id === goal.id);
    if (idx >= 0) _goals[idx] = goal; else _goals.push(goal);
  } catch(e) { console.error('[data] saveGoal:', e); }
}

export async function deleteGoal(id) {
  try { await deleteDoc(doc(db, 'goals', id)); _goals = _goals.filter(g => g.id !== id); }
  catch(e) { console.error('[data] deleteGoal:', e); }
}

export const getGoals = () => _goals;

// quest: { id, title, type('daily'|'weekly'), auto(bool), autoType('workout'|'diet'), checks:{[dateKey]:bool} }
export async function saveQuest(quest) {
  try {
    await setDoc(doc(db, 'quests', quest.id), quest);
    const idx = _quests.findIndex(q => q.id === quest.id);
    if (idx >= 0) _quests[idx] = quest; else _quests.push(quest);
  } catch(e) { console.error('[data] saveQuest:', e); }
}

export async function deleteQuest(id) {
  try { await deleteDoc(doc(db, 'quests', id)); _quests = _quests.filter(q => q.id !== id); }
  catch(e) { console.error('[data] deleteQuest:', e); }
}

export const getQuests = () => _quests;

export async function saveWine(wine) {
  try {
    await setDoc(doc(db, 'wines', wine.id), wine);
    const idx = _wines.findIndex(w => w.id === wine.id);
    if (idx >= 0) _wines[idx] = wine; else _wines.push(wine);
  } catch(e) { console.error('[data] saveWine:', e); }
}

export async function deleteWine(id) {
  try { await deleteDoc(doc(db, 'wines', id)); _wines = _wines.filter(w => w.id !== id); }
  catch(e) { console.error('[data] deleteWine:', e); }
}

export const getWines = () => _wines;

export const getExList    = ()      => _exList;
export const getCache     = ()      => _cache;
export const getDay       = (y,m,d) => _cache[dateKey(y,m,d)] || {};
export const getExercises = (y,m,d) => getDay(y,m,d).exercises || [];
export const getMuscles   = (y,m,d) => [...new Set(getExercises(y,m,d).map(e => e.muscleId))];
export const getCF        = (y,m,d) => !!getDay(y,m,d).cf;
export const getMemo      = (y,m,d) => getDay(y,m,d).memo || '';

export const getDiet = (y,m,d) => {
  const r = getDay(y,m,d);
  return {
    breakfast:r.breakfast||'', lunch:r.lunch||'', dinner:r.dinner||'',
    bOk:r.bOk??null, lOk:r.lOk??null, dOk:r.dOk??null,
    bKcal:r.bKcal||0, lKcal:r.lKcal||0, dKcal:r.dKcal||0,
    bReason:r.bReason||'', lReason:r.lReason||'', dReason:r.dReason||'',
  };
};

export const dietDayOk = (y,m,d) => {
  const dt = getDiet(y,m,d);
  if (!dt.breakfast && !dt.lunch && !dt.dinner) return null;
  return dt.bOk !== false && dt.lOk !== false && dt.dOk !== false;
};

export const calcVolume = (sets) => (sets||[]).reduce((sum, s) => sum + (s.kg||0) * (s.reps||0), 0);

export const getVolumeHistory = (exerciseId) =>
  Object.entries(_cache)
    .filter(([, day]) => (day.exercises||[]).some(e => e.exerciseId === exerciseId))
    .map(([key, day]) => {
      const entry = day.exercises.find(e => e.exerciseId === exerciseId);
      return { date: key, volume: calcVolume(entry.sets) };
    })
    .filter(h => h.volume > 0)
    .sort((a,b) => a.date.localeCompare(b.date));

export const getLastSession = (exerciseId) => {
  const entries = Object.entries(_cache)
    .filter(([, day]) => (day.exercises||[]).some(e => e.exerciseId === exerciseId))
    .sort(([a],[b]) => b.localeCompare(a));
  if (!entries.length) return null;
  const [date, day] = entries[0];
  const entry = day.exercises.find(e => e.exerciseId === exerciseId);
  return { date, sets: entry.sets };
};

export function calcStreaks() {
  let workout=0, diet=0, combined=0;
  let cur = new Date(TODAY);
  while (true) {
    const y=cur.getFullYear(), m=cur.getMonth(), d=cur.getDate();
    if (!getMuscles(y,m,d).length && !getCF(y,m,d)) break;
    workout++; cur.setDate(cur.getDate()-1);
  }
  cur = new Date(TODAY);
  while (true) {
    const y=cur.getFullYear(), m=cur.getMonth(), d=cur.getDate();
    if (dietDayOk(y,m,d) !== true) break;
    diet++; cur.setDate(cur.getDate()-1);
  }
  cur = new Date(TODAY);
  while (true) {
    const y=cur.getFullYear(), m=cur.getMonth(), d=cur.getDate();
    const hasWorkout = getMuscles(y,m,d).length > 0 || getCF(y,m,d);
    const hasDiet    = dietDayOk(y,m,d) === true;
    if (!hasWorkout && !hasDiet) break;
    combined++; cur.setDate(cur.getDate()-1);
  }
  return { workout, diet, combined };
}

export const dateKey     = (y,m,d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
export const daysInMonth = (y,m)   => new Date(y,m+1,0).getDate();
export const TODAY       = (() => { const t=new Date(); t.setHours(0,0,0,0); return t; })();
export const isToday     = (y,m,d) => { const t=new Date(y,m,d);t.setHours(0,0,0,0);return t.getTime()===TODAY.getTime(); };
export const isFuture    = (y,m,d) => { const t=new Date(y,m,d);t.setHours(0,0,0,0);return t.getTime()>TODAY.getTime(); };

function _sortExList(list) {
  const mOrder = MUSCLES.map(m => m.id);
  return list.sort((a,b) => {
    const mi = mOrder.indexOf(a.muscleId) - mOrder.indexOf(b.muscleId);
    return mi !== 0 ? mi : (a.order||99) - (b.order||99);
  });
}
