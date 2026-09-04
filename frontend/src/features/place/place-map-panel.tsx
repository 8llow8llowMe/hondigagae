'use client'

import { PlaceRowContent } from '@/features/place/place-row'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { PlaceSummary } from '@/types/place'

/**
 * 지도 옆(데스크톱) · 시트 안(모바일)의 목록.
 *
 * 아트보드 05: **행 마크업은 모바일과 동일하다.** 즉 `PlaceRow` 는 고정폭 버전과
 * 가변폭 버전 두 가지만 유지하고, 지도 옆이든 모바일이든 같은 것을 쓴다.
 * 그래서 여기서 행 내용을 다시 만들지 않고 `PlaceRowContent` 를 가져온다.
 *
 * **행 전체가 링크가 아니라 버튼이다.** 지도 화면에서 행을 누르는 것은 "이동" 이 아니라
 * "이 핀을 고르기" 다 — 링크로 두면 지도를 잃는다. 상세로 가는 길은 제목 링크로 남긴다.
 */
export function PlaceMapPanel({
  places,
  selectedId,
  onSelect,
  className,
}: {
  places: PlaceSummary[]
  selectedId: string | null
  onSelect: (placeId: string) => void
  className?: string
}) {
  return (
    <ul className={cn('divide-border divide-y', className)}>
      {places.map((place) => {
        const selected = place.placeId === selectedId

        return (
          <li key={place.placeId}>
            <button
              type="button"
              onClick={() => onSelect(place.placeId)}
              aria-pressed={selected}
              className={cn(
                'focus-visible:ring-brand-500 @container flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
                // 선택 배경은 --row-selected 다. 판정 색(metric-*)을 쓰지 않는다 —
                // 지도 마커의 검정 채움과 짝을 이뤄 "같은 것" 을 가리킨다 (아트보드 05)
                selected ? 'bg-row-selected' : 'hover:bg-bg-sunken',
              )}
            >
              <PlaceRowContent place={place} titleHref={`/places/${place.placeId}`} />
            </button>

            {place.lat === null || place.lng === null ? (
              <p className="text-caption text-fg-subtle px-4 pb-3 font-medium">
                {messages.map.noCoordinate}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
