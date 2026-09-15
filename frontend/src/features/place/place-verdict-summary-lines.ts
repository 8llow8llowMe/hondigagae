import { formatCelsius } from '@/lib/format/celsius'
import { splitDay } from '@/lib/insight/congestion'
import { messages } from '@/lib/messages'
import type { PlaceCongestionResponse, WalkSafetyResponse } from '@/types/insight'
import type { PlaceDetail } from '@/types/place'

/**
 * 장소 상세 판정 요약 3줄이 **무엇을 보여줄지** 정한다 (#650 · 진단 D-1).
 *
 * 정본: `docs/features/place/장소상세-판정요약-세부명세.md` D4.
 *
 * **컴포넌트에서 뺀 이유는 분기 수다.** 줄마다 로딩 · 실패 · 값 없음(`UNKNOWN` · `null`)이
 * 따로 있어 JSX 안에 두면 테스트가 렌더 문자열에만 기댄다. 순수 함수면 분기를 직접 잰다.
 *
 * **세 판정은 따로 실패한다** (`PlaceDetailSectionProps` 주석). 한 줄이 죽어도 나머지는 선다.
 */

/** 앵커가 가리키는 섹션 id. **대상 쪽과 한 곳에서 맞춘다** — 갈 곳 없는 링크를 막는다 */
export const VERDICT_ANCHOR = {
  pet: 'place-pet-info-heading',
  walk: 'place-walk-safety-label',
  congestion: 'place-congestion-heading',
} as const

export type VerdictSummaryLine = {
  /** `동반` · `지금 산책` · `덜 붐비는 날` */
  label: string
  /** 아직 조회 중이면 null — 자리는 지키고 값만 비운다 */
  value: string | null
  /** 이동할 섹션 id. 값이 없으면(로딩) 링크로 만들지 않는다 */
  anchorId: string
}

type WalkSource = { data: WalkSafetyResponse | null; loading: boolean; failed: boolean }
type CongestionSource = { data: PlaceCongestionResponse | null; loading: boolean; failed: boolean }

/**
 * 동반 줄 — **언제나 선다.** `place` 가 없으면 이 화면 자체가 렌더되지 않는다.
 *
 * **`UNKNOWN` 을 '불가' 로 단정하지 않는다** (#530). 태그 줄은 `UNKNOWN` 배지를 감추지만
 * (옆 태그에 걸려 읽힌다) 여기서는 그것이 답 자체라 **말한다.**
 */
function petLine(place: PlaceDetail): VerdictSummaryLine {
  const label = messages.place.detailSummaryPetLabel

  if (place.petAllowanceType.code === 'UNKNOWN') {
    return { label, value: messages.place.detailSummaryPetUnknown, anchorId: VERDICT_ANCHOR.pet }
  }

  const size = place.petInfo?.allowedPetSize.name ?? null
  const value =
    size === null ? place.petAllowanceType.name : `${place.petAllowanceType.name} · ${size}`

  return { label, value, anchorId: VERDICT_ANCHOR.pet }
}

/**
 * 지금 산책 줄.
 *
 * **실패하면 줄을 만들지 않는다.** 아래 판정 카드가 이미 재시도 버튼을 갖고 있고, 죽은 줄을
 * 두면 앵커가 갈 곳 없는 링크가 된다.
 *
 * **체감온도가 `null` 이면 등급만 말한다** — `0.0℃` 로 채우면 영하 판정으로 읽힌다
 * (`PlaceWalkSafetyPanel` 이 hero 자리를 비우는 것과 같은 근거).
 */
function walkLine(walk: WalkSource): VerdictSummaryLine | null {
  const label = messages.place.detailSummaryWalkLabel

  if (walk.loading) return { label, value: null, anchorId: VERDICT_ANCHOR.walk }
  if (walk.failed || walk.data === null) return null

  const feelsLike = formatCelsius(walk.data.feelsLikeCelsius)
  const grade = walk.data.walkSafetyLevel.name
  const value =
    feelsLike === null
      ? grade
      : messages.place.detailSummaryWalkValue
          .replace('{grade}', grade)
          .replace('{feelsLike}', feelsLike)

  return { label, value, anchorId: VERDICT_ANCHOR.walk }
}

/**
 * 덜 붐비는 날 줄.
 *
 * **`leastCrowded` 가 `null` 이면 자리를 만들지 않는다** — 아는 날이 하나도 없다는 뜻이지
 * 한산하다는 뜻이 아니다 (`types/insight.ts` 주석). 혼잡도 패널과 같게 간다.
 *
 * **서버가 고른 날을 그대로 쓴다.** FE 가 최저값을 다시 고르면 같은 기간에 다른 날을
 * 추천하게 된다.
 *
 * **등급을 반드시 함께 말한다.** 기간이 전부 붐비는 주라면 **가장 덜 붐비는 날도 `혼잡`**
 * 이다 — 그때 날짜만 내면 `덜 붐비는 날 · 9월 21일 (월)` 이 추천처럼 읽힌다. 혼잡도 패널이
 * 같은 이유로 초록 면(tint)을 거절하고 등급 배지를 반드시 붙인다 (`LeastCrowded` 주석).
 */
function congestionLine(congestion: CongestionSource): VerdictSummaryLine | null {
  const label = messages.place.detailSummaryCongestionLabel

  if (congestion.loading) return { label, value: null, anchorId: VERDICT_ANCHOR.congestion }

  const least = congestion.data?.leastCrowded ?? null
  if (congestion.failed || least === null) return null

  const parts = splitDay(least.date)
  if (parts === null) return null

  const day = messages.place.detailCongestionLeastDay
    .replace('{month}', parts.month)
    .replace('{day}', parts.day)
    .replace('{weekday}', parts.weekday)

  const value = messages.place.detailSummaryCongestionValue
    .replace('{day}', day)
    .replace('{grade}', least.level.name)

  return { label, value, anchorId: VERDICT_ANCHOR.congestion }
}

/** 세 줄을 순서대로. 만들지 않기로 한 줄은 빠진다 — **동반 줄은 언제나 남는다** */
export function verdictSummaryLines(
  place: PlaceDetail,
  walk: WalkSource,
  congestion: CongestionSource,
): VerdictSummaryLine[] {
  return [petLine(place), walkLine(walk), congestionLine(congestion)].filter(
    (line): line is VerdictSummaryLine => line !== null,
  )
}
