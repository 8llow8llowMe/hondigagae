import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { EmergencyFilterChips } from '@/features/emergency/emergency-filter-chips'
import { countsAreComplete, facilityCounts } from '@/features/emergency/facility-filters'
import { MAX_SIZE } from '@/lib/api/emergency'
import { messages } from '@/lib/messages'
import { facility, facilityResult } from '@/test/fixtures/emergency'
import { DEFAULT_FACILITY_FILTERS, type NearbyFacilityResult } from '@/types/emergency'

type Props = Parameters<typeof EmergencyFilterChips>[0]

/** 목록 갈래가 하는 것과 같은 산식 — 개수는 반경 전량, 다 받았을 때만 숫자를 붙인다 */
function render(result: NearbyFacilityResult | null, overrides: Partial<Props> = {}) {
  const props: Props = {
    filters: DEFAULT_FACILITY_FILTERS,
    onFiltersChange: () => undefined,
    counts: facilityCounts(result?.facilities ?? []),
    showCounts: result !== null && countsAreComplete(result),
    ...overrides,
  }

  return renderToStaticMarkup(createElement(EmergencyFilterChips, props))
}

const ONE = facilityResult({ facilities: [facility()], totalCount: 1 })

describe('EmergencyFilterChips — 개수', () => {
  it('다 받았으면 개수를 붙인다', () => {
    expect(render(ONE)).toContain(`${messages.emergency.typeAll} 1`)
  })

  /*
    **#297.** 반경 안 총계보다 적게 받았으면 잘렸다 — `totalCount` 가 자르기 전 총계가
    되면서(BE #285 / PR #296) 이 판정이 상한 도달 우회를 대신한다.
  */
  it('총계보다 적게 받았으면 숫자를 빼고 라벨만 쓴다', () => {
    const markup = render(facilityResult({ facilities: [facility()], totalCount: 136 }))

    expect(markup).toContain(messages.emergency.typeAll)
    expect(markup).not.toContain(`${messages.emergency.typeAll} 1`)
  })

  /*
    상한 도달 우회(#281)를 걷은 결과 — 상한만큼 왔는데 총계도 그만큼이면 다 받은 것이라
    개수를 붙인다. 우회는 이 응답에서 숫자를 뺐다.
  */
  it('상한만큼 왔는데 총계도 그만큼이면 개수를 붙인다', () => {
    const markup = render(
      facilityResult({
        facilities: Array.from({ length: MAX_SIZE }, (_, index) =>
          facility({ facilityId: String(index) }),
        ),
        totalCount: MAX_SIZE,
      }),
    )

    expect(markup).toContain(`${messages.emergency.typeAll} ${MAX_SIZE}`)
  })

  /*
    **응답 전에도 칩은 실제로 선다** (#460) — 그래서 스켈레톤이 칩 자리를 흉내 내지 않는다.
    그때 개수는 0 인데 `showCounts` 가 false 라 숫자가 빠진다 — 0 을 사실처럼 적지 않는다.
  */
  it('응답 전에는 라벨만 그린다 — 0 을 사실처럼 적지 않는다', () => {
    const markup = render(null)

    expect(markup).toContain(messages.emergency.typeAll)
    expect(markup).not.toContain(`${messages.emergency.typeAll} 0`)
  })

  it('24시간을 켜면 결과가 적다는 사실을 알린다 (백엔드 스키마 지침)', () => {
    const markup = render(ONE, { filters: { ...DEFAULT_FACILITY_FILTERS, open24Only: true } })

    expect(markup).toContain(messages.emergency.open24Note)
  })
})

/*
  **#205.** 유형 칩 라벨을 응답 목록에서 역추적하고 있었다 —
  `facilities.find((f) => f.facilityType.code === code)?.facilityType.name ?? code`.

  이 화면은 유형을 **서버로 보내지 않고 클라이언트에서 좁힌다** (칩마다 개수를 보여주려고,
  `lib/api/emergency.ts`). 그래서 **개수 0 인 칩도 반드시 그리는데**, 그 칩은 목록에 표본이
  없어 `?? code` 로 떨어졌다 — dev `/emergency` 에 `ANIMAL_HOSPITAL 0 · ANIMAL_PHARMACY 0`
  이 그대로 나갔다. 데이터가 차더라도 "반경 안에 병원만 있는" 흔한 경우에 재현된다.
*/
describe('EmergencyFilterChips — 유형 칩 라벨 (#205)', () => {
  const EMPTY = facilityResult({ facilities: [], totalCount: 0 })

  it('결과가 0건이어도 enum 코드를 노출하지 않는다', () => {
    expect(render(EMPTY)).not.toContain('ANIMAL_')
  })

  /* 개수까지 붙여서 본다. 라벨만 검사하면 칩이 코드로 떨어져도 통과한다 */
  it('결과가 0건이어도 두 유형을 한국어로 그린다', () => {
    const markup = render(EMPTY)

    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_HOSPITAL} 0`)
    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_PHARMACY} 0`)
  })

  /* 실제로 가장 자주 밟는 경로다 — 반경 안에 병원만 있는 경우 */
  it('병원만 있는 목록에서도 약국 칩이 한국어다', () => {
    const markup = render(ONE)

    expect(markup).not.toContain('ANIMAL_')
    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_PHARMACY} 0`)
  })
})

/*
  **3층 표면** (`DESIGN.md §0`, #460). 칩은 목록을 좁히는 도구라 카드 밖이다 — 그래서 인셋은
  담는 곳이 정한다: 목록 갈래는 `SurfaceStack` 안이라 `card`, 지도 SDK 폴백은 카드도 스택도
  없어 `main`.
*/
describe('EmergencyFilterChips — 인셋 (#460)', () => {
  it('기본은 card(16/20) — 768 에서 스택 24 + 20 = 44, 카드 제목 45 와 1px 차이다', () => {
    const markup = render(ONE)

    expect(markup).toContain('px-4 md:px-5')
    expect(markup).not.toContain('md:px-10')
  })

  it('inset="main" 이면 페이지 값 40 — 폴백의 안내 줄과 같은 축', () => {
    const markup = render(ONE, { inset: 'main' })

    expect(markup).toContain('px-4 md:px-10')
    expect(markup).not.toContain('md:px-5')
  })

  /* `lg:hidden` 은 호출부가 건다 — 폴백은 레일이 없어 데스크톱에서도 칩이 남아야 한다 */
  it('스스로 lg:hidden 을 걸지 않고 className 을 그대로 받는다', () => {
    expect(render(ONE)).not.toContain('lg:hidden')
    expect(render(ONE, { className: 'lg:hidden' })).toContain('lg:hidden')
  })

  /* 선은 `className` 이 아니라 `divider` 로 — className 은 배치 유틸리티만 (component-guide §3) */
  it('기본은 배경도 선도 없고, divider 를 켜면 아래 1px 선을 스스로 긋는다', () => {
    const plain = render(ONE)
    const plainWrapper = plain.slice(0, plain.indexOf('>'))

    expect(plainWrapper).not.toContain('bg-')
    expect(plainWrapper).not.toContain('border-')

    const divided = render(ONE, { divider: true })
    expect(divided.slice(0, divided.indexOf('>'))).toContain('border-border border-b')
  })
})
