import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { WalkCourseGoldenSlot } from '@/features/walk-course/walk-course-golden-slot'
import { mockWalkTimes } from '@/lib/api/mock/insight-data'
import { messages } from '@/lib/messages'
import type { WalkTimesResponse } from '@/types/insight'

/**
 * **좌표가 없는 코스에 골든타임 동선을 만들지 않는다** — 이 이슈의 핵심 규칙이다
 * (공통명세 S4-2 · `WalkCourseItem.java:10-12`).
 *
 * 실측 29개 중 **25개가 그 경우**라 이것은 예외 갈래가 아니라 **기본 갈래**다.
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

describe('WalkCourseGoldenSlot — 좌표가 없으면 자리를 만들지 않는다 (D5-2)', () => {
  it('lat·lng 가 둘 다 null 이면 골든타임 마크업이 없다', () => {
    const markup = render({ lat: null, lng: null })

    expect(markup).not.toContain(messages.home.goldenHeading)
  })

  /** 한쪽만 보는 실수를 잡는다 */
  it('lat 만 null 이어도 만들지 않는다', () => {
    expect(render({ lat: null, lng: 126.9 })).not.toContain(messages.home.goldenHeading)
  })

  it('lng 만 null 이어도 만들지 않는다', () => {
    expect(render({ lat: 33.4, lng: null })).not.toContain(messages.home.goldenHeading)
  })

  /** 기다리면 채워질 것처럼 보이는 자리를 두지 않는다 */
  it('스켈레톤도 남기지 않는다 — 로딩 중이어도 같다', () => {
    const markup = render({ lat: null, lng: null }, null, true)

    expect(markup).not.toContain('aria-busy')
    expect(markup).not.toContain(messages.home.goldenHeading)
  })

  /** 소리 없이 사라지면 코스마다 화면이 다른 이유를 알 수 없다 */
  it('대신 이유를 한 줄로 밝힌다', () => {
    expect(render({ lat: null, lng: null })).toContain(messages.walkCourse.noCoordinates)
  })

  /** 오류가 아니라 이 코스의 사실이다 — 경고로 읽히면 진입마다 먼저 읽힌다 (D6) */
  it('좌표 없음 안내에 role="alert" 를 주지 않는다', () => {
    expect(render({ lat: null, lng: null })).not.toContain('role="alert"')
  })

  it('시작점 기준 캡션도 세우지 않는다 — 기준으로 삼을 시작점이 없다', () => {
    expect(render({ lat: null, lng: null })).not.toContain(messages.walkCourse.goldenBasis)
  })
})

describe('WalkCourseGoldenSlot — 좌표가 있으면 골든타임을 세운다', () => {
  it('골든타임 섹션을 그린다', () => {
    expect(render({ lat: 33.4, lng: 126.9 })).toContain(messages.home.goldenHeading)
  })

  /** 코스 전체가 아니라 시작점 기준이라는 사실이다 (D8-5) */
  it('시작점 기준이라는 캡션을 붙인다', () => {
    expect(render({ lat: 33.4, lng: 126.9 })).toContain(messages.walkCourse.goldenBasis)
  })

  /**
   * **`positionFallback` 은 `false` 다** (D5-1). 그 prop 은 "기기 위치를 못 얻어 제주
   * 중심으로 조회했다" 를 뜻하는데(#180) 여기 좌표는 코스의 시작점이라 폴백이 아니다.
   */
  it('위치 폴백 문구를 쓰지 않는다 — 좌표는 코스의 시작점이다', () => {
    const markup = render({ lat: 33.4, lng: 126.9 })

    expect(markup).not.toContain(messages.home.goldenBasis)
    expect(markup).toContain(messages.home.goldenBasisCurrent)
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
