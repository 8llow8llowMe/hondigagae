import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import {
  isPlaceItemType,
  isReviewMissing,
  isReviewSectionVisible,
  mergeReviewFormPlaces,
  reviewablePlaceItems,
  toReviewUpsertPayload,
  validateReviewForm,
} from '@/lib/plan/review'
import { planItem } from '@/test/fixtures/plan'
import { REVIEW_BODY_MAX, REVIEW_COMMENT_MAX, REVIEW_NOT_FOUND_CODE } from '@/types/plan'

function typeMeta(code: string) {
  return { code, name: code, description: null }
}

describe('isReviewSectionVisible', () => {
  it('완료 일정에만 후기 절을 연다', () => {
    expect(isReviewSectionVisible('COMPLETED')).toBe(true)
    expect(isReviewSectionVisible('DRAFT')).toBe(false)
    expect(isReviewSectionVisible('CONFIRMED')).toBe(false)
    expect(isReviewSectionVisible('UNKNOWN')).toBe(false)
  })
})

describe('isPlaceItemType', () => {
  it('장소·식사·숙소만 후기 대상이다 — WALK 의 targetId 는 walk_course.id 다', () => {
    expect(isPlaceItemType('PLACE')).toBe(true)
    expect(isPlaceItemType('MEAL')).toBe(true)
    expect(isPlaceItemType('LODGING')).toBe(true)
    expect(isPlaceItemType('WALK')).toBe(false)
    expect(isPlaceItemType('MOVE')).toBe(false)
  })
})

describe('isReviewMissing', () => {
  it('404 + PLAN_015 만 빈 상태다 — 같은 404 라도 다른 코드는 아니다', () => {
    expect(
      isReviewMissing(new ApiError(404, REVIEW_NOT_FOUND_CODE, '작성한 여행 후기가 없습니다.')),
    ).toBe(true)
    expect(isReviewMissing(new ApiError(404, 'PLAN_001', '존재하지 않는 여행 일정입니다.'))).toBe(
      false,
    )
    expect(isReviewMissing(new ApiError(500, null, null))).toBe(false)
  })
})

describe('reviewablePlaceItems', () => {
  it('다녀온 장소 항목만 남긴다 — 방문 꺼짐·WALK 는 빠진다', () => {
    const items = [
      planItem({
        planItemId: '1',
        day: 1,
        sequence: 0,
        title: '미술관',
        visited: true,
      }),
      planItem({
        planItemId: '2',
        day: 1,
        sequence: 1,
        title: '시장',
        visited: false,
      }),
      planItem({
        planItemId: '3',
        day: 2,
        sequence: 0,
        title: '올레',
        itemType: typeMeta('WALK'),
        visited: true,
        place: null,
      }),
    ]

    expect(reviewablePlaceItems(items).map((item) => item.planItemId)).toEqual(['1'])
  })
})

describe('mergeReviewFormPlaces', () => {
  it('스냅샷이 먼저 오고, 지금 일정에만 있는 방문 장소를 뒤에 붙인다', () => {
    const current = [
      planItem({
        planItemId: 'alive',
        day: 1,
        sequence: 0,
        title: '지금 있는 곳',
        visited: true,
      }),
    ]
    const reviewItems = [
      {
        reviewItemId: 'r1',
        planItemId: 'gone',
        placeId: 'p-old',
        title: '사라진 폭포',
        rating: 5,
        comment: '그늘이 많았다',
      },
    ]

    const merged = mergeReviewFormPlaces(current, reviewItems)

    expect(merged.map((item) => item.planItemId)).toEqual(['gone', 'alive'])
    expect(merged[0]?.title).toBe('사라진 폭포')
    expect(merged[0]?.rating).toBe(5)
    expect(merged[1]?.rating).toBeNull()
  })
})

describe('validateReviewForm', () => {
  it('전체 만족도가 없으면 PLAN_126 문구다', () => {
    const errors = validateReviewForm({ overallRating: null, body: '', places: [] })

    expect(errors?.overallRating).toBe('전체 만족도는 필수입니다.')
  })

  it('본문이 2000자를 넘으면 PLAN_128 문구다', () => {
    const errors = validateReviewForm({
      overallRating: 4,
      body: '가'.repeat(REVIEW_BODY_MAX + 1),
      places: [],
    })

    expect(errors?.body).toBe('후기 본문은 2000자 이하만 가능합니다.')
  })

  it('장소 한 줄이 200자를 넘으면 PLAN_134 문구다', () => {
    const errors = validateReviewForm({
      overallRating: 4,
      body: '',
      places: [
        {
          planItemId: '1',
          title: '미술관',
          placeId: 'p',
          rating: 5,
          comment: '가'.repeat(REVIEW_COMMENT_MAX + 1),
        },
      ],
    })

    expect(errors?.comments['1']).toBe('장소 한 줄 후기는 200자 이하만 가능합니다.')
  })

  it('통과하면 null 이다', () => {
    expect(
      validateReviewForm({ overallRating: 4, body: '둘째 날이 더웠다.', places: [] }),
    ).toBeNull()
  })
})

describe('toReviewUpsertPayload', () => {
  it('빈 본문·한 줄은 null 이고, 평점 없는 장소는 items 에서 뺀다', () => {
    const payload = toReviewUpsertPayload({
      overallRating: 4,
      body: '   ',
      places: [
        {
          planItemId: '1',
          title: '미술관',
          placeId: 'p',
          rating: 5,
          comment: '  그늘  ',
        },
        {
          planItemId: '2',
          title: '시장',
          placeId: 'q',
          rating: null,
          comment: '적지 않음',
        },
      ],
    })

    expect(payload.body).toBeNull()
    expect(payload.items).toEqual([{ planItemId: '1', rating: 5, comment: '그늘' }])
  })
})
