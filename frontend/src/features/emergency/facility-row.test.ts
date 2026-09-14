import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { DirectionsLink, FacilityRow, FacilityRowContent } from '@/features/emergency/facility-row'
import { messages } from '@/lib/messages'
import { facility, pharmacy } from '@/test/fixtures/emergency'

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
  **#537 이 한 줄로 접었고, #598 이 두 줄로 늘리며 펼치기를 걷었다. 파싱은 여전히 안 한다.**

  두 이슈가 요구한 것은 각각 "오늘 기준 한 줄" 과 "두 줄로 날짜, 시간" 인데, 둘 다 원문을
  요일·시각으로 쪼개는 안을 뜻할 수 있었고 **두 번 다 기각했다** (`types/emergency.ts` 의
  `operatingHours` 주석이 정본). dev 실측이 근거다 — `월~화, 목~금,토 09:30~20:00,
  일 09:30~14:00` 처럼 요일 목록·범위·불규칙한 공백이 섞이고 수요일이 아예 빠진 곳,
  일요일 항목 자체가 없는 곳이 있다. 수요일에 첫 줄을 잘못 읽으면 **닫힌 병원으로
  달려가게 된다.**

  그래서 두 번 다 고친 것은 **판정이 아니라 높이**다. "지금 여는가" 는 서버가 계산한
  `openNow` 배지가 계속 답한다.
*/
describe('FacilityHours — 두 줄까지 흘린다 (#598)', () => {
  const LONG = '월~화, 목~금,토 09:30~20:00, 일 09:30~14:00'

  function row(overrides: Parameters<typeof facility>[0] = {}) {
    return renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility(overrides), showDistance: true }),
    )
  }

  it('원문을 그대로 쓴다 — 요일과 시각으로 쪼개지 않는다', () => {
    const markup = row({ operatingHours: LONG, restDate: null })

    expect(markup).toContain(LONG)
    expect(markup).not.toContain('오늘')
  })

  /*
    한 줄이 아니라 두 줄이다. 상한 자체는 남는다 — 원문 길이가 시설마다 제각각이라
    (`법정공휴일` 항목까지 붙는 곳이 있다) 없으면 한 행이 목록의 리듬을 혼자 깬다.
  */
  it('두 줄에서 자른다 — line-clamp-1 이 아니다', () => {
    const markup = row({ operatingHours: LONG, restDate: null })

    expect(markup).toContain('line-clamp-2')
    expect(markup).not.toContain('line-clamp-1')
  })

  /*
    **#598 이 `전체 시간표` 를 걷었다.** 한 줄로 접은 나머지에 손이 닿게 하려던 버튼인데,
    두 줄이면 대부분 끝까지 보이는 데다 44px 터치 영역이 행마다 한 줄을 더 먹었다.
  */
  it('펼치기 버튼을 두지 않는다 — 긴 시간표에도', () => {
    const markup = row({ operatingHours: LONG, restDate: null })

    expect(markup).not.toContain('전체 시간표')
    expect(markup).not.toContain('aria-expanded')
  })

  /* 휴무를 따로 줄로 빼면 두 줄이 세 줄이 된다 */
  it('휴무는 같은 줄에 이어 붙는다', () => {
    const markup = row({ operatingHours: LONG, restDate: '매주 수요일' })
    const hours = markup.slice(markup.indexOf(LONG))

    expect(hours.slice(0, hours.indexOf('</p>'))).toContain(
      `매주 수요일 ${messages.emergency.restPrefix}`,
    )
  })

  /* 원문이 없는 곳은 "닫힘" 과 구분된다 */
  it('시간표가 없으면 없다고 말한다', () => {
    const markup = row({ operatingHours: null, operatingHoursKnown: false })

    expect(markup).toContain(messages.emergency.hoursUnknown)
  })
})

/*
  **#598 — 1행이 `이름 [유형] ···(공백)··· [상태]` 다.**

  상태 배지가 이름 아래 자기 줄을 쓰던 것을 첫 줄 오른쪽 끝으로 올렸다. 목록을 훑을 때
  눈이 왼쪽(무엇)과 오른쪽(지금 여는가) 두 기둥만 보면 된다.
*/
describe('FacilityRowContent — 1행 배치와 상태 색 (#598)', () => {
  function content(overrides: Parameters<typeof facility>[0] = {}) {
    return renderToStaticMarkup(
      createElement(FacilityRowContent, { facility: facility(overrides), showDistance: true }),
    )
  }

  /*
    이름과 상태가 **같은 flex 행**에 있어야 한다. 둘이 갈리면 상태가 자기 줄로 되돌아간
    것이라, 그때 색 결정(아래)의 근거도 함께 사라진다.
  */
  it('이름과 상태 배지가 한 줄에 있다', () => {
    const markup = content()
    const firstRow = markup.slice(0, markup.indexOf('</div></div>'))

    expect(firstRow).toContain('제주24시동물병원')
    expect(firstRow).toContain(messages.emergency.statusOpen)
  })

  /*
    **색이 아니라 무게로 가르던 규칙을 뒤집은 것이다** (`OpenStatus` 머리주석).
    끝자리에서 `24시간` 과 나란히 서면 회색 배지 둘이 모양으로 구별되지 않는다.
    톤은 새로 내지 않고 `Badge` 의 `brand` · `danger` 를 그대로 쓴다.
  */
  it('진료중은 초록(brand), 영업 종료는 빨강(danger) 톤이다', () => {
    expect(content({ openNow: true })).toContain('bg-metric-high-100')
    expect(content({ openNow: false })).toContain('bg-danger-100')
  })

  /*
    `null` 은 "닫힘" 이 아니라 **판정할 수 없음**이다. 세 번째 색을 주면 초록·빨강의 대비가
    묽어지고 "확인 필요" 가 "주의" 로 읽힌다 — 점선 중립을 그대로 둔다.
  */
  it('영업 여부를 모르면 색을 주지 않는다 — 점선 중립이다', () => {
    const markup = content({ openNow: null })

    expect(markup).toContain(messages.emergency.statusUnknown)
    expect(markup).toContain('border-dashed')
    expect(markup).not.toContain('bg-metric-high-100')
    expect(markup).not.toContain('bg-danger-100')
  })

  /*
    **주소를 자르지 않는다.** 예전에는 `shortAddress()` 로 `제주시` 까지만 보여 같은 시·군의
    두 병원이 메타 줄에서 구별되지 않았다 — 이 화면에서 주소는 "어디쯤인지" 가 아니라
    찾아갈 곳이다. `/places` 는 축약을 계속 쓴다.
  */
  it('주소를 전체로 보여준다 — 시·군까지 자르지 않는다', () => {
    expect(content()).toContain('제주특별자치도 제주시 연북로 100')
  })

  /*
    **유형 배지는 약국에만 붙인다** (`facility-row.tsx` 의 해당 줄). 목록 대부분이 병원이라
    전부 붙이면 신호가 죽고, 1행 오른쪽 끝 상태 배지와도 자리를 다툰다.
  */
  it('유형 배지는 약국에만 붙는다', () => {
    // `size="sm"` 배지는 이 행에서 유형 배지 하나뿐이다 — 이름에 `동물병원` 이 들어가는
    // 시설이 많아 문자열로는 가려낼 수 없다 (`제주24시동물병원`)
    expect(content()).not.toContain('h-5 px-2')
    expect(
      renderToStaticMarkup(
        createElement(FacilityRowContent, { facility: pharmacy(), showDistance: true }),
      ),
    ).toContain('동물약국')
  })
})
