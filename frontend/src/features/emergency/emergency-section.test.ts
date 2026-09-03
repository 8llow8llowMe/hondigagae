import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  EmergencySection,
  type EmergencySectionProps,
} from '@/features/emergency/emergency-section'
import { messages } from '@/lib/messages'
import { DEFAULT_FACILITY_FILTERS, type NearbyFacilityItem } from '@/types/emergency'

function facility(overrides: Partial<NearbyFacilityItem> = {}): NearbyFacilityItem {
  return {
    facilityId: '4611686018427387904',
    facilityType: { code: 'ANIMAL_HOSPITAL', name: '동물병원', description: null },
    name: '제주24시동물병원',
    addr: '제주특별자치도 제주시 연북로 100',
    lat: 33.48,
    lng: 126.49,
    tel: '064-000-0000',
    operatingHours: '월~금 09:00~19:00, 토 09:00~13:00',
    restDate: '일요일',
    open24: true,
    openNow: true,
    operatingHoursKnown: true,
    distanceMeters: 480,
    ...overrides,
  }
}

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

  it('로딩 중에도 칩 자리를 잡아 둔다 — 나중에 생기면 목록이 아래로 밀린다', () => {
    // 칩 3 + 토글 2 자리
    expect(render({ loading: true }).match(/rounded-md/g)?.length ?? 0).toBeGreaterThanOrEqual(5)
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

  it('등급 색을 쓰지 않는다 — 초록·주황은 산책 위험도 전용이다', () => {
    expect(render()).not.toMatch(/metric-(high|mid|low|critical)/)
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
    expect(markup).toContain('size-13')
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

  it('거부·타임아웃·미지원의 안내가 서로 다르다', () => {
    expect(render({ positionFallback: 'denied' })).toContain(messages.emergency.positionDenied)
    expect(render({ positionFallback: 'timeout' })).toContain(messages.emergency.positionTimeout)
    expect(render({ positionFallback: 'unsupported' })).toContain(
      messages.emergency.positionUnsupported,
    )
  })

  it('미지원 브라우저에는 다시 시도 버튼을 주지 않는다', () => {
    expect(render({ positionFallback: 'unsupported' })).not.toContain(
      messages.emergency.retryPosition,
    )
    expect(render({ positionFallback: 'denied' })).toContain(messages.emergency.retryPosition)
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

describe('EmergencySection — 칩 개수', () => {
  it('다 받았으면 개수를 붙인다', () => {
    expect(render()).toContain(`${messages.emergency.typeAll} 1`)
  })

  it('잘렸으면 숫자를 빼고 라벨만 쓴다', () => {
    const markup = render({
      result: {
        facilities: [facility()],
        totalCount: 120,
        radius: 10_000,
        open24Only: false,
        providerName: '출처',
      },
    })

    expect(markup).toContain(messages.emergency.typeAll)
    expect(markup).not.toContain(`${messages.emergency.typeAll} 1`)
  })

  it('24시간을 켜면 결과가 적다는 사실을 알린다 (백엔드 스키마 지침)', () => {
    const markup = render({ filters: { ...DEFAULT_FACILITY_FILTERS, open24Only: true } })

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
describe('EmergencySection — 유형 칩 라벨 (#205)', () => {
  const EMPTY: EmergencySectionProps['result'] = {
    facilities: [],
    totalCount: 0,
    radius: 10_000,
    open24Only: false,
    providerName: '출처',
  }

  it('결과가 0건이어도 enum 코드를 노출하지 않는다', () => {
    const markup = render({ result: EMPTY })

    expect(markup).not.toContain('ANIMAL_')
  })

  /*
    개수까지 붙여서 본다. 라벨만 검사하면 페이지 제목("병원 · 약국")에 같은 낱말이 있어
    칩이 코드로 떨어져도 테스트가 통과한다.
  */
  it('결과가 0건이어도 두 유형을 한국어로 그린다', () => {
    const markup = render({ result: EMPTY })

    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_HOSPITAL} 0`)
    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_PHARMACY} 0`)
  })

  /* 실제로 가장 자주 밟는 경로다 — 반경 안에 병원만 있는 경우 */
  it('병원만 있는 목록에서도 약국 칩이 한국어다', () => {
    const markup = render()

    expect(markup).not.toContain('ANIMAL_')
    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_PHARMACY} 0`)
  })

  /*
    **목록 행은 그대로 서버 metadata 를 쓴다.** 거기는 데이터가 있는 자리라
    `frontend/CLAUDE.md` 의 "서버 enum metadata 를 그대로 렌더한다" 가 적용된다 —
    이 PR 이 그 규칙을 화면 전체로 뒤집은 것이 아님을 고정한다.
  */
  it('목록 행의 유형 표기는 서버 name 을 계속 쓴다', () => {
    const markup = render({
      result: {
        ...EMPTY,
        facilities: [
          facility({
            facilityType: { code: 'ANIMAL_PHARMACY', name: '동물약국', description: null },
          }),
        ],
        totalCount: 1,
      },
    })

    expect(markup).toContain('동물약국')
  })
})
