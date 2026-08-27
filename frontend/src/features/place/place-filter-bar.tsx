'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Chip } from '@/components/chip'
import { CONTENT_TYPE_LABEL, PET_ALLOWANCE_LABEL } from '@/features/place/filter-labels'
import { PlaceFilterSummary } from '@/features/place/place-filter-summary'
import { messages } from '@/lib/messages'
import { centerScrollLeft, type ScrollFade, scrollFadeSide } from '@/lib/ui/scroll'
import { DEFAULT_PLACE_FILTERS, toPlaceFilterQuery } from '@/lib/url/place-filters'
import { cn } from '@/lib/utils/cn'
import type { ContentTypeCode, PetAllowanceCode, PlaceFilters } from '@/types/place'
import { CONTENT_TYPE_CODES, PET_ALLOWANCE_CODES } from '@/types/place'

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

  function reset() {
    router.replace(pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 375 에서 선택 칩이 스크롤 밖으로 나가 필터 적용 사실을 알 수 없다.
          필터가 걸렸을 때만 노출해 기본 상태의 세로 공간을 낭비하지 않는다. */}
      <PlaceFilterSummary filters={filters} onReset={reset} />

      <FilterGroup
        label={messages.place.filterContentTypeLabel}
        hasSelection={filters.contentType !== null}
      >
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

      <FilterGroup
        label={messages.place.filterPetAllowanceLabel}
        hasSelection={filters.petAllowanceType !== null}
      >
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

const FADE_CLASS: Record<ScrollFade, string> = {
  none: '',
  left: 'scroll-fade-left',
  right: 'scroll-fade-right',
  both: 'scroll-fade-both',
}

function FilterGroup({
  label,
  hasSelection,
  children,
}: {
  label: string
  /** 선택된 칩이 있으면 마운트·변경 시 화면 안으로 스크롤한다 */
  hasSelection: boolean
  children: React.ReactNode
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState<ScrollFade>('none')

  const syncFade = useCallback(() => {
    const row = rowRef.current
    if (row === null) return

    setFade(
      scrollFadeSide({
        scrollLeft: row.scrollLeft,
        containerWidth: row.clientWidth,
        scrollWidth: row.scrollWidth,
      }),
    )
  }, [])

  useEffect(() => {
    const row = rowRef.current
    if (row === null) return

    // 375 에서는 선택 칩이 가로 스크롤 밖(예: offsetLeft 646px)에 있어 보이지 않는다.
    // 필터가 걸린 사실 자체를 알 수 없으므로 가운데로 끌어온다.
    const selected = row.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (selected === null) return

    // scrollIntoView 는 페이지까지 함께 움직이고 실제로 동작하지 않는 경우가 있었다.
    // 컨테이너의 scrollLeft 만 직접 옮긴다 (src/lib/ui/scroll.ts).
    row.scrollLeft = centerScrollLeft({
      containerWidth: row.clientWidth,
      scrollWidth: row.scrollWidth,
      itemOffsetLeft: selected.offsetLeft,
      itemWidth: selected.clientWidth,
    })
  }, [hasSelection])

  // fade 방향 동기화 — 마운트·스크롤·리사이즈. 스크롤 여지가 있는 쪽에만 준다
  useEffect(() => {
    const row = rowRef.current
    if (row === null) return

    syncFade()

    const observer = new ResizeObserver(syncFade)
    observer.observe(row)
    row.addEventListener('scroll', syncFade, { passive: true })

    return () => {
      observer.disconnect()
      row.removeEventListener('scroll', syncFade)
    }
  }, [syncFade, hasSelection])

  return (
    <section aria-label={label}>
      <h2 className="text-caption text-fg-muted mb-2 font-medium">{label}</h2>
      {/* 좁은 폭에서 body 가 가로로 스크롤되지 않게 자체 컨테이너를 둔다 (styling-guide.md §4).
          overflow-x-auto 는 overflow-y 도 auto 로 만들어 칩의 focus ring 위쪽 4px 을 잘라낸다.
          py-1 로 여유를 주고 -my-1 로 주변 레이아웃은 그대로 유지한다.
          md 이상에서는 flex-wrap 으로 접어 가로 스크롤 자체를 없앤다 (768 에서 11px 만 넘친다). */}
      <div
        ref={rowRef}
        className={cn(
          '-mx-4 -my-1 flex scrollbar-none gap-2 overflow-x-auto px-4 py-1',
          'md:mx-0 md:flex-wrap md:overflow-x-visible md:mask-none md:px-0',
          FADE_CLASS[fade],
        )}
      >
        {children}
      </div>
    </section>
  )
}

export { DEFAULT_PLACE_FILTERS }
