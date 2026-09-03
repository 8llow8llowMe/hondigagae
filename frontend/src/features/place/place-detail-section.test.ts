import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import type { PlaceDetailActions } from '@/features/place/place-detail-action-bar'
import {
  PlaceDetailSection,
  type PlaceDetailSectionProps,
} from '@/features/place/place-detail-section'
import type { PlaceSuitabilityPanelProps } from '@/features/place/place-suitability-panel'
import type { PlaceWalkSafetyPanelProps } from '@/features/place/place-walk-safety-panel'
import { messages } from '@/lib/messages'
import {
  suitability as suitabilityFixture,
  walkSafety as walkSafetyFixture,
} from '@/test/fixtures/insight'
import {
  placeDetail,
  placeDetailDelisted,
  placeDetailFromTourApi,
  placeDetailWithoutOptionalSections,
} from '@/test/fixtures/place'

/** 판정이 이미 도착한 상태. 판정 분기 자체는 `place-suitability-panel.test.ts` 가 본다 */
const suitability: PlaceSuitabilityPanelProps = {
  data: suitabilityFixture,
  loading: false,
  failed: false,
  onRetry: () => undefined,
  petName: '몽실이',
  authed: true,
}

/** 산책 위험도도 도착한 상태. 분기 자체는 `place-walk-safety-panel.test.ts` 가 본다 */
const walkSafety: PlaceWalkSafetyPanelProps = {
  data: walkSafetyFixture,
  loading: false,
  failed: false,
  onRetry: () => undefined,
  petName: '몽실이',
}

/** 하단 바의 기본 상태 — 로그인 · 미저장 · 아직 담지 않음 */
const actions: PlaceDetailActions = {
  authed: true,
  saved: false,
  savePending: false,
  saveError: null,
  onToggleSave: () => undefined,
  added: false,
  onAddToPlan: () => undefined,
  onLogin: () => undefined,
  delisted: false,
}

function render(overrides: Partial<PlaceDetailSectionProps> = {}) {
  const props: PlaceDetailSectionProps = {
    place: placeDetail,
    loading: false,
    errorStatus: null,
    onRetry: () => undefined,
    suitability,
    walkSafety,
    petName: '몽실이',
    petSizeCode: 'SMALL',
    petSizeName: '소형견',
    actions,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PlaceDetailSection, props))
}

describe('PlaceDetailSection — 상태 배타성', () => {
  it('로딩 중에는 skeleton 만 보이고 본문이 함께 나오지 않는다', () => {
    const markup = render({ loading: true })

    expect(markup).toContain('animate-pulse')
    expect(markup).not.toContain(placeDetail.title)
    expect(markup).not.toContain(messages.common.retry)
  })

  it('성공 시 장소명과 기본 정보를 렌더한다', () => {
    const markup = render()

    expect(markup).toContain(placeDetail.title)
    expect(markup).toContain('제주특별자치도 제주시 한림읍 용금로 906-107')
    expect(markup).not.toContain(messages.common.retry)
  })
})

describe('PlaceDetailSection — 에러 분기', () => {
  it('데이터 부재(404)에서는 재시도 버튼을 노출하지 않는다', () => {
    const markup = render({ place: null, errorStatus: 404 })

    expect(markup).not.toContain(messages.common.retry)
    expect(markup).toContain(messages.place.backToList)
  })

  it('데이터 부재(404)에서는 서버 resultMessage 를 그대로 노출한다', () => {
    const markup = render({
      place: null,
      errorStatus: 404,
      errorMessage: '존재하지 않는 장소입니다.',
    })

    expect(markup).toContain('존재하지 않는 장소입니다.')
  })

  it('resultMessage 가 문자열이 아니면 기본 문구로 대체한다', () => {
    const markup = render({ place: null, errorStatus: 404, errorMessage: { placeId: '형식 오류' } })

    expect(markup).toContain(messages.place.detailNotFoundTitle)
    expect(markup).not.toContain('[object Object]')
  })

  it('일시 장애(5xx)에서는 재시도 버튼을 노출한다', () => {
    const markup = render({ place: null, errorStatus: 503 })

    expect(markup).toContain(messages.common.retry)
    expect(markup).toContain(messages.place.detailErrorTitle)
  })

  it('무응답(status 0)도 일시 장애로 처리해 재시도를 제공한다', () => {
    expect(render({ place: null, errorStatus: 0 })).toContain(messages.common.retry)
  })

  it('입력 오류(400)에서는 재시도 대신 목록으로 안내한다 — 같은 주소는 다시 불러도 400 이다', () => {
    const markup = render({ place: null, errorStatus: 400 })

    expect(markup).toContain(messages.common.validationErrorTitle)
    expect(markup).toContain(messages.place.backToList)
    expect(markup).not.toContain(messages.common.retry)
  })
})

describe('PlaceDetailSection — nullable 섹션은 숨긴다', () => {
  it('intro / images / overview 가 없으면 해당 섹션이 렌더되지 않는다', () => {
    const markup = render({ place: placeDetailWithoutOptionalSections })

    expect(markup).not.toContain(messages.place.detailSectionIntro)
    expect(markup).not.toContain(messages.place.detailSectionOverview)
  })

  it('petInfo 가 없어도 반려견 동반 정보 섹션은 숨기지 않는다 (아트보드 04-①)', () => {
    const markup = render({ place: placeDetailWithoutOptionalSections })

    // 동반 여부는 이 서비스의 핵심 질문이다. 섹션이 사라지면 "확인해 봤는데 없더라" 와
    // "확인조차 안 했다" 를 구분할 수 없다 — 대신 정보 없음을 드러내고 전화로 안내한다
    expect(markup).toContain(messages.place.detailSectionPet)
    expect(markup).toContain(messages.place.detailPetInfoEmptyBadge)
    expect(markup).toContain(messages.place.detailPetInfoEmptyText)
  })

  it('결합 데이터가 없어도 에러가 아니라 장소명이 그대로 보인다', () => {
    const markup = render({ place: placeDetailWithoutOptionalSections })

    expect(markup).toContain(placeDetailWithoutOptionalSections.title)
    expect(markup).not.toContain(messages.common.retry)
  })

  it('intro 객체는 있지만 내부 값이 전부 없으면 섹션을 만들지 않는다', () => {
    const markup = render({
      place: {
        ...placeDetail,
        intro: {
          infoCenter: null,
          useTime: null,
          restDate: null,
          parking: null,
          chkPet: null,
          chkBabyCarriage: null,
          chkCreditCard: null,
        },
      },
    })

    expect(markup).not.toContain(messages.place.detailSectionIntro)
  })

  it('주소가 없으면 주소 줄을 렌더하지 않는다', () => {
    const markup = render({ place: { ...placeDetail, addr1: null, addr2: null } })

    expect(markup).not.toContain(messages.place.detailAddress)
  })

  it('홈페이지 원문이 링크로 볼 수 없는 값이면 줄을 렌더하지 않는다', () => {
    const markup = render({ place: { ...placeDetail, homepage: '전화로 문의해 주세요' } })

    expect(markup).not.toContain(messages.place.detailHomepage)
  })

  it('저작권 코드도 출처명도 없으면 출처 줄을 숨긴다', () => {
    const markup = render({ place: { ...placeDetail, cpyrhtDivCd: null, sourceName: null } })

    expect(markup).not.toContain(messages.place.detailCopyrightPrefix)
    expect(markup).not.toContain('정보 출처')
  })

  it('분류가 없으면 분류 줄을 렌더하지 않는다', () => {
    const markup = render({ place: { ...placeDetail, sourceCategory: null } })

    expect(markup).not.toContain(messages.place.detailSourceCategory)
  })
})

describe('PlaceDetailSection — 실내 여부 (#112)', () => {
  it('메타 줄에 실내 낱말을 붙인다', () => {
    expect(render()).toContain(`문화시설 · ${messages.place.rowIndoor}`)
  })

  it('야외면 야외라고 쓴다 — 서버 값을 그대로 옮긴다', () => {
    const markup = render({ place: { ...placeDetail, indoor: false } })

    expect(markup).toContain(`문화시설 · ${messages.place.rowOutdoor}`)
  })

  it('모르면 메타 줄에서 빼고 "미확인" 배지로 드러낸다 — 야외라고 단정하지 않는다', () => {
    const markup = render({ place: { ...placeDetail, indoor: null } })

    expect(markup).not.toContain(`문화시설 · ${messages.place.rowOutdoor}`)
    // 숨기면 실내 필터에서 이 장소가 왜 사라지는지 설명할 길이 없다 (목록 행과 같은 처리)
    expect(markup).toContain(messages.place.rowIndoorUnknown)
  })

  it('실내 여부를 알면 미확인 배지를 붙이지 않는다', () => {
    expect(render()).not.toContain(messages.place.rowIndoorUnknown)
  })
})

describe('PlaceDetailSection — 분류와 정보 출처 (#112)', () => {
  it('원천이 준 분류를 기본 정보에 낸다 — contentType 으로는 카페·펜션이 갈리지 않는다', () => {
    const markup = render()

    expect(markup).toContain(messages.place.detailSourceCategory)
    expect(markup).toContain('미술관')
  })

  it('저작권 코드가 없는 원천은 sourceName 으로 출처를 밝힌다 — 그전에는 줄이 없었다', () => {
    const markup = render({ place: { ...placeDetail, cpyrhtDivCd: null } })

    expect(markup).toContain('정보 출처: 문화정보원')
  })

  it('저작권 코드가 있으면 기관명과 유형을 쓰고 sourceName 을 겹쳐 쓰지 않는다 (D5-2)', () => {
    // 공공누리 출처 표시 의무는 기관명(한국관광공사)이어야 성립한다 —
    // sourceName 의 "관광정보 API" 로 바꾸면 표기 의무를 만족하지 못한다
    const markup = render({ place: placeDetailFromTourApi })

    expect(markup).toContain(messages.place.detailCopyrightPrefix)
    expect(markup).toContain(messages.place.detailCopyrightType1)
    expect(markup).not.toContain('정보 출처: 관광정보 API')
  })

  it('출처명이 공백뿐이면 줄을 만들지 않는다', () => {
    const markup = render({ place: { ...placeDetail, cpyrhtDivCd: null, sourceName: '   ' } })

    expect(markup).not.toContain('정보 출처')
  })
})

describe('PlaceDetailSection — 서버 문구를 그대로 쓴다', () => {
  it('enum metadata 의 name 을 렌더한다', () => {
    const markup = render()

    expect(markup).toContain(placeDetail.contentType.name)
    expect(markup).toContain(placeDetail.petAllowanceType.name)
    expect(markup).toContain(placeDetail.petInfo?.allowedPetSize.name ?? '')
    // 동반 가능 구역은 배지가 아니라 조건 문장으로 들어간다 — 서버 description 그대로다
    expect(markup).toContain(placeDetail.petInfo?.allowanceScope.description ?? '')
  })

  it('모르는 petAllowanceType code 에서도 화면이 비지 않는다', () => {
    const markup = render({
      place: {
        ...placeDetail,
        petAllowanceType: { code: 'BRAND_NEW_CODE', name: '새 등급', description: null },
      },
    })

    expect(markup).toContain('새 등급')
    expect(markup).toContain(placeDetail.title)
  })
})

describe('PlaceDetailSection — 외부 원문 처리', () => {
  it('개요의 br 태그를 개행으로 바꿔 평문으로 렌더한다', () => {
    const markup = render()

    expect(markup).toContain('제주 자연을 그대로 살린 공간이다.')
    expect(markup).not.toContain('&lt;br&gt;')
  })

  it('홈페이지 anchor 원문에서 href 만 뽑아 새 탭 링크로 만든다', () => {
    const markup = render()

    expect(markup).toContain('href="https://www.visitjeju.net/kr"')
    expect(markup).toContain('rel="noopener noreferrer"')
  })

  it('javascript 스킴 홈페이지는 링크로 만들지 않는다', () => {
    const markup = render({
      place: { ...placeDetail, homepage: '<a href="javascript:alert(1)">클릭</a>' },
    })

    expect(markup).not.toContain('javascript:alert(1)')
    expect(markup).not.toContain(messages.place.detailHomepage)
  })

  it('목줄이 필요 없으면 목줄 배지를 렌더하지 않는다', () => {
    const petInfo = placeDetail.petInfo
    if (petInfo === null) throw new Error('fixture 에 petInfo 가 있어야 한다')

    const markup = render({
      place: { ...placeDetail, petInfo: { ...petInfo, leashRequired: false } },
    })

    expect(markup).not.toContain(messages.place.detailLeashRequired)
  })

  it('사진이 없으면 갤러리 섹션 자체를 렌더하지 않는다 (가이드 §5 PhotoGallery)', () => {
    const markup = render({ place: { ...placeDetail, images: [] } })

    // 상세는 목록과 반대다 — 회색 "이미지 없음" 면이 첫 화면을 덮지 않게 제목부터 시작한다.
    // (목록 행은 행 높이를 지켜야 하므로 같은 크기의 타일을 남긴다 — PlaceRow)
    expect(markup).not.toContain(messages.place.noImage)
    expect(markup).not.toContain(messages.place.photoSource)
    // 사진이 없어도 본문은 그대로 보인다
    expect(markup).toContain(placeDetail.title)
  })

  it('사진이 있으면 갤러리 바로 아래에 사진 출처를 붙인다', () => {
    const markup = render()

    expect(markup).toContain(messages.place.photoSource)
  })

  it('전폭 히어로를 쓰지 않는다 — 표시 폭에 상한이 있다', () => {
    const markup = render()

    // 전폭으로 늘리지 않는다 — 표시 폭이 토큰 상한에 묶여 있다.
    // 장수별 분기는 photo-gallery.test.ts 가 본다.
    expect(markup).not.toContain('aspect-video')
    expect(markup).toContain('--gallery-w-mobile')
  })
})

describe('원천에서 사라진 장소 — 안내를 먼저 보여 준다 (#146)', () => {
  it('delisted 면 제목·설명이 함께 나온다', () => {
    const markup = render({ place: placeDetailDelisted })

    expect(markup).toContain(messages.place.detailDelistedTitle)
    expect(markup).toContain(messages.place.detailDelistedDescription)
  })

  it('delisted 여도 상세 정보는 그대로 남는다 — 200 응답이라 빈 화면이 아니다', () => {
    const markup = render({ place: placeDetailDelisted })

    expect(markup).toContain(placeDetailDelisted.title)
    expect(markup).toContain(messages.place.detailSectionBasic)
  })

  it('평소에는 안내가 없다', () => {
    expect(render()).not.toContain(messages.place.detailDelistedTitle)
  })

  it('404 는 이 경로가 아니다 — 없는 장소는 빈 화면으로 간다', () => {
    const markup = render({ place: null, errorStatus: 404 })

    expect(markup).not.toContain(messages.place.detailDelistedTitle)
    expect(markup).toContain(messages.place.detailNotFoundDescription)
  })
})
