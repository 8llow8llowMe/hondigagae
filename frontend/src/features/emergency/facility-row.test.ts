import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { DirectionsLink, FacilityRow, FacilityRowContent } from '@/features/emergency/facility-row'
import { messages } from '@/lib/messages'
import { facility } from '@/test/fixtures/emergency'

describe('FacilityRowContent', () => {
  it('이름과 진료시간 원문을 그대로 쓴다 — 요약하지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRowContent, { facility: facility(), showDistance: true }),
    )

    expect(markup).toContain('제주24시동물병원')
    expect(markup).toContain('월~금 09:00~19:00, 토 09:00~13:00')
  })

  it('showDistance 가 false 면 거리를 감춘다 — 제주 중심 기준 거리를 내 위치로 읽는다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRowContent, { facility: facility(), showDistance: false }),
    )

    expect(markup).not.toContain('480m')
  })

  it('내용에는 링크도 버튼도 없다 — 호출부가 선택 버튼으로 감쌀 수 있어야 한다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRowContent, { facility: facility(), showDistance: true }),
    )

    expect(markup).not.toContain('<a ')
    expect(markup).not.toContain('<button')
  })
})

describe('DirectionsLink', () => {
  it('좌표가 있으면 길찾기를 준다', () => {
    const markup = renderToStaticMarkup(createElement(DirectionsLink, { facility: facility() }))

    expect(markup).toContain(messages.map.directions)
    expect(markup).toContain('target="_blank"')
  })

  it('좌표가 없으면 아무것도 그리지 않는다 — 눌러도 못 가는 버튼은 없는 것만 못하다', () => {
    const markup = renderToStaticMarkup(
      createElement(DirectionsLink, { facility: facility({ lat: 0, lng: 0 }) }),
    )

    expect(markup).toBe('')
  })
})

describe('FacilityRow', () => {
  it('번호가 없어도 전화 자리를 비우지 않는다 — 자리가 사라지면 화면이 깨진 것으로 읽힌다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility({ tel: null }), showDistance: true }),
    )

    expect(markup).toContain(messages.emergency.telMissing)
    // 아이콘 자리는 남는다
    expect(markup).toContain('<svg')
  })

  it('번호가 있으면 tel 링크에서 숫자 아닌 문자를 걷는다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRow, {
        facility: facility({ tel: '064-000-0000' }),
        showDistance: true,
      }),
    )

    expect(markup).toContain('href="tel:0640000000"')
  })

  /*
    **#537 이 뒤집었다.** 예전 근거는 *"급할 때 누를 것이 둘이면 고르는 데 시간이 든다"*
    였는데, 실제로 급한 사용자의 다음 행동은 "전화" 아니면 "출발" 로 이미 정해져 있고
    길찾기가 없으면 주소를 다른 앱에 옮겨 적어야 했다. 고르는 1초보다 그 비용이 크다.
  */
  it('전화 옆에 길찾기가 있다 — 카카오맵을 새 창으로 연다 (#537)', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility(), showDistance: true }),
    )

    expect(markup).toContain('href="https://map.kakao.com/link/to/')
    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('rel="noopener noreferrer"')
  })

  /*
    행마다 이름이 붙는다. `messages.map.directions`("길찾기")를 그대로 쓰면 스크린리더에
    같은 소리가 행 수만큼 들린다 — 바로 옆 `callLabel` 이 같은 이유로 `{name}` 을 갖는다.
  */
  it('길찾기 버튼의 접근성 이름에 시설 이름이 들어간다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility(), showDistance: true }),
    )

    expect(markup).toContain('aria-label="제주24시동물병원 길찾기"')
  })

  /*
    `DirectionsLink`(지도 패널)는 좌표가 없으면 아무것도 그리지 않지만, 행의 버튼은
    자리를 남긴다 — `CallButton` 과 같은 판단이다. 행마다 버튼 개수가 달라지면 "이 병원만
    뭔가 다르다" 가 아니라 "화면이 깨졌다" 로 읽힌다.
  */
  it('좌표가 없어도 길찾기 자리를 비우지 않는다 — 링크만 걷는다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRow, {
        facility: facility({ lat: 0, lng: 0 }),
        showDistance: true,
      }),
    )

    expect(markup).not.toContain('map.kakao.com/link/to/')
    // 전화 링크 하나만 남고, 길찾기 아이콘 자리는 그대로다
    expect(markup.match(/<svg/g)?.length).toBe(2)
  })
})

/*
  **3층 표면** (`DESIGN.md §0`, #460). 행은 카드 안(목록 갈래)과 카드 밖(지도 SDK 폴백)
  양쪽에서 쓰여 인셋이 하나로 고정될 수 없다 — `PlaceRow` 와 같은 규칙이다.
*/
describe('FacilityRow — 3층 표면 (#460)', () => {
  it('기본 인셋은 card(16/20) 다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility(), showDistance: true }),
    )

    expect(markup).toMatch(/^<li class="px-4 md:px-5"/)
  })

  it('inset="main" 이면 페이지 값 40 이다 — 폴백은 카드가 아니다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility(), showDistance: true, inset: 'main' }),
    )

    expect(markup).toMatch(/^<li class="px-4 md:px-10"/)
  })

  /*
    구분선은 `SurfaceList` 가 항목 사이에만 긋는다 — 행이 `border-b` 를 갖고 `last` 로 끄던
    2a 규약은 행 수를 아는 호출자만 목록을 그릴 수 있게 했다 (#439). 자기 배경도 없다 —
    카드 안 자식은 자기 배경을 갖지 않는다 (§0).
  */
  it('구분선도 배경도 스스로 갖지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility(), showDistance: true }),
    )
    const li = markup.slice(0, markup.indexOf('>'))

    expect(li).not.toContain('border-b')
    expect(li).not.toContain('bg-bg')
  })
})

/*
  **#537 — 운영시간을 한 줄로 접는다. 파싱하지 않는다.**

  이슈는 "오늘 기준 한 줄" 을 요구했지만 요일별 원문에서 오늘 구간을 뽑는 안은 기각돼
  있다 (`types/emergency.ts` 의 `operatingHours` 주석이 정본). dev 실측이 근거다 —
  `월~화, 목~금,토 09:30~20:00, 일 09:30~14:00` 처럼 요일 목록·범위·불규칙한 공백이 섞이고
  수요일이 아예 빠진 곳, 일요일 항목 자체가 없는 곳이 있다. 수요일에 첫 줄을 잘못 읽으면
  **닫힌 병원으로 달려가게 된다.**

  그래서 고친 것은 **판정이 아니라 높이**다. "지금 여는가" 는 서버가 계산한 `openNow` 배지가
  계속 답한다.
*/
describe('FacilityHours — 한 줄로 접기 (#537)', () => {
  const LONG = '월~화, 목~금,토 09:30~20:00, 일 09:30~14:00'

  function row(overrides: Parameters<typeof facility>[0] = {}) {
    return renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility(overrides), showDistance: true }),
    )
  }

  it('원문을 그대로 쓴다 — 오늘 요일로 요약하지 않는다', () => {
    const markup = row({ operatingHours: LONG, restDate: null })

    expect(markup).toContain(LONG)
    expect(markup).not.toContain('오늘')
  })

  it('접힌 동안은 한 줄이다', () => {
    expect(row({ operatingHours: LONG, restDate: null })).toContain('line-clamp-1')
  })

  /* 펼치기는 `aria-expanded` + `aria-controls` 다 — `PlaceOverview` 와 같은 방식 */
  it('긴 시간표에는 펼치기 버튼이 붙고 본문을 가리킨다', () => {
    const markup = row({ operatingHours: LONG, restDate: null })

    expect(markup).toContain(messages.emergency.hoursExpand)
    expect(markup).toMatch(/aria-expanded="false" aria-controls="([^"]+)"/)

    const controls = /aria-controls="([^"]+)"/.exec(markup)?.[1]
    expect(markup).toContain(`<p id="${controls}"`)
  })

  /* 눌러도 아무 일이 없는 버튼은 두지 않는다 — `연중무휴 24시간` 은 한 줄에 들어간다 */
  it('짧은 시간표에는 펼치기 버튼을 두지 않는다', () => {
    const markup = row({ operatingHours: '연중무휴 24시간', restDate: null })

    expect(markup).not.toContain(messages.emergency.hoursExpand)
  })

  /* 휴무를 따로 줄로 빼면 접어서 번 한 줄을 도로 내놓는다 */
  it('휴무는 같은 줄에 이어 붙는다', () => {
    const markup = row({ operatingHours: LONG, restDate: '매주 수요일' })
    const hours = markup.slice(markup.indexOf(LONG))

    expect(hours.slice(0, hours.indexOf('</p>'))).toContain(
      `매주 수요일 ${messages.emergency.restPrefix}`,
    )
  })

  /* 원문이 없는 곳은 "닫힘" 과 구분된다 — 접을 것도 없다 */
  it('시간표가 없으면 없다고 말하고 버튼도 두지 않는다', () => {
    const markup = row({ operatingHours: null, operatingHoursKnown: false })

    expect(markup).toContain(messages.emergency.hoursUnknown)
    expect(markup).not.toContain(messages.emergency.hoursExpand)
  })

  /*
    **지도 패널은 이 내용을 통째로 선택 `<button>` 안에 넣는다.** 펼치기가 기본으로 켜지면
    버튼 안의 버튼이 되어 마크업이 깨진다 — 그래서 `expandableHours` 기본값이 `false` 다.
  */
  it('FacilityRowContent 는 기본으로 펼치기를 그리지 않는다 — 버튼 안에 들어가는 경로다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRowContent, {
        facility: facility({ operatingHours: LONG, restDate: null }),
        showDistance: true,
      }),
    )

    expect(markup).toContain(LONG)
    expect(markup).not.toContain('<button')
    expect(markup).toContain('line-clamp-1')
  })
})
