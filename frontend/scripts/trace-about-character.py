"""소개 페이지 캐릭터 PNG → 평면 SVG (#930, 명세 2026-09-25 §6-4).

다시 딸 때 쓰는 절차다. 런타임 · 빌드와 무관하고 CI 가 돌리지 않는다.

필요한 것: potrace(`brew install potrace`), Python 3 + Pillow · numpy(가상환경 권장).

    python3 -m venv .venv && .venv/bin/pip install pillow numpy
    .venv/bin/python scripts/trace-about-character.py <PNG 폴더> public/illustrations/about

원본 PNG 는 시안 아티팩트의 `img/*.png` 이고 #917 커밋(`c97c8f52`)에도 있다 — 다만 그 커밋의
`dog-sit-lookup.png` 는 346×418 로 줄인 것이라, 원본(691×836)을 쓰면 `CHARACTER` 치수가 그대로다.

**방법.** 3배로 키워 색 넷(크림 · 황갈 · 초록 · 눈)으로 나누고, 층마다 potrace 로 딴 뒤 크림
실루엣 위에 겹쳐 쌓는다(층 사이 틈이 생기지 않는다). 열기 선은 원본이 작고 흐려 손으로 그린다.

- 눈은 **초록 부위에서 떨어진** 어두운 점만이다. 초록 가장자리의 어두운 안티앨리어싱 픽셀을
  눈으로 잡으면 귀 · 코 · 목줄에 검은 테가 생긴다(#930 검토).
- 황갈 · 초록은 **실루엣 가장자리 근처에서만** 1px 넓힌다. 반투명 가장자리 픽셀이 분류에서
  빠지면 그 바깥에 크림 테가 남는다.
- 황갈은 흐린 뒤 반 문턱으로 고른다(`smooth`) — 가는 접힘 선이 들쭉날쭉하게 따진다.
- 색은 새로 만들지 않는다 — 기존 일러스트 값 · 토큰 값 (`about-character.test.ts` 가 잠근다).
"""

import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

UP = 3
PALETTE = {
    'cream': '#f2e6c9',  # 기존 일러스트 크림
    'tan': '#d4b487',  # 기존 일러스트 황갈
    'green': '#1d6646',  # --brand-700
    'eye': '#15181d',  # --fg
    'red': '#d54040',  # 곡선의 노면 선과 같은 값
}
# 층마다 potrace 인자 — 황갈은 가는 접힘 선이 많아 더 매끈하게
POTRACE = {
    'cream': ['-a', '1.1', '-O', '0.6'],
    'tan': ['-a', '1.3', '-O', '0.8'],
    'green': ['-a', '1.1', '-O', '0.6'],
    'eye': ['-a', '1.3', '-O', '0.6'],
}
# (파일, 종류, 최대 표시 폭 px — globals.css 캐릭터 블록, 그레인 결을 맞추는 데 쓴다, id)
JOBS = [
    ('dog-sit-lookup', 'dog', 150, 'dl'),
    ('dog-leash', 'dog', 196 * 0.936, 'dw'),
    ('dog-stand', 'dog', 196 * 0.904, 'ds'),
    ('dog-hot', 'dog', 196 * 0.981, 'dh'),
    ('heat-lines', 'heat', 196 * 0.12, 'hl'),
    ('dog-sit-front', 'dog', 136, 'df'),
]


def dilate(mask, r):
    out = mask.copy()
    for _ in range(r):
        grown = out.copy()
        grown[1:] |= out[:-1]
        grown[:-1] |= out[1:]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown
    return out


def erode(mask, r):
    return ~dilate(~mask, r)


def smooth(mask, r):
    """상자 흐림 두 번 → 반 문턱. 가는 접힘 선의 들쭉날쭉한 가장자리를 고른다."""
    out = mask.astype(float)
    for _ in range(2):
        pad = np.pad(out, r, mode='edge')
        acc = np.zeros_like(out)
        for dy in range(2 * r + 1):
            for dx in range(2 * r + 1):
                acc += pad[dy : dy + out.shape[0], dx : dx + out.shape[1]]
        out = acc / (2 * r + 1) ** 2
    return out > 0.5


def classify(rgb, alpha):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb.mean(axis=-1)
    green = (g - r > 35) & (lum < 170) & alpha
    eye = (lum < 115) & ~dilate(green, 3 * UP) & alpha
    tan = (lum < 215) & (r - b > 62) & ~green & ~eye & alpha
    # 실루엣 가장자리 띠에서만 1px 넓힌다 — 안쪽 접힘 선 굵기는 그대로
    rim = alpha & ~erode(alpha, 2 * UP)
    for m in (tan, green):
        m |= dilate(m, UP) & rim
    return {'tan': smooth(tan, UP) & ~green & alpha, 'green': green, 'eye': eye}


def potrace(mask, turd, args):
    with tempfile.TemporaryDirectory() as d:
        pbm = os.path.join(d, 'm.pbm')
        Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).convert('1').save(pbm)
        out = subprocess.run(
            ['potrace', pbm, '-b', 'svg', '--flat', '-t', str(turd), *args, '-u', '1', '-o', '-'],
            capture_output=True, text=True, check=True,
        ).stdout
    transform = re.search(r'<g transform="([^"]+)"', out).group(1)
    paths = re.findall(r' d="([^"]+)"', out)
    if not paths:
        return None
    return transform, re.sub(r'\s+', ' ', ' '.join(paths)).strip()


def write(dst, w, h, body, display_w, fid):
    freq = round(0.85 * display_w / w, 3)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-hidden="true">
  <defs>
    <filter id="g-{fid}"><feTurbulence type="fractalNoise" baseFrequency="{freq}" numOctaves="4" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.18"/></feComponentTransfer>
      <feComposite in2="SourceGraphic" operator="in"/></filter>
    <g id="{fid}">
{chr(10).join(body)}
    </g>
  </defs>
  <use href="#{fid}"/>
  <use href="#{fid}" filter="url(#g-{fid})" opacity="0.7"/>
</svg>
'''
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(svg)
    print(os.path.basename(dst), w, h, len(svg), 'bytes')


def trace(src, dst, kind, display_w, fid):
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    if kind == 'heat':
        # 원본이 작고 흐려 따면 가장자리가 울퉁불퉁하다 — 같은 자리 · 굵기로 손으로 그린다
        wave = 'M22 10C16 20 10 32 10 44C10 60 30 74 30 92C30 106 22 116 17 125'
        body = [f'    <g fill="none" stroke="{PALETTE["red"]}" stroke-width="9" stroke-linecap="round">']
        body += [f'      <path transform="translate({dx} 0)" d="{wave}"/>' for dx in (0, 39.5, 79)]
        body += ['    </g>']
        return write(dst, w, h, body, display_w, fid)

    big = np.asarray(img.resize((w * UP, h * UP), Image.LANCZOS)).astype(int)
    alpha = big[..., 3] > 128
    layers = [('cream', alpha), *classify(big[..., :3], alpha).items()]
    body = []
    for name, mask in layers:
        turd = (6 if name != 'eye' else 12) * UP * UP
        res = potrace(mask, turd, POTRACE[name])
        if res is None:
            continue
        transform, d = res
        body.append(f'    <path fill="{PALETTE[name]}" transform="scale({1 / UP:.6f}) {transform}" d="{d}"/>')
    return write(dst, w, h, body, display_w, fid)


if __name__ == '__main__':
    srcdir, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    for name, kind, display_w, fid in JOBS:
        trace(f'{srcdir}/{name}.png', f'{outdir}/{name}.svg', kind, display_w, fid)
