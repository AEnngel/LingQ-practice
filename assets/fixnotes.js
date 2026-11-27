/* ============================================================================
   📝 수정 메모 (공통) — 미니스토리 · 26개 언어 퀴즈 · 감정 단어 78
   - 세 화면 모두의 상단 통합 바 오른쪽 📝 메모 버튼으로 열립니다.
   - 저장: localStorage 'lingq_practice_fix_notes_v1' (이 브라우저에만, 서버로 보내지 않음)
   - 작성 시각과 지금 보던 탭·회차·문제 위치를 자동으로 붙여 둡니다.
   - 📋 전체 복사: 위치·시각·메모를 한 번에 복사해 대화에 그대로 붙여 넣습니다.
   - 예전 26개 언어 퀴즈의 ✏️ 수정메모(lq.memo)에 쌓인 메모는 처음 한 번만 옮겨 옵니다.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__fixNotes) return;
  window.__fixNotes = 1;

  var KEY = 'lingq_practice_fix_notes_v1';
  var OLD_KEY = 'lq.memo';
  var MAX = 500;

  var PAGE = (function () {
    var p = location.pathname;
    if (/\/rmet-quiz\//.test(p)) return '감정 단어 78';
    if (/\/26lang-quiz\//.test(p)) return '26개 언어 퀴즈';
    return '미니스토리';
  })();

  /* ---------------------------------------------------------------- 도우미 */
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(ms) {
    var d = new Date(Number(ms) || Date.now());
    return p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function stampFull(ms) {
    var d = new Date(Number(ms) || Date.now());
    return String(d.getFullYear()).slice(2) + '년' + (d.getMonth() + 1) + '월' + d.getDate() + '일 ' +
      p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------------------------------------------------------- 저장소 */
  function readStore() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw === null) return null;
      var v = JSON.parse(raw);
      return Array.isArray(v) ? v.filter(function (m) {
        return m && typeof m === 'object' && clean(m.text);
      }).slice(0, MAX) : [];
    } catch (e) { return []; }
  }
  function writeStore(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) { }
  }
  /* 예전 26개 언어 퀴즈 메모(lq.memo)를 한 번만 옮겨 온다. 원래 키는 지우지 않는다. */
  function migrate() {
    var current = readStore();
    if (current !== null) return current;
    var out = [];
    try {
      var old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if (Array.isArray(old)) {
        out = old.filter(function (m) {
          return m && typeof m === 'object' && clean(m.text);
        }).map(function (m, i) {
          var loc = [];
          if (clean(m.loc)) loc.push(clean(m.loc));
          if (clean(m.snip)) loc.push('화면: ' + clean(m.snip));
          return {
            id: 'mig' + (Number(m.at) || Date.now()).toString(36) + i,
            text: String(m.text || ''),
            at: Number(m.at) || Date.now(),
            done: !!m.done,
            page: '26개 언어 퀴즈',
            loc: loc.join(' · ').slice(0, 160)
          };
        });
      }
    } catch (e) { }
    writeStore(out);
    return out;
  }

  var notes = migrate();

  /* ------------------------------------------------------- 지금 화면 위치 */
  var lqLocMissAt = 0;   /* 26개 언어 퀴즈가 위치를 알려 주기 전 잠깐만 기다린다 */
  function ownText(el) {   /* 자식 span 의 아이콘을 빼고 글자만 */
    if (!el) return '';
    var out = '';
    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3) out += n.nodeValue;
    });
    if (!out.trim()) out = el.textContent;
    return clean(out);
  }
  function locNow() {
    var parts = [];
    try {
      if (window.__lqMemoLoc) return clean(window.__lqMemoLoc).slice(0, 160);
      var ss = document.getElementById('story-select');
      if (ss && ss.options && ss.options.length && ss.selectedIndex >= 0) {
        parts.push(clean(ss.options[ss.selectedIndex].textContent));
      }
      var mode = document.querySelector('.tabs .tab-btn.active');
      if (mode) parts.push(ownText(mode));
      var tab = document.querySelector('.tabbar .tab.on');
      if (tab) parts.push(ownText(tab));
      var ci = document.getElementById('cardIndex');
      if (ci && ci.offsetParent !== null) parts.push(clean(ci.textContent));
    } catch (e) { }
    return parts.filter(Boolean).join(' · ').slice(0, 160);
  }

  /* ---------------------------------------------------------------- 스타일 */
  var CSS = [
    'html.fn-open,html.fn-open body{overflow:hidden}',
    /* 통합 바 안의 메모 버튼 */
    '.gnav .gnav-note{position:relative;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:4px;',
    'height:30px;padding:0 8px;margin-left:2px;border:0;border-radius:8px;',
    'background:rgba(255,255,255,.15);color:#fff;font-family:inherit;font-size:11.5px;font-weight:700;',
    'line-height:1;letter-spacing:-.02em;white-space:nowrap;cursor:pointer;',
    '-webkit-tap-highlight-color:transparent;transition:background .15s ease,transform .1s ease}',
    '.gnav .gnav-note:active{transform:scale(.96);background:rgba(255,255,255,.3)}',
    '@media (hover:hover){.gnav .gnav-note:hover{background:rgba(255,255,255,.26)}}',
    '.gnav .gnav-note .gn-i{flex:none;font-size:13px;line-height:1}',
    '.gnav .gnav-note .gn-n{position:absolute;top:-4px;right:-4px;min-width:14px;height:14px;padding:0 3px;border-radius:7px;',
    'background:#ffd76a;color:#3d2b00;font-size:9.5px;font-weight:800;display:inline-flex;',
    'align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,.25)}',
    '.gnav .gnav-note .gn-n[hidden]{display:none}',
    /* 좁은 화면에서 탭 이름이 잘리지 않게 글자·간격만 살짝 줄인다 */
    '@media (max-width:388px){',
    'nav.gnav a{font-size:10.5px;gap:3px;padding:0 4px}',
    'nav.gnav .gnav-note{padding:0 7px;gap:3px}}',
    '@media (max-width:359px){',
    'nav.gnav a{padding:0 3px;gap:2px}',
    'nav.gnav .gnav-note{padding:0 6px}',
    'nav.gnav .gnav-note .gn-t{display:none}}',
    /* 모달 */
    '.fn-wrap{position:fixed;inset:0;z-index:9700;display:flex;align-items:center;justify-content:center;',
    'padding:16px;background:rgba(10,18,35,.55);',
    'font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;color:#16233c}',
    '.fn-wrap[hidden]{display:none}',
    '.fn-panel{position:relative;width:min(560px,100%);max-height:min(86vh,760px);display:flex;flex-direction:column;',
    'background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(8,14,28,.38);overflow:hidden}',
    '@media (max-width:639px){.fn-wrap{align-items:flex-end;padding:0}',
    '.fn-panel{width:100%;max-height:89vh;border-radius:16px 16px 0 0;padding-bottom:env(safe-area-inset-bottom)}}',
    '.fn-head{display:flex;align-items:center;gap:8px;padding:14px 16px 10px}',
    '.fn-head h2{margin:0;font-size:1.02rem;font-weight:800;letter-spacing:-.02em}',
    '.fn-sum{font-size:.78rem;font-weight:700;color:#5b6b85}',
    '.fn-x{margin-left:auto;flex:none;width:30px;height:30px;border:0;border-radius:9px;background:#f0f3f8;',
    'color:#44506b;font-size:14px;font-weight:700;cursor:pointer;line-height:1}',
    '.fn-x:active{background:#e2e8f2}',
    '.fn-where{margin:0 16px 10px;padding:7px 10px;border-radius:9px;background:#f4f7fc;',
    'font-size:.78rem;font-weight:600;color:#3d4a63;line-height:1.35;word-break:break-word}',
    '.fn-where .fn-where-k{color:#6b7a94;font-weight:700;margin-right:4px}',
    '.fn-input{margin:0 16px;width:calc(100% - 32px);box-sizing:border-box;padding:10px 12px;border:1px solid #ccd6e6;',
    'border-radius:10px;font-family:inherit;font-size:16px;line-height:1.45;color:#16233c;background:#fff;',
    'resize:vertical;min-height:74px;outline:none}',
    '.fn-input:focus{border-color:#2b4a80;box-shadow:0 0 0 3px rgba(43,74,128,.14)}',
    '.fn-btns{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 16px 4px}',
    '.fn-btn{flex:none;height:36px;padding:0 14px;border:1px solid #ccd6e6;border-radius:9px;background:#fff;',
    'color:#1b2a4a;font-family:inherit;font-size:.86rem;font-weight:800;cursor:pointer;line-height:1}',
    '.fn-btn:active{transform:scale(.98)}',
    '.fn-btn.primary{background:#1b2a4a;border-color:#1b2a4a;color:#fff}',
    '.fn-btn.primary:active{background:#16233c}',
    '.fn-tip{flex:1 1 120px;min-width:0;font-size:.76rem;font-weight:700;color:#2f6b3f;line-height:1.3}',
    '.fn-fb{margin:8px 16px 0;padding:10px 12px;border-radius:10px;background:#fff7e2;border:1px solid #f0d59a}',
    '.fn-fb[hidden]{display:none}',
    '.fn-fb label{display:block;font-size:.76rem;font-weight:700;color:#7a5a12;margin-bottom:6px}',
    '.fn-fb textarea{width:100%;box-sizing:border-box;font-family:inherit;font-size:15px;line-height:1.45;',
    'border:1px solid #e3cd9a;border-radius:8px;padding:8px 10px;background:#fff;resize:vertical}',
    '.fn-list{flex:1 1 auto;min-height:60px;overflow:auto;-webkit-overflow-scrolling:touch;padding:4px 16px 8px;',
    'margin-top:8px;border-top:1px solid #eef1f6}',
    '.fn-empty{padding:18px 4px;font-size:.83rem;line-height:1.6;color:#7b879e;text-align:center}',
    '.fn-item{display:flex;align-items:flex-start;gap:9px;padding:10px 0;border-bottom:1px solid #eff2f7}',
    '.fn-item:last-child{border-bottom:0}',
    '.fn-cb{flex:none;width:19px;height:19px;margin:2px 0 0;accent-color:#1b2a4a;cursor:pointer}',
    '.fn-body{flex:1 1 auto;min-width:0;cursor:pointer}',
    '.fn-meta{display:block;font-size:.72rem;font-weight:800;color:#6b7a94;letter-spacing:-.01em}',
    '.fn-loc{display:block;margin-top:2px;font-size:.72rem;font-weight:600;color:#8492aa;word-break:break-word}',
    '.fn-text{display:block;margin-top:3px;font-size:.88rem;line-height:1.5;color:#1d2940;white-space:pre-wrap;word-break:break-word}',
    '.fn-item.is-done .fn-text{text-decoration:line-through;color:#98a3b8}',
    '.fn-item.is-done .fn-meta,.fn-item.is-done .fn-loc{color:#a9b3c6}',
    '.fn-del{flex:none;width:26px;height:26px;border:0;border-radius:8px;background:transparent;color:#9aa5b9;',
    'font-size:13px;font-weight:700;cursor:pointer;line-height:1}',
    '.fn-del:active{background:#f4e9e9;color:#a63a3a}',
    '.fn-foot{display:flex;align-items:center;gap:8px;padding:9px 16px 12px;border-top:1px solid #eef1f6;',
    'font-size:.72rem;color:#8a95aa;font-weight:600}',
    '.fn-clear{margin-left:auto;flex:none;border:0;background:transparent;color:#9aa5b9;font-family:inherit;',
    'font-size:.72rem;font-weight:700;text-decoration:underline;cursor:pointer;padding:4px 2px}',
    '.fn-clear:active{color:#a63a3a}',
    /* 통합 바가 없는 페이지에서만 쓰는 떠 있는 버튼 */
    '.fn-fab{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:9600;',
    'height:42px;padding:0 14px;border:0;border-radius:21px;background:#1b2a4a;color:#fff;',
    'font-family:inherit;font-size:.88rem;font-weight:800;box-shadow:0 8px 22px rgba(10,18,35,.35);cursor:pointer}'
  ].join('');

  /* ------------------------------------------------------------------ DOM */
  function build() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var wrap = document.createElement('div');
    wrap.className = 'fn-wrap';
    wrap.id = 'fnWrap';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="fn-panel" role="dialog" aria-modal="true" aria-labelledby="fnTitle">' +
        '<div class="fn-head">' +
          '<h2 id="fnTitle">📝 수정 메모</h2>' +
          '<span class="fn-sum" id="fnSum"></span>' +
          '<button type="button" class="fn-x" id="fnClose" aria-label="닫기" title="닫기">✕</button>' +
        '</div>' +
        '<div class="fn-where"><span class="fn-where-k">📍 지금 화면</span><b id="fnWhere"></b></div>' +
        '<textarea class="fn-input" id="fnInput" rows="3" autocomplete="off" spellcheck="false" ' +
          'placeholder="고칠 점이나 더하고 싶은 내용을 적어 주세요. 예: 12a 카드에서 \'fui\' 발음이 \'푸이\'로 나와요"></textarea>' +
        '<div class="fn-btns">' +
          '<button type="button" class="fn-btn primary" id="fnAdd">추가</button>' +
          '<button type="button" class="fn-btn" id="fnCopy">📋 전체 복사</button>' +
          '<span class="fn-tip" id="fnTip"></span>' +
        '</div>' +
        '<div class="fn-fb" id="fnFb" hidden>' +
          '<label for="fnFbText">자동 복사가 막혀 있어요 — 아래 글을 길게 눌러 복사해 주세요</label>' +
          '<textarea id="fnFbText" rows="6" readonly></textarea>' +
        '</div>' +
        '<div class="fn-list" id="fnList"></div>' +
        '<div class="fn-foot">' +
          '<span>이 브라우저에만 저장돼요 · 새로고침해도 남아요</span>' +
          '<button type="button" class="fn-clear" id="fnClear">전체 비우기</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    /* 통합 바 버튼 */
    var gnav = document.querySelector('nav.gnav');
    var btn;
    if (gnav) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gnav-note';
      btn.id = 'fnBtn';
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.title = '고칠 점·더할 내용을 적어 두는 수정 메모';
      btn.innerHTML = '<span class="gn-i">📝</span><span class="gn-t">메모</span><span class="gn-n" id="fnBadge" hidden>0</span>';
      gnav.appendChild(btn);
    } else {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fn-fab';
      btn.id = 'fnBtn';
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.innerHTML = '📝 메모';
      document.body.appendChild(btn);
    }
    return { wrap: wrap, btn: btn };
  }

  var ui = build();
  var wrap = ui.wrap;
  var btn = ui.btn;
  var badge = document.getElementById('fnBadge');
  var sumEl = document.getElementById('fnSum');
  var whereEl = document.getElementById('fnWhere');
  var input = document.getElementById('fnInput');
  var listEl = document.getElementById('fnList');
  var tipEl = document.getElementById('fnTip');
  var fbEl = document.getElementById('fnFb');
  var fbText = document.getElementById('fnFbText');
  var tipTimer = 0;

  /* ------------------------------------------------------------------ 그리기 */
  function tip(msg, ms) {
    if (!tipEl) return;
    tipEl.textContent = msg || '';
    clearTimeout(tipTimer);
    if (msg) tipTimer = setTimeout(function () { tipEl.textContent = ''; }, ms || 2600);
  }
  function draw() {
    var pend = 0;
    notes.forEach(function (m) { if (!m.done) pend++; });
    if (badge) { badge.textContent = String(notes.length); badge.hidden = !notes.length; }
    if (sumEl) {
      sumEl.textContent = notes.length
        ? notes.length + '건' + (pend && pend !== notes.length ? ' · 남은 ' + pend : '')
        : '';
    }
    if (!listEl) return;
    if (!notes.length) {
      listEl.innerHTML = '<div class="fn-empty">아직 적어 둔 메모가 없어요.<br>위 칸에 고칠 점을 적고 <b>추가</b>를 누르면 여기에 쌓여요.</div>';
      return;
    }
    listEl.innerHTML = notes.map(function (m) {
      var id = esc(m.id || '');
      var head = stamp(m.at) + ' · ' + (m.page || PAGE);
      return '<div class="fn-item' + (m.done ? ' is-done' : '') + '" data-id="' + id + '">' +
        '<input type="checkbox" class="fn-cb" id="fncb-' + id + '" data-id="' + id + '"' +
          (m.done ? ' checked' : '') + ' aria-label="완료 표시">' +
        '<label class="fn-body" for="fncb-' + id + '">' +
          '<span class="fn-meta">' + esc(head) + '</span>' +
          (m.loc ? '<span class="fn-loc">📍 ' + esc(m.loc) + '</span>' : '') +
          '<span class="fn-text">' + esc(m.text || '') + '</span>' +
        '</label>' +
        '<button type="button" class="fn-del" data-del="' + id + '" aria-label="이 메모 지우기" title="지우기">✕</button>' +
      '</div>';
    }).join('');

    Array.prototype.forEach.call(listEl.querySelectorAll('.fn-cb'), function (cb) {
      cb.addEventListener('change', function () { toggleDone(cb.getAttribute('data-id'), cb.checked); });
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('.fn-del'), function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        remove(b.getAttribute('data-del'));
      });
    });
  }

  /* ------------------------------------------------------------------ 동작 */
  function add() {
    var text = String(input && input.value || '').trim();
    if (!text) { tip('적을 내용을 먼저 넣어 주세요'); if (input) input.focus(); return; }
    notes.unshift({
      id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: text,
      at: Date.now(),
      done: false,
      page: PAGE,
      loc: locNow()
    });
    notes = notes.slice(0, MAX);
    writeStore(notes);
    if (input) input.value = '';
    if (fbEl) fbEl.hidden = true;
    draw();
    tip('1건 추가 · 모두 ' + notes.length + '건', 2600);
    if (input) input.focus();
  }
  function toggleDone(id, done) {
    notes = notes.map(function (m) { return m.id === id ? Object.assign({}, m, { done: !!done }) : m; });
    writeStore(notes);
    draw();
  }
  function remove(id) {
    var before = notes.length;
    notes = notes.filter(function (m) { return m.id !== id; });
    if (notes.length === before) return;
    writeStore(notes);
    draw();
    tip('1건 지웠어요', 2200);
  }
  function clearAll() {
    if (!notes.length) { tip('비울 메모가 없어요'); return; }
    if (!window.confirm('메모 ' + notes.length + '건을 모두 지울까요? 되돌릴 수 없어요.')) return;
    notes = [];
    writeStore(notes);
    draw();
    tip('메모를 모두 지웠어요', 2200);
  }

  function copyText() {
    if (!notes.length) return '';
    var out = ['📝 웹 연습장 수정 메모 ' + notes.length + '건 · ' + stampFull(Date.now()) + ' 복사', ''];
    notes.forEach(function (m, i) {
      out.push((i + 1) + ') ' + (m.done ? '[완료] ' : '') +
        [stamp(m.at) + ' · ' + (m.page || PAGE), clean(m.loc)].filter(Boolean).join(' · '));
      String(m.text || '').split('\n').forEach(function (line) { out.push('   ' + line); });
    });
    return out.join('\n').replace(/\s+$/, '');
  }
  function copyLegacy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      if (ta.setSelectionRange) ta.setSelectionRange(0, text.length);
      var ok = document.execCommand ? document.execCommand('copy') : false;
      ta.remove();
      return !!ok;
    } catch (e) { return false; }
  }
  function copyAll() {
    var text = copyText();
    if (!text) { tip('복사할 메모가 없어요'); return; }
    var ok = function () {
      if (fbEl) fbEl.hidden = true;
      tip('복사했어요 · 대화에 붙여 넣기', 4000);
    };
    var fallback = function () {
      if (!fbEl || !fbText) { tip('복사하지 못했어요. 목록의 글을 길게 눌러 복사해 주세요', 4500); return; }
      fbText.value = text;
      fbEl.hidden = false;
      fbText.focus();
      fbText.select();
      tip('자동 복사가 막혀 있어요 — 아래 글을 길게 눌러 복사해 주세요', 5000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { if (copyLegacy(text)) ok(); else fallback(); });
      return;
    }
    if (copyLegacy(text)) ok(); else fallback();
  }

  function open() {
    if (!wrap) return;
    if (whereEl) {
      var loc = locNow();
      whereEl.textContent = PAGE + (loc ? ' · ' + loc : '');
    }
    if (fbEl) fbEl.hidden = true;
    tip('');
    wrap.hidden = false;
    document.documentElement.classList.add('fn-open');
    draw();
    setTimeout(function () { if (input) { try { input.focus(); } catch (e) { } } }, 40);
  }
  function close() {
    if (!wrap) return;
    wrap.hidden = true;
    document.documentElement.classList.remove('fn-open');
  }

  /* ------------------------------------------------------------------ 연결 */
  if (btn) btn.addEventListener('click', open);
  var closeBtn = document.getElementById('fnClose');
  if (closeBtn) closeBtn.addEventListener('click', close);
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  var addBtn = document.getElementById('fnAdd');
  if (addBtn) addBtn.addEventListener('click', add);
  var copyBtn = document.getElementById('fnCopy');
  if (copyBtn) copyBtn.addEventListener('click', copyAll);
  var clearBtn = document.getElementById('fnClear');
  if (clearBtn) clearBtn.addEventListener('click', clearAll);
  if (input) input.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); add(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && wrap && !wrap.hidden) close();
  });
  window.addEventListener('storage', function (e) {
    if (!e || e.key === KEY) { var v = readStore(); if (v) { notes = v; draw(); } }
  });

  draw();
})();
