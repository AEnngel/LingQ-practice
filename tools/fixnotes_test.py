#!/usr/bin/env python3
"""📝 수정 메모 공통 모듈 로컬 검증 (레이아웃·추가·완료·삭제·복사·저장 지속·이전 메모 이전)."""
import functools
import http.server
import json
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = '/workspace/langq-deploy'
PORT = 8787
SHOTS = '/workspace/browser'

h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), h)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

BASE = f'http://127.0.0.1:{PORT}'
KEY = 'lingq_practice_fix_notes_v1'
problems = []
log = []


def check(name, cond, extra=''):
    log.append(('OK ' if cond else 'FAIL ') + name + (f' — {extra}' if extra else ''))
    if not cond:
        problems.append(name + (f' — {extra}' if extra else ''))


def nav_boxes(pg):
    return pg.evaluate("""() => {
      const n = document.querySelector('nav.gnav');
      const items = [...n.children].map(el => {
        const r = el.getBoundingClientRect();
        return {tag: el.tagName, text: (el.textContent||'').trim().replace(/\\s+/g,' '),
                x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
                sw: el.scrollWidth, cw: el.clientWidth};
      });
      const nr = n.getBoundingClientRect();
      return {items, navW: Math.round(nr.width), navH: Math.round(nr.height), vw: window.innerWidth};
    }""")


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    errors = []
    ctx.on('weberror', lambda e: errors.append(str(e)))

    # ---------------------------------------------------------------- 미니스토리
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append('console:' + m.text) if m.type == 'error' else None)
    pg.goto(BASE + '/', wait_until='load')
    pg.wait_for_timeout(2500)
    check('미니스토리: gnav 메모 버튼 있음', pg.locator('nav.gnav #fnBtn').count() == 1)
    nb = nav_boxes(pg)
    check('미니스토리 390: 한 줄(모든 항목 같은 y)', len({i['y'] for i in nb['items']}) == 1, json.dumps(nb, ensure_ascii=False))
    check('미니스토리 390: 항목 겹침 없음', all(nb['items'][i]['x'] + nb['items'][i]['w'] <= nb['items'][i + 1]['x'] + 1 for i in range(len(nb['items']) - 1)))
    check('미니스토리 390: 바 폭 안에 들어옴', nb['items'][-1]['x'] + nb['items'][-1]['w'] <= nb['vw'], json.dumps(nb, ensure_ascii=False))

    pg.click('#fnBtn')
    pg.wait_for_timeout(350)
    check('미니스토리: 모달 열림', pg.locator('#fnWrap').is_visible())
    where = pg.locator('#fnWhere').inner_text()
    check('미니스토리: 지금 화면 표시', where.startswith('미니스토리'), where)
    pg.screenshot(path=f'{SHOTS}/fixnotes-01-story-modal-390.png')
    pg.fill('#fnInput', '12a 카드에서 fui 발음이 푸이로 들려요')
    pg.click('#fnAdd')
    pg.wait_for_timeout(300)
    cnt = pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')||'[]').length")
    check('미니스토리: 추가 후 저장됨', cnt == 1, f'count={cnt}')
    item_meta = pg.locator('.fn-item .fn-meta').first.inner_text()
    check('미니스토리: 태그 형식(11-28 06:25 · 탭)', '· 미니스토리' in item_meta, item_meta)
    pg.screenshot(path=f'{SHOTS}/fixnotes-02-story-added-390.png')

    # 완료 체크
    pg.locator('.fn-item .fn-cb').first.check()
    pg.wait_for_timeout(200)
    done = pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')||'[]')[0].done")
    check('미니스토리: 완료 체크 저장', done is True, str(done))

    # 두 번째 메모 + 복사
    pg.fill('#fnInput', '22b 해석에 오타: "천천히" → "천천히"')
    pg.click('#fnAdd')
    pg.wait_for_timeout(250)
    pg.evaluate("""() => { window.__copied=''; Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:t=>{window.__copied=t;return Promise.resolve();}}}); }""")
    pg.click('#fnCopy')
    pg.wait_for_timeout(500)
    copied = pg.evaluate("window.__copied||''")
    log.append('--- 복사된 글 ---\n' + copied + '\n---')
    check('미니스토리: 전체 복사 실행', copied.startswith('📝 웹 연습장 수정 메모 2건'), copied[:40])
    check('미니스토리: 복사글에 완료 표시', '[완료]' in copied)
    check('미니스토리: 복사글에 위치 포함', '미니스토리' in copied and '12a' in copied, copied)

    # 새로고침 후 유지
    pg.reload(wait_until='load')
    pg.wait_for_timeout(1800)
    badge = pg.locator('#fnBadge').inner_text()
    check('미니스토리: 새로고침 후 배지 2', badge.strip() == '2', badge)
    pg.click('#fnBtn')
    pg.wait_for_timeout(300)
    check('미니스토리: 새로고침 후 목록 2건', pg.locator('.fn-item').count() == 2)

    # 삭제
    pg.locator('.fn-del').first.click()
    pg.wait_for_timeout(250)
    check('미니스토리: 개별 삭제', pg.locator('.fn-item').count() == 1)
    left = pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')||'[]').length")
    check('미니스토리: 삭제 저장', left == 1, str(left))
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(200)
    check('미니스토리: Esc 로 닫힘', not pg.locator('#fnWrap').is_visible())

    # 360 / 320 / 데스크톱 폭 확인
    pg.screenshot(path=f'{SHOTS}/fixnotes-03-story-nav-390.png')
    for w in (360, 320, 1280):
        pg.set_viewport_size({'width': w, 'height': 800})
        pg.wait_for_timeout(300)
        nb = nav_boxes(pg)
        check(f'미니스토리 {w}: 한 줄', len({i['y'] for i in nb['items']}) == 1, json.dumps(nb['items'], ensure_ascii=False))
        check(f'미니스토리 {w}: 겹침 없음', all(nb['items'][i]['x'] + nb['items'][i]['w'] <= nb['items'][i + 1]['x'] + 1 for i in range(len(nb['items']) - 1)), json.dumps(nb['items'], ensure_ascii=False))
        check(f'미니스토리 {w}: 화면 폭 안', nb['items'][-1]['x'] + nb['items'][-1]['w'] <= nb['vw'], json.dumps(nb['items'], ensure_ascii=False))
        check(f'미니스토리 {w}: 버튼 잘림 없음', all(i['sw'] <= i['cw'] + 1 for i in nb['items'][:3]), json.dumps(nb['items'], ensure_ascii=False))

    # ------------------------------------------------------- 26개 언어 퀴즈 (이전 메모 이전 포함)
    pg2 = ctx.new_page()
    pg2.on('console', lambda m: errors.append('26console:' + m.text) if m.type == 'error' else None)
    pg2.goto(BASE + '/26lang-quiz/', wait_until='load')
    pg2.wait_for_timeout(1500)
    check('26퀴즈: 예전 메모 이전됨', pg2.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')||'[]').length") >= 1,
          str(pg2.evaluate(f"localStorage.getItem('{KEY}')")))
    check('26퀴즈: 예전 버튼 제거됨', pg2.locator('#btnMemo').count() == 0)
    check('26퀴즈: gnav 메모 버튼 있음', pg2.locator('nav.gnav #fnBtn').count() == 1)
    nb = nav_boxes(pg2)
    check('26퀴즈 390: 한 줄·겹침 없음',
          len({i['y'] for i in nb['items']}) == 1 and all(nb['items'][i]['x'] + nb['items'][i]['w'] <= nb['items'][i + 1]['x'] + 1 for i in range(len(nb['items']) - 1)),
          json.dumps(nb['items'], ensure_ascii=False))
    pg2.screenshot(path=f'{SHOTS}/fixnotes-04-quiz-nav-390.png')
    # 문법 탭 이동 후 메모: 위치에 탭 이름
    pg2.click('.tab[data-tab="words"]')
    pg2.wait_for_timeout(700)
    pg2.click('#fnBtn')
    pg2.wait_for_timeout(300)
    print('26퀴즈 where =', pg2.locator('#fnWhere').inner_text())
    pg2.fill('#fnInput', '단어 탭에서 4번 보기 글씨가 너무 작아요')
    pg2.click('#fnAdd')
    pg2.wait_for_timeout(300)
    metas = pg2.locator('.fn-meta').all_inner_texts()
    check('26퀴즈: 새 메모에 탭 이름 태그', metas[0].endswith('· 26개 언어 퀴즈'), metas[0])
    pg2.screenshot(path=f'{SHOTS}/fixnotes-05-quiz-modal-390.png')
    # 공유 확인
    pg2.reload(wait_until='load')
    pg2.wait_for_timeout(1500)
    check('26퀴즈: 새로고침 후 유지', pg2.locator('#fnBadge').inner_text().strip() != '', pg2.locator('#fnBadge').inner_text())

    # ------------------------------------------------------------- 감정 단어 78
    pg3 = ctx.new_page()
    pg3.on('console', lambda m: errors.append('rmet:' + m.text) if m.type == 'error' else None)
    pg3.goto(BASE + '/rmet-quiz/', wait_until='load')
    pg3.wait_for_timeout(1200)
    check('감정단어: gnav 메모 버튼 있음', pg3.locator('nav.gnav #fnBtn').count() == 1)
    nb = nav_boxes(pg3)
    check('감정단어 390: 한 줄·겹침 없음',
          len({i['y'] for i in nb['items']}) == 1 and all(nb['items'][i]['x'] + nb['items'][i]['w'] <= nb['items'][i + 1]['x'] + 1 for i in range(len(nb['items']) - 1)),
          json.dumps(nb['items'], ensure_ascii=False))
    pg3.click('#fnBtn')
    pg3.wait_for_timeout(300)
    check('감정단어: 공유 메모 보임', pg3.locator('.fn-item').count() == pg3.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')||'[]').length"))
    pg3.screenshot(path=f'{SHOTS}/fixnotes-06-rmet-modal-390.png')
    pg3.fill('#fnInput', '감정 단어 카드 12번 뜻이 어색해요')
    pg3.click('#fnAdd')
    pg3.wait_for_timeout(300)
    check('감정단어: 위치 태그', pg3.locator('.fn-meta').first.inner_text().endswith('· 감정 단어 78'), pg3.locator('.fn-meta').first.inner_text())
    pg3.keyboard.press('Escape')

    # 데스크톱
    pg3.set_viewport_size({'width': 1280, 'height': 900})
    pg3.wait_for_timeout(300)
    pg3.click('#fnBtn')
    pg3.wait_for_timeout(400)
    pg3.screenshot(path=f'{SHOTS}/fixnotes-07-rmet-modal-desktop.png')
    nb = nav_boxes(pg3)
    check('감정단어 데스크톱: 겹침 없음', all(nb['items'][i]['x'] + nb['items'][i]['w'] <= nb['items'][i + 1]['x'] + 1 for i in range(len(nb['items']) - 1)), json.dumps(nb['items'], ensure_ascii=False))

    # 이전 메모 이전이 두 번 일어나지 않는지
    pg3.evaluate(f"localStorage.setItem('{KEY}','[]')")
    pg3.reload(wait_until='load')
    pg3.wait_for_timeout(800)
    check('빈 목록은 다시 이전되지 않음', pg3.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')||'[]').length") == 0)
    pg3.close()

    # ------------------------------------- 예전 ✏️ 수정메모(lq.memo) 이전 (완전 새 저장소)
    ctx2 = b.new_context(viewport={'width': 390, 'height': 844})
    old_notes = [{'id': 'm1', 'loc': '문법 문제 · 게임 03 · 3번', 'snip': 'Die Katze ist schwarz',
                  'text': '3번 정답이 두 개로 보여요', 'at': 1795000000000}]
    ctx2.add_init_script("localStorage.setItem('lq.memo', %s)" % json.dumps(json.dumps(old_notes, ensure_ascii=False)))
    pg4 = ctx2.new_page()
    pg4.goto(BASE + '/26lang-quiz/', wait_until='load')
    pg4.wait_for_timeout(1200)
    migrated = pg4.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')||'[]')")
    check('이전: lq.memo → 새 키로 1건 이동', len(migrated) == 1, json.dumps(migrated, ensure_ascii=False))
    if migrated:
        m = migrated[0]
        check('이전: 본문 보존', m['text'] == '3번 정답이 두 개로 보여요', m['text'])
        check('이전: 위치 보존', '문법 문제' in m['loc'] and 'Die Katze' in m['loc'], m['loc'])
        check('이전: 탭 이름 태그', m['page'] == '26개 언어 퀴즈', m['page'])
    check('이전: 예전 키 그대로 남김', pg4.evaluate("localStorage.getItem('lq.memo')") is not None)
    ctx2.close()

    b.close()

httpd.shutdown()
print('\n'.join(log))
print('\n=== 콘솔 오류 ===')
print('\n'.join(errors) if errors else '(없음)')
print('\n결과:', 'PASS' if not problems else f'{len(problems)} FAIL')
for x in problems:
    print(' -', x)
sys.exit(1 if problems else 0)
