import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceRow } from '@/features/place/place-row'
import { messages } from '@/lib/messages'
import { placeSummary } from '@/test/fixtures/place'

function render(place = placeSummary) {
  return renderToStaticMarkup(createElement(PlaceRow, { place }))
}

describe('PlaceRow — 서버 metadata 렌더', () => {
  it('제목과 서버 metadata name 을 그대로 쓴다', () => {
    const markup = render()

    expect(markup).toContain('제주특별자치도립김창열미술관')
    expect(markup).toContain('부분 동반 가능')
    expect(markup).toContain('관광지')
  })

  it('동반 가능 여부에 등급 색을 쓰지 않는다 (DESIGN.md §2-3)', () => {
    const markup = render()

    // 태그는 전부 중립(band)이다. metric-* tint 가 행에 새어들면 안 된다.
    expect(markup).not.toContain('metric-high')
    expect(markup).not.toContain('metric-mid')
    expect(markup).not.toContain('metric-critical')
  })

  it('목록 API 가 점수를 주지 않으므로 적합도 숫자를 그리지 않는다', () => {
    const markup = render()

    expect(markup).not.toContain('/100')
  })
})

describe('PlaceRow — L2 항목 (DESIGN.md §0 · 3a)', () => {
  it('카드가 아니다 — 라운드·그림자를 쓰지 않는다', () => {
    const markup = render()

    expect(markup).not.toContain('rounded-lg')
    expect(markup).not.toContain('shadow')
  })

  /*
    **구분선을 행이 그리지 않는다.** `SurfaceList` 가 `[&>li+li]` 로 항목 사이에만
    긋는다 — 그래서 이 행에는 `last` prop 이 없다. 행이 선을 다시 그리면 목록의 첫
    항목 위에도 선이 생기고(제목 아래 허공에 선) 마지막 항목 아래는 두 줄이 된다.
  */
  it('자기 테두리를 두르지 않는다 — 구분선은 SurfaceList 가 소유한다', () => {
    const markup = render()

    expect(markup).not.toContain('border-b')
    expect(markup).not.toContain('border-t')
  })

  it('기본 인셋은 카드 안 값(16/20)이다 — 3a 가 정본이라 카드가 기본 자리다', () => {
    const markup = render()

    expect(markup).toContain('px-4')
    expect(markup).toContain('md:px-5')
    // 페이지 인셋 40 을 카드 안에서 쓰면 내용이 두 번 밀린다 (§0)
    expect(markup).not.toContain('md:px-10')
  })

  it('카드 밖 사용처는 페이지 인셋을 스스로 밝힌다 — 지도 SDK 실패 폴백 목록', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceRow, { place: placeSummary, inset: 'main' }),
    )

    expect(markup).toContain('md:px-10')
    expect(markup).not.toContain('md:px-5')
  })
})

describe('PlaceRow — 메타 줄 (아트보드 01·03)', () => {
  it('주소를 읍·면·동까지 줄이고 실내/야외를 붙인다', () => {
    const markup = render()

    // fixture 의 addr1 은 `제주특별자치도 제주시 한림읍 용금로 906-107` 이다
    expect(markup).toContain('제주시 한림읍 · 실내')
    expect(markup).not.toContain('용금로')
  })

  it('indoor 가 false 면 야외로 쓴다', () => {
    expect(render({ ...placeSummary, indoor: false })).toContain(
      `한림읍 · ${messages.place.rowOutdoor}`,
    )
  })

  it('아트보드의 거리(4.1km)는 목록 응답에 없으므로 그리지 않는다', () => {
    expect(render()).not.toContain('km')
  })
})

describe('PlaceRow — nullable 처리', () => {
  /*
    **사진 없는 장소가 대부분이다** — dev 실측(제주 400건) 281건(70%). 그래서 그 자리를
    카테고리 일러스트가 채운다 (`lib/place/illustration.ts`). 어느 갈래든 **타일 크기는
    그대로**여서 행 높이가 흔들리지 않는다.
  */
  it('firstImage 가 null 이면 카테고리 일러스트로 같은 크기의 타일을 채운다', () => {
    const markup = render({ ...placeSummary, firstImage: null })

    expect(markup).toContain('/illustrations/place-tourist_spot.svg')
    // 장식이므로 이름을 읽히지 않는다 — 카테고리는 배지가 낱말로 말한다
    expect(markup).toContain('alt=""')
    expect(markup).toContain('size-20')
  })

  /*
    #67 B. **"사진이 없다" 와 "사진이 있는데 못 쓴다" 는 다른 갈래다.** 계약은 사진이 있다고
    말하는데 `next.config.ts` 의 `remotePatterns` 에 없는 호스트라 `next/image` 에 넘길 수 없다.

    **넘겨 버리면 런타임에 던져 화면 전체가 죽는다** (`lib/image/remote-host.ts` 머리주석).
    `imageSrc` 의 거절만 단위 테스트로 잠가 두면 부족하다 — 호출부가 그 `null` 을 받아
    자리를 채우는 것까지가 이 갈래다. mock 이 이 케이스를 한 곳에 싣고 있다
    (`api/mock/place-data.ts` 의 `UNREGISTERED_HOST_IMAGE`).
  */
  it('허용 목록 밖 호스트면 URL 을 내보내지 않고 사진 없음과 같은 자리를 채운다', () => {
    const markup = render({
      ...placeSummary,
      firstImage: 'http://cdn.not-allowed.invalid/photo/a.jpg',
    })

    expect(markup).not.toContain('not-allowed.invalid')
    expect(markup).toContain('/illustrations/place-tourist_spot.svg')
    expect(markup).toContain('size-20')
  })

  it('자산이 없는 카테고리는 "이미지 없음" 타일로 떨어진다 — 카테고리를 지어내지 않는다', () => {
    const markup = render({
      ...placeSummary,
      firstImage: null,
      contentType: { code: 'FESTIVAL', name: '축제·공연', description: null },
    })

    expect(markup).toContain(messages.place.noImage)
    expect(markup).not.toContain('/illustrations/')
    expect(markup).toContain('size-20')
  })

  it('addr1 이 null 이면 주소를 빼고 실내/야외만 남긴다', () => {
    const markup = render({ ...placeSummary, addr1: null })

    expect(markup).not.toContain('제주시 한림읍')
    expect(markup).toContain(messages.place.rowIndoor)
  })

  it('addr1 · indoor 가 모두 없으면 메타 줄 자체를 렌더하지 않는다', () => {
    const markup = render({ ...placeSummary, addr1: null, indoor: null })

    expect(markup).not.toContain('tabular-nums')
  })

  it('indoor 가 null 이면 "모름" 을 점선 배지로 드러낸다', () => {
    const markup = render({ ...placeSummary, indoor: null })

    expect(markup).toContain(messages.place.rowIndoorUnknown)
    expect(markup).toContain('border-dashed')
  })

  it('indoor 를 아는 장소에는 점선 배지를 붙이지 않는다', () => {
    expect(render()).not.toContain('border-dashed')
  })
})

describe('PlaceRow — 링크', () => {
  it('행 전체가 상세로 가는 링크다', () => {
    const markup = render()

    expect(markup).toContain(`href="/places/${placeSummary.placeId}"`)
  })

  it('중첩 링크를 만들지 않는다 — 행 안에 a 는 하나뿐이다', () => {
    const markup = render()

    expect(markup.match(/<a /g)).toHaveLength(1)
  })
})

describe('PlaceRow — 좁은 컨테이너에서도 제목이 남는다 (#240)', () => {
  /*
    **뷰포트 breakpoint 가 컨테이너 폭을 모르는 것이 원인이었다.** 태그 우측 열
    (`w-56` = 224px)을 `lg:` 로 두었더니 데스크톱의 지도 좌측 패널(폭 400px)에서
    96px 썸네일 + gap + 224px 을 빼고 제목에 40~50px 만 남아 `테…` 로 잘렸다.
    컨테이너 쿼리로 바꿨으므로 **소비처가 `@container` 를 주고 규칙이 `@lg:` 여야 한다** —
    둘 중 하나가 빠지면 그 자리에서 잘림이 되살아난다.
  */
  it('부모가 컨테이너를 열고 태그 규칙이 컨테이너 기준이다', () => {
    const markup = render()

    expect(markup).toContain('@container')
    // 넓은 컨테이너: 우측 고정 열
    expect(markup).toContain('@lg:flex')
    // 좁은 컨테이너: 텍스트 블록 안 + 제목 위로 (order-first)
    expect(markup).toContain('order-first')
    expect(markup).toContain('@lg:hidden')
    /*
      뷰포트 기준 규칙이 남아 있으면 같은 결함이 재발한다. `@` 가 붙지 않은 `lg:` 만
      잡아야 하므로 부분문자열로 보지 않는다 — `@lg:hidden` 이 `lg:hidden` 을 포함한다.
    */
    expect(markup).not.toMatch(/[^@]lg:(hidden|flex|size-24)/)
  })

  /** DOM 순서는 제목이 먼저다 — 시각 순서만 `order-first` 로 바꾼다 */
  it('스크린리더는 제목을 먼저 읽는다 — 배지가 DOM 앞으로 오지 않는다', () => {
    const markup = render()

    expect(markup.indexOf('제주특별자치도립김창열미술관')).toBeLessThan(
      markup.indexOf('order-first'),
    )
  })
})
