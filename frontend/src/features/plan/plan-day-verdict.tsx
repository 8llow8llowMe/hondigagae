'use client'

import { Badge } from '@/components/badge'
import { ErrorState } from '@/components/error-state'
import {
  METRIC_TINT_EDGE_TONE,
  METRIC_TINT_TONE,
  MetricBadge,
  MetricValue,
} from '@/components/metric'
import { ReasonList } from '@/components/reason-list'
import { type DisplayTemperature, displayTemperature } from '@/lib/insight/temperature'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import {
  MID_TERM_FORECAST_CODE,
  NO_PLACE_ITEM_REASON_CODE,
  PAST_DATE_REASON_CODE,
  type PlanDayWeatherItem,
} from '@/types/plan'

/**
 * 판정 밴드의 골격 — 색은 `METRIC_TINT_TONE` · `METRIC_TINT_EDGE_TONE` 이 얹는다 (#842).
 *
 * **인셋을 스스로 갖는다.** 담는 쪽(`plan-day-section`)이 카드 인셋을 주는 자리 안에
 * 서지만, 밴드는 그보다 좁게 들어가야 면의 좌우 경계가 보인다. 세로 `my-4` 는 헤더 ·
 * 항목 목록과 밴드를 떼어 놓는 값이고, 예전 `py-4` 가 하던 일을 대신한다.
 *
 * **불릿을 쓰지 않는다.** `ReasonList` 의 `ul` 이 `flex` 라 `list-disc` 가 조용히
 * 무시되고(`reason-list.tsx` 머리주석), 나머지 네 근거 목록이 전부 평범한 문장 스택이라
 * 일차 카드만 불릿이면 #840 이 없앤 분기가 되살아난다.
 */
const VERDICT_BAND_CLASS = 'my-4 flex flex-col gap-3 rounded-md border px-4 py-3'

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
      /*
        **인셋을 0 으로 덮는 것이 맞다** (#485 에서 확인). 담는 쪽(`plan-day-section` 의
        `<div className={INSET_CLASS.card}>`)이 이미 카드 인셋을 줘서, 여기서 `inset` 을
        주면 내용이 두 번 밀린다 — `inset` 축이 정리돼도 이 override 는 사라지지 않는다.

        `component-guide.md §3`(컴포넌트 `className` 으로 padding 을 덮지 않는다)에 걸리는
        형태이지만, `Inset` 에 `none` 을 더하면 이 한 자리 때문에 행·스켈레톤 열다섯 곳의
        `inset` prop 이 전부 "인셋 없음" 을 받을 수 있게 넓어진다. **저장소에서 이 형태는
        여기 하나뿐이다** — 늘어나면 그때 `none` 을 만든다 (#422 "미리 만들지 않는다").
      */
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
      /*
        **판정을 못 낸 날에도 밴드는 선다.** `unknown` 은 등급 색이 아니라 중립 면
        (`--band`)이라 "낮은 등급으로 칠하는" 일이 되지 않으면서, 이 자리가 그날의 판정
        영역이라는 사실은 그대로 남는다 — 갈래마다 골격이 달라지면 일자 카드를 훑을 때
        판정이 있는 날과 없는 날의 모양이 두 가지가 된다.
      */
      <div
        className={cn(VERDICT_BAND_CLASS, METRIC_TINT_TONE.unknown, METRIC_TINT_EDGE_TONE.unknown)}
      >
        <p className="text-body-2 text-fg-muted">{sentence}</p>
      </div>
    )
  }

  const tone = suitabilityTone(verdict.suitabilityLevel.code)

  return (
    /*
      **판정이 자기 영역을 갖는다** (#842). 예전에는 헤더와 같은 인셋 · 같은 바닥이라 근거
      문장이 "1일차의 설명" 인지 "첫 항목의 설명" 인지 갈리지 않았다.

      **면만 깔지 않는다** — `-500` 실선이 짝이다 (DESIGN.md §2-3 · #709). tint 는 바닥과
      밝기로 갈리지 않아(1.01~1.06:1) 면만으로는 적록색약에게 칠하지 않은 것과 같다.
    */
    <div className={cn(VERDICT_BAND_CLASS, METRIC_TINT_TONE[tone], METRIC_TINT_EDGE_TONE[tone])}>
      <div className="flex flex-wrap items-center gap-3">
        {/*
          **`surface="tint"` 다.** 같은 톤의 tint 면 위에서 기본 채움은 배경과 1.00:1 이라
          배지가 사라진다 — 면과 채움을 맞바꾼다 (`BADGE_TONE_ON_TINT`).

          **축 라벨(`axis`)은 그대로 둔다.** 좌 레일 목차와 달리 여기는 섹션 라벨이 없어,
          떼면 `보통` 이 혼잡도의 `보통` 과 구분되지 않는다 (#652).
        */}
        <MetricBadge tone={tone} surface="tint" axis="suitability">
          {verdict.suitabilityLevel.name}
        </MetricBadge>

        {/*
          **체감온도가 이 자리의 기본값이다** (#253 · 아트보드 01). 못 받은 날
          (중기예보 구간)에만 최고기온이 서고, 값을 고르는 규칙은
          `lib/insight/temperature.ts` 하나이고 장소 상세와 공유한다.

          **라벨은 고정이고 차이는 값 옆 단서가 말한다** (#732) — 아래 주석 참고.
        */}
        {/*
          **`이 날 산책 코스` 가 이 줄을 떠났다** (#842). #653 이 "읽는 순서와 탭 순서를
          맞춘다"로 도구를 판정 아래로 내렸는데 이 버튼만 여기 `ml-auto` 에 남아 액션이
          두 자리로 흩어져 있었다 — 이제 `plan-day-section` 의 액션 줄이 갖는다.
        */}
        <div className="ml-auto text-right">
          <VerdictTemperatureValue weather={verdict.weather} />
        </div>
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

      <PlanVerdictNotes petConditionApplied={petConditionApplied} basisPetName={basisPetName} />
    </div>
  )
}

/**
 * 이 판정이 **그릴 것을 갖고 있지 않은가** (#788).
 *
 * 위 컴포넌트가 `null` 을 내는 갈래를 호출부가 **렌더 전에** 묻는 자리다. 담는 쪽이
 * 카드 하나를 통째로 내주는 화면(브리핑의 `Surface`)에서는 렌더가 끝난 뒤에 알면 이미
 * 늦다 — 제목만 남은 카드가 서 있다.
 *
 * **판정을 여기서 다시 쓰지 않는다.** 무엇을 말할지는 아래 `unavailableSentence` 하나가
 * 갖고, 이 함수는 그 답이 비었는지만 본다 — 조건(`NO_PLACE_ITEM` 이면서 항목이 없는 날)을
 * 호출부에 베껴 두면 서버가 사유를 늘릴 때 둘이 갈린다.
 *
 * **조회 실패(`failed`)는 보지 않는다.** 그 갈래는 값이 아니라 상태라 호출부가 이미 알고
 * 있고, 실패한 자리에는 `ErrorState` 가 서므로 빈 카드가 되지 않는다.
 */
export function planDayVerdictIsBlank(verdict: PlanDayWeatherItem, dayHasItems: boolean): boolean {
  if (verdict.score !== null && verdict.suitabilityLevel !== null) return false

  return unavailableSentence(verdict, dayHasItems) === null
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
 * 판정 옆 큰 숫자 — 체감온도, 없으면 최고기온 (#253 · #732).
 *
 * ## 라벨은 `최고 체감온도` 로 고정이다 (#732 · 진단 665-6)
 *
 * 예전에는 **라벨이 값과 함께 바뀌었다** — 1일차 `최고 체감온도 27.5℃`, 2일차
 * `최고기온 24.0℃`. 나란한 두 일자가 다른 지표를 쓰는데 **설명이 한 줄도 없어서**, 값의
 * 차이가 아니라 화면의 오류로 읽혔다. 유일한 단서(`{source} 기준이라 대략적인 값이에요.`)는
 * 근거 문단 **맨 아래**, 값에서 가장 먼 자리에 있었다.
 *
 * 그래서 **기둥(라벨)을 고정하고 차이를 값 옆에서 말한다.** 이 자리가 무엇을 재는
 * 자리인지는 날마다 바뀌지 않는다 — 바뀌는 것은 그 날 서버가 줄 수 있는 값의 종류다.
 *
 * **그래도 최고기온을 체감온도라고 부르지는 않는다** (#253 이 못박은 것). 단서가 값 바로
 * 옆에서 `중기예보 최고기온` 이라고 말하므로, 읽는 사람이 숫자를 잘못된 이름으로 가져갈
 * 자리가 없다 — 라벨은 축의 이름이고 단서는 그 날 실제로 온 값의 이름이다.
 */
function VerdictTemperatureValue({ weather }: { weather: PlanDayWeatherItem['weather'] }) {
  const temperature = displayTemperature(weather)
  if (temperature === null) return null

  const clue = temperatureClue(weather, temperature)

  return (
    <>
      <MetricValue
        label={messages.plan.verdictFeelsLikeLabel}
        value={temperature.value.toFixed(1)}
        unit="℃"
      />
      {clue !== null && (
        // 등급이 아니라 **출처**라 `MetricBadge` 가 아니다 — 중립 배지다 (DESIGN.md §2-3)
        <Badge tone="neutral" size="sm">
          {clue}
        </Badge>
      )}
    </>
  )
}

/**
 * 큰 숫자 옆 단서 — 없으면 `null` (#732).
 *
 * **두 가지를 말한다.** ① 이 날은 예보 종류가 다르다(`forecastSourceName`, 서버 문구를
 * 그대로 쓴다) ② 그래서 선 값이 체감온도가 아니다.
 *
 * **체감온도가 선 날에는 단서가 없다** — 기본값이라 말할 차이가 없다. 반대로 예보 출처를
 * 모르는 채 최고기온만 온 날에도 `최고기온` 하나는 말한다: 라벨이 고정이라 그 날 무엇이
 * 섰는지 말할 자리가 여기뿐이다.
 */
function temperatureClue(
  weather: PlanDayWeatherItem['weather'],
  temperature: DisplayTemperature,
): string | null {
  const source =
    weather?.forecastSourceCode === MID_TERM_FORECAST_CODE ? weather.forecastSourceName : null

  if (temperature.kind === 'feelsLike') return source
  if (source === null) return messages.plan.verdictTemperatureLabel

  return messages.plan.verdictFallbackMetric.replace('{source}', source)
}

/**
 * 판정을 어떻게 읽어야 하는지 알리는 줄들.
 *
 * **예보 출처는 이제 여기 없다** (#732). `{source} 기준이라 대략적인 값이에요.` 는 근거
 * 문단 맨 아래, 그것이 설명하는 값에서 가장 먼 자리에 있었다 — 나란한 두 일자가 다른
 * 지표를 쓰는 이유를 말하는 줄인데 그 자리에서는 아무도 그 둘을 잇지 못했다. 단서는 큰
 * 숫자 바로 옆으로 올라갔다 (`temperatureClue`).
 */
function PlanVerdictNotes({
  petConditionApplied,
  basisPetName,
}: {
  petConditionApplied: boolean
  basisPetName: string | null
}) {
  if (petConditionApplied && basisPetName === null) return null

  return (
    <div className="text-caption text-fg-muted flex flex-col gap-1">
      {/*
        **기준 반려견을 맨 위에 둔다.** 아래 줄은 판정을 어떻게 읽어야 하는지의 단서인데,
        이 줄은 **누구의 판정인지**라 먼저 와야 나머지가 그 아이 이야기로 읽힌다.
      */}
      {basisPetName !== null && (
        <p>{messages.plan.verdictBasisPet.replace('{name}', basisPetName)}</p>
      )}
      {!petConditionApplied && <p>{messages.plan.verdictPetConditionMissing}</p>}
    </div>
  )
}
