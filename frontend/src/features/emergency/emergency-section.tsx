import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Band, RowList } from '@/components/surface'
import { EmergencySkeleton } from '@/features/emergency/emergency-skeleton'
import {
  applyFilters,
  countsAreComplete,
  facilityCounts,
  type FilterRelief,
  reliefs,
} from '@/features/emergency/facility-filters'
import { FacilityRow } from '@/features/emergency/facility-row'
import { formatDistance } from '@/lib/format/distance'
import type { PositionFailure } from '@/lib/geo/current-position'
import { messages } from '@/lib/messages'
import {
  FACILITY_TYPE_CODES,
  type FacilityFilters,
  type FacilityTypeCode,
  type NearbyFacilityResult,
} from '@/types/emergency'

export type EmergencySectionProps = {
  result: NearbyFacilityResult | null
  loading: boolean
  errorStatus: number | null
  onRetry: () => void
  filters: FacilityFilters
  onFiltersChange: (next: FacilityFilters) => void
  /** null 이면 현재 위치를 쓰고 있다. 값이 있으면 제주 중심 폴백이다 */
  positionFallback: PositionFailure | null
  onRetryPosition: () => void
  onWidenRadius: () => void
  /** 반경을 더 넓힐 수 있는가 (백엔드 상한 50km) */
  canWiden: boolean
}

/**
 * 긴급 시설 목록 — 아트보드 `혼디가개 긴급 시설` 01(모바일) · 03(상태 4종).
 *
 * props 로만 데이터를 받는 presentational 컴포넌트다 — node 환경에서 테스트하기 위해서다
 * (docs/testing-guide.md §1).
 *
 * **위치를 못 얻어도 목록은 남는다.** 거리 줄만 사라지고 목록과 전화는 그대로다
 * (아트보드 03 "위치 권한 없음"). 이 화면은 급할 때 여는 화면이라 위치 하나 때문에
 * 비어 버리면 안 된다.
 *
 * 지도(아트보드 02 · 04 우측)는 **이 범위가 아니다** — 이슈 #14(카카오 키 대기).
 */
export function EmergencySection({
  result,
  loading,
  errorStatus,
  onRetry,
  filters,
  onFiltersChange,
  positionFallback,
  onRetryPosition,
  onWidenRadius,
  canWiden,
}: EmergencySectionProps) {
  if (loading) return <EmergencySkeleton />

  if (errorStatus !== null || result === null) {
    return (
      <ErrorState
        title={messages.emergency.errorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={onRetry}
      />
    )
  }

  const all = result.facilities
  const visible = applyFilters(all, filters)
  const counts = facilityCounts(all)
  // 잘린 목록에서 센 개수는 전체가 아니다 — 틀린 개수는 없는 개수보다 나쁘다
  const showCounts = countsAreComplete(result)
  const showDistance = positionFallback === null

  return (
    <>
      {positionFallback !== null && (
        <PositionNotice reason={positionFallback} onRetry={onRetryPosition} />
      )}

      <div className="flex flex-col gap-2 px-4 pt-3 md:px-10">
        <ChipGroup label={messages.emergency.typeGroupLabel} exclusive>
          <Chip
            exclusive
            selected={filters.type === null}
            onSelect={() => onFiltersChange({ ...filters, type: null })}
          >
            {withCount(messages.emergency.typeAll, counts.all, showCounts)}
          </Chip>
          {FACILITY_TYPE_CODES.map((code) => (
            <Chip
              key={code}
              exclusive
              selected={filters.type === code}
              onSelect={() => onFiltersChange({ ...filters, type: code })}
            >
              {withCount(typeLabel(all, code), counts.byType[code], showCounts)}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label={messages.emergency.narrowGroupLabel}>
          <Chip
            selected={filters.open24Only}
            onSelect={() => onFiltersChange({ ...filters, open24Only: !filters.open24Only })}
          >
            {withCount(messages.emergency.open24, counts.open24, showCounts)}
          </Chip>
          <Chip
            selected={filters.openNowOnly}
            onSelect={() => onFiltersChange({ ...filters, openNowOnly: !filters.openNowOnly })}
          >
            {withCount(messages.emergency.openNow, counts.openNow, showCounts)}
          </Chip>
        </ChipGroup>

        {/* 백엔드 스키마가 화면에 알리라고 명시한 사실이다 */}
        {filters.open24Only && (
          <p className="text-caption text-fg-muted break-keep">{messages.emergency.open24Note}</p>
        )}
      </div>

      <div className="border-border mt-3 flex items-baseline justify-between gap-3 border-t px-4 pt-3 pb-2 md:px-10">
        <p className="text-caption text-fg-muted font-semibold tabular-nums">
          {messages.emergency.sortNote.replace('{radius}', formatDistance(result.radius))}
        </p>
        <p className="text-caption text-fg-muted font-medium">
          {showDistance ? messages.emergency.basisCurrent : messages.emergency.basisJeju}
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyResult
          all={all}
          filters={filters}
          radius={result.radius}
          onFiltersChange={onFiltersChange}
          onWidenRadius={onWidenRadius}
          canWiden={canWiden}
        />
      ) : (
        <RowList>
          {visible.map((facility, index) => (
            <FacilityRow
              key={facility.facilityId}
              facility={facility}
              showDistance={showDistance}
              last={index === visible.length - 1}
            />
          ))}
        </RowList>
      )}

      <Band />
      <p className="text-caption text-fg-muted px-4 py-4 break-keep md:px-10">
        {messages.emergency.source.replace('{provider}', result.providerName)}
      </p>
    </>
  )
}

/**
 * 0건 — 아트보드 03 "결과 없음".
 *
 * **"조건을 바꿔 보세요" 로 끝내지 않는다.** 무엇을 끄면 몇 개가 되는지 실제로 세어
 * 버튼으로 준다. 조건을 아무것도 켜지 않았는데 0건이면 반경 문제다 — 다른 안내다.
 */
function EmptyResult({
  all,
  filters,
  radius,
  onFiltersChange,
  onWidenRadius,
  canWiden,
}: {
  all: NearbyFacilityResult['facilities']
  filters: FacilityFilters
  radius: number
  onFiltersChange: (next: FacilityFilters) => void
  onWidenRadius: () => void
  canWiden: boolean
}) {
  const options = reliefs(all, filters)

  // 조건을 켜지 않았는데도 0건이면 반경 안에 아무것도 없는 것이다
  if (options.length === 0) {
    return (
      <EmptyState
        title={messages.emergency.emptyTitle}
        description={messages.emergency.emptyDescription.replace(
          '{radius}',
          formatDistance(radius),
        )}
        action={
          canWiden ? (
            <Button variant="secondary" onClick={onWidenRadius}>
              {messages.emergency.widenRadius}
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="flex flex-col items-start gap-2.5 px-4 py-6 md:px-10">
      <h3 className="text-title-2 text-fg font-semibold">{messages.emergency.narrowedTitle}</h3>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.kind}
            variant="secondary"
            onClick={() => onFiltersChange(option.next)}
          >
            {reliefLabel(option)}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** 위치를 못 얻었을 때. **목록 위에 얹고 목록을 지우지 않는다** */
function PositionNotice({ reason, onRetry }: { reason: PositionFailure; onRetry: () => void }) {
  const text =
    reason === 'denied'
      ? messages.emergency.positionDenied
      : reason === 'unsupported'
        ? messages.emergency.positionUnsupported
        : messages.emergency.positionTimeout

  return (
    <div className="border-border flex flex-col items-start gap-2 border-b px-4 py-3.5 md:px-10">
      <p className="text-body-2 text-fg break-keep">{text}</p>
      {/*
        미지원 브라우저에는 다시 시도할 것이 없다.

        44px 를 지킨다 — 아트보드도 `min-height:44px` 다. 급할 때 누르는 버튼이라
        작게 두면 안 된다 (DESIGN.md §7).
      */}
      {reason !== 'unsupported' && (
        <Button variant="secondary" onClick={onRetry}>
          {messages.emergency.retryPosition}
        </Button>
      )}
    </div>
  )
}

/** 서버 `name` 을 그대로 쓴다. 목록에 그 유형이 없으면 code 로 떨어진다 */
function typeLabel(facilities: NearbyFacilityResult['facilities'], code: FacilityTypeCode): string {
  return facilities.find((f) => f.facilityType.code === code)?.facilityType.name ?? code
}

/** 개수를 붙일 수 있을 때만 붙인다 */
function withCount(label: string, count: number, show: boolean): string {
  return show ? `${label} ${count}` : label
}

function reliefLabel(option: FilterRelief): string {
  const template =
    option.kind === 'openNowOnly'
      ? messages.emergency.reliefOpenNow
      : option.kind === 'open24Only'
        ? messages.emergency.reliefOpen24
        : messages.emergency.reliefType

  return template.replace('{n}', String(option.count))
}
