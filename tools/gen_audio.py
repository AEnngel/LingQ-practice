#!/usr/bin/env python3
"""LingQ 연습장 — 9개 언어 Edge TTS mp3 생성기 (v14)

아이슬란드어 / 아일랜드어 / 웨일스어 / 아프리칸스어 / 고전 라틴어(이탈리아어 음성)
+ 스코츠 / 셔틀랜드어 / 오크니 스코츠(영국식 영어 음성) / 스코틀랜드 게일어(아일랜드어 음성)
문장 텍스트 해시(FNV-1a 32bit, UTF-8) 파일명으로 중복 제거: audio/{code}/{hash}.mp3
audio/index.json 에 사용 가능한 해시 목록을 기록한다 (index.html 이 조회).

사용: python3 tools/gen_audio.py 1a 1b 1c --concurrency 12   (여러 회차를 한 번에, 이미 있는 파일은 건너뜀)

"""
import argparse
import asyncio
import json
import os
import re
import sys
from datetime import datetime

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# 이 파일이 langq-deploy/tools/ 안에 있으면 ROOT 가 곧 배포 폴더, 작업 폴더의 tools/ 면 langq-deploy/ 를 찾는다
DEPLOY = ROOT if os.path.basename(ROOT) == 'langq-deploy' else os.path.join(ROOT, 'langq-deploy')
AUDIO_DIR = os.path.join(DEPLOY, 'audio')

# 언어코드 -> (Edge TTS 음성, 설명)
VOICES = {
    'is': ('is-IS-GudrunNeural', '아이슬란드어'),
    'ga': ('ga-IE-OrlaNeural', '아일랜드어'),
    'cy': ('cy-GB-NiaNeural', '웨일스어'),
    'af': ('af-ZA-AdriNeural', '아프리칸스어'),
    'la': ('it-IT-ElsaNeural', '고전 라틴어(이탈리아어 음성)'),
    'sco': ('en-GB-RyanNeural', '스코츠(영국식 영어 음성)'),
    'shet': ('en-GB-RyanNeural', '셔틀랜드어(영국식 영어 음성)'),
    'ork': ('en-GB-RyanNeural', '오크니 스코츠(영국식 영어 음성)'),
    'gd': ('ga-IE-OrlaNeural', '스코틀랜드 게일어(아일랜드어 음성)'),
}


def fnv1a(text: str) -> str:
    h = 0x811C9DC5
    for b in text.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, '08x')


def build_natural(text: str, code: str) -> str:
    """index.html 의 buildNaturalSpeechText 와 같은 변환."""
    t = str(text or '').strip()
    stripped = re.sub(r'^\([^)]*\)\s*', '', t)  # 앞머리 괄호 주석 제거
    if not stripped:
        stripped = re.sub(r'^\(([^)]*)\)\s*$', r'\1', t)  # 괄호만 있는 문장
    t = stripped
    if code in ('sco', 'shet', 'ork'):
        t = re.sub(r'\bA\b', 'I', t)
        t = re.sub(r'\bme\b', 'my', t)
        t = re.sub(r'\btae\b', 'to', t)
        t = re.sub(r'\bwark\b', 'work', t)
        t = re.sub(r'\bcaur\b', 'car', t)
        t = re.sub(r'\bfae\b', 'from', t)
    return t


def norm(text: str, code: str = '') -> str:
    """index.html 의 buildNaturalSpeechText + normSpeechText 와 해시가 같도록 맞춘다."""
    t = build_natural(text, code)
    t = re.sub(r'^\([^)]*\)\s*', '', t)  # normSpeechText 의 앞머리 괄호 제거
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def collect(story_ids):
    jobs = {}
    for sid in story_ids:
        with open(os.path.join(DEPLOY, 'stories', sid + '.json'), encoding='utf-8') as f:
            data = json.load(f)
        for lang in data['langs']:
            code = lang['code']
            if code not in VOICES:
                continue
            for s in lang['sents']:
                t = norm(s['o'], code)
                if not t:
                    continue
                jobs.setdefault((code, fnv1a(t)), t)
    return jobs


async def render(code, key, text, sem, voice, out_dir, stats):
    path = os.path.join(out_dir, key + '.mp3')
    if os.path.exists(path) and os.path.getsize(path) > 800:
        stats['skip'] += 1
        return
    async with sem:
        for attempt in range(4):
            try:
                c = edge_tts.Communicate(text, voice)
                await c.save(path)
                if os.path.getsize(path) > 800:
                    stats['ok'] += 1
                    return
            except Exception as e:  # noqa: BLE001
                if attempt == 3:
                    stats['fail'].append((code, key, text[:40], str(e)[:120]))
                    try:
                        if os.path.exists(path):
                            os.remove(path)
                    except OSError:
                        pass
                else:
                    await asyncio.sleep(1.5 * (attempt + 1))
        stats['fail'].append((code, key, text[:40], 'small file'))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('stories', nargs='+')
    ap.add_argument('--concurrency', type=int, default=10)
    ap.add_argument('--no-index', action='store_true')
    args = ap.parse_args()

    jobs = collect(args.stories)
    stats = {'ok': 0, 'skip': 0, 'fail': []}
    sem = asyncio.Semaphore(args.concurrency)
    tasks = []
    for (code, key), text in jobs.items():
        out_dir = os.path.join(AUDIO_DIR, code)
        os.makedirs(out_dir, exist_ok=True)
        tasks.append(render(code, key, text, sem, VOICES[code][0], out_dir, stats))
    print('대상 문장 %d개 (중복 제거 후)' % len(tasks), flush=True)
    await asyncio.gather(*tasks)
    print('생성 %d · 이미 있음 %d · 실패 %d' % (stats['ok'], stats['skip'], len(stats['fail'])),
          flush=True)
    for f in stats['fail'][:20]:
        print('  실패:', f, flush=True)

    if args.no_index:
        return 1 if stats['fail'] else 0

    # audio/index.json — 언어별 사용 가능한 해시 전체를 다시 훑어 기록
    index = {'generated': datetime.now().strftime('%Y-%m-%d'),
             'voices': {c: v[0] for c, v in VOICES.items()}, 'hashes': {}}
    for code in VOICES:
        d = os.path.join(AUDIO_DIR, code)
        hashes = sorted(f[:-4] for f in os.listdir(d) if f.endswith('.mp3')) if os.path.isdir(d) else []
        index['hashes'][code] = hashes
    with open(os.path.join(AUDIO_DIR, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
    total = sum(len(v) for v in index['hashes'].values())
    size = sum(os.path.getsize(os.path.join(AUDIO_DIR, c, h + '.mp3'))
               for c, hs in index['hashes'].items() for h in hs)
    print('index.json 갱신 — %d개 파일, %.1f MB' % (total, size / 1048576), flush=True)
    return 1 if stats['fail'] else 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
