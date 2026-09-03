'use client'

import { ButtonLink } from '@/components/button'
import { ErrorState } from '@/components/error-state'
import { MetricBadge, MetricValue } from '@/components/metric'
import { ReasonList } from '@/components/reason-list'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { MID_TERM_FORECAST_CODE, type PlanDayWeatherItem } from '@/types/plan'

/**
 * 한 일자의 판정 — 아트보드 01·02, 실패는 06 ③.
 *
 * **판정 실패는 섹션 단위 오류다.** 화면 전체를 덮지 않는다 — 일정 자료는 우리 DB 이고
 * 판정은 외부 예보라 한쪽이 죽어도 다른 쪽은 살아 있다 (D3).
 *
 * **`score`/`suitabilityLevel` 이 null 인 것은 "판정을 못 낸 것" 이지 "낮은 것" 이
 * 아니다.** 0점이나 회색 등급 배지로 만들지 않고 `unavailableReason` 을 **문장 그대로**
 * 쓴다 (아트보드 01 주석).
 */
export function PlanDayVerdict({
  verdict,
  petConditionApplied,
  basisPetName,
  failed,
  onRetry,
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

  return (
    <div className="flex flex-col gap-3 py-4">
      {verdict.score === null || verdict.suitabilityLevel === null ? (
        // 등급 배지를 만들지 않는다. 서버가 준 이유를 그대로 옮긴다
        <p className="text-body-2 text-fg-muted">{verdict.unavailableReason}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <MetricBadge tone={suitabilityTone(verdict.suitabilityLevel.code)}>
              {verdict.suitabilityLevel.name}
            </MetricBadge>

            {verdict.weather?.maxTemperature !== null &&
              verdict.weather?.maxTemperature !== undefined && (
                <MetricValue
                  label={messages.plan.verdictTemperatureLabel}
                  value={verdict.weather.maxTemperature.toFixed(1)}
                  unit="℃"
                />
              )}

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
        </>
      )}
    </div>
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
