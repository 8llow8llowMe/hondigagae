'use client'

import { FilterCheck, FilterList, FilterRadio } from '@/components/filter-list'
import { labelWithCount, open24Note } from '@/features/emergency/facility-filters'
import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import { RADIUS_OPTIONS } from '@/lib/url/emergency-filters'
import { FACILITY_TYPE_CODES, type FacilityFilters } from '@/types/emergency'

/**
 * 응급 필터 축 하나하나 — **데스크톱 레일과 모바일 칩 줄이 같은 축을 공유한다.**
 *
 * `place-filter-fields.tsx` 와 같은 자리의 모듈이다. 여기 있는 것은 전부 **순수 컨트롤**로
 * `onChange` 만 부르고 조회도 URL 도 만지지 않는다 — 반영 시점을 필드가 정하면 즉시 반영하는
 * 레일과 적용 버튼을 갖는 모바일 시트 중 하나가 반드시 틀어진다.
 *
 * **개수는 밖에서 받는다.** 세는 배열이 표면마다 다르기 때문이다 — 지도 갈래는 *영역 안 ·
 * `applyFilters` 전* 배열을, 목록 갈래는 *반경 전량*을 센다 (`facilityCounts` 머리주석).
 * 필드가 스스로 세면 이 구분이 무너진다.
 */
type Counts = {
  all: number
  byType: Record<string, number>
  open24: number
  openNow: number
}

type FieldProps = {
  filters: FacilityFilters
  onChange: (next: FacilityFilters) => void
  counts: Counts
  /** `countsAreComplete` 결과. false 면 라벨에서 숫자를 뺀다 */
  showCounts: boolean
}

/** 유형 — 전체 · 동물병원 · 약국. 한 갈래만 고르므로 라디오다 */
export function TypeField({ filters, onChange, counts, showCounts }: FieldProps) {
  return (
    <FilterList label={messages.emergency.typeGroupLabel} exclusive>
      <FilterRadio
        selected={filters.type === null}
        onSelect={() => onChange({ ...filters, type: null })}
      >
        {labelWithCount(messages.emergency.typeAll, counts.all, showCounts)}
      </FilterRadio>
      {FACILITY_TYPE_CODES.map((code) => (
        <FilterRadio
          key={code}
          selected={filters.type === code}
          onSelect={() => onChange({ ...filters, type: code })}
        >
          {labelWithCount(
            messages.emergency.typeByCode[code],
            counts.byType[code] ?? 0,
            showCounts,
          )}
        </FilterRadio>
      ))}
    </FilterList>
  )
}

/**
 * 영업 조건 — **지금 진료중 · 24시간** 순서다. 함께 걸 수 있으므로 체크다.
 *
 * **순서가 뒤집혔다** (#654 E-3). 감사 실측에서 `지금 진료중` 은 이 화면의 여섯 번째
 * 컨트롤이었다 — 이 화면을 여는 사람의 과업이 *"지금 갈 수 있는 곳에 전화"* 하나인데,
 * 그 축이 가장 늦게 읽혔다. 이제 첫 축의 첫 값이고 **기본이 켜져 있다**
 * (`DEFAULT_FACILITY_FILTERS`). 레일의 축 순서도 함께 뒤집혔다 (`EmergencyFilterRail`).
 *
 * **24시간 안내 문장을 이 필드가 갖는다.** 백엔드 스키마가 화면에 알리라고 명시한 사실인데,
 * 밖에 두면 레일과 칩 줄 중 한쪽에서 빠진다 — 실제로 지도 갈래와 목록 갈래가 각자 갖고 있었다.
 * **이제 칩을 켰을 때가 아니라 늘 선다** (#654): `24시간 1` 이 "제주에 한 곳뿐" 으로
 * 읽히는 오해는 켜기 전에 이미 자리를 잡는다 (`open24Note`).
 */
export function NarrowFields({ filters, onChange, counts, showCounts }: FieldProps) {
  return (
    <>
      <FilterList label={messages.emergency.narrowGroupLabel}>
        <FilterCheck
          selected={filters.openNowOnly}
          onSelect={() => onChange({ ...filters, openNowOnly: !filters.openNowOnly })}
        >
          {labelWithCount(messages.emergency.openNow, counts.openNow, showCounts)}
        </FilterCheck>
        <FilterCheck
          selected={filters.open24Only}
          onSelect={() => onChange({ ...filters, open24Only: !filters.open24Only })}
        >
          {labelWithCount(messages.emergency.open24, counts.open24, showCounts)}
        </FilterCheck>
      </FilterList>

      <p className="text-caption text-fg-muted px-4 pb-1 break-keep">
        {open24Note(counts.open24, showCounts)}
      </p>
    </>
  )
}

/**
 * 반경 — **필터가 아니라 조회 파라미터다.**
 *
 * `FacilityFilters` 를 아예 받지 않는 것으로 그 구분을 타입에서 세운다. `초기화` 가 반경까지
 * 되돌리면 넓혀 찾던 사용자가 조건 하나를 끄려다 결과를 통째로 잃는다 —
 * `EmergencyBoardParams` 가 반경을 `filters` 밖에 두는 이유와 같다.
 *
 * **목록 갈래에는 지금까지 반경 손잡이가 없었다.** 0건 화면의 "더 넓게 찾기" 뿐이라, 결과가
 * 있는데 부족한 사용자는 넓힐 방법이 없었다. 레일이 그 구멍을 막는다.
 */
export function RadiusField({
  radius,
  onChange,
}: {
  radius: number
  onChange: (next: number) => void
}) {
  return (
    <FilterList label={messages.emergency.radiusGroupLabel} exclusive>
      {RADIUS_OPTIONS.map((option) => (
        <FilterRadio key={option} selected={radius === option} onSelect={() => onChange(option)}>
          {formatDistance(option)}
        </FilterRadio>
      ))}
    </FilterList>
  )
}
