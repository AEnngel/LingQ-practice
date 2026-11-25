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

const SET = Object.assign({ pron: true, tone: true }, store.get('settings', {}));
function saveSet() { store.set('settings', SET); }

const MODE_NAME = { words: '단어', sent: '내 문장', gram: '문법 연습', verb: '동사 변화' };

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
      return `<button class="${cls}" data-opt="${i}" ${q.revealed ? 'disabled' : ''}>
        <span class="k">${'ABCD'[i]}</span>
        <span class="v">${o.html}${o.note ? `<em>${o.note}</em>` : ''}</span>
      </button>`;
    }).join('')}</div>`;
  }

  let body = '';
  if (q.revealed) {
    const a = it.kind === 'mc' ? it.opts[it.correct].html : it.answer;
    body = `<div class="answerbox">
        <div class="lbl">정답</div>
        <div class="body">${a}</div>
        ${it.why ? `<div class="why">${it.why}</div>` : ''}
      </div>`;
    if (it.extra) body += `<div class="note-line">${it.extra}</div>`;
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
    <div class="card">
      <div class="qtext">${it.prompt}</div>
      ${it.sub ? `<div class="qsub">${it.sub}</div>` : ''}
      ${opts}
      ${body}
    </div>
    <div class="row"><button class="btn plain sm" data-quit="1">그만두기</button></div>
  </div>`;

  $$('[data-opt]', app).forEach(b => b.onclick = () => pickOption(Number(b.dataset.opt)));
  const rv = $('[data-reveal]', app); if (rv) rv.onclick = () => { q.revealed = true; renderQuiz(); };
  const nx = $('[data-next]', app); if (nx) nx.onclick = nextQuestion;
  $$('[data-self]', app).forEach(b => b.onclick = () => selfGrade(b.dataset.self === '1'));
  const qt = $('[data-quit]', app); if (qt) qt.onclick = () => { if (confirm('그만둘까요? 지금까지의 결과는 저장되지 않아요.')) { state.quiz = null; go(state.tab); } };
}

function pickOption(i) {
  const q = state.quiz, it = q.items[q.idx];
  if (q.revealed) return;
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
  q.idx += 1; q.revealed = false; q.picked = -1;
  renderQuiz();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* 오답 노트에 그대로 다시 넣을 수 있는 형태로 저장 */
function payloadOf(it) {
  if (it.kind === 'card') {
    return { key: it.key, kind: 'card', title: it.title || '', prompt: it.front.html,
      answer: it.back.html, opts: [], correct: -1, why: '', extra: '', sub: '' };
  }
  return {
    key: it.key || (it.prompt + '|' + (it.answer || '')).slice(0, 120),
    kind: it.kind, prompt: it.prompt, sub: it.sub || '', opts: it.opts || [],
    correct: it.correct == null ? -1 : it.correct, answer: it.answer || '',
    why: it.why || '', extra: it.extra || '', title: it.title || ''
  };
}
function itemFromPayload(p) {
  if (p.kind === 'card') {
    return { kind: 'card', title: p.title, key: p.key,
      front: { html: p.prompt, note: '' }, back: { html: p.answer } };
  }
  return { kind: p.kind === 'self' ? 'self' : 'mc', prompt: p.prompt, sub: p.sub, opts: p.opts,
    correct: p.correct, answer: p.answer, why: p.why, extra: p.extra, key: p.key, title: p.title };
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
  app.innerHTML = `<div class="screen">
    <div class="qhead">
      <span class="badge">${esc(q.title)}</span>
      <span class="pct mono">${q.idx + 1} / ${q.items.length}</span>
    </div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <div class="flash">
      <div class="flashcard ${reveal ? 'flipped' : ''}" data-flip="1">
        <div>
          <div class="front-label">${reveal ? '뒤' : '앞'}</div>
          <div class="bigtext">${reveal ? back.html : front.html}</div>
          ${reveal ? '' : front.note || ''}
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
      <p class="subnote">정답·해설은 가이드 원문 그대로입니다.</p>
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
    const data = await DATA.lingq(g.key);
    const parts = data.parts;
    partSel.innerHTML = `<option value="-1">전체 (${parts.reduce((a, p) => a + p.questions.length, 0)}문항)</option>` +
      parts.map((p, i) => `<option value="${i}" ${s.part === i ? 'selected' : ''}>${esc(p.part)} ${esc(p.title)} (${p.questions.length})</option>`).join('');
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
    const items = picked.map(({ p, q, pi, qi }) => ({
      kind: 'self',
      title: data.label,
      prompt: `<div class="qtext" style="font-size:16px">${rich(q.q)}</div>`,
      sub: `<span style="color:var(--ink3)">${esc(p.part)} · ${esc(p.title)}</span>`,
      answer: `<div class="answers-inline">${rich(q.a)}</div>`,
      why: q.why ? rich(q.why) : '',
      key: `${s.guide}:${pi}:${qi}`
    }));
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
        opts: optsRaw.map(j => ({ html: `<b>${esc(lang[j][0])}</b>`, note: esc(pronText(lang[j][1])) })),
        correct: optsRaw.indexOf(i),
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
      <p class="subnote">주제를 고르지 않으면 범위 전체에서 무작위로 나옵니다.</p>
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
  $('#wLang').onchange = e => { s.lang = Number(e.target.value); };
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
      let quizItems;
      if (s.mode === 'card') {
        quizItems = picked.map(i => {
          const [b, gi, ko, en] = items[i];
          const [nat, pron] = lang[i];
          return {
            kind: 'card',
            title: `${lname}`,
            front: { html: `${esc(ko)}`, note: `<div class="hint">${esc(en)}</div>` },
            back: { html: `${esc(nat)}${pronLine(pron)}<div class="trans">${esc(ko)}</div>` },
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
            opts: optsRaw.map(o => ({ html: `<b>${esc(lang[o.j][0])}</b>`, note: pronText(lang[o.j][1]) ? esc(pronText(lang[o.j][1])) : '' })),
            correct: correctIdx,
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
  $('#sLang').onchange = e => { s.lang = Number(e.target.value); };
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
            back: { html: `${esc(nat)}${pronLine(pron)}<div class="trans">${esc(en)}</div><div class="trans" style="font-size:14px;color:var(--ink2)">${esc(ko)}</div>` },
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
            opts: optsRaw.map(o => ({ html: esc(items[o.i][3]) })),
            correct: correctIdx, why: '',
            extra: pronLine(pron) ? `<b>${esc(nat)}</b> ${pronLine(pron)}` : '',
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
            opts: optsRaw.map(o => ({ html: esc(items[o.i][2]) })),
            correct: correctIdx, why: '',
            extra: pronLine(pron) ? `${esc(nat)} ${pronLine(pron)}` : '',
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
          opts: optsRaw.map(o => ({ html: `<b>${esc((lang[o.i] || [''])[0])}</b>`, note: esc(pronText((lang[o.i] || [])[1])) })),
          correct: correctIdx, why: '',
          extra: pronLine(pron) ? `${esc(nat)} ${pronLine(pron)}` : '',
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
