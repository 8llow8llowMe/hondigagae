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
    'brand-700',
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
    const FLOATING = [
      'src/components/menu.tsx',
      'src/components/toast.tsx',
      'src/components/bottom-sheet.tsx',
      'src/components/confirm-modal.tsx',
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
