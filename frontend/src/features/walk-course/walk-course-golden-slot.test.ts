import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { WalkCourseGoldenSlot } from '@/features/walk-course/walk-course-golden-slot'
import { mockWalkTimes } from '@/lib/api/mock/insight-data'
import { messages } from '@/lib/messages'
import type { WalkTimesResponse } from '@/types/insight'

/**
 * **좌표가 없는 코스에 골든타임 *동선*을 만들지 않는다** — 그 규칙은 그대로다
 * (공통명세 S4-2 · `WalkCourseItem.java:10-12`): 요청도 안 나가고 곡선도 없다.
 *
 * **바뀐 것은 자리와 제목이다** ([#730](https://github.com/8llow8llowMe/hondigagae/issues/730)).
 * 실측 29개 중 **25개가 이 갈래**라 섹션을 통째로 걷는 것이 화면의 **기본형**을 절반 빈
 * 화면으로 만들었다. 지금은 카드와 제목을 좌표 있는 갈래와 같은 뼈대로 두고 안내 상자를 넣는다.
 *
 * **골든타임 fixture 를 새로 만들지 않는다** — 홈과 다른 곡선이 나오면 어느 쪽이 맞는지
 * 볼 수 없다 (`코스상세-세부명세.md` D7). `mockWalkTimes` 를 그대로 쓴다.
 */
const WALK_TIMES = mockWalkTimes(null)

/**
 * **기본은 반려견이 있는 사용자다** (#777). 이 파일의 기존 단언은 전부 *카드 자체*를 보는
 * 것이라, 등록 안내가 기본으로 붙으면 그 단언들이 안내까지 함께 보게 된다. 안내 갈래는
 * 아래 전용 describe 가 명시적으로 연다.
 */
function render(
  course: { lat: number | null; lng: number | null },
  walkTimes: WalkTimesResponse | null = WALK_TIMES,
  loading = false,
  guest: { authed: boolean; petRegistered: boolean } = { authed: true, petRegistered: true },
): string {
  return renderToStaticMarkup(
    createElement(WalkCourseGoldenSlot, {
      course,
      walkTimes,
      loading,
      onRetry: vi.fn(),
      ...guest,
    }),
  )
}

/**
 * `bg-band` 상자가 **닫히는** 위치. `<div` 깊이를 세어 찾는다.
 *
 * 문자열 탐색으로 "상자 안에 있나" 를 물으면 상자 뒤 마크업까지 같이 걸려 **없는
 * 포함관계를 있다고 답한다** — 실제로 그렇게 쓴 첫 판이 구현을 고치기 전에도 통과했다.
 * 이 저장소는 jsdom 없이 문자열을 단언하므로(`testing-guide.md`) 깊이는 직접 센다.
 */
function bandBoxEnd(markup: string) {
  // 먼저 상자 자체를 단언한다 — 없으면 아래 `lastIndexOf(…, -1)` 로 흘러가 원인이 가려진다
  expect(markup).toContain('bg-band')

  const open = markup.lastIndexOf('<div', markup.indexOf('bg-band'))
  expect(open).toBeGreaterThan(-1)

  let depth = 0
  for (let at = open; at < markup.length; at += 1) {
    if (markup.startsWith('<div', at)) depth += 1
    else if (markup.startsWith('</div>', at)) {
      depth -= 1
      if (depth === 0) return at
    }
  }

  throw new Error('bg-band 상자가 닫히지 않았다')
}

describe('WalkCourseGoldenSlot — 좌표가 없어도 자리와 제목은 남는다 (#730)', () => {
  const NO_COORDS = { lat: null, lng: null }

  /**
   * **두 갈래의 뼈대가 같아야 한다.** 제목이 갈리면 같은 자리가 코스마다 다른 섹션으로
   * 읽힌다 — 25/29 가 이 갈래라 사용자가 보는 화면은 대부분 이쪽이다.
   */
  it('좌표 있는 갈래와 같은 제목을 쓴다', () => {
    expect(render(NO_COORDS)).toContain(messages.home.goldenHeading)
  })

  /** 한쪽만 보는 실수를 잡는다 — `hasCoordinates` 는 둘 다 있어야 참이다 */
  it('lat 만 null 이어도 안내 갈래다', () => {
    const markup = render({ lat: null, lng: 126.9 })

    expect(markup).toContain(messages.home.goldenHeading)
    expect(markup).toContain(messages.walkCourse.noCoordinates)
  })

  it('lng 만 null 이어도 안내 갈래다', () => {
    const markup = render({ lat: 33.4, lng: null })

    expect(markup).toContain(messages.home.goldenHeading)
    expect(markup).toContain(messages.walkCourse.noCoordinates)
  })

  /**
   * **기다리면 채워질 것처럼 보이는 자리를 두지 않는다** — 이 규칙은 그대로다 (D5-2).
   * 자리를 남기는 것과 로딩인 척하는 것은 다르다.
   */
  it('스켈레톤은 세우지 않는다 — 로딩 중이어도 같다', () => {
    const markup = render(NO_COORDS, null, true)

    expect(markup).not.toContain('aria-busy')
    expect(markup).toContain(messages.walkCourse.noCoordinates)
  })

  /**
   * **상자는 사실 두 줄만 담는다** ([#780](https://github.com/8llow8llowMe/hondigagae/issues/780)).
   * ① 왜 없는지 ② 얼마나 흔한 일인지. 대안은 상자 밖 본문 흐름으로 나갔다.
   */
  it('안내 상자가 왜 · 얼마나 흔한지를 담는다', () => {
    const markup = render(NO_COORDS)

    expect(markup).toContain(messages.walkCourse.noCoordinates)
    expect(markup).toContain(messages.walkCourse.noCoordinatesCommon)
  })

  /**
   * #780. 375 실측에서 이 안내가 본문 806px 중 408px(51%)을 먹었다 — **29개 중 25개가
   * 보는 기본 갈래**인데 "없다는 안내" 가 화면의 주인공이었다. 상자를 사실 두 줄로 줄이고
   * 대안 하나를 밖으로 내보내 비중을 내린다.
   *
   * `bg-band` 상자가 대안 목록을 **더 이상 감싸지 않는다**는 것을 마크업 순서로 단언한다 —
   * 링크가 상자 여는 태그보다 뒤에 오더라도 상자 **닫힘 이후**여야 한다.
   */
  it('대안을 상자 밖으로 내보낸다 — 상자는 사실만 담는다', () => {
    const markup = render(NO_COORDS)
    const link = markup.indexOf('href="/places"')

    expect(link).toBeGreaterThan(-1)
    expect(link).toBeGreaterThan(bandBoxEnd(markup))
  })

  /**
   * **`일정에 담기` 를 여기서 두 번 말하지 않는다** (#780). 바로 아래에 그 버튼이 실물로
   * 있다 — 안내가 그것을 또 가리키면 같은 화면이 같은 말을 두 번 한다. 개정 전에는
   * "버튼을 하나 더 만들지 않는다" 까지만 지켰고 **말이 중복되는 것은 놓쳤다.**
   */
  it('일정에 담기를 안내에서 다시 말하지 않는다', () => {
    const markup = render(NO_COORDS)

    expect(markup).not.toContain(messages.plan.addToPlanAction)
  })

  /**
   * 상자가 **자기 면을 갖는다** — 카드 안 채움은 L2 의 채널이고(DESIGN.md §0) 곡률은
   * §5 의 tint 블록 값(8)이다. 셋이 한 요소에 같이 있어야 상자로 읽힌다.
   */
  it('안내 상자가 면과 곡률을 갖는다 — 카드 안 L2 채움', () => {
    const markup = render(NO_COORDS)
    const at = markup.indexOf('bg-band')

    // 매치 실패를 삼키지 않는다 (testing-guide.md §5)
    expect(at).toBeGreaterThan(-1)
    expect(markup.slice(at, markup.indexOf('>', at))).toContain('rounded-md')
  })

  /**
   * **남는 대안은 장소 찾기 하나다.** 새 API 를 만들지 않고 기존 경로를 쓴다.
   *
   * **검색어를 채우지 않는다** — 서버 `keyword` 는 `title`·`addr1` 의 `%LIKE%` 라
   * 시종점 원문에서 만든 토막은 대부분 0건이다. 결과 없음으로 데려가는 대안은 대안이 아니다.
   */
  it('대안 ① 이 /places 로 가고 검색어를 지어내지 않는다', () => {
    expect(render(NO_COORDS)).toContain('href="/places"')
  })

  /**
   * **안내가 버튼을 하나 더 만들지 않는다.** 같은 화면 아래 `일정에 담기` 와 같은
   * 이름의 컨트롤이 둘이면 보조기기에서 목적지가 둘로 들린다.
   */
  it('안내는 버튼을 더 만들지 않는다', () => {
    expect(render(NO_COORDS)).not.toContain('<button')
  })

  /** 오류가 아니라 이 코스의 사실이다 — 경고로 읽히면 진입마다 먼저 읽힌다 (D6) */
  it('좌표 없음 안내에 role="alert" 를 주지 않는다', () => {
    expect(render(NO_COORDS)).not.toContain('role="alert"')
  })

  it('기준 줄을 세우지 않는다 — 기준으로 삼을 시작점이 없다', () => {
    expect(render(NO_COORDS)).not.toContain(messages.home.goldenBasisCourseStart)
  })

  /** 곡선도 재조회도 없다 — 요청 자체가 나가지 않는 갈래다 (공통명세 S4-2) */
  it('곡선 레일도 날씨 재조회도 세우지 않는다', () => {
    const markup = render(NO_COORDS)

    expect(markup).not.toContain('scroll-rail')
    expect(markup).not.toContain(messages.walkCourse.goldenRetry)
  })
})

describe('WalkCourseGoldenSlot — 좌표가 있으면 골든타임을 세운다', () => {
  it('골든타임 섹션을 그린다', () => {
    expect(render({ lat: 33.4, lng: 126.9 })).toContain(messages.home.goldenHeading)
  })

  /** 코스 전체가 아니라 시작점 기준이라는 사실이다 (D8-5 · #779 에서 ② 로 개정) */
  it('시작점 기준이라는 것을 밝힌다', () => {
    expect(render({ lat: 33.4, lng: 126.9 })).toContain(messages.home.goldenBasisCourseStart)
  })

  /**
   * #779. **이 자리가 거짓을 말했다.** `positionFallback={false}` 가 "폴백이 아니다" 를
   * 뜻한다고 읽고 넘겼는데, 그 `false` 가 화면에 `현재 위치 기준` 을 내보냈다. 조회 좌표는
   * 사용자 위치가 아니라 **코스 시작점**이라 앞줄이 통째로 거짓이었다.
   */
  it('현재 위치 기준이라고 말하지 않는다 — 좌표는 코스의 시작점이다', () => {
    const markup = render({ lat: 33.4, lng: 126.9 })

    expect(markup).not.toContain(messages.home.goldenBasisCurrent)
    expect(markup).not.toContain(messages.home.goldenBasis)
  })

  /**
   * #779 의 나머지 절반. 전에는 `WalkTimesSection` 이 한 줄(거짓), 이 컴포넌트가 캡션
   * 한 줄(참)을 각각 말해 **한 카드가 기준점을 두 번** 말했다. 한 번만 말한다.
   */
  it('기준점을 말하는 줄이 하나뿐이다', () => {
    const markup = render({ lat: 33.4, lng: 126.9 })

    expect(markup.split(messages.home.goldenBasisCourseStart)).toHaveLength(2)
  })

  /** 조회 실패는 자리를 통째로 숨긴다 — 홈과 같은 규칙이다 */
  it('예보를 못 받았고 로딩도 아니면 자리를 만들지 않는다', () => {
    const markup = render({ lat: 33.4, lng: 126.9 }, null, false)

    expect(markup).toBe('')
  })

  it('로딩 중에는 자리를 세운다', () => {
    expect(render({ lat: 33.4, lng: 126.9 }, null, true)).not.toBe('')
  })
})

/*
  [#777](https://github.com/8llow8llowMe/hondigagae/issues/777). 이 카드는 반려견이 없으면
  **사람 기준**으로 판정하는데, 등록하면 그 판정이 실제로 바뀐다는 사실을 화면이 말하지
  않았다 — 사용자는 **더 나은 화면이 존재한다는 것 자체를 모른다.**

  붙이는 조건은 선례가 정해 두었다 (#748 결정 ③ · `place-suitability-panel`):
  **판정이 이미 서 있고, 등록하면 그 자리가 바뀌는 곳**에만 붙인다.
*/
describe('WalkCourseGoldenSlot — 반려견 등록 안내 (#777)', () => {
  const COORDS = { lat: 33.4, lng: 126.9 }
  const GUEST = { authed: false, petRegistered: false }
  const NO_PET = { authed: true, petRegistered: false }
  const WITH_PET = { authed: true, petRegistered: true }

  it('미로그인에는 등록 안내를 보여 준다', () => {
    const markup = render(COORDS, WALK_TIMES, false, GUEST)

    expect(markup).toContain(messages.home.guestVerdictNotice)
    expect(markup).toContain(messages.home.registerPet)
  })

  it('로그인했지만 반려견이 없어도 같은 안내다', () => {
    const markup = render(COORDS, WALK_TIMES, false, NO_PET)

    expect(markup).toContain(messages.home.guestVerdictNotice)
  })

  /**
   * **두 갈래가 같은 말을 한다.** 갈리는 것은 링크가 데려가는 곳 하나뿐이다 — 이 화면은
   * 미로그인에 안내를 한 겹 더 두지 않기로 이미 정했고(`walk-course-add-action.tsx`),
   * 여기만 어법을 갈라 두면 한 화면이 게스트를 두 방식으로 대한다.
   */
  it('갈리는 것은 링크가 데려가는 곳뿐이다', () => {
    expect(render(COORDS, WALK_TIMES, false, GUEST)).toContain('href="/login"')
    expect(render(COORDS, WALK_TIMES, false, NO_PET)).toContain('href="/pets/new"')
  })

  it('반려견이 있으면 안내를 붙이지 않는다', () => {
    const markup = render(COORDS, WALK_TIMES, false, WITH_PET)

    expect(markup).not.toContain(messages.home.guestVerdictNotice)
    // 카드 자체는 그대로다 — 안내만 없는 것이지 갈래가 다른 화면이 아니다
    expect(markup).toContain(messages.home.goldenHeading)
  })

  /**
   * **문구를 이 화면이 새로 쓰지 않는다.** 같은 상황에 화면마다 다른 말을 하지 않는 것이
   * #204 · #262 · #270 으로 세 번 고친 축이다 — 제목·기준점 줄과 같은 이유로
   * `messages.home` 의 문장을 그대로 쓴다.
   */
  it('홈이 이미 쓰던 문장을 그대로 쓴다', () => {
    expect(messages.home.guestVerdictNotice).toContain('반려견을 등록하면')
  })

  /*
    **지키지 못할 약속을 만들지 않는다.** 곡선이 비면 이 카드는 `예보가 없어요` 를 말하고
    있고 등록해도 그 자리는 바뀌지 않는다 — 등급은 예보에서 나온다. #748 이 활동량 줄에
    유도를 붙이지 않은 근거가 그대로 적용된다.
  */
  it('예보가 없으면 안내를 붙이지 않는다', () => {
    const noForecast = { ...WALK_TIMES, hourly: [] }
    const markup = render(COORDS, noForecast, false, GUEST)

    expect(markup).toContain(messages.home.goldenHeading)
    expect(markup).not.toContain(messages.home.guestVerdictNotice)
  })

  it('로딩 중에는 안내를 붙이지 않는다', () => {
    expect(render(COORDS, null, true, GUEST)).not.toContain(messages.home.guestVerdictNotice)
  })

  /**
   * **좌표가 없는 갈래에는 붙이지 않는다** (25/29 가 이 갈래다). 거기서는 요청 자체가
   * 나가지 않아 **판정이 아예 없고**, 등록해도 그 카드는 한 글자도 바뀌지 않는다 —
   * 붙이면 안내가 아니라 거짓말이다.
   */
  it('좌표가 없는 코스에는 붙이지 않는다', () => {
    const markup = render({ lat: null, lng: null }, null, false, GUEST)

    expect(markup).toContain(messages.walkCourse.noCoordinates)
    expect(markup).not.toContain(messages.home.guestVerdictNotice)
  })

  /**
   * **버튼을 하나 더 만들지 않는다** — 바로 아래 `일정에 담기` 와 컨트롤이 경쟁하면
   * 무엇이 주 행동인지 흐려진다. 링크 하나다 (`NoCoordinates` 와 같은 규칙).
   */
  it('안내가 버튼을 만들지 않는다', () => {
    expect(render(COORDS, WALK_TIMES, false, GUEST)).not.toContain('<button')
  })

  /** 오류가 아니라 이 사용자의 사정이다 — 경고로 읽히면 진입마다 먼저 읽힌다 (D6) */
  it('안내에 role="alert" 를 주지 않는다', () => {
    expect(render(COORDS, WALK_TIMES, false, GUEST)).not.toContain('role="alert"')
  })
})
