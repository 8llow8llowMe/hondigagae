'use client'

import Link from 'next/link'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Surface, SurfaceList } from '@/components/surface'
import { FavoritePlaceRow } from '@/features/favorite/favorite-place-row'
import {
  FAVORITE_SKELETON_COUNT,
  FavoriteRowSkeleton,
} from '@/features/favorite/favorite-row-skeleton'
import { MAX_FAVORITE_COUNT } from '@/lib/api/favorite'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { FavoritePlaceItem } from '@/types/favorite'

export type FavoriteListSectionProps = {
  places: FavoritePlaceItem[]
  totalCount: number
  loading: boolean
  errorStatus: number | null
  unsaved: ReadonlySet<string>
  pendingId: string | null
  errors: ReadonlyMap<string, string>
  onRetry: () => void
  onToggle: (item: FavoritePlaceItem, index: number) => void
}

/**
 * **이 화면의 L1 카드다** (`DESIGN.md §0`, 이슈 #462). 제목·개수·네 상태·AI 안내가
 * 전부 이 카드 하나에 든다 — 카드 판정 3문에 다 "예" 인 묶음이 이것 하나다.
 *
 * **카드를 페이지가 아니라 여기서 그린다.** `최근 저장순 · N/100곳` 과 상한 배지가
 * 응답에서 오는데 제목과 한 덩어리여야 해서다 (일정 응급 브리핑 #461 과 같은 판단) —
 * 페이지가 카드를 그리면 개수 줄만 따로 카드 안으로 내려보내야 하고, 그러면 제목 줄과
 * 개수 줄 사이에 카드 여백이 한 번 더 낀다.
 *
 * 표시 전용이다. 조회 상태는 `FavoriteListView` 가 props 로 변환해 넘긴다.
 *
 * 상태 분기는 명세 D5 를 따른다 — 빈 목록은 `EmptyState`(재시도 없음), 5xx 는
 * `ErrorState`(재시도 있음).
 *
 * **정렬 컨트롤이 없다.** 응답이 최근 저장순 하나뿐이라 이름순·거리순을 클라이언트에서
 * 흉내 내면 100곳 중 화면에 온 만큼만 정렬돼 틀린 순서가 된다. 대신 순서가 무엇인지
 * 카드 부제에 글자로 적는다 (아트보드 01 주석).
 */
export function FavoriteListSection({
  places,
  totalCount,
  loading,
  errorStatus,
  unsaved,
  pendingId,
  errors,
  onRetry,
  onToggle,
}: FavoriteListSectionProps) {
  const limitReached = totalCount >= MAX_FAVORITE_COUNT
  const remaining = MAX_FAVORITE_COUNT - totalCount

  /**
   * **개수는 목록이 실제로 있을 때만 말한다.** 로딩 중에는 아직 모르고(0/100 은 거짓말이다),
   * 오류에는 셀 수 없으며, 0건에는 `EmptyState` 가 같은 말을 이미 한다 —
   * "0/100곳 · 100곳 더 저장할 수 있어요" 를 "아직 저장한 장소가 없어요" 위에 겹쳐 두면
   * 빈 화면에 숫자만 두 줄 는다.
   */
  const countable = !loading && errorStatus === null && places.length > 0

  return (
    <Surface
      lead
      titleId="favorite-list-heading"
      title={messages.favorite.listTitle}
      description={
        countable ? (
          <p className="text-body-2 text-fg-muted tabular-nums">
            {messages.favorite.sortFixed} ·{' '}
            {messages.favorite.countOfMax
              .replace('{count}', String(totalCount))
              .replace('{max}', String(MAX_FAVORITE_COUNT))}
          </p>
        ) : undefined
      }
      /*
        **상한을 숨기지 않고 미리 말한다** — 아트보드 01·02. 100곳에 닿아서야 저장
        버튼이 실패하는 것보다, 남은 여유를 상시 보여 주는 쪽이 싸다.
        도달했을 때는 배지 + 이유를 함께 낸다: 배지만으로는 무엇을 해야 하는지 모른다.
      */
      trailing={
        countable ? (
          limitReached ? (
            <Badge tone="neutral" size="sm">
              {messages.favorite.limitReachedBadge}
            </Badge>
          ) : (
            <p className="text-caption text-fg-muted tabular-nums">
              {messages.favorite.remaining.replace('{remaining}', String(remaining))}
            </p>
          )
        ) : undefined
      }
    >
      <FavoriteListBody
        places={places}
        loading={loading}
        errorStatus={errorStatus}
        limitReached={limitReached}
        unsaved={unsaved}
        pendingId={pendingId}
        errors={errors}
        onRetry={onRetry}
        onToggle={onToggle}
      />
    </Surface>
  )
}

/**
 * 카드 안 네 상태. **배타적으로** 렌더한다 (명세 D5).
 *
 * **인셋이 prop 이 아니다.** 이 섹션은 자기가 `Surface` 를 그리므로 정의상 항상 카드
 * 안이고, `card` 말고 다른 값이 될 수 있는 호출 경로가 없다 — `PlaceListSection` ·
 * `EmergencySection` 이 `inset` 을 받는 것은 **지도 SDK 실패 폴백**이라는 카드 밖
 * 호출자가 실제로 있어서다. 없는 사용처를 위한 prop 은 두지 않는다(#422).
 *
 * 네 상태가 **같은 축**에 서는 것은 그대로다 — 축이 갈리면 목록이 바뀌는 순간 왼쪽
 * 선이 뛴다 (#451).
 */
function FavoriteListBody({
  places,
  loading,
  errorStatus,
  limitReached,
  unsaved,
  pendingId,
  errors,
  onRetry,
  onToggle,
}: Omit<FavoriteListSectionProps, 'totalCount'> & {
  limitReached: boolean
}) {
  const inset = 'card'

  if (loading) {
    return (
      <SurfaceList columns={2} aria-busy>
        {Array.from({ length: FAVORITE_SKELETON_COUNT }, (_, index) => (
          <FavoriteRowSkeleton key={index} inset={inset} />
        ))}
      </SurfaceList>
    )
  }

  // 404 는 목록에 없다 — /favorites/places 는 항상 존재하는 컬렉션이다.
  // 남는 것은 일시 장애뿐이라 재시도를 준다.
  if (errorStatus !== null) {
    return (
      <ErrorState
        inset={inset}
        title={messages.favorite.loadFailedTitle}
        description={messages.favorite.loadFailedDescription}
        onRetry={onRetry}
      />
    )
  }

  if (places.length === 0) {
    return (
      <EmptyState
        inset={inset}
        title={messages.favorite.emptyTitle}
        description={messages.favorite.emptyDescription}
        action={
          <Link href="/places">
            <Button variant="primary">{messages.favorite.emptyAction}</Button>
          </Link>
        }
      />
    )
  }

  return (
    <>
      {limitReached && (
        <p className={cn('text-body-2 text-fg-muted pb-3', INSET_CLASS[inset])}>
          {messages.favorite.limitReachedDescription}
        </p>
      )}

      {/*
        **xl 부터 2열이다** — 아트보드 03 주석. 1440 에서 한 행이 1360까지 늘어나면 이름과
        저장 해제 버튼 사이가 눈으로 잇기 어려울 만큼 벌어진다. 2열로 접으면 행 폭이 660
        안팎이 되어 고정폭 행과 같은 밀도가 된다.

        **`columns-2` 가 아니라 grid 다.** multi-column 은 1열을 끝까지 채운 뒤 2열로
        넘어가므로 "최근 저장순" 이 좌→우가 아니라 위→아래로 읽힌다. 그리드는 DOM 순서가
        곧 읽는 순서다.

        **구분선은 행이 아니라 이 목록이 긋는다** (#439 · #462). 2a 때는 행이 `last` ·
        `lastGridRow` · `columnDivider` 세 prop 으로 스스로 그었고, 그래서 **행 수와 자기
        위치를 아는 호출자만** 목록을 그릴 수 있었다.
      */}
      <SurfaceList columns={2}>
        {places.map((item, index) => (
          <FavoritePlaceRow
            key={item.placeId}
            item={item}
            inset={inset}
            unsaved={unsaved.has(item.placeId)}
            pending={pendingId === item.placeId}
            disabled={pendingId !== null}
            error={errors.get(item.placeId) ?? null}
            index={index}
            onToggle={onToggle}
          />
        ))}
      </SurfaceList>

      {/*
        **아트보드 01 하단의 AI 안내** (#408). AI 일정 조건 입력에는
        `preferFavoritesLink: '저장한 장소 보기'` 로 이리 오는 길이 있는데, 되돌아가는
        길이 없었다 — 저장을 쌓아도 그것이 어디에 쓰이는지 이 화면이 말하지 않았다.

        **목록이 비어 있으면 내지 않는다.** `EmptyState` 갈래로 빠지므로 여기 오지
        않는다 — 후보가 없는데 "먼저 넣기" 를 권하면 빈 토글을 켜러 가게 된다.

        **카드 안 마지막 블록이라 위에 1px 선을 둔다.** 목록의 끝이 어디인지 카드
        테두리만으로는 말할 수 없다 — 긴급 목록의 출처 줄(#461)과 같은 자리다.
      */}
      <div
        className={cn(
          'border-border flex flex-col items-start gap-1 border-t py-4',
          INSET_CLASS[inset],
        )}
      >
        <p className="text-caption text-fg-muted">{messages.favorite.aiHint}</p>
        <Link
          href="/ai-plans/new"
          className="text-caption text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.favorite.aiHintAction}
        </Link>
      </div>
    </>
  )
}
