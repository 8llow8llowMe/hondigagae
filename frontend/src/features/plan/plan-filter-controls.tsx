'use client'

import type { ReactNode } from 'react'

import { Chip } from '@/components/chip'
import { FilterCheck, FilterList, FilterListHeading, FilterRadio } from '@/components/filter-list'
import { PetAvatar } from '@/components/pet-avatar'
import { messages } from '@/lib/messages'
import { describePet } from '@/lib/pet/describe'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { Pet } from '@/types/pet'
import { PLAN_STATUS_FILTERS, type PlanFilters, type PlanStatusFilter } from '@/types/plan'

/**
 * 좁히기 컨트롤 — 아트보드 04(모바일) · 05(데스크톱 레일).
 *
 * **축의 성격이 컨트롤 종류를 정한다** (아트보드 04 주석).
 *
 * | 축     | 모바일           | 데스크톱      |
 * | ------ | ---------------- | ------------- |
 * | 상태   | 전폭 4열 밑줄 탭 | 라디오 (배타) |
 * | 반려견 | 칩               | 체크박스 (다중) |
 *
 * 같은 세로 목록을 전부 `aria-pressed` 토글로 두면 **상태도 다중 선택으로 읽힌다.**
 *
 * **개수는 셀 수 있을 때만 붙는다.** `hasNext` 인 동안에는 아직 안 받아 온 것이 있어
 * 0 이 진짜 0 인지 알 수 없다 (공통명세 S3).
 */

export type PlanFilterControlsProps = {
  filters: PlanFilters
  onChange: (next: PlanFilters) => void
  pets: Pet[]
  /** `null` 이면 셀 수 없는 상태다 — 숫자를 아예 렌더하지 않는다 */
  statusCounts: Record<PlanStatusFilter, number> | null
  petCounts: Map<string, number> | null
}

/**
 * 상태 이름을 화면이 갖는 **유일한 자리**다.
 *
 * 다른 곳에서는 서버가 준 `status.name` 을 그대로 쓰지만, 필터는 아직 그 상태의 일정을
 * 하나도 못 받았을 수 있어 서버 문구를 빌려올 대상이 없다. 값은 백엔드 `PlanStatus` 의
 * `displayName` 복제본이다.
 */
const STATUS_LABELS: Record<PlanStatusFilter, string> = {
  ALL: messages.plan.statusAll,
  DRAFT: '초안',
  CONFIRMED: '확정',
  COMPLETED: '완료',
}

/** 모바일 — 전폭 균등 4열, 48px. 밑줄은 시각 표현일 뿐이고 의미는 라디오다 */
export function PlanStatusTabs({
  filters,
  onChange,
  statusCounts,
}: Pick<PlanFilterControlsProps, 'filters' | 'onChange' | 'statusCounts'>) {
  return (
    <div
      role="radiogroup"
      aria-label={messages.plan.statusGroupLabel}
      className="border-border grid grid-cols-4 border-b"
    >
      {PLAN_STATUS_FILTERS.map((status) => {
        const selected = filters.status === status
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange({ ...filters, status })}
            className={cn(
              'text-body-2 focus-visible:ring-brand-500 flex h-12 items-center justify-center gap-1 border-b-2 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
              selected
                ? 'border-brand-500 text-fg font-semibold'
                : 'text-fg-muted border-transparent font-medium',
            )}
          >
            {STATUS_LABELS[status]}
            {statusCounts !== null && <span className="tabular-nums">{statusCounts[status]}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** 모바일 — 반려견은 여러 마리를 켜는 축이라 칩이다 */
export function PlanPetChips({
  filters,
  onChange,
  pets,
}: Pick<PlanFilterControlsProps, 'filters' | 'onChange' | 'pets'>) {
  if (pets.length === 0) return null

  return (
    <div
      aria-label={messages.plan.petGroupLabel}
      /* 인셋은 카드 축이다 — 근거는 `place-filter-chips.tsx` 가 정본이다 (#457) */
      className={cn('border-border flex flex-wrap gap-1.5 border-b py-3', INSET_CLASS.card)}
    >
      {pets.map((pet) => {
        const selected = filters.petIds.includes(pet.petId)
        return (
          <Chip
            key={pet.petId}
            selected={selected}
            onSelect={() => onChange({ ...filters, petIds: togglePet(filters.petIds, pet.petId) })}
          >
            <PetAvatar name={pet.name} muted={!selected} className="-ml-1" />
            {pet.name}
          </Chip>
        )
      })}
    </div>
  )
}

/**
 * 데스크톱 좌측 레일 — **280 이다.** 홈·상세의 400 은 프로필·판정을 담는 "맥락 패널"
 * 이고 목록의 좌측은 "필터 레일" 이라 역할이 달라 폭도 다르다 (아트보드 05 주석).
 */
export function PlanFilterRail({
  filters,
  onChange,
  onReset,
  pets,
  statusCounts,
  petCounts,
}: PlanFilterControlsProps & { onReset: () => void }) {
  return (
    <div className="filter-rail flex flex-col pb-5">
      <div className="filter-rail-title flex items-baseline justify-between gap-2 px-5 pt-5 pb-3">
        <h2 className="text-body-1 text-fg font-semibold">{messages.plan.filterTitle}</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-body-2 text-brand-700 focus-visible:ring-brand-500 min-h-11 px-1 font-semibold focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
        >
          {messages.plan.filterReset}
        </button>
      </div>

      <FilterListHeading>{messages.plan.statusGroupLabel}</FilterListHeading>
      <FilterList label={messages.plan.statusGroupLabel} exclusive>
        {PLAN_STATUS_FILTERS.map((status) => (
          <FilterRadio
            key={status}
            selected={filters.status === status}
            onSelect={() => onChange({ ...filters, status })}
          >
            <CountLine label={STATUS_LABELS[status]} count={statusCounts?.[status] ?? null} />
          </FilterRadio>
        ))}
      </FilterList>

      {pets.length > 0 && (
        <>
          <div className="border-border mt-2 border-t" />
          <FilterListHeading>{messages.plan.petGroupLabel}</FilterListHeading>
          <FilterList label={messages.plan.petGroupLabel}>
            {pets.map((pet) => (
              <FilterCheck
                key={pet.petId}
                selected={filters.petIds.includes(pet.petId)}
                onSelect={() =>
                  onChange({ ...filters, petIds: togglePet(filters.petIds, pet.petId) })
                }
                description={describePet(pet) ?? undefined}
                /*
                  아트보드 05 의 반려견 행은 `min-height:52px` 다 — `FilterCheck` 기본값
                  44 보다 크다. 아바타와 두 줄을 담는 행이라서다.

                  **부제가 없는 반려견이 있어 실제로 벌어졌다.** 견종·나이가 둘 다 없으면
                  `describePet` 이 null 이라 한 줄이 되고, 옆 반려견이 64 일 때 이 행만
                  44 로 주저앉는다 (1280 실렌더). 52 를 바닥으로 깔아 격차를 줄인다.

                  **높이를 완전히 고정하지는 않는다** — 그러려면 없는 부제 자리를 비워 둬야
                  하고, 이 저장소는 없는 데이터의 자리를 만들지 않는다.
                */
                className="min-h-13"
              >
                <CountLine
                  label={pet.name}
                  count={petCounts === null ? null : (petCounts.get(pet.petId) ?? 0)}
                  leading={<PetAvatar name={pet.name} size="md" />}
                />
              </FilterCheck>
            ))}
          </FilterList>
        </>
      )}
    </div>
  )
}

/** 라벨은 왼쪽, 개수는 오른쪽 끝. **0 을 감추지 않는다** (아트보드 04 주석) */
function CountLine({
  label,
  count,
  leading,
}: {
  label: string
  count: number | null
  leading?: ReactNode
}) {
  return (
    <span className="flex items-center gap-2">
      {leading}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== null && <span className="text-fg-muted shrink-0 tabular-nums">{count}</span>}
    </span>
  )
}

function togglePet(petIds: string[], petId: string): string[] {
  return petIds.includes(petId) ? petIds.filter((id) => id !== petId) : [...petIds, petId]
}
