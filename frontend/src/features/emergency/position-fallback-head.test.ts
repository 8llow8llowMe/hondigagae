import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PositionFallbackHead,
  type PositionFallbackHeadProps,
} from '@/features/emergency/position-fallback-head'
import { JEJU_REGION_CODES } from '@/lib/geo/jeju-regions'
import { messages } from '@/lib/messages'

function render(overrides: Partial<PositionFallbackHeadProps> = {}) {
  const props: PositionFallbackHeadProps = {
    reason: 'denied',
    regionCode: null,
    onRegionChange: () => undefined,
    onLocate: () => undefined,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PositionFallbackHead, props))
}

/** primary 채움 — `Button` 의 `VARIANT.primary` */
const PRIMARY = 'bg-brand-600'

describe('PositionFallbackHead — 위치를 못 쓰는 사람에게 주는 손잡이 (#639)', () => {
  /*
    **위치가 있으면 아무것도 그리지 않는다.** 폴백이 아닌 화면에 "지역을 골라 주세요" 가
    남으면 내 위치 기준으로 잘 돌고 있는 목록 위에 쓸 곳 없는 블록이 선다.
  */
  it('reason 이 null 이면 아무것도 그리지 않는다 — granted · 확인 중', () => {
    expect(render({ reason: null })).toBe('')
  })

  it('denied 는 왜 폴백인지 · primary 버튼 · 권한 안내 · 세그먼트 넷을 준다', () => {
    const markup = render({ reason: 'denied' })

    expect(markup).toContain(messages.emergency.positionDenied)
    expect(markup).toContain(messages.emergency.locateCta)
    expect(markup).toContain(messages.emergency.positionDeniedHint)

    /* primary 는 하나뿐이다 — 급한 행동이 둘이면 무엇을 누를지 고르게 만든다 */
    expect(markup.match(new RegExp(PRIMARY, 'g'))?.length).toBe(1)

    for (const code of JEJU_REGION_CODES) {
      expect(markup).toContain(messages.emergency.regionLabel[code])
    }
  })

  /*
    **위치 실패는 한 번 읽히고 지나가야 한다** (D6). 급한 화면에서 "왜 거리가 없나" 를
    눈으로 찾게 하지 않는다 — 예전 `PositionNotice` 에 없던 것이다.
  */
  it('첫 줄이 role="status" 다', () => {
    expect(render({ reason: 'timeout' })).toMatch(
      new RegExp(`role="status"[^>]*>${messages.emergency.positionTimeout}`),
    )
  })

  it('timeout 에도 버튼이 있다 — 잠시 뒤 다시 누르면 답이 달라진다', () => {
    const markup = render({ reason: 'timeout' })

    expect(markup).toContain(messages.emergency.positionTimeout)
    expect(markup).toContain(messages.emergency.locateCta)
    /* 권한 안내는 `denied` 전용이다 — 타임아웃에 띄우면 엉뚱한 설정을 뒤진다 */
    expect(markup).not.toContain(messages.emergency.positionDeniedHint)
  })

  /*
    **눌러도 답이 같은 두 갈래에는 버튼을 두지 않는다.** 미지원 브라우저는 다시 물어도
    미지원이고, 제주 밖은 좌표를 이미 정확히 받았다 — 위치를 옮겨야 바뀐다.
    **세그먼트는 남는다** — 제주 밖에서 여행을 계획하는 사람이 바로 그것이 필요한 사람이다.
  */
  it('unsupported · outside 는 버튼 없이 세그먼트만 준다', () => {
    for (const reason of ['unsupported', 'outside'] as const) {
      const markup = render({ reason })

      expect(markup).not.toContain(messages.emergency.locateCta)
      expect(markup).not.toContain(PRIMARY)

      for (const code of JEJU_REGION_CODES) {
        expect(markup).toContain(messages.emergency.regionLabel[code])
      }
    }

    expect(render({ reason: 'unsupported' })).toContain(messages.emergency.positionUnsupported)
    expect(render({ reason: 'outside' })).toContain(messages.emergency.positionOutside)
  })

  /* 단일 선택 토글 — 고른 칩만 눌린 상태다 */
  it('고른 권역만 aria-pressed 다', () => {
    const markup = render({ regionCode: 'SEOGWIPO' })

    expect(markup.match(/aria-pressed="true"/g)?.length).toBe(1)
    expect(markup.match(/aria-pressed="false"/g)?.length).toBe(JEJU_REGION_CODES.length - 1)
  })

  it('세그먼트가 라벨 붙은 묶음이다 — 무엇을 고르는 축인지 읽혀야 한다', () => {
    expect(render()).toContain(`aria-label="${messages.emergency.regionGroupLabel}"`)
  })

  /* 급할 때 누르는 버튼이라 44px 를 지킨다 (DESIGN.md §7) */
  it('primary 버튼이 44px 이고 전폭이다', () => {
    const markup = render({ reason: 'denied' })
    const button = markup.slice(markup.indexOf(PRIMARY) - 400, markup.indexOf(PRIMARY) + 400)

    expect(button).toContain('h-11')
    expect(button).toContain('w-full')
  })
})
