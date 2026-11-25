/* 눈으로 감정 읽기 · RMET 78개 감정 단어 · 7개 언어 퀴즈 & 카드 */
(function () {
  'use strict';

  var DATA = window.RMET_DATA || { langs: [], words: [] };
  var LANGS = DATA.langs;
  var WORDS = DATA.words;
  var LANG = {};
  LANGS.forEach(function (l) { LANG[l.code] = l; });

  var LS_STAR = 'rmet.star.v1';
  var LS_SET = 'rmet.settings.v1';

  /* ------------------------------------------------------------ helpers */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function shuffle(a) {
    var r = a.slice();
    for (var i = r.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = r[i]; r[i] = r[j]; r[j] = t;
    }
    return r;
  }
  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ------------------------------------------------------------ storage */
  function load(key, dflt) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return dflt;
      var v = JSON.parse(raw);
      return v == null ? dflt : v;
    } catch (e) { return dflt; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  var stars = {};
  (load(LS_STAR, []) || []).forEach(function (n) { stars[n] = 1; });
  function starOn(n) { return !!stars[n]; }
  function setStar(n, on) {
    if (on) stars[n] = 1; else delete stars[n];
    save(LS_STAR, Object.keys(stars).map(Number));
    refreshStarCount();
  }
  function starList() { return WORDS.filter(function (w) { return starOn(w.n); }); }
  function refreshStarCount() {
    var el = $('starCount');
    if (el) el.textContent = String(starList().length);
  }

  var settings = {
    lang: 'en', mode: 'fk', scope: 'all', autoSpeak: true, autoNext: true,
    filter: 'all', playLang: 'all', speed: 1
  };
  var savedSet = load(LS_SET, {}) || {};
  Object.keys(settings).forEach(function (k) {
    if (savedSet[k] !== undefined) settings[k] = savedSet[k];
  });
  function saveSettings() { save(LS_SET, settings); }

  /* ---------------------------------------------------------------- TTS */
  var VOICE_GOOD = ['enhanced', 'premium', 'siri', 'natural', 'neural', 'online', 'google'];
  var VOICE_BAD = ['compact', 'eloquence', 'espeak', 'pico'];
  var VOICE_ROBOT = ['sandy', 'shelley', 'eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko',
    'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news', 'jester',
    'organ', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox', 'fred', 'junior', 'ralph',
    'kathy', 'karen'];
  var UK_NAMES = ['daniel', 'oliver', 'arthur', 'kate', 'serena', 'martha', 'stephanie',
    'libby', 'sonia', 'ryan', 'maisie', 'google uk english'];

  /* 언어별 음성 후보 사슬 — 앞에 있을수록 우선. 고전 라틴어는 이탈리아어 음성으로 읽는다 */
  var VOICE_CHAIN = {
    'en-GB': ['en-GB', 'en-IE', 'en-AU', 'en-US'],
    'it-IT': ['it-IT', 'it-CH'],
    'pt-PT': ['pt-PT', 'pt-BR'],
    'fr-FR': ['fr-FR', 'fr-CA', 'fr-BE'],
    'es-ES': ['es-ES', 'es-US', 'es-MX'],
    'de-DE': ['de-DE', 'de-AT', 'de-CH']
  };
  var BASE_RATE = { 'en-GB': 0.93, 'it-IT': 0.95, 'pt-PT': 0.94, 'fr-FR': 0.95, 'es-ES': 0.95, 'de-DE': 0.9 };

  var cachedVoices = [];
  var speakTimer = null;
  var wdTimer = null;
  var speakToken = 0;
  var lastVoiceInfo = '';
  var missingVoiceLangs = {};

  function normLang(s) { return String(s || '').toLowerCase().replace(/_/g, '-'); }
  function tokens(name) {
    return String(name || '').toLowerCase().replace(/[^a-z\u00a0-\u024f]+/g, ' ').trim().split(' ').filter(Boolean);
  }
  function isRobot(name) {
    var t = tokens(name);
    if (!t.length) return false;
    var joined = ' ' + t.join(' ') + ' ';
    for (var i = 0; i < VOICE_ROBOT.length; i++) {
      var k = VOICE_ROBOT[i];
      if (k.indexOf(' ') !== -1) { if (joined.indexOf(' ' + k + ' ') !== -1) return true; }
      else if (t.indexOf(k) !== -1) return true;
    }
    return false;
  }
  function isUkName(name) {
    var n = String(name || '').toLowerCase();
    for (var i = 0; i < UK_NAMES.length; i++) if (n.indexOf(UK_NAMES[i]) !== -1) return true;
    return false;
  }
  function quality(name) {
    var n = String(name || '').toLowerCase();
    var s = 0;
    if (isRobot(n)) s -= 100;
    for (var i = 0; i < VOICE_GOOD.length; i++) if (n.indexOf(VOICE_GOOD[i]) !== -1) s += 10;
    for (var j = 0; j < VOICE_BAD.length; j++) if (n.indexOf(VOICE_BAD[j]) !== -1) s -= 30;
    return s;
  }
  function allVoices() {
    if (!('speechSynthesis' in window)) return [];
    var list = window.speechSynthesis.getVoices() || [];
    if (list.length) { cachedVoices = list; return list; }
    return cachedVoices || [];
  }
  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    var list = window.speechSynthesis.getVoices() || [];
    if (list.length) cachedVoices = list;
    refreshVoiceSummary();
  }
  function initVoices() {
    if (!('speechSynthesis' in window)) return;
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }
    setTimeout(loadVoices, 300);
    setTimeout(loadVoices, 1200);
    setTimeout(loadVoices, 2500);
  }

  /* 목표 언어에 맞는 음성을 고른다. 로봇·축약 음성은 크게 감점하고 영국식 이름을 우대한다 */
  function pickVoice(target) {
    var voices = allVoices();
    if (!voices.length) return null;
    var chain = VOICE_CHAIN[target] || [target];
    var best = null, bestScore = -1e9, bestRank = 99;
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      var vl = normLang(v.lang);
      var vName = String(v.name || '');
      var rank = -1;
      for (var j = 0; j < chain.length; j++) {
        if (vl === normLang(chain[j])) { rank = j; break; }
      }
      if (rank < 0 && target === 'en-GB' && vl.indexOf('en') === 0 && isUkName(vName)) rank = 1;
      if (rank < 0) continue;
      var sc = (100 - rank * 22) + quality(vName);
      if (sc > bestScore) { bestScore = sc; best = v; bestRank = rank; }
    }
    if (!best) return null;
    return { voice: best, exact: bestRank === 0, rank: bestRank };
  }

  /* 낭독용 문자열 정리: 괄호 설명·성별 표시만 걷어내고 남성/여성/중성 어형을 모두 순서대로 읽는다 */
  function speechText(raw) {
    var t = String(raw || '');
    t = t.replace(/\([^)]*\)/g, ' ');
    t = t.replace(/\[[^\]]*\]/g, ' ');
    t = t.replace(/\s*\/\s*/g, ', ');
    t = t.replace(/[·|]/g, ', ').replace(/\s+/g, ' ').trim();
    t = t.replace(/[.,;:]+$/, '');
    return t;
  }

  function unlockAudio() {
    if (!('speechSynthesis' in window)) return;
    try {
      var u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch (e) {}
    setTimeout(loadVoices, 250);
  }

  function clearWatchdog() { if (wdTimer) { clearTimeout(wdTimer); wdTimer = null; } }

  /* 음성 1회 재생. 성공하면 true, 해당 언어 음성이 없으면 false */
  function speakOne(rawText, ttsCode, mult, onEnd) {
    if (!('speechSynthesis' in window)) { toast('이 브라우저는 음성 재생을 지원하지 않습니다.'); return false; }
    var pick = pickVoice(ttsCode);
    var text = speechText(rawText);
    if (!text) return false;
    if (!pick && !allVoices().length) {
      /* 아이폰은 첫 터치 뒤에야 목소리 목록이 채워진다 — 잠시 뒤 한 번만 다시 시도 */
      loadVoices();
      setTimeout(function () {
        if (pickVoice(ttsCode)) speakOne(rawText, ttsCode, mult, onEnd);
        else toast('음성 목록을 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.');
      }, 420);
      return true;
    }
    if (!pick) { missingVoiceLangs[ttsCode] = 1; return false; }
    delete missingVoiceLangs[ttsCode];
    var token = ++speakToken;
    if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
    clearWatchdog();
    try { window.speechSynthesis.cancel(); } catch (e) {}
    var rate = clamp((BASE_RATE[ttsCode] || 0.93) * (mult || 1), 0.35, 2);
    speakTimer = setTimeout(function () {
      speakTimer = null;
      if (token !== speakToken) return;
      var u = new SpeechSynthesisUtterance(text);
      try { u.voice = pick.voice; } catch (e) {}
      u.lang = pick.voice.lang || ttsCode;
      u.rate = rate;
      u.pitch = 1;
      u.onend = function () {
        if (token !== speakToken) return;
        clearWatchdog();
        if (onEnd) onEnd();
      };
      u.onerror = function (ev) {
        if (token !== speakToken) return;
        var err = ev && ev.error ? String(ev.error) : '';
        if (err === 'canceled' || err === 'interrupted') return;
        clearWatchdog();
        if (onEnd) onEnd();
      };
      try { window.speechSynthesis.speak(u); } catch (e) {
        if (onEnd) onEnd();
      }
      var est = (900 + text.length * 300) / rate + 4000;
      wdTimer = setTimeout(function () {
        if (token !== speakToken) return;
        try { window.speechSynthesis.cancel(); } catch (e) {}
        if (onEnd) onEnd();
      }, est);
    }, 70);
    return true;
  }

  function stopSpeaking(silent) {
    speakToken++;
    if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
    clearWatchdog();
    try { window.speechSynthesis.cancel(); } catch (e) {}
    if (!silent) clearSpeakingHighlight();
  }

  function clearSpeakingHighlight() {
    var rows = document.querySelectorAll('.langrow.speaking');
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove('speaking');
  }

  function speakWord(langCode, item, mult) {
    if (!item) return;
    var L = LANG[langCode];
    if (!L) return;
    stopPlaying(false);
    var ok = speakOne(item.w, L.tts, mult || 1);
    if (!ok) toast(L.name + ' 음성이 이 기기에 없습니다 (설정 > 손쉬운 사용 > 말하기 콘텐츠 > 음성).');
  }

  function refreshVoiceSummary() {
    var el = $('voiceSummary');
    if (!el) return;
    if (!('speechSynthesis' in window)) { el.textContent = '이 브라우저는 음성 재생을 지원하지 않습니다.'; return; }
    if (!allVoices().length) { el.textContent = '음성 목록을 불러오는 중… (아이폰은 첫 터치 뒤 준비됩니다)'; return; }
    var ok = [], miss = [];
    LANGS.forEach(function (L) {
      var p = pickVoice(L.tts);
      if (p) ok.push(L.flag + ' ' + L.name + (p.exact ? '' : ' (' + p.voice.name + ' 대체)'));
      else miss.push(L.flag + ' ' + L.name);
    });
    el.textContent = '사용 가능: ' + ok.join(' · ') + (miss.length ? ' / 미설치: ' + miss.join(', ') : '');
  }

  function showVoiceDiag() {
    var voices = allVoices();
    var lines = ['[음성 엔진 진단]', '기기 전체 목소리: ' + voices.length + '개'];
    LANGS.forEach(function (L) {
      var p = pickVoice(L.tts);
      lines.push(L.name + ' (' + L.tts + '): ' + (p ? p.voice.name + ' [' + p.voice.lang + ']' : '없음'));
    });
    lines.push('', '목소리가 없으면 아이폰 설정 > 손쉬운 사용 > 말하기 콘텐츠 > 음성에서 해당 언어를 받으세요.');
    alert(lines.join('\n'));
  }

  /* ------------------------------------------------------------- ranges */
  var RANGES = { b1: [1, 20], b2: [21, 40], b3: [41, 60], b4: [61, 78] };
  function scopeWords(scope) {
    if (scope === 'star') return starList();
    if (RANGES[scope]) {
      var r = RANGES[scope];
      return WORDS.filter(function (w) { return w.n >= r[0] && w.n <= r[1]; });
    }
    return WORDS.slice();
  }
  function randLang() { return LANGS[Math.floor(Math.random() * LANGS.length)].code; }

  /* ------------------------------------------------------------ display */
  function genderOf(noun) {
    var m = String(noun || '').match(/\[(남|여|중)\]/);
    return m ? m[1] : '';
  }
  function nounHTML(item) {
    if (!item) return '';
    var noun = String(item.noun || '').trim();
    if (!noun) return '';
    var g = genderOf(noun);
    var base = noun.replace(/\s*\[(남|여|중)\]/g, '').trim();
    var isVerbForm = /^동사형/.test(base);
    var html = '';
    if (isVerbForm) {
      html = '동사형 <b>' + esc(base.replace(/^동사형\s*/, '')) + '</b>';
    } else {
      html = '명사 <b>' + esc(base) + '</b>' + (g ? '<span class="g ' + g + '">' + g + '</span>' : '');
    }
    if (item.np) html += ' · ' + esc(item.np);
    return html;
  }

  /* ---------------------------------------------------------------- tabs */
  function showTab(name) {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === name);
    $('screen-quiz').classList.toggle('hidden', name !== 'quiz');
    $('screen-cards').classList.toggle('hidden', name !== 'cards');
    if (name === 'cards') renderCard();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
  });

  $('btnStarTop').addEventListener('click', function () {
    settings.filter = 'star'; saveSettings();
    renderCardFilter(); showTab('cards');
    if (!starList().length) toast('별표 복습함이 비어 있습니다. 카드에서 ⭐를 눌러 담으세요.');
  });

  /* ================================================================ QUIZ */
  var quiz = null;

  function renderLangChips() {
    var box = $('langChips');
    var html = '<button class="chip" data-lang="all">🎲 7개 언어 랜덤</button>';
    LANGS.forEach(function (L) {
      html += '<button class="chip" data-lang="' + L.code + '"><span class="fl">' + L.flag + '</span>' + esc(L.name) + '</button>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.chip').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === settings.lang);
      b.addEventListener('click', function () {
        settings.lang = b.getAttribute('data-lang'); saveSettings(); renderLangChips(); updateStartHint();
      });
    });
  }
  function renderModeChips() {
    var box = $('modeChips');
    box.querySelectorAll('.chip').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-mode') === settings.mode);
      b.onclick = function () { settings.mode = b.getAttribute('data-mode'); saveSettings(); renderModeChips(); };
    });
  }
  function renderScopeChips() {
    var box = $('scopeChips');
    box.querySelectorAll('.chip').forEach(function (b) {
      var sc = b.getAttribute('data-scope');
      b.classList.toggle('on', sc === settings.scope);
      if (sc === 'star') {
        var n = starList().length;
        b.innerHTML = '⭐ 별표만' + (n ? ' <span class="n">' + n + '</span>' : '');
      }
      b.onclick = function () {
        settings.scope = sc; saveSettings(); renderScopeChips(); updateStartHint();
      };
    });
  }
  function updateStartHint() {
    var pool = scopeWords(settings.scope);
    var el = $('quizHint');
    var langTxt = settings.lang === 'all' ? '7개 언어 랜덤' : LANG[settings.lang].flag + ' ' + LANG[settings.lang].name;
    var typeTxt = settings.mode === 'fk' ? '외국어 → 한국어 뜻' : '한국어 뜻 → 외국어';
    el.textContent = pool.length + '문제 · ' + langTxt + ' · ' + typeTxt + (pool.length < 4 ? ' · (보기 4개를 채우려 전체 단어를 함께 씁니다)' : '');
  }

  function refreshSettingsUI() {
    $('optAutoSpeak').checked = !!settings.autoSpeak;
    $('optAutoNext').checked = !!settings.autoNext;
    renderLangChips(); renderModeChips(); renderScopeChips(); updateStartHint();
    refreshVoiceSummary();
  }

  $('optAutoSpeak').addEventListener('change', function () {
    settings.autoSpeak = this.checked; saveSettings();
  });
  $('optAutoNext').addEventListener('change', function () {
    settings.autoNext = this.checked; saveSettings();
  });
  $('btnVoiceDiag').addEventListener('click', showVoiceDiag);

  function showQuizPanel(which) {
    $('quizSetup').classList.toggle('hidden', which !== 'setup');
    $('quizPlay').classList.toggle('hidden', which !== 'play');
    $('quizDone').classList.toggle('hidden', which !== 'done');
  }

  $('btnStartQuiz').addEventListener('click', function () {
    startQuiz(null);
  });

  function startQuiz(pool) {
    var words = pool && pool.length ? pool : scopeWords(settings.scope);
    if (!words.length) {
      toast('별표 복습함이 비어 있습니다. 단어 카드에서 ⭐를 눌러 담아 두세요.');
      return;
    }
    quiz = {
      words: words.slice(),
      queue: shuffle(words).map(function (w) {
        return { w: w, lang: settings.lang === 'all' ? randLang() : settings.lang };
      }),
      i: 0, right: 0, wrong: [], answered: false, timer: null
    };
    showQuizPanel('play');
    window.scrollTo(0, 0);
    renderQuestion();
  }

  function optionTexts() {
    var q = quiz.queue[quiz.i], w = q.w;
    var pool = quiz.words.length >= 4 ? quiz.words : WORDS;
    var correct = settings.mode === 'fk' ? w.ko : w[q.lang].w;
    var seen = {};
    seen[correct] = 1;
    var others = shuffle(pool).map(function (x) {
      return settings.mode === 'fk' ? x.ko : x[q.lang].w;
    }).filter(function (t) {
      if (!t || seen[t]) return false;
      seen[t] = 1;
      return true;
    });
    var opts = [correct].concat(others.slice(0, 3));
    return { correct: correct, options: shuffle(opts) };
  }

  function renderQuestion() {
    if (!quiz) return;
    var q = quiz.queue[quiz.i], w = q.w, L = LANG[q.lang];
    quiz.answered = false;
    $('qIndex').textContent = String(quiz.i + 1);
    $('qTotal').textContent = String(quiz.queue.length);
    $('qScore').textContent = String(quiz.right);
    $('qWrong').textContent = String(quiz.wrong.length);
    $('qProgress').style.width = (quiz.i / quiz.queue.length * 100) + '%';

    $('qLang').innerHTML = '<span class="fl">' + L.flag + '</span> ' + esc(L.name) + (L.note ? ' · ' + esc(L.note) : '');
    $('qTypeLabel').textContent = settings.mode === 'fk' ? '이 단어의 뜻은?' : '이 뜻의 단어는?';

    var prompt = $('qPrompt'), sub = $('qPromptSub');
    if (settings.mode === 'fk') {
      prompt.className = 'qprompt';
      prompt.textContent = w[q.lang].w;
      sub.textContent = '';
    } else {
      prompt.className = 'qprompt ko';
      prompt.textContent = w.ko;
      sub.textContent = '';
    }

    var made = optionTexts();
    var box = $('qOptions');
    box.innerHTML = made.options.map(function (t, i) {
      return '<button class="option" data-opt="' + esc(t) + '"><span class="num">' + (i + 1) + '</span><span>' + esc(t) + '</span></button>';
    }).join('');
    box.querySelectorAll('.option').forEach(function (b) {
      b.addEventListener('click', function () { answerWith(b.getAttribute('data-opt'), b); });
    });

    $('qAnswer').classList.add('hidden');
    $('btnNextQ').disabled = true;
    $('btnNextQ').textContent = quiz.i + 1 >= quiz.queue.length ? '결과 보기' : '다음 문제';
    $('qAudioRow').classList.toggle('hidden', settings.mode !== 'fk');

    if (settings.autoSpeak && settings.mode === 'fk') {
      setTimeout(function () {
        if (!quiz || quiz.answered || quiz.queue[quiz.i] !== q) return;
        speakOne(w[q.lang].w, L.tts, 1);
      }, 320);
    }
  }

  function answerWith(pick, btn) {
    if (!quiz || quiz.answered) return;
    quiz.answered = true;
    var q = quiz.queue[quiz.i], w = q.w, L = LANG[q.lang];
    var correctText = settings.mode === 'fk' ? w.ko : w[q.lang].w;
    var isRight = pick === correctText;

    var nodes = document.querySelectorAll('#qOptions .option');
    for (var i = 0; i < nodes.length; i++) {
      var t = nodes[i].getAttribute('data-opt');
      nodes[i].disabled = true;
      if (t === correctText) nodes[i].classList.add('right');
      else if (t === pick) nodes[i].classList.add('wrongpick');
      else nodes[i].classList.add('dim');
    }

    if (isRight) quiz.right++;
    else {
      quiz.wrong.push({ w: w, lang: q.lang });
      if (!starOn(w.n)) { setStar(w.n, true); }
      renderScopeChips();
    }

    var card = $('qAnswer');
    card.classList.remove('hidden');
    card.classList.toggle('bad', !isRight);
    $('ansResult').textContent = isRight ? '⭕ 정답!' : '❌ 오답 — 초록색이 정답';

    $('ansWord').textContent = w[q.lang].w;
    $('ansPron').textContent = w[q.lang].p ? '발음 ' + w[q.lang].p : '';
    $('ansNoun').innerHTML = nounHTML(w[q.lang]) ? esc(L.name) + ' · ' + nounHTML(w[q.lang]) : '';
    $('ansKtx').textContent = '뜻: ' + w.ko;

    var starBtn = $('btnAnsStar');
    starBtn.textContent = starOn(w.n) ? '★ 별표에 있음' : '☆ 별표 담기';
    starBtn.onclick = function () {
      setStar(w.n, !starOn(w.n));
      starBtn.textContent = starOn(w.n) ? '★ 별표에 있음' : '☆ 별표 담기';
      renderScopeChips();
      toast(starOn(w.n) ? '⭐ 별표 복습함에 담았습니다' : '별표에서 뺐습니다');
    };
    $('btnAnsSpeak').onclick = function () { speakOne(w[q.lang].w, L.tts, 1); };
    $('btnAnsSlow').onclick = function () { speakOne(w[q.lang].w, L.tts, 0.62); };
    $('btnAnsNounSpeak').onclick = function () {
      var t = speechText(w[q.lang].noun).replace(/^(동사형|명사)\s*/, '');
      if (!t) { toast('이 단어에는 명사형이 없습니다'); return; }
      speakOne(t, L.tts, 1);
    };

    $('qScore').textContent = String(quiz.right);
    $('qWrong').textContent = String(quiz.wrong.length);
    $('btnNextQ').disabled = false;

    /* 해설이 탭바에 가리면 필요한 만큼만 올린다 */
    setTimeout(function () {
      var r = card.getBoundingClientRect();
      var need = r.bottom - (window.innerHeight - 78);
      if (need > 0) window.scrollTo({ top: window.scrollY + need + 10, behavior: 'smooth' });
    }, 80);

    if (settings.autoSpeak) {
      setTimeout(function () { speakOne(w[q.lang].w, L.tts, 1); }, 180);
    }

    clearTimeout(quiz.timer);
    if (settings.autoNext) {
      var delay = isRight ? 2000 : 3200;
      quiz.timer = setTimeout(function () { if (quiz && quiz.answered) nextQuestion(); }, delay);
    }
  }

  function nextQuestion() {
    if (!quiz) return;
    clearTimeout(quiz.timer);
    stopSpeaking(false);
    if (quiz.i + 1 >= quiz.queue.length) { finishQuiz(); return; }
    quiz.i++;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderQuestion();
  }
  $('btnNextQ').addEventListener('click', nextQuestion);
  $('btnRepeat').addEventListener('click', function () {
    if (!quiz) return;
    var q = quiz.queue[quiz.i], w = q.w;
    speakOne(w[q.lang].w, LANG[q.lang].tts, 1);
  });
  $('btnSlow').addEventListener('click', function () {
    if (!quiz) return;
    var q = quiz.queue[quiz.i], w = q.w;
    speakOne(w[q.lang].w, LANG[q.lang].tts, 0.62);
  });
  $('btnQuitQuiz').addEventListener('click', function () {
    clearTimeout(quiz && quiz.timer);
    stopSpeaking(false);
    quiz = null;
    showQuizPanel('setup');
    refreshSettingsUI();
  });

  function finishQuiz() {
    var total = quiz.queue.length, right = quiz.right, wrong = quiz.wrong.length;
    var rate = total ? Math.round(right / total * 100) : 0;
    $('doneTitle').textContent = rate === 100 ? '🎉 전부 정답!' : '퀴즈 완료';
    $('doneDesc').textContent = total + '문제를 마쳤습니다.' + (wrong ? ' 틀린 ' + wrong + '개는 별표 복습함에 담았습니다.' : '');
    $('doneScore').textContent = String(right);
    $('doneWrong').textContent = String(wrong);
    $('doneRate').textContent = rate + '%';
    var list = $('doneWrongList');
    if (!wrong) {
      $('doneWrongCard').classList.add('hidden');
    } else {
      $('doneWrongCard').classList.remove('hidden');
      list.innerHTML = quiz.wrong.map(function (x) {
        var L = LANG[x.lang];
        return '<div class="langrow"><div class="lhead"><span class="lname">' + L.flag + ' ' + esc(L.name) + '</span></div>' +
          '<div class="lword">' + esc(x.w[x.lang].w) + '</div>' +
          '<div class="lpron">' + esc(x.w[x.lang].p) + '</div>' +
          '<div class="lnoun">' + esc(x.w.ko) + '</div></div>';
      }).join('');
    }
    var wrongPool = quiz.wrong.map(function (x) { return x.w; });
    $('btnRetryWrong').classList.toggle('hidden', !wrongPool.length);
    $('btnRetryWrong').onclick = function () { startQuiz(wrongPool); };
    $('btnRetrySame').onclick = function () { startQuiz(quiz.words); };
    $('btnBackSetup').onclick = function () { quiz = null; showQuizPanel('setup'); refreshSettingsUI(); };
    showQuizPanel('done');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* =============================================================== CARDS */
  var cardIdx = 0;
  var searchTerm = '';

  function matchWord(w, q) {
    if (w.ko.toLowerCase().indexOf(q) !== -1) return true;
    if (w.en.w.toLowerCase().indexOf(q) !== -1) return true;
    if ((w.en.p || '').indexOf(q) !== -1) return true;
    for (var i = 0; i < LANGS.length; i++) {
      var o = w[LANGS[i].code];
      if (!o) continue;
      if (String(o.w || '').toLowerCase().indexOf(q) !== -1) return true;
      if (String(o.p || '').indexOf(q) !== -1) return true;
    }
    return false;
  }
  function filteredWords() {
    var base = settings.filter === 'star' ? starList() : WORDS.slice();
    var q = searchTerm.trim().toLowerCase();
    if (!q) return base;
    return base.filter(function (w) { return matchWord(w, q); });
  }
  function renderCardFilter() {
    var box = $('cardFilter');
    box.querySelectorAll('.chip').forEach(function (b) {
      var f = b.getAttribute('data-filter');
      b.classList.toggle('on', f === settings.filter);
      b.innerHTML = f === 'star' ? '⭐ 별표만 <span class="n">' + starList().length + '</span>' : '전체 78';
      b.onclick = function () { settings.filter = f; saveSettings(); renderCardFilter(); cardIdx = 0; renderCard(); };
    });
  }

  function renderCard() {
    var list = filteredWords();
    if (!list.length) {
      $('cardIndex').textContent = '0 / 0';
      $('cardBody').innerHTML = '<div class="card"><p class="desc">' +
        (settings.filter === 'star' ? '별표 복습함이 비어 있습니다. 퀴즈에서 틀린 단어는 자동으로 담기고, 카드의 ☆ 버튼으로 직접 담을 수도 있습니다.' : '검색 결과가 없습니다.') +
        '</p></div>';
      $('btnPrevCard').disabled = true; $('btnNextCard').disabled = true;
      return;
    }
    if (cardIdx >= list.length) cardIdx = list.length - 1;
    if (cardIdx < 0) cardIdx = 0;
    var w = list[cardIdx];
    $('cardIndex').textContent = (cardIdx + 1) + ' / ' + list.length;
    $('btnPrevCard').disabled = cardIdx === 0;
    $('btnNextCard').disabled = cardIdx >= list.length - 1;
    $('btnCardStar').textContent = starOn(w.n) ? '★ 별표에 있음' : '☆ 별표';

    var html = '<div class="card wcard">';
    html += '<div class="head"><div><div class="wtitle">' + esc(w.en.w) + '</div>' +
      '<div class="wpron">' + esc(w.en.p) + '</div></div>' +
      '<button class="starbtn ' + (starOn(w.n) ? 'on' : '') + '" id="cardStar">' + (starOn(w.n) ? '★' : '☆') + '</button></div>';
    html += '<div class="wko">' + esc(w.ko) + '</div>';
    html += '<div class="wmetaline">#' + w.n + ' · RMET 문항 ' + esc(w.q) + '</div>';
    if (w.ex) html += '<div class="wex">“' + esc(w.ex) + '” <button class="lspk" id="exSpeak" style="margin-left:6px">🔊</button></div>';
    html += '<div class="langlist">';
    LANGS.forEach(function (L) {
      var o = w[L.code];
      if (!o) return;
      html += '<div class="langrow" data-lang="' + L.code + '">' +
        '<div class="lhead"><span class="lname">' + L.flag + ' ' + esc(L.name) + (L.note ? ' · ' + esc(L.note) : '') + '</span>' +
        '<button class="lspk" data-speak="' + L.code + '">🔊</button></div>' +
        '<div class="lword">' + esc(o.w) + '</div>' +
        '<div class="lpron">' + esc(o.p) + '</div>' +
        (o.noun ? '<div class="lnoun">' + nounHTML(o) + '</div>' : '') +
        '</div>';
    });
    html += '</div></div>';
    $('cardBody').innerHTML = html;

    document.querySelectorAll('[data-speak]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var code = b.getAttribute('data-speak');
        speakWord(code, w[code], 1);
      });
    });
    var exBtn = $('exSpeak');
    if (exBtn) exBtn.addEventListener('click', function () { speakOne(w.ex, 'en-GB', 1); });
    $('cardStar').addEventListener('click', function () {
      setStar(w.n, !starOn(w.n));
      renderCard(); renderCardFilter(); renderScopeChips();
      toast(starOn(w.n) ? '⭐ 별표 복습함에 담았습니다' : '별표에서 뺐습니다');
    });
  }

  function moveCard(d) {
    var list = filteredWords();
    if (!list.length) return;
    cardIdx = clamp(cardIdx + d, 0, list.length - 1);
    renderCard();
  }
  $('btnPrevCard').addEventListener('click', function () { moveCard(-1); });
  $('btnNextCard').addEventListener('click', function () { moveCard(1); });
  $('cardSearch').addEventListener('input', function () {
    searchTerm = this.value; cardIdx = 0; renderCard();
  });
  $('btnCardStar').addEventListener('click', function () {
    var list = filteredWords();
    var w = list[cardIdx];
    if (!w) return;
    setStar(w.n, !starOn(w.n));
    renderCard(); renderCardFilter(); renderScopeChips();
  });
  $('btnCardSpeakAll').addEventListener('click', function () {
    var list = filteredWords();
    var w = list[cardIdx];
    if (!w) return;
    startPlayback([w], ['all']);
  });

  /* 카드 스와이프 */
  (function () {
    var sx = 0, sy = 0, tracking = false;
    var body = $('screen-cards');
    body.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    body.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        stopPlaying(false);
        moveCard(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  })();

  /* ------------------------------------------------------------ playback */
  var play = { on: false, list: [], idx: 0, li: 0, langs: ['all'] };

  function renderPlayLang() {
    var sel = $('playLang');
    var html = '<option value="all">7개 언어 차례로</option>';
    LANGS.forEach(function (L) {
      html += '<option value="' + L.code + '">' + L.flag + ' ' + esc(L.name) + '</option>';
    });
    sel.innerHTML = html;
    sel.value = settings.playLang;
    sel.onchange = function () {
      settings.playLang = sel.value; saveSettings();
      if (play.on) startPlayback(play.list, play.langs, play.idx);
    };
  }
  function renderSpeedChips() {
    var box = $('speedChips');
    box.querySelectorAll('.chip').forEach(function (b) {
      b.classList.toggle('on', Number(b.getAttribute('data-speed')) === Number(settings.speed));
      b.onclick = function () {
        settings.speed = Number(b.getAttribute('data-speed')); saveSettings(); renderSpeedChips();
      };
    });
  }

  function startPlayback(list, langs, fromIdx) {
    stopSpeaking(true);
    if (!list || !list.length) { toast('재생할 단어가 없습니다.'); return; }
    play.on = true;
    play.list = list;
    play.idx = fromIdx || 0;
    play.li = 0;
    play.langs = langs && langs.length ? langs : (settings.playLang === 'all' ? ['all'] : [settings.playLang]);
    missingVoiceLangs = {};
    $('btnStopPlay').classList.remove('hidden');
    $('btnPlayAll').textContent = '⏸ 재생 중…';
    pump();
  }
  function stopPlaying(silent) {
    if (play.on) {
      play.on = false;
      stopSpeaking(true);
      clearSpeakingHighlight();
      $('btnPlayAll').textContent = '▶️ 전체 이어 듣기';
      $('btnStopPlay').classList.add('hidden');
      if (!silent) toast('재생을 멈췄습니다');
    }
  }
  function pump() {
    if (!play.on) return;
    if (!allVoices().length) {
      /* 아이폰은 첫 터치 뒤 목소리 목록이 늦게 채워진다 — 잠시 기다린다 */
      play.waitTicks = (play.waitTicks || 0) + 1;
      if (play.waitTicks > 14) {
        play.waitTicks = 0;
        stopPlaying(true);
        toast('기기 음성 목록을 불러오지 못했습니다. 무음 모드를 끄고 다시 시도해 주세요.');
        return;
      }
      loadVoices();
      setTimeout(pump, 220);
      return;
    }
    play.waitTicks = 0;
    var langs = play.langs[0] === 'all' ? LANGS.map(function (l) { return l.code; }) : play.langs;
    if (play.idx >= play.list.length) {
      play.on = false;
      clearSpeakingHighlight();
      $('btnPlayAll').textContent = '▶️ 전체 이어 듣기';
      $('btnStopPlay').classList.add('hidden');
      toast('이어 듣기 끝');
      return;
    }
    if (play.li >= langs.length) { play.idx++; play.li = 0; setTimeout(pump, 220); return; }
    var w = play.list[play.idx];
    var code = langs[play.li];
    var o = w[code];
    if (!o || !o.w) { play.li++; return setTimeout(pump, 0); }

    focusCard(w, code);
    var L = LANG[code];
    var ok = speakOne(o.w, L.tts, settings.speed, function () {
      setTimeout(function () { if (!play.on) return; play.li++; pump(); }, 140);
    });
    if (!ok) {
      missingVoiceLangs[code] = 1;
      play.li++;
      setTimeout(pump, 0);
      if (Object.keys(missingVoiceLangs).length === langs.length) {
        stopPlaying(true);
        toast('기기에 해당 언어 음성이 없습니다. 설정 > 손쉬운 사용 > 말하기 콘텐츠 > 음성에서 추가해 주세요.');
      }
    }
  }

  /* 재생 중인 단어로 카드를 옮기고 해당 언어 줄을 강조한다 */
  function focusCard(w, code) {
    var list = filteredWords();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].n === w.n) { idx = i; break; }
    if (idx >= 0 && idx !== cardIdx) { cardIdx = idx; renderCard(); }
    clearSpeakingHighlight();
    var row = document.querySelector('.langrow[data-lang="' + code + '"]');
    if (row) row.classList.add('speaking');
  }

  $('btnPlayAll').addEventListener('click', function () {
    if (play.on) { stopPlaying(false); return; }
    startPlayback(WORDS.slice(), settings.playLang === 'all' ? ['all'] : [settings.playLang]);
  });
  $('btnPlayStar').addEventListener('click', function () {
    var list = starList();
    if (!list.length) { toast('별표 복습함이 비어 있습니다.'); return; }
    startPlayback(list, settings.playLang === 'all' ? ['all'] : [settings.playLang]);
  });
  $('btnStopPlay').addEventListener('click', function () { stopPlaying(false); });

  /* ---------------------------------------------------------------- init */
  function init() {
    if (!WORDS.length) {
      document.querySelector('main').innerHTML = '<div class="card"><h2>데이터를 불러오지 못했습니다</h2><p class="desc">data.js 파일이 같은 폴더에 있는지 확인해 주세요.</p></div>';
      return;
    }
    refreshStarCount();
    refreshSettingsUI();
    renderCardFilter();
    renderPlayLang();
    renderSpeedChips();
    initVoices();
    showQuizPanel('setup');
    document.addEventListener('touchend', unlockAudio, { once: true, passive: true });
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopSpeaking(true);
    });
  }
  init();
})();
