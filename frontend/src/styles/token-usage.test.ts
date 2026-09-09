import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * 소스 전역에서 **토큰 오용**을 잡는다 — 이슈 #50 의 "대비 회귀 테스트".
 *
 * `contrast.test.ts` 가 **값**을 지키고, 이 파일은 **쓰임**을 지킨다.
 * 토큰 값이 아무리 옳아도 tint 배경 위에 `-500` 을 얹으면 화면에서는 대비가 무너진다.
 * lint 는 이것을 못 잡는다 (arbitrary value 가 아니라 정상 토큰 클래스이기 때문이다).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

function sourceFiles(): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = []

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue

      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      // 테스트 자신은 금지 문자열을 예시로 담으므로 제외한다
      if (!/\.tsx?$/.test(entry) || entry.endsWith('.test.ts')) continue

      files.push({ path: full.slice(ROOT.length), text: readFileSync(full, 'utf8') })
    }
  }

  for (const dir of ['src', 'app']) walk(join(ROOT, dir))

  return files
}

const FILES = sourceFiles()

/**
 * 문자열 리터럴을 뽑되 **주석 안은 보지 않는다** (#306).
 *
 * 정규식으로 따옴표만 훑으면 주석 안의 백틱도 코드로 집힌다. 실제로
 * `plan-day-regenerate-confirm.tsx` 의 *"`text-danger` 는 이 저장소의 토큰이 아니다"* 라는
 * **경고 주석**이 위반으로 잡혔다 — 같은 실수를 막으려고 적어 둔 문장이 그 실수로 세어졌다.
 *
 * 그래서 상태 기계로 훑는다. 줄 주석과 블록 주석을 건너뛰고 문자열만 모은다.
 * `'https://...'` 처럼 **문자열 안의 `//` 는 주석이 아니다** — 상태를 들고 있어야 갈린다.
 */
function stringLiterals(text: string): string[] {
  const found: string[] = []
  let index = 0

  while (index < text.length) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '/' && next === '/') {
      index = text.indexOf('\n', index)
      if (index === -1) break
      continue
    }

    if (char === '/' && next === '*') {
      const end = text.indexOf('*/', index + 2)
      index = end === -1 ? text.length : end + 2
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      const quote = char
      let cursor = index + 1
      let value = ''

      while (cursor < text.length) {
        const inner = text[cursor]
        // 이스케이프는 다음 글자와 함께 삼킨다 — `\'` 가 문자열을 끝내면 안 된다
        if (inner === '\\') {
          value += text.slice(cursor, cursor + 2)
          cursor += 2
          continue
        }
        if (inner === quote) break
        // 줄바꿈이 있는 '·" 리터럴은 없다. 여기서 끊어야 따옴표 짝이 어긋난 채 파일을 삼키지 않는다
        if (inner === '\n' && quote !== '`') break
        value += inner
        cursor += 1
      }

      found.push(value)
      index = cursor + 1
      continue
    }

    index += 1
  }

  return found
}

/** className 문자열 리터럴만 본다. 한 리터럴 안에 함께 있으면 같은 요소에 적용된 것이다 */
function classLiterals(text: string): string[] {
  return stringLiterals(text).filter((literal) => /\b(bg|text|border)-/.test(literal))
}

/**
 * 변형 접두어(`md:` · `hover:` · `focus-visible:` …)를 떼고 유틸리티 이름만 남긴다.
 * 접두어가 붙었다고 스케일이 달라지지 않는다.
 */
function bareUtility(token: string): string {
  return token.replace(/^(?:[a-z0-9@[\]().<>_-]+:)+/, '')
}

function violations(predicate: (literal: string) => boolean): string[] {
  return FILES.flatMap(({ path, text }) =>
    classLiterals(text)
      .filter(predicate)
      .map((literal) => `${path} :: ${literal}`),
  )
}

const TINT_FAMILIES = [
  'metric-critical',
  'metric-high',
  'metric-mid',
  'metric-low',
  'accent',
  'danger',
]

describe('토큰 사용 — tint 배경 위 텍스트에 -500 을 쓰지 않는다 (DESIGN.md §2)', () => {
  it.each(TINT_FAMILIES)('%s 계열에서 bg-*-100 과 text-*-500 이 같이 오지 않는다', (family) => {
    const found = violations(
      (literal) => literal.includes(`bg-${family}-100`) && literal.includes(`text-${family}-500`),
    )

    expect(found).toEqual([])
  })

  it('band 배경 위에 metric -500 텍스트를 얹지 않는다', () => {
    const found = violations(
      (literal) => literal.includes('bg-band') && /text-metric-[a-z]+-500/.test(literal),
    )

    expect(found).toEqual([])
  })
})

describe('토큰 사용 — 텍스트로 금지된 값', () => {
  it('--metric-mid-500 을 caption(12px) 텍스트에 쓰지 않는다 — 흰 배경 3.85:1', () => {
    const found = violations(
      (literal) => literal.includes('text-metric-mid-500') && literal.includes('text-caption'),
    )

    expect(found).toEqual([])
  })

  it('--metric-unknown-500 을 어떤 텍스트에도 쓰지 않는다 — 점선 테두리 전용', () => {
    const found = violations((literal) => literal.includes('text-metric-unknown-500'))

    expect(found).toEqual([])
  })
})

describe('토큰 사용 — 폐기한 토큰이 되살아나지 않는다 (DESIGN.md §2-7)', () => {
  /**
   * **`brand-700` 은 이 목록에서 빠졌다** — 이슈 #61 에서 되살렸다.
   * 채운 버튼이 `--brand-500` → `--brand-600` 으로 내려가면서 hover 가 한 단계 더
   * 필요해졌다. 폐기 사유("아트보드 사용 0회")가 더 이상 성립하지 않는다.
   */
  const RETIRED = [
    'bg-subtle',
    'warn-100',
    'warn-500',
    'warn-700',
    'info-100',
    'info-500',
    'info-700',
    'success-500',
    'brand-50',
    'brand-100',
    'brand-300',
    'accent-500',
    'accent-600',
    'shadow-sm',
    'text-button',
  ]

  it.each(RETIRED)('%s 이 소스에 남아 있지 않다', (retired) => {
    // brand-500 이 brand-50 에 걸리지 않도록 경계를 본다
    const pattern = new RegExp(`\\b(bg|text|border|ring|shadow|from|to)-${retired}\\b`)
    const found = violations((literal) => pattern.test(literal))

    expect(found).toEqual([])
  })
})

describe('토큰 사용 — 표면 규칙 (DESIGN.md §0)', () => {
  it('평평한 행·섹션에 그림자를 쓰지 않는다 — shadow 는 떠 있는 것에만', () => {
    // 실제로 떠 있는 것만 그림자를 쓴다. 목록에 추가하려면 그것이 페이지 위에 뜨는지
    // 먼저 확인한다 — 평면 카드를 띄우려고 여기에 넣는 것이 이 규칙을 무너뜨리는 경로다.
    const FLOATING = [
      'src/components/menu.tsx',
      'src/components/toast.tsx',
      'src/components/bottom-sheet.tsx',
      // 다이얼로그 표면은 Modal 이 소유한다 — ConfirmModal 은 그림자를 직접 그리지 않는다
      'src/components/modal.tsx',
      // 반려견 스위처 드롭다운 — Menu 와 같은 팝오버다
      'src/features/nav/pet-switcher.tsx',
      // 홈 프로필 카드의 반려견 전환 팝오버
      'src/features/home/profile-card.tsx',
      // 헤더 계정 팝오버
      'src/features/nav/account-menu.tsx',
      // 물음표를 눌러 여는 근거 말풍선 (#313) — Menu 와 같은 팝오버다
      'src/components/info-tip.tsx',
      // 날짜 필드의 달력 — `document.body` 로 포털된 `fixed` 팝오버다. 흐름 안에서
      // 펼치던 때는 떠 있지 않아 그림자가 없었는데, 이제 진짜로 페이지 위에 뜬다
      'src/components/date-field.tsx',
      // ── 지도 위에 뜨는 표면 (이슈 #14) ────────────────────────────────
      // 아트보드 `혼디가개 장소 찾기` 05·06 은 **지도가 바탕이고 목록이 그 위에 얹히는**
      // 구조다. 지도와 같은 평면에 두면 어디까지가 패널인지 읽히지 않는다.
      'src/components/map-sheet.tsx',
      'src/features/place/place-map-view.tsx',
      // 긴급 시설 지도 보기 — `place-map-view.tsx` 와 같은 구조다(#353) - 지도가
      // 바탕이고 좌측 패널·접기 탭이 그 위에 뜬다
      'src/features/emergency/emergency-map-view.tsx',
      // 지도 우상단에 얹히는 현재 위치 버튼 — 보기 전환 토글과 같은 스택에 뜬다
      'src/features/map/map-locate-button.tsx',
      // 마커를 고르면 지도 위에 뜨는 카드 (`혼디가개 긴급 시설` 02)
      'src/features/emergency/facility-selected-card.tsx',
      // ── 드래그 중인 항목 (DESIGN.md §6 이 --shadow-md 용도에 명시한다) ─────
      // 끌고 있는 행은 손끝에 들려 목록 위에 떠 있다. 평면 카드를 띄우려고 이 목록에
      // 넣는 것이 규칙을 무너뜨리는 경로이므로, 여기 추가하기 전에 그것이 **실제로
      // 페이지 위에 뜨는지** 먼저 확인한다.
      'src/features/plan/plan-editable-item-row.tsx',
    ]

    const found = FILES.filter(({ path }) => !FLOATING.includes(path.replace(/\\/g, '/'))).flatMap(
      ({ path, text }) =>
        classLiterals(text)
          .filter((literal) => /\bshadow-(md|lg)\b/.test(literal))
          .map((literal) => `${path} :: ${literal}`),
    )

    expect(found).toEqual([])
  })
})

/**
 * 등급 톤 매핑은 **한 곳이 소유한다.**
 *
 * `MetricBadge` / `MetricValue` / `MetricWord` 가 이미 있는데 화면이 그것을 쓰지 않고
 * 같은 `Record<MetricTone, string>` 을 다시 만드는 일이 실제로 세 곳에서 벌어졌다
 * (`walk-verdict` · `place-insight-row` · 점선 unknown 배지 2곳 — 이슈 #68).
 *
 * **등급 색 하나를 바꿀 때 한 곳만 놓치면 화면마다 등급 색이 갈린다.** 위의 토큰 오용
 * 검사로는 잡히지 않는다 — 복제된 표도 정상 토큰 클래스를 쓰기 때문이다.
 *
 * 두 소유자만 허용한다.
 *  - `src/components/metric.tsx` — 톤 → 클래스
 *  - `src/lib/insight/tone.ts` — 축별 code → 톤 (축마다 의미가 뒤집혀 공용 매퍼가 함정이다)
 */
describe('등급 톤 매핑은 metric.tsx 가 소유한다', () => {
  const OWNERS = ['src/components/metric.tsx', 'src/lib/insight/tone.ts']

  it('화면 코드가 Record<MetricTone, …> 을 다시 만들지 않는다', () => {
    const found = FILES.filter(
      ({ path, text }) =>
        !OWNERS.includes(path.replaceAll('\\', '/')) && /Record<\s*MetricTone\s*,/.test(text),
    ).map(({ path }) => path)

    expect(found).toEqual([])
  })

  it('화면 코드가 metric 토큰 클래스를 직접 나열하지 않는다', () => {
    // 한 리터럴 안에 서로 다른 등급 계열이 둘 이상 = 톤 표를 손으로 편 것이다
    const families = ['metric-critical', 'metric-high', 'metric-mid', 'metric-low']

    const found = FILES.filter(({ path }) => !OWNERS.includes(path.replaceAll('\\', '/'))).flatMap(
      ({ path, text }) => {
        const lines = text.split('\n')
        return lines.flatMap((line, index) => {
          const hit = families.filter((family) => line.includes(`-${family}-`))
          return hit.length >= 2 ? [`${path}:${index + 1}`] : []
        })
      },
    )

    expect(found).toEqual([])
  })
})

/**
 * `--brand-500` 위에 글자를 얹지 않는다 — 이슈 #61.
 *
 * 500 위 흰 글자는 **3.49:1** 이라 16px 라벨(본문 취급)에 필요한 4.5:1 에 미달한다.
 * 채운 버튼은 `--brand-600`(5.27:1)이고, 500 은 포커스 링·선택 표시기처럼 **글자가
 * 얹히지 않는 비텍스트 요소** 전용이다 (그쪽은 3:1 기준이라 통과한다).
 *
 * `contrast.test.ts` 가 **값**을 지키고 이 테스트가 **쓰임**을 지킨다 — 토큰 값이 옳아도
 * `bg-brand-500` 위에 `text-fg-inverse` 를 얹으면 화면에서는 대비가 무너진다.
 */
describe('토큰 사용 — --brand-500 위에 글자를 얹지 않는다 (이슈 #61)', () => {
  it('bg-brand-500 과 텍스트 색이 같은 요소에 오지 않는다', () => {
    const found = violations(
      (literal) => literal.includes('bg-brand-500') && /\btext-(fg-inverse|white)\b/.test(literal),
    )

    expect(found).toEqual([])
  })
})

/**
 * 스페이싱 스케일 — `DESIGN.md` §4 (#306).
 *
 * `4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`. 문서는 *"스케일 밖 값을 쓰지 않는다"*
 * 고 적어 두었는데 **어긋나도 아무것도 실패하지 않았다.** lint 는 못 잡는다 — `py-3.5` 는
 * arbitrary value(`p-[14px]`)가 아니라 문법상 멀쩡한 Tailwind 클래스다.
 *
 * `0` 은 스케일 밖이 아니라 **간격 없음**이라 함께 허용한다.
 */
const SPACING_SCALE_PX = [0, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64]

/**
 * 간격 유틸리티만 본다 — margin · padding · gap · space.
 *
 * **크기(`w-2` · `h-8` · `size-11`)는 대상이 아니다.** §4 는 간격의 스케일이고, 크기는
 * 아이콘·터치 영역·썸네일처럼 각자 근거가 다른 값이다.
 *
 * 논리 방향(`ms` · `me`)과 음수(`-mx-1`)를 함께 잡는다 — 부호가 바뀐다고 스케일이 달라지지 않는다.
 */
const SPACING_UTILITY = /^-?(?:[mp][trblxyse]?|gap(?:-[xy])?|space-[xy])-([0-9]+(?:\.[0-9]+)?)$/

/**
 * **남은 위반은 두 곳뿐이다.** #306 이 44곳으로 시작해 #334(20) · #335(8) · #336(5) ·
 * #337(9) 로 비웠고, 아래 하나만 **결정 대기**로 남아 있다.
 *
 * **이 표는 줄어드는 방향으로만 고친다.** 값이 정확히 일치해야 하므로, 하나를 고치면 숫자를
 * 함께 낮춰야 테스트가 통과한다 — 목록이 조용히 늘지도, 고친 것이 조용히 되돌아오지도 않는다.
 *
 * **이 표가 비면 표째로 걷고 0 으로 잠근다.** 빈 표를 남겨 두면 다음 사람이 "여기 적으면
 * 통과하는구나" 로 읽는다.
 */
const SPACING_BASELINE: Record<string, number> = {
  /*
    **아트보드 값이라 남긴다** (#335). 폼 컨트롤 칩 두 곳(`ai-plan-create-form.tsx`)이고,
    그 자리 주석이 *"규약이 같다고 값까지 맞추지 않는다 — 맞추면 아트보드에서 멀어진다"* 라고
    이미 한 번 판단해 두었다 (필터 칩 6px 과 갈라 둔 결정). **아트보드와 §4 스케일이
    부딪히는 자리**라 FE 가 단독으로 정하지 않는다 — 디자인 결정이 나오면 그때 비운다.
  */
  'gap-2.5': 2,
}

function spacingUsage(): { counts: Record<string, number>; places: string[] } {
  const counts: Record<string, number> = {}
  const places: string[] = []

  for (const { path, text } of FILES) {
    for (const literal of stringLiterals(text)) {
      for (const token of literal.split(/\s+/)) {
        const utility = bareUtility(token)
        const match = SPACING_UTILITY.exec(utility)
        if (match === null) continue

        // Tailwind 기본 스케일은 1 = 0.25rem = 4px 다
        const px = Number(match[1]) * 4
        if (SPACING_SCALE_PX.includes(px)) continue

        counts[utility] = (counts[utility] ?? 0) + 1
        places.push(`${path} :: ${utility}`)
      }
    }
  }

  return { counts, places }
}

describe('토큰 사용 — 스페이싱 스케일 (DESIGN.md §4)', () => {
  /*
    **`gap-1.5` 를 잡으면 안 된다.** `1.5 × 4 = 6` 이고 6 은 스케일 안 값이다 (§4 가
    "태그 사이" 용도로 신설했다). `.5` 가 붙었다고 스케일 밖이 아니다 — 이 오탐이 나면
    저장소 전역에서 정상 값이 위반으로 뜬다.
  */
  it('스케일 안의 .5 값(6px)을 오탐하지 않는다', () => {
    const { counts } = spacingUsage()

    expect(Object.keys(counts).filter((key) => /-1\.5$/.test(key))).toEqual([])
  })

  /* 0 은 간격 없음이다. 스케일 밖으로 세면 `p-0` 이 전부 위반이 된다 */
  it('0 을 위반으로 세지 않는다', () => {
    const { counts } = spacingUsage()

    expect(Object.keys(counts).filter((key) => /-0$/.test(key))).toEqual([])
  })

  /*
    **새 위반이 들어오면 여기서 걸린다.** 기존 44곳은 baseline 이 통과시킨다.
    실패하면 `places` 가 어느 파일인지 말한다.
  */
  it('스케일 밖 값이 baseline 보다 늘지 않는다', () => {
    const { counts, places } = spacingUsage()
    const grown = Object.keys(counts).filter(
      (utility) => (counts[utility] ?? 0) > (SPACING_BASELINE[utility] ?? 0),
    )

    // 실패했을 때 **어느 파일인지** 보이게 함께 싣는다 — 클래스 이름만으로는 찾을 수 없다
    expect(
      places.filter((place) => grown.some((utility) => place.endsWith(` :: ${utility}`))),
    ).toEqual([])
  })

  /*
    **줄었으면 baseline 도 낮춘다.** 고친 것이 조용히 되돌아오는 것을 막는 쪽이 이 표의
    값어치다 — 숫자를 낮추지 않으면 같은 자리에 다시 들어와도 통과한다.
  */
  it('baseline 이 실측과 정확히 같다 — 고쳤으면 숫자를 낮춘다', () => {
    const { counts } = spacingUsage()

    expect(counts).toEqual(SPACING_BASELINE)
  })
})

/**
 * 타이포·색 토큰 — `DESIGN.md` §3-1 · §2 (#306).
 *
 * **`--text-*` 에 없는 이름을 쓰면 클래스가 아무 일도 하지 않고 상속 크기로 조용히 렌더된다.**
 * 실제로 `text-title-3` 이 4곳에 있었다 — 홈 골든타임의 추천 시각이 22px 의도였는데 16px 로
 * 나갔고, 그 결과 섹션 제목과 픽셀 단위로 같고 등급어(20px)보다 작았다 (#310 에서 걷었다).
 *
 * 지금은 **0곳**이라, 0 을 지키는 데 허용 목록이 필요 없다.
 *
 * **`text-` 접두어에 세 가지가 섞여 있다.**
 *
 * | 갈래 | 예 | 출처 |
 * |------|----|------|
 * | 크기 | `text-title-1` | `app/globals.css` 의 `--text-*` |
 * | 색   | `text-fg-muted` | 같은 파일의 `--color-*` |
 * | 레이아웃 빌트인 | `text-center` · `text-balance` | Tailwind |
 *
 * **토큰 목록을 여기 옮겨 적지 않는다.** CSS 에서 읽으므로 토큰이 늘어도 이 파일은 그대로다 —
 * 베껴 적으면 두 곳이 갈린다.
 *
 * **Tailwind 기본 크기·색(`text-xs` · `text-white`)은 허용하지 않는다.** 죽은 클래스는
 * 아니지만 §3-1 의 7단과 §2 의 색 토큰을 우회한다 — 지금 0곳이라 여기서 함께 잠근다.
 */
const TEXT_LAYOUT_UTILITIES = [
  'left',
  'center',
  'right',
  'justify',
  'start',
  'end',
  'wrap',
  'nowrap',
  'balance',
  'pretty',
  'ellipsis',
  'clip',
]

function definedTextNames(): Set<string> {
  const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
  const names = new Set(TEXT_LAYOUT_UTILITIES)

  // `--text-title-1: 22px` · `--text-title-1--line-height: 30px` 둘 다 담긴다. 후자는 쓰이지 않을 뿐이다
  for (const match of css.matchAll(/--text-([a-z0-9-]+):/g)) names.add(match[1] ?? '')
  for (const match of css.matchAll(/--color-([a-z0-9-]+):/g)) names.add(match[1] ?? '')

  return names
}

describe('토큰 사용 — text-* 는 토큰이거나 빌트인이어야 한다 (DESIGN.md §3-1 · §2)', () => {
  const defined = definedTextNames()

  it('토큰에 없는 이름을 쓰지 않는다 — 죽은 클래스는 조용히 상속 크기로 렌더된다', () => {
    const found = FILES.flatMap(({ path, text }) =>
      stringLiterals(text)
        .flatMap((literal) => literal.split(/\s+/))
        .map(bareUtility)
        .filter((utility) => {
          const match = /^text-([a-z0-9-]+)$/.exec(utility)
          return match !== null && !defined.has(match[1] ?? '')
        })
        .map((utility) => `${path} :: ${utility}`),
    )

    expect(found).toEqual([])
  })

  /* 하네스가 실제로 토큰을 읽고 있는지 — 빈 집합이면 위 테스트가 언제나 통과한다 */
  it('토큰 목록을 globals.css 에서 읽는다', () => {
    expect(defined.has('title-1')).toBe(true)
    expect(defined.has('fg-muted')).toBe(true)
    expect(defined.has('title-3')).toBe(false)
    expect(defined.has('danger')).toBe(false)
  })
})
