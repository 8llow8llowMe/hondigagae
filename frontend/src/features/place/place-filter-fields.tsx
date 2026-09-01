'use client'

import { FilterCheck, FilterList, FilterListHeading, FilterRadio } from '@/components/filter-list'
import {
  CONTENT_TYPE_LABEL,
  INDOOR_LABEL,
  SIGUNGU_CODES,
  SIGUNGU_LABEL,
} from '@/features/place/filter-labels'
import { messages } from '@/lib/messages'
import { isPetSizeCode } from '@/lib/pet/form'
import { toPlaceFilterWeight } from '@/lib/pet/weight'
import type { Pet } from '@/types/pet'
import type { ContentTypeCode, PlaceFilters } from '@/types/place'
import { CONTENT_TYPE_CODES } from '@/types/place'

/**
 * 필터 축 하나하나 — 데스크톱 레일과 모바일 시트가 **같은 필드를 공유한다.**
 *
 * 여기 있는 것은 전부 **순수 컨트롤**이다. URL 을 만지지 않고 `onChange` 만 부른다.
 * 레일은 즉시 반영하고 시트는 초안(draft)에 모았다가 적용 버튼으로 확정하기 때문에,
 * 반영 시점을 필드가 정하면 둘 중 하나가 반드시 틀어진다 (아트보드 02 절의 규칙:
 * "칩은 즉시 반영, 시트는 적용을 눌러야 반영").
 *
 * **선택지 옆 건수를 표시하지 않는다.** 아트보드는 `제주시 34` 처럼 적어 뒀지만
 * facet 집계 API 가 없다. 없는 숫자를 지어내면 필터의 신뢰가 통째로 무너진다.
 */
type FieldProps = {
  filters: PlaceFilters
  onChange: (next: PlaceFilters) => void
}

/** 반려견 동반 — 아트보드는 4갈래 축이 아니라 "동반 가능만" 한 갈래 토글이다 */
export function PetAllowanceField({ filters, onChange }: FieldProps) {
  const only = filters.petAllowanceType === 'ALLOWED'

  return (
    <FilterList label={messages.place.filterPetAllowanceLabel}>
      <FilterCheck
        selected={only}
        onSelect={() => onChange({ ...filters, petAllowanceType: only ? null : 'ALLOWED' })}
      >
        {messages.place.filterAllowedOnly}
      </FilterCheck>
    </FilterList>
  )
}

/**
 * 내 반려견 크기 제한.
 *
 * **화자를 유지한다** — "소형견만" 같은 추상 조건이 아니라 "몽실이가 들어갈 수 있는 곳만"
 * 이다 (아트보드 02 절). 판정이 반려견의 이름으로 말하는 것과 같은 원칙이다.
 *
 * 반려견이 없거나 목록 조회가 실패하면 **컨트롤 자체를 렌더하지 않는다.** 누를 수 없는
 * 체크박스를 남기면 왜 안 되는지 화면이 설명해야 한다.
 *
 * **제목도 이 컴포넌트가 그린다.** 밖에서 제목을 그리면 컨트롤이 사라졌을 때 제목만 남아
 * 빈 절이 된다 (375 실렌더에서 실제로 그렇게 나왔다).
 */
export function PetSizeField({
  filters,
  onChange,
  pet,
  heading,
}: FieldProps & {
  pet: Pet | null
  /** 있으면 위에 구분선 + 축 제목을 붙인다. 레일에서는 동반 축과 한 묶음이라 주지 않는다 */
  heading?: string
}) {
  // 서버가 아직 모르는 크기 코드를 보내면 400 이다. 모르는 값이면 컨트롤을 숨긴다
  const size = pet !== null && isPetSizeCode(pet.sizeType.code) ? pet.sizeType.code : null
  if (pet === null || size === null) return null

  const on = filters.petSizeType !== null

  /*
    **크기와 체중을 한 컨트롤이 함께 켠다.** 둘은 "내 반려견 기준으로 거른다" 는 같은
    축이고, 아트보드도 체크 하나("몽실이가 들어갈 수 있는 곳만")로 그린다. 나누면
    사용자가 두 번 켜야 하고, 하나만 켜면 판정이 반쪽이 된다.

    체중을 모르는 아이(`weightKg === null`)면 크기만 보낸다 — 그것이 아는 전부다.
  */
  const weight = toPlaceFilterWeight(pet.weightKg)

  const control = (
    <FilterList label={messages.place.filterPetSizeLabel}>
      <FilterCheck
        selected={on}
        onSelect={() =>
          onChange({
            ...filters,
            petSizeType: on ? null : size,
            petWeightKg: on ? null : weight,
          })
        }
        description={
          weight === null
            ? messages.place.filterPetSizeHint
            : messages.place.filterPetSizeWeightHint.replace('{weight}', String(pet.weightKg))
        }
      >
        {messages.place.filterPetSizeLabelFor
          .replace('{name}', pet.name)
          .replace('{size}', pet.sizeType.name)}
      </FilterCheck>
    </FilterList>
  )

  if (heading === undefined) return control

  return (
    <div className="border-border border-t pb-2">
      <FilterListHeading>{heading}</FilterListHeading>
      {control}
    </div>
  )
}

/** 지역 — 배타 축 */
export function RegionField({ filters, onChange }: FieldProps) {
  return (
    <FilterList label={messages.place.filterRegionLabel} exclusive>
      <FilterRadio
        selected={filters.sigunguCode === null}
        onSelect={() => onChange({ ...filters, sigunguCode: null })}
      >
        {messages.place.filterRegionAll}
      </FilterRadio>
      {SIGUNGU_CODES.map((code) => (
        <FilterRadio
          key={code}
          selected={filters.sigunguCode === code}
          onSelect={() => onChange({ ...filters, sigunguCode: code })}
        >
          {SIGUNGU_LABEL[code]}
        </FilterRadio>
      ))}
    </FilterList>
  )
}

/**
 * 유형 — 배타 축.
 *
 * **아트보드는 다중 선택(체크박스)이지만 라디오로 간다.** 백엔드 `contentType` 이 단일
 * `@RequestParam` 이라 여러 개를 보낼 수 없다. 체크박스로 그려 놓고 하나만 먹으면
 * 컨트롤이 거짓말을 한다 — 형태가 계약을 따라간다.
 */
export function ContentTypeField({ filters, onChange }: FieldProps) {
  return (
    <FilterList label={messages.place.filterContentTypeLabel} exclusive>
      <FilterRadio
        selected={filters.contentType === null}
        onSelect={() => onChange({ ...filters, contentType: null })}
      >
        {messages.place.filterAll}
      </FilterRadio>
      {CONTENT_TYPE_CODES.map((code: ContentTypeCode) => (
        <FilterRadio
          key={code}
          selected={filters.contentType === code}
          onSelect={() => onChange({ ...filters, contentType: code })}
        >
          {CONTENT_TYPE_LABEL[code]}
        </FilterRadio>
      ))}
    </FilterList>
  )
}

/**
 * 실내 / 야외 — 배타 축.
 *
 * 안내 문구가 필수다. `indoor` 가 `null` 인 장소는 **어느 쪽에도 잡히지 않아** 목록에서
 * 사라지는데, 그것을 말해 주지 않으면 필터가 고장 난 것처럼 보인다.
 * 아트보드는 "확인되지 않은 7곳" 처럼 건수를 적었으나 그 숫자를 구할 API 가 없어 뺀다.
 */
export function IndoorField({ filters, onChange }: FieldProps) {
  return (
    <>
      <FilterList label={messages.place.filterIndoorLabel} exclusive>
        <FilterRadio
          selected={filters.indoor === null}
          onSelect={() => onChange({ ...filters, indoor: null })}
        >
          {messages.place.filterAll}
        </FilterRadio>
        <FilterRadio
          selected={filters.indoor === true}
          onSelect={() => onChange({ ...filters, indoor: true })}
        >
          {INDOOR_LABEL.indoor}
        </FilterRadio>
        <FilterRadio
          selected={filters.indoor === false}
          onSelect={() => onChange({ ...filters, indoor: false })}
        >
          {INDOOR_LABEL.outdoor}
        </FilterRadio>
      </FilterList>

      <p className="text-caption text-fg-muted bg-band mx-4 mt-2 mb-4 rounded-md px-3 py-2.5">
        {messages.place.filterIndoorUnknownNote}
      </p>
    </>
  )
}

export { FilterListHeading }
