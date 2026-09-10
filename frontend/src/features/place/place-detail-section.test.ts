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
import type { PlaceDetail } from '@/types/place'

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
    // "확인조차 안 했다" 를 구분할 수 없다 — 대신 없는 것이 무엇인지 드러내고 전화로 안내한다.
    //
    // **이 픽스처는 `petAllowanceType` 이 `PARTIALLY_ALLOWED` 다.** 즉 동반 여부는
    // 등록돼 있고 세부 조건만 없는 상태라, "동반 가능 여부가 등록되지 않았어요" 라고
    // 말하면 제목 옆 배지와 다른 말을 한다. `UNKNOWN` 갈래는 place-pet-info.test.ts 가 잠근다.
    expect(markup).toContain(messages.place.detailSectionPet)
    expect(markup).toContain(placeDetailWithoutOptionalSections.petAllowanceType.description)
    expect(markup).toContain(messages.place.detailPetInfoDetailsMissingText)
    expect(markup).not.toContain(messages.place.detailPetInfoEmptyText)
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
          open24: null,
          openNow: null,
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

  it('사진이 없으면 카테고리 일러스트로 자리를 채운다 (DESIGN.md §7-3)', () => {
    // fixture 의 contentType 은 CULTURE — 일러스트 자산이 있는 코드다
    const markup = render({ place: { ...placeDetail, images: [], firstImage: null } })

    expect(markup).toContain('/illustrations/place-culture.svg')
    // 없애려던 것은 자리가 아니라 **회색 벽**이었다. 그것은 여전히 그리지 않는다
    expect(markup).not.toContain(messages.place.noImage)
    // 일러스트는 한국관광공사가 준 사진이 아니다 — 사진 출처를 달지 않는다
    expect(markup).not.toContain(messages.place.photoSource)
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

describe('PlaceDetailSection — 모바일 하단 바의 바닥 오프셋', () => {
  /**
   * 바는 `lg` 미만에서 보이지만 그것이 비켜야 할 **고정 탭바는 `md:hidden`** 이다.
   * 두 breakpoint 를 같은 값으로 묶어 `bottom-16` 만 두었더니 768~1023 에서 바가
   * 바닥에서 64px 떠 그 아래로 본문이 비쳤다(실측: 900×800).
   */
  it('탭바가 사라지는 md 부터는 바닥에 붙는다', () => {
    const markup = render()

    expect(markup).toContain('bottom-16')
    expect(markup).toContain('md:bottom-0')
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

/*
  기본 정보의 **자리**를 고정한다.

  좌측 레일에 있던 동안에는 주소·전화·운영시간이 판정 아래로 밀려 있었다 — 상세에 들어온
  사람이 제일 먼저 묻는 "여기 어디고 몇 시까지 하냐" 가 판정보다 뒤였던 것이다.

  **DOM 순서 하나로 두 폭을 만든다.** 데스크톱은 grid 가 판정을 좌측 열로 보내지만
  (`.rail-layout-detail`), 모바일은 이 순서 그대로 쌓인다. 그래서 여기서 순서가 뒤집히면
  모바일이 곧바로 회귀한다 — 트리를 폭마다 나누면 스크린리더가 같은 내용을 두 번 읽는다.
*/
describe('PlaceDetailSection — 기본 정보의 자리', () => {
  it('제목 다음, 판정보다 먼저 온다', () => {
    const markup = render()

    const title = markup.indexOf(placeDetail.title)
    const basic = markup.indexOf(messages.place.detailSectionBasic)
    // 판정 패널의 첫 줄 — `{name}에게 적합해요` (`place-suitability-panel.tsx`)
    const verdict = markup.indexOf(
      messages.place.detailSuitabilitySpeaker.replace('{name}', '몽실이'),
    )

    expect(title).toBeGreaterThanOrEqual(0)
    expect(verdict).toBeGreaterThanOrEqual(0)
    expect(basic).toBeGreaterThan(title)
    expect(basic).toBeLessThan(verdict)
  })

  it('본문 절(반려견 동반 정보)보다는 앞이다 — 순서가 갤러리 → 제목 → 기본 정보 → 판정 → 본문이다', () => {
    const markup = render()

    expect(markup.indexOf(messages.place.detailSectionBasic)).toBeLessThan(
      markup.indexOf(messages.place.detailSectionPet),
    )
  })

  it('좌표가 있으면 기본 정보 안에 길찾기가 함께 선다 (#14)', () => {
    const markup = render()

    expect(markup).toContain(messages.map.directions)
    expect(markup.indexOf(messages.place.detailSectionBasic)).toBeLessThan(
      markup.indexOf(messages.map.directions),
    )
  })
})

/*
  **#294.** 영업 상태는 `운영시간` 원문 **위**에 서는 판정값이다.

  **`openNow: null` 을 드러내지 않는 것이 이 묶음의 요점이다.** 긴급 시설은 같은 `null` 을
  점선 배지("영업 여부 확인 필요")로 드러내지만, 그 화면에는 원문조차 없는 곳이 있어 "모름"
  이 정보였다. 장소는 원문이 항상 함께 있어 정보가 아니다 — dev 실측 2026-09-08 로 장소
  200곳의 `openNow` 가 전부 `null` 이라, 드러냈다면 131곳 전부가 그 배지 하나만 달았다.
*/
describe('PlaceDetailSection — 영업 상태 (#294)', () => {
  function withIntro(overrides: Partial<NonNullable<PlaceDetail['intro']>>) {
    return render({
      place: {
        ...placeDetail,
        intro: { ...placeDetail.intro!, ...overrides },
      },
    })
  }

  it('openNow 가 true 면 영업 중을 쓴다', () => {
    const markup = withIntro({ open24: false, openNow: true })

    expect(markup).toContain(messages.place.detailOpenNow)
    expect(markup).not.toContain(messages.place.detailOpenClosed)
  })

  it('openNow 가 false 면 영업 종료를 쓴다', () => {
    const markup = withIntro({ open24: false, openNow: false })

    expect(markup).toContain(messages.place.detailOpenClosed)
    expect(markup).not.toContain(messages.place.detailOpenNow)
  })

  /*
    24시간인 곳에 "지금 영업 중" 은 동어반복이고 "영업 종료" 는 모순이다. 그 모순이 실제로
    오므로(긴급 시설 dev 응답의 청사약국 — `10:00~24:00` 인데 `open24: true`/`openNow: false`)
    화면은 `24시간` 하나만 말한다.
  */
  it('open24 면 openNow 가 어긋나도 24시간만 쓴다', () => {
    const markup = withIntro({ open24: true, openNow: false })

    expect(markup).toContain(messages.place.detailOpen24)
    expect(markup).not.toContain(messages.place.detailOpenClosed)
    expect(markup).not.toContain(messages.place.detailOpenNow)
  })

  it('open24 이고 openNow 가 null 이어도 24시간을 쓴다', () => {
    expect(withIntro({ open24: true, openNow: null })).toContain(messages.place.detailOpen24)
  })

  /* 이 갈래가 회귀하면 dev 의 모든 장소에 쓸모없는 배지가 붙는다 */
  it('openNow 가 null 이면 배지를 아예 그리지 않는다', () => {
    const markup = withIntro({ open24: false, openNow: null })

    expect(markup).not.toContain(messages.place.detailOpenNow)
    expect(markup).not.toContain(messages.place.detailOpenClosed)
    expect(markup).not.toContain(messages.place.detailOpen24)
  })

  it('open24 가 null 이어도 같다 — false 와 구분해 다루지 않는다', () => {
    const markup = withIntro({ open24: null, openNow: null })

    expect(markup).not.toContain(messages.place.detailOpen24)
  })

  /* 판정값은 원문을 대체하지 않는다 — 위계를 가르는 것이지 감추는 것이 아니다 */
  it('어느 갈래에서도 운영시간 원문이 남는다', () => {
    const useTime = placeDetail.intro!.useTime!

    expect(withIntro({ open24: false, openNow: true })).toContain(useTime)
    expect(withIntro({ open24: false, openNow: false })).toContain(useTime)
    expect(withIntro({ open24: true, openNow: false })).toContain(useTime)
    expect(withIntro({ open24: false, openNow: null })).toContain(useTime)
  })

  /*
    `useTime` 이 없으면 `운영시간` 행 자체가 사라지는 기존 동작을 그대로 둔다.
    근거 없이 판정만 오는 갈래는 계약상 없다 (`types/place.ts` 의 `openNow` 주석).
  */
  it('운영시간 원문이 없으면 행이 사라져 판정값도 함께 사라진다', () => {
    const markup = withIntro({ useTime: null, open24: false, openNow: true })

    expect(markup).not.toContain(messages.place.detailUseTime)
    expect(markup).not.toContain(messages.place.detailOpenNow)
  })
})

describe('3층 표면 (#443) — 절마다 카드 판정', () => {
  /** `Surface`(L1) 의 클래스 — `surface.test.ts` 가 값을 잠근다. 여기서는 개수만 센다 */
  const SURFACE = /<section[^>]*class="bg-bg border-border border-y md:rounded-lg md:border"/g

  it('2a 밴드와 열 구분선을 쓰지 않는다 — 카드 간격과 바닥이 경계다', () => {
    const markup = render()

    expect(markup).not.toContain('bg-band h-2')
    expect(markup).not.toContain('lg:border-l')
  })

  it('기본 정보 · 동반 정보 · 소개 · 이용 안내가 각각 카드고, 판정이 한 카드라 다섯이다', () => {
    const markup = render()

    expect(markup.match(SURFACE)).toHaveLength(5)
    for (const title of [
      messages.place.detailSectionBasic,
      messages.place.detailSectionPet,
      messages.place.detailSectionOverview,
      messages.place.detailSectionIntro,
    ]) {
      // 제목이 카드 안의 h2 다 — 카드 밖 h2 는 없다
      expect(markup).toMatch(new RegExp(`<h2[^>]*>${title}</h2>`))
    }
  })

  it('갤러리와 제목 줄은 카드가 아니다 — h1 은 어느 section 안에도 없다', () => {
    const markup = render()
    const h1 = markup.indexOf('<h1')
    const firstSection = markup.search(SURFACE)

    expect(h1).toBeGreaterThan(-1)
    expect(h1).toBeLessThan(firstSection)
  })

  it('적합도 · 산책 위험도 · 데스크톱 하단 바가 한 카드다 — 같은 화자가 이어 말한다', () => {
    const markup = render()
    const start = markup.indexOf(`aria-label="${messages.place.detailVerdictCardLabel}"`)
    expect(start).toBeGreaterThan(-1)
    const card = markup.slice(start, markup.indexOf('</section>', start))

    expect(card).toContain(messages.place.detailSectionSuitability)
    expect(card).toContain(messages.place.detailWalkSafetyLabel)
    expect(card).toContain(messages.plan.addToPlanAction)
    expect(card).toContain('hidden lg:block')
    // 카드 안 자식은 자기 배경을 갖지 않는다 — 배경은 sticky 갈래(카드 밖)만
    expect(card).not.toContain('bg-bg sticky')
  })

  it('폐업 안내는 채움 상자가 아니라 스트립이다 — L0 위에서 --band 는 대비 1.06 으로 보이지 않는다', () => {
    const markup = render({ place: placeDetailDelisted })
    const start = markup.indexOf(messages.place.detailDelistedTitle)
    // 안내는 브레드크럼 다음, 첫 카드 앞이다 — 그 앞 300자 안에 감싸는 두 div 가 있다
    const strip = markup.slice(Math.max(0, start - 300), start)

    expect(strip).toContain('border-b')
    expect(strip).not.toContain('bg-band')
    expect(strip).not.toContain('rounded-md')
  })

  it('카드 안은 카드 인셋(16/20)이다 — 페이지 인셋 40 은 브레드크럼 한 곳뿐이다', () => {
    const markup = render()

    expect(markup.match(/md:px-10/g)).toHaveLength(1)
    expect((markup.match(/md:px-5/g) ?? []).length).toBeGreaterThanOrEqual(6)
  })

  it('로딩 스켈레톤도 같은 표면이다 — 밴드가 아니라 카드 리듬', () => {
    const markup = render({ loading: true, place: null })

    expect(markup).not.toContain('bg-band h-2')
    expect((markup.match(SURFACE) ?? []).length).toBeGreaterThanOrEqual(5)
  })
})
