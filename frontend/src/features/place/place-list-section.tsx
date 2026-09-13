import type { ReactNode } from 'react'

import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { InfiniteScrollSentinel } from '@/components/infinite-scroll-sentinel'
import { SurfaceList } from '@/components/surface'
import { PlaceRow } from '@/features/place/place-row'
import { PlaceRowSkeleton } from '@/features/place/place-row-skeleton'
import { classify } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { messages } from '@/lib/messages'
import type { Inset } from '@/lib/ui/inset'
import type { PlaceSummary } from '@/types/place'

const SKELETON_COUNT = 6

/**
 * 다음 페이지를 받는 동안 목록 끝에 세우는 행 수.
 *
 * 첫 로딩(6개)보다 적게 둔다 — 이미 읽을 것이 위에 있는 상태라, 스켈레톤이 화면을
 * 채우면 방금 보던 목록이 밀려 올라가 어디를 읽고 있었는지 잃는다.
 */
const LOAD_MORE_SKELETON_COUNT = 2

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
  /**
   * 걸려 있는 검색어 (#431). **0건 문구가 무엇으로 찾았는지 되돌려 주는 데만 쓴다.**
   *
   * `null` 이면 필터만 걸린 0건이라 기존 문구 그대로다 — 담기 화면·지도 폴백처럼 검색
   * 입력이 없는 사용처는 넘기지 않는다.
   */
  keyword?: string | null
  /**
   * 행을 다르게 그린다. 기본은 장소 상세로 가는 `PlaceRow` 다.
   *
   * 일정에 담는 화면(#82)이 같은 4상태(로딩·오류·빈 결과·목록)와 무한 스크롤을
   * 쓰면서 행만 다르다. **상태 로직을 복제하지 않으려고 행만 갈아끼운다** —
   * 반대로 이 컴포넌트가 일정 도메인을 알면 place → plan 역참조가 된다.
   */
  renderRow?: (place: PlaceSummary) => ReactNode
  /**
   * 기본 행·스켈레톤과 **빈·오류 상태**의 좌우 인셋. **이 목록을 담는 곳이 정한다**
   * (`inset.ts`). 네 상태가 서로 다른 축에 서면 목록이 바뀌는 순간 왼쪽 선이 뛴다 (#451).
   *
   * 기본은 카드 안(16/20)이다 — 3a 가 정본이라 카드가 기본 자리다. 지도 SDK 실패
   * 폴백 목록은 카드가 아니라 페이지 위에 놓이므로 `main`(16/40)을 넘긴다.
   * `renderRow` 를 직접 준 사용처는 자기 행의 인셋도 자기가 정한다.
   */
  inset?: Inset
  /**
   * 빈·오류 상태 제목의 heading 레벨. **이 목록을 담는 곳이 정한다** — `inset` 과 같은 축이다.
   *
   * **여기는 세 사용처가 실제로 갈린다** (#456①): `/places` 는 제목 있는 카드 안이라 `3`,
   * 담기 화면(#82)은 `aria-label` 만 있는 카드 안이라 `2`, 지도 SDK 실패 폴백은 카드가
   * 아니라 `2` 다. 기본값 `2` 는 그중 둘이라 `inset` 의 기본값(`card`)과 짝이 맞지 않는데,
   * **두 축이 원래 다른 것을 묻기 때문이다** — `inset` 은 "카드 안인가", 이쪽은 "그 카드가
   * 제목을 갖는가". 한쪽에서 다른 쪽을 읽으면 담기 화면이 조용히 `h3` 가 된다.
   */
  headingLevel?: 2 | 3
  /**
   * 목록을 `xl`(1280)+ 에서 2열로 접는다 (#531). 기본은 1열이다.
   *
   * **담는 곳이 정한다** — `inset`·`headingLevel` 과 같은 축이다. 2열이 답답하지 않으려면
   * 한 칸이 충분히 넓어야 하는데 그 폭은 **이 목록이 아니라 바깥 레이아웃**이 정하기
   * 때문이다: `/places` 는 좌측 280 레일을 뺀 나머지를 쓰고, 일정에 담는 시트는 그보다
   * 훨씬 좁다. 여기서 켜 두면 좁은 사용처가 조용히 2열이 된다.
   *
   * 스켈레톤·`loadingMore` 스켈레톤도 같은 값을 받는다 — 로딩과 목록이 다른 열 수로 서면
   * 응답이 오는 순간 행이 좌우로 튄다.
   */
  columns?: 1 | 2
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
  keyword = null,
  inset = 'card',
  headingLevel = 2,
  columns = 1,
  renderRow = (place) => <PlaceRow key={place.placeId} place={place} inset={inset} />,
}: PlaceListSectionProps) {
  if (loading) {
    return (
      <SurfaceList columns={columns}>
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <PlaceRowSkeleton key={index} inset={inset} />
        ))}
      </SurfaceList>
    )
  }

  if (errorStatus !== null) {
    const kind = classify(errorStatus)

    // 404 는 데이터 부재다. 재시도 버튼을 붙이지 않고 서버 문구를 그대로 노출한다
    if (kind === 'not-found') {
      return (
        <EmptyState
          /* 네 상태가 목록과 같은 축에 선다 — 기본 `main`(40)은 카드 안에서 두 번 밀린다 (§0) */
          inset={inset}
          headingLevel={headingLevel}
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
          inset={inset}
          headingLevel={headingLevel}
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
        inset={inset}
        headingLevel={headingLevel}
        title={messages.place.errorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={onRetry}
      />
    )
  }

  if (places.length === 0) {
    return (
      <EmptyState
        inset={inset}
        headingLevel={headingLevel}
        /*
          **검색어가 걸렸으면 그 말을 되돌려 준다** (#431). 입력은 화면 위에 남아 있지만,
          결과가 비었을 때 사용자가 확인하는 것은 "내가 뭘로 찾았지" 다.

          **설명은 검색어만 탓하지 않는다** — 필터가 함께 걸려 있을 수 있어 둘 다 짚고,
          `초기화` 버튼은 그대로다 (그 버튼이 검색어까지 지운다 — `DEFAULT_PLACE_FILTERS`).
        */
        title={
          keyword === null
            ? messages.place.emptyTitle
            : messages.place.searchEmptyTitle.replace('{keyword}', keyword)
        }
        description={
          keyword === null ? messages.place.emptyDescription : messages.place.searchEmptyDescription
        }
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
      {/*
        **더 받는 중 스켈레톤을 같은 목록 안에 넣는다.** 목록을 하나 더 열어 아래에
        붙이면 새 목록의 첫 항목에는 `[&>li+li]` 가 걸리지 않아 **이어붙는 자리에만
        구분선이 빠진다.** 스켈레톤도 같은 목록의 항목이라 `li` 로 두는 것이 맞다.
      */}
      <SurfaceList columns={columns}>
        {places.map((place) => renderRow(place))}
        {loadingMore &&
          Array.from({ length: LOAD_MORE_SKELETON_COUNT }, (_, index) => (
            <PlaceRowSkeleton key={`load-more-${index}`} inset={inset} />
          ))}
      </SurfaceList>

      {hasNext ? (
        /*
          **커서 페이지네이션을 버튼으로 드러내지 않는다.** "더 보기" 는 사용자가 목록을
          계속 보고 싶다는 뜻을 이미 스크롤로 말한 뒤에 한 번 더 누르게 하는 단계였다.
          표식이 화면에 들어오면 다음 페이지를 받는다.

          받아오는 동안 **스켈레톤 행을 세운다.** 아무것도 두지 않으면 목록이 끝난 것처럼
          보이고, 스피너 하나만 두면 이어서 무엇이 올지 예고하지 못한다.
        */
        <>
          <InfiniteScrollSentinel onIntersect={onLoadMore} disabled={loadingMore} />

          {/* 스켈레톤은 보조기기에 아무 말도 하지 않는다. 진행 상황은 이 줄이 알린다 */}
          {loadingMore && (
            <p role="status" className="sr-only">
              {messages.common.loading}
            </p>
          )}
        </>
      ) : (
        <p className="text-caption text-fg-muted py-4 text-center font-medium">
          {messages.common.listEnd}
        </p>
      )}
    </div>
  )
}
