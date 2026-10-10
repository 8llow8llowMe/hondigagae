'use client'

import { useEffect, useRef } from 'react'

import { CallButton, DirectionsLink, FacilityRowContent } from '@/features/emergency/facility-row'
import { toLatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { NearbyFacilityItem } from '@/types/emergency'

/**
 * 지도 옆(데스크톱 패널) · 시트 안(모바일)의 목록.
 *
 * **`Row`(components/surface.tsx)를 쓰지 않는다.** `Row` 의 좌우 여백이
 * `px-4 md:px-10` 인데 `md:` 는 **뷰포트** 기준이라, 1280 데스크톱의 400px 패널
 * 안에서도 40px 씩 먹어 내용 폭이 320 으로 줄어든다. `PlaceMapPanel` 이 같은 이유로
 * 평평한 `px-4` 를 쓴다.
 *
 * **행 전체가 버튼이 아니다.** 내용만 버튼이고 전화·길찾기 링크는 그 **형제**다 —
 * `<a>` 를 `<button>` 안에 넣을 수 없다 (`facility-row.tsx` 머리주석).
 *
 * **행 전체가 링크도 아니다.** 지도 화면에서 행을 누르는 것은 "이동" 이 아니라
 * "이 핀을 고르기" 다. 시설 상세 라우트도 없다 (이슈 #148).
 */
export function EmergencyMapPanel({
  facilities,
  selectedId,
  onSelect,
  showDistance,
  className,
}: {
  /** **이미 영역·필터가 적용된 배열이다.** 여기서 다시 좁히지 않는다 */
  facilities: NearbyFacilityItem[]
  selectedId: string | null
  onSelect: (facilityId: string) => void
  showDistance: boolean
  className?: string
}) {
  /*
    고른 행을 보이는 곳으로 끌어온다.

    **`behavior` 를 주지 않는다.** 기본값 `'auto'` 는 CSS `scroll-behavior` 를 따르므로
    `prefers-reduced-motion` 규칙(app/globals.css)이 그대로 먹는다 — `'smooth'` 를 박으면
    그 규칙을 우회해 어지럼을 줄여야 하는 사용자에게도 애니메이션이 나간다.

    `block: 'nearest'` 다. `'center'` 로 두면 이미 보이는 행을 눌러도 목록이 움직여
    사용자가 읽던 자리를 잃는다.
  */
  const selectedRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (selectedId === null) return
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  return (
    <ul className={cn('divide-border divide-y', className)}>
      {facilities.map((entry) => {
        const selected = entry.facilityId === selectedId

        return (
          <li
            key={entry.facilityId}
            ref={selected ? selectedRef : null}
            /* 선택 배경을 li 에 걸어 길찾기 줄까지 함께 물든다 — 선택된 것이 어디서
               어디까지인지가 한 덩어리로 읽혀야 한다 */
            className={selected ? 'bg-row-selected' : ''}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => onSelect(entry.facilityId)}
                aria-pressed={selected}
                className={cn(
                  'focus-visible:ring-brand-500 flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left',
                  'focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
                )}
              >
                <FacilityRowContent facility={entry} showDistance={showDistance} />
              </button>

              {/* 버튼의 형제다. 선택 여부와 무관하게 항상 있다 */}
              <CallButton name={entry.name} tel={entry.tel} />
            </div>

            {/* 선택된 행에만. 전화 옆이 아니라 아래 전폭이라 오조작이 적다 */}
            {selected && (
              <div className="px-4 pb-3">
                <DirectionsLink facility={entry} />
              </div>
            )}

            {toLatLng(entry) === null && (
              <p className="text-caption text-fg-subtle px-4 pb-3 font-medium">
                {messages.map.noCoordinate}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
