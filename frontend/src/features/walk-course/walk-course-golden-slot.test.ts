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

function render(
  course: { lat: number | null; lng: number | null },
  walkTimes: WalkTimesResponse | null = WALK_TIMES,
  loading = false,
): string {
  return renderToStaticMarkup(
    createElement(WalkCourseGoldenSlot, { course, walkTimes, loading, onRetry: vi.fn() }),
  )
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

  /** ① 왜 없는지 ② 얼마나 흔한 일인지 ③ 대안 둘 — 상자가 셋을 담는다 */
  it('안내 상자가 왜 · 얼마나 흔한지 · 대안 둘을 담는다', () => {
    const markup = render(NO_COORDS)

    expect(markup).toContain(messages.walkCourse.noCoordinates)
    expect(markup).toContain(messages.walkCourse.noCoordinatesCommon)
    expect(markup).toContain(messages.walkCourse.noCoordinatesAlternatives)
    expect(markup).toContain(messages.walkCourse.noCoordinatesPlacesAction)
    expect(markup).toContain(messages.walkCourse.noCoordinatesPlanAction)
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
   * **대안 ① 은 장소 찾기로 간다.** 새 API 를 만들지 않고 기존 경로를 쓴다.
   *
   * **검색어를 채우지 않는다** — 서버 `keyword` 는 `title`·`addr1` 의 `%LIKE%` 라
   * 시종점 원문에서 만든 토막은 대부분 0건이다. 결과 없음으로 데려가는 대안은 대안이 아니다.
   */
  it('대안 ① 이 /places 로 가고 검색어를 지어내지 않는다', () => {
    expect(render(NO_COORDS)).toContain('href="/places"')
  })

  /**
   * **대안 ② 는 버튼을 하나 더 만들지 않는다.** 같은 화면 아래 `일정에 담기` 와 같은
   * 이름의 컨트롤이 둘이면 보조기기에서 목적지가 둘로 들린다.
   */
  it('대안 ② 는 아래 CTA 를 가리킬 뿐 버튼을 더 만들지 않는다', () => {
    const markup = render(NO_COORDS)

    expect(markup).not.toContain('<button')
    expect(markup).toContain(messages.plan.addToPlanAction)
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
