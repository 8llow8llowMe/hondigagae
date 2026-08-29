import { describe, expect, it } from 'vitest'

import {
  normalizeHex,
  parseColorTokens,
  readDesignMd,
  readGlobalsCss,
  readTokensCss,
} from '@/test/tokens'

/**
 * `DESIGN.md` ↔ `tokens.css` 동기 검사.
 *
 * **`tokens.css` 는 `DESIGN.md` 의 수동 동기다.** 두 파일을 함께 고치지 않으면 조용히
 * 갈라지고, 화면을 봐도 알아채기 어렵다 — 실제로 2차 세트에서 한 세대가 벌어진 채로
 * 지나갔다 (이슈 #50). 그때 코드는 `--fg: #1A1D1B`, 문서는 `#15181D` 였다.
 *
 * 사람이 두 파일을 대조하는 대신 `pnpm verify` 가 대조한다.
 *
 * **값(hex)을 기준으로 본다.** 토큰 이름은 문서에서 표 헤더·산문 등 여러 형태로
 * 등장하지만, hex 는 표기만 맞추면 기계적으로 비교할 수 있다.
 */

const css = readTokensCss()
const design = readDesignMd()

const cssTokens = parseColorTokens(css)

/** 문서 안의 `#RRGGBB` 를 전부 걷는다 */
const designHexes = new Set(
  [...design.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((match) => normalizeHex(match[0])),
)

describe('토큰 동기 — tokens.css 의 색이 DESIGN.md 에 있다', () => {
  it('선언된 색 토큰이 하나도 빠짐없이 문서에 적혀 있다', () => {
    const missing = [...cssTokens.entries()]
      .filter(([, value]) => !designHexes.has(value))
      .map(([name, value]) => `${name}: ${value}`)

    expect(missing).toEqual([])
  })
})

describe('토큰 동기 — DESIGN.md 의 색이 tokens.css 에 있다', () => {
  it('문서가 정의한 색이 하나도 빠짐없이 구현돼 있다', () => {
    const implemented = new Set(cssTokens.values())
    const missing = [...designHexes].filter((hex) => !implemented.has(hex))

    expect(missing).toEqual([])
  })
})

describe('토큰 동기 — 이름도 함께 적혀 있다', () => {
  it('tokens.css 가 선언한 토큰 이름이 문서에 등장한다', () => {
    // 값만 맞고 이름이 문서에 없으면, 그 토큰을 언제 써야 하는지 아무도 모른다.
    const declared = [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1] ?? '')
    const missing = [...new Set(declared)].filter((name) => !documented(name))

    expect(missing).toEqual([])
  })
})

/**
 * 문서가 램프를 `--metric-high-*` 처럼 와일드카드로 적는 것을 허용한다.
 * 세 층(`-100`/`-500`/`-700`)을 전부 풀어 쓰면 표가 읽히지 않는다.
 */
function documented(name: string): boolean {
  if (design.includes(name)) return true

  const wildcard = name.replace(/-(?:100|500|600|700|900)$/, '-*')

  return wildcard !== name && design.includes(wildcard)
}

describe('토큰 동기 — 폐기한 토큰이 되살아나지 않는다', () => {
  const RETIRED = [
    '--bg-subtle',
    '--warn-100',
    '--warn-500',
    '--warn-700',
    '--info-100',
    '--info-500',
    '--info-700',
    '--success-500',
    '--brand-50',
    '--brand-100',
    '--brand-300',
    '--brand-700',
    '--accent-500',
    '--accent-600',
    '--shadow-sm',
  ]

  it.each(RETIRED)('%s 이 tokens.css 에 선언돼 있지 않다', (name) => {
    const declared = new RegExp(`^\\s*${name}\\s*:`, 'm').test(css)

    expect(declared).toBe(false)
  })
})

describe('토큰 동기 — globals.css 가 색 토큰을 전부 노출한다', () => {
  it('색 토큰마다 @theme 매핑이 있다', () => {
    // 매핑이 빠지면 Tailwind 유틸리티(`bg-band` 등)가 아예 생성되지 않는다.
    // 클래스는 조용히 무시되므로 화면을 봐도 "왜 색이 안 먹지" 로만 보인다.
    const theme = readGlobalsCss()
    const unmapped = [...cssTokens.keys()].filter((name) => !theme.includes(`var(${name})`))

    expect(unmapped).toEqual([])
  })

  it('@theme inline 을 쓴다 — 일반 @theme 은 같은 이름을 되받을 때 자기참조가 된다', () => {
    // `--radius-sm: var(--radius-sm)` 을 일반 @theme 으로 내보내면 :root 에 자기참조가
    // 생겨 값이 무효가 된다. 실제로 그 상태로 지나간 적이 있다 (이슈 #50).
    expect(readGlobalsCss()).toContain('@theme inline')
  })
})
