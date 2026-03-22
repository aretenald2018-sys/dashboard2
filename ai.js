// ================================================================
// ai.js
// 의존성: config.js, data.js
// 역할: Claude API 호출 (식단 분석, 식단 추천, 운동 추천)
// 외부에서 사용: import { getDietRec, getWorkoutRec, analyzeDiet } from './ai.js'
// ================================================================

import { CONFIG, MUSCLES }                    from './config.js';
import { TODAY, getMemo, getExercises, getDiet, getExList } from './data.js';

// ── 공통 Claude 호출 ─────────────────────────────────────────────
async function callClaude(prompt, maxTokens = 400) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'x-api-key':      CONFIG.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      CONFIG.CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages:   [{ role:'user', content:prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

// ── 오늘의 식단 추천 ─────────────────────────────────────────────
export async function getDietRec() {
  const bubble = document.getElementById('diet-bubble');
  bubble.textContent = '';
  bubble.classList.add('loading');

  const recentMeals = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(TODAY); d.setDate(d.getDate() - i);
    const dt = getDiet(d.getFullYear(), d.getMonth(), d.getDate());
    if (dt.breakfast || dt.lunch || dt.dinner) {
      recentMeals.push(`${i===0?'오늘':i+'일전'}: 아침(${dt.breakfast||'-'}) 점심(${dt.lunch||'-'}) 저녁(${dt.dinner||'-'})`);
    }
  }

  const prompt = `당신은 전문 영양사입니다. 다이어트 중인 성인 남성에게 오늘 식단 3세트를 추천해주세요.
최근 식단: ${recentMeals.length ? recentMeals.join(' / ') : '기록 없음'}
조건: 총 1500kcal 이하, 최근 메뉴와 겹치지 않게, 한식/양식/아시안 다양하게.
형식: 세트1~3 각각 아침/점심/저녁과 총칼로리를 3줄로 간결하게.`;

  try {
    bubble.textContent = await callClaude(prompt);
  } catch(e) {
    bubble.textContent = '오류: ' + e.message;
  } finally {
    bubble.classList.remove('loading');
  }
}

// ── 오늘의 운동 추천 ─────────────────────────────────────────────
export async function getWorkoutRec() {
  const bubble = document.getElementById('workout-bubble');
  bubble.textContent = '';
  bubble.classList.add('loading');

  const weekMemos = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(TODAY); d.setDate(d.getDate() - i);
    const y=d.getFullYear(), mo=d.getMonth(), dd=d.getDate();
    const exList  = getExercises(y, mo, dd);
    const memo    = getMemo(y, mo, dd);
    if (exList.length || memo) {
      const names = exList.map(e => {
        const ex = getExList().find(x => x.id === e.exerciseId);
        return ex?.name || e.exerciseId;
      });
      weekMemos.push(`${i===0?'오늘':i+'일전'}(${names.join(',')||'없음'}): ${memo||'메모없음'}`);
    }
  }

  const prompt = `당신은 퍼스널 트레이너입니다. 이번 주 운동 기록을 바탕으로 오늘 운동을 추천해주세요.
이번 주 기록: ${weekMemos.length ? weekMemos.join(' / ') : '기록 없음'}
부족한 부위를 파악하고, 오늘 할 운동 루틴을 세트/횟수 포함해 구체적으로 추천해주세요. 3~4줄로 간결하게.`;

  try {
    bubble.textContent = await callClaude(prompt);
  } catch(e) {
    bubble.textContent = '오류: ' + e.message;
  } finally {
    bubble.classList.remove('loading');
  }
}

// ── 식단 분석 ────────────────────────────────────────────────────
// 반환: { breakfast:{ok,kcal,reason}, lunch:{ok,kcal,reason}, dinner:{ok,kcal,reason} }
export async function analyzeDiet(breakfast, lunch, dinner) {
  if (!breakfast && !lunch && !dinner) throw new Error('식단을 입력해주세요.');

  const prompt = `다음 식단을 분석해주세요.
아침: ${breakfast||'없음'}
점심: ${lunch||'없음'}
저녁: ${dinner||'없음'}

반드시 아래 JSON 형식으로만 응답 (다른 텍스트 없이):
{"breakfast":{"ok":true,"kcal":350,"reason":"단백질 중심 적정 칼로리"},"lunch":{"ok":false,"kcal":900,"reason":"삼겹살+소주 고지방 고칼로리"},"dinner":{"ok":true,"kcal":400,"reason":"채소 위주 저칼로리"}}
기준: 한 끼 ${CONFIG.DIET_KCAL_LIMIT}kcal 이하 + 튀김/패스트푸드/고지방 주식 아니면 OK.
입력 없으면 ok:true, kcal:0, reason:"기록없음"`;

  const text   = await callClaude(prompt, 300);
  const clean  = text.trim().replace(/```json|```/g, '');
  return JSON.parse(clean);
}
