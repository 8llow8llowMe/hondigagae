import { describe, expect, it } from 'vitest'

import { METRIC_TINT_EDGE_TONE } from '@/components/metric'
import { contrastRatio, parseColorTokens, readGlobalsCss, readTokensCss } from '@/test/tokens'

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

  /**
   * **밴드 안 본문은 `-700` 이 아니다** (#842).
   *
   * 위 단언들은 tint 위 **등급 텍스트**(`-700`)를 본다. 그런데 일자 판정 밴드가 tint 면을
   * 넓게 깔면서 그 위에 서게 된 글자는 등급어가 아니라 **평범한 본문**이다 — 근거 문장
   * (`ReasonList` 의 `--fg` / 정보성 `--fg-muted`), 체감온도 라벨(`--fg-muted`), 기준
   * 반려견 줄(`--fg-muted`). 그 짝은 이 파일에 단언이 없었다.
   *
   * **`--fg-muted` 가 기준선이다** — 셋 중 가장 밝고, 정보성 근거가 그 색으로 내려간다.
   * 실측(2026-09-22): high 5.43 · mid 5.82 · low 5.57 · critical 5.56 · unknown(`--band`)
   * 5.57. `--fg` 는 같은 면에서 15.20~16.29 라 여유가 크다.
   */
  it.each([...cases, ['unknown', '정보 없음'] as [string, string]])(
    'metric-%s tint 위에서 본문 `--fg-muted` 가 4.5:1 이상이다',
    (tone) => {
      const surface = tone === 'unknown' ? token('--band') : token(`--metric-${tone}-100`)

      expect(contrastRatio(token('--fg-muted'), surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(token('--fg'), surface)).toBeGreaterThanOrEqual(4.5)
    },
  )

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

/**
 * 넓게 깔린 tint 면의 경계선 (#709 — `METRIC_TINT_EDGE_TONE`).
 *
 * **tint 는 밝기로 바닥과 갈리지 않는다.** 홈 특보 스트립은 `Canvas` 안이라 `--bg-sunken`
 * 위에 서는데 그 대비가 1.01~1.06:1 이다 — **색상(hue)만 다르다.** 그래서 면과 함께 `-500`
 * 실선을 두고, **그 선이 명도 채널을 혼자 담당한다.**
 *
 * 선은 글자가 아니므로 **비텍스트 3:1** 로 잰다. 두 배경(자기 tint · 바닥) 모두에서 넘어야
 * 한다 — 선은 두 면의 경계에 놓여 양쪽과 동시에 맞닿는다.
 */
describe('토큰 대비 — tint 면의 -500 경계선 (비텍스트 3:1, #709)', () => {
  const SUNKEN = '--bg-sunken'
  const tones: [string, string][] = [
    ['critical', 'CRITICAL'],
    ['high', 'HIGH'],
    ['mid', 'MID'],
    ['low', 'LOW'],
  ]

  it.each(tones)('-500 선이 자기 tint(%s) 위에서 3:1 이상이다', (tone) => {
    expect(
      contrastRatio(token(`--metric-${tone}-500`), token(`--metric-${tone}-100`)),
    ).toBeGreaterThanOrEqual(3)
  })

  it.each(tones)('-500 선이 바닥(--bg-sunken) 위에서도 3:1 이상이다 (%s)', (tone) => {
    expect(contrastRatio(token(`--metric-${tone}-500`), token(SUNKEN))).toBeGreaterThanOrEqual(3)
  })

  /*
    **`unknown` 도 같은 바를 넘어야 한다** (#671 C-6). 이 톤만 `-500` 이 아니라 `--fg-muted`
    점선인데, 예외인 것은 **색과 모양**이지 대비가 아니다 — `--border-strong` 을 쓰던 동안
    자기 면 위 1.46:1 이라, 이 describe 가 나머지 넷에 요구한 것을 혼자 못 넘었다. 면(`--band`)
    마저 흰 바닥과 1.10:1 이라 그동안 "판정 못 냄" 밴드는 통째로 보이지 않았다.
  */
  it.each([
    ['--band', '자기 면'],
    ['--bg-sunken', '바닥'],
  ])('unknown 의 선(--fg-muted)이 %s 위에서 3:1 이상이다 (%s)', (surface) => {
    expect(contrastRatio(token('--fg-muted'), token(surface))).toBeGreaterThanOrEqual(3)
  })

  it('unknown 의 선이 흰 바닥 위에서도 3:1 이상이다 — 일자 카드가 그 바닥이다', () => {
    expect(contrastRatio(token('--fg-muted'), WHITE)).toBeGreaterThanOrEqual(3)
  })

  /*
    **되돌아가는 것을 막는다.** C-6 이 검토한 나머지 후보는 전부 이 바 아래다 —
    되돌리려는 사람이 "비슷한 회색인데 뭐가 다른가" 에서 멈추도록 값을 함께 적는다.
    (`contrastRatio` 는 소수 2자리에서 **버린다** — 위 `--metric-mid-100` 단언과 같다.)
  */
  it.each([
    ['--fg-subtle', 2.92],
    ['--border-strong', 1.46],
    ['--metric-unknown-500', 1.95],
  ])('%s 은 --band 위에서 3:1 에 미달한다 — unknown 선으로 쓰지 않은 이유다', (name, expected) => {
    const ratio = contrastRatio(token(name), token('--band'))

    expect(ratio).toBeLessThan(3)
    expect(ratio).toBe(expected)
  })

  /*
    **이 단언은 "실패해야 좋은" 값을 잠근다.** tint 가 바닥과 밝기로 갈린다면 `-500` 선을
    둘 이유가 절반 사라지므로, 값이 바뀌면 그 판단을 다시 하라고 여기서 멈춘다.
  */
  it.each([
    // `contrastRatio` 는 소수 2자리에서 **버린다** — 1.00 은 "1.00 미만이 아니라 딱 1.00대"
    ['--metric-mid-100', 1],
    ['--metric-critical-100', 1.05],
  ])('%s 은 바닥과 밝기로 갈리지 않는다 — 색상만 다르다', (name, expected) => {
    const ratio = contrastRatio(token(name), token(SUNKEN))

    expect(ratio).toBeLessThan(1.1)
    expect(ratio).toBe(expected)
  })

  /*
    **단계 구분은 색이 못 한다.** 주의보/경보 두 tint 도, 두 선도 밝기로는 갈리지 않는다 —
    그 일은 배지의 서버 `level.name` 이 글자로 한다 (DESIGN.md §2-3).
  */
  it('주의보 tint 와 경보 tint 는 서로 밝기로 갈리지 않는다', () => {
    expect(contrastRatio(token('--metric-mid-100'), token('--metric-critical-100'))).toBeLessThan(
      1.1,
    )
  })
})

/**
 * 지도 위 흰 원 마커의 테두리 (#671 B-2 — `.map-cluster` · `.map-pin-order`).
 *
 * **이 원은 다른 테두리와 다르다.** 카카오 타일 위에 서는데 타일은 도로가 흰색, 땅이 밝은
 * 회베이지라 **흰 원과 바닥이 거의 같은 밝기**다 — 테두리가 경계를 혼자 담당한다.
 * 선은 글자가 아니므로 **WCAG 1.4.11 비텍스트 3:1** 로 잰다.
 *
 * `--border-strong`(1.68:1)으로는 미달이었다. 토큰은 알약 마커 시절 것 그대로였는데
 * 면적이 3177px² → 804px² 로 1/4 이 되면서 그 재검증이 없었다.
 */
describe('토큰 대비 — 지도 마커 테두리 (비텍스트 3:1, #671 B-2)', () => {
  it('마커 테두리가 자기 채움(--bg) 위에서 3:1 이상이다', () => {
    expect(contrastRatio(token('--fg-subtle'), token('--bg'))).toBeGreaterThanOrEqual(3)
  })

  /* 되돌림 방지 — 이 값으로 돌아가면 1.68:1 이라 선이 사실상 사라진다 */
  it('--border-strong 은 이 자리에 쓸 수 없다 — 3:1 미달이 그 이유다', () => {
    expect(contrastRatio(token('--border-strong'), token('--bg'))).toBeLessThan(3)
  })

  /*
    **값만 재면 가드가 아니다.** 위 둘은 토큰 값의 성질일 뿐이라 `globals.css` 를 되돌려도
    초록이다. 마커 규칙이 실제로 그 토큰을 쓰는지 **선언에서 직접 본다.**
  */
  it('마커 규칙이 실제로 --fg-subtle 을 테두리에 쓴다', () => {
    const rule = /\.map-cluster,\s*\n\.map-pin-order\s*\{([\s\S]*?)\}/.exec(readGlobalsCss())

    expect(rule).not.toBeNull()
    expect(rule?.[1]).toContain('border: 1px solid var(--fg-subtle)')
  })
})

/**
 * `low` 와 `unknown` 은 **면이 같다** (#671 C-3).
 *
 * `--band` 와 `--metric-low-100` 이 같은 값(`#eef0f3`)이라, 두 톤을 함께 쓰는 축에서는
 * "적합도 낮음" 밴드와 "판정 못 냄" 밴드의 면이 **1.00:1 로 구별되지 않는다.**
 * `plan/plan-day-verdict.tsx`(#842)가 그 축이다 — 한 컴포넌트가 둘 다 렌더한다.
 *
 * **면을 벌리지 않는 이유**는 바로 위 describe 가 잠근 사실이다 — 이 저장소의 tint 는
 * 서로 밝기로 갈리지 않는다(`mid` vs `critical` 이 1.1:1 미만). 회색 둘을 조금 다른
 * 회색으로 벌려도 같은 자리에 머무를 뿐이다.
 *
 * **그래서 가르는 일은 경계선과 낱말이 한다.** 이 가드는 그 마지막 채널이 사라지는 것을
 * 막는다 — 면이 같은 채로 **선까지 같아지면** 두 뜻이 화면에서 완전히 하나가 된다.
 */
describe('토큰 대비 — low 와 unknown 은 면이 같다, 선이 가른다 (#671 C-3)', () => {
  /*
    **"실패해야 좋은" 값이다** — 위 `--metric-mid-100` 단언과 같은 종류다. 누군가 면을
    벌리면 여기서 멈추고, 그때 이 describe 와 `metric.tsx` 의 주석을 다시 읽으면 된다.
  */
  it('면이 실제로 같은 값이다 — 벌어지면 이 가드를 다시 읽는다', () => {
    expect(token('--band')).toBe(token('--metric-low-100'))
  })

  it('두 톤의 경계선은 서로 다르다 — 면이 같으므로 선이 유일한 시각 채널이다', () => {
    expect(METRIC_TINT_EDGE_TONE.unknown).not.toBe(METRIC_TINT_EDGE_TONE.low)
  })

  /* 공유하는 면 위에서 **양쪽 선이 다** 비텍스트 3:1 을 넘는다 (#671 C-6 이후) */
  it('low 의 선이 공유하는 면 위에서 비텍스트 3:1 을 넘는다', () => {
    expect(contrastRatio(token('--metric-low-500'), token('--band'))).toBeGreaterThanOrEqual(3)
  })

  /*
    **마지막 채널이 색에서 모양으로 옮겨 갔다** (#671 C-6). 두 선의 색만 다르던 동안에는
    `unknown` 쪽이 자기 면 위 1.46:1 이라 **한쪽 선이 사실상 안 보이는 채로** 갈리고 있었다.
    이제 `low` 는 실선 · `unknown` 은 점선이라, 색을 못 보는 눈에서도 두 밴드가 갈린다.
  */
  it('unknown 의 선만 점선이다 — 흑백·색약에서도 남는 채널이다', () => {
    expect(METRIC_TINT_EDGE_TONE.unknown).toContain('border-dashed')

    for (const tone of ['critical', 'high', 'mid', 'low'] as const) {
      expect(METRIC_TINT_EDGE_TONE[tone]).not.toContain('border-dashed')
    }
  })
})

/**
 * 같은 톤 tint 면 위에 선 배지 (#709 — `BADGE_TONE_ON_TINT`).
 *
 * 뒤집기가 **대비를 깎지 않는다**는 것을 잠근다: 흰 면 위 `-700` 글자가 tint 위 `-700`
 * 보다 높고, `-500` 테두리는 비텍스트 3:1 을 넘는다.
 */
describe('토큰 대비 — tint 면 위에서 뒤집은 배지 (#709)', () => {
  const tones = ['critical', 'high', 'mid', 'low']

  it.each(tones)('%s: 흰 배지 면 위 -700 글자가 tint 위보다 대비가 높다', (tone) => {
    const onWhite = contrastRatio(token(`--metric-${tone}-700`), WHITE)
    const onTint = contrastRatio(token(`--metric-${tone}-700`), token(`--metric-${tone}-100`))

    expect(onWhite).toBeGreaterThanOrEqual(4.5)
    expect(onWhite).toBeGreaterThan(onTint)
  })
})
