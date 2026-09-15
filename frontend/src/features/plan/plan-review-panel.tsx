'use client'

import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Skeleton } from '@/components/skeleton'
import { Textarea } from '@/components/textarea'
import { PLAN_QUERY_OPTIONS, planKeys } from '@/features/plan/queries'
import { shouldOfferRetry } from '@/lib/api/error'
import { createPlanReview, fetchPlanReview, updatePlanReview } from '@/lib/api/plan'
import { messages } from '@/lib/messages'
import {
  isReviewMissing,
  mergeReviewFormPlaces,
  reviewablePlaceItems,
  type ReviewFieldErrors,
  type ReviewPlaceDraft,
  reviewSubmitErrorMessage,
  toReviewUpsertPayload,
  validateReviewForm,
} from '@/lib/plan/review'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlanDetail, PlanReviewResponse, PlanReviewUpsertPayload } from '@/types/plan'
import {
  REVIEW_BODY_MAX,
  REVIEW_COMMENT_MAX,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
} from '@/types/plan'

const RATING_SCORES = Array.from(
  { length: REVIEW_RATING_MAX - REVIEW_RATING_MIN + 1 },
  (_, index) => REVIEW_RATING_MIN + index,
)

/**
 * 여행 후기 (#615). **완료 일정에서만 마운트한다** — 초안·확정은 호출부가 절 자체를
 * 그리지 않는다. GET 은 상세와 key 가 달라 후기 404 가 본문을 덮지 않는다.
 */
export function PlanReviewList({ plan }: { plan: PlanDetail }) {
  const queryClient = useQueryClient()
  const key = planKeys.review(plan.planId)
  const [mode, setMode] = useState<'view' | 'write'>('view')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchPlanReview(plan.planId),
    ...PLAN_QUERY_OPTIONS,
  })

  function apply(next: PlanReviewResponse) {
    queryClient.setQueryData(key, next)
    setMode('view')
    setSubmitError(null)
  }

  const create = useMutation({
    mutationFn: (payload: PlanReviewUpsertPayload) => createPlanReview(plan.planId, payload),
    onSuccess: apply,
    onError: (error) =>
      setSubmitError(reviewSubmitErrorMessage(error, messages.plan.reviewSaveError)),
  })

  const update = useMutation({
    mutationFn: (payload: PlanReviewUpsertPayload) => updatePlanReview(plan.planId, payload),
    onSuccess: apply,
    onError: (error) =>
      setSubmitError(reviewSubmitErrorMessage(error, messages.plan.reviewSaveError)),
  })

  const missing = isReviewMissing(query.error)
  const retryable = query.isError && !missing && shouldOfferRetry(query.error)
  const blocked = query.isError && !missing && !retryable

  let status: PlanReviewPanelProps['status'] = 'ready'
  if (query.isPending) status = 'loading'
  else if (missing) status = 'missing'
  else if (retryable) status = 'failed'
  else if (blocked) status = 'blocked'

  const review = query.data ?? null
  const places =
    review === null
      ? reviewablePlaceItems(plan.items)
      : mergeReviewFormPlaces(plan.items, review.items)

  return (
    <PlanReviewPanel
      status={status}
      review={review}
      places={places}
      mode={mode}
      submitting={create.isPending || update.isPending}
      submitError={submitError}
      errorMessage={
        query.error instanceof Error && query.error.message.length > 0
          ? query.error.message
          : messages.plan.reviewLoadErrorTitle
      }
      onRetry={() => {
        void query.refetch()
      }}
      onStartWrite={() => {
        setMode('write')
        setSubmitError(null)
      }}
      onCancelWrite={() => {
        setMode('view')
        setSubmitError(null)
      }}
      onSubmit={(payload) => {
        if (review === null) create.mutate(payload)
        else update.mutate(payload)
      }}
    />
  )
}

export type PlanReviewPanelProps = {
  status: 'loading' | 'missing' | 'ready' | 'failed' | 'blocked'
  review: PlanReviewResponse | null
  places: ReviewPlaceDraft[]
  mode: 'view' | 'write'
  submitting: boolean
  submitError: string | null
  errorMessage: string
  onRetry: () => void
  onStartWrite: () => void
  onCancelWrite: () => void
  onSubmit: (payload: PlanReviewUpsertPayload) => void
}

/**
 * 표현 전용. **호출을 갖지 않는다** — `PackingListPanel` 과 같은 나눔이다.
 * 훅을 든 컴포넌트는 provider 없이 `renderToStaticMarkup` 할 수 없다.
 */
export function PlanReviewPanel({
  status,
  review,
  places,
  mode,
  submitting,
  submitError,
  errorMessage,
  onRetry,
  onStartWrite,
  onCancelWrite,
  onSubmit,
}: PlanReviewPanelProps) {
  return (
    <div className={cn('flex flex-col gap-3 py-4 md:py-5', INSET_CLASS.card)}>
      <h2 className="text-title-2 text-fg lg:text-title-1 font-semibold lg:font-bold">
        {messages.plan.reviewHeading}
      </h2>
      <Body
        status={status}
        review={review}
        places={places}
        mode={mode}
        submitting={submitting}
        submitError={submitError}
        errorMessage={errorMessage}
        onRetry={onRetry}
        onStartWrite={onStartWrite}
        onCancelWrite={onCancelWrite}
        onSubmit={onSubmit}
      />
    </div>
  )
}

function Body(props: PlanReviewPanelProps) {
  const { status, review, mode } = props

  if (status === 'loading') return <PanelSkeleton />

  /*
    일시 장애만 재시도. 404 `PLAN_015` 는 아래 missing 으로 가고,
    PLAN_016 같은 4xx 는 서버 문구만 보여 준다.
  */
  if (status === 'failed') {
    return (
      <ErrorState
        inset="card"
        headingLevel={3}
        title={messages.plan.reviewLoadErrorTitle}
        onRetry={props.onRetry}
      />
    )
  }

  if (status === 'blocked') {
    return <FormAlert message={props.errorMessage} />
  }

  if (status === 'missing' && mode === 'view') {
    return (
      <EmptyState
        inset="card"
        headingLevel={3}
        title={messages.plan.reviewEmptyTitle}
        description={messages.plan.reviewEmptyDescription}
        action={
          <Button type="button" onClick={props.onStartWrite}>
            {messages.plan.reviewWriteAction}
          </Button>
        }
      />
    )
  }

  if (mode === 'write') {
    return (
      <ReviewForm
        key={review?.reviewId ?? 'new'}
        initialOverall={review?.overallRating ?? null}
        initialBody={review?.body ?? ''}
        places={props.places}
        submitting={props.submitting}
        submitError={props.submitError}
        submitLabel={
          review === null ? messages.plan.reviewSubmitCreate : messages.plan.reviewSubmitUpdate
        }
        onCancel={props.onCancelWrite}
        onSubmit={props.onSubmit}
      />
    )
  }

  if (review === null) return null

  return <ReviewView review={review} onEdit={props.onStartWrite} />
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-3/5" />
    </div>
  )
}

function ReviewView({ review, onEdit }: { review: PlanReviewResponse; onEdit: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-1 text-fg font-medium">
        {messages.plan.reviewOverallValue.replace('{rating}', String(review.overallRating))}
      </p>
      {review.body !== null && review.body.length > 0 && (
        <p className="text-body-2 text-fg whitespace-pre-wrap">{review.body}</p>
      )}
      {review.items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {review.items.map((item) => (
            <li key={item.reviewItemId} className="flex flex-col gap-1">
              <p className="text-body-2 text-fg font-medium">{item.title}</p>
              <p className="text-caption text-fg-muted">
                {messages.plan.reviewPlaceRatingLabel} {item.rating}
              </p>
              {item.comment !== null && item.comment.length > 0 && (
                <p className="text-body-2 text-fg">{item.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button type="button" variant="secondary" onClick={onEdit}>
          {messages.plan.reviewEditAction}
        </Button>
      </div>
    </div>
  )
}

function ReviewForm({
  initialOverall,
  initialBody,
  places,
  submitting,
  submitError,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initialOverall: number | null
  initialBody: string
  places: ReviewPlaceDraft[]
  submitting: boolean
  submitError: string | null
  submitLabel: string
  onCancel: () => void
  onSubmit: (payload: PlanReviewUpsertPayload) => void
}) {
  const [overallRating, setOverallRating] = useState<number | null>(initialOverall)
  const [body, setBody] = useState(initialBody)
  const [drafts, setDrafts] = useState(places)
  const [fieldErrors, setFieldErrors] = useState<ReviewFieldErrors | null>(null)

  function patchPlace(planItemId: string, patch: Partial<ReviewPlaceDraft>) {
    setDrafts((current) =>
      current.map((place) => (place.planItemId === planItemId ? { ...place, ...patch } : place)),
    )
  }

  function handleSubmit() {
    const values = { overallRating, body, places: drafts }
    const errors = validateReviewForm(values)
    if (errors !== null) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors(null)
    onSubmit(toReviewUpsertPayload(values))
  }

  return (
    <div className="flex flex-col gap-4">
      <FormAlert message={submitError} />
      {fieldErrors?.items !== undefined && <FormAlert message={fieldErrors.items} />}

      <RatingPicker
        label={messages.plan.reviewOverallLabel}
        value={overallRating}
        required
        error={fieldErrors?.overallRating}
        disabled={submitting}
        onChange={setOverallRating}
      />

      <Field
        id="plan-review-body"
        label={messages.plan.reviewBodyLabel}
        hint={messages.plan.reviewBodyHint}
        error={fieldErrors?.body}
      >
        <Textarea
          id="plan-review-body"
          value={body}
          onValueChange={setBody}
          invalid={fieldErrors?.body !== undefined}
          maxLength={REVIEW_BODY_MAX}
          rows={4}
          placeholder={messages.plan.reviewBodyPlaceholder}
          disabled={submitting}
        />
      </Field>

      {drafts.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-body-2 text-fg font-medium">{messages.plan.reviewPlacesLabel}</p>
            <p className="text-caption text-fg-muted">{messages.plan.reviewPlacesHint}</p>
          </div>
          {drafts.map((place) => (
            <div key={place.planItemId} className="flex flex-col gap-3">
              <p className="text-body-2 text-fg font-medium">{place.title}</p>
              <RatingPicker
                label={messages.plan.reviewPlaceRatingLabel}
                value={place.rating}
                error={fieldErrors?.ratings[place.planItemId]}
                disabled={submitting}
                onChange={(rating) => patchPlace(place.planItemId, { rating })}
              />
              <Field
                id={`plan-review-comment-${place.planItemId}`}
                label={messages.plan.reviewPlaceCommentLabel}
                hint={messages.plan.reviewPlaceCommentHint}
                error={fieldErrors?.comments[place.planItemId]}
              >
                <Textarea
                  id={`plan-review-comment-${place.planItemId}`}
                  value={place.comment}
                  onValueChange={(value) => patchPlace(place.planItemId, { comment: value })}
                  invalid={fieldErrors?.comments[place.planItemId] !== undefined}
                  maxLength={REVIEW_COMMENT_MAX}
                  rows={2}
                  disabled={submitting}
                />
              </Field>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" loading={submitting} onClick={handleSubmit}>
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" disabled={submitting} onClick={onCancel}>
          {messages.plan.reviewCancelAction}
        </Button>
      </div>
    </div>
  )
}

function RatingPicker({
  label,
  value,
  required = false,
  error,
  disabled,
  onChange,
}: {
  label: string
  value: number | null
  required?: boolean
  error?: string | undefined
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-body-2 text-fg font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger-500 ml-1">
            *
          </span>
        )}
      </p>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {RATING_SCORES.map((score) => (
          <Button
            key={score}
            type="button"
            variant={value === score ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={value === score}
            disabled={disabled}
            onClick={() => onChange(score)}
          >
            {String(score)}
          </Button>
        ))}
      </div>
      {error !== undefined && <p className="text-caption text-danger-500">{error}</p>}
    </div>
  )
}
