'use client'

import { ButtonLink } from '@/components/button'
import { ErrorState } from '@/components/error-state'
import { MetricBadge, MetricValue } from '@/components/metric'
import { ReasonList } from '@/components/reason-list'
import { displayTemperature } from '@/lib/insight/temperature'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import {
  MID_TERM_FORECAST_CODE,
  NO_PLACE_ITEM_REASON_CODE,
  PAST_DATE_REASON_CODE,
  type PlanDayWeatherItem,
} from '@/types/plan'

/**
 * 한 일자의 판정 — 아트보드 01·02, 실패는 06 ③.
 *
 * **판정 실패는 섹션 단위 오류다.** 화면 전체를 덮지 않는다 — 일정 자료는 우리 DB 이고
 * 판정은 외부 예보라 한쪽이 죽어도 다른 쪽은 살아 있다 (D3).
 *
 * **`score`/`suitabilityLevel` 이 null 인 것은 "판정을 못 낸 것" 이지 "낮은 것" 이
 * 아니다.** 0점이나 회색 등급 배지로 만들지 않고 사유를 문장으로 말한다 (아트보드 01 주석).
 * 어떤 문장을 말할지는 `unavailableSentence` 가 사유 코드로 가른다 (#497).
 */
export function PlanDayVerdict({
  verdict,
  petConditionApplied,
  basisPetName,
  failed,
  onRetry,
  dayHasItems,
}: {
  /** 아직 안 왔으면 `undefined` */
  verdict: PlanDayWeatherItem | undefined
  /** `false` 면 반려견 특성 없이 일반 조건으로 판정한 결과다 */
  petConditionApplied: boolean
  /**
   * 이 일자 판정의 기준 반려견 이름 (#176). **한 마리 일정이면 `null`** 이고 그때는
   * 줄을 내지 않는다 — `basisPetNameOf()` 가 그 판정을 갖는다.
   */
  basisPetName: string | null
  /** 판정 조회가 5xx 로 실패했다 */
  failed: boolean
  onRetry: () => void
  /**
   * 그날 일정에 항목이 하나라도 있는가 (#497). **`NO_PLACE_ITEM` 을 감출지 가르는 데만
   * 쓴다** — 항목이 없는 날은 아래 빈 일차 안내가 같은 말을 이미 하기 때문이다.
   */
  dayHasItems: boolean
}) {
  if (failed) {
    return (
      <ErrorState
        title={messages.plan.verdictErrorTitle}
        onRetry={onRetry}
        className="px-0 py-6 md:px-0"
      />
    )
  }

  if (verdict === undefined) return null

  if (verdict.score === null || verdict.suitabilityLevel === null) {
    // 등급 배지를 만들지 않는다. 무엇을 말할지는 사유 코드가 정한다
    const sentence = unavailableSentence(verdict, dayHasItems)

    // **말할 것이 없으면 자리도 만들지 않는다** — 빈 여백만 남는다
    if (sentence === null) return null

    return (
      <div className="flex flex-col gap-3 py-4">
        <p className="text-body-2 text-fg-muted">{sentence}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <MetricBadge tone={suitabilityTone(verdict.suitabilityLevel.code)}>
          {verdict.suitabilityLevel.name}
        </MetricBadge>

        {/*
          **체감온도가 이 자리의 기본값이다** (#253 · 아트보드 01). 못 받은 날
          (중기예보 구간)에만 최고기온이 서고, 그때는 라벨이 함께 바뀐다 —
          고르는 규칙은 `lib/insight/temperature.ts` 하나이고 장소 상세와 공유한다.
        */}
        <VerdictTemperatureValue weather={verdict.weather} />

        {verdict.representativePlaceId !== null && (
          // 산책 위험도는 장소 상세가 소유한다. 기준 장소가 없으면 부를 대상이 없다
          <ButtonLink
            href={`/places/${verdict.representativePlaceId}`}
            variant="secondary"
            size="sm"
            className="ml-auto"
          >
            {messages.plan.walkAction}
          </ButtonLink>
        )}
      </div>

      {/*
        서버 순서를 유지한다 — `reasons` 는 점수 영향이 큰 순서로 온다.
        정보성(`scoreDelta === 0`)만 한 단계 흐리게 내린다. **장소 적합도 패널과 같은
        처리다** (`place-suitability-panel.tsx`) — 같은 모양의 근거를 두 화면이 다르게
        보여 주고 있었다 (#148).
      */}
      <ReasonList
        reasons={verdict.reasons.map((reason) => ({
          description: reason.description,
          informational: reason.scoreDelta === 0,
        }))}
      />

      <PlanVerdictNotes
        verdict={verdict}
        petConditionApplied={petConditionApplied}
        basisPetName={basisPetName}
      />
    </div>
  )
}

/**
 * 판정을 못 낸 날에 무엇을 말할 것인가 — **사유 코드로 가른다** (#497).
 *
 * 서버 문장을 늘 그대로 그리면 빈 일차에서 아래 `이 날은 아직 담은 곳이 없어요.` 와 **같은
 * 사실을 두 번** 말하고, 서버는 합쇼체라 한 화면 안에서 말투까지 갈린다.
 *
 * **가르는 기준은 "그 사실을 누가 아는가" 다.** 코드만으로 화면이 다 아는 사실은 화면이
 * 자기 말투로 말하고, 문장에 서버만 아는 값이 들어 있으면 서버 문장을 쓴다.
 *
 * `null` 이면 이 자리에 아무것도 그리지 않는다.
 */
function unavailableSentence(verdict: PlanDayWeatherItem, dayHasItems: boolean): string | null {
  switch (verdict.unavailableReasonCode) {
    case NO_PLACE_ITEM_REASON_CODE:
      /*
        **항목이 하나도 없을 때만 감춘다.** 그때만 빈 일차 안내가 같은 말을 이미 한다.

        산책 항목만 있는 날은 `NO_PLACE_ITEM` 이면서 항목이 있어 그 안내가 나지 않는다
        (`WALK` 의 `targetId` 는 장소가 아니라 판정 기준이 못 된다). 거기서도 감추면
        **판정이 왜 없는지 아무도 말하지 않게 된다.**
      */
      return dayHasItems ? verdict.unavailableReason : null

    case PAST_DATE_REASON_CODE:
      // 지난 날이라는 사실은 코드가 다 말해 준다 — 화면 말투로 옮긴다
      return messages.plan.verdictPastDate

    default:
      /*
        **모르는 코드까지 여기로 온다.** `BEYOND_FORECAST_RANGE` 의 문장에는 예보 범위(11일)가
        들어 있는데 그것은 서버 상수라 화면이 베껴 두면 갈리고, `LOOKUP_FAILED` 는 넷 중
        **유일한 장애**라 감추면 아무도 못 알아챈다. 서버가 사유를 늘려도 이 갈래가 받는다.
      */
      return verdict.unavailableReason
  }
}

/**
 * 판정 옆 큰 숫자 — 체감온도, 없으면 최고기온 (#253).
 *
 * **라벨이 값과 함께 바뀐다.** 둘 다 ℃ 라 라벨이 고정이면 중기예보 구간에서 최고기온을
 * `체감온도` 라고 부르게 되고, 그것은 판정의 근거를 잘못 알려 주는 것이다.
 */
function VerdictTemperatureValue({ weather }: { weather: PlanDayWeatherItem['weather'] }) {
  const temperature = displayTemperature(weather)
  if (temperature === null) return null

  return (
    <MetricValue
      label={
        temperature.kind === 'feelsLike'
          ? messages.plan.verdictFeelsLikeLabel
          : messages.plan.verdictTemperatureLabel
      }
      value={temperature.value.toFixed(1)}
      unit="℃"
    />
  )
}

/**
 * 판정을 어떻게 읽어야 하는지 알리는 줄들.
 *
 * **정밀도 차이를 감추지 않는다.** 중기예보 구간은 서버 스키마가 스스로 "대략적인 값"
 * 이라고 적어 뒀다 — 그 사실을 화면이 삼키면 사용자는 단기예보와 같은 신뢰로 읽는다.
 */
function PlanVerdictNotes({
  verdict,
  petConditionApplied,
  basisPetName,
}: {
  verdict: PlanDayWeatherItem
  petConditionApplied: boolean
  basisPetName: string | null
}) {
  const midTerm =
    verdict.weather?.forecastSourceCode === MID_TERM_FORECAST_CODE &&
    verdict.weather.forecastSourceName !== null

  if (!midTerm && petConditionApplied && basisPetName === null) return null

  return (
    <div className="text-caption text-fg-muted flex flex-col gap-1">
      {/*
        **기준 반려견을 맨 위에 둔다.** 아래 두 줄은 판정을 어떻게 읽어야 하는지의 단서인데,
        이 줄은 **누구의 판정인지**라 먼저 와야 나머지가 그 아이 이야기로 읽힌다.
      */}
      {basisPetName !== null && (
        <p>{messages.plan.verdictBasisPet.replace('{name}', basisPetName)}</p>
      )}
      {midTerm && (
        <p>
          {messages.plan.verdictMidTermSource.replace(
            '{source}',
            verdict.weather?.forecastSourceName ?? '',
          )}
        </p>
      )}
      {!petConditionApplied && <p>{messages.plan.verdictPetConditionMissing}</p>}
    </div>
  )
}
