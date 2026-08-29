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

/** className 문자열 리터럴만 본다. 한 리터럴 안에 함께 있으면 같은 요소에 적용된 것이다 */
function classLiterals(text: string): string[] {
  return [...text.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g)]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? '')
    .filter((literal) => /\b(bg|text|border)-/.test(literal))
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
      'src/components/confirm-modal.tsx',
      // 반려견 스위처 드롭다운 — Menu 와 같은 팝오버다
      'src/features/nav/pet-switcher.tsx',
      // 홈 프로필 카드의 반려견 전환 팝오버
      'src/features/home/profile-card.tsx',
      // 헤더 계정 팝오버
      'src/features/nav/account-menu.tsx',
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
