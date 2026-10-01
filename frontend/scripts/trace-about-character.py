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
- 초록 밴드(`IntroBand tone="brand"`, 배경 `--brand-700`) 위에 서는 두 장은 **머리 위로 솟은 귀**
  만 `--brand-500` 이다(#1089). 귀 · 배경이 같은 값이라 귀가 그레인 무늬로만 남아 흐릿했다.
  초록 층에서 가장 위 하위 경로를 떼어 칠한다(`split_band_ear`) — 도형은 그대로다.
- **황갈 · 초록 층은 자기 칠과 같은 색 선으로 원본 1px 바깥까지 넓힌다(`seal`, #1095).** 크림 층이
  실루엣 전체이고 색 층을 따로 따서 얹으므로 두 윤곽이 바깥 테두리를 같이 쓰는데, 정확히 겹치지
  않는다 — 색 층이 안쪽에서 멈춘 곳(대부분 원본 1px 이하)으로 크림이 비치고, 겹친 곳도 두 테두리의
  안티앨리어싱이 섞여 크림이 샌다. 초록 밴드 위에서 흰 테로 보였다. 넓히면 바깥 테두리를 색 층이
  혼자 그린다. 접힘 선이 원본 1px 씩 굵어지지만(히어로 황갈 면적 +9%) 표시 크기에서 구분되지 않는다.
  위의 "실루엣 가장자리에서 1px 넓힘" 만으로는 이 틈이 닫히지 않았다.
  **남은 얇은 테는 원본 PNG 에서 온다.** 원본 가장자리가 투명이 아니라 흰 바탕과 섞여 있어(발 아래
  `rgb(255,253,235)` · 불투명도 60%) `alpha > 128` 실루엣에 들고 크림으로 분류된다 — 폭 약 2px 이라
  1px 봉합이 절반만 덮는다. 2px 봉합은 코 · 목줄 · 다리 줄무늬가 눈에 띄게 굵어져(마무리 황갈 +39%)
  택하지 않았다. 마저 없애려면 다시 딸 때 `classify` 앞에서 가장자리의 흰 섞임 픽셀을 이웃 색으로
  바꾼다(원본 691×836 PNG 가 필요하다 — 저장소의 올려다보기 PNG 는 346×418 로 줄인 것이다).

이미 딴 SVG 를 고칠 때(potrace · 원본 PNG 없이, 표준 라이브러리만):

    python3 scripts/trace-about-character.py --band-ear public/illustrations/about
    python3 scripts/trace-about-character.py --seal public/illustrations/about
"""

import os
import re
import subprocess
import sys
import tempfile

UP = 3
PALETTE = {
    'cream': '#f2e6c9',  # 기존 일러스트 크림
    'tan': '#d4b487',  # 기존 일러스트 황갈
    'green': '#1d6646',  # --brand-700
    'band-ear': '#2e9b6b',  # --brand-500 — 초록 밴드 위 솟은 귀(#1089)
    'eye': '#15181d',  # --fg
    'red': '#d54040',  # 곡선의 노면 선과 같은 값
}
# 초록 밴드 위에 서는 자세 — 히어로 · 마무리 (#1089)
BAND_EAR = {'dog-sit-lookup', 'dog-sit-front'}
# 바깥 테두리를 색 층이 그리게 넓히는 층(#1095). 선 굵기는 path 좌표(3배 그림의 px)로 원본 2px —
# 양쪽으로 1px 씩. 모서리는 둥글게 이어 뾰족한 연결이 실루엣 밖으로 튀지 않게 한다.
SEALED = (PALETTE['tan'], PALETTE['green'], PALETTE['band-ear'])
SEAL_W = 2 * UP
# 층마다 potrace 인자 — 황갈은 가는 접힘 선이 많아 더 매끈하게
POTRACE = {
    'cream': ['-a', '1.1', '-O', '0.6'],
    'tan': ['-a', '1.3', '-O', '0.8'],
    'green': ['-a', '1.1', '-O', '0.6'],
    'eye': ['-a', '1.3', '-O', '0.6'],
}
# (파일, 종류, 최대 표시 폭 px — globals.css 캐릭터 블록, 그레인 결을 맞추는 데 쓴다, id)
JOBS = [
    ('dog-sit-lookup', 'dog', 240, 'dl'),
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


def top_y(sub):
    """potrace 하위 경로(M 뒤 상대 c · l)의 가장 높은 y — 조절점 포함. potrace 좌표는 y 가 위로 커진다."""
    arity = {'m': 2, 'l': 2, 'c': 6}
    y, best = 0.0, float('-inf')
    cmd, vals = None, []
    for token in re.findall(r'[A-Za-z]|-?\d+(?:\.\d+)?', sub):
        if token.isalpha():
            cmd, vals = token, []
            continue
        vals.append(float(token))
        if cmd is None or len(vals) < arity.get(cmd.lower(), 0):
            continue
        ys = vals[1::2]
        if cmd.isupper():
            best, y = max(best, *ys), ys[-1]
        else:
            best, y = max(best, *(y + v for v in ys)), y + ys[-1]
        vals = []
    return best


def split_band_ear(d):
    """초록 층 d 를 (솟은 귀, 나머지) 로 나눈다 — 귀 = 가장 위로 올라간 하위 경로."""
    subs = [s.strip() for s in re.split(r'(?=M)', d) if s.strip()]
    ear = max(range(len(subs)), key=lambda i: top_y(subs[i]))
    return subs[ear], ' '.join(s for i, s in enumerate(subs) if i != ear)


def green_paths(fill_attrs, d, band_ear):
    if not band_ear:
        return [f'    <path fill="{PALETTE["green"]}"{fill_attrs}d="{d}"/>']
    ear, rest = split_band_ear(d)
    return [
        f'    <path fill="{PALETTE["band-ear"]}"{fill_attrs}d="{ear}"/>',
        f'    <path fill="{PALETTE["green"]}"{fill_attrs}d="{rest}"/>',
    ]


def recolor_band_ear(outdir):
    """이미 딴 SVG 의 초록 층을 나눠 다시 쓴다 — potrace · 원본 PNG 가 필요 없다."""
    pattern = re.compile(rf'    <path fill="{PALETTE["green"]}"( [^>]*)d="([^"]+)"/>')
    for name in sorted(BAND_EAR):
        dst = f'{outdir}/{name}.svg'
        with open(dst, encoding='utf-8') as f:
            svg = f.read()
        match = pattern.search(svg)
        if match is None or PALETTE['band-ear'] in svg:
            print(name, 'skip')
            continue
        svg = svg.replace(match.group(0), '\n'.join(green_paths(match.group(1), match.group(2), True)))
        with open(dst, 'w', encoding='utf-8') as f:
            f.write(svg)
        print(name, 'ear split')


def seal(tag):
    """색 층 path 에 같은 색 선을 두른다. 이미 둘렀거나 색 층이 아니면 그대로 둔다."""
    fill = re.match(r'\s*<path fill="(#[0-9a-f]{6})"', tag)
    if fill is None or fill.group(1) not in SEALED or ' stroke=' in tag:
        return tag
    c = fill.group(1)
    return tag.replace(
        f'<path fill="{c}"', f'<path fill="{c}" stroke="{c}" stroke-width="{SEAL_W}" stroke-linejoin="round"', 1
    )


def seal_dogs(outdir):
    """이미 딴 개 SVG 의 색 층을 넓혀 다시 쓴다 — potrace · 원본 PNG 가 필요 없다."""
    for name, kind, _, _ in JOBS:
        if kind != 'dog':
            continue
        dst = f'{outdir}/{name}.svg'
        with open(dst, encoding='utf-8') as f:
            svg = f.read()
        sealed = re.sub(r'    <path [^>]*/>', lambda m: seal(m.group(0)), svg)
        if sealed == svg:
            print(name, 'skip')
            continue
        with open(dst, 'w', encoding='utf-8') as f:
            f.write(sealed)
        print(name, 'sealed')


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
        attrs = f' transform="scale({1 / UP:.6f}) {transform}" '
        if name == 'green':
            body += green_paths(attrs, d, os.path.basename(dst)[:-4] in BAND_EAR)
            continue
        body.append(f'    <path fill="{PALETTE[name]}"{attrs}d="{d}"/>')
    return write(dst, w, h, [seal(tag) for tag in body], display_w, fid)


if __name__ == '__main__':
    if sys.argv[1] in ('--band-ear', '--seal'):
        (recolor_band_ear if sys.argv[1] == '--band-ear' else seal_dogs)(sys.argv[2])
        sys.exit(0)
    # 다시 딸 때만 필요하다 — `--band-ear` · `--seal` 은 표준 라이브러리만 쓴다
    import numpy as np
    from PIL import Image

    srcdir, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    for name, kind, display_w, fid in JOBS:
        trace(f'{srcdir}/{name}.png', f'{outdir}/{name}.svg', kind, display_w, fid)
