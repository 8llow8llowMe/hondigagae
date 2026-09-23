'use client'

import { useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import { ChevronDownIcon } from '@/components/icons'
import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import { RADIUS_OPTIONS } from '@/lib/url/emergency-filters'

/**
 * 반경 칩 + 반경 시트 — **모바일 두 표면이 공유한다** (#537).
 *
 * `EmergencyFilterBar`(지도 갈래 툴바)에 인라인으로 있던 것을 떼어냈다. 목록 갈래의 모바일
 * 필터에도 반경 축이 올라오면서 같은 손잡이가 두 곳에 필요해졌는데, 복사하면 시트 제목 ·
 * 초안 규칙 · 적용 문구가 화면마다 갈린다 — 이 저장소가 목록/지도 분기에서 반복해서 겪은
 * 실패다 (`emergency-filter-fields.tsx` 머리주석의 24시간 안내 문장이 같은 사례다).
 *
 * **반경은 필터가 아니라 조회 파라미터다.** 그래서 이 컴포넌트는 `FacilityFilters` 를 아예
 * 받지 않는다 — `RadiusField` 가 타입으로 같은 구분을 세우는 것과 같다. `초기화` 가 반경까지
 * 되돌리면 넓혀 찾던 사용자가 조건 하나를 끄려다 결과를 통째로 잃는다.
 *
 * **초안(`draft`)을 두는 것은 시트뿐이다.** 열 때 현재 값을 복사하고 적용 전까지 조회를
 * 건드리지 않는다 — 반경은 서버 재조회라, 고르는 족족 반영하면 시트를 훑는 동안 요청이
 * 옵션 수만큼 나간다. 즉시 반영하는 데스크톱 레일(`RadiusField`)과 갈리는 지점이 여기다.
 */
export function EmergencyRadiusChip({
  radius,
  onRadiusChange,
  size,
}: {
  radius: number
  onRadiusChange: (next: number) => void
  /** 여는 칩의 높이 축 — 지도 갈래만 `sm`(모바일 36)을 준다 (#883, `Chip` 의 `size`) */
  size?: 'md' | 'sm'
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(radius)

  return (
    <>
      <Chip
        // 기본 반경이 아니면 사용자가 손댄 축이다 — tint 로 그 사실만 말한다
        selected={radius !== RADIUS_OPTIONS[0]}
        expanded={open}
        {...(size === undefined ? {} : { size })}
        onSelect={() => {
          setDraft(radius)
          setOpen(true)
        }}
        className="shrink-0"
      >
        {messages.emergency.radiusLabel.replace('{radius}', formatDistance(radius))}
        <ChevronDownIcon size={16} />
      </Chip>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={messages.emergency.radiusSheetTitle}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setOpen(false)}>
              {messages.place.filterCancel}
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-2"
              onClick={() => {
                onRadiusChange(draft)
                setOpen(false)
              }}
            >
              {messages.place.filterApply}
            </Button>
          </div>
        }
      >
        <ChipGroup
          label={messages.emergency.radiusGroupLabel}
          exclusive
          className="flex flex-wrap gap-1.5 px-4 py-3"
        >
          {RADIUS_OPTIONS.map((option) => (
            <Chip
              key={option}
              exclusive
              selected={draft === option}
              onSelect={() => setDraft(option)}
            >
              {formatDistance(option)}
            </Chip>
          ))}
        </ChipGroup>
      </BottomSheet>
    </>
  )
}
