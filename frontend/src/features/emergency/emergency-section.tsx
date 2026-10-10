import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { SurfaceList } from '@/components/surface'
import { EmergencySkeleton } from '@/features/emergency/emergency-skeleton'
import { emergencyBasisLabel } from '@/features/emergency/emergency-summary-line'
import {
  applyFilters,
  countsAreComplete,
  reliefLabel,
  reliefs,
} from '@/features/emergency/facility-filters'
import { FacilityRow } from '@/features/emergency/facility-row'
import { type EmergencyBasis, showsDistance } from '@/features/emergency/resolve-anchor'
import { formatDistance } from '@/lib/format/distance'
import type { JejuRegionCode } from '@/lib/geo/jeju-regions'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { FacilityFilters, NearbyFacilityResult } from '@/types/emergency'

export type EmergencySectionProps = {
  result: NearbyFacilityResult | null
  loading: boolean
  errorStatus: number | null
  onRetry: () => void
  filters: FacilityFilters
  onFiltersChange: (next: FacilityFilters) => void
  /**
   * 거리·정렬의 기준 (`resolve-anchor.ts`). **`jeju` 에서만 거리를 감춘다** —
   * 사용자가 고르지 않은 자리라 "480m" 가 거짓말이 된다.
   *
   * **위치 실패 안내는 여기 없다** (#639). 그것은 카드 **머리**의 `PositionFallbackHead`
   * 가 맡는다 — 목록 본문 맨 위에 얹혀 있던 예전 `PositionNotice` 는 스크롤을 내리면
   * 사라졌고, 급한 행동(위치 다시 찾기)이 화면에서 가장 낮은 위계였다. 이 섹션에 남은
   * 몫은 **기준을 말하는 것**뿐이다.
   */
  basis: EmergencyBasis
  /** `basis === 'region'` 일 때 어느 권역인가. 요약 줄 문구에만 쓴다 */
  regionCode: JejuRegionCode | null
  onWidenRadius: () => void
  /** 반경을 더 넓힐 수 있는가 (백엔드 상한 50km) */
  canWiden: boolean
  /**
   * 좌우 인셋 — **담는 곳이 정한다** (`inset.ts`, #460).
   *
   * 목록 갈래는 이 섹션을 `Surface`(L1) 안에 담으므로 기본값이 `card`(16/20)다. 지도 SDK
   * 실패 폴백은 카드 없는 페이지에 그대로 세우므로 `main`(16/40)을 넘긴다 — 페이지 값을
   * 카드 안에서 쓰면 내용이 두 번 밀리고(§0), 카드 값을 카드 밖에서 쓰면 안내 줄(40)과
   * 행(20)이 다른 세로선에 선다. 로딩·오류·0건·목록 네 상태가 전부 같은 값을 받는다 —
   * 상태가 바뀌는 순간 왼쪽 선이 뛰지 않아야 한다 (#451 이 담기 화면에서 잡은 회귀).
   */
  inset?: Inset
  /**
   * 빈·오류 상태 제목의 heading 레벨 — **담는 곳이 정한다.** `inset` 과 같은 축이다 (#456①).
   *
   * 목록 갈래는 제목 있는 `Surface` 안이라 `3` 을 받고, 지도 SDK 실패 폴백은 카드가 없어
   * 기본값 `2` 다. **`inset` 에서 유도하지 않는다** — `inset` 은 "카드 안인가" 를 묻고
   * 이쪽은 "그 카드가 `h2` 를 갖는가" 를 묻는다. 담기 화면처럼 `aria-label` 만 있는 카드는
   * 두 답이 갈린다 (`card` 인데 `2`).
   */
  headingLevel?: 2 | 3
}

/**
 * 긴급 시설 목록 — 아트보드 `혼디가개 긴급 시설` 01(모바일) · 03(상태 4종).
 *
 * props 로만 데이터를 받는 presentational 컴포넌트다 — node 환경에서 테스트하기 위해서다
 * (docs/testing-guide.md §1).
 *
 * **필터 칩은 여기 없다** (#460). 칩은 목록을 좁히는 도구라 카드 밖에 서야 하고
 * (`/places` #439 와 같은 판정), 이 섹션은 카드 **안**의 내용이다 —
 * `EmergencyFilterChips` 가 따로 있고 호출부가 카드 밖에 세운다. 이 컴포넌트가 그리는
 * 것은 기준 줄 · 목록(또는 0건 안내) · 출처, 셋이다.
 *
 * **위치 안내도 여기 없다** (#639). 예전에는 목록 맨 위에 `PositionNotice` 가 얹혀
 * 있었는데, 본문은 구르는 영역이라 스크롤을 내리면 사라졌고 "내 위치로 다시 찾기" 가
 * secondary 버튼이라 응급 화면에서 **가장 급한 행동이 가장 낮은 위계**였다 (감사 E-2).
 * 지금은 카드 머리의 `PositionFallbackHead` 가 맡는다 — 고정 영역이라 결과를 굴려도 남는다.
 *
 * **위치를 못 얻어도 목록은 남는다.** 거리 줄만 사라지고 목록과 전화는 그대로다
 * (아트보드 03 "위치 권한 없음"). 이 화면은 급할 때 여는 화면이라 위치 하나 때문에
 * 비어 버리면 안 된다.
 *
 * 지도(아트보드 02 · 04 우측)는 **이 범위가 아니다** — `emergency-map-view.tsx`.
 */
export function EmergencySection({
  result,
  loading,
  errorStatus,
  onRetry,
  filters,
  onFiltersChange,
  basis,
  regionCode,
  onWidenRadius,
  canWiden,
  inset = 'card',
  headingLevel = 2,
}: EmergencySectionProps) {
  if (loading) return <EmergencySkeleton inset={inset} />

  if (errorStatus !== null || result === null) {
    return (
      <ErrorState
        title={messages.emergency.errorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={onRetry}
        inset={inset}
        headingLevel={headingLevel}
      />
    )
  }

  const all = result.facilities
  const visible = applyFilters(all, filters)
  const showDistance = showsDistance(basis)

  return (
    <>
      {/*
        기준 줄 — 카드 제목(위치 안내가 있으면 그 아래) 바로 아래라 위 선이 없다(제목 아래
        선은 카드의 몫, `SurfaceList` 머리주석). 위치 안내와 이 줄 사이에도 선이 없다 — 2a 는
        안내에 `border-b` 를 걸었지만, 둘은 같은 화자("무엇을 기준으로 얼마나 찾았나")라 한
        머리 블록이고 선은 그 블록과 목록 사이 한 곳에만 둔다. 아래 선은 목록이 아니라 이 줄이 긋는다 — 목록의 `[&>li+li]` 는 첫 항목 위에
        선을 두지 않으므로, 기준 줄과 첫 행 사이 경계는 여기서 그려야 한다.
        세로 여백 `pt-3`/`pb-3` 은 행(`py-3`)과 같은 값이다 — 카드 제목(`pb-3`) 아래 24, 폴백의
        칩 선 아래 12 로 어디에 서도 행과 같은 리듬이다.
      */}
      <div
        className={cn(
          'border-border flex items-baseline justify-between gap-3 border-b pt-3 pb-3',
          INSET_CLASS[inset],
        )}
      >
        <p className="text-caption text-fg-muted font-semibold tabular-nums">
          {messages.emergency.sortNote.replace('{radius}', formatDistance(result.radius))}
        </p>
        {/* 네 갈래를 한 함수가 갖는다 (#639) — 지도 갈래 캡션 줄과 같은 말을 해야 한다 */}
        <p className="text-caption text-fg-muted font-medium">
          {emergencyBasisLabel(basis, regionCode)}
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyResult
          all={all}
          filters={filters}
          radius={result.radius}
          /* 잘린 목록에서 "없어요" 를 확언하지 않는다 — `searchTruncatedNote` 주석 */
          truncated={!countsAreComplete(result)}
          onFiltersChange={onFiltersChange}
          onWidenRadius={onWidenRadius}
          canWiden={canWiden}
          inset={inset}
          headingLevel={headingLevel}
        />
      ) : (
        <SurfaceList>
          {visible.map((facility) => (
            <FacilityRow
              key={facility.facilityId}
              facility={facility}
              showDistance={showDistance}
              inset={inset}
            />
          ))}
        </SurfaceList>
      )}

      {/*
        출처는 다른 화자다 — 2a 는 8px `Band` 로 갈랐다. 카드 안에서 밴드는 각진 불투명 면이
        되어 radius 12 모서리를 덮으므로(§0) 1px 선으로 바꿨다.
      */}
      <p
        className={cn(
          'text-caption text-fg-muted border-border border-t py-4 break-keep',
          INSET_CLASS[inset],
        )}
      >
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
  truncated,
  onFiltersChange,
  onWidenRadius,
  canWiden,
  inset,
  headingLevel,
}: {
  all: NearbyFacilityResult['facilities']
  filters: FacilityFilters
  radius: number
  /** `countsAreComplete` 의 반대 — 반경 안에 못 받아 온 곳이 남아 있다 */
  truncated: boolean
  onFiltersChange: (next: FacilityFilters) => void
  onWidenRadius: () => void
  canWiden: boolean
  inset: Inset
  headingLevel: 2 | 3
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
        inset={inset}
        headingLevel={headingLevel}
      />
    )
  }

  /*
    **0건 안내도 상태 제목이라 같은 레벨을 쓴다** (#456①). 예전에는 `h3` 로 박혀 있어
    지도 SDK 실패 폴백(카드 없음)에서 `h1` → `h3` 로 레벨을 건너뛰었다 — 그 갈래에는
    사이를 메울 `h2` 가 없다. 위의 `EmptyState` 갈래와 **같은 값**이어야 한다:
    둘은 같은 자리에 배타적으로 서는 같은 상태다.

    **타입 스케일은 다르다** — 이쪽이 `text-title-2`, `EmptyState` 가 `text-body-1` 이다.
    이번에 맞춘 것은 문서 개요(레벨)뿐이고 크기는 손대지 않았다. 둘을 같은 크기로 볼지는
    별개 판단이라 여기서 섞지 않는다.
  */
  const NarrowedHeading = `h${headingLevel}` as const

  /*
    **검색어가 걸려 있으면 무엇으로 찾았는지 되돌려 준다** (#584). 검색은 사용자가 친 말이
    조건이라, "조건에 맞는 곳이 없어요" 로만 끝나면 자기가 무엇을 쳤는지 입력을 다시 봐야
    한다 — `/places` 의 `searchEmptyTitle` 과 같은 판단이다 (#431).

    **검색어만 탓하지는 않는다.** 칩이 함께 걸려 있을 수 있어, 아래 완화 버튼은 검색어와
    칩을 모두 후보로 준다 (`reliefs`). 제목이 바뀌는 것은 *무엇을* 찾았는지를 말하기
    위해서지 원인을 지목하기 위해서가 아니다.
  */
  const title =
    filters.keyword === null
      ? messages.emergency.narrowedTitle
      : messages.emergency.searchNarrowedTitle.replace('{keyword}', filters.keyword)

  return (
    <div className={cn('flex flex-col items-start gap-2 py-6', INSET_CLASS[inset])}>
      <NarrowedHeading className="text-title-2 text-fg font-semibold">{title}</NarrowedHeading>

      {/*
        **검색이 걸린 채 목록이 잘렸으면 범위를 밝힌다** (#584). 칩은 같은 조건에서 이미
        숫자를 빼는데(`countsAreComplete`) 검색만 "없어요" 를 확언하면 비대칭이다.
        검색어가 없을 때는 띄우지 않는다 — 칩만으로 0건이 된 것은 받아 온 범위와 무관하다.
      */}
      {truncated && filters.keyword !== null && (
        <p className="text-body-2 text-fg-muted break-keep">
          {messages.emergency.searchTruncatedNote}
        </p>
      )}

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
