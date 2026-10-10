import { Chip } from '@/components/chip'
import { FilterListHeading } from '@/components/filter-list'
import { SlidersIcon } from '@/components/icons'
import { IndoorField, PetSizeField, RegionField } from '@/features/place/place-filter-fields'
import { messages } from '@/lib/messages'
import type { Pet } from '@/types/pet'
import type { PlaceFilters } from '@/types/place'

/**
 * 지도 필터 줄 맨 앞 `필터` 버튼 — 장소-지도필터-한줄-세부명세 D1-2 · D6 (#1314).
 *
 * **값을 고르는 칩이 아니라 필터 시트를 여는 버튼이다** — `Chip` `expanded`(`aria-haspopup="dialog"`, `aria-pressed`
 * 없음). 켠 색은 시트 안 축이 하나라도 걸렸을 때다: 접힌 곳에 걸린 조건은 결과만 줄이고 이유가 보이지 않는다.
 *
 * **숫자는 둥근 배지가 아니라 같은 글줄이다.** 원형은 사진 · 아바타 전용이고(`DESIGN.md` §5), 켠 칩의 `bg-band`
 * 위 `neutral` 배지는 면과 같아 사라진다. 색 + 숫자 + weight 세 갈래로 말한다.
 *
 * 접근 이름은 `필터` / `필터, 2개 적용됨` — 숫자 앞뒤의 `sr-only` 조각이 만든다. `aria-label` 로 덮지 않는다
 * (보이는 글자가 이름 안에 든다, WCAG 2.5.3).
 *
 * 훅이 없는 표현이라 node 에서 정적 렌더로 잰다 (`place-map-filter-sheet.test.ts`).
 */
export function PlaceMapFilterButton({
  count,
  expanded,
  onSelect,
}: {
  /** `mapSheetFilterCount` — 시트 안 축 중 걸린 수 */
  count: number
  expanded: boolean
  onSelect: () => void
}) {
  return (
    <Chip
      size="sm"
      selected={count > 0}
      expanded={expanded}
      onSelect={onSelect}
      className="shrink-0"
    >
      <SlidersIcon size={16} />
      {messages.place.filterTitle}
      {count > 0 && (
        <>
          <span className="sr-only">, </span>
          <span className="tabular-nums">{count}</span>
          <span className="sr-only">{messages.place.filterAppliedCountSuffix}</span>
        </>
      )}
    </Chip>
  )
}

/**
 * 필터 시트 본문 — **지역 → 실내 / 야외 → 견종 크기 제한** (#1314 D1-2 · D2-5).
 *
 * 예전 `지역` 시트와 `더보기` 시트를 그 순서대로 이어 붙인 것이다 — 조건 둘을 바꾸려고 시트를 두 번 열던 일을
 * 없앤다. 값은 호출부의 초안(`draft`)이고 확정은 시트 확정 줄이 한다(필드는 `onChange` 만 부른다).
 *
 * 첫 절(지역) 위에는 구분선이 없다. 둘째 절부터 `border-t` + 제목 — `PetSizeField` 의 `heading` 감싸개와 같은
 * 모양이다. 체구 절은 반려견이 없으면 제목째 사라진다(`PetSizeField`).
 */
export function PlaceMapFilterSheetFields({
  filters,
  onChange,
  pet,
}: {
  filters: PlaceFilters
  onChange: (next: PlaceFilters) => void
  /** 미로그인 · 0마리 · 조회 실패면 `null` — 체구 절이 없다 (D5) */
  pet: Pet | null
}) {
  return (
    <>
      <FilterListHeading>{messages.place.filterRegionLabel}</FilterListHeading>
      <RegionField filters={filters} onChange={onChange} />

      <div className="border-border border-t">
        <FilterListHeading>{messages.place.filterIndoorLabel}</FilterListHeading>
        <IndoorField filters={filters} onChange={onChange} />
      </div>

      <PetSizeField
        filters={filters}
        onChange={onChange}
        pet={pet}
        heading={messages.place.filterPetSizeLabel}
      />
    </>
  )
}
