import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  EmergencySection,
  type EmergencySectionProps,
} from '@/features/emergency/emergency-section'
import { messages } from '@/lib/messages'
import { facility } from '@/test/fixtures/emergency'
import { DEFAULT_FACILITY_FILTERS } from '@/types/emergency'

function render(overrides: Partial<EmergencySectionProps> = {}) {
  const props: EmergencySectionProps = {
    result: {
      facilities: [facility()],
      totalCount: 1,
      radius: 10_000,
      open24Only: false,
      providerName: '한국문화정보원 반려동물 동반 가능 문화시설 위치 데이터',
    },
    loading: false,
    errorStatus: null,
    onRetry: () => undefined,
    filters: DEFAULT_FACILITY_FILTERS,
    onFiltersChange: () => undefined,
    positionFallback: null,
    onRetryPosition: () => undefined,
    onWidenRadius: () => undefined,
    canWiden: true,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(EmergencySection, props))
}

describe('EmergencySection — 상태 배타성', () => {
  it('로딩 중에는 skeleton 만 보이고 목록이 함께 나오지 않는다', () => {
    const markup = render({ loading: true })

    expect(markup).toContain('animate-pulse')
    expect(markup).not.toContain('제주24시동물병원')
  })

  /*
    **칩 자리를 더 흉내 내지 않는다** (#460). 칩이 카드 밖 `EmergencyFilterChips` 로 나가
    응답과 무관하게 실제로 서 있으므로, 스켈레톤이 칩 폭을 잡아 두면 실제 칩 아래 가짜 칩이
    한 줄 더 생긴다. 남는 것은 카드 안 내용 — 기준 줄과 행 셋이다.
  */
  it('로딩 스켈레톤은 칩 자리를 그리지 않는다 — 칩은 카드 밖에 실제로 서 있다', () => {
    const markup = render({ loading: true })

    expect(markup).not.toContain('w-20')
    expect(markup).not.toContain('w-28')
    // 행 셋 × 버튼 둘(전화·길찾기) 여섯 자리만 rounded-md 다 — 칩이 섞이면 수가 는다 (#603)
    expect(markup.match(/rounded-md/g)?.length ?? 0).toBe(6)
  })

  it('오류에서는 재시도를 준다', () => {
    const markup = render({ errorStatus: 500, result: null })

    expect(markup).toContain(messages.emergency.errorTitle)
    expect(markup).toContain(messages.common.retry)
  })
})

describe('EmergencySection — openNow 3상태 (아트보드 주석)', () => {
  it('true 면 진료중', () => {
    expect(render()).toContain(messages.emergency.statusOpen)
  })

  it('false 면 영업 종료', () => {
    const markup = render({
      result: {
        facilities: [facility({ openNow: false })],
        totalCount: 1,
        radius: 10_000,
        open24Only: false,
        providerName: '출처',
      },
    })

    expect(markup).toContain(messages.emergency.statusClosed)
  })

  it('null 은 "닫힘" 이 아니라 점선 "확인 필요" 다', () => {
    const markup = render({
      result: {
        facilities: [facility({ openNow: null, operatingHoursKnown: false })],
        totalCount: 1,
        radius: 10_000,
        open24Only: false,
        providerName: '출처',
      },
    })

    expect(markup).toContain(messages.emergency.statusUnknown)
    expect(markup).toContain('border-dashed')
    expect(markup).not.toContain(messages.emergency.statusClosed)
  })

  /*
    **#598 이 "색이 아니라 무게로 가른다" 를 뒤집었다.** 상태 배지가 1행 오른쪽 끝으로
    올라가 `24시간` 과 나란히 서고 나면 회색 배지 둘이 모양으로 구별되지 않는다 —
    근거는 `facility-row.tsx` 의 `OpenStatus` 머리주석이다.

    **금지가 사라진 것은 아니다.** 아트보드가 막은 것은 *등급 척도를 흉내내는 것*이고
    (초록·주황·빨강 세 단계), 여기 초록/빨강은 열림/닫힘 **두 값**이다. 그래서 중간 등급
    (`metric-mid` · `metric-low`)은 여전히 이 화면에 없어야 한다 — 그것이 나타나면 배지가
    다시 척도로 읽히고 있다는 뜻이다.
  */
  it('등급 색을 쓰지 않는다 — 상태는 척도가 아니라 두 값이다', () => {
    expect(render()).not.toMatch(/metric-(high|mid|low|critical)/)
  })

  it('진료중은 초록, 영업 종료는 빨강이다 (#598)', () => {
    expect(render()).toContain('bg-status-open-100')

    const closed = render({
      result: {
        facilities: [facility({ openNow: false })],
        totalCount: 1,
        radius: 10_000,
        open24Only: false,
        providerName: '출처',
      },
    })

    expect(closed).toContain('bg-status-closed-100')
  })
})

describe('EmergencySection — 운영시간·전화', () => {
  it('진료시간 원문을 그대로 렌더한다 — 파싱해 요약하지 않는다', () => {
    expect(render()).toContain('월~금 09:00~19:00, 토 09:00~13:00')
  })

  it('operatingHoursKnown 이 false 면 등록돼 있지 않다고 말한다', () => {
    const markup = render({
      result: {
        facilities: [facility({ operatingHoursKnown: false, operatingHours: null, openNow: null })],
        totalCount: 1,
        radius: 10_000,
        open24Only: false,
        providerName: '출처',
      },
    })

    expect(markup).toContain(messages.emergency.hoursUnknown)
  })

  it('tel 이 없어도 버튼 자리를 비우지 않고 이유를 준다', () => {
    const markup = render({
      result: {
        facilities: [facility({ tel: null })],
        totalCount: 1,
        radius: 10_000,
        open24Only: false,
        providerName: '출처',
      },
    })

    expect(markup).toContain(messages.emergency.telMissing)
    expect(markup).not.toContain('href="tel:')
    // 자리는 남는다 — 사라지면 "화면이 깨졌다" 로 읽힌다
    expect(markup).toContain('size-10')
  })
})

describe('EmergencySection — 위치 폴백', () => {
  it('폴백이면 거리를 표시하지 않는다 — 제주 중심에서 480m 를 "480m" 로 쓸 수 없다', () => {
    const markup = render({ positionFallback: 'denied' })

    expect(markup).not.toContain('480m')
    expect(markup).toContain(messages.emergency.basisJeju)
  })

  it('폴백이어도 목록과 전화는 그대로 남는다', () => {
    const markup = render({ positionFallback: 'denied' })

    expect(markup).toContain('제주24시동물병원')
    expect(markup).toContain('href="tel:')
  })

  it('네 갈래의 안내가 서로 다르다', () => {
    expect(render({ positionFallback: 'denied' })).toContain(messages.emergency.positionDenied)
    expect(render({ positionFallback: 'timeout' })).toContain(messages.emergency.positionTimeout)
    expect(render({ positionFallback: 'unsupported' })).toContain(
      messages.emergency.positionUnsupported,
    )
    expect(render({ positionFallback: 'outside' })).toContain(messages.emergency.positionOutside)
  })

  /*
    제주 밖은 **권한 문제가 아니다.** 좌표는 정확히 받았고 우리 데이터가 제주뿐이다 —
    권한 문구를 내면 사용자가 브라우저 설정을 뒤진다.
  */
  it('제주 밖 안내를 권한 문제로 말하지 않는다', () => {
    const markup = render({ positionFallback: 'outside' })

    expect(markup).not.toContain(messages.emergency.positionDenied)
    expect(markup).not.toContain(messages.emergency.positionTimeout)
  })

  it('다시 시도해도 답이 같은 갈래에는 버튼을 주지 않는다', () => {
    expect(render({ positionFallback: 'unsupported' })).not.toContain(
      messages.emergency.retryPosition,
    )
    // 서울에서 다시 눌러도 서울이다 — 위치를 옮겨야 바뀐다
    expect(render({ positionFallback: 'outside' })).not.toContain(messages.emergency.retryPosition)
    expect(render({ positionFallback: 'denied' })).toContain(messages.emergency.retryPosition)
  })

  it('제주 밖이어도 목록과 거리 기준 표기는 폴백 규칙을 따른다', () => {
    const markup = render({ positionFallback: 'outside' })

    expect(markup).not.toContain('480m')
    expect(markup).toContain(messages.emergency.basisJeju)
    expect(markup).toContain('제주24시동물병원')
  })
})

describe('EmergencySection — 결과 없음', () => {
  const two = {
    facilities: [facility({ facilityId: '1' }), facility({ facilityId: '2', openNow: false })],
    totalCount: 2,
    radius: 10_000,
    open24Only: false,
    providerName: '출처',
  }

  it('조건을 켜서 0건이면 끄면 몇 개인지 세어 준다', () => {
    const markup = render({
      result: {
        ...two,
        facilities: [facility({ facilityId: '2', openNow: false })],
        totalCount: 1,
      },
      filters: { ...DEFAULT_FACILITY_FILTERS, openNowOnly: true },
    })

    expect(markup).toContain(messages.emergency.narrowedTitle)
    expect(markup).toContain(messages.emergency.reliefOpenNow.replace('{n}', '1'))
  })

  /*
    **검색은 사용자가 친 말이 조건이다** (#584). 무엇으로 찾았는지 되돌려 주지 않으면
    0건 화면에서 입력을 다시 봐야 한다. 검색어만 탓하지 않으려고 완화 버튼은 그대로 준다.
  */
  it('검색어로 0건이면 무엇으로 찾았는지 되돌려 주고 지우는 길을 준다', () => {
    const markup = render({
      result: two,
      filters: { ...DEFAULT_FACILITY_FILTERS, keyword: '없는이름ZZZ' },
    })

    expect(markup).toContain('없는이름ZZZ')
    expect(markup).not.toContain(messages.emergency.narrowedTitle)
    expect(markup).toContain(messages.emergency.reliefKeyword.replace('{n}', '2'))
  })

  /*
    **잘린 목록에서는 "없어요" 를 확언하지 않는다** (#584). 칩은 같은 조건에서 이미 숫자를
    빼는데(`countsAreComplete`) 검색만 단언하면, 급할 때 여는 화면이 **있는 병원을 없다고**
    말한다. `totalCount` 가 받은 개수보다 크면 반경 안에 못 받아 온 곳이 남아 있다.
  */
  it('목록이 잘린 채 검색이 0건이면 범위를 밝힌다', () => {
    const markup = render({
      result: { ...two, totalCount: 300 },
      filters: { ...DEFAULT_FACILITY_FILTERS, keyword: '없는이름ZZZ' },
    })

    expect(markup).toContain(messages.emergency.searchTruncatedNote)
  })

  it('다 받아 온 목록이면 그 안내를 띄우지 않는다', () => {
    const markup = render({
      result: two,
      filters: { ...DEFAULT_FACILITY_FILTERS, keyword: '없는이름ZZZ' },
    })

    expect(markup).not.toContain(messages.emergency.searchTruncatedNote)
  })

  /* 칩만으로 0건이 된 것은 받아 온 범위와 무관하다 — 검색어가 없으면 띄우지 않는다 */
  it('검색어 없이 잘린 목록이면 그 안내를 띄우지 않는다', () => {
    const markup = render({
      result: {
        ...two,
        facilities: [facility({ facilityId: '2', openNow: false })],
        totalCount: 300,
      },
      filters: { ...DEFAULT_FACILITY_FILTERS, openNowOnly: true },
    })

    expect(markup).not.toContain(messages.emergency.searchTruncatedNote)
  })

  it('검색어가 없으면 0건 제목은 그대로다', () => {
    const markup = render({
      result: {
        ...two,
        facilities: [facility({ facilityId: '2', openNow: false })],
        totalCount: 1,
      },
      filters: { ...DEFAULT_FACILITY_FILTERS, openNowOnly: true },
    })

    expect(markup).toContain(messages.emergency.narrowedTitle)
  })

  it('조건을 켜지 않았는데 0건이면 반경 문제로 안내한다', () => {
    const markup = render({
      result: { ...two, facilities: [], totalCount: 0 },
    })

    expect(markup).toContain(messages.emergency.emptyTitle)
    expect(markup).toContain(messages.emergency.widenRadius)
  })

  it('반경 상한이면 넓히기 버튼을 주지 않는다', () => {
    const markup = render({
      result: { ...two, facilities: [], totalCount: 0, radius: 50_000 },
      canWiden: false,
    })

    expect(markup).toContain(messages.emergency.emptyTitle)
    expect(markup).not.toContain(messages.emergency.widenRadius)
  })
})

/*
  **#205.** 유형 칩 라벨은 `EmergencyFilterChips` 로 옮겨 갔고 그 테스트도 함께 갔다
  (`emergency-filter-chips.test.ts`). 여기 남는 것은 그 반대편 — **목록 행은 그대로 서버
  metadata 를 쓴다.** 거기는 데이터가 있는 자리라 `frontend/CLAUDE.md` 의 "서버 enum
  metadata 를 그대로 렌더한다" 가 적용된다 — #205 가 그 규칙을 화면 전체로 뒤집은 것이
  아님을 고정한다.
*/
describe('EmergencySection — 유형 표기', () => {
  it('목록 행의 유형 표기는 서버 name 을 계속 쓴다', () => {
    const markup = render({
      result: {
        facilities: [
          facility({
            facilityType: { code: 'ANIMAL_PHARMACY', name: '동물약국', description: null },
          }),
        ],
        totalCount: 1,
        radius: 10_000,
        open24Only: false,
        providerName: '출처',
      },
    })

    expect(markup).toContain('동물약국')
    expect(markup).not.toContain('ANIMAL_')
  })
})

/*
  **3층 표면** (`DESIGN.md §0`, #460). 이 섹션은 목록 갈래에서 `Surface`(L1) 안에 담기고,
  지도 SDK 폴백에서는 카드 없는 페이지에 그대로 선다. 인셋은 담는 곳이 정한다 (`inset.ts`).
*/
describe('EmergencySection — 3층 표면 (#460)', () => {
  it('기본 인셋은 card(16/20) 다 — 카드 안에서 페이지 인셋 40 을 쓰면 내용이 두 번 밀린다', () => {
    const markup = render()

    expect(markup).toContain('md:px-5')
    expect(markup).not.toContain('md:px-10')
  })

  it('inset="main" 을 받으면 네 상태가 전부 페이지 값 40 으로 선다 — 폴백은 카드가 아니다', () => {
    const states: Partial<EmergencySectionProps>[] = [
      {},
      { loading: true },
      { errorStatus: 500, result: null },
      {
        result: {
          facilities: [],
          totalCount: 0,
          radius: 10_000,
          open24Only: false,
          providerName: '출처',
        },
      },
      // 조건을 켜서 0건 — `reliefs` 갈래
      {
        result: {
          facilities: [facility({ openNow: false })],
          totalCount: 1,
          radius: 10_000,
          open24Only: false,
          providerName: '출처',
        },
        filters: { ...DEFAULT_FACILITY_FILTERS, openNowOnly: true },
      },
      // 위치 안내
      { positionFallback: 'denied' },
    ]

    for (const state of states) {
      const markup = render({ ...state, inset: 'main' })

      expect(markup).toContain('md:px-10')
      expect(markup).not.toContain('md:px-5')
    }
  })

  it('로딩 · 오류 · 목록 · 0건이 같은 인셋에 선다 — 상태가 바뀌는 순간 왼쪽 선이 뛰지 않는다', () => {
    const loading = render({ loading: true })
    const error = render({ errorStatus: 500, result: null })
    const list = render()

    for (const markup of [loading, error, list]) expect(markup).toContain('px-4 md:px-5')
  })

  it('필터 칩이 없다 — 칩은 카드 밖 EmergencyFilterChips 의 몫이다', () => {
    const markup = render()

    expect(markup).not.toContain(`${messages.emergency.typeAll} 1`)
    expect(markup).not.toContain('aria-pressed')
  })

  /*
    2a 의 8px `Band` 는 카드 안에서 각진 불투명 면이 되어 radius 12 모서리를 덮는다(§0).
    출처 줄은 1px 위 선으로 갈린다.
  */
  it('Band 가 없고 출처 줄은 1px 위 선으로 갈린다', () => {
    const markup = render()

    expect(markup).not.toContain('bg-band h-2')
    expect(markup).toMatch(/border-t[^"]*"[^>]*>[^<]*한국문화정보원/)
  })

  /*
    구분선 규약은 행이 아니라 목록이 갖는다 (#439 `SurfaceList`). React 가 임의 variant 를
    `[&amp;&gt;li+li]` 로 이스케이프한다 — 소스 문자열이 아니라 렌더 결과를 본다.
  */
  it('행 사이 선은 SurfaceList 가 긋고 행은 스스로 border-b 를 갖지 않는다', () => {
    const markup = render({
      result: {
        facilities: [facility({ facilityId: '1' }), facility({ facilityId: '2' })],
        totalCount: 2,
        radius: 10_000,
        open24Only: false,
        providerName: '출처',
      },
    })

    expect(markup).toContain('[&amp;&gt;li+li]:border-t')
    expect(markup).not.toMatch(/<li[^>]*border-b/)
  })

  it('스켈레톤도 같은 목록 규약을 쓴다 — 데이터가 오는 순간 선이 뛰지 않는다', () => {
    expect(render({ loading: true })).toContain('[&amp;&gt;li+li]:border-t')
  })
})
