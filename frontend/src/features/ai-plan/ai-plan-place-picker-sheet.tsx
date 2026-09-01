'use client'

import { useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { Row, RowList } from '@/components/surface'
import { useFavoriteList } from '@/features/favorite/use-favorite-list'
import { isPinnable, MAX_PINNED_PLACES, togglePinnedPlace } from '@/lib/ai-plan/pinned'
import { toErrorStatus } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { placeMetaLine } from '@/lib/place/meta'
import type { PinnedPlace } from '@/types/ai-plan'

/**
 * 꼭 넣을 장소 고르기 — 아트보드 `혼디가개 AI 일정 생성` 05.
 *
 * **저장한 장소에서 고른다.** 아트보드가 이유를 적었다: 10곳 상한을 채우는 가장 빠른
 * 길이고, 이미 마음에 든 곳이다.
 *
 * **검색 탭을 만들지 않았다.** 아트보드는 `저장한 장소` / `검색` 두 탭을 그렸지만
 * `GET /places` 에 **이름 검색 파라미터가 없다** — 지역·타입·동반 조건 필터뿐이다
 * (`PlaceWebController` 실측). 탭이 하나면 탭 줄 자체를 두지 않되, **없는 것이 누락으로
 * 보이지 않게 한 줄로 밝힌다** (조건 폼의 지역 컨트롤과 같은 처리).
 *
 * **선택을 시트 안에서만 들고 있다.** 담기 전까지 폼을 건드리지 않아 `닫기` 로 취소할 수
 * 있다 — 아트보드의 `N곳 담기` 가 확정 지점이다.
 */
export function AiPlanPlacePickerSheet({
  open,
  onClose,
  selected,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  /** 폼이 이미 들고 있는 선택. 시트를 열 때의 출발점이다 */
  selected: PinnedPlace[]
  onConfirm: (places: PinnedPlace[]) => void
}) {
  /*
    **`open` 을 key 로 초기화한다.** 시트를 닫고 다시 열면 폼의 현재 값에서 다시
    시작해야 하는데, `useState` 는 첫 마운트의 초기값만 취한다. `BottomSheet` 는
    닫혀 있을 때도 마운트를 유지하므로 여기서 명시적으로 갈아 준다.
  */
  return open ? (
    <PickerBody key={String(open)} onClose={onClose} selected={selected} onConfirm={onConfirm} />
  ) : null
}

function PickerBody({
  onClose,
  selected,
  onConfirm,
}: {
  onClose: () => void
  selected: PinnedPlace[]
  onConfirm: (places: PinnedPlace[]) => void
}) {
  const query = useFavoriteList()
  const [draft, setDraft] = useState<PinnedPlace[]>(selected)

  const errorStatus = toErrorStatus(query.error)
  const places = query.data?.places ?? []
  const limitReached = draft.length >= MAX_PINNED_PLACES

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={messages.aiPlan.pickerTitle}
      footer={
        <Button size="lg" className="w-full" onClick={() => onConfirm(draft)}>
          {draft.length === 0
            ? messages.aiPlan.pickerConfirmEmpty
            : messages.aiPlan.pickerConfirm.replace('{count}', String(draft.length))}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 px-4 md:px-6">
          <p className="text-body-2 text-fg font-semibold">
            {messages.aiPlan.pickerFavoritesTab}
            {query.data !== undefined && (
              <span className="text-fg-muted ml-1 font-medium tabular-nums">
                {query.data.totalCount}
              </span>
            )}
          </p>
          <p className="text-caption text-fg-muted tabular-nums">
            {messages.aiPlan.pinnedCount
              .replace('{count}', String(draft.length))
              .replace('{max}', String(MAX_PINNED_PLACES))}
          </p>
        </div>

        {/* 검색 탭이 없는 것을 누락으로 보이지 않게 밝힌다 (위 JSDoc) */}
        <p className="text-caption text-fg-subtle px-4 md:px-6">
          {messages.aiPlan.pickerSearchUnavailable}
        </p>

        {query.isPending ? (
          <div className="flex flex-col gap-2 px-4 md:px-6">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : errorStatus !== null ? (
          <ErrorState
            title={messages.aiPlan.pickerLoadFailedTitle}
            description={messages.favorite.loadFailedDescription}
            onRetry={() => void query.refetch()}
          />
        ) : places.length === 0 ? (
          <EmptyState
            title={messages.aiPlan.pickerEmptyTitle}
            description={messages.aiPlan.pickerEmptyDescription}
          />
        ) : (
          <RowList>
            {places.map((item, index) => {
              const pinnable = isPinnable(item.title)
              const checked = draft.some((place) => place.placeId === item.placeId)

              return (
                <Row
                  as="li"
                  key={item.placeId}
                  last={index === places.length - 1}
                  selected={checked}
                >
                  {/*
                    라벨 전체가 터치 대상이다. 행에 링크를 두지 않는다 — 여기서 할 일은
                    고르기이고, 장소를 확인하러 나가면 고른 것이 사라진다.
                  */}
                  {/*
                    **grid 로 평평하게 둔다.** 텍스트를 `span > span` 으로 감싸면
                    `jsx-a11y/label-has-associated-control` 이 라벨의 접근 이름을 찾지
                    못한다(기본 depth 2). 체크박스가 두 줄을 세로로 걸치는 배치라
                    flex + 열 래퍼가 자연스러웠지만, 규칙을 끄는 대신 마크업을 편다.
                  */}
                  <label
                    htmlFor={`pinned-${item.placeId}`}
                    className={
                      pinnable
                        ? 'grid min-h-14 cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 py-3'
                        : 'grid min-h-14 grid-cols-[auto_1fr] items-center gap-x-3 py-3 opacity-60'
                    }
                  >
                    <input
                      type="checkbox"
                      id={`pinned-${item.placeId}`}
                      checked={checked}
                      /*
                        상한에 닿으면 **아직 고르지 않은 행만** 막는다. 고른 행은 계속
                        해제할 수 있어야 한다 — 10곳을 채운 뒤 바꿀 길이 없어진다.
                      */
                      disabled={!pinnable || (limitReached && !checked)}
                      onChange={() =>
                        setDraft((prev) =>
                          togglePinnedPlace(prev, {
                            placeId: item.placeId,
                            title: item.title ?? '',
                          }),
                        )
                      }
                      className="accent-brand-500 focus-visible:ring-brand-500 row-span-2 size-5 shrink-0 rounded focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                    />

                    <span className="text-body-2 text-fg min-w-0 truncate font-medium">
                      {pinnable ? item.title : messages.favorite.missingTitle}
                    </span>
                    <span className="text-caption text-fg-muted min-w-0 truncate">
                      {pinnable
                        ? (placeMetaLine(item.addr, item.indoor) ?? '')
                        : messages.aiPlan.pickerUnpinnable}
                    </span>
                  </label>
                </Row>
              )
            })}
          </RowList>
        )}
      </div>
    </BottomSheet>
  )
}
