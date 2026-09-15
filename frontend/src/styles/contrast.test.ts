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

/**
 * 혼잡도 막대는 **흰 배경이 아니라 트랙 위**에 그려진다 (#603).
 *
 * 흰 배경으로 재면 통과하는데 화면에서는 안 보이는 값이 나온다 — 막대는 `--band`
 * 트랙 안에 들어앉기 때문이다. "연한 파랑" 을 더 연하게 가져갈 수 없는 이유가 여기 있고,
 * 이 테스트가 그 바닥을 지킨다.
 */
describe('토큰 대비 — 혼잡도 막대는 트랙(--band) 위에서 잰다 (비텍스트 3:1)', () => {
  it.each([['--congestion-bar'], ['--congestion-best']])('%s 가 3:1 이상이다', (name) => {
    expect(contrastRatio(token(name), token('--band'))).toBeGreaterThanOrEqual(3)
  })

  it('고른 날(best)이 나머지(bar)보다 확실히 진하다', () => {
    const bar = contrastRatio(token('--congestion-bar'), token('--band'))
    const best = contrastRatio(token('--congestion-best'), token('--band'))

    // 두 배 차이를 요구한다. 한 끗 차이면 "이 날이 답" 이 한눈에 안 읽힌다
    expect(best).toBeGreaterThanOrEqual(bar * 2)
  })
})

describe('토큰 대비 — 채운 표면 위 흰 글자', () => {
  /**
   * **주요 버튼 채움은 `--brand-600` 이다** (이슈 #61).
   *
   * 라벨은 16px/600 인데 WCAG 대형 텍스트는 24px 이상 또는 18.66px 이상 + bold 다.
   * 16px 은 bold 여도 본문이라 **4.5:1** 이 필요하다. 디자인 가이드가 이것을
   * "16px/600 = AA 대형" 으로 잘못 적은 것이 출발점이었다.
   */
  it('주요 버튼 채움(--brand-600) 위 흰 글자가 본문 대비를 확보한다', () => {
    expect(contrastRatio(token('--fg-inverse'), token('--brand-600'))).toBeGreaterThanOrEqual(4.5)
  })

  it('버튼 hover(--brand-700)도 본문 대비를 유지한다', () => {
    expect(contrastRatio(token('--fg-inverse'), token('--brand-700'))).toBeGreaterThanOrEqual(4.5)
  })

  it('hover 가 기본 채움보다 실제로 어둡다 — 눌린 것이 보여야 한다', () => {
    const base = contrastRatio(token('--fg-inverse'), token('--brand-600'))
    const hover = contrastRatio(token('--fg-inverse'), token('--brand-700'))

    expect(hover).toBeGreaterThan(base)
  })

  /**
   * `--brand-500` 은 **글자를 얹지 않는 곳**에만 남는다 — 포커스 링, 선택 표시기.
   * 비텍스트 요소는 3:1 기준이라 3.49:1 로 통과한다.
   *
   * 4.5 미만임을 함께 단언한다. 언젠가 500 이 4.5 를 넘게 바뀌면 이 구분 자체가
   * 필요 없어지므로, 그때 이 테스트가 먼저 알려준다.
   */
  it('--brand-500 은 비텍스트 3:1 만 만족한다 — 글자를 얹지 않는다', () => {
    const ratio = contrastRatio(token('--fg-inverse'), token('--brand-500'))

    expect(ratio).toBeGreaterThanOrEqual(3)
    expect(ratio).toBeLessThan(4.5)
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

/**
 * 날씨 픽토그램 색 — DESIGN.md §9-1 (#342).
 *
 * **1.5px 선 아이콘이라 비텍스트 3:1 기준이다.** 값 자체는 여기가 지키고, "글자에 얹지
 * 않는다" 는 쓰임은 `token-usage.test.ts` 가 지킨다 — `--brand-500` 과 같은 구조다.
 */
describe('토큰 대비 — 날씨 픽토그램 (비텍스트 3:1)', () => {
  const cases: [string, string][] = [
    ['--weather-sun', '맑음 · 구름조금'],
    ['--weather-rain', '비 · 소나기 · 진눈깨비'],
    ['--weather-snow', '눈 · 눈날림'],
  ]

  it.each(cases)('%s 이 흰 배경에서 3:1 이상이다 (%s)', (name) => {
    expect(contrastRatio(token(name), WHITE)).toBeGreaterThanOrEqual(3)
  })

  /*
    권역 행은 흰 배경이지만 섹션 밴드(--band)와 선택 행(--row-selected) 위에도 같은
    아이콘이 설 수 있다. 흰 배경만 재고 넘어가면 tint 위에서 조용히 미달한다.
  */
  it.each(cases)('%s 이 band 위에서도 3:1 이상이다', (name) => {
    expect(contrastRatio(token(name), token('--band'))).toBeGreaterThanOrEqual(3)
  })

  /*
    **--weather-sun 은 본문 대비에 미달한다.** 태양의 관습색이 앰버 대역이라 피할 수
    없이 밝다. 언젠가 4.5 를 넘게 바뀌면 이 구분이 필요 없어지므로 그때 알려준다.
  */
  it('--weather-sun 은 글자에 쓸 수 없다 — 본문 4.5:1 미달', () => {
    expect(contrastRatio(token('--weather-sun'), WHITE)).toBeLessThan(4.5)
  })
})

describe('토큰 대비 — 소개 페이지 표면 (DESIGN.md §0-2, #635)', () => {
  it.each([['--fg'], ['--fg-muted']])('%s 가 --intro-band 위에서 4.5:1 이상이다', (name) => {
    expect(contrastRatio(token(name), token('--intro-band'))).toBeGreaterThanOrEqual(4.5)
  })

  it.each([['--fg'], ['--fg-muted']])('%s 가 --intro-tint 위에서 4.5:1 이상이다', (name) => {
    expect(contrastRatio(token(name), token('--intro-tint'))).toBeGreaterThanOrEqual(4.5)
  })

  /* 새 색이 아니다 — 팔레트의 값을 이름만 새로 부른 것 (명세 §6-2) */
  it('밴드 토큰은 기존 값과 같다 — 22번째 색을 만들지 않는다', () => {
    expect(token('--intro-band')).toBe(token('--row-selected'))
    expect(token('--intro-tint')).toBe(token('--metric-high-100'))
  })

  /* 그린 밴드 위 글자 — 채운 버튼 hover 와 같은 쌍이지만 이 화면은 면 전체가 이 색이다 */
  it('그린 밴드(--brand-700) 위 흰 글자가 4.5:1 이상이다', () => {
    expect(contrastRatio(token('--fg-inverse'), token('--brand-700'))).toBeGreaterThanOrEqual(4.5)
  })
})
