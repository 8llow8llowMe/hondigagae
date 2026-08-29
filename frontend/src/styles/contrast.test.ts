import { describe, expect, it } from 'vitest'

import { contrastRatio, parseColorTokens, readTokensCss } from '@/test/tokens'

const tokens = parseColorTokens(readTokensCss())

function token(name: string): string {
  const value = tokens.get(name)
  if (value === undefined) throw new Error(`tokens.css 에 ${name} 이 없다`)

  return value
}

const WHITE = '#FFFFFF'

/**
 * DESIGN.md §2 가 선언한 대비를 실제로 계산해 지킨다.
 *
 * **AA 본문 4.5:1 · 대형(22px+/900 또는 18.66px+/700) 3:1** 기준이다.
 * 색을 바꾸면 여기서 먼저 깨진다 — 문서만 고치고 값을 못 고치는 일을 막는다.
 */
describe('토큰 대비 — 흰 배경 위 텍스트 (AA 4.5:1)', () => {
  const cases: [string, string][] = [
    ['--fg', '본문 · 제목'],
    ['--fg-muted', '보조 설명 · 메타 · 단위'],
    ['--link', '링크 · 인라인 액션'],
    ['--link-hover', '링크 hover'],
    ['--metric-high-700', '등급 텍스트 HIGH'],
    ['--metric-mid-700', '등급 텍스트 MID'],
    ['--metric-low-700', '등급 텍스트 LOW'],
    ['--metric-critical-700', '등급 텍스트 CRITICAL'],
    ['--accent-700', 'AI 표시'],
    ['--danger-500', '오류 문장'],
    ['--danger-900', '메뉴 안 파괴적 항목'],
  ]

  it.each(cases)('%s (%s) 가 4.5:1 이상이다', (name) => {
    expect(contrastRatio(token(name), WHITE)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('토큰 대비 — tint 배경 위 텍스트는 -700 을 쓴다 (AA 4.5:1)', () => {
  const cases: [string, string][] = [
    ['critical', '위험'],
    ['high', '적합도 높음'],
    ['mid', '적합도 보통'],
    ['low', '적합도 낮음'],
  ]

  it.each(cases)('metric-%s 의 -700 이 자기 tint 위에서 4.5:1 이상이다', (tone) => {
    const ratio = contrastRatio(token(`--metric-${tone}-700`), token(`--metric-${tone}-100`))

    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it.each(cases)('metric-%s 램프가 단조롭다 — -700 이 -500 보다 어둡다', (tone) => {
    // "-500 은 항상 미달" 이 아니다. 실제로 --metric-high-500 은 자기 tint 위에서
    // 4.51:1 로 AA 를 통과한다. 규칙의 요지는 **-700 이 항상 안전하다**는 것이고,
    // -500 은 그 보장이 없다는 것이다. 그래서 여기서는 램프의 순서만 지킨다 —
    // -700 이 -500 보다 밝아지면 세 층의 역할(tint / 마크 / 텍스트)이 뒤집힌다.
    const tint = token(`--metric-${tone}-100`)
    const mark = contrastRatio(token(`--metric-${tone}-500`), tint)
    const text = contrastRatio(token(`--metric-${tone}-700`), tint)

    expect(text).toBeGreaterThan(mark)
  })

  it('AI 표시 텍스트가 accent tint 위에서 4.5:1 이상이다', () => {
    expect(contrastRatio(token('--accent-700'), token('--accent-100'))).toBeGreaterThanOrEqual(4.5)
  })

  it('오류 텍스트가 danger tint 위에서 4.5:1 이상이다', () => {
    expect(contrastRatio(token('--danger-700'), token('--danger-100'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('토큰 대비 — band · 선택 행 위에서도 읽힌다', () => {
  it.each([['--fg'], ['--fg-muted']])('%s 가 --band 위에서 4.5:1 이상이다', (name) => {
    expect(contrastRatio(token(name), token('--band'))).toBeGreaterThanOrEqual(4.5)
  })

  it.each([['--fg'], ['--fg-muted']])('%s 가 --row-selected 위에서 4.5:1 이상이다', (name) => {
    expect(contrastRatio(token(name), token('--row-selected'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('토큰 대비 — 채운 표면 위 흰 글자', () => {
  it('주요 버튼은 16/600 대형 텍스트라 3:1 기준이다', () => {
    const ratio = contrastRatio(token('--fg-inverse'), token('--brand-500'))

    expect(ratio).toBeGreaterThanOrEqual(3)
    // 4.5 를 넘지 못하므로 --brand-500 위에 작은 글자를 두면 안 된다
    expect(ratio).toBeLessThan(4.5)
  })

  it('버튼 hover(--brand-600)는 본문 대비까지 확보한다', () => {
    expect(contrastRatio(token('--fg-inverse'), token('--brand-600'))).toBeGreaterThanOrEqual(4.5)
  })

  it('파괴 버튼 채움 위 흰 글자가 4.5:1 이상이다', () => {
    expect(contrastRatio(token('--fg-inverse'), token('--danger-700'))).toBeGreaterThanOrEqual(4.5)
  })

  it('Toast 표면 위 흰 글자가 4.5:1 이상이다', () => {
    expect(contrastRatio(token('--fg-inverse'), token('--fg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('카카오 버튼 글자가 브랜드 배경 위에서 4.5:1 이상이다', () => {
    expect(contrastRatio(token('--kakao-fg'), token('--kakao-bg'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('토큰 대비 — 텍스트로 쓰면 안 되는 값', () => {
  it('--fg-subtle 은 본문 대비에 미달한다 (placeholder·비활성 전용)', () => {
    expect(contrastRatio(token('--fg-subtle'), WHITE)).toBeLessThan(4.5)
  })

  it('--metric-mid-500 은 흰 배경에서 본문 대비에 미달한다 (12px 텍스트 금지)', () => {
    const ratio = contrastRatio(token('--metric-mid-500'), WHITE)

    expect(ratio).toBeLessThan(4.5)
    // 3:1 은 넘으므로 지표 바·stroke 아이콘·22px/900 숫자에는 쓸 수 있다
    expect(ratio).toBeGreaterThanOrEqual(3)
  })

  it('--metric-unknown-500 은 3:1 에도 미달한다 (점선 테두리 전용)', () => {
    expect(contrastRatio(token('--metric-unknown-500'), WHITE)).toBeLessThan(3)
  })
})
