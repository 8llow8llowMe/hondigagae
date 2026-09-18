import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PlaceCongestionPanel,
  type PlaceCongestionPanelProps,
} from '@/features/place/place-congestion-panel'
import { CONGESTION_DAYS, CONGESTION_DEFAULT_DAYS } from '@/lib/insight/congestion'
import { messages } from '@/lib/messages'
import { congestion, congestionAllUnknown } from '@/test/fixtures/insight'

function render(overrides: Partial<PlaceCongestionPanelProps> = {}) {
  const props: PlaceCongestionPanelProps = {
    data: congestion,
    loading: false,
    failed: false,
    onRetry: () => undefined,
    // 화면의 기본값과 같다 — 기본이 7일이던 시절의 습관으로 두면 테스트만 다른 화면을 본다
    days: CONGESTION_DEFAULT_DAYS,
    onDaysChange: () => undefined,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PlaceCongestionPanel, props))
}

/*
  이 카드의 배지와 장소 상세 이름 옆 배지가 390 실측에서 문구·폭·색까지 같았다 — 같은
  화면에 선 `보통` 둘이 다른 축이었다 (#652 · 진단 D-2).
*/
describe('PlaceCongestionPanel — 배지가 축을 밝힌다 (#652)', () => {
  it('추천일 배지가 혼잡도 축임을 말한다', () => {
    const markup = render()
    const axis = messages.common.metricAxisCongestion

    /*
      **추천일 줄로 범위를 좁힌다.** 마크업 전체에 걸면 아래 막대 목록의 `sr-only` 가
      같은 낱말을 내는 날 통과해 버린다 — 지금은 안 내지만 그때 이 단언이 조용히
      공허해진다 (testing-guide.md §5).
    */
    const leastRow = markup.slice(
      markup.indexOf(messages.place.detailCongestionLeastLabel),
      markup.indexOf('<ol'),
    )

    expect(leastRow).toContain(`>${axis} </span>`)
    expect(leastRow).toContain(`</span>${congestion.leastCrowded?.level.name}</span>`)
  })

  /* 축은 혼잡도 하나다 — 적합도 라벨이 이 카드에 새어 들어오면 축이 다시 섞인다 */
  it('이 카드에 적합도 라벨이 새어 들어오지 않는다', () => {
    expect(render()).not.toContain(`>${messages.common.metricAxisSuitability} </span>`)
  })

  /*
    막대가 글자로 말하는 것은 그대로다 — 축 라벨은 배지에만 붙는다.

    **`not.toContain('sr-only">혼잡도')` 로 재지 않는다.** `sr-only` 의 첫 텍스트는 언제나
    날짜라 그 단언은 구조상 참일 수밖에 없다(뮤테이션으로 확인: 막대의 `level.name` 을
    바꿔도 통과했다). 실제 문구를 통째로 잰다.
  */
  it('막대의 sr-only 문구를 바꾸지 않는다', () => {
    const markup = render()

    expect(markup).toContain('9월 4일 금요일 정보 없음')
    expect(markup).not.toContain(`정보 없음${messages.common.metricAxisCongestion}`)
  })
})

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
    /*
      **`21.4` 로 재면 안 된다** (#651). 집중률 표시가 정수로 가면서 그 문자열은 이제
      막대의 `style="height:21.4%"` 로만 남는다 — 집중률 줄이 통째로 사라져도 통과한다.
      화면이 읽는 값은 정수다.
    */
    expect(markup).toContain(`${messages.place.detailCongestionRateLabel} 21`)
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

/**
 * 자료가 하나도 없을 때 차트를 덮는다 (#670).
 *
 * 빈 상태 처리는 예전에도 있었는데 **차트가 함께 그려졌다** — 기본이 30일이라 점선 트랙
 * 30칸이 카드를 채우고 설명은 그 아래 12px 로 붙어 먼저 읽히는 것이 "깨진 그래프" 였다.
 */
describe('PlaceCongestionPanel — 자료가 없을 때 차트를 덮는다 (#670)', () => {
  /** veil 은 이 갈래에서 `absolute inset-0` 을 내는 유일한 요소다 */
  const VEIL_MARKER = 'absolute inset-0'

  /**
   * veil 을 경계로 마크업을 가른다.
   *
   * **매치 실패를 삼키지 않는다** — veil 이 사라지면 `inside` 가 빈 문자열이 되어 그 위에
   * 쌓은 `not.toContain` 이 전부 공허하게 통과한다 (testing-guide.md §5).
   */
  const split = (markup: string) => {
    const at = markup.indexOf(VEIL_MARKER)

    expect(at).toBeGreaterThan(-1)
    return { before: markup.slice(0, at), inside: markup.slice(at) }
  }

  const empty = () => render({ data: congestionAllUnknown })

  /*
    **지우지 않는다.** 남은 칸 수·트랙 높이·날짜 축이 "여기는 날짜별 붐빔을 보는 자리" 라고
    말해 주고, 그래야 문구의 "자료가 아직 없어요" 가 무엇의 자료인지 붙는다.
  */
  it('차트를 지우지 않고 그대로 그린다', () => {
    const markup = empty()

    expect(markup).toContain('border-metric-unknown-500')
    // fixture 는 7일이다 — 칸을 갈래마다 줄이면 스켈레톤(30칸)에서 카드가 출렁인다
    expect(markup.match(/<li /g)).toHaveLength(7)
  })

  it('문구가 차트 아래가 아니라 veil 안에 있다', () => {
    const { before, inside } = split(empty())

    expect(inside).toContain(messages.place.detailCongestionEmptyTitle)
    expect(inside).toContain(messages.place.detailCongestionEmptyDescription)
    // veil 보다 앞(= 덮이는 차트 쪽)에는 문구가 없다
    expect(before).not.toContain(messages.place.detailCongestionEmptyTitle)
    expect(before).not.toContain(messages.place.detailCongestionEmptyDescription)
    // 덮이는 대상이 실제로 veil 앞에 있다
    expect(before).toContain('border-metric-unknown-500')
  })

  /* 문구 키를 새로 만들지도, 아래 블록을 남겨 두지도 않았다 — 같은 말을 두 번 하지 않는다 */
  it('같은 문구를 두 번 내지 않는다', () => {
    const markup = empty()

    expect(markup.split(messages.place.detailCongestionEmptyTitle)).toHaveLength(2)
    expect(markup.split(messages.place.detailCongestionEmptyDescription)).toHaveLength(2)
  })

  /*
    이 갈래는 점선의 **뜻**이 아니라 **이 장소에 자료가 없다**는 사실을 말한다. 둘을 같이
    내면 veil 위아래로 비슷한 말이 겹친다.
  */
  it('점선 설명을 겹쳐 내지 않는다', () => {
    expect(empty()).not.toContain(messages.place.detailCongestionUnknownNote)
  })

  /*
    **덮인 차트는 `aria-hidden` 이다.** 전부 `UNKNOWN` 인 날을 그대로 두면 보조기기가
    `9월 4일 금요일 정보 없음` 을 칸 수만큼 읽는다 — 눈으로는 한 덩어리로 지나가는 것이
    보조기기에서만 여러 줄이 된다. 문구는 veil 밖(=`aria-hidden` 밖)이라 그대로 읽힌다.
  */
  it('덮인 차트에만 aria-hidden 을 건다', () => {
    const { before, inside } = split(empty())

    expect(before).toContain('aria-hidden')
    expect(inside).not.toContain('aria-hidden')
    // 갱신이 아니라 진입 시점의 정적 콘텐츠다
    expect(inside).not.toContain('role="status"')
  })

  /*
    **`aria-hidden` 안에 초점 받는 것을 남기지 않는다** (`aria-hidden-focus`).

    화살표(`ScrollRailArrows`)는 스크롤 여지를 **잰 뒤에만** 그리므로 서버 렌더에서는 정상
    갈래에서도 나오지 않는다 — 라벨 부재로 재면 언제나 참인 공허한 단언이 된다. 대신 화살표와
    키보드 초점을 만들어 내는 **수단**을 잰다: 이 갈래에는 스크롤 컨테이너 자체가 없다.
  */
  it('덮인 차트를 구르지 않게 한다 — 스크롤 컨테이너도 레일도 없다', () => {
    const markup = empty()

    expect(markup).not.toContain('overflow-x-auto')
    expect(markup).not.toContain('scroll-rail')
  })

  /*
    404 가 아니라 빈 상태다. **누를 것이 생기는 순간 사용자는 이것을 고칠 수 있는 오류로
    읽는다** — veil 안에 재시도·버튼·링크를 하나도 두지 않는다.
  */
  it('빈 상태에 누를 것을 하나도 두지 않는다', () => {
    const markup = empty()

    expect(markup).not.toContain('<button')
    expect(markup).not.toContain('<a ')
    expect(markup).not.toContain(messages.common.retry)
    expect(markup).not.toContain(messages.place.detailCongestionErrorTitle)
    // 30일도 같은 빈 답이라 펼치기를 내밀지 않는다 (기존 결정 유지)
    expect(markup).not.toContain(messages.place.detailCongestionExpand)
    expect(markup).not.toContain(messages.place.detailCongestionCollapse)
  })

  /*
    **경계는 `hasUnknown` 이 아니라 `leastCrowded === null` 이다.** 아는 날이 하루라도 있으면
    그 날이 답이고, 답이 있는 카드를 덮으면 서비스가 할 말을 스스로 가린다.
  */
  it('일부만 모르는 날이면 veil 이 서지 않는다', () => {
    const markup = render()

    expect(markup).not.toContain(VEIL_MARKER)
    expect(markup).not.toContain(messages.place.detailCongestionEmptyTitle)
    expect(markup).not.toContain(messages.place.detailCongestionEmptyDescription)
    // 기존 설명과 토글이 그대로다 — 카드가 살아 있다
    expect(markup).toContain(messages.place.detailCongestionUnknownNote)
    expect(markup).toContain(messages.place.detailCongestionCollapse)
  })

  /* 서버가 날짜 목록 자체를 비워 보내면 덮을 것이 없다 — 높이 0 짜리 veil 을 세우지 않는다 */
  it('덮을 차트가 없으면 veil 없이 문구만 세운다', () => {
    const markup = render({ data: { ...congestionAllUnknown, dailyCongestions: [] } })

    expect(markup).not.toContain(VEIL_MARKER)
    expect(markup).toContain(messages.place.detailCongestionEmptyTitle)
    expect(markup).toContain(messages.place.detailCongestionEmptyDescription)
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

  /*
    **기본이 30일이다** (#603). 7일은 좁히는 쪽 선택지로 남는다 — 이 카드의 값은 "언제
    갈까" 에 멀리까지 답하는 것이고, 폭으로 기본값을 가를 수 없는 이유는
    `CONGESTION_DEFAULT_DAYS` 주석에 있다.
  */
  it('기본은 30일이고 7일로 좁힐 수 있다', () => {
    expect(render()).toContain(messages.place.detailCongestionCollapse)
    expect(render({ days: CONGESTION_DAYS.week })).toContain(messages.place.detailCongestionExpand)
  })

  it('30일에서는 되돌리는 버튼과 예측 범위를 말한다', () => {
    const markup = render()

    expect(markup).toContain(messages.place.detailCongestionCollapse)
    expect(markup).toContain(messages.place.detailCongestionExtendedNote)
  })

  /*
    30일에만 구르는 레일이 된다 (#603) — 7일은 36px × 7칸 = 288px 라 구를 것이 없다.

    **화살표는 여기서 못 본다.** `ScrollRailArrows` 는 스크롤 여지를 **잰 뒤에만** 그린다
    (`useScrollRail` 의 `fade`), 서버 렌더에는 레이아웃이 없어 언제나 `none` 이다. 홈 곡선도
    같아서 `walk-times-section.test.ts` 가 화살표 대신 `scroll-rail` 을 센다. 실제로 뜨는지는
    `e2e/place-congestion.spec.ts` 가 본다.
  */
  it('30일에만 구르는 레일이 된다 — 스크롤바는 숨기고 페이드·화살표에 맡긴다', () => {
    const markup = render()

    expect(markup).toContain('scrollbar-none')
    expect(markup).toContain('overflow-x-auto')
    expect(render({ days: CONGESTION_DAYS.week })).not.toContain('overflow-x-auto')
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
    expect(render()).toContain('scroll-rail')
    expect(render({ days: CONGESTION_DAYS.week })).not.toContain('scroll-rail')
  })
})

describe('PlaceCongestionPanel — 막대 색 (#603)', () => {
  /*
    **색은 "이 날이 답" 하나만 말한다.** 등급으로 칠하지 않는 이유는 막대 높이가 이미
    집중률이고 서버 등급도 그 집중률에서 갈리기 때문이다 — 색으로 등급을 그리면 같은
    변수를 두 번 그리게 되고, 실제로 30일을 펼치면 한 등급에 몰려 한 덩어리로 깔렸다.

    fixture 의 `leastCrowded` 는 `2026-09-05`(21.4) 하루다.
  */
  it('서버가 고른 날만 진한 파랑이고 나머지는 연한 파랑이다', () => {
    const markup = render()

    expect(markup.match(/bg-congestion-best/g)).toHaveLength(1)
    // 7일 중 `UNKNOWN` 하루는 막대 자체가 없고(점선 트랙), 고른 하루는 위에서 셌다
    expect(markup.match(/bg-congestion-bar/g)).toHaveLength(5)
  })

  /*
    **등급 색을 쓰지 않는다.** 붐비는 날은 위험한 날이 아니라 사람 많은 날이라
    `--metric-critical-*`(산책 위험 전용)이 맞지 않는다 — DESIGN.md §2-3 의 "`LOW` 에
    danger 를 쓰지 않는다" 와 같은 규칙이다.
  */
  it('막대에 등급 색을 쓰지 않는다', () => {
    const markup = render()

    for (const tone of ['critical', 'high', 'mid', 'low']) {
      expect(markup).not.toContain(`bg-metric-${tone}-500`)
    }
  })

  /*
    **선택 표시가 둘이면 어느 쪽이 답인지 흐려진다.** 진한 파랑이 그 역할을 가져가면서
    트랙의 `--brand-500` 테두리와 날짜의 `--brand-700` 을 걷었다.
  */
  it('예전 선택 표시(브랜드 테두리·초록 날짜)를 남기지 않는다', () => {
    const markup = render()

    expect(markup).not.toContain('outline-brand-500')
    expect(markup).not.toContain('text-brand-700')
  })

  /*
    이 카드에서 실제로 비교를 해 주는 것은 막대 **높이**인데 높이는 스크린리더에 아무것도
    전하지 못한다. 등급 이름만 읽으면 같은 `혼잡` 안의 68 과 92 가 한 낱말로 뭉개진다.
  */
  it('보조기기에 등급 이름과 집중률을 함께 읽어 준다', () => {
    const markup = render()

    // 눈으로 보는 값과 갈리지 않게 **정수**로 읽는다 (#651) — 71.8 → 72
    expect(markup).toContain(`${messages.place.detailCongestionRateLabel} 72`)
  })
})

/**
 * 집중률 표현 (#651 · 진단 D-3).
 *
 * `57.77` 은 높은 값인지 낮은 값인지 화면에 비교 기준이 없었다.
 *
 * **계산 규칙은 여기서 재지 않는다.** 반올림 순서 · `UNKNOWN` 제외 · 비교 생략은
 * `lib/insight/congestion.test.ts` 가 분기별로 잰다. 여기서 같은 것을 다시 재려 하면
 * 픽스처가 두 구현에서 같은 값을 내 **항진식이 되기 쉽다** — 실제로 이 픽스처는 반올림
 * 순서를 뒤집어도 `24` 로 같다. 이 파일은 **화면에 나오는 모양**만 본다.
 */
describe('PlaceCongestionPanel — 집중률 표현 (#651)', () => {
  /** 픽스처 7일: 71.8 · 37.2 · 28.6 · null · 21.4 · 44.9 · 68.3 → 아는 날 6일, 평균 45 */
  /**
   * 집중률 줄만 떼어 낸다.
   *
   * **매치 실패를 `''` 로 삼키지 않는다** — 그 위에 쌓은 `not.toContain` 이 전부 공허하게
   * 통과한다. 줄이 사라지는 것 자체가 회귀다.
   */
  const rateLine = (markup: string) => {
    const line = markup.match(new RegExp(`${messages.place.detailCongestionRateLabel}[^<]*`))?.[0]

    expect(line).toBeDefined()
    return line!
  }

  it('집중률에 소수점이 없다', () => {
    const markup = render()

    expect(markup).not.toMatch(new RegExp(`${messages.place.detailCongestionRateLabel} \\d+\\.\\d`))
  })

  it('평균과 차이를 함께 말한다', () => {
    const line = rateLine(render())

    // leastCrowded 21.4 → 21, 평균 45 → 24 낮다
    expect(line).toContain('21')
    expect(line).toContain('45')
    expect(line).toContain('24')
  })

  /* 아는 날이 하나뿐이면 "평균보다 0 낮아요" 가 된다 — 비교 문구를 붙이지 않는다 */
  it('비교할 것이 없으면 숫자만 낸다', () => {
    const onlyOne = {
      ...congestion,
      dailyCongestions: [
        congestion.dailyCongestions[4]!,
        { ...congestion.dailyCongestions[0]!, concentrationRate: null },
      ],
    }
    const line = rateLine(render({ data: onlyOne }))

    expect(line).toContain('21')
    expect(line).not.toContain('평균')
  })

  /** 집중률은 단위가 없는 0~100 지표다 */
  it('% 를 붙이지 않는다', () => {
    expect(rateLine(render())).not.toContain('%')
  })
})
