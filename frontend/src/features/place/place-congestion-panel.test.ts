import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PlaceCongestionPanel,
  type PlaceCongestionPanelProps,
} from '@/features/place/place-congestion-panel'
import { CONGESTION_DAYS } from '@/lib/insight/congestion'
import { messages } from '@/lib/messages'
import { congestion, congestionAllUnknown } from '@/test/fixtures/insight'

function render(overrides: Partial<PlaceCongestionPanelProps> = {}) {
  const props: PlaceCongestionPanelProps = {
    data: congestion,
    loading: false,
    failed: false,
    onRetry: () => undefined,
    days: CONGESTION_DAYS.default,
    onDaysChange: () => undefined,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PlaceCongestionPanel, props))
}

describe('PlaceCongestionPanel — 상태 배타성', () => {
  /* 제목은 어느 상태에서나 선다 — 카드가 통째로 사라지면 자리가 흔들린다 */
  it('조회 중에도 제목은 두고 본문만 스켈레톤이다', () => {
    const markup = render({ data: null, loading: true })

    expect(markup).toContain(messages.place.detailCongestionTitle)
    expect(markup).not.toContain(messages.place.detailCongestionLeastLabel)
    expect(markup).not.toContain(messages.place.detailCongestionErrorTitle)
  })

  /*
    **이 카드만 덮는다.** 판정 둘과 기본 정보는 그대로 쓸모가 있다 — 적합도 패널이 화면
    전체를 에러로 덮지 않는 것과 같은 판단이다.
  */
  it('조회가 실패하면 그 자리에서 재시도를 준다', () => {
    const markup = render({ data: null, failed: true })

    expect(markup).toContain(messages.place.detailCongestionErrorTitle)
    expect(markup).toContain(messages.common.retry)
  })
})

describe('PlaceCongestionPanel — 서버가 고른 날', () => {
  /*
    규칙(`UNKNOWN` 제외 최저 집중률, 동률이면 이른 날짜)은 BE `CongestionSnapshot` 한
    곳이다. FE 가 다시 고르면 같은 기간에 다른 날을 추천하게 된다 — fixture 의 최저는
    `2026-09-05`(21.4)이고 화면이 그 날을 그대로 말해야 한다.
  */
  it('leastCrowded 의 날짜를 그대로 쓴다', () => {
    const markup = render()

    expect(markup).toContain(messages.place.detailCongestionLeastLabel)
    expect(markup).toContain('9월 5일 (토)')
    expect(markup).toContain('21.4')
  })

  /* 등급 문구는 서버 `name` 이다. FE 가 한국어 매핑 테이블을 만들지 않는다 */
  it('등급은 서버 name 을 그대로 쓴다', () => {
    expect(render()).toContain('한산')
  })

  /*
    **`null` 이면 자리를 만들지 않는다.** 아는 날이 하나도 없다는 뜻이라, 비워 둔 자리는
    "한산한 날이 없다" 로 읽힌다. 대신 자료가 없다는 사실을 말한다.
  */
  it('leastCrowded 가 null 이면 그 줄 대신 빈 상태를 말한다', () => {
    const markup = render({ data: congestionAllUnknown })

    expect(markup).not.toContain(messages.place.detailCongestionLeastLabel)
    expect(markup).toContain(messages.place.detailCongestionEmptyTitle)
  })

  /* 404 가 아니라 빈 상태다 — 장소는 있고 연결된 통계가 없다. 재시도할 것이 없다 */
  it('빈 상태에 재시도를 달지 않는다', () => {
    const markup = render({ data: congestionAllUnknown })

    expect(markup).not.toContain(messages.common.retry)
  })

  /* 전부 모르는 날이면 펼칠 이유가 없다 — 30일도 같은 빈 답이다 */
  it('빈 상태에는 펼치기를 두지 않는다', () => {
    expect(render({ data: congestionAllUnknown })).not.toContain(
      messages.place.detailCongestionExpand,
    )
  })
})

describe('PlaceCongestionPanel — UNKNOWN 날짜', () => {
  /*
    **걸러내지 않는다.** 빠뜨리면 날짜 축에 구멍이 생겨 그 날이 "한산한 날" 로 읽힌다 —
    서버가 데이터 없는 날짜를 목록에 남겨 보내는 이유와 같다. fixture 의 `2026-09-04` 는
    가운데에 있다.
  */
  it('모르는 날도 자리를 지킨다', () => {
    const markup = render()

    // 기간이 7일이면 막대도 7개다 — 모르는 날을 빼면 6개가 된다
    expect(markup.match(/<li /g)).toHaveLength(7)
    // 등급 이름은 서버 `name` 그대로다. 색·높이는 스크린리더에 아무 말도 하지 못한다
    expect(markup).toContain('9월 4일 금요일 정보 없음')
  })

  /*
    **`--metric-unknown-500` 점선 전용 토큰이 쓰이는 자리다.** 빈칸도 짧은 막대도 둘 다
    "한산하다" 로 읽힌다 — 트랙 전체를 점선으로 두고 막대를 그리지 않는다.
  */
  it('모르는 날은 점선 트랙이고 막대를 그리지 않는다', () => {
    const markup = render()

    expect(markup).toContain('border-metric-unknown-500')
    expect(markup).toContain(messages.place.detailCongestionUnknownNote)
  })

  /* 모르는 날이 없으면 점선의 뜻을 설명할 이유도 없다 */
  it('모르는 날이 없으면 점선 설명을 내지 않는다', () => {
    const allKnown = {
      ...congestion,
      dailyCongestions: congestion.dailyCongestions.filter(
        (item) => item.concentrationRate !== null,
      ),
    }

    expect(render({ data: allKnown })).not.toContain(messages.place.detailCongestionUnknownNote)
  })
})

describe('PlaceCongestionPanel — 기간', () => {
  /* 기간 표기는 응답의 `fromDate` · `toDate` 다. FE 가 `days` 로 계산하지 않는다 */
  it('카드 머리에 서버가 준 기간을 적는다', () => {
    expect(render()).toContain('9.1 – 9.7')
  })

  it('기본은 7일이고 30일로 펼칠 수 있다', () => {
    expect(render()).toContain(messages.place.detailCongestionExpand)
  })

  it('펼친 상태에서는 되돌리는 버튼과 예측 범위를 말한다', () => {
    const markup = render({ days: CONGESTION_DAYS.extended })

    expect(markup).toContain(messages.place.detailCongestionCollapse)
    expect(markup).toContain(messages.place.detailCongestionExtendedNote)
  })

  /*
    **`scroll-rail` 은 장식이 아니라 가로 넘침의 유일한 방어막이다** (#603).

    날짜 칸마다 붙는 `sr-only` 라벨은 `position: absolute` 다. 스크롤러가 `position: static`
    이면 그 30개의 컨테이닝 블록이 스크롤러가 아니라 **바깥의 positioned 조상**이 된다 —
    스크롤러가 자기 내용을 클립하고 있어도 저것들은 클립되지 않고, 정적 위치가 조상의
    `scrollWidth` 로 그대로 샌다.

    실측(`/places/126434` 30일 보기): 1440 에서 좌측 판정 레일이 가로로 770px 스크롤됐고
    (`scrollWidth` 1164 / `clientWidth` 394), 390 에서는 페이지가 통째로 넘쳤다
    (`documentElement.scrollWidth` 390 → 1135). DESIGN.md §7 이 버그로 못박은 그 증상이다.

    `.scroll-rail` 이 `position: relative` 로 기준면을 되돌리고 `contain: layout` 으로 남은
    전파를 끊는다 — 홈 곡선에서 같은 것을 겪고 `app/globals.css` 에 적어 둔 처방이다.

    **문자열 assertion 은 클래스가 붙었는지까지만 잠근다.** 실제 넘침은
    `e2e/place-congestion.spec.ts` 가 잰다.
  */
  it('30일 레일에만 scroll-rail 을 준다 — sr-only 라벨이 조상으로 새지 않게', () => {
    expect(render({ days: CONGESTION_DAYS.extended })).toContain('scroll-rail')
    expect(render()).not.toContain('scroll-rail')
  })
})
