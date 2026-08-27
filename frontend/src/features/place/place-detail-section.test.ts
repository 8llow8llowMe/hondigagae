import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PlaceDetailSection,
  type PlaceDetailSectionProps,
} from '@/features/place/place-detail-section'
import { messages } from '@/lib/messages'
import { placeDetail, placeDetailWithoutOptionalSections } from '@/test/fixtures/place'

function render(overrides: Partial<PlaceDetailSectionProps> = {}) {
  const props: PlaceDetailSectionProps = {
    place: placeDetail,
    loading: false,
    errorStatus: null,
    onRetry: () => undefined,
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
  it('intro / petInfo / images / overview 가 없으면 해당 섹션이 렌더되지 않는다', () => {
    const markup = render({ place: placeDetailWithoutOptionalSections })

    expect(markup).not.toContain(messages.place.detailSectionIntro)
    expect(markup).not.toContain(messages.place.detailSectionPet)
    expect(markup).not.toContain(messages.place.detailSectionImages)
    expect(markup).not.toContain(messages.place.detailSectionOverview)
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

  it('저작권 코드가 없으면 출처 표기 줄을 숨긴다', () => {
    const markup = render({ place: { ...placeDetail, cpyrhtDivCd: null } })

    expect(markup).not.toContain(messages.place.detailCopyrightPrefix)
  })
})

describe('PlaceDetailSection — 서버 문구를 그대로 쓴다', () => {
  it('enum metadata 의 name 을 렌더한다', () => {
    const markup = render()

    expect(markup).toContain(placeDetail.contentType.name)
    expect(markup).toContain(placeDetail.petAllowanceType.name)
    expect(markup).toContain(placeDetail.petInfo?.allowanceScope.name ?? '')
    expect(markup).toContain(placeDetail.petInfo?.allowedPetSize.name ?? '')
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

  it('대표 이미지가 없으면 플레이스홀더를 렌더하고 레이아웃을 유지한다', () => {
    const markup = render()

    expect(markup).toContain(messages.place.noImage)
    expect(markup).toContain('aspect-video')
  })
})
