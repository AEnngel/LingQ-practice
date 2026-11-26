/* 26개 언어 학습 테스트 — 문법 · 단어 · 내가 보낸 문장 · 자료실
   데이터는 data/ 아래 JSON을 그때그때 fetch 한다. */
'use strict';

const app = document.getElementById('app');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ------------------------------------------------------------------ 저장소 */
const store = {
  get(k, d) { try { const v = localStorage.getItem('lq.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lq.' + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem('lq.' + k); } catch (e) { } }
};

const SET = Object.assign({ pron: true, tone: true, rate: 1, tileSound: true }, store.get('settings', {}));
function saveSet() { store.set('settings', SET); }

const MODE_NAME = { words: '단어', sent: '내 문장', gram: '문법 연습', verb: '동사 변화' };

/* ================================================================== 음성(TTS)
   기기에 들어 있는 음성(speechSynthesis)으로 원어를 읽어 준다.
   - 언어별 BCP-47 코드로 음성을 고르고, 정확한 음성이 없으면 가까운 음성으로 대신한다.
   - 배속은 0.5x · 1x · 1.5x · 2x, localStorage에 저장. */
const LANG_CODE = {
  1: 'ko-KR', 2: 'en-GB', 3: 'en-GB', 4: 'de-DE', 5: 'fr-FR', 6: 'es-ES', 7: 'pt-PT',
  8: 'it-IT', 9: 'la', 10: 'nl-NL', 11: 'sco', 12: 'ga-IE', 13: 'da-DK', 14: 'nb-NO',
  15: 'sv-SE', 16: 'is-IS', 17: 'fi-FI', 18: 'hu-HU', 19: 'pl-PL', 20: 'uk-UA',
  21: 'ru-RU', 22: 'el-GR', 23: 'af-ZA', 24: 'ja-JP', 25: 'zh-CN', 26: 'zh-HK'
};
const GUIDE_CODE = {
  en: 'en-GB', cockney: 'en-GB', scottish: 'en-GB', es: 'es-ES', de: 'de-DE',
  fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT', nl: 'nl-NL', ga: 'ga-IE'
};
const CODE_KO = {
  'ko-KR': '한국어', 'en-GB': '영어', 'de-DE': '독일어', 'fr-FR': '프랑스어', 'es-ES': '스페인어',
  'pt-PT': '포르투갈어', 'it-IT': '이탈리아어', 'la': '라틴어', 'nl-NL': '네덜란드어', 'sco': '스코츠어',
  'ga-IE': '아일랜드어', 'da-DK': '덴마크어', 'nb-NO': '노르웨이어', 'sv-SE': '스웨덴어', 'is-IS': '아이슬란드어',
  'fi-FI': '핀란드어', 'hu-HU': '헝가리어', 'pl-PL': '폴란드어', 'uk-UA': '우크라이나어', 'ru-RU': '러시아어',
  'el-GR': '그리스어', 'af-ZA': '아프리칸스어', 'ja-JP': '일본어', 'zh-CN': '중국어', 'zh-HK': '광둥어',
  'yue': '광둥어'
};
/* 정확한 음성이 기기에 없을 때 차례로 시도할 코드 */
const CODE_FALLBACK = {
  'la': ['it-IT'], 'sco': ['en-GB'], 'zh-HK': ['yue', 'zh-CN'], 'pt-PT': ['pt-BR'],
  'nb-NO': ['no-NO', 'da-DK'], 'ga-IE': [], 'is-IS': []
};
const RATES = [0.5, 1, 1.5, 2];
/* 언어별 기본 어순 (문장 순서 화면 상단 힌트) */
const ORDER_HINT = {
  2: '주어 → 동사 → 목적어', 3: '주어 → 동사 → 목적어', 4: '주어 → 동사(2번째 자리) → 목적어',
  5: '주어 → 동사 → 목적어', 6: '주어 → 동사 → 목적어', 7: '주어 → 동사 → 목적어',
  8: '주어 → 동사 → 목적어', 9: '주어 → 목적어 → 동사', 10: '주어 → 동사(2번째 자리) → 목적어',
  11: '주어 → 동사 → 목적어', 12: '동사 → 주어 → 목적어', 13: '주어 → 동사 → 목적어',
  14: '주어 → 동사 → 목적어', 15: '주어 → 동사 → 목적어', 16: '주어 → 동사 → 목적어',
  17: '주어 → 동사 → 목적어', 18: '주어 → 동사 → 목적어', 19: '주어 → 동사 → 목적어',
  20: '주어 → 동사 → 목적어', 21: '주어 → 동사 → 목적어', 22: '주어 → 동사 → 목적어',
  23: '주어 → 동사(2번째 자리) → 목적어', 24: '주어 → 목적어 → 동사',
  25: '주어 → 동사 → 목적어', 26: '주어 → 동사 → 목적어'
};
function orderHintOf(no) { return ORDER_HINT[no] || ''; }
/* 언어별 어순 규칙 한 줄 설명 (어순 고르기의 상세 힌트·해설) */
const ORDER_TIP = {
  2: '평서문은 주어 → 동사 → 목적어. 의문문은 조동사가 맨 앞에 오고, 관사·형용사는 명사 앞에 붙습니다.',
  3: '영어와 같이 주어 → 동사 → 목적어이고, 조동사·의문사가 맨 앞에 옵니다.',
  4: '정동사는 언제나 두 번째 자리, 나머지 동사(분사·원형)는 문장 끝으로 갑니다.',
  5: '주어 → 동사 → 목적어. 형용사는 대개 명사 뒤에 오고 목적어 대명사는 동사 앞에 섭니다.',
  6: '주어 → 동사 → 목적어. 형용사는 명사 뒤에 오고 주어 대명사는 자주 생략합니다.',
  7: '주어 → 동사 → 목적어. 형용사는 명사 뒤에 옵니다.',
  8: '주어 → 동사 → 목적어. 형용사는 명사 뒤에 오고 목적어 대명사는 동사 앞에 섭니다.',
  9: '동사가 대개 문장 끝에 옵니다. 어순은 자유롭고 격어미가 역할을 정합니다.',
  10: '정동사는 두 번째 자리, 나머지 동사·분사는 문장 끝으로 갑니다.',
  11: '영어와 같이 주어 → 동사 → 목적어이고, 조동사가 맨 앞에 옵니다.',
  12: '동사 → 주어 → 목적어 순서이고, 형용사는 명사 뒤에 옵니다.',
  13: '정동사는 두 번째 자리이고 기본은 주어 → 동사 → 목적어입니다.',
  14: '정동사는 두 번째 자리이고 기본은 주어 → 동사 → 목적어입니다.',
  15: '정동사는 두 번째 자리이고 기본은 주어 → 동사 → 목적어입니다.',
  16: '정동사는 두 번째 자리이고 기본은 주어 → 동사 → 목적어입니다.',
  17: '어순이 자유롭고 격어미가 역할을 정합니다. 기본은 주어 → 동사 → 목적어입니다.',
  18: '어순이 자유롭습니다. 강조하는 말이 동사 바로 앞에 옵니다.',
  19: '격어미가 역할을 정해 어순이 자유롭습니다. 기본은 주어 → 동사 → 목적어입니다.',
  20: '격어미가 역할을 정하는 자유 어순이고, 기본은 주어 → 동사 → 목적어입니다.',
  21: '격어미가 역할을 정하는 자유 어순이고, 새 정보가 문장 끝에 옵니다.',
  22: '주어 → 동사 → 목적어. 형용사는 명사 뒤에 오고 목적어 대명사는 동사 앞에 섭니다.',
  23: '정동사는 두 번째 자리이고 기본은 주어 → 동사 → 목적어입니다.'
};
const ROLE_MOD = ['관사', '소유격', '지시사', '수사'];
const ROLE_HEAD = ['명사', '목적어', '보어'];

/* 어순 고르기: 문제 풀기 전 상세 힌트 (문장 뼈대 + 단어 뜻, 원어 철자는 감춤) */
function pickHint(no, o, lname) {
  if (!o || !o.t || !o.t.length) return null;
  const roles = (o.r || []).map(x => String(x || '').trim());
  const means = (o.m || []).map(x => String(x || '').trim());
  const words = [];
  means.forEach(m => { if (m && words.indexOf(m) < 0) words.push(m); });
  words.sort((a, b) => a.localeCompare(b, 'ko'));
  const h = {
    lname: lname || '',
    rule: ORDER_HINT[no] || '',
    tip: ORDER_TIP[no] || '',
    skeleton: roles.filter(Boolean).join(' → '),
    words: words.join(' · ')
  };
  return (h.rule || h.skeleton || h.words) ? h : null;
}

/* 어순 고르기: 정답 후 해설 — 단어별 원어·역할·뜻, 발음, 역할 순서, 왜 이 순서인지 */
function pickNotes(o) {
  const r = (o.r || []).map(x => String(x || '').trim());
  const t = (o.t || []).map(x => String(x || '').trim());
  const cut = x => String(x || '').replace(/^[\s.,!?;:·'"()\[\]…—–-]+|[\s.,!?;:·'"()\[\]…—–-]+$/g, '');
  const out = [];
  if (!r.length || r.length !== t.length) return out;
  const subj = r.indexOf('주어');
  if (r[0] === '조동사') out.push(`조동사 ${cut(t[0])}가 문장 맨 앞에 와서 의문문을 만듭니다.`);
  else if (r[0] === '의문사') out.push(`의문사 ${cut(t[0])}가 문장 맨 앞에 옵니다.`);
  else if (r[0] === '동사' && r.length > 2) {
    out.push(subj > 0 ? `동사 ${cut(t[0])}가 주어보다 앞에 오는 어순입니다.` : `동사 ${cut(t[0])}로 시작하는 명령문 어순입니다.`);
  }
  const chunks = [];
  const isArt = x => ROLE_MOD.indexOf(x) >= 0;
  const isAdj = x => x === '형용사';
  const isHead = x => ROLE_HEAD.indexOf(x) >= 0;
  for (let i = 0; i < r.length; i++) {
    if (!isArt(r[i])) continue;
    const toks = [];
    let j = i;
    while (j < r.length && (isArt(r[j]) || isAdj(r[j]))) { toks.push(cut(t[j])); j++; }
    if (toks.length && j < r.length && isHead(r[j])) { toks.push(cut(t[j])); chunks.push(toks.join(' ')); i = j; }
  }
  if (chunks.length) out.push(`꾸미는 말이 명사 앞에 붙어 ${chunks.slice(0, 2).map(x => `'${x}'`).join(', ')}처럼 한 덩어리를 이룹니다.`);
  const pi = r.indexOf('전치사');
  if (pi >= 0 && pi + 1 < r.length && ROLE_HEAD.indexOf(r[pi + 1]) >= 0 && !chunks.length) {
    out.push(`전치사 ${cut(t[pi])}는 명사 앞에 붙습니다.`);
  }
  const last = r.length - 1;
  if (last > 1 && /동사$/.test(r[last]) && out.length < 2) {
    out.push(`동사 ${cut(t[last])}가 문장 끝에 옵니다.`);
  }
  return out.slice(0, 2);
}

function pickWhy(no, o) {
  if (!o || !o.t || !o.t.length) return '';
  const t = o.t, r = o.r || [], m = o.m || [];
  const chips = t.map((w, i) => {
    const bits = [r[i], m[i]].filter(Boolean).join(' · ');
    return `<span class="w"><b>${esc(w)}</b>${bits ? `<i>${esc(bits)}</i>` : ''}</span>`;
  }).join('');
  const notes = pickNotes(o);
  return `<div class="pickmap">${chips}</div>` +
    (o.p ? `<div class="pickpron">발음 ${esc(o.p)}</div>` : '') +
    (r.length ? `<div class="pickseq">${esc(r.join(' → '))}</div>` : '') +
    (notes.length ? `<ul class="picknotes">${notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '') +
    (ORDER_TIP[no] ? `<div class="picktipline">${esc(ORDER_TIP[no])}</div>` : '');
}
/* 타일 표시: 단어 (역할 · 뜻) */
function tileHtml(word, role, cls, attr, mean) {
  const bits = [role, mean].filter(Boolean).map(esc).join(' · ');
  const r = bits ? ` <span class="role">(${bits})</span>` : '';
  return `<button class="${cls}" ${attr}>${esc(word)}${r}</button>`;
}

let toastTimer = null;
function toast(msg, ms) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms || 2800);
}

const TTS = (() => {
  const synth = (typeof window !== 'undefined' && window.speechSynthesis) || null;
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  const waiting = [];
  let voices = [], ready = false, curEl = null, curUtt = null, timer = null, warned = false;
  /* 앱 안 브라우저(WebView)에서는 음성 재생이 막히는 경우가 많아 미리 알려 준다 */
  const UA = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const inApp = /;\s*wv\)|KAKAOTALK|NAVER\(|DaumApps|Instagram|FBAN|FBAV|Line\/|Snapchat|Twitter/i.test(UA);
  const BLOCKED = '앱 내 브라우저에서는 소리가 막힐 수 있어요. 오른쪽 위 메뉴(⋮)에서 크롬/삼성 인터넷으로 열기를 눌러 주세요.';

  function refresh() {
    if (!supported) return;
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
    if (!voices.length || ready) return;
    ready = true;
    if (timer) { clearInterval(timer); timer = null; }
    waiting.splice(0).forEach(cb => { try { cb(); } catch (e) { } });
  }
  if (supported) {
    refresh();
    try { synth.addEventListener('voiceschanged', refresh); } catch (e) { synth.onvoiceschanged = refresh; }
    if (!ready) {
      let n = 0;
      timer = setInterval(() => {
        refresh();
        if (ready || ++n >= 12) {
          clearInterval(timer); timer = null;
          /* 안드로이드 WebView처럼 끝내 목록을 주지 않는 기기: 기다림을 끝내고 기본 엔진으로 시도하게 한다 */
          if (!ready) { ready = true; waiting.splice(0).forEach(cb => { try { cb(); } catch (e) { } }); }
        }
      }, 350);
    }
  }

  const norm = c => String(c || '').toLowerCase().replace(/_/g, '-');
  /* iOS 구형 로봇 성우(귀신소리) 차단 + 자연스러운 음성 우대 */
  const VOICE_GOOD = ['enhanced', 'premium', 'siri', 'natural', 'neural', 'online', 'google'];
  const VOICE_BAD = ['compact', 'eloquence', 'espeak', 'pico'];
  const VOICE_ROBOT = ['sandy', 'shelley', 'eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko',
    'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news', 'jester',
    'organ', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox', 'fred', 'junior', 'ralph',
    'kathy', 'karen', 'eloquence', 'compact', 'espeak', 'pico'];
  const UK_NAMES = ['daniel', 'oliver', 'arthur', 'kate', 'serena', 'martha', 'stephanie',
    'libby', 'ryan', 'sonia', 'george', 'hazel', 'susan', 'maisie', 'google uk english'];
  function vTokens(name) {
    return String(name || '').toLowerCase().replace(/[^a-z\u00a0-\u024f]+/g, ' ').trim().split(' ').filter(Boolean);
  }
  function isRobot(name) {
    const t = vTokens(name);
    if (!t.length) return false;
    const joined = ' ' + t.join(' ') + ' ';
    for (const k of VOICE_ROBOT) {
      if (k.indexOf(' ') !== -1) { if (joined.indexOf(' ' + k + ' ') !== -1) return true; }
      else if (t.indexOf(k) !== -1) return true;
    }
    return false;
  }
  function isUkName(name) {
    const n = String(name || '').toLowerCase();
    return UK_NAMES.some(k => n.indexOf(k) !== -1);
  }
  function voiceQuality(name) {
    const n = String(name || '').toLowerCase();
    let sc = 0;
    if (isRobot(n)) sc -= 100;
    for (const k of VOICE_GOOD) if (n.indexOf(k) !== -1) sc += 10;
    for (const k of VOICE_BAD) if (n.indexOf(k) !== -1) sc -= 30;
    return sc;
  }
  function candidates(code) {
    const list = [code].concat(CODE_FALLBACK[code] || []);
    const base = String(code || '').split('-')[0];
    if (base && base !== code) list.push(base);
    return list.map(norm).filter(Boolean);
  }
  /* 목표 언어에 맞는 음성 중 로봇 성우를 피하고 자연 음성을 고른다 */
  function pick(code) {
    if (!ready) refresh();
    if (!voices.length) return null;
    const cands = candidates(code);
    const base = norm(code);
    let best = null, bestScore = -1e9, bestRank = 99;
    for (const v of voices) {
      const vl = norm(v.lang);
      let rank = -1;
      for (let i = 0; i < cands.length; i++) {
        const c = cands[i];
        if (vl === c || vl.indexOf(c + '-') === 0) { rank = i; break; }
      }
      if (rank < 0) continue;
      let sc = 100 - rank * 22 + voiceQuality(v.name);
      if (base.indexOf('en') === 0 && isUkName(v.name)) sc += 8;
      if (sc > bestScore) { bestScore = sc; best = v; bestRank = rank; }
    }
    if (!best) return null;
    return { voice: best, exact: bestRank === 0, rank: bestRank, score: bestScore };
  }
  function find(code) {
    const p = pick(code);
    return p ? p.voice : null;
  }
  /* 재생 중이던 것만 끊는다(새 발화를 준비할 때) */
  function release() {
    if (curEl) curEl.classList.remove('playing');
    curEl = null; curUtt = null;
    if (!supported) return;
    try { synth.cancel(); } catch (e) { }
  }
  function stop() { release(); }
  function say(text, code, el, name) {
    const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!t) return false;
    if (!supported) { toast(BLOCKED, 6500); return false; }
    if (curEl && curEl === el) { stop(); return true; }   /* 듣던 버튼을 다시 누르면 정지 */
    const lang = code || 'en-GB';
    /* 목록이 비어 있거나 이 언어 음성이 없어도 포기하지 않는다:
       voice 없이 u.lang 만 지정해도 기기 기본 TTS 엔진이 읽어 주는 경우가 많다(안드로이드). */
    const p = pick(lang);
    const v = p ? p.voice : null;
    const busy = !!(curUtt || synth.speaking || synth.pending);
    if (busy) release();   /* cancel() 직후 같은 tick의 speak()는 삼성 인터넷·크롬에서 무시되므로 이때만 잠깐 미룬다 */
    const u = new SpeechSynthesisUtterance(t);
    if (v) { u.voice = v; u.lang = v.lang || lang; } else { u.lang = lang; }
    u.rate = Math.min(3, Math.max(0.3, Number(SET.rate) || 1));
    u.pitch = 1;
    curEl = el || null; curUtt = u;
    if (el) el.classList.add('playing');
    let started = false;
    const done = () => { if (el) el.classList.remove('playing'); if (curUtt === u) { curUtt = null; curEl = null; } };
    u.onstart = () => { started = true; };
    u.onend = done;
    u.onerror = ev => {
      const err = ev && ev.error;
      done();
      if (err === 'interrupted' || err === 'canceled') return;   /* 우리가 끊은 것 */
      toast(BLOCKED, 6500);
    };
    const fire = () => {
      if (curUtt !== u) return;
      try { synth.resume(); } catch (e) { }
      try { synth.speak(u); } catch (e) { done(); toast(BLOCKED, 6500); return; }
      /* 예외 없이 조용히 무시하는 기기(안드로이드 WebView) — 시작 신호가 없으면 한 번만 안내 */
      setTimeout(() => {
        if (started || curUtt !== u) return;
        if (synth.speaking || synth.pending) return;
        if (warned) return;
        warned = true;
        toast('소리가 시작되지 않았어요. ' + BLOCKED, 7000);
      }, 1600);
    };
    /* 사용자 탭 제스처가 살아 있는 지금(클릭 핸들러 안) 바로 speak() — setTimeout 안에서 부르면 안드로이드가 무시한다 */
    if (busy) setTimeout(fire, 40); else fire();
    return true;
  }
  return {
    supported, say, stop, find, pick, inApp, blockedMsg: BLOCKED,
    list: () => voices.slice(),
    count: () => voices.length,
    has: code => !!find(code),
    get ready() { return ready; },
    whenReady: cb => {
      if (ready) { try { cb(); } catch (e) { } return; }
      waiting.push(cb);
      setTimeout(() => { try { cb(); } catch (e) { } }, 3500);
    }
  };
})();

/* 한국어 설명이 섞인 문법 문제에서 목표 언어 부분만 뽑아 읽는다 */
const SCRIPT = {
  latin: /[A-Za-z\u00C0-\u024F]/,
  cyr: /[\u0400-\u04FF]/,
  greek: /[\u0370-\u03FF\u1F00-\u1FFF]/,
  jp: /[\u3040-\u30FF\u4E00-\u9FFF]/,
  han: /[\u4E00-\u9FFF\u3400-\u4DBF]/
};
function scriptOf(code) {
  const b = String(code || '').toLowerCase().split('-')[0];
  if (b === 'ru' || b === 'uk' || b === 'be' || b === 'bg' || b === 'sr') return 'cyr';
  if (b === 'el') return 'greek';
  if (b === 'ja') return 'jp';
  if (b === 'zh' || b === 'yue') return 'han';
  return 'latin';
}
function plainText(html) {
  return String(html == null ? '' : html)
    .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
function nativeFrom(html, code) {
  let p = plainText(html);
  if (!p) return '';
  p = p.replace(/[\uAC00-\uD7A3\u3131-\u318E]+/g, ' ');   /* 한국어 설명 제거 */
  const test = SCRIPT[scriptOf(code)];
  const out = p.split(/[\u3000-\u303F\uFF00-\uFFEF|]+/)
    .map(c => c.replace(/\s+/g, ' ').replace(/\(\s*\)/g, ' ').trim())
    .map(c => c.replace(/^[\s.,;:!?·…\-–—/()[\]{}'"“”‘’]+/, '').replace(/[\s.,;:!?·…\-–—/()[\]{}'"“”‘’]+$/, ''))
    .filter(c => c && test.test(c));
  if (!out.length) return '';
  const t = out.join(' / ');
  return t.length > 500 ? t.slice(0, 500).trim() : t;
}

function spkBtn(key) {
  return `<button type="button" class="spk" data-say="${key}" aria-label="원어 듣기" title="듣기">🔊</button>`;
}
function spkSpan(key) {
  return `<span class="spk" role="button" tabindex="0" data-say="${key}" aria-label="원어 듣기" title="듣기">🔊</span>`;
}
function bindSpeak(get) {
  $$('[data-say]', app).forEach(el => {
    const act = e => {
      e.preventDefault(); e.stopPropagation();
      const d = get(el.dataset.say);
      if (d && d.t) TTS.say(d.t, d.c, el, d.n);
    };
    el.addEventListener('click', act);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') act(e); });
  });
}
function rateBarHtml() {
  const r = Number(SET.rate) || 1;
  return `<div class="ratebar">
    <span class="rlbl">듣기 배속</span>
    ${RATES.map(x => `<button type="button" class="rate ${Math.abs(r - x) < 0.01 ? 'on' : ''}" data-rate="${x}"><b>${x}x</b>${x === 0.5 ? '<i>느리게</i>' : x === 1 ? '<i>보통</i>' : x === 2 ? '<i>빠르게</i>' : ''}</button>`).join('')}
    <button type="button" class="diagchip" data-vdiag-bar="1">🩺 소리 진단</button>
  </div>`;
}
/* 지금 퀴즈의 언어 코드 (소리 진단이 이 언어로 테스트한다) */
let curSayCode = '';
function pickSayCode(items) {
  for (const it of items || []) {
    const d = it.say || it.sayPrompt || it.sayAnswer || it.sayExtra || null;
    if (d && d.c) return d.c;
  }
  return '';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-vdiag-bar]');
  if (b) showVoiceDiag(curSayCode || 'en-GB');
});
function bindRate(onPick) {
  $$('[data-rate]', app).forEach(b => {
    b.onclick = () => {
      SET.rate = Number(b.dataset.rate);
      saveSet();
      $$('[data-rate]', app).forEach(x => x.classList.toggle('on', x === b));
      if (onPick) onPick();
    };
  });
}
function fillVoiceLine(box, code, sample) {
  if (!box) return;
  const name = CODE_KO[code] || code;
  box.innerHTML = `<button type="button" class="btn plain sm" data-voice="1">🔊 ${esc(name)} 테스트</button>
    <button type="button" class="btn plain sm diagbtn" data-vdiag="1">🩺 소리 진단</button>
    <span class="vstat">음성 상태 확인 중…</span>`;
  const btn = $('[data-voice]', box), stat = $('.vstat', box), diag = $('[data-vdiag]', box);
  btn.onclick = () => TTS.say(sample || sampleOf(code), code, btn, name);
  if (diag) diag.onclick = () => showVoiceDiag(code);
  if (!TTS.supported) { stat.textContent = '이 브라우저는 음성 읽기를 지원하지 않아요'; stat.classList.add('no'); return; }
  TTS.whenReady(() => {
    if (!box.isConnected || !stat.isConnected) return;
    if (!TTS.ready) { stat.textContent = '음성 목록을 불러오는 중…'; stat.className = 'vstat'; return; }
    const p = TTS.pick(code);
    if (p) {
      stat.textContent = `${name} 음성: ${p.voice.name} [${p.voice.lang}]`;
      stat.className = 'vstat ok';
    } else if (!TTS.count()) {
      stat.textContent = `음성 목록을 못 읽었어요 — 그래도 🔊 를 누르면 기기 기본 음성으로 재생을 시도해요`;
      stat.className = 'vstat';
    } else {
      stat.textContent = `기기에 ${name} 음성 없음 — 🔊 를 누르면 기본 음성으로 시도하고, 안 되면 설정에서 음성 데이터를 받아 주세요`;
      stat.className = 'vstat no';
    }
  });
}

/* ------------------------------------------------------ 소리 진단 · 테스트 */
const VOICE_SAMPLE = {
  'ko-KR': '안녕하세요. 목소리 테스트입니다.',
  'en-GB': 'Hello. This is a voice test.',
  'de-DE': 'Guten Tag. Das ist ein Stimmentest.',
  'fr-FR': 'Bonjour. Ceci est un test de voix.',
  'es-ES': 'Hola. Esta es una prueba de voz.',
  'pt-PT': 'Olá. Este é um teste de voz.',
  'it-IT': 'Ciao. Questa è una prova di voce.',
  'la': 'Salve. Haec est probatio vocis.',
  'nl-NL': 'Hallo. Dit is een stemtest.',
  'sco': 'Hallo. This is a voice test.',
  'ga-IE': 'Dia duit. Seo triail ghutha.',
  'da-DK': 'Hej. Dette er en stemmetest.',
  'nb-NO': 'Hei. Dette er en stemmetest.',
  'sv-SE': 'Hej. Det här är ett rösttest.',
  'is-IS': 'Halló. Þetta er raddpróf.',
  'fi-FI': 'Hei. Tämä on äänitesti.',
  'hu-HU': 'Szia. Ez egy hangteszt.',
  'pl-PL': 'Cześć. To jest test głosu.',
  'uk-UA': 'Привіт. Це тест голосу.',
  'ru-RU': 'Привет. Это тест голоса.',
  'el-GR': 'Γεια σας. Αυτό είναι ένα τεστ φωνής.',
  'af-ZA': 'Hallo. Dit is ’n stemtoets.',
  'ja-JP': 'こんにちは。声のテストです。',
  'zh-CN': '你好。这是一个声音测试。',
  'zh-HK': '你好。呢個係聲音測試。'
};
const DIAG_LANGS = [
  ['en-GB', '영어'], ['de-DE', '독일어'], ['fr-FR', '프랑스어'], ['es-ES', '스페인어'],
  ['pt-PT', '포르투갈어'], ['it-IT', '이탈리아어'], ['la', '라틴어'], ['nl-NL', '네덜란드어'],
  ['ga-IE', '아일랜드어'], ['sv-SE', '스웨덴어'], ['fi-FI', '핀란드어'], ['hu-HU', '헝가리어'],
  ['pl-PL', '폴란드어'], ['uk-UA', '우크라이나어'], ['ru-RU', '러시아어'], ['el-GR', '그리스어']
];
function sampleOf(code) { return VOICE_SAMPLE[code] || 'Hello. This is a voice test.'; }

/* 현재 코드에 실제로 잡히는 목소리 요약 (버튼 옆 표시용) */
function voiceLabel(code) {
  if (!TTS.supported) return '이 브라우저는 음성 읽기 미지원';
  if (!TTS.ready) return '목소리 불러오는 중…';
  const p = TTS.pick(code);
  if (!p) return TTS.count() ? '음성 없음' : '기기 기본 음성으로 재생';
  return `🔊 ${p.voice.name} [${p.voice.lang}]`;
}

/* 앱 안 브라우저(WebView)로 열었을 때 — 소리가 막히는 경우가 많아 배너로 알려 준다 */
function soundHelpBanner(force) {
  if (typeof document === 'undefined' || document.getElementById('sndBanner')) return;
  if (!force && !TTS.inApp) return;
  if (store.get('sndBannerOff', false)) return;
  const main = document.querySelector('main');
  if (!main) return;
  const b = document.createElement('div');
  b.id = 'sndBanner';
  b.className = 'sndbanner';
  b.innerHTML = `<span class="sndmsg">🔇 앱 내 브라우저에서는 소리가 막힐 수 있어요. 오른쪽 위 메뉴(⋮)에서 <b>크롬/삼성 인터넷으로 열기</b>를 눌러 주세요.</span>
    <button type="button" class="sndclose" aria-label="안내 닫기" title="안내 닫기">✕</button>`;
  main.parentNode.insertBefore(b, main);
  b.querySelector('.sndclose').onclick = () => { store.set('sndBannerOff', true); b.remove(); };
}

function showVoiceDiag(code) {
  const old = document.getElementById('vdiag');
  if (old) old.remove();
  const total = TTS.count ? TTS.count() : 0;
  const rows = [];
  rows.push(`<div class="vrow"><span>기기 전체 목소리</span><b>${total}개</b></div>`);
  if (code) {
    const p = TTS.supported && TTS.ready ? TTS.pick(code) : null;
    rows.push(`<div class="vrow"><span>${esc(CODE_KO[code] || code)} <em>${esc(code)}</em></span><b>${p ? esc(p.voice.name) + ' [' + esc(p.voice.lang) + ']' : '없음'}</b></div>`);
    if (p && !p.exact) rows.push(`<div class="vnote">정확히 같은 언어 목소리가 없어 가까운 목소리로 읽어요.</div>`);
    if (p && /enhanced|premium|natural|neural|siri|google/i.test(p.voice.name)) {
      rows.push(`<div class="vgood">좋은 음성(고품질)이 잡혔습니다.</div>`);
    }
    const same = (TTS.list ? TTS.list() : []).filter(v => String(v.lang || '').toLowerCase().replace('_', '-').indexOf(code.split('-')[0]) === 0);
    if (same.length) {
      rows.push(`<div class="vsub">이 언어로 설치된 목소리 ${same.length}개</div>`);
      rows.push('<div class="vlist">' + same.slice(0, 10).map(v => {
        const robot = /sandy|shelley|eddy|flo|grandma|grandpa|reed|rocko|albert|bells|boing|bubbles|organ|whisper|zarvox|fred|ralph|kathy|karen|eloquence|compact|espeak|pico/i.test(v.name);
        return `<span class="vtag${robot ? ' bad' : ''}">${esc(v.name)} <em>${esc(v.lang)}</em>${robot ? ' ⚠' : ''}</span>`;
      }).join('') + '</div>');
    } else {
      rows.push('<div class="vnote">이 언어 목소리가 기기에 없습니다.</div>');
    }
  }
  const summary = DIAG_LANGS.map(([c, ko]) => {
    const p = TTS.supported && TTS.ready ? TTS.pick(c) : null;
    return `<div class="vrow"><span>${ko}</span><b class="${p ? '' : 'bad'}">${p ? esc(p.voice.name) : '없음'}</b></div>`;
  }).join('');
  const box = document.createElement('div');
  box.id = 'vdiag';
  box.className = 'vdiag';
  box.innerHTML = `<div class="vdiagcard" role="dialog" aria-label="소리 진단">
    <h3>🩺 소리 진단</h3>
    ${rows.join('')}
    <div class="vsub">주요 언어에 잡히는 목소리</div>
    <div class="vgrid">${summary}</div>
    <p class="vhint">로봇·효과음 성우(⚠ 표시)는 자동으로 피합니다. 목소리가 없으면 아이폰 <b>설정 › 손쉬운 사용 › 말하기 콘텐츠 › 음성</b>에서 해당 언어를 받아 주세요.</p>
    <div class="vfoot">
      <button type="button" class="btn" data-vsay="1">🔊 테스트 듣기</button>
      <button type="button" class="btn plain" data-vclose="1">닫기</button>
    </div>
  </div>`;
  document.body.appendChild(box);
  box.addEventListener('click', e => {
    if (e.target === box || e.target.closest('[data-vclose]')) { box.remove(); return; }
    if (e.target.closest('[data-vsay]')) TTS.say(sampleOf(code || 'en-GB'), code || 'en-GB', null, CODE_KO[code] || '');
  });
}

/* ------------------------------------------------------------------ 유틸 */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/* 데이터에 들어 있는 <b>·<i>·<u>·<br>만 살린다. */
function rich(s) {
  if (s == null) return '';
  let t = String(s).replace(/<\/?span[^>]*>/gi, '');
  t = esc(t);
  return t.replace(/&lt;(\/?)(b|i|u|em|strong|br)\s*\/?&gt;/gi,
    (m, sl, tag) => tag.toLowerCase() === 'br' ? '<br>' : `<${sl}${tag}>`);
}
function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function sample(a, n) { return shuffle(a).slice(0, Math.min(n, a.length)); }
/* pool에서 서로 다른 key를 가진 n개를 고른다(정답 key는 제외). */
function pickUnique(pool, n, excludeIdx, keyOf, correctKey) {
  const seen = new Set([correctKey]);
  const out = [];
  for (const j of shuffle(pool)) {
    if (j === excludeIdx) continue;
    const k = keyOf(j);
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(j);
    if (out.length >= n) break;
  }
  return out;
}
function fmtSize(b) {
  return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.round(b / 1024) + 'KB';
}
function splitPron(pron) {
  if (!pron) return { base: '', tone: '' };
  let m = pron.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (m && /[\u0100-\u01ff]/.test(m[2])) return { base: m[1], tone: m[2] };
  const parts = pron.split(/\s+·\s+/);
  if (parts.length === 2 && /[¹²³⁴⁵⁶]/.test(parts[1])) return { base: parts[0], tone: parts[1] };
  return { base: pron, tone: '' };
}
function pronHtml(pron, cls) {
  if (!SET.pron || !pron) return '';
  const { base, tone } = splitPron(pron);
  const t = (SET.tone && tone) ? ` <span class="tone">${esc(tone)}</span>` : '';
  return `<span class="${cls || 'pron'}">${esc(base)}${t}</span>`;
}
function pronText(pron) {
  if (!SET.pron || !pron) return '';
  const { base, tone } = splitPron(pron);
  return base + (SET.tone && tone ? ' · ' + tone : '');
}
function pronLine(pron) {
  const h = pronHtml(pron, 'pron');
  return h ? h : '';
}

/* ------------------------------------------------------------------ 데이터 */
const cache = {};
/* index.html 의 ?v= 값을 그대로 데이터 요청에도 붙여, 배포할 때 옛 JSON 이 남지 않게 한다 */
const APP_V = (() => {
  try {
    const s = document.currentScript && document.currentScript.src;
    const m = s && s.match(/[?&]v=(\d+)/);
    return m ? m[1] : '';
  } catch (e) { return ''; }
})();
async function load(path) {
  if (cache[path]) return cache[path];
  const url = APP_V ? path + (path.indexOf('?') >= 0 ? '&' : '?') + 'v=' + APP_V : path;
  const r = await fetch(url);
  if (!r.ok) throw new Error(path + ' → HTTP ' + r.status);
  const j = await r.json();
  cache[path] = j;
  return j;
}
const DATA = {
  vocabMeta: () => load('data/vocab/meta.json'),
  vocabItems: () => load('data/vocab/items.json'),
  vocabLang: n => load(`data/vocab/l${String(n).padStart(2, '0')}.json`),
  verbMeta: () => load('data/grammar/verbs/meta.json'),
  verbItems: v => load(`data/grammar/verbs/v${v}_items.json`),
  verbLang: (v, n) => load(`data/grammar/verbs/v${v}_l${String(n).padStart(2, '0')}.json`),
  lingqIndex: () => load('data/grammar/lingq/index.json'),
  lingq: k => load(`data/grammar/lingq/${k}.json`),
  studyIndex: () => load('data/grammar/study/index.json'),
  study: k => load(`data/grammar/study/${k}.json`),
  gamesIndex: () => load('data/grammar/games/index.json'),
  games: n => load(`data/grammar/games/${String(n).padStart(2, '0')}.json`),
  library: () => load('data/library.json')
};

/* ------------------------------------------------------------------ 오답 노트 */
const WRONG_KEY = m => 'wrong.' + m;
const WRONG_MAX = 200;
function wrongList(mode) { return store.get(WRONG_KEY(mode), []); }
function wrongAdd(mode, payload) {
  const list = wrongList(mode);
  const key = JSON.stringify([payload.prompt, payload.answer]);
  if (list.some(x => JSON.stringify([x.prompt, x.answer]) === key)) return;
  list.unshift(payload);
  store.set(WRONG_KEY(mode), list.slice(0, WRONG_MAX));
  refreshWrongBadge();
}
function wrongRemove(mode, key) {
  const list = wrongList(mode).filter(x => x.key !== key);
  store.set(WRONG_KEY(mode), list);
  refreshWrongBadge();
}
function wrongTotal() {
  return Object.keys(MODE_NAME).reduce((s, m) => s + wrongList(m).length, 0);
}
function refreshWrongBadge() {
  const el = $('#wrongCount');
  if (el) el.textContent = wrongTotal();
}

/* ------------------------------------------------------------------ 진행 기록 */
function stats() { return store.get('stats', { answered: 0, correct: 0, sessions: 0 }); }
function addStats(answered, correct) {
  const s = stats();
  s.answered += answered; s.correct += correct; s.sessions += 1;
  store.set('stats', s);
}

/* ------------------------------------------------------------------ 라우팅 */
let state = { tab: 'grammar', quiz: null, setup: {} };

function go(tab) {
  TTS.stop();
  state.tab = tab;
  state.quiz = null;
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const sub = { grammar: '문법 · 단어 · 내가 보낸 문장을 26개 언어로', words: '26개 언어 단어 · 4지선다와 플래시카드', sent: '내가 보낸 문장·표현만 모아서', lib: 'PDF 자료실 · 한곳에서 열고 받기' };
  $('#brandSub').textContent = sub[tab] || '';
  if (tab === 'grammar') renderGrammarSetup();
  if (tab === 'words') renderWordsSetup();
  if (tab === 'sent') renderSentSetup();
  if (tab === 'lib') renderLibrary();
}
$$('.tab').forEach(b => b.onclick = () => go(b.dataset.tab));
$('#btnWrong').onclick = () => renderWrongNote();

function loading(msg) { app.innerHTML = `<div class="loading">${esc(msg || '불러오는 중…')}</div>`; }

/* ================================================================== QUIZ 엔진 */
function startQuiz(quiz) {
  TTS.stop();
  const sc = pickSayCode(quiz.items);
  if (sc) curSayCode = sc;
  state.quiz = { title: quiz.title, mode: quiz.mode, items: quiz.items, idx: 0, answers: [], revealed: false, picked: -1, hintOpen: false };
  renderQuiz();
  window.scrollTo(0, 0);
}

/* 어순 고르기 상세 힌트 — 어순 규칙은 늘 보이고, 문장 뼈대·단어 뜻은 접었다 편다 */
function hintBlockHtml(it, open) {
  const h = it.hint;
  if (!h) return '';
  return `<div class="qhint">
      <div class="qhintrow">
        ${h.rule ? `<span class="ohint">어순 힌트 <b>${esc(h.rule)}</b></span>` : ''}
        <button type="button" class="qhintbtn" data-hint="1" aria-expanded="${open ? 'true' : 'false'}">${open ? '💡 상세 힌트 접기' : '💡 상세 힌트 보기'}</button>
      </div>
      <div class="qhintbox"${open ? '' : ' hidden'}>
        ${h.skeleton ? `<div class="hrow"><span class="hk">문장 뼈대</span><span class="hv">${esc(h.skeleton)}</span></div>` : ''}
        ${h.words ? `<div class="hrow"><span class="hk">단어 뜻</span><span class="hv">${esc(h.words)}</span></div>` : ''}
        ${h.tip ? `<div class="hrow"><span class="hk">어순 규칙</span><span class="hv">${esc(h.tip)}</span></div>` : ''}
        <div class="hnote">뼈대는 역할 순서, 단어 뜻은 가나다순이에요. 어느 단어가 어느 역할인지 스스로 맞춰 보세요.</div>
      </div>
    </div>`;
}

function renderQuiz() {
  const q = state.quiz;
  if (!q) return go(state.tab);
  if (q.idx >= q.items.length) return renderResult();
  const it = q.items[q.idx];
  if (it.kind === 'card') return renderCard();
  if (it.kind === 'order') return renderOrder();
  const pct = Math.round((q.idx / q.items.length) * 100);

  let opts = '';
  if (it.kind === 'mc') {
    opts = `<div class="opts">${it.opts.map((o, i) => {
      let cls = 'opt';
      if (q.revealed) {
        if (i === it.correct) cls += ' correct';
        else if (i === q.picked) cls += ' wrong';
      }
      return `<button class="${cls}" data-opt="${i}">
        <span class="k">${'ABCD'[i]}</span>
        <span class="v">${o.html}${o.note ? `<em>${o.note}</em>` : ''}</span>
        ${o.say && o.say.t ? spkSpan('o:' + i) : ''}
      </button>`;
    }).join('')}</div>`;
  }

  let body = '';
  if (q.revealed) {
    const a = it.kind === 'mc' ? it.opts[it.correct].html : it.answer;
    body = `<div class="answerbox">
        <div class="lbl">정답${it.sayAnswer && it.sayAnswer.t ? spkBtn('a') : ''}</div>
        <div class="body">${a}</div>
        ${it.why ? `<div class="why">${it.why}</div>` : ''}
      </div>`;
    if (it.extra) body += `<div class="note-line">${it.extra}${it.sayExtra && it.sayExtra.t ? spkBtn('x') : ''}</div>`;
    if (it.kind === 'self') {
      body += `<div class="qfoot">
        <button class="btn green" data-self="1">맞았어요</button>
        <button class="btn red" data-self="0">틀렸어요</button></div>`;
    } else {
      body += `<div class="qfoot"><button class="btn" data-next="1">다음 문제</button></div>`;
    }
  } else if (it.kind === 'self') {
    body = `<div class="qfoot"><button class="btn" data-reveal="1">정답 · 해설 보기</button></div>`;
  }

  app.innerHTML = `<div class="screen">
    <div class="qhead">
      <span class="badge">${esc(q.title)}</span>
      <span class="pct mono">${q.idx + 1} / ${q.items.length} · 정답 ${q.answers.filter(Boolean).length}</span>
    </div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    ${rateBarHtml()}
    <div class="card">
      <div class="qtext">${it.prompt}${it.sayPrompt && it.sayPrompt.t ? spkBtn('p') : ''}</div>
      ${it.sub ? `<div class="qsub">${it.sub}</div>` : ''}
      ${it.hint ? hintBlockHtml(it, q.hintOpen) : ''}
      ${opts}
      ${body}
    </div>
    <div class="row"><button class="btn plain sm" data-quit="1">그만두기</button></div>
  </div>`;

  $$('[data-opt]', app).forEach(b => b.onclick = () => pickOption(Number(b.dataset.opt)));
  const hb = $('[data-hint]', app);
  if (hb) hb.onclick = () => {
    q.hintOpen = !q.hintOpen;
    const box = $('.qhintbox', app);
    if (box) {
      box.hidden = !q.hintOpen;
      hb.textContent = q.hintOpen ? '💡 상세 힌트 접기' : '💡 상세 힌트 보기';
      hb.setAttribute('aria-expanded', q.hintOpen ? 'true' : 'false');
    } else {
      renderQuiz();
    }
  };
  bindSpeak(k => k === 'p' ? it.sayPrompt : k === 'a' ? it.sayAnswer : k === 'x' ? it.sayExtra
    : (it.opts && it.opts[Number(k.slice(2))] ? it.opts[Number(k.slice(2))].say : null));
  bindRate(() => { const d = (it.sayPrompt && it.sayPrompt.t) ? it.sayPrompt : (it.opts || []).map(o => o.say).find(x => x && x.t); if (d) TTS.say(d.t, d.c, null, d.n); });
  const rv = $('[data-reveal]', app); if (rv) rv.onclick = () => { q.revealed = true; renderQuiz(); };
  const nx = $('[data-next]', app); if (nx) nx.onclick = nextQuestion;
  $$('[data-self]', app).forEach(b => b.onclick = () => selfGrade(b.dataset.self === '1'));
  const qt = $('[data-quit]', app); if (qt) qt.onclick = () => { if (confirm('그만둘까요? 지금까지의 결과는 저장되지 않아요.')) { state.quiz = null; go(state.tab); } };
}

function pickOption(i) {
  const q = state.quiz, it = q.items[q.idx];
  if (q.revealed) return;
  TTS.stop();
  q.picked = i;
  q.revealed = true;
  const ok = i === it.correct;
  q.answers.push(ok);
  if (ok) {
    if (it.key) wrongRemove(q.mode, it.key);
  } else {
    wrongAdd(q.mode, payloadOf(it));
  }
  renderQuiz();
}

function selfGrade(ok) {
  const q = state.quiz, it = q.items[q.idx];
  q.answers.push(ok);
  if (!ok) wrongAdd(q.mode, payloadOf(it));
  else if (it.key) wrongRemove(q.mode, it.key);
  nextQuestion();
}

function nextQuestion() {
  const q = state.quiz;
  TTS.stop();
  q.idx += 1; q.revealed = false; q.picked = -1; q.hintOpen = false;
  renderQuiz();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* 오답 노트에 그대로 다시 넣을 수 있는 형태로 저장 */
function payloadOf(it) {
  if (it.kind === 'card') {
    return { key: it.key, kind: 'card', title: it.title || '', prompt: it.front.html,
      answer: it.back.html, opts: [], correct: -1, why: '', extra: '', sub: '',
      sayF: (it.front && it.front.say) || null, sayB: (it.back && it.back.say) || null };
  }
  if (it.kind === 'order') {
    return { key: it.key, kind: 'order', title: it.title || '', prompt: it.prompt, sub: it.sub || '',
      answer: it.answer, tiles: it.tiles || [], roles: it.roles || [], meanings: it.meanings || [],
      orderHint: it.orderHint || '',
      pron: it.pron || '', opts: [], correct: -1,
      why: it.why || '', extra: '', sayA: it.say || null };
  }
  return {
    key: it.key || (it.prompt + '|' + (it.answer || '')).slice(0, 120),
    kind: it.kind, prompt: it.prompt, sub: it.sub || '', opts: it.opts || [],
    hint: it.hint || null,
    correct: it.correct == null ? -1 : it.correct, answer: it.answer || '',
    why: it.why || '', extra: it.extra || '', title: it.title || '',
    sayP: it.sayPrompt || null, sayA: it.sayAnswer || null, sayX: it.sayExtra || null
  };
}
function itemFromPayload(p) {
  if (p.kind === 'card') {
    return { kind: 'card', title: p.title, key: p.key,
      front: { html: p.prompt, note: '', say: p.sayF || null }, back: { html: p.answer, say: p.sayB || null } };
  }
  if (p.kind === 'order') {
    return { kind: 'order', title: p.title, key: p.key, prompt: p.prompt, sub: p.sub,
      answer: p.answer, tiles: p.tiles || [], roles: p.roles || [], meanings: p.meanings || [],
      orderHint: p.orderHint || '',
      pron: p.pron || '', why: p.why || '', say: p.sayA || null };
  }
  return { kind: p.kind === 'self' ? 'self' : 'mc', prompt: p.prompt, sub: p.sub, opts: p.opts,
    hint: p.hint || null,
    correct: p.correct, answer: p.answer, why: p.why, extra: p.extra, key: p.key, title: p.title,
    sayPrompt: p.sayP || null, sayAnswer: p.sayA || null, sayExtra: p.sayX || null };
}

function renderResult() {
  const q = state.quiz;
  const n = q.answers.length;
  const ok = q.answers.filter(Boolean).length;
  const pct = n ? Math.round((ok / n) * 100) : 0;
  addStats(n, ok);
  let msg = '조금만 더!';
  if (pct >= 90) msg = '완벽에 가까워요 🎉';
  else if (pct >= 70) msg = '좋아요, 이 흐름으로 👏';
  else if (pct >= 50) msg = '절반 넘었어요';
  const promptOf = it => it.prompt || (it.front ? it.front.html : '');
  const answerOf = it => it.kind === 'card' ? (it.back ? it.back.html : '')
    : it.kind === 'mc' ? (it.opts && it.opts[it.correct] ? it.opts[it.correct].html : '')
      : (it.answer || '');
  const review = q.items.slice(0, n).map((it, i) => {
    const good = q.answers[i];
    const ans = answerOf(it);
    return `<details class="${good ? 'ok' : 'no'}">
      <summary><span class="mark">${good ? '✓' : '✕'}</span><span>${promptOf(it)}</span></summary>
      <div class="d"><b>정답</b> ${ans}${it.why ? `<br>${it.why}` : ''}</div>
    </details>`;
  }).join('');
  const wrongCount = q.answers.filter(x => !x).length;
  app.innerHTML = `<div class="screen">
    <div class="card">
      <div class="scorecircle">
        <div class="num">${pct}<small>%</small></div>
        <div><div class="txt"><b>${ok} / ${n}</b> 문제를 맞혔어요</div><div class="txt">${msg}</div></div>
      </div>
    </div>
    <div class="card">
      <h2>문제 다시 보기</h2>
      <p class="desc">틀린 문제는 아래 ‘오답 다시 풀기’로 모아서 풀 수 있어요.</p>
      <div class="review">${review}</div>
    </div>
    <div class="row" style="margin-bottom:8px">
      ${wrongCount ? `<button class="btn grow" data-retry-wrong="1">틀린 문제만 다시 풀기 (${wrongCount})</button>` : ''}
      <button class="btn secondary grow" data-again="1">같은 설정으로 다시</button>
    </div>
    <button class="btn plain" data-home="1">설정 화면으로</button>
  </div>`;
  const again = $('[data-again]', app);
  if (again) again.onclick = () => rebuildQuiz(q);
  const home = $('[data-home]', app);
  if (home) home.onclick = () => { state.quiz = null; go(state.tab); };
  const rw = $('[data-retry-wrong]', app);
  if (rw) rw.onclick = () => {
    const items = q.items.filter((it, i) => q.answers[i] === false).map(it => itemFromPayload(payloadOf(it), q.mode));
    if (items.length) startQuiz({ title: '오답 다시 풀기', mode: q.mode, items: shuffle(items) });
  };
}

let lastBuilder = null;
function rebuildQuiz(q) { if (lastBuilder) lastBuilder(); else go(state.tab); }

/* ---------------------------------------------------------------- 플래시카드 */
function renderCard() {
  const q = state.quiz;
  const it = q.items[q.idx];
  const pct = Math.round((q.idx / q.items.length) * 100);
  const front = it.front, back = it.back;
  const reveal = q.cardShown;
  const sideSay = reveal ? back.say : front.say;
  app.innerHTML = `<div class="screen">
    <div class="qhead">
      <span class="badge">${esc(q.title)}</span>
      <span class="pct mono">${q.idx + 1} / ${q.items.length}</span>
    </div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    ${rateBarHtml()}
    <div class="flash">
      <div class="flashcard ${reveal ? 'flipped' : ''}" data-flip="1">
        <div>
          <div class="front-label">${reveal ? '뒤' : '앞'}</div>
          <div class="bigtext">${reveal ? back.html : front.html}</div>
          ${reveal ? '' : front.note || ''}
          ${sideSay && sideSay.t ? `<div class="cardsay">${spkSpan('c')}</div>` : ''}
          <div class="hint">${reveal ? '카드를 눌러 앞면으로' : '카드를 눌러 뜻·발음 보기'}</div>
        </div>
      </div>
    </div>
    <div class="qfoot">
      <button class="btn red" data-card="0">몰랐어요</button>
      <button class="btn green" data-card="1">알았어요</button>
    </div>
    <div class="row" style="margin-top:8px"><button class="btn plain sm" data-quit="1">그만두기</button></div>
  </div>`;
  const fc = $('[data-flip]', app);
  fc.onclick = () => { q.cardShown = !q.cardShown; renderCard(); };
  bindSpeak(k => k === 'c' ? (q.cardShown ? back.say : front.say) : null);
  bindRate(() => { const d = q.cardShown ? back.say : front.say; if (d && d.t) TTS.say(d.t, d.c, null, d.n); });
  $$('[data-card]', app).forEach(b => b.onclick = () => {
    const ok = b.dataset.card === '1';
    q.answers.push(ok);
    if (!ok) wrongAdd(q.mode, payloadOf(it));
    else if (it.key) wrongRemove(q.mode, it.key);
    q.idx += 1; q.cardShown = false;
    renderQuiz();
  });
  const qt = $('[data-quit]', app);
  qt.onclick = () => { if (confirm('그만둘까요?')) { state.quiz = null; go(state.tab); } };
}

/* ---------------------------------------------------------------- 어순 배열 */
function renderOrder() {
  const q = state.quiz, it = q.items[q.idx];
  if (!q.ord || q.ord.i !== q.idx) q.ord = { i: q.idx, picked: [], done: false, ok: false };
  const o = q.ord;
  const pct = Math.round((q.idx / q.items.length) * 100);
  const norm = t => String(t || '').replace(/\s+/g, ' ').trim();
  const built = o.picked.map(i => it.tiles[i]).join(' ');
  const ok = norm(built) === norm(it.answer);
  const roleOf = i => (it.roles && it.roles[i]) || '';
  const meanOf = i => (it.meanings && it.meanings[i]) || '';
  const pickedHtml = o.picked.length
    ? o.picked.map((ti, pos) => tileHtml(it.tiles[ti], roleOf(ti), 'tile on', `data-unpick="${pos}"`, meanOf(ti))).join('')
    : `<span class="tile-ghost">단어를 차례로 눌러 보세요</span>`;
  const pool = it.tiles.map((t, i) => ({ t, i })).filter(x => !o.picked.includes(x.i));

  app.innerHTML = `<div class="screen">
    <div class="qhead">
      <span class="badge">${esc(q.title)}</span>
      <span class="pct mono">${q.idx + 1} / ${q.items.length} · 정답 ${q.answers.filter(Boolean).length}</span>
    </div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    ${rateBarHtml()}
    <div class="orderbar">
      ${it.orderHint ? `<span class="ohint">어순 힌트 <b>${esc(it.orderHint)}</b></span>` : ''}
      <button type="button" class="sndbtn ${SET.tileSound ? 'on' : ''}" data-tile-sound="1" aria-pressed="${SET.tileSound ? 'true' : 'false'}">${SET.tileSound ? '🔊 단어 소리 켜짐' : '🔇 단어 소리 꺼짐'}</button>
    </div>
    <div class="card">
      ${it.prompt}
      ${it.sub ? `<div class="qsub">${it.sub}</div>` : ''}
      <div class="orderbuilt ${o.done ? (o.ok ? 'ok' : 'no') : ''}">${pickedHtml}</div>
      <div class="tiles">${pool.map(x => tileHtml(x.t, roleOf(x.i), 'tile', `data-tile="${x.i}"`, meanOf(x.i))).join('')}</div>
      ${o.done ? `
        <div class="answerbox">
          <div class="lbl">${o.ok ? '정답이에요 ✓' : '정답'}${it.say && it.say.t ? spkBtn('a') : ''}</div>
          <div class="body"><b>${esc(it.answer)}</b>${it.pron ? `<span class="pron">${esc(it.pron)}</span>` : ''}</div>
          ${it.why ? `<div class="why">${it.why}</div>` : ''}
        </div>
        <div class="qfoot"><button class="btn" data-next="1">다음 문제</button></div>
      ` : `
        <div class="qfoot">
          <button class="btn" data-check="1" ${o.picked.length === it.tiles.length ? '' : 'disabled'}>확인</button>
          <button class="btn plain" data-reset="1">다시</button>
        </div>
      `}
    </div>
    <div class="row"><button class="btn plain sm" data-quit="1">그만두기</button></div>
  </div>`;

  $$('[data-tile]', app).forEach(b => b.onclick = () => {
    if (o.done) return;
    const ti = Number(b.dataset.tile);
    o.picked.push(ti);
    if (SET.tileSound && it.say) TTS.say(it.tiles[ti], it.say.c, null, it.say.n);
    else TTS.stop();
    renderOrder();
  });
  const snd = $('[data-tile-sound]', app);
  if (snd) snd.onclick = () => {
    SET.tileSound = !SET.tileSound;
    saveSet();
    if (!SET.tileSound) TTS.stop();
    renderOrder();
  };
  $$('[data-unpick]', app).forEach(b => b.onclick = () => {
    if (o.done) return;
    o.picked.splice(Number(b.dataset.unpick), 1);
    renderOrder();
  });
  const ck = $('[data-check]', app);
  if (ck) ck.onclick = () => {
    o.done = true; o.ok = ok;
    q.answers.push(ok);
    if (ok) { if (it.key) wrongRemove(q.mode, it.key); }
    else wrongAdd(q.mode, payloadOf(it));
    renderOrder();
  };
  const rs = $('[data-reset]', app);
  if (rs) rs.onclick = () => { o.picked = []; renderOrder(); };
  const nx = $('[data-next]', app);
  if (nx) nx.onclick = nextQuestion;
  const qt = $('[data-quit]', app);
  if (qt) qt.onclick = () => { if (confirm('그만둘까요? 지금까지의 결과는 저장되지 않아요.')) { state.quiz = null; go(state.tab); } };
  bindSpeak(k => k === 'a' ? it.say : null);
  bindRate(() => { if (it.say && it.say.t) TTS.say(it.say.t, it.say.c, null, it.say.n); });
}

/* ================================================================== 오답 노트 */
function renderWrongNote() {
  const modes = Object.keys(MODE_NAME).filter(m => wrongList(m).length);
  if (!modes.length) {
    app.innerHTML = `<div class="screen"><div class="card"><h2>오답 노트가 비어 있어요</h2>
      <p class="desc">테스트에서 틀린 문제가 이곳에 모입니다. 같은 문제를 다시 맞히면 자동으로 지워져요.</p>
      <button class="btn plain" data-home="1">돌아가기</button></div></div>`;
    $('[data-home]', app).onclick = () => go(state.tab);
    window.scrollTo(0, 0);
    return;
  }
  const blocks = modes.map(m => {
    const list = wrongList(m);
    return `<div class="card">
      <h2>${MODE_NAME[m]} <span style="color:var(--ink3);font-weight:600">${list.length}</span></h2>
      <div class="row" style="margin:8px 0 12px">
        <button class="btn sm" data-solve="${m}">이 ${list.length}문제 다시 풀기</button>
        <button class="btn sm plain" data-clear="${m}">비우기</button>
      </div>
      <div class="review">${list.map(p => `<details>
        <summary><span class="mark" style="background:var(--red)">!</span><span>${p.prompt}</span></summary>
        <div class="d"><b>정답</b> ${p.kind === 'mc' && p.opts && p.opts[p.correct] ? p.opts[p.correct].html : p.answer}${p.why ? `<br>${p.why}` : ''}</div>
      </details>`).join('')}</div>
    </div>`;
  }).join('');
  app.innerHTML = `<div class="screen"><h1 style="font-size:20px;margin:4px 2px 12px">오답 노트</h1>${blocks}
    <button class="btn plain" data-home="1">돌아가기</button></div>`;
  $('[data-home]', app).onclick = () => go(state.tab);
  $$('[data-solve]', app).forEach(b => b.onclick = () => {
    const m = b.dataset.solve;
    const items = wrongList(m).map(p => itemFromPayload(p, m));
    startQuiz({ title: '오답 다시 풀기', mode: m, items: shuffle(items) });
  });
  $$('[data-clear]', app).forEach(b => b.onclick = () => {
    if (confirm('이 목록을 비울까요?')) { store.set(WRONG_KEY(b.dataset.clear), []); refreshWrongBadge(); renderWrongNote(); }
  });
  window.scrollTo(0, 0);
}

/* ================================================================== 1. 문법 */
const GAME_NAME = { order: '문장 순서', cloze: '빈칸 채우기', pick: '어순 고르기', verb: '동사 변화' };

/* ---- 공부하기: 가이드 본문 블록 ---- */
function studyBlockHtml(b) {
  if (b.t === 'h') return `<h${b.l} class="sh sh${b.l}">${rich(b.x)}</h${b.l}>`;
  if (b.t === 'p') return `<p class="sp${b.cls === 'intro' ? ' intro' : ''}">${rich(b.x)}</p>`;
  if (b.t === 'l') return `<ul class="sl">${b.x.map(x => `<li>${rich(x)}</li>`).join('')}</ul>`;
  if (b.t === 'n') return `<div class="sbox ${esc(b.k)}">${rich(b.x)}</div>`;
  if (b.t === 'tb') {
    const head = (b.h && b.h.length) ? `<thead><tr>${b.h.map(h => `<th>${rich(h)}</th>`).join('')}</tr></thead>` : '';
    const rows = (b.r || []).map(r => `<tr>${r.map(c => `<td>${rich(c)}</td>`).join('')}</tr>`).join('');
    return `<div class="tblwrap"><table class="stbl">${head}<tbody>${rows}</tbody></table></div>`;
  }
  return '';
}
function bindSayList(says) {
  $$('[data-say]', app).forEach(el => {
    const m = /^s(\d+)$/.exec(el.dataset.say || '');
    if (!m) return;
    const d = says[Number(m[1])];
    if (!d) return;
    el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); TTS.say(d.t, d.c, el, d.n); });
  });
}

/* ---- 공부하기: 가이드 안 검색 ---- */
const BLOCK_NAME = { h: '제목', p: '설명', l: '목록', tb: '표', ex: '예문', n: '참고' };
function studyBlockText(b) {
  if (b.t === 'h' || b.t === 'p' || b.t === 'n') return plainText(b.x);
  if (b.t === 'l') return (b.x || []).map(plainText).join(' · ');
  if (b.t === 'tb') return [].concat(b.h || [], ...(b.r || []).map(r => r)).map(plainText).join(' · ');
  if (b.t === 'ex') return [b.x, b.p, b.k, b.n].filter(Boolean).map(plainText).join(' · ');
  return '';
}
function studySearch(parts, ql) {
  const hits = [];
  parts.forEach((p, pi) => {
    const head = [p.part, p.title, p.sub].filter(Boolean).join(' ');
    const at = head.toLowerCase().indexOf(ql);
    if (at >= 0) hits.push({ pi, part: p.part, title: p.title, kind: 'part', text: head, at });
    p.blocks.forEach(b => {
      const t = studyBlockText(b);
      const k = t.toLowerCase().indexOf(ql);
      if (k < 0) return;
      hits.push({ pi, part: p.part, title: p.title, kind: b.t, text: t, at: k });
    });
  });
  return hits;
}
function snippetAt(text, at, ql) {
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + ql.length + 90);
  return (start > 0 ? '… ' : '') + text.slice(start, end).trim() + (end < text.length ? ' …' : '');
}
function markQuery(text, ql) {
  const low = String(text).toLowerCase();
  let i = low.indexOf(ql), cur = 0, out = '';
  if (i < 0) return esc(text);
  while (i >= 0) {
    out += esc(text.slice(cur, i)) + '<mark>' + esc(text.slice(i, i + ql.length)) + '</mark>';
    cur = i + ql.length;
    i = low.indexOf(ql, cur);
  }
  return out + esc(text.slice(cur));
}

async function renderStudyView(sIdx, s) {
  const guides = sIdx.guides;
  const guide = guides.find(g => g.key === s.guide) || guides[0];
  s.guide = guide.key;
  const data = await DATA.study(guide.key);
  const code = LANG_CODE[guide.lang] || 'es-ES';
  const name = guide.label || CODE_KO[code] || guide.key;
  const parts = data.parts;
  if (s.part == null || s.part < 0 || s.part >= parts.length) s.part = 0;
  const p = parts[s.part];
  const says = [];
  const toc = [];
  const body = p.blocks.map((b, bi) => {
    if (b.t === 'h' && b.l === 2) toc.push({ id: 'sec' + bi, x: plainText(b.x) });
    if (b.t !== 'ex') {
      const h = studyBlockHtml(b);
      return (b.t === 'h' && b.l === 2) ? h.replace(/^<h2/, '<h2 id="sec' + bi + '"') : h;
    }
    const n = says.length;
    says.push({ t: plainText(b.x), c: code, n });
    return `<div class="sex">
      <div class="sex-t">${rich(b.x)}${spkBtn('s' + n)}</div>
      ${b.p ? `<div class="sex-p">${esc(b.p)}</div>` : ''}
      ${b.k ? `<div class="sex-k">${esc(b.k)}</div>` : ''}
      ${b.n ? `<div class="sex-n">${esc(b.n)}</div>` : ''}
    </div>`;
  }).join('');

  app.innerHTML = `<div class="screen">
    <div class="segbar">
      <button class="seg on" data-view="study">📖 공부하기</button>
      <button class="seg" data-view="quiz">🧩 문제 풀기</button>
    </div>
    <div class="card">
      <div class="field">
        <label>문법 가이드</label>
        <select id="stGuide">${guides.map(g => `<option value="${g.key}" ${g.key === guide.key ? 'selected' : ''}>${esc(g.label || CODE_KO[LANG_CODE[g.lang]] || g.key)} — ${g.parts}파트 · 예문 ${g.examples}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>공부 내용 검색</label>
        <div class="findrow">
          <input id="stFind" type="search" class="find" autocomplete="off" enterkeyhint="search"
            placeholder="이 가이드에서 찾기 — 파트·설명·표·예문" value="${esc(s.q || '')}">
          <button type="button" id="stFindClear" class="btn plain sm" aria-label="검색어 지우기" title="검색어 지우기">✕</button>
        </div>
        <div id="stCount" class="findcount"></div>
      </div>
      <div id="stNav">
        <div class="field">
          <label>파트</label>
          <select id="stPart">${parts.map((x, i) => `<option value="${i}" ${i === s.part ? 'selected' : ''}>${esc(x.part)} ${esc(x.title)}</option>`).join('')}</select>
        </div>
        ${toc.length > 2 ? `<div class="field">
          <label>이 파트 목차</label>
          <select id="stJump"><option value="">— 이동할 곳 —</option>${toc.map(t => `<option value="${t.id}">${esc(t.x)}</option>`).join('')}</select>
        </div>` : ''}
        <div class="row">
          <button class="btn plain sm" data-prev="1" ${s.part === 0 ? 'disabled' : ''}>← 이전</button>
          <button class="btn plain sm" data-next="1" ${s.part >= parts.length - 1 ? 'disabled' : ''}>다음 →</button>
          <button class="btn sm secondary" data-topractice="1">이 언어로 문제 풀기</button>
        </div>
      </div>
      <div id="stVoice" class="voiceline"></div>
    </div>
    <div class="card study" id="stBody">
      <div class="study-head">
        <div class="study-num">${esc(p.part)}</div>
        <h2>${esc(p.title)}</h2>
        ${p.sub ? `<p class="desc">${esc(p.sub)}</p>` : ''}
      </div>
      ${body}
      <div class="row" style="margin-top:14px">
        <button class="btn plain sm" data-prev="1" ${s.part === 0 ? 'disabled' : ''}>← 이전 파트</button>
        <button class="btn plain sm" data-next="1" ${s.part >= parts.length - 1 ? 'disabled' : ''}>다음 파트 →</button>
      </div>
    </div>
    <div id="stHits" hidden></div>
  </div>`;

  fillVoiceLine($('#stVoice'), code, name);
  const jump = $('#stJump');
  if (jump) jump.onchange = e => {
    const el = document.getElementById(e.target.value);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' });
    e.target.value = '';
  };
  $('#stGuide').onchange = e => { s.guide = e.target.value; s.part = 0; renderGrammarSetup(); };
  $('#stPart').onchange = e => { s.part = Number(e.target.value); renderGrammarSetup(); };
  $$('[data-prev]', app).forEach(b => b.onclick = () => { if (s.part > 0) { s.part -= 1; renderGrammarSetup(); } });
  $$('[data-next]', app).forEach(b => b.onclick = () => { if (s.part < parts.length - 1) { s.part += 1; renderGrammarSetup(); } });
  $$('[data-view]', app).forEach(b => b.onclick = () => { s.view = b.dataset.view; renderGrammarSetup(); });
  const tp = $('[data-topractice]', app);
  if (tp) tp.onclick = () => { s.view = 'quiz'; s.glang = guide.lang; renderGrammarSetup(); };

  /* ---- 검색 ---- */
  const find = $('#stFind'), hitsBox = $('#stHits'), countBox = $('#stCount');
  const navBox = $('#stNav'), bodyBox = $('#stBody'), clearBtn = $('#stFindClear');
  const runFind = () => {
    const q = find.value.trim();
    s.q = q;
    clearBtn.hidden = !q;
    if (!q) {
      hitsBox.hidden = true; hitsBox.innerHTML = '';
      bodyBox.hidden = false; navBox.hidden = false;
      countBox.textContent = ''; countBox.classList.remove('on');
      return;
    }
    const ql = q.toLowerCase();
    const hits = studySearch(parts, ql);
    const nPart = new Set(hits.map(h => h.pi)).size;
    bodyBox.hidden = true; navBox.hidden = true; hitsBox.hidden = false;
    countBox.classList.add('on');
    countBox.innerHTML = hits.length
      ? `🔍 <b>${esc(q)}</b> · ${hits.length}개 항목 · ${nPart}개 파트`
      : `🔍 <b>${esc(q)}</b> · 맞는 내용이 없어요`;
    const MAX = 200;
    hitsBox.innerHTML = `<div class="card study">
      <div class="study-head">
        <div class="study-num">🔍 검색</div>
        <h2>${esc(q)}</h2>
        <p class="desc">${hits.length ? `${esc(name)} 가이드에서 ${hits.length}개 항목을 찾았습니다. 항목을 누르면 그 파트로 이동합니다.` : '맞는 내용이 없어요. 다른 낱말로 찾아보세요 — 예: 복수, 발음, 시제, 카페.'}</p>
      </div>
      ${hits.length ? hits.slice(0, MAX).map(h => `<button type="button" class="hit" data-hit="${h.pi}">
        <span class="hit-kind">${h.kind === 'part' ? '파트 제목' : (BLOCK_NAME[h.kind] || '본문')}</span>
        <span class="hit-part">${esc(h.part)} ${esc(h.title)}</span>
        <span class="hit-text">${markQuery(snippetAt(h.text, h.at, ql), ql)}</span>
      </button>`).join('') : ''}
      ${hits.length > MAX ? `<p class="desc">앞의 ${MAX}개만 보여 줍니다. 검색어를 더 넣어 좁혀 보세요.</p>` : ''}
    </div>`;
    $$('[data-hit]', hitsBox).forEach(b => b.onclick = () => {
      s.part = Number(b.dataset.hit); s.q = ''; renderGrammarSetup();
    });
  };
  find.oninput = runFind;
  find.onkeydown = e => { if (e.key === 'Escape') { find.value = ''; runFind(); } };
  clearBtn.onclick = () => { find.value = ''; runFind(); find.focus(); };
  if (s.q) runFind();

  bindSayList(says);
  window.scrollTo(0, 0);
}

/* ---- 동사 변화: 1~3권 전체를 한 번에 검색 ---- */
const VSEARCH = {};
/* 대소문자·발음 기호(악센트)·따움표 차이를 눌러 준다 — 'ire' 로도 'iré' 를 찾게 */
function foldText(s) {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019\u2018`]/g, "'").replace(/\s+/g, ' ').trim();
}
function verbSearchRows(langNo) {
  if (!VSEARCH[langNo]) {
    VSEARCH[langNo] = (async () => {
      const meta = await DATA.verbMeta();
      const out = [];
      for (const v of meta.vols) {
        const [items, nat] = await Promise.all([DATA.verbItems(v.vol), DATA.verbLang(v.vol, langNo)]);
        items.forEach((r, i) => {
          const n = nat[i] || [];
          out.push({ vol: v.vol, verbEn: r[1], verbKo: r[2], tense: r[3], person: r[4], en: r[5], ko: r[6], native: n[0] || '', pron: n[1] || '' });
        });
      }
      return out;
    })().catch(e => { delete VSEARCH[langNo]; throw e; });
  }
  return VSEARCH[langNo];
}
/* 한 행이 검색어(공백으로 나눈 모든 낱말)를 모두 품고 있는지 — 원형·한국어 뜻·활용형·발음·문장
   라틴 문자는 낱말 단위로 맞춘다('go' 가 'got' 에 걸리지 않게). 한글·한자·키릴은 그대로 포함 검색. */
const LATIN_SEP = /[^a-z\u00c0-\u024f\u00f8\u0111\u0142']+/;
const LATIN_ANY = /[a-z\u00c0-\u024f\u00f8\u0111\u0142]/;
function wordHit(hay, w) {
  if (!LATIN_ANY.test(w)) return hay.indexOf(w) >= 0;
  return hay.split(LATIN_SEP).indexOf(w) >= 0;
}
function verbMatches(r, words, loose) {
  const hay = foldText([r.verbEn, r.verbKo, r.native, r.pron, r.en, r.ko, r.tense, r.person].join(' · '));
  return words.every(w => loose ? hay.indexOf(w) >= 0 : wordHit(hay, w));
}
/* 같은 권·같은 동사의 활용을 한 카드로 묶는다 */
function verbGroupHits(hits) {
  const groups = [], at = new Map();
  hits.forEach(r => {
    const k = r.vol + '|' + r.verbEn;
    let g = at.get(k);
    if (!g) { g = { vol: r.vol, verbEn: r.verbEn, verbKo: r.verbKo, rows: [] }; at.set(k, g); groups.push(g); }
    g.rows.push(r);
  });
  return groups;
}

async function renderGrammarSetup() {
  loading();
  let sIdx, gIdx, vmeta;
  try { [sIdx, gIdx, vmeta] = await Promise.all([DATA.studyIndex(), DATA.gamesIndex(), DATA.verbMeta()]); }
  catch (e) {
    app.innerHTML = `<div class="card"><h2>데이터를 불러오지 못했어요</h2><p class="desc">${esc(e.message)}</p><button class="btn" onclick="location.reload()">다시 시도</button></div>`;
    return;
  }
  const s = state.setup.grammar || (state.setup.grammar = {});
  if (!s.view) s.view = 'study';
  if (!s.guide) s.guide = 'es';
  if (s.part == null) s.part = 0;
  if (!s.game) s.game = 'order';
  if (!s.glang) s.glang = 6;
  if (!s.gn) s.gn = 10;
  if (!s.vol) s.vol = 1;
  if (!s.lang) s.lang = 4;
  if (s.tense == null) s.tense = -1;
  if (!s.vn) s.vn = 10;

  if (s.view === 'study') return renderStudyView(sIdx, s);

  /* ---- 문제 풀기 ---- */
  const vocabMeta = await DATA.vocabMeta();
  const langName = no => (vocabMeta.langs.find(l => l.no === no) || {}).ko || String(no);
  const g = gIdx.langs || [];
  const has = (no, kind) => {
    const row = g.find(x => x.no === no);
    return row ? row[kind] : 0;
  };
  const listFor = kind => vocabMeta.langs.filter(l => l.no !== 1 && has(l.no, kind) > 0);
  const isVerb = s.game === 'verb';
  const avail = isVerb ? [] : listFor(s.game);
  if (!isVerb && !avail.some(l => l.no === s.glang)) s.glang = avail.length ? avail[0].no : 6;
  const verbTotal = vmeta.vols.reduce((a, b) => a + b.count, 0);

  app.innerHTML = `<div class="screen">
    <div class="segbar">
      <button class="seg" data-view="study">📖 공부하기</button>
      <button class="seg on" data-view="quiz">🧩 문제 풀기</button>
    </div>
    <div class="card">
      <h2>문법 문제</h2>
      <p class="desc">직접 눌러서 푸는 문제만 모았습니다. 답을 고르면 바로 채점되고 해설이 나옵니다.</p>
      <div class="chips" id="gGame">
        ${['order', 'cloze', 'pick', 'verb'].map(k => `<button class="chip ${s.game === k ? 'on' : ''}" data-game="${k}">${k === 'order' ? '🧩' : k === 'cloze' ? '✏️' : k === 'pick' ? '✅' : '🔁'} ${GAME_NAME[k]}</button>`).join('')}
      </div>

      ${isVerb ? `
      <div class="row" style="margin-top:14px">
        <div class="field grow" style="min-width:130px">
          <label>권</label>
          <select id="vVol">${vmeta.vols.map(v => `<option value="${v.vol}" ${v.vol === s.vol ? 'selected' : ''}>${v.vol}권 · ${esc(vmeta.titles[String(v.vol)] || '')}</option>`).join('')}</select>
        </div>
        <div class="field grow" style="min-width:130px">
          <label>언어</label>
          <select id="vLang">${vmeta.langs.filter(l => l.no !== 1).map(l => `<option value="${l.no}" ${l.no === s.lang ? 'selected' : ''}>${esc(l.ko)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field">
        <label>동사 검색 · 1~3권 전체</label>
        <div class="findrow">
          <input id="vFind" type="search" class="find" autocomplete="off" enterkeyhint="search"
            placeholder="to go, 가다, 갔다, ich bin, 이히 빈" value="${esc(s.vq || '')}">
          <button type="button" id="vFindClear" class="btn plain sm" aria-label="검색어 지우기" title="검색어 지우기" ${s.vq ? '' : 'hidden'}>✕</button>
        </div>
        <div id="vCount" class="findcount"></div>
      </div>
      <div id="vHits"></div>
      <div id="vQuizSetup">
      <div class="field">
        <label>시제</label>
        <div class="chips" id="vTense">
          <button class="chip ${s.tense === -1 ? 'on' : ''}" data-t="-1">전체</button>
          ${vmeta.tenses.map((t, i) => `<button class="chip ${s.tense === i ? 'on' : ''}" data-t="${i}">${t}</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <label>문제 수</label>
        <div class="chips" id="vN">${[10, 20, 30].map(n => `<button class="chip ${s.vn === n ? 'on' : ''}" data-n="${n}">${n}문제</button>`).join('')}</div>
      </div>
      <button class="btn" id="vStart">동사 변화 풀기 <span class="n">${verbTotal}항목</span></button>
      <p class="subnote">같은 동사·같은 시제에서 인칭만 바꾼 진짜 활용형이 보기로 나옵니다. 원하는 동사는 위 검색창에서 바로 찾아 들을 수 있어요.</p>
      </div>
      ` : `
      <div class="field" style="margin-top:14px">
        <label>언어</label>
        <select id="gLang2">${avail.map(l => `<option value="${l.no}" ${l.no === s.glang ? 'selected' : ''}>${esc(l.ko)} — ${has(l.no, s.game)}문항</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>문제 수</label>
        <div class="chips" id="gN">${[10, 20, 30, 50].map(n => `<button class="chip ${s.gn === n ? 'on' : ''}" data-n="${n}">${n}</button>`).join('')}</div>
      </div>
      <button class="btn" id="gStart2">${GAME_NAME[s.game]} 시작</button>
      <div id="gVoice" class="voiceline"></div>
      <p class="subnote">${s.game === 'order' ? '한국어 뜻을 보고 섞인 단어를 순서대로 눌러 문장을 만드세요.'
        : s.game === 'cloze' ? '문장의 빈칸에 알맞은 말을 고르세요. 가이드 예문과 내가 보낸 문장에서 냅니다.'
          : '같은 단어를 잘못 늘어놓은 문장과 바른 문장을 구별하세요.'}</p>
      `}
    </div>
  </div>`;

  const fillVoice = () => {
    const l = vocabMeta.langs.find(x => x.no === s.glang) || {};
    fillVoiceLine($('#gVoice'), LANG_CODE[s.glang], l.native || l.ko);
  };
  if (!isVerb) fillVoice();

  $$('[data-view]', app).forEach(b => b.onclick = () => { s.view = b.dataset.view; renderGrammarSetup(); });
  $$('[data-game]', app).forEach(b => b.onclick = () => { s.game = b.dataset.game; renderGrammarSetup(); });
  if (!isVerb) {
    $('#gLang2').onchange = e => { s.glang = Number(e.target.value); renderGrammarSetup(); };
    $$('#gN .chip').forEach(c => c.onclick = () => { s.gn = Number(c.dataset.n); $$('#gN .chip').forEach(x => x.classList.toggle('on', x === c)); });
  }
  if (isVerb) {
    $$('#vTense .chip').forEach(c => c.onclick = () => { s.tense = Number(c.dataset.t); $$('#vTense .chip').forEach(x => x.classList.toggle('on', x === c)); });
    $$('#vN .chip').forEach(c => c.onclick = () => { s.vn = Number(c.dataset.n); $$('#vN .chip').forEach(x => x.classList.toggle('on', x === c)); });
    $('#vVol').onchange = e => { s.vol = Number(e.target.value); };
    $('#vLang').onchange = e => {
      s.lang = Number(e.target.value);
      const f = $('#vFind');
      if (f && f.value.trim()) f.dispatchEvent(new Event('input'));
    };
  }

  const runGame = async () => {
    const btn = $('#gStart2');
    if (btn) { btn.disabled = true; btn.textContent = '문제 준비 중…'; }
    try {
      const data = await DATA.games(s.glang);
      const lname = langName(s.glang);
      const code = LANG_CODE[s.glang] || '';
      const sayOf = t => ({ t: t, c: code, n: lname });
      let items = [];
      if (s.game === 'order') {
        items = sample(data.order, s.gn).map(o => {
          let order = shuffle(o.t.map((_, i) => i));
          let guard = 0;
          while (order.map(i => o.t[i]).join(' ') === o.a && guard++ < 6) order = shuffle(order);
          const tiles = order.map(i => o.t[i]);
          const roles = order.map(i => (o.r && o.r[i]) || '');
          const meanings = order.map(i => (o.m && o.m[i]) || '');
          return {
            kind: 'order', title: `${lname} · 문장 순서`,
            prompt: `<div class="qtext">${esc(o.ko)}</div>`,
            sub: `<span style="color:var(--ink3)">단어를 순서대로 눌러 ${esc(lname)} 문장을 만드세요.</span>`,
            answer: o.a, tiles: tiles, roles: roles, meanings: meanings, orderHint: orderHintOf(s.glang),
            pron: o.p || '', say: sayOf(o.a), why: '',
            key: `g:o:${s.glang}:${o.a}`
          };
        });
      } else if (s.game === 'cloze') {
        items = sample(data.cloze, s.gn).map(c => {
          const full = c.q.replace('____', c.opts[c.c]);
          return {
            kind: 'mc', title: `${lname} · 빈칸`,
            prompt: `<div class="qtext" style="font-size:17px">${esc(c.q).replace('____', '<span class="blank">____</span>')}</div>`,
            sub: `${c.ko ? `<b>뜻</b> ${esc(c.ko)}` : ''}${c.hint ? ` <span class="ghint">힌트 ${esc(c.hint)}</span>` : ''}`,
            opts: c.opts.map(w => ({ html: `<b>${esc(w)}</b>` })),
            correct: c.c,
            answer: `<b>${esc(c.opts[c.c])}</b>`,
            why: [c.src ? `<span class="srcline">${esc(c.src)}</span>` : '', c.why ? esc(c.why) : '',
              c.pr ? `<span class="prline">${esc(full)} · ${esc(c.pr)}</span>` : ''].filter(Boolean).join('<br>'),
            sayAnswer: sayOf(full),
            key: `g:c:${s.glang}:${c.q}`
          };
        });
      } else if (s.game === 'pick') {
        const byAnswer = {};
        (data.order || []).forEach(o => { if (o && o.a && !byAnswer[o.a]) byAnswer[o.a] = o; });
        items = sample(data.pick, s.gn).map(c => {
          const o = byAnswer[c.a] || null;
          return {
            kind: 'mc', title: `${lname} · 어순`,
            prompt: `<div class="qtext">어순이 맞는 문장을 고르세요</div>`,
            sub: `<b>뜻</b> ${esc(c.ko)}`,
            hint: pickHint(s.glang, o, lname),
            opts: c.opts.map(s2 => ({ html: esc(s2) })),
            correct: c.c,
            answer: esc(c.a),
            why: pickWhy(s.glang, o), sayAnswer: sayOf(c.a),
            key: `g:p:${s.glang}:${c.a}`
          };
        });
      }
      if (!items.length) { alert('이 언어에는 아직 문제가 없어요. 다른 언어를 골라 주세요.'); return; }
      lastBuilder = runGame;
      startQuiz({ title: `${GAME_NAME[s.game]} · ${lname}`, mode: 'gram', items });
    } catch (e) {
      alert('문제를 만드는 중 오류: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = `${GAME_NAME[s.game]} 시작`; }
    }
  };

  const runVerb = async (opt) => {
    const vol = (opt && opt.vol) || s.vol;
    const only = (opt && opt.only) || '';
    const tenseSel = (opt && opt.allTenses) ? -1 : s.tense;
    const [metaV, rows, lang] = await Promise.all([DATA.verbMeta(), DATA.verbItems(vol), DATA.verbLang(vol, s.lang)]);
    const lname = (metaV.langs.find(l => l.no === s.lang) || {}).ko || '';
    const pool = rows.map((r, i) => i).filter(i => (tenseSel < 0 || rows[i][3] === metaV.tenses[tenseSel]) && lang[i] && lang[i][0] && (!only || rows[i][1] === only));
    if (!pool.length) { alert('이 조건에 맞는 활용이 없어요. 시제나 검색어를 바꿔 보세요.'); return; }
    const picked = sample(pool, s.vn);
    const takeUnique = (cands, used) => {
      const seen = new Set(used);
      const out = [];
      for (const j of shuffle(cands)) {
        const t = lang[j] && lang[j][0];
        if (!t || seen.has(t)) continue;
        seen.add(t); out.push(j);
        if (out.length >= 3) break;
      }
      return out;
    };
    const showEn = ![2, 3, 11].includes(s.lang);
    const vcode = LANG_CODE[s.lang] || 'en';
    const items = picked.map(i => {
      const r = rows[i];
      const verbEn = r[1], verbKo = r[2], tense = r[3], person = r[4], en = r[5], ko = r[6];
      const correct = lang[i][0];
      const used = [correct];
      let d = takeUnique(rows.map((x, j) => j).filter(j => j !== i && rows[j][1] === verbEn && rows[j][3] === tense), used);
      used.push(...d.map(j => lang[j][0]));
      if (d.length < 3) {
        const more = takeUnique(rows.map((x, j) => j).filter(j => j !== i && rows[j][1] === verbEn && !d.includes(j)), used);
        d = d.concat(more); used.push(...more.map(j => lang[j][0]));
      }
      if (d.length < 3) {
        const more = takeUnique(rows.map((x, j) => j).filter(j => j !== i && rows[j][3] === tense && !d.includes(j)), used);
        d = d.concat(more);
      }
      const optsRaw = shuffle([i].concat(d));
      return {
        kind: 'mc',
        title: `${vol}권 · ${lname}`,
        prompt: `<div class="qtext"><span class="big">${esc(showEn ? en : ko)}</span></div>`,
        sub: `<b>${esc(verbEn)}</b> ${esc(verbKo)} · ${esc(tense)} · ${esc(person)} — ${esc(lname)}로?`,
        sayPrompt: showEn ? { t: en, c: 'en-GB', n: '영어' } : null,
        opts: optsRaw.map(j => ({ html: `<b>${esc(lang[j][0])}</b>`, note: esc(pronText(lang[j][1])), say: { t: lang[j][0], c: vcode, n: lname } })),
        correct: optsRaw.indexOf(i),
        sayAnswer: { t: correct, c: vcode, n: lname },
        why: '',
        key: `v${vol}:${s.lang}:${i}`
      };
    });
    lastBuilder = runVerb;
    startQuiz({ title: only ? `동사 변화 · ${only} · ${lname}` : `동사 변화 · ${lname}`, mode: 'verb', items });
  };

  /* ---- 동사 검색: 1~3권 전체에서 동사·뜻·활용형을 찾고 바로 듣기 ---- */
  if (isVerb) {
    const vFind = $('#vFind'), vCount = $('#vCount'), vHits = $('#vHits'), vClear = $('#vFindClear'), vSetup = $('#vQuizSetup');
    let token = 0;
    const vSays = [];
    const vcode = LANG_CODE[s.lang] || 'en-GB';
    const lname = (vmeta.langs.find(l => l.no === s.lang) || {}).ko || '';
    const GROUP_MAX = 12;
    const run = async () => {
      const q = vFind.value.trim();
      s.vq = q;
      if (vClear) vClear.hidden = !q;
      if (!q) {
        vCount.textContent = ''; vCount.classList.remove('on');
        vHits.innerHTML = ''; vSays.length = 0;
        if (vSetup) vSetup.hidden = false;
        return;
      }
      const my = ++token;
      if (vSetup) vSetup.hidden = true;
      vCount.classList.remove('on');
      vCount.textContent = '찾는 중…';
      let all;
      try { all = await verbSearchRows(s.lang); }
      catch (e) { if (my === token) vCount.textContent = '동사 데이터를 불러오지 못했어요: ' + e.message; return; }
      if (my !== token || !vFind.isConnected) return;
      const words = foldText(q).split(' ').filter(Boolean);
      let hits = all.filter(r => verbMatches(r, words, false));
      let loose = false;
      if (!hits.length) { hits = all.filter(r => verbMatches(r, words, true)); loose = hits.length > 0; }
      const groups = verbGroupHits(hits);
      const shown = groups.slice(0, GROUP_MAX);
      vSays.length = 0;
      const cards = shown.map((g, gi) => {
        const tenses = vmeta.tenses.concat(g.rows.map(r => r.tense).filter((t, i, a) => vmeta.tenses.indexOf(t) < 0 && a.indexOf(t) === i));
        const rowsHtml = tenses.map(t => {
          const rs = g.rows.filter(r => r.tense === t);
          if (!rs.length) return '';
          return `<div class="vtense"><div class="vtense-h">${esc(t)}</div>
            ${rs.map(r => {
              const n = vSays.length;
              vSays.push({ t: r.native, c: vcode, n: lname });
              return `<div class="vline">
                <span class="vperson">${esc(r.person)}</span>
                <b class="vnative">${esc(r.native)}</b>
                ${r.pron ? `<span class="vpron">${esc(pronText(r.pron))}</span>` : ''}
                ${spkBtn('s' + n)}
                <span class="vsent">${esc(r.en)} · ${esc(r.ko)}</span>
              </div>`;
            }).join('')}
          </div>`;
        }).join('');
        return `<div class="vcard2">
          <div class="vcard2-h">
            <div>
              <div class="vcard2-t">${esc(g.verbEn)} <span class="vcard2-ko">${esc(g.verbKo)}</span></div>
              <div class="vcard2-m">${g.vol}권 · ${g.rows.length}개 활용 · ${esc(lname)}</div>
            </div>
            <button type="button" class="btn sm plain" data-vquiz="${gi}">이 동사 풀기</button>
          </div>
          ${rowsHtml}
        </div>`;
      }).join('');
      vCount.classList.add('on');
      vCount.innerHTML = hits.length
        ? `🔍 <b>${esc(q)}</b> · ${groups.length}개 동사 · ${hits.length}개 활용${loose ? ' · 비슷한 낱말' : ''}`
        : `🔍 <b>${esc(q)}</b> · 맞는 동사가 없어요`;
      vHits.innerHTML = hits.length
        ? `<div class="vhitscard">${cards}${groups.length > GROUP_MAX ? `<p class="subnote">앞의 ${GROUP_MAX}개 동사만 보여 줍니다(전체 ${groups.length}개). 검색어를 더 넣어 좁히세요.</p>` : ''}</div>`
        : `<p class="desc">맞는 활용이 없어요. 동사 원형·한국어 뜻·활용형·발음으로 찾아보세요 — 예: to go, 가다, 갔다, ich bin, 이히 빈</p>`;
      bindSayList(vSays);
      $$('[data-vquiz]', vHits).forEach(b => b.onclick = () => {
        const g = shown[Number(b.dataset.vquiz)];
        if (!g) return;
        s.vol = g.vol;
        runVerb({ vol: g.vol, only: g.verbEn, allTenses: true });
      });
    };
    vFind.oninput = run;
    vFind.onkeydown = e => { if (e.key === 'Escape') { vFind.value = ''; run(); } };
    if (vClear) vClear.onclick = () => { vFind.value = ''; run(); vFind.focus(); };
    if (s.vq) run();
  }

  const gs = $('#gStart2'); if (gs) gs.onclick = runGame;
  const vs = $('#vStart'); if (vs) vs.onclick = runVerb;
}

/* ================================================================== 2. 단어 */
async function renderWordsSetup() {
  loading();
  let meta, items;
  try { [meta, items] = await Promise.all([DATA.vocabMeta(), DATA.vocabItems()]); }
  catch (e) { app.innerHTML = `<div class="card"><h2>데이터를 불러오지 못했어요</h2><p class="desc">${esc(e.message)}</p></div>`; return; }
  const s = state.setup.words || (state.setup.words = {
    lang: 6, src: 'all', group: -1, batch: -1, n: 20, mode: 'mc', dir: 'ko2nat', search: ''
  });
  const langs = meta.langs.filter(l => l.no !== 1);
  const total = meta.counts.items;
  const sentTotal = meta.counts.sentences;

  app.innerHTML = `<div class="screen">
    <div class="card hero">
      <h2>단어 테스트</h2>
      <p class="desc">${esc(meta.counts.langs)}개 언어 · ${total.toLocaleString()}개 단어·표현. 보내주신 단어와 IELTS/TOEFL 보완을 나눠 풀 수 있어요.</p>
      <div class="statrow">
        <div><b>${meta.counts.drops.toLocaleString()}</b>보내주신 단어</div>
        <div><b>${meta.counts.supp.toLocaleString()}</b>IELTS·TOEFL</div>
        <div><b>${meta.groups.length}</b>주제</div>
      </div>
    </div>

    <div class="card">
      <div class="field">
        <label>언어</label>
        <select id="wLang">${langs.map(l => `<option value="${l.no}" ${l.no === s.lang ? 'selected' : ''}>${esc(l.ko)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>범위</label>
        <div class="chips" id="wSrc">
          <button class="chip ${s.src === 'all' ? 'on' : ''}" data-v="all">전체</button>
          <button class="chip ${s.src === 'd' ? 'on' : ''}" data-v="d">보내주신 단어</button>
          <button class="chip ${s.src === 's' ? 'on' : ''}" data-v="s">IELTS·TOEFL 보완</button>
        </div>
      </div>
      <div class="field">
        <label>차수 (보낸 묶음)</label>
        <select id="wBatch"><option value="-1">전체 차수 (${total.toLocaleString()})</option>${meta.batches.map(b => `<option value="${b.n}" ${s.batch === b.n ? 'selected' : ''}>${b.n}차 · ${b.items}개${b.src === 's' ? ' · IELTS/TOEFL 보완' : ''}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>주제 (선택)</label>
        <input type="search" id="wSearch" placeholder="주제 검색 — 예: 공항, 요리, 병원" value="${esc(s.search)}">
        <select id="wGroup" style="margin-top:8px"></select>
      </div>
      <div class="field">
        <label>유형</label>
        <div class="chips" id="wMode">
          <button class="chip ${s.mode === 'mc' ? 'on' : ''}" data-v="mc">4지선다</button>
          <button class="chip ${s.mode === 'card' ? 'on' : ''}" data-v="card">플래시카드</button>
        </div>
      </div>
      <div class="field ${s.mode === 'card' ? 'hidden' : ''}" id="wDirBox">
        <label>방향</label>
        <div class="chips" id="wDir">
          <button class="chip ${s.dir === 'ko2nat' ? 'on' : ''}" data-v="ko2nat">뜻 → 원어</button>
          <button class="chip ${s.dir === 'nat2ko' ? 'on' : ''}" data-v="nat2ko">원어 → 뜻</button>
        </div>
      </div>
      <div class="field">
        <label>문제 수</label>
        <div class="chips" id="wN">${[10, 20, 30, 50].map(n => `<button class="chip ${s.n === n ? 'on' : ''}" data-n="${n}">${n}</button>`).join('')}</div>
      </div>
      <div style="margin:6px 0 14px">
        <div class="switch"><span>한국어 발음 보기</span><input type="checkbox" id="setPron" ${SET.pron ? 'checked' : ''}></div>
        <div class="switch"><span>중국어 성조 · 병음 보기</span><input type="checkbox" id="setTone" ${SET.tone ? 'checked' : ''}></div>
      </div>
      <button class="btn" id="wStart">단어 테스트 시작</button>
      <div id="wVoice" class="voiceline"></div>
      <p class="subnote">주제를 고르지 않으면 범위 전체에서 무작위로 나옵니다. 테스트 중 🔊 를 누르면 원어를 들고, 0.5x~2x 배속을 고를 수 있어요.</p>
    </div>
  </div>`;

  const groupSel = $('#wGroup');
  function fillGroups() {
    const kw = s.search.trim().toLowerCase();
    const list = meta.groups.map((g, i) => ({ g, i }))
      .filter(o => !kw || o.g.name.toLowerCase().includes(kw));
    groupSel.innerHTML = `<option value="-1">전체 주제 (${total.toLocaleString()})</option>` +
      list.map(o => `<option value="${o.i}" ${s.group === o.i ? 'selected' : ''}>${esc(o.g.name)} · ${o.g.count}</option>`).join('');
    if (!list.some(o => o.i === s.group)) { s.group = -1; groupSel.value = '-1'; }
  }
  fillGroups();
  $('#wSearch').oninput = e => { s.search = e.target.value; fillGroups(); };
  groupSel.onchange = e => { s.group = Number(e.target.value); };
  $('#wBatch').onchange = e => { s.batch = Number(e.target.value); };
  $('#wLang').onchange = e => { s.lang = Number(e.target.value); fillVoice(); };
  const fillVoice = () => {
    const l = meta.langs.find(x => x.no === s.lang) || {};
    fillVoiceLine($('#wVoice'), LANG_CODE[s.lang], l.native || l.ko);
  };
  fillVoice();
  $$('#wSrc .chip').forEach(c => c.onclick = () => { s.src = c.dataset.v; $$('#wSrc .chip').forEach(x => x.classList.toggle('on', x === c)); });
  $$('#wMode .chip').forEach(c => c.onclick = () => {
    s.mode = c.dataset.v; $$('#wMode .chip').forEach(x => x.classList.toggle('on', x === c));
    $('#wDirBox').classList.toggle('hidden', s.mode === 'card');
  });
  $$('#wDir .chip').forEach(c => c.onclick = () => { s.dir = c.dataset.v; $$('#wDir .chip').forEach(x => x.classList.toggle('on', x === c)); });
  $$('#wN .chip').forEach(c => c.onclick = () => { s.n = Number(c.dataset.n); $$('#wN .chip').forEach(x => x.classList.toggle('on', x === c)); });
  $('#setPron').onchange = e => { SET.pron = e.target.checked; saveSet(); };
  $('#setTone').onchange = e => { SET.tone = e.target.checked; saveSet(); };

  const runWords = async () => {
    const btn = $('#wStart');
    btn.disabled = true; btn.textContent = '문제 준비 중…';
    try {
      const lang = await DATA.vocabLang(s.lang);
      const pool = [];
      items.forEach((it, i) => {
        const [b, gi, ko, en, sent] = it;
        if (s.src === 'd' && meta.batches.find(x => x.n === b).src !== 'd') return;
        if (s.src === 's' && meta.batches.find(x => x.n === b).src !== 's') return;
        if (s.group >= 0 && gi !== s.group) return;
        if (s.batch > 0 && b !== s.batch) return;
        if (!lang[i] || !lang[i][0]) return;
        pool.push(i);
      });
      if (pool.length < 4) { alert('문제를 만들 수 없어요. 범위를 넓혀 주세요.'); return; }
      const picked = sample(pool, s.n);
      const lname = (meta.langs.find(l => l.no === s.lang) || {}).ko || '';
      const wcode = LANG_CODE[s.lang] || '';
      const sayOf = t => ({ t: t, c: wcode, n: lname });
      let quizItems;
      if (s.mode === 'card') {
        quizItems = picked.map(i => {
          const [b, gi, ko, en] = items[i];
          const [nat, pron] = lang[i];
          return {
            kind: 'card',
            title: `${lname}`,
            front: { html: `${esc(ko)}`, note: `<div class="hint">${esc(en)}</div>` },
            back: { html: `${esc(nat)}${pronLine(pron)}<div class="trans">${esc(ko)}</div>`, say: sayOf(nat) },
            key: `w:${s.lang}:${i}`
          };
        });
        lastBuilder = runWords;
        startQuiz({ title: `단어 카드 · ${lname}`, mode: 'words', items: quizItems });
        return;
      }
      const showEn = ![2, 3, 11].includes(s.lang);
      quizItems = picked.map(i => {
        const [b, gi, ko, en] = items[i];
        const [nat, pron] = lang[i];
        if (s.dir === 'ko2nat') {
          const others = pickUnique(pool, 3, i, j => (lang[j] || [])[0], nat);
          const optsRaw = shuffle([{ j: i }].concat(others.map(j => ({ j }))));
          const correctIdx = optsRaw.findIndex(o => o.j === i);
          return {
            kind: 'mc',
            title: `${lname} · 뜻 → 원어`,
            prompt: `<div class="qtext"><span class="big">${esc(ko)}</span></div>`,
            sub: `<b>${esc(lname)}</b>로 무엇이라고 할까요?${showEn && en && en.toLowerCase() !== nat.toLowerCase() ? ` <span style="color:var(--ink3)">(${esc(en)})</span>` : ''}`,
            opts: optsRaw.map(o => ({ html: `<b>${esc(lang[o.j][0])}</b>`, note: pronText(lang[o.j][1]) ? esc(pronText(lang[o.j][1])) : '', say: sayOf(lang[o.j][0]) })),
            correct: correctIdx,
            sayAnswer: sayOf(nat),
            why: '',
            extra: '',
            key: `w:${s.lang}:${i}`
          };
        } else {
          const others = pickUnique(pool, 3, i, j => items[j][2], ko);
          const optsRaw = shuffle([{ j: i }].concat(others.map(j => ({ j }))));
          const correctIdx = optsRaw.findIndex(o => o.j === i);
          return {
            kind: 'mc',
            title: `${lname} · 원어 → 뜻`,
            prompt: `<div class="qtext"><span class="big">${esc(nat)}</span></div>`,
            sub: `${pronLine(pron)} ${esc(lname)} — 뜻은?`,
            sayPrompt: sayOf(nat),
            opts: optsRaw.map(o => ({ html: esc(items[o.j][2]) })),
            correct: correctIdx,
            why: '',
            extra: '',
            key: `w:${s.lang}:${i}`
          };
        }
      });
      lastBuilder = runWords;
      startQuiz({ title: `단어 · ${lname}`, mode: 'words', items: quizItems });
    } catch (e) {
      alert('문제를 만드는 중 오류: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = '단어 테스트 시작';
    }
  };
  $('#wStart').onclick = runWords;
}

/* ================================================================== 3. 내 문장 */
async function renderSentSetup() {
  loading();
  let meta, items;
  try { [meta, items] = await Promise.all([DATA.vocabMeta(), DATA.vocabItems()]); }
  catch (e) { app.innerHTML = `<div class="card"><h2>데이터를 불러오지 못했어요</h2><p class="desc">${esc(e.message)}</p></div>`; return; }
  const s = state.setup.sent || (state.setup.sent = {
    lang: 6, mode: 'mc', dir: 'ko2en', n: 20, search: ''
  });
  const langs = meta.langs.filter(l => l.no !== 1);
  const sentTotal = meta.counts.sentences;
  const sentByBatch = {};
  items.forEach(it => { if (it[4]) sentByBatch[it[0]] = (sentByBatch[it[0]] || 0) + 1; });

  app.innerHTML = `<div class="screen">
    <div class="card hero">
      <h2>내가 보낸 문장</h2>
      <p class="desc">Drops 화면으로 보내주신 문장·표현 ${sentTotal}개만 모았습니다. 뜻 맞히기, 원어 맞히기, 플래시카드.</p>
      <div class="statrow"><div><b>${sentTotal}</b>문장·표현</div><div><b>${Object.keys(sentByBatch).length}</b>차수</div><div><b>${meta.counts.drops.toLocaleString()}</b>보내주신 단어 전체</div></div>
    </div>
    <div class="card">
      <div class="field">
        <label>언어 (원어 맞히기·카드에 사용)</label>
        <select id="sLang">${langs.map(l => `<option value="${l.no}" ${l.no === s.lang ? 'selected' : ''}>${esc(l.ko)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>유형</label>
        <div class="chips" id="sMode">
          <button class="chip ${s.mode === 'mc' ? 'on' : ''}" data-v="mc">4지선다</button>
          <button class="chip ${s.mode === 'card' ? 'on' : ''}" data-v="card">플래시카드</button>
        </div>
      </div>
      <div class="field ${s.mode === 'card' ? 'hidden' : ''}" id="sDirBox">
        <label>방향</label>
        <div class="chips" id="sDir">
          <button class="chip ${s.dir === 'ko2en' ? 'on' : ''}" data-v="ko2en">뜻 → 영어</button>
          <button class="chip ${s.dir === 'en2ko' ? 'on' : ''}" data-v="en2ko">영어 → 뜻</button>
          <button class="chip ${s.dir === 'ko2nat' ? 'on' : ''}" data-v="ko2nat">뜻 → 원어</button>
        </div>
      </div>
      <div class="field">
        <label>주제 (선택)</label>
        <input type="search" id="sSearch" placeholder="주제 검색 — 예: 공항, 식당, 병원" value="${esc(s.search)}">
        <select id="sGroup" style="margin-top:8px"></select>
      </div>
      <div class="field">
        <label>문제 수</label>
        <div class="chips" id="sN">${[10, 20, 30, 50].map(n => `<button class="chip ${s.n === n ? 'on' : ''}" data-n="${n}">${n}</button>`).join('')}</div>
      </div>
      <div style="margin:6px 0 14px">
        <div class="switch"><span>한국어 발음 보기</span><input type="checkbox" id="sSetPron" ${SET.pron ? 'checked' : ''}></div>
        <div class="switch"><span>중국어 성조 · 병음 보기</span><input type="checkbox" id="sSetTone" ${SET.tone ? 'checked' : ''}></div>
      </div>
      <button class="btn" id="sStart">문장 테스트 시작</button>
      <div id="sVoice" class="voiceline"></div>
      <p class="subnote">테스트 중 🔊 를 누르면 원어 문장을 읽어 주고, 0.5x~2x 배속을 고를 수 있어요.</p>
    </div>
  </div>`;

  const pool0 = items.map((it, i) => ({ it, i })).filter(o => o.it[4]);
  const groupsOfSent = new Map();
  pool0.forEach(o => {
    const gi = o.it[1];
    const name = meta.groups[gi] ? meta.groups[gi].name : '기타';
    groupsOfSent.set(gi, (groupsOfSent.get(gi) || 0) + 1);
  });
  const groupSel = $('#sGroup');
  function fillGroups() {
    const kw = s.search.trim().toLowerCase();
    const list = [...groupsOfSent.entries()]
      .map(([gi, c]) => ({ gi, name: meta.groups[gi] ? meta.groups[gi].name : '기타', c }))
      .filter(o => !kw || o.name.toLowerCase().includes(kw))
      .sort((a, b) => b.c - a.c);
    groupSel.innerHTML = `<option value="-1">전체 (${sentTotal})</option>` +
      list.map(o => `<option value="${o.gi}" ${s.group === o.gi ? 'selected' : ''}>${esc(o.name)} · ${o.c}</option>`).join('');
    if (!list.some(o => o.gi === s.group)) { s.group = -1; groupSel.value = '-1'; }
  }
  fillGroups();
  $('#sSearch').oninput = e => { s.search = e.target.value; fillGroups(); };
  groupSel.onchange = e => { s.group = Number(e.target.value); };
  $('#sLang').onchange = e => { s.lang = Number(e.target.value); fillVoice(); };
  const fillVoice = () => {
    const l = meta.langs.find(x => x.no === s.lang) || {};
    fillVoiceLine($('#sVoice'), LANG_CODE[s.lang], l.native || l.ko);
  };
  fillVoice();
  $$('#sMode .chip').forEach(c => c.onclick = () => { s.mode = c.dataset.v; $$('#sMode .chip').forEach(x => x.classList.toggle('on', x === c)); $('#sDirBox').classList.toggle('hidden', s.mode === 'card'); });
  $$('#sDir .chip').forEach(c => c.onclick = () => { s.dir = c.dataset.v; $$('#sDir .chip').forEach(x => x.classList.toggle('on', x === c)); });
  $$('#sN .chip').forEach(c => c.onclick = () => { s.n = Number(c.dataset.n); $$('#sN .chip').forEach(x => x.classList.toggle('on', x === c)); });
  $('#sSetPron').onchange = e => { SET.pron = e.target.checked; saveSet(); };
  $('#sSetTone').onchange = e => { SET.tone = e.target.checked; saveSet(); };

  const runSent = async () => {
    const btn = $('#sStart');
    btn.disabled = true; btn.textContent = '문제 준비 중…';
    try {
      const lang = await DATA.vocabLang(s.lang);
      const lname = (meta.langs.find(l => l.no === s.lang) || {}).ko || '';
      const showEn = ![2, 3, 11].includes(s.lang);
      const scode = LANG_CODE[s.lang] || '';
      const sayOf = t => (t ? { t: t, c: scode, n: lname } : null);
      const sayEn = t => (t ? { t: t, c: 'en-GB', n: '영어' } : null);
      const pool = items.map((it, i) => ({ it, i })).filter(o => o.it[4] && (s.group < 0 || o.it[1] === s.group));
      if (pool.length < 4) { alert('문장이 부족해요. 주제를 넓혀 주세요.'); return; }
      // 너무 비슷한 뜻(같은 한국어) 중복 제거
      const seen = new Set();
      const uniq = pool.filter(o => { const k = o.it[2]; if (seen.has(k)) return false; seen.add(k); return true; });
      const picked = sample(uniq.length >= s.n ? uniq : pool, s.n);

      if (s.mode === 'card') {
        const quizItems = picked.map(({ it, i }) => {
          const [b, gi, ko, en] = it;
          const [nat, pron] = lang[i] || ['', ''];
          return {
            kind: 'card',
            title: lname,
            front: { html: esc(ko), note: `<div class="hint">${esc(en)}</div>` },
            back: { html: `${esc(nat)}${pronLine(pron)}<div class="trans">${esc(en)}</div><div class="trans" style="font-size:14px;color:var(--ink2)">${esc(ko)}</div>`, say: sayOf(nat) },
            key: `s:${s.lang}:${i}`
          };
        });
        lastBuilder = runSent;
        startQuiz({ title: `문장 카드 · ${lname}`, mode: 'sent', items: quizItems });
        return;
      }

      const quizItems = picked.map(({ it, i }) => {
        const [b, gi, ko, en] = it;
        const [nat, pron] = lang[i] || ['', ''];
        if (s.dir === 'ko2en') {
          const others = (() => { const seen = new Set([en]); const out = []; for (const o of shuffle(pool)) { if (o.i === i || seen.has(o.it[3])) continue; seen.add(o.it[3]); out.push(o); if (out.length >= 3) break; } return out; })();
          const optsRaw = shuffle([{ i }].concat(others.map(o => ({ i: o.i }))));
          const correctIdx = optsRaw.findIndex(o => o.i === i);
          return {
            kind: 'mc', title: '뜻 → 영어',
            prompt: `<div class="qtext">${esc(ko)}</div>`,
            sub: '이 뜻에 맞는 영어 문장은?',
            opts: optsRaw.map(o => ({ html: esc(items[o.i][3]), say: sayEn(items[o.i][3]) })),
            correct: correctIdx, why: '',
            sayAnswer: sayEn(en),
            extra: (showEn && pronLine(pron)) ? `<b>${esc(nat)}</b> ${pronLine(pron)}` : '',
            sayExtra: (showEn && pronLine(pron)) ? sayOf(nat) : null,
            key: `s:${s.lang}:${i}`
          };
        }
        if (s.dir === 'en2ko') {
          const others = (() => { const seen = new Set([ko]); const out = []; for (const o of shuffle(pool)) { if (o.i === i || seen.has(o.it[2])) continue; seen.add(o.it[2]); out.push(o); if (out.length >= 3) break; } return out; })();
          const optsRaw = shuffle([{ i }].concat(others.map(o => ({ i: o.i }))));
          const correctIdx = optsRaw.findIndex(o => o.i === i);
          return {
            kind: 'mc', title: '영어 → 뜻',
            prompt: `<div class="qtext" style="font-size:17px">${esc(en)}</div>`,
            sub: '이 문장의 뜻은?',
            sayPrompt: sayEn(en),
            opts: optsRaw.map(o => ({ html: esc(items[o.i][2]) })),
            correct: correctIdx, why: '',
            extra: pronLine(pron) ? `${esc(nat)} ${pronLine(pron)}` : '',
            sayExtra: pronLine(pron) ? sayOf(nat) : null,
            key: `s:${s.lang}:${i}`
          };
        }
        // 뜻 → 원어
        const others = (() => { const seen = new Set([nat]); const out = []; for (const o of shuffle(pool)) { const k = (lang[o.i] || [])[0]; if (o.i === i || !k || seen.has(k)) continue; seen.add(k); out.push(o); if (out.length >= 3) break; } return out; })();
        const optsRaw = shuffle([{ i }].concat(others.map(o => ({ i: o.i }))));
        const correctIdx = optsRaw.findIndex(o => o.i === i);
        return {
          kind: 'mc', title: `뜻 → ${lname}`,
          prompt: `<div class="qtext">${esc(ko)}</div>`,
          sub: `${showEn ? `<b>${esc(en)}</b> — ` : ''}${esc(lname)}로는?`,
          opts: optsRaw.map(o => ({ html: `<b>${esc((lang[o.i] || [''])[0])}</b>`, note: esc(pronText((lang[o.i] || [])[1])), say: sayOf((lang[o.i] || [''])[0]) })),
          correct: correctIdx, why: '',
          sayAnswer: sayOf(nat),
          extra: '',
          key: `s:${s.lang}:${i}`
        };
      });
      lastBuilder = runSent;
      startQuiz({ title: `내 문장 · ${lname}`, mode: 'sent', items: quizItems });
    } catch (e) {
      alert('문제를 만드는 중 오류: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = '문장 테스트 시작';
    }
  };
  $('#sStart').onclick = runSent;
}

/* ================================================================== 4. 자료실 */
async function renderLibrary() {
  loading();
  let lib;
  try { lib = await DATA.library(); }
  catch (e) { app.innerHTML = `<div class="card"><h2>자료실을 불러오지 못했어요</h2><p class="desc">${esc(e.message)}</p></div>`; return; }
  const st = state.setup.lib || (state.setup.lib = { cat: 'all', q: '' });

  function draw() {
    const q = st.q.trim().toLowerCase();
    const list = lib.files.filter(f => {
      if (st.cat !== 'all' && f.cat !== st.cat) return false;
      if (!q) return true;
      return (f.title + ' ' + f.sub + ' ' + f.badge + ' ' + f.kw).toLowerCase().includes(q);
    });
    const listHtml = list.length ? list.map(f => `<div class="libitem">
      <div class="libthumb">${f.cat === 'vocab' ? esc(f.label.replace('권', '')) + '<br>권' : f.cat === 'grammar' ? 'G' : f.cat === 'verbs' ? 'V' + esc(f.label.replace('권', '')) : 'K'}</div>
      <div class="libbody">
        <div class="libtitle">${esc(f.title)}</div>
        <div class="libsub">${esc(f.sub)}</div>
        <div class="libmeta">
          ${f.badge ? `<span class="tag ${f.badge.includes('Drops') ? 'drops' : f.badge.includes('IELTS') ? 'ielts' : ''}">${esc(f.badge)}</span>` : ''}
          <span>${f.pages}쪽</span><span>${fmtSize(f.size)}</span>
        </div>
      </div>
      <div class="libtools">
        <a class="btn sm" href="${f.file}" target="_blank" rel="noopener">열기</a>
        <a class="btn sm plain" href="${f.file}" download>받기</a>
      </div>
    </div>`).join('') : `<div class="empty">찾는 자료가 없어요.</div>`;

    $('#libList').innerHTML = listHtml;
    $('#libCount').textContent = `${list.length}개 · ${fmtSize(list.reduce((a, b) => a + b.size, 0))}`;
  }

  app.innerHTML = `<div class="screen">
    <div class="card">
      <h2>📚 자료실</h2>
      <p class="desc">그동안 만든 PDF를 한곳에 모았습니다. 총 ${lib.counts.files}개 · ${fmtSize(lib.counts.bytes)}. 눌러서 바로 열거나 내려받으세요.</p>
      <input type="search" id="libSearch" placeholder="자료 검색 — 예: 12권, 스페인어, 캠핑" value="${esc(st.q)}">
      <div class="chips" id="libCats" style="margin-top:10px">
        <button class="chip ${st.cat === 'all' ? 'on' : ''}" data-c="all">전체</button>
        ${lib.categories.map(c => `<button class="chip ${st.cat === c.key ? 'on' : ''}" data-c="${c.key}">${esc(c.name)}</button>`).join('')}
      </div>
      <p class="subnote" id="libCount">${lib.counts.files}개 · ${fmtSize(lib.counts.bytes)}</p>
    </div>
    <div class="card" id="libListCard"><div id="libList"></div></div>
  </div>`;

  draw();
  $('#libSearch').oninput = e => { st.q = e.target.value; draw(); };
  $$('#libCats .chip').forEach(c => c.onclick = () => {
    st.cat = c.dataset.c;
    $$('#libCats .chip').forEach(x => x.classList.toggle('on', x === c));
    draw();
  });
}

/* ================================================================== 시작 */
refreshWrongBadge();
soundHelpBanner();
go('grammar');
