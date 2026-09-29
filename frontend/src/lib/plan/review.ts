import { ApiError, isRetriable } from '@/lib/api/error'
import type {
  PlanItemDetail,
  PlanReviewPlaceItem,
  PlanReviewResponse,
  PlanReviewUpsertPayload,
} from '@/types/plan'
import {
  REVIEW_BODY_MAX,
  REVIEW_COMMENT_MAX,
  REVIEW_ITEMS_MAX,
  REVIEW_PLACE_ITEM_TYPES,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
} from '@/types/plan'

/**
 * 여행 후기 화면 판정 (#615).
 *
 * 훅을 든 패널은 provider 없이 렌더할 수 없어, 갈래는 여기 둔다 —
 * `lib/plan/packing.ts` 와 같은 이유다.
 */

const PLACE_TYPES = new Set<string>(REVIEW_PLACE_ITEM_TYPES)

export function isReviewSectionVisible(statusCode: string): boolean {
  return statusCode === 'COMPLETED'
}

export function isPlaceItemType(code: string): boolean {
  return PLACE_TYPES.has(code)
}

/** 후기 절의 다섯 갈래. `PlanReviewPanel` 이 이 값 하나로 그린다 */
export type ReviewPanelStatus = 'loading' | 'missing' | 'ready' | 'failed' | 'blocked'

/**
 * 후기 조회 결과를 절의 갈래로 바꾼다 (#979).
 *
 * **"아직 안 썼다" 는 성공 + `null` 이다** — 서버가 200 + `dataBody: null` 로 답한다
 * (예전에는 404 `PLAN_015` 였다). 그래서 `missing` 은 오류가 아니라 데이터로 가른다.
 * 오류는 전부 오류다: 5xx · 무응답은 재시도(`failed`), 그 밖(404 `PLAN_001` 등)은 서버
 * 문구만(`blocked`). **404 를 빈 상태로 접지 않는다** — 없는 일정에 쓰기 CTA 를 주게 된다.
 *
 * 오류가 이전 성공 값보다 앞선다. 재조회가 실패하면 캐시된 값이 남아 있어도 실패를 보인다.
 */
export function reviewPanelStatus(query: {
  isPending: boolean
  error: unknown
  data: PlanReviewResponse | null | undefined
}): ReviewPanelStatus {
  if (query.isPending) return 'loading'
  if (query.error !== null && query.error !== undefined) {
    return isRetriable(query.error) ? 'failed' : 'blocked'
  }
  return query.data === null ? 'missing' : 'ready'
}

/** 작성·수정 폼의 장소 한 줄. 평점을 고르지 않으면 요청 `items` 에서 빠진다 */
export type ReviewPlaceDraft = {
  planItemId: string
  title: string
  placeId: string | null
  rating: number | null
  comment: string
}

/** 지금 일정의 다녀온 장소 항목. 작성 폼의 기본 목록이다 */
export function reviewablePlaceItems(items: PlanItemDetail[]): ReviewPlaceDraft[] {
  return items
    .filter((item) => item.visited && isPlaceItemType(item.itemType.code))
    .map((item) => ({
      planItemId: item.planItemId,
      title: item.title,
      placeId: item.targetId,
      rating: null,
      comment: '',
    }))
}

/**
 * 수정 폼 목록. **스냅샷이 먼저다** — 일차 교체로 사라진 항목도 제목·placeId 를
 * 유지한다. 그다음 지금 일정에 새로 생긴 방문 장소를 붙인다.
 */
export function mergeReviewFormPlaces(
  currentItems: PlanItemDetail[],
  reviewItems: PlanReviewPlaceItem[],
): ReviewPlaceDraft[] {
  const fromReview = reviewItems.map((item) => ({
    planItemId: item.planItemId,
    title: item.title,
    placeId: item.placeId,
    rating: item.rating,
    comment: item.comment ?? '',
  }))
  const seen = new Set(fromReview.map((item) => item.planItemId))
  const extra = reviewablePlaceItems(currentItems).filter((item) => !seen.has(item.planItemId))
  return [...fromReview, ...extra]
}

export type ReviewFormValues = {
  overallRating: number | null
  body: string
  places: ReviewPlaceDraft[]
}

export type ReviewFieldErrors = {
  overallRating?: string
  body?: string
  items?: string
  ratings: Record<string, string>
  comments: Record<string, string>
}

/**
 * 서버 `PlanValidationMessage` 복제본. **어미를 해요체로 바꾸지 않는다** —
 * 같은 폼에서 클라이언트 검증과 서버 검증 말투가 갈리면 안 된다 (`// PLAN_NNN`).
 */
export function validateReviewForm(values: ReviewFormValues): ReviewFieldErrors | null {
  const ratings: Record<string, string> = {}
  const comments: Record<string, string> = {}
  const errors: ReviewFieldErrors = { ratings, comments }

  if (values.overallRating === null) {
    // PLAN_126
    errors.overallRating = '전체 만족도는 필수입니다.'
  } else if (values.overallRating < REVIEW_RATING_MIN || values.overallRating > REVIEW_RATING_MAX) {
    // PLAN_127
    errors.overallRating = '전체 만족도는 1 이상 5 이하여야 합니다.'
  }

  if (values.body.length > REVIEW_BODY_MAX) {
    // PLAN_128
    errors.body = '후기 본문은 2000자 이하만 가능합니다.'
  }

  const ratedCount = values.places.filter((place) => place.rating !== null).length
  if (ratedCount > REVIEW_ITEMS_MAX) {
    // PLAN_130
    errors.items = '장소별 후기는 한 번에 최대 50개까지 보낼 수 있습니다.'
  }

  for (const place of values.places) {
    if (
      place.rating !== null &&
      (place.rating < REVIEW_RATING_MIN || place.rating > REVIEW_RATING_MAX)
    ) {
      // PLAN_133
      ratings[place.planItemId] = '장소 만족도는 1 이상 5 이하여야 합니다.'
    }
    if (place.comment.length > REVIEW_COMMENT_MAX) {
      // PLAN_134
      comments[place.planItemId] = '장소 한 줄 후기는 200자 이하만 가능합니다.'
    }
  }

  const hasField =
    errors.overallRating !== undefined ||
    errors.body !== undefined ||
    errors.items !== undefined ||
    Object.keys(ratings).length > 0 ||
    Object.keys(comments).length > 0

  return hasField ? errors : null
}

export function toReviewUpsertPayload(values: ReviewFormValues): PlanReviewUpsertPayload {
  const body = values.body.trim()
  return {
    overallRating: values.overallRating ?? REVIEW_RATING_MIN,
    body: body === '' ? null : body,
    items: values.places
      .filter((place): place is ReviewPlaceDraft & { rating: number } => place.rating !== null)
      .map((place) => {
        const comment = place.comment.trim()
        return {
          planItemId: place.planItemId,
          rating: place.rating,
          comment: comment === '' ? null : comment,
        }
      }),
  }
}

/** 제출 실패 문구. 서버 `resultMessage` 가 있으면 그대로 쓴다 */
export function reviewSubmitErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message.length > 0) return error.message
  return fallback
}
