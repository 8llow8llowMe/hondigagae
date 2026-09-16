import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { DirectionsLink, FacilityRow, FacilityRowContent } from '@/features/emergency/facility-row'
import { messages } from '@/lib/messages'
import { facility, pharmacy } from '@/test/fixtures/emergency'

describe('FacilityRowContent', () => {
  it('이름과 진료시간 원문을 그대로 쓴다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRowContent, { facility: facility(), showDistance: true }),
    )

    expect(markup).toContain('제주24시동물병원')
    expect(markup).toContain('월~금 09:00~19:00, 토 09:00~13:00')
  })

  /*
    **지도 패널 갈래는 펼치기를 쓰지 않는다** (#654). 이 묶음은 호출부가 선택 버튼으로
    감싸는데(`emergency-map-panel.tsx`) `<summary>` 는 interactive content 라 `<button>`
    안에 들어갈 수 없다 — `<a>` 를 넣지 못하는 것과 같은 제약이다. 대신 오늘 한 줄과
    원문을 **둘 다** 그려 감추는 것이 없게 한다.
  */
  it('오늘 한 줄과 원문을 함께 그리고 details 를 쓰지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRowContent, {
        facility: facility({
          open24: false,
          openNow: true,
          restDate: null,
          operatingHours: '월~금 09:00~19:00, 토 09:00~13:00',
        }),
        showDistance: true,
        // 2026-09-16 은 수요일
        now: new Date(2026, 8, 16, 12),
      }),
    )

    expect(markup).toContain('오늘 19:00까지')
    expect(markup).toContain('월~금 09:00~19:00, 토 09:00~13:00')
    expect(markup).not.toContain('<details')
    expect(markup).not.toContain('<summary')
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
    // 전화·길찾기 아이콘 둘 + 오늘 한 줄의 펼치기 셰브런 하나 (#654)
    expect(markup.match(/<svg/g)?.length).toBe(3)
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
  **#537 이 한 줄로 접었고, #598 이 두 줄로 늘리며 펼치기를 걷었다. #654 가 오늘 한 줄로
  접으면서 펼치기를 되살렸다.**

  앞의 두 이슈가 기각한 것은 **검증 없는 파싱**이다 — dev 실측에 `월~화, 목~금,토
  09:30~20:00, 일 09:30~14:00` 처럼 수요일이 아예 빠진 원문이 있고, 첫 줄을 오늘로 잘못
  읽으면 **닫힌 병원으로 달려가게 된다.** #654 는 그 금지를 불변식으로 바꿔 세운다
  (`lib/emergency/operating-hours.ts`): 상태는 서버 `openNow` 만 근거로 삼고, 조각 하나라도
  못 읽으면 침묵하고, 원문에서 읽은 개폐가 서버와 어긋나면 읽기를 버린다.

  그래서 이 파일이 재는 것은 **두 갈래가 각각 무엇을 그리는가**다. 읽기 자체는
  `lib/emergency/operating-hours.test.ts` 가 잰다.
*/
describe('FacilityHours — 오늘 한 줄과 원문 갈래 (#654 E-4)', () => {
  /** dev 실측 — 수요일이 빠져 있고 앞 두 조각에 시각이 없다 */
  const LONG = '월~화, 목~금,토 09:30~20:00, 일 09:30~14:00'
  /** 2026-09-16 은 수요일. 로컬 성분으로 만든다 (TZ 무관) */
  const WED_NOON = new Date(2026, 8, 16, 12)

  function row(overrides: Parameters<typeof facility>[0] = {}, now = WED_NOON) {
    return renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility(overrides), showDistance: true, now }),
    )
  }

  describe('읽은 갈래 — 오늘 한 줄로 접고 원문은 펼치기 안에 둔다', () => {
    const OPEN_WED = {
      open24: false,
      openNow: true,
      restDate: null,
      operatingHours: '월~금 09:00~19:00, 토 09:00~13:00',
    } as const

    it('오늘 마감 시각을 말한다 — 상태는 되풀이하지 않는다', () => {
      const markup = row(OPEN_WED)

      expect(markup).toContain('오늘 19:00까지')
      // `진료중` 은 머리 배지의 몫이다 — 시간 줄이 같은 말을 두 번 하지 않는다
      expect(markup.slice(markup.indexOf('<details'))).not.toContain(messages.emergency.statusOpen)
    })

    /*
      **원문을 지우지 않는다.** 요약이 틀렸을 때 확인할 곳이 없으면 #598 이 걷어낸
      "잘린 뒤를 되찾을 길이 없다" 가 그대로 돌아온다. 시설 상세 라우트도 없다 (#148).
    */
    it('원문을 펼치기 안에 그대로 남긴다', () => {
      const markup = row(OPEN_WED)

      expect(markup).toContain('<details')
      expect(markup).toContain(messages.emergency.hoursDetail)
      expect(markup).toContain('월~금 09:00~19:00, 토 09:00~13:00')
    })

    /*
      **펼치기가 제 줄을 갖지 않는다.** #598 이 `전체 시간표` 버튼을 걷은 이유가
      *"44px 터치 영역이 행마다 한 줄을 더 먹었다"* 였다 — 오늘 한 줄 자체가 `<summary>` 라
      손잡이가 새 줄을 만들지 않으면서 44px 을 지킨다 (DESIGN.md §7).
    */
    it('펼치기 손잡이가 오늘 한 줄 자신이고 44px 이다', () => {
      const markup = row(OPEN_WED)
      const summary = markup.slice(markup.indexOf('<summary'), markup.indexOf('</summary>'))

      expect(summary).toContain('min-h-11')
      expect(summary).toContain('오늘 19:00까지')
    })

    it('닫혀 있으면 다시 여는 시각을 말한다', () => {
      const markup = row(
        { open24: false, openNow: false, restDate: null, operatingHours: '월~금 10:00~19:00' },
        new Date(2026, 8, 16, 21),
      )

      expect(markup).toContain('내일 10:00부터')
    })

    /*
      **오늘이 휴무면 다음 영업일을 찾는다** (#654). 토요일 밤 · 일요일 휴무면 다음은
      이틀 뒤 월요일이다 — "내일" 이라고 쓰면 닫힌 병원 앞에 서게 된다.
    */
    it('내일이 휴무면 그 다음 영업일을 말한다', () => {
      const markup = row(
        {
          open24: false,
          openNow: false,
          restDate: '일요일',
          operatingHours: '월~금 10:00~19:00, 토 10:00~14:00',
        },
        // 2026-09-19 는 토요일
        new Date(2026, 8, 19, 21),
      )

      expect(markup).toContain('월요일 10:00부터')
    })

    it('24시간으로 확인된 곳은 마감 시각을 말하지 않는다', () => {
      const markup = row({ open24: true, openNow: true, operatingHours: '연중무휴 24시간' })

      expect(markup).toContain(messages.emergency.hoursOpen24)
      expect(markup).not.toContain('까지')
    })
  })

  describe('읽지 못한 갈래 — #598 의 렌더 그대로다', () => {
    /** 수요일이 빠진 원문인데 서버는 진료중이라고 한다 → 읽기를 버린다 */
    const UNREADABLE = {
      open24: false,
      openNow: true,
      restDate: null,
      operatingHours: LONG,
    } as const

    it('원문을 그대로 쓰고 시각을 지어내지 않는다', () => {
      const markup = row(UNREADABLE)

      expect(markup).toContain(LONG)
      expect(markup).not.toContain('까지')
      expect(markup).not.toContain('부터')
    })

    /*
      상한은 남는다 — 원문 길이가 시설마다 제각각이라(`법정공휴일` 항목까지 붙는 곳이
      있다) 없으면 한 행이 목록의 리듬을 혼자 깬다.
    */
    it('두 줄에서 자른다 — line-clamp-1 이 아니다', () => {
      const markup = row(UNREADABLE)

      expect(markup).toContain('line-clamp-2')
      expect(markup).not.toContain('line-clamp-1')
    })

    /* 접을 요약이 없으면 펼치기도 없다 — 눌러도 아무 일이 없는 손잡이를 두지 않는다 */
    it('펼치기를 두지 않는다', () => {
      const markup = row(UNREADABLE)

      expect(markup).not.toContain('<details')
      expect(markup).not.toContain(messages.emergency.hoursDetail)
    })

    /*
      **서버가 판정하지 못한 곳도 이 갈래다.** `openNow === null` 은 "닫힘" 이 아니라
      "판정할 수 없음" 이고 머리 배지도 점선 "확인 필요" 를 단다 — 시간 줄만 혼자
      시각을 확언하면 같은 행이 두 가지를 말한다.
    */
    it('openNow 가 null 이면 요약하지 않는다', () => {
      const markup = row({
        open24: false,
        openNow: null,
        restDate: null,
        operatingHours: '월~금 09:00~19:00',
      })

      expect(markup).toContain(messages.emergency.statusUnknown)
      expect(markup).not.toContain('<details')
      expect(markup).toContain('월~금 09:00~19:00')
    })
  })

  /*
    **휴무는 자기 줄을 갖는다 — #537 의 "같은 줄에 이어 붙인다" 를 #598 이 뒤집은 것이다.**

    375 실측에서 운영시간 117줄 중 75줄(64%)이 잘렸고 **잘린 75줄이 전부 휴무를 달고
    있었다.** 시설 상세도 없어(#148) 되찾을 길이 없다. 오늘 한 줄이 되어도 휴무는
    **다음 방문의 사실**이라 오늘 줄에 섞이지 않는다.
  */
  it('휴무가 운영시간과 다른 줄에 있다 — 잘려서 사라지지 않는다', () => {
    const markup = row({
      open24: false,
      openNow: true,
      operatingHours: LONG,
      restDate: '매주 수요일',
    })
    const hoursLine = markup.slice(markup.indexOf(LONG))

    // 운영시간 줄이 끝난 **뒤**에 온다
    expect(hoursLine.slice(0, hoursLine.indexOf('</p>'))).not.toContain('매주 수요일')
    expect(markup).toContain(`매주 수요일 ${messages.emergency.restPrefix}`)
  })

  /* 잘리는 상한은 운영시간 원문에만 건다 — 휴무 줄은 짧아 감을 이유가 없다 */
  it('휴무 줄에는 line-clamp 를 걸지 않는다', () => {
    const markup = row({
      open24: false,
      openNow: true,
      operatingHours: LONG,
      restDate: '매주 수요일',
    })
    const restStart = markup.indexOf('매주 수요일')
    const restLine = markup.slice(markup.lastIndexOf('<p', restStart), restStart)

    expect(restLine).not.toContain('line-clamp')
  })

  /* 원문이 없는 곳은 "닫힘" 과 구분된다 */
  it('시간표가 없으면 없다고 말한다', () => {
    const markup = row({ operatingHours: null, operatingHoursKnown: false })

    expect(markup).toContain(messages.emergency.hoursUnknown)
  })
})

/*
  **#603 — 머리 한 줄에 `이름 [유형] [24시간] [상태]` 가 전부 왼쪽으로 붙는다.**

  #598 은 이 줄을 `이름 [유형] ···(공백)··· [상태]` 로 갈라 두 기둥으로 읽게 했는데, 그
  전제는 **제목 줄이 219px 밖에 안 될 때**의 것이었다 — 버튼 칸이 같은 층에서 폭을 먹고
  있었다. 버튼이 아래 층으로 내려가 머리가 전폭 343px 을 쓰는 지금은 넷이 한 덩어리로
  들어가고, 공백을 밀어 넣으면 상태 배지만 본문 열 바깥에 혼자 뜬다.
*/
describe('FacilityRowHeader — 머리 한 줄 (#603)', () => {
  function content(overrides: Parameters<typeof facility>[0] = {}) {
    return renderToStaticMarkup(
      createElement(FacilityRowContent, { facility: facility(overrides), showDistance: true }),
    )
  }

  /** 머리는 본문 첫 `<p>` 앞까지다 — 진료시간 줄이 본문의 시작이다 */
  function header(markup: string) {
    return markup.slice(0, markup.indexOf('<p '))
  }

  /*
    이름과 상태가 **같은 flex 행**에 있어야 한다. 둘이 갈리면 상태가 자기 줄로 되돌아간
    것이라, 그때 색 결정(아래)의 근거도 함께 사라진다.
  */
  it('이름과 배지가 한 줄에 있다 — 유형·24시간·상태까지', () => {
    const row = header(
      renderToStaticMarkup(
        createElement(FacilityRowContent, {
          facility: pharmacy({ open24: true }),
          showDistance: true,
        }),
      ),
    )

    expect(row).toContain('한라동물약국')
    expect(row).toContain('동물약국')
    expect(row).toContain(messages.emergency.open24)
    expect(row).toContain(messages.emergency.statusClosed)
  })

  /*
    **공백으로 밀지 않는다.** `ml-auto` 가 살아 있으면 상태 배지가 다시 오른쪽 끝으로 가고,
    머리를 전폭으로 넓힌 이 변경의 결과가 화면에서 사라진다.
  */
  it('상태 배지를 오른쪽 끝으로 밀지 않는다', () => {
    expect(content()).not.toContain('ml-auto')
  })

  /*
    지도 패널에서는 이 줄이 `items-start` 인 세로 flex 안이라, `w-full` 이 없으면 내용
    너비로 오그라들어 목록 행과 머리 폭이 갈린다.
  */
  it('머리가 전폭이다 — 지도 패널의 세로 flex 안에서도', () => {
    expect(content()).toMatch(/<div class="flex w-full flex-wrap/)
  })

  /*
    **`items-center` 다** — #598 의 `items-start` 를 되돌린 것이다. 그때 근거는 "이름이 두
    줄로 감기면 배지가 가운데로 내려가 첫 줄과 어긋난다" 였는데, 그 일은 배지가 `shrink-0`
    으로 같은 줄에 붙박여 이름만 줄어들 때 생긴다. 지금은 배지가 `flex-wrap` 으로 아랫줄로
    비켜나므로 **배지와 같은 줄에 선 이름은 언제나 한 줄**이다.
  */
  it('세 요소를 같은 높이에 세운다 — items-center', () => {
    expect(content()).toMatch(/<div class="flex w-full flex-wrap items-center/)
  })

  /*
    **유형 배지가 `sm`(h-5, 20px) 이면 혼자 낮다.** 이름은 `text-title-2`(18/26)이고
    `Badge` 의 `md` 는 `text-caption`(12/18) + `py-1` 이라 정확히 26px 이다 — 셋을 같은
    26px 에 세우려면 유형 배지도 `md` 여야 한다. 배지가 나란히 설 때 크기를 맞추는 것은
    `place-row.tsx` 가 이미 쓰는 규칙이다.
  */
  it('유형 배지가 상태 배지와 같은 높이다 — sm 을 쓰지 않는다', () => {
    const row = header(
      renderToStaticMarkup(
        createElement(FacilityRowContent, { facility: pharmacy(), showDistance: true }),
      ),
    )

    expect(row).toContain('동물약국')
    expect(row).not.toContain('h-5')
  })

  /*
    **유형 배지는 약국에만 붙인다.** 목록 대부분이 병원이라 전부 붙이면 신호가 죽는다.
    이름에 `동물병원` 이 들어가는 시설이 많아(`제주24시동물병원`) 문자열만으로는 가려낼 수
    없어, **배지의 텍스트 노드**(`>동물병원<`)로 본다.
  */
  it('유형 배지는 약국에만 붙는다', () => {
    expect(content()).not.toContain('>동물병원<')
    expect(
      renderToStaticMarkup(
        createElement(FacilityRowContent, { facility: pharmacy(), showDistance: true }),
      ),
    ).toContain('>동물약국<')
  })

  /*
    배지가 줄어들면 글자가 반으로 접힌다. 좁은 줄에서 줄어드는 쪽은 이름이어야 하고,
    이름은 `break-keep` 으로 **어절 단위**로 감는다 (DESIGN.md §3-3).
  */
  it('배지는 줄어들지 않고 이름만 줄어든다', () => {
    const row = header(content())
    const badge = row.slice(row.indexOf(messages.emergency.statusOpen))

    expect(row).toContain('break-keep')
    expect(
      row.slice(row.lastIndexOf('<span', row.indexOf(messages.emergency.statusOpen))),
    ).toContain('shrink-0')
    expect(badge).not.toContain('ml-auto')
  })

  /*
    **색이 아니라 무게로 가르던 규칙 "위에" 색을 얹은 것이다** (`OpenStatus` 머리주석).
    이름 옆에 회색 배지 둘(`동물약국` · `24시간`)과 나란히 서면 모양으로는 구별되지 않는다.
  */
  it('진료중은 status-open, 영업 종료는 status-closed 톤이다', () => {
    expect(content({ openNow: true })).toContain('bg-status-open-100')
    expect(content({ openNow: false })).toContain('bg-status-closed-100')
  })

  /*
    **등급 토큰도 장애 토큰도 빌리지 않는다** (DESIGN.md §2-9). 값이 같아도 이름을
    분리하는 자리라, 이 단언이 깨지면 토큰의 뜻이 화면마다 갈리기 시작한 것이다 —
    `metric-high` 초록은 홈의 `여행 적합` 과 픽셀 단위로 같고, `danger` 는 5xx 전용이다.
  */
  it('등급·장애 토큰을 빌려 쓰지 않는다', () => {
    for (const openNow of [true, false]) {
      const markup = content({ openNow })

      expect(markup).not.toContain('metric-')
      expect(markup).not.toContain('danger-')
    }
  })

  /*
    **색이 유일한 채널이면 안 된다.** 두 tint 의 명도 대비가 1.02:1 이라 적록색약에게는
    밝기가 같다 — 진료중만 무게를 올려 두 번째 채널을 남긴다.

    배지 태그를 **여는 `<` 까지 되짚어** 잘라낸다. 고정 길이로 되짚으면 앞 배지(`24시간`)의
    태그까지 먹어 엉뚱한 클래스를 보게 된다.
  */
  it('진료중은 무게를 함께 올린다 — 영업 종료는 기본 무게다', () => {
    function statusTag(markup: string, tone: string) {
      const at = markup.indexOf(tone)
      const open = markup.lastIndexOf('<', at)

      return markup.slice(open, markup.indexOf('>', at))
    }

    expect(statusTag(content({ openNow: true }), 'bg-status-open-100')).toContain('font-semibold')
    expect(statusTag(content({ openNow: false }), 'bg-status-closed-100')).not.toContain(
      'font-semibold',
    )
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
})

/*
  **#603 — 행이 2단이 아니라 2층이다.**

  예전에는 `[내용 | 버튼]` 한 층이라 버튼 칸이 제목 줄의 폭까지 먹었다 (375 에서 제목 줄
  219px). 이제 머리가 전폭을 쓰고 그 **아래 층**만 `[시간·주소 | 버튼 둘]` 로 갈린다.
*/
describe('FacilityRow — 2층 배치 (#603)', () => {
  function row(overrides: Parameters<typeof facility>[0] = {}) {
    return renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility(overrides), showDistance: true }),
    )
  }

  /** 버튼이 든 아래 층 — 머리 다음에 오는 좌우 2단 */
  function actionLayer(markup: string) {
    return markup.slice(markup.indexOf('<div class="flex items-center gap-3">'))
  }

  /*
    **이름이 버튼 층에 없어야 한다.** 있으면 머리가 여전히 버튼과 같은 줄이라는 뜻이고,
    제목 줄이 버튼 폭만큼 좁아진다 — 이 변경이 되돌려진 상태다.
  */
  it('버튼 층에 이름이 없다 — 머리가 그 위에서 전폭을 쓴다', () => {
    const layer = actionLayer(row())

    // 이름은 `aria-label` 로도 들어가므로 **제목 스타일**이 있는지로 본다
    expect(layer).toContain('href="tel:')
    expect(layer).not.toContain('text-title-2')
  })

  /* 진료시간·주소는 버튼과 같은 층의 왼쪽이다 */
  it('시간과 주소가 버튼과 같은 층의 왼쪽이다', () => {
    const layer = actionLayer(row())

    expect(layer).toContain('월~금 09:00~19:00, 토 09:00~13:00')
    expect(layer).toContain('제주특별자치도 제주시 연북로 100')
  })

  /*
    **40px 이다** — 버튼이 제목 줄과 같은 층일 때는 행 높이를 버튼이 정해 52px 이 기준
    노릇을 했는데, 아래 층으로 내려오면서 행 높이는 글자 덩어리가 정한다. DESIGN.md 의
    모바일 최소 터치 영역 44×44 를 **의도적으로 밑도는** 값이다 (`CallButton` 머리주석).
  */
  it('버튼 둘 다 40px 이다', () => {
    const markup = row()

    expect(markup).not.toContain('size-13')
    expect(markup.match(/size-10/g)?.length).toBe(2)
  })

  /* 골격도 같은 2층이어야 데이터가 오는 순간 행이 튀지 않는다 (#443) */
  it('머리가 버튼 층보다 앞에 온다', () => {
    const markup = row()

    expect(markup.indexOf('제주24시동물병원')).toBeLessThan(markup.indexOf('href="tel:'))
  })
})
