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

const SET = Object.assign({ pron: true, tone: true, rate: 1 }, store.get('settings', {}));
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
  let voices = [], ready = false, curEl = null, curUtt = null, timer = null;

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
      timer = setInterval(() => { refresh(); if (ready || ++n >= 12) { clearInterval(timer); timer = null; } }, 350);
    }
  }

  const norm = c => String(c || '').toLowerCase().replace(/_/g, '-');
  function candidates(code) {
    const list = [code].concat(CODE_FALLBACK[code] || []);
    const base = String(code || '').split('-')[0];
    if (base && base !== code) list.push(base);
    return list.map(norm).filter(Boolean);
  }
  function find(code) {
    if (!ready) refresh();
    if (!voices.length) return null;
    const cands = candidates(code);
    for (const c of cands) {
      const exact = voices.find(v => norm(v.lang) === c);
      if (exact) return exact;
    }
    for (const c of cands) {
      const pref = voices.find(v => norm(v.lang).startsWith(c + '-'));
      if (pref) return pref;
    }
    return null;
  }
  function stop() {
    if (curEl) curEl.classList.remove('playing');
    curEl = null; curUtt = null;
    if (!supported) return;
    try { synth.cancel(); } catch (e) { }
  }
  function say(text, code, el, name) {
    const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!t) return false;
    if (!supported) {
      toast('이 브라우저에서는 음성 읽기를 쓸 수 없어요. 크롬이나 삼성 인터넷에서 열어 주세요.', 4200);
      return false;
    }
    if (curEl && curEl === el) { stop(); return true; }   /* 듣던 버튼을 다시 누르면 정지 */
    stop();
    const v = find(code);
    if (!v) {
      const nm = name || CODE_KO[code] || code;
      toast(`🔇 ${nm}(${code}) 음성이 이 기기에 없어요. 설정 › 언어 및 입력 › 텍스트 읽어주기에서 음성 데이터를 받아 주세요.`, 4800);
      return false;
    }
    const u = new SpeechSynthesisUtterance(t);
    u.voice = v;
    u.lang = v.lang || code;
    u.rate = Math.min(3, Math.max(0.3, Number(SET.rate) || 1));
    u.pitch = 1;
    curEl = el || null; curUtt = u;
    if (el) el.classList.add('playing');
    const done = () => { if (el) el.classList.remove('playing'); if (curUtt === u) { curUtt = null; curEl = null; } };
    u.onend = done;
    u.onerror = done;
    /* 크롬 안드로이드에서는 cancel() 직후 같은 tick에 speak()하면 무시되는 경우가 있다 */
    setTimeout(() => {
      if (curUtt !== u) return;
      try { synth.resume(); } catch (e) { }
      try { synth.speak(u); } catch (e) { done(); toast('음성을 재생하지 못했어요.'); }
    }, 40);
    return true;
  }
  return {
    supported, say, stop, find,
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
    <span class="rlbl">🔊 배속</span>
    ${RATES.map(x => `<button type="button" class="rate ${Math.abs(r - x) < 0.01 ? 'on' : ''}" data-rate="${x}"><b>${x}x</b>${x === 0.5 ? '<i>느리게</i>' : x === 1 ? '<i>보통</i>' : x === 2 ? '<i>빠르게</i>' : ''}</button>`).join('')}
  </div>`;
}
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
  box.innerHTML = `<button type="button" class="btn plain sm" data-voice="1">🔊 ${esc(name)} 음성 확인</button>
    <span class="vstat">음성 상태 확인 중…</span>`;
  const btn = $('[data-voice]', box), stat = $('.vstat', box);
  btn.onclick = () => TTS.say(sample || name, code, btn, name);
  if (!TTS.supported) { stat.textContent = '이 브라우저는 음성 읽기를 지원하지 않아요'; stat.classList.add('no'); return; }
  TTS.whenReady(() => {
    if (!box.isConnected || !stat.isConnected) return;
    if (!TTS.ready) { stat.textContent = '음성 목록을 불러오는 중…'; stat.className = 'vstat'; return; }
    if (TTS.has(code)) { stat.textContent = `기기에 ${name} 음성 있음`; stat.className = 'vstat ok'; }
    else { stat.textContent = `기기에 ${name} 음성 없음 — 설정에서 음성 데이터를 받으면 들려요`; stat.className = 'vstat no'; }
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
async function load(path) {
  if (cache[path]) return cache[path];
  const r = await fetch(path);
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
  state.quiz = { title: quiz.title, mode: quiz.mode, items: quiz.items, idx: 0, answers: [], revealed: false, picked: -1 };
  renderQuiz();
  window.scrollTo(0, 0);
}

function renderQuiz() {
  const q = state.quiz;
  if (!q) return go(state.tab);
  if (q.idx >= q.items.length) return renderResult();
  const it = q.items[q.idx];
  if (it.kind === 'card') return renderCard();
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
      ${opts}
      ${body}
    </div>
    <div class="row"><button class="btn plain sm" data-quit="1">그만두기</button></div>
  </div>`;

  $$('[data-opt]', app).forEach(b => b.onclick = () => pickOption(Number(b.dataset.opt)));
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
  q.idx += 1; q.revealed = false; q.picked = -1;
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
  return {
    key: it.key || (it.prompt + '|' + (it.answer || '')).slice(0, 120),
    kind: it.kind, prompt: it.prompt, sub: it.sub || '', opts: it.opts || [],
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
  return { kind: p.kind === 'self' ? 'self' : 'mc', prompt: p.prompt, sub: p.sub, opts: p.opts,
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
async function renderGrammarSetup() {
  loading();
  let idx, vmeta;
  try { [idx, vmeta] = await Promise.all([DATA.lingqIndex(), DATA.verbMeta()]); }
  catch (e) { app.innerHTML = `<div class="card"><h2>데이터를 불러오지 못했어요</h2><p class="desc">${esc(e.message)}</p><button class="btn" onclick="location.reload()">다시 시도</button></div>`; return; }
  const s = state.setup.grammar || (state.setup.grammar = { guide: 'es', part: -1, n: 10, vol: 1, lang: 4, tense: -1, vn: 10 });
  const g = idx.find(x => x.key === s.guide) || idx[0];
  const qTotal = idx.reduce((a, b) => a + b.questions, 0);
  const verbTotal = vmeta.vols.reduce((a, b) => a + b.count, 0);
  app.innerHTML = `<div class="screen">
    <div class="card hero">
      <h2>문법 테스트</h2>
      <p class="desc">LingQ 문법 가이드 10종의 연습문제 ${qTotal}문항과, 26개 언어 동사 변화 ${verbTotal}항목.</p>
      <div class="statrow">
        <div><b>${idx.length}</b>가이드</div><div><b>${qTotal}</b>문법 문항</div><div><b>${verbTotal}</b>동사 항목</div>
      </div>
    </div>

    <div class="card">
      <h2>📖 문법 연습문제</h2>
      <p class="desc">문제를 읽고 답을 떠올린 뒤 <b>정답·해설 보기</b>로 확인하고 스스로 채점합니다.</p>
      <div class="field">
        <label>가이드</label>
        <select id="gGuide">${idx.map(x => `<option value="${x.key}" ${x.key === g.key ? 'selected' : ''}>${esc(x.label)} — ${x.questions}문항</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>파트</label>
        <select id="gPart"></select>
      </div>
      <div class="field">
        <label>문제 수</label>
        <div class="chips" id="gN">${[10, 20, 30, 50].map(n => `<button class="chip ${s.n === n ? 'on' : ''}" data-n="${n}">${n}문제</button>`).join('')}</div>
      </div>
      <button class="btn" id="gStart">문법 문제 풀기</button>
      <div id="gVoice" class="voiceline"></div>
      <p class="subnote">정답·해설은 가이드 원문 그대로입니다. 문제의 🔊 를 누르면 예문의 원어 부분만 읽어 줍니다.</p>
    </div>

    <div class="card">
      <h2>🔁 동사 시제 변화</h2>
      <p class="desc">같은 동사·같은 시제에서 인칭만 바꾼 진짜 활용형이 보기로 나옵니다.</p>
      <div class="row">
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
      <button class="btn secondary" id="vStart">동사 변화 풀기</button>
    </div>
  </div>`;

  const partSel = $('#gPart');
  async function fillParts() {
    const data = await DATA.lingq(s.guide);
    const parts = data.parts;
    partSel.innerHTML = `<option value="-1">전체 (${parts.reduce((a, p) => a + p.questions.length, 0)}문항)</option>` +
      parts.map((p, i) => `<option value="${i}" ${s.part === i ? 'selected' : ''}>${esc(p.part)} ${esc(p.title)} (${p.questions.length})</option>`).join('');
    const gcode = GUIDE_CODE[s.guide] || 'en-GB';
    let sample = '';
    for (const p of parts) {
      for (const q of p.questions) {
        sample = nativeFrom(q.q, gcode) || nativeFrom(q.a, gcode);
        if (sample) break;
      }
      if (sample) break;
    }
    fillVoiceLine($('#gVoice'), gcode, sample.slice(0, 90) || CODE_KO[gcode]);
  }
  await fillParts();
  $('#gGuide').onchange = e => { s.guide = e.target.value; s.part = -1; fillParts(); };
  partSel.onchange = e => { s.part = Number(e.target.value); };
  $$('#gN .chip').forEach(c => c.onclick = () => { s.n = Number(c.dataset.n); $$('#gN .chip').forEach(x => x.classList.toggle('on', x === c)); });
  $$('#vTense .chip').forEach(c => c.onclick = () => { s.tense = Number(c.dataset.t); $$('#vTense .chip').forEach(x => x.classList.toggle('on', x === c)); });
  $$('#vN .chip').forEach(c => c.onclick = () => { s.vn = Number(c.dataset.n); $$('#vN .chip').forEach(x => x.classList.toggle('on', x === c)); });
  $('#vVol').onchange = e => { s.vol = Number(e.target.value); };
  $('#vLang').onchange = e => { s.lang = Number(e.target.value); };

  const runGrammar = async () => {
    const data = await DATA.lingq(s.guide);
    let pool = [];
    data.parts.forEach((p, pi) => {
      if (s.part >= 0 && pi !== s.part) return;
      p.questions.forEach((q, qi) => pool.push({ p, q, pi, qi }));
    });
    if (!pool.length) return alert('이 파트에는 문제가 없어요.');
    const picked = sample(pool, s.n);
    const gcode = GUIDE_CODE[s.guide] || 'en-GB';
    const gname = CODE_KO[gcode];
    const items = picked.map(({ p, q, pi, qi }) => {
      const sq = nativeFrom(q.q, gcode), sa = nativeFrom(q.a, gcode);
      return {
      kind: 'self',
      title: data.label,
      prompt: `<div class="qtext" style="font-size:16px">${rich(q.q)}</div>`,
      sub: `<span style="color:var(--ink3)">${esc(p.part)} · ${esc(p.title)}</span>`,
      answer: `<div class="answers-inline">${rich(q.a)}</div>`,
      why: q.why ? rich(q.why) : '',
      sayPrompt: sq ? { t: sq, c: gcode, n: gname } : null,
      sayAnswer: sa ? { t: sa, c: gcode, n: gname } : null,
      key: `${s.guide}:${pi}:${qi}`
      };
    });
    lastBuilder = runGrammar;
    startQuiz({ title: `${data.label} 문법`, mode: 'gram', items });
  };

  const runVerb = async () => {
    const [meta, rows, lang] = await Promise.all([DATA.verbMeta(), DATA.verbItems(s.vol), DATA.verbLang(s.vol, s.lang)]);
    const lname = (meta.langs.find(l => l.no === s.lang) || {}).ko || '';
    const pool = rows.map((r, i) => i).filter(i => (s.tense < 0 || rows[i][3] === meta.tenses[s.tense]) && lang[i] && lang[i][0]);
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
        title: `${s.vol}권 · ${lname}`,
        prompt: `<div class="qtext"><span class="big">${esc(showEn ? en : ko)}</span></div>`,
        sub: `<b>${esc(verbEn)}</b> ${esc(verbKo)} · ${esc(tense)} · ${esc(person)} — ${esc(lname)}로?`,
        sayPrompt: showEn ? { t: en, c: 'en-GB', n: '영어' } : null,
        opts: optsRaw.map(j => ({ html: `<b>${esc(lang[j][0])}</b>`, note: esc(pronText(lang[j][1])), say: { t: lang[j][0], c: vcode, n: lname } })),
        correct: optsRaw.indexOf(i),
        sayAnswer: { t: correct, c: vcode, n: lname },
        why: '',
        key: `v${s.vol}:${s.lang}:${i}`
      };
    });
    lastBuilder = runVerb;
    startQuiz({ title: `동사 변화 · ${lname}`, mode: 'verb', items });
  };

  $('#gStart').onclick = runGrammar;
  $('#vStart').onclick = runVerb;
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
go('grammar');
