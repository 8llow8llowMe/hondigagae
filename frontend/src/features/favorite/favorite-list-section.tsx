'use client'

import Link from 'next/link'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { RowList } from '@/components/surface'
import { FavoritePlaceRow } from '@/features/favorite/favorite-place-row'
import { MAX_FAVORITE_COUNT } from '@/lib/api/favorite'
import { messages } from '@/lib/messages'
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
 * 표시 전용. 조회 상태는 `FavoriteListView` 가 props 로 변환해 넘긴다.
 *
 * 상태 분기는 명세 D5 를 따른다 — 빈 목록은 `EmptyState`(재시도 없음), 5xx 는
 * `ErrorState`(재시도 있음).
 *
 * **정렬 컨트롤이 없다.** 응답이 최근 저장순 하나뿐이라 이름순·거리순을 클라이언트에서
 * 흉내 내면 100곳 중 화면에 온 만큼만 정렬돼 틀린 순서가 된다. 대신 순서가 무엇인지
 * 헤더에 글자로 적는다 (아트보드 01 주석).
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
  if (loading) {
    return (
      <div className="flex flex-col gap-3 px-4 md:px-10">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    )
  }

  // 404 는 목록에 없다 — /favorites/places 는 항상 존재하는 컬렉션이다.
  // 남는 것은 일시 장애뿐이라 재시도를 준다.
  if (errorStatus !== null) {
    return (
      <ErrorState
        title={messages.favorite.loadFailedTitle}
        description={messages.favorite.loadFailedDescription}
        onRetry={onRetry}
      />
    )
  }

  if (places.length === 0) {
    return (
      <EmptyState
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

  const limitReached = totalCount >= MAX_FAVORITE_COUNT
  const remaining = MAX_FAVORITE_COUNT - totalCount

  /** 2열 그리드의 마지막 시각적 행이 시작하는 인덱스. 홀수면 한 칸, 짝수면 두 칸이다 */
  const lastRowStart = places.length - (places.length % 2 === 1 ? 1 : 2)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-10">
        <p className="text-body-2 text-fg-muted tabular-nums">
          {messages.favorite.sortFixed} ·{' '}
          {messages.favorite.countOfMax
            .replace('{count}', String(totalCount))
            .replace('{max}', String(MAX_FAVORITE_COUNT))}
        </p>

        {/*
          **상한을 숨기지 않고 미리 말한다** — 아트보드 01·02. 100곳에 닿아서야 저장
          버튼이 실패하는 것보다, 남은 여유를 상시 보여 주는 쪽이 싸다.
          도달했을 때는 배지 + 이유를 함께 낸다: 배지만으로는 무엇을 해야 하는지 모른다.
        */}
        {limitReached ? (
          <Badge tone="neutral" size="sm">
            {messages.favorite.limitReachedBadge}
          </Badge>
        ) : (
          <p className="text-caption text-fg-muted tabular-nums">
            {messages.favorite.remaining.replace('{remaining}', String(remaining))}
          </p>
        )}
      </div>

      {limitReached && (
        <p className="text-body-2 text-fg-muted px-4 md:px-10">
          {messages.favorite.limitReachedDescription.replace('{max}', String(MAX_FAVORITE_COUNT))}
        </p>
      )}

      {/*
        **1200 이상에서 2열 그리드다** — 아트보드 03 주석. 1440 에서 한 행이 1360까지
        늘어나면 이름과 저장 해제 버튼 사이가 눈으로 잇기 어려울 만큼 벌어진다. 2열로
        접으면 행 폭이 660 안팎이 되어 고정폭 행과 같은 밀도가 된다.

        **`columns-2` 가 아니라 `grid` 다.** multi-column 은 1열을 끝까지 채운 뒤 2열로
        넘어가므로 "최근 저장순" 이 좌→우가 아니라 위→아래로 읽힌다. 그리드는 DOM 순서가
        곧 읽는 순서다.

        구분선이 까다롭다. `Row` 는 마지막 행에서만 `border-bottom` 을 끄는데, 2열에서는
        **마지막 시각적 행이 두 칸**이다. 그래서 `lastRowStart` 를 계산해 xl 에서만 끈다 —
        홀수 개면 한 칸, 짝수 개면 두 칸이다. `last` 는 1열(모바일)용으로 그대로 둔다.

        **열 구분선은 오른쪽에 짝이 있을 때만 긋는다.** 홀수 개의 마지막 행에서는 우측
        칸이 비는데, 그때도 그으면 아무것도 없는 공간 옆에 선만 떠 있다 (1건일 때 특히
        눈에 띈다 — 브라우저에서 확인했다).
      */}
      <RowList className="xl:grid xl:grid-cols-2">
        {places.map((item, index) => (
          <FavoritePlaceRow
            key={item.placeId}
            item={item}
            last={index === places.length - 1}
            lastGridRow={index >= lastRowStart}
            columnDivider={index % 2 === 0 && index + 1 < places.length}
            unsaved={unsaved.has(item.placeId)}
            pending={pendingId === item.placeId}
            disabled={pendingId !== null}
            error={errors.get(item.placeId) ?? null}
            index={index}
            onToggle={onToggle}
          />
        ))}
      </RowList>

      {/*
        **아트보드 01 하단의 AI 안내** (#408). AI 일정 조건 입력에는
        `preferFavoritesLink: '저장한 장소 보기'` 로 이리 오는 길이 있는데, 되돌아가는
        길이 없었다 — 저장을 쌓아도 그것이 어디에 쓰이는지 이 화면이 말하지 않았다.

        **목록이 비어 있으면 내지 않는다.** `EmptyState` 갈래로 빠지므로 여기 오지
        않는다 — 후보가 없는데 "먼저 넣기" 를 권하면 빈 토글을 켜러 가게 된다.
      */}
      <div className="flex flex-col items-start gap-1 px-4 md:px-10">
        <p className="text-caption text-fg-muted">{messages.favorite.aiHint}</p>
        <Link
          href="/ai-plans/new"
          className="text-caption text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.favorite.aiHintAction}
        </Link>
      </div>
    </div>
  )
}
