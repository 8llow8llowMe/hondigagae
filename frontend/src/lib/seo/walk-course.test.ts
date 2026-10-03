import { describe, expect, it } from 'vitest'

import { walkCourseSeoDescription, walkCourseSeoTitle } from '@/lib/seo/walk-course'
import {
  ACTIVITY_LEVEL_HIGH,
  ACTIVITY_LEVEL_MEDIUM,
  WALK_COURSE_PLAIN,
  walkCourseDetail,
} from '@/test/fixtures/walk-course'

describe('올레 코스 검색 문구 (#1130)', () => {
  it('제목 — 코스 번호 · 이름 · 강아지 산책', () => {
    expect(walkCourseSeoTitle(WALK_COURSE_PLAIN)).toBe('1코스 시흥-광치기 강아지 산책 · 혼디가개')
  })

  it('설명 — 코스마다 다른 사실(구간 · 거리 · 시간 · 활동량)로 시작한다', () => {
    const description = walkCourseSeoDescription(
      walkCourseDetail(WALK_COURSE_PLAIN, [ACTIVITY_LEVEL_MEDIUM, ACTIVITY_LEVEL_HIGH]),
    )

    expect(
      description.startsWith(
        `제주올레 1코스 · 시흥리정류장-광치기해변 · 15.1km · 4~5시간 · 활동량 ${ACTIVITY_LEVEL_MEDIUM.name} · ${ACTIVITY_LEVEL_HIGH.name}. `,
      ),
    ).toBe(true)
  })

  it('맞는 활동량이 없으면 활동량 칸을 비운다', () => {
    expect(walkCourseSeoDescription(walkCourseDetail(WALK_COURSE_PLAIN, []))).not.toContain(
      '활동량 ',
    )
  })
})
