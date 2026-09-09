'use client'

import Link from 'next/link'

import type { ReactNode } from 'react'

import { PlaceRowContent } from '@/features/place/place-row'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { PlaceSummary } from '@/types/place'

/**
 * 지도 옆(데스크톱) · 시트 안(모바일)의 목록.
 *
 * 아트보드 05: **행 마크업은 모바일과 동일하다.** 그래서 행 내용을 다시 만들지 않고
 * `PlaceRowContent` 를 가져온다.
 *
 * **행을 누르는 것은 "이동" 이 아니라 "이 핀 고르기" 다** — 링크로 두면 지도를 잃는다.
 *
 * **상세로 가는 길은 액션 열의 링크다** (#370). 예전에는 제목을 링크로 만들었는데
 * 그 제목이 선택 `<button>` **안**에 있었다 — `<button>` 의 content model 은 대화형
 * 요소를 허용하지 않는다. 담기 버튼까지 얹으면 button 안에 a + button 이 된다.
 * 그래서 선택 버튼은 내용만 감싸고, 링크와 액션은 그 **형제**인 열로 내보냈다.
 */
export function PlaceMapPanel({
  places,
  selectedId,
  onSelect,
  renderRowAction,
  renderRowNotice,
  className,
}: {
  places: PlaceSummary[]
  selectedId: string | null
  onSelect: (placeId: string) => void
  /**
   * 액션 열에 얹을 것. 담기 화면이 `담기` 버튼 / `이미 담았어요` 를 준다.
   *
   * `?:` 가 아니라 `| undefined` 인 이유는 `exactOptionalPropertyTypes` 다 —
   * `PlaceMapView` 가 자기 optional prop 을 그대로 넘겨야 한다.
   */
  renderRowAction?: ((place: PlaceSummary) => ReactNode) | undefined
  /** 행 **아래** 전폭 줄. 담기 실패 알림이 여기 온다 — 액션 열은 w-24 라 안 들어간다 */
  renderRowNotice?: ((place: PlaceSummary) => ReactNode) | undefined
  className?: string
}) {
  return (
    <ul className={cn('divide-border divide-y', className)}>
      {places.map((place) => {
        const selected = place.placeId === selectedId

        return (
          <li
            key={place.placeId}
            className={cn(
              // 선택 배경은 --row-selected 다. 판정 색(metric-*)을 쓰지 않는다 —
              // 지도 마커의 검정 채움과 짝을 이뤄 "같은 것" 을 가리킨다 (아트보드 05)
              //
              // **행 전체(li)에 칠한다.** 선택 버튼에만 칠하면 액션 열이 빠져
              // 한 행이 두 조각으로 보인다
              selected ? 'bg-row-selected' : 'hover:bg-bg-sunken',
            )}
          >
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => onSelect(place.placeId)}
                aria-pressed={selected}
                className="focus-visible:ring-brand-500 @container flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
              >
                {/* `titleHref` 를 주지 않는다 — 이 버튼 안에 링크를 넣을 수 없다 */}
                <PlaceRowContent place={place} />
              </button>

              {/*
                **w-24 고정이고 세로로 쌓는다.** 96px 에 `상세`(44)와 `담기`(44)를 나란히
                두면 둘 다 최소 터치 영역을 못 지킨다. 세로면 88px 이라 들어간다.
                폭은 목록 화면의 `PlanAddPlaceRow` 와 같아야 두 보기의 행이 같은 축에서
                끝난다.
              */}
              <div className="flex w-24 shrink-0 flex-col items-end justify-center gap-1 py-3 pr-4">
                {/*
                  **`min-w-11` 이 없으면 44×44 를 못 지킨다** (#408). 낱말이 두 글자
                  12px 라 실측 폭이 28.8px 였다 — 세로만 `h-11` 로 잡고 가로를 비워 둔
                  탓이다. DESIGN.md §7 의 최소 터치 영역은 **44×44** 로 두 축 모두다.
                */}
                <Link
                  href={`/places/${place.placeId}`}
                  aria-label={messages.map.rowDetailLabel.replace('{title}', place.title)}
                  className="text-caption text-link hover:text-link-hover focus-visible:ring-brand-500 flex h-11 min-w-11 items-center justify-center rounded-md px-1 font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  {messages.map.rowDetail}
                </Link>

                {renderRowAction?.(place)}
              </div>
            </div>

            {place.lat === null || place.lng === null ? (
              <p className="text-caption text-fg-subtle px-4 pb-3 font-medium">
                {messages.map.noCoordinate}
              </p>
            ) : null}

            {renderRowNotice?.(place)}
          </li>
        )
      })}
    </ul>
  )
}
