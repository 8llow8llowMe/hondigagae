'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Chip } from '@/components/chip'
import { messages } from '@/lib/messages'
import { DEFAULT_PLACE_FILTERS, toPlaceFilterQuery } from '@/lib/url/place-filters'
import type { ContentTypeCode, PetAllowanceCode, PlaceFilters } from '@/types/place'
import { CONTENT_TYPE_CODES, PET_ALLOWANCE_CODES } from '@/types/place'

/**
 * 필터 라벨.
 *
 * 목록 응답의 metadata 는 "결과에 등장한 값"만 담고 있어 필터 UI 를 채울 수 없다.
 * 따라서 이 표만 FE가 갖는다 — 카드에 표시되는 문구는 여전히 서버 `name` 을 쓴다.
 * TODO(BE): enum 목록 조회 API 가 생기면 이 표를 제거한다.
 */
const CONTENT_TYPE_LABEL: Record<ContentTypeCode, string> = {
  TOURIST_SPOT: '관광지',
  CULTURE: '문화시설',
  FESTIVAL: '축제·공연',
  COURSE: '여행코스',
  LEPORTS: '레포츠',
  LODGING: '숙박',
  SHOPPING: '쇼핑',
  RESTAURANT: '음식점',
}

const PET_ALLOWANCE_LABEL: Record<PetAllowanceCode, string> = {
  ALLOWED: '동반 가능',
  PARTIALLY_ALLOWED: '부분 동반 가능',
  NOT_ALLOWED: '동반 불가',
  UNKNOWN: '정보 없음',
}

export function PlaceFilterBar({ filters }: { filters: PlaceFilters }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function apply(next: PlaceFilters) {
    const query = toPlaceFilterQuery(next)
    // 필터 변경은 히스토리를 오염시키지 않는다 — architecture-guide.md §10
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function toggleContentType(code: ContentTypeCode) {
    apply({ ...filters, contentType: filters.contentType === code ? null : code })
  }

  function togglePetAllowance(code: PetAllowanceCode) {
    apply({ ...filters, petAllowanceType: filters.petAllowanceType === code ? null : code })
  }

  // searchParams 를 읽어 두면 뒤로가기로 돌아왔을 때 리렌더가 보장된다
  void searchParams

  return (
    <div className="flex flex-col gap-4">
      <FilterGroup label={messages.place.filterContentTypeLabel}>
        <Chip
          selected={filters.contentType === null}
          onSelect={() => apply({ ...filters, contentType: null })}
        >
          {messages.place.filterAll}
        </Chip>
        {CONTENT_TYPE_CODES.map((code) => (
          <Chip
            key={code}
            selected={filters.contentType === code}
            onSelect={() => toggleContentType(code)}
          >
            {CONTENT_TYPE_LABEL[code]}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label={messages.place.filterPetAllowanceLabel}>
        <Chip
          selected={filters.petAllowanceType === null}
          onSelect={() => apply({ ...filters, petAllowanceType: null })}
        >
          {messages.place.filterAll}
        </Chip>
        {PET_ALLOWANCE_CODES.map((code) => (
          <Chip
            key={code}
            selected={filters.petAllowanceType === code}
            onSelect={() => togglePetAllowance(code)}
          >
            {PET_ALLOWANCE_LABEL[code]}
          </Chip>
        ))}
      </FilterGroup>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label}>
      <h2 className="text-caption text-fg-subtle mb-2 font-medium">{label}</h2>
      {/* 좁은 폭에서 body 가 가로로 스크롤되지 않게 자체 컨테이너를 둔다 (styling-guide.md §4) */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{children}</div>
    </section>
  )
}

export { DEFAULT_PLACE_FILTERS }
