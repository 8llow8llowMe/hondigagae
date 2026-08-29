import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { RowList } from '@/components/surface'
import { PlaceRow } from '@/features/place/place-row'
import { PlaceRowSkeleton } from '@/features/place/place-row-skeleton'
import { classify } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { messages } from '@/lib/messages'
import type { PlaceSummary } from '@/types/place'

const SKELETON_COUNT = 6

export type PlaceListSectionProps = {
  places: readonly PlaceSummary[]
  loading: boolean
  /** 실패한 요청의 HTTP 상태. 성공이면 null */
  errorStatus: number | null
  /** 서버가 준 resultMessage (문자열이 아닐 수 있다) */
  errorMessage?: unknown
  hasNext: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onRetry: () => void
  onResetFilters: () => void
}

/**
 * 목록의 4개 상태를 **배타적으로** 렌더한다.
 * props 로만 데이터를 받는 presentational 컴포넌트다 — node 환경에서 테스트하기 위해서다
 * (docs/testing-guide.md §1).
 */
export function PlaceListSection({
  places,
  loading,
  errorStatus,
  errorMessage,
  hasNext,
  loadingMore,
  onLoadMore,
  onRetry,
  onResetFilters,
}: PlaceListSectionProps) {
  if (loading) {
    return (
      <RowList>
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <PlaceRowSkeleton key={index} last={index === SKELETON_COUNT - 1} />
        ))}
      </RowList>
    )
  }

  if (errorStatus !== null) {
    const kind = classify(errorStatus)

    // 404 는 데이터 부재다. 재시도 버튼을 붙이지 않고 서버 문구를 그대로 노출한다
    if (kind === 'not-found') {
      return (
        <EmptyState
          title={toMessage(errorMessage, messages.place.emptyTitle)}
          description={messages.place.emptyDescription}
          action={
            <Button variant="secondary" size="md" onClick={onResetFilters}>
              {messages.place.resetFilters}
            </Button>
          }
        />
      )
    }

    if (kind === 'validation') {
      return (
        <ErrorState
          title={messages.common.validationErrorTitle}
          description={toMessage(errorMessage, messages.place.emptyDescription)}
          retryLabel={messages.place.resetFilters}
          onRetry={onResetFilters}
        />
      )
    }

    // 5xx · 무응답 — 재시도를 제공한다
    return (
      <ErrorState
        title={messages.place.errorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={onRetry}
      />
    )
  }

  if (places.length === 0) {
    return (
      <EmptyState
        title={messages.place.emptyTitle}
        description={messages.place.emptyDescription}
        action={
          <Button variant="secondary" size="md" onClick={onResetFilters}>
            {messages.place.resetFilters}
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col">
      <RowList>
        {places.map((place, index) => (
          <PlaceRow key={place.placeId} place={place} last={index === places.length - 1} />
        ))}
      </RowList>

      {hasNext ? (
        // 아트보드 01·03 절: 모바일은 전폭, 데스크톱은 내용 폭. 좌우 여백은 행 인셋과 같다
        <div className="border-border border-t px-4 py-4 md:px-10 lg:py-5">
          <Button
            variant="secondary"
            size="md"
            className="w-full md:w-auto"
            loading={loadingMore}
            onClick={onLoadMore}
          >
            {messages.common.loadMore}
          </Button>
        </div>
      ) : (
        <p className="text-caption text-fg-muted py-4 text-center font-medium">
          {messages.common.listEnd}
        </p>
      )}
    </div>
  )
}
