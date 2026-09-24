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
    expect(markup).toContain(messages.emergency.regionPickHintDenied)

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
    expect(markup).not.toContain(messages.emergency.regionPickHintDenied)
    expect(markup).toContain(messages.emergency.regionPickHint)
  })

  /*
    **힌트는 언제나 한 줄이다** (#671 F-6). 예전에는 거부 갈래에서만 caption 이 두 줄
    쌓여 목록이 ~28px 밀렸다 — 권한 허용 시 첫 화면에 전화 버튼이 2개인데 거부 시에는
    1개만 남는 실측이었다. 갈래는 줄 수가 아니라 문구가 진다.
  */
  it('거부 갈래에서도 힌트 caption 은 한 줄이다', () => {
    const markup = render({ reason: 'denied' })

    expect(markup).toContain(messages.emergency.regionPickHintDenied)
    /* 예전 두 줄짜리 조합이 남아 있지 않다 */
    expect(markup).not.toContain(messages.emergency.regionPickHint)

    const captions = markup.match(/class="text-caption text-fg-muted break-keep"/g) ?? []
    expect(captions.length).toBe(1)
  })

  /*
    한 줄로 합치면서 **두 사실이 모두 남아야 한다**: ① 브라우저 설정에서 켜야 한다
    (영구 거부면 버튼을 눌러도 프롬프트가 안 뜬다) ② 안 되면 지역을 고른다 — 세그먼트의
    `ChipGroup` 라벨은 `aria-label` 이라 화면에 글자가 없어, 이 절이 칩 넷을 가리키는
    유일한 보이는 글자다.
  */
  it('합친 한 줄이 설정 경로와 지역 대안을 모두 말한다', () => {
    const hint = messages.emergency.regionPickHintDenied

    expect(hint).toContain('설정')
    expect(hint).toContain('지역')
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

/*
  **#910 — 목록 화면 데스크톱은 두 줄이다.** 안내 · 전폭 CTA · 힌트 · 권역 칩 · 검색 5단이
  첫 행을 밀었다. `layout="wide"` 가 lg 에서만 grid 자리를 바꾸고, 기본값(`stack`)은 지도
  화면의 400px 패널을 위해 폭과 무관하게 쌓는다 — `lg:` 는 뷰포트 기준이라서다.
*/
describe('PositionFallbackHead — 데스크톱 두 줄 (#910)', () => {
  const SEARCH = createElement('form', { role: 'search', 'data-probe': 'search' })

  /* 블록 루트의 여는 태그만 본다 — 마크업 전체를 훑으면 자식의 lg: 클래스에 속는다 */
  function rootTag(markup: string): string {
    return markup.slice(0, markup.indexOf('>') + 1)
  }

  it('기본(stack)은 lg 에서도 grid 가 아니다 — 지도 패널 400px 안에서 갈라지면 안 된다', () => {
    const markup = render()

    expect(rootTag(markup)).not.toContain('lg:grid')
    expect(markup).not.toContain('lg:col-start-2')
  })

  it('wide 는 lg 에서 [안내 · 힌트 | 버튼] 과 [칩 | 검색] 두 줄이다', () => {
    const markup = render({ layout: 'wide', search: SEARCH })

    expect(rootTag(markup)).toContain('lg:grid lg:grid-cols-[1fr_auto]')

    // 버튼은 우측 열에서 두 행에 걸치고 전폭을 벗는다
    const button = markup.slice(markup.lastIndexOf('<button', markup.indexOf(PRIMARY)))
    expect(button.slice(0, button.indexOf('>'))).toContain('lg:col-start-2 lg:row-span-2')
    expect(button.slice(0, button.indexOf('>'))).toContain('lg:w-auto')

    // 칩 줄과 검색이 같은 flex 행이다
    const row = markup.slice(markup.indexOf('lg:col-span-2'))
    expect(row).toContain('lg:flex-row')
    expect(row.indexOf(messages.emergency.regionGroupLabel)).toBeLessThan(
      row.indexOf('data-probe="search"'),
    )
  })

  it('wide 여도 모바일 순서는 그대로다 — 안내 → 버튼 → 힌트 → 칩 → 검색 (#353)', () => {
    const markup = render({ layout: 'wide', search: SEARCH })
    const at = (probe: string) => markup.indexOf(probe)

    const order = [
      at('role="status"'),
      at(PRIMARY),
      at(messages.emergency.regionPickHintDenied),
      at(messages.emergency.regionGroupLabel),
      at('data-probe="search"'),
    ]
    expect(order.every((index) => index > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('검색이 들어오면 블록의 pb-3 을 걷고 검색 위 24 를 준다 — 예전 pb-3 + pt-3 과 같다', () => {
    const withSearch = render({ layout: 'wide', search: SEARCH })
    const without = render()

    expect(rootTag(withSearch)).not.toMatch(/\bpb-3\b/)
    expect(rootTag(without)).toMatch(/\bpb-3\b/)
    expect(withSearch).toMatch(/<div class="mt-6[^"]*"><form[^>]*data-probe="search"/)
  })
})
