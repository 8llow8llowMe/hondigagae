import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { PlaceAddToPlanPicker } from '@/features/plan/place-add-to-plan-picker'
import {
  toWalkCourseDayOptions,
  type WalkCourseAddTarget,
  walkCourseAddToastMessage,
  walkCourseSummaryLine,
} from '@/features/plan/walk-course-add-to-plan-sheet'
import { messages } from '@/lib/messages'
import { planDetail, planItem } from '@/test/fixtures/plan'
import type { PlanDetail } from '@/types/plan'

const COURSE: WalkCourseAddTarget = {
  walkCourseId: '6911167100216303304',
  courseLabel: '1코스',
  name: '시흥-광치기',
  distanceKm: 15.1,
}

describe('walkCourseSummaryLine — 담기 시트 머리 (D1)', () => {
  it('courseLabel · name · 거리를 셋 다 담는다', () => {
    const line = walkCourseSummaryLine(COURSE)

    expect(line).toContain('1코스')
    expect(line).toContain('시흥-광치기')
    expect(line).toContain('15.1km')
  })
})

describe('walkCourseAddToastMessage — 조사가 코스 이름표 받침을 따른다 (D5)', () => {
  /*
    **모든 코스 이름표가 `코스` 로 끝난다** (`스` 는 받침이 없다) — 그래서 실데이터로는
    `1코스` · `2코스` 둘 다 `를` 이다(D5 의 예시도 그렇다). 이 함수가 하드코딩이 아니라
    `withObjectParticle` 로 실제 계산한다는 것은 받침 있는 값으로 갈라 확인한다.
  */
  it('코스 이름표(…코스)는 받침이 없어 를 을 쓴다', () => {
    expect(walkCourseAddToastMessage('1코스', '몽실이와 제주 2박 3일', 3)).toContain('1코스를')
    expect(walkCourseAddToastMessage('2코스', '초코와 가을 서귀포', 1)).toContain('2코스를')
  })

  it('받침이 있으면 을 로 갈린다 — withObjectParticle 을 실제로 쓴다', () => {
    expect(walkCourseAddToastMessage('몽실산책길', '초코와 가을 서귀포', 1)).toContain(
      '몽실산책길을',
    )
  })

  it('일정 제목과 일차를 함께 말한다 — 코스 이름표만으로는 어느 일정인지 모른다', () => {
    const message = walkCourseAddToastMessage('1코스', '몽실이와 제주 2박 3일', 3)

    expect(message).toContain('몽실이와 제주 2박 3일')
    expect(message).toContain('3일차')
  })
})

describe('toWalkCourseDayOptions — 일자 옵션 (D3-2)', () => {
  const detail: PlanDetail = {
    ...planDetail,
    totalDays: 2,
    items: [
      planItem({
        planItemId: 'w-1',
        day: 1,
        sequence: 0,
        title: '1코스 시흥-광치기',
        itemType: { code: 'WALK', name: '산책', description: null },
        targetId: COURSE.walkCourseId,
        place: null,
      }),
    ],
  }

  it('이미 담긴 일자는 already 와 disabled 가 함께 켜진다', () => {
    const options = toWalkCourseDayOptions(detail, COURSE.walkCourseId)

    expect(options[0]).toMatchObject({ day: 1, already: true, disabled: true })
  })

  it('아직 안 담긴 일자는 잠기지 않는다', () => {
    const options = toWalkCourseDayOptions(detail, COURSE.walkCourseId)

    expect(options[1]).toMatchObject({ day: 2, already: false, disabled: false })
  })

  it('다른 코스 id 로 물으면 잠기지 않는다', () => {
    const options = toWalkCourseDayOptions(detail, '9999999999999999999')

    expect(options.every((option) => option.disabled === false)).toBe(true)
  })

  it('상세를 아직 못 받았으면 빈 배열이다', () => {
    expect(toWalkCourseDayOptions(undefined, COURSE.walkCourseId)).toEqual([])
  })
})

/**
 * `PlaceAddToPlanPicker` 는 대상 종류를 몰라도 된다 — 호출부(`toWalkCourseDayOptions`)가
 * 계산한 `disabled` 를 그대로 그릴 뿐이다 (D2 · D3-2).
 */
describe('이미 담긴 일자 옵션 — 이미 담았어요 + disabled (D7)', () => {
  it('already 인 옵션에 이미 담았어요 와 disabled 가 함께 있다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceAddToPlanPicker, {
        plans: [
          {
            planId: '1',
            petId: 'pet-1',
            petIds: ['pet-1'],
            areaCode: '39',
            title: '몽실이와 제주 2박 3일',
            startDate: '2026-09-12',
            endDate: '2026-09-14',
            status: { code: 'DRAFT', name: '초안', description: null },
          },
        ],
        selectedPlanId: '1',
        onSelectPlan: vi.fn(),
        days: [{ day: 1, date: '2026-09-12', itemCount: 1, already: true, disabled: true }],
        daysLoading: false,
        selectedDay: null,
        onSelectDay: vi.fn(),
      }),
    )

    expect(markup).toContain(messages.plan.addPlaceAlready)
    expect(markup).toContain('disabled')
  })
})
