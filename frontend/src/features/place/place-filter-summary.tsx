'use client'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { CONTENT_TYPE_LABEL, PET_ALLOWANCE_LABEL } from '@/features/place/filter-labels'
import { messages } from '@/lib/messages'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import type { PlaceFilters } from '@/types/place'

/**
 * 적용된 필터 요약.
 *
 * 375 에서는 선택된 칩이 가로 스크롤 밖으로 나가 필터가 걸린 사실 자체를 알 수 없다.
 * **필터가 걸렸을 때만** 노출해 기본 상태의 세로 공간을 낭비하지 않는다.
 *
 * 결과 건수는 표기하지 않는다 — 백엔드 `SliceResponse` 는 `{contents, hasNext}` 뿐이라
 * 전체 건수를 주지 않는다 (docs/api-integration-guide.md §4).
 */
export function PlaceFilterSummary({
  filters,
  onReset,
}: {
  filters: PlaceFilters
  onReset: () => void
}) {
  const applied: string[] = []
  if (filters.contentType !== null) applied.push(CONTENT_TYPE_LABEL[filters.contentType])
  if (filters.petAllowanceType !== null) applied.push(PET_ALLOWANCE_LABEL[filters.petAllowanceType])
  if (filters.sigunguCode !== null) applied.push(`시군구 ${filters.sigunguCode}`)
  if (filters.areaCode !== DEFAULT_PLACE_FILTERS.areaCode) applied.push(`지역 ${filters.areaCode}`)

  if (applied.length === 0) return null

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label={messages.place.activeFilterLabel}
    >
      {applied.map((label) => (
        <Badge key={label} tone="brand" size="md">
          {label}
        </Badge>
      ))}
      <Button variant="ghost" size="sm" onClick={onReset}>
        {messages.place.resetFilters}
      </Button>
    </div>
  )
}
