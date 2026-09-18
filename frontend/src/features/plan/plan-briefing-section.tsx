import Link from 'next/link'

import { BackLink } from '@/components/back-link'
import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { METRIC_WORD_TONE } from '@/components/metric'
import { Surface } from '@/components/surface'
import { WalkTimesCurve } from '@/components/walk-times-curve'
import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { PlanDayVerdict } from '@/features/plan/plan-day-verdict'
import { walkSafetyTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { HourlyWalkSafetyItem } from '@/types/insight'
import type {
  PlanBriefingItemSummary,
  PlanBriefingResponse,
  PlanBriefingSchedule,
  PlanBriefingWalkTimes,
  PlanBriefingWeatherWarning,
} from '@/types/plan'

/**
 * 곡선 자리가 알아야 하는 것 — **창·상태는 여기 없다** (#626 명세 D3-3).
 *
 * 창(`goldenStart`/`goldenEnd`)과 상태(`goldenWindowStatus`)의 정본은 **브리핑 응답**이다.
 * 곡선 조회 응답에서는 `hourly` 하나만 가져온다 — 두 값이 갈리는 경우(자정 경계 · 조건
 * 차이)에 화면이 두 답을 동시에 말하지 않는다.
 */
export type PlanBriefingCurve = {
  /** 조회를 하지 않았거나 아직 안 온 동안은 `null` */
  hourly: readonly HourlyWalkSafetyItem[] | null
  /** 5xx·무응답 */
  failed: boolean
  onRetry: () => void
}

/**
 * 페이지 머리 — 돌아가기 · `h1` · 부제. **카드가 아니다** (§0 의 페이지 머리 예외).
 *
 * 인셋은 카드 안 글줄과 같은 `card` 다 — 아래 카드의 첫 글자와 세로선이 맞아야 한다
 * (`plan-emergency-section.tsx` 의 같은 머리와 문자 그대로 같은 처리다).
 *
 * **`h1` 은 로딩·오류·기간 밖 갈래에도 있다** — 없으면 문서 최상위 제목이 상태 문구의
 * `h2` 가 된다. 그래서 부제(`subtitle`)만 `null` 을 허용하고 머리 자체는 늘 선다.
 */
export function PlanBriefingHeader({
  planId,
  subtitle,
}: {
  planId: string
  /** 응답이 와야 쓸 수 있다 — `null` 이면 그 줄을 비운다 */
  subtitle: string | null
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start gap-x-1 pt-4 pb-4 md:block md:pt-0 md:pb-0',
        INSET_CLASS.card,
      )}
    >
      <BackLink href={`/plans/${planId}`} label={messages.plan.briefingBack} variant="titleRow" />

      {/* 제목과 부제가 한 덩어리다 — 응급 브리핑 머리와 같은 이유(기준선이 둘이 되지 않게) */}
      <div className="min-w-0 flex-1 md:flex-none">
        <h1 className="text-title-1 text-fg lg:text-display font-bold break-keep md:mt-1 lg:font-extrabold">
          {messages.plan.briefingHeading}
        </h1>
        {subtitle !== null && (
          <p className="text-caption text-fg-muted mt-1 font-medium break-keep">{subtitle}</p>
        )}
      </div>
    </header>
  )
}

/**
 * 출발 전 여행 브리핑 — `GET /plans/{planId}/briefing?date=` (#626).
 *
 * **새 판정이 아니라 기존 판정의 합본이다.** 서버가 LLM 을 부르지 않고, 화면도 문장을
 * 지어내지 않는다 — `goldenWindowStatus` 같은 metadata 는 서버 `name`·`description` 을
 * 그대로 쓴다 (한국어 매핑 테이블 금지, 루트 `CLAUDE.md`).
 *
 * **카드 순서는 일정 → 날씨 → 특보 → 골든타임이다** (명세 D8-6). 특보가 없는 날이
 * 대부분인데 맨 위를 특보로 비워 두면 화면이 "없음" 으로 시작한다 — 경보 날의 강조는
 * 배지 톤(`critical`)이 맡는다.
 *
 * **표현 전용이다** — 조회는 `PlanBriefingView` 가 갖는다 (이 저장소 테스트가 jsdom 없이
 * 문자열로 검증하므로 훅을 든 컴포넌트는 provider 없이 렌더할 수 없다).
 */
export function PlanBriefingSection({
  briefing,
  basisPetName,
  curve,
}: {
  briefing: PlanBriefingResponse
  /** 두 마리 이상 일정에서만 채워진다 — 판정은 `basisPetNameOf()` 가 갖는다 */
  basisPetName: string | null
  curve: PlanBriefingCurve
}) {
  return (
    <>
      <Surface title={messages.plan.briefingScheduleHeading}>
        <ScheduleCard planId={briefing.planId} day={briefing.day} schedule={briefing.schedule} />
      </Surface>

      <Surface title={messages.plan.briefingWeatherHeading}>
        <div className={INSET_CLASS.card}>
          {briefing.weather === null ? (
            <p className="text-body-2 text-fg-muted py-4">{messages.plan.briefingWeatherMissing}</p>
          ) : (
            /*
              **일정 상세와 같은 컴포넌트다** — 서버가 같은 `PlanDayWeatherItem` 을 주므로
              (`PlanWeatherPresenter.toDayItem`) 여기서 다른 것을 만들면 두 화면이 갈린다.

              `failed={false}` — 이 카드만 따로 실패하는 경로가 없다. 브리핑은 한 응답이라
              날씨가 안 오면 화면 전체가 오류 갈래로 간다.

              **`petConditionApplied` 를 그대로 넘긴다** (명세 D5-2). 일반 조건 판정을
              알리는 줄은 이 컴포넌트가 이미 갖고 있어서, 화면 아래 같은 줄을 한 번 더
              두지 않는다 — 응답의 두 자리 중 **최상위 값 하나만** 말한다 (D5-4).
              `walkTimes.petConditionApplied` 는 읽지 않는다.
            */
            <PlanDayVerdict
              verdict={briefing.weather}
              petConditionApplied={briefing.petConditionApplied}
              basisPetName={basisPetName}
              failed={false}
              onRetry={() => undefined}
              dayHasItems={briefing.schedule.itemCount > 0}
            />
          )}
        </div>
      </Surface>

      <Surface title={messages.plan.briefingWarningHeading}>
        <WeatherWarningCard
          warning={briefing.weatherWarning}
          reason={briefing.weatherWarningUnavailableReason}
        />
      </Surface>

      <Surface title={messages.plan.briefingWalkHeading}>
        <WalkTimesCard
          walkTimes={briefing.walkTimes}
          reason={briefing.walkTimesUnavailableReason}
          representativePlaceTitle={briefing.schedule.representativePlaceTitle}
          curve={curve}
        />
      </Surface>
    </>
  )
}

/**
 * 그날 일정 (명세 D5-1).
 *
 * **항목 유형(`itemType`)을 적지 않는다.** 이 응답에서만 metadata 가 아니라 `PLACE` 같은
 * enum 문자열로 와서, 적으려면 FE 에 한국어 매핑 테이블을 만들어야 한다 (루트 `CLAUDE.md`
 * 금지). 서버에 metadata 를 요청해 두고(명세 D9-1) 그때 붙인다.
 */
function ScheduleCard({
  planId,
  day,
  schedule,
}: {
  planId: string
  day: number
  schedule: PlanBriefingSchedule
}) {
  if (schedule.itemCount === 0 || schedule.firstItem === null) {
    return (
      <EmptyState
        title={messages.plan.briefingScheduleEmptyTitle}
        inset="card"
        headingLevel={3}
        action={
          <ButtonLink href={`/plans/${planId}/days/${day}/add`} variant="secondary" size="sm">
            {messages.plan.briefingScheduleEmptyAction}
          </ButtonLink>
        }
      />
    )
  }

  return (
    <div className={cn('flex flex-col items-start gap-2 pb-4', INSET_CLASS.card)}>
      <p className="text-body-2 text-fg tabular-nums">
        {messages.plan.briefingScheduleCounts
          .replace('{count}', String(schedule.itemCount))
          .replace('{visited}', String(schedule.visitedCount))}
      </p>

      <p className="text-body-1 text-fg font-semibold break-keep">
        {itemLine(
          schedule.firstItem,
          messages.plan.briefingScheduleFirst,
          messages.plan.briefingScheduleFirstNoTime,
        )}
      </p>

      {/* 항목이 하나면 처음과 마지막이 같은 항목이다 — 같은 줄을 두 번 두지 않는다 */}
      {schedule.itemCount > 1 && schedule.lastItem !== null && (
        <p className="text-body-1 text-fg font-semibold break-keep">
          {itemLine(
            schedule.lastItem,
            messages.plan.briefingScheduleLast,
            messages.plan.briefingScheduleLastNoTime,
          )}
        </p>
      )}

      {schedule.representativePlaceTitle !== null && (
        <p className="text-caption text-fg-muted break-keep">
          {schedule.representativePlaceId === null ? (
            messages.plan.briefingScheduleBasisPlace.replace(
              '{title}',
              schedule.representativePlaceTitle,
            )
          ) : (
            /*
              **id 가 없으면 링크를 렌더하지 않는다** (명세 D4). 제목만 오는 경우가 있어
              (원천에서 사라진 장소) 눌러도 아무 데도 못 가는 링크를 만들지 않는다.
            */
            <Link
              href={`/places/${schedule.representativePlaceId}`}
              className="text-link hover:text-link-hover focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none"
            >
              {messages.plan.briefingScheduleBasisPlace.replace(
                '{title}',
                schedule.representativePlaceTitle,
              )}
            </Link>
          )}
        </p>
      )}

      <ButtonLink
        href={`/plans/${planId}#${planDayAnchorId(day)}`}
        variant="secondary"
        size="sm"
        className="mt-1"
      >
        {messages.plan.briefingScheduleOpenDay}
      </ButtonLink>
    </div>
  )
}

/**
 * `처음 10:30 협재해수욕장` — **시각은 문자열 슬라이스로 만든다.**
 *
 * `Date` 로 파싱하면 서버가 준 지역 시각이 브라우저 타임존으로 밀린다 (홈 `hourMinute`
 * 과 같은 규칙). 시각이 없는 항목은 `:` 잔재 없이 제목만 남는 템플릿을 쓴다.
 */
function itemLine(item: PlanBriefingItemSummary, withTime: string, withoutTime: string): string {
  if (item.startTime === null) return withoutTime.replace('{title}', item.title)
  return withTime.replace('{time}', item.startTime.slice(0, 5)).replace('{title}', item.title)
}

/**
 * 기상특보 — **이 화면의 핵심 규칙** (명세 D5-3).
 *
 * 서버 javadoc: _"특보는 필드와 이유가 둘 다 null 일 때만 '발효 중인 특보 없음' 이다 —
 * 확인하지 못한 날은 이유가 채워진다."_
 *
 * | `warning` | `reason` | 화면 |
 * |---|---|---|
 * | 있음 | null | 배지 + `level.description` (+ 발효 시각) |
 * | **null** | **null** | **`발효 중인 기상특보가 없어요`** — 이 조합에서만 |
 * | null | 문장 | `기상특보를 확인하지 못했어요` + **서버 문장 그대로** |
 * | 있음 | 문장 (오지 않아야 함) | 배지를 그린다. 문장은 그 아래 보조 줄 |
 *
 * **이유가 있는데 "없음" 으로 쓰면 태풍경보를 조용히 지운다.**
 *
 * **`다시 시도` 가 없다.** 이유가 코드가 아니라 문장이라 "당일에만 확인"(정상)과
 * "가져오지 못했다"(일시 장애)를 화면이 가를 수 없다 — 문장을 파싱하지 않는다. 고칠 수
 * 없는 것에 버튼을 달면 계속 누른다 (홈 `NoForecast` 의 `DAY_ENDED` 판단과 같은 축).
 * 코드 추가는 BE 후속 요청이다 (명세 D9-2).
 */
function WeatherWarningCard({
  warning,
  reason,
}: {
  warning: PlanBriefingWeatherWarning | null
  reason: string | null
}) {
  if (warning === null) {
    return (
      <div className={cn('flex flex-col items-start gap-1 pb-4', INSET_CLASS.card)}>
        {reason === null ? (
          <p className="text-body-1 text-fg-muted font-semibold">
            {messages.plan.briefingWarningNone}
          </p>
        ) : (
          <>
            <p className="text-body-1 text-fg-muted font-semibold">
              {messages.plan.briefingWarningUnavailableTitle}
            </p>
            {/* 서버 문장 그대로 — 화면이 다시 쓰지 않는다 */}
            <p className="text-body-2 text-fg-muted break-keep">{reason}</p>
          </>
        )}
      </div>
    )
  }

  const effectiveAt = warning.effectiveAt

  return (
    <div className={cn('flex flex-col items-start gap-2 pb-4', INSET_CLASS.card)}>
      {/* 배지 안에 `{type.name} {level.name}` 이 낱말로 있다 — 색만으로 말하지 않는다 */}
      <WeatherWarningBadge warning={warning} />

      {/*
        **`level.description` 이다.** `type.description` 은 서버가 판정 근거
        (`WEATHER_WARNING_ACTIVE`) 조립에 쓰므로 위 날씨 카드의 `reasons` 에 이미 있다.
      */}
      {warning.level.description !== null && (
        <p className="text-body-2 text-fg-muted break-keep">{warning.level.description}</p>
      )}

      {/* `HH:mm` 만 쓴다. null 이면 줄을 빼고 "시각 미상" 같은 말을 만들지 않는다 */}
      {effectiveAt !== null && (
        <p className="text-caption text-fg-muted tabular-nums">
          {messages.plan.briefingWarningEffectiveAt.replace('{time}', effectiveAt.slice(11, 16))}
        </p>
      )}

      {/* **`level.code` 로 직접 판정하지 않는다** — 서버 DTO 가 이 값을 쓰라고 못박는다 */}
      {warning.recommendationSuppressed && (
        <p className="text-body-2 text-fg-muted break-keep">
          {messages.plan.briefingWarningSuppressed}
        </p>
      )}

      {/* 오지 않아야 할 조합이지만 오면 감추지 않는다 — 배지 아래 보조 줄이다 */}
      {reason !== null && <p className="text-caption text-fg-subtle break-keep">{reason}</p>}
    </div>
  )
}

/** 다시 시도할 일인 것은 이 코드 하나뿐이다 — 서버 `ForecastCoverage` 주석 (홈과 같은 규칙) */
const COVERAGE_UNAVAILABLE = 'UNAVAILABLE'

/**
 * 산책하기 좋은 시간 (명세 D5-4).
 *
 * **`walkTimes === null` 이면 곡선을 부를 좌표가 없다.** 프레젠터가 대표 장소 좌표를
 * `walkTimes` 안에만 싣고 `schedule` 에는 넣지 않는다 — 그래서 이 갈래는 이유 문장 한 줄로
 * 끝나고 **재시도도 없다**(위 특보와 같은 이유: 문장뿐이라 정상과 장애를 가를 수 없다).
 *
 * **일정 상세의 `item.place.lat/lng` 로 좌표를 메우지 않는다** (명세 D8-1). `walkTimes` 가
 * null 인 날은 서버가 "이 날은 판정하지 않았다" 고 말한 날이다 — 그 옆에서 화면이 판정을
 * 하나 만들어 내면 두 채널이 갈린다 (#270 이 겪은 실패).
 *
 * **상태 문구를 FE 가 짓지 않는다.** `goldenWindowStatus` 는 `{code, name, description}`
 * metadata 고 서버가 한국어를 채워 보낸다. **`goldenStart` 가 null 이라는 이유만으로
 * "남은 시간이 모두 위험" 이라고 쓰지 않는다** — 그 문장은 `ALL_HOURS_RISKY` 일 때만 참이다.
 */
function WalkTimesCard({
  walkTimes,
  reason,
  representativePlaceTitle,
  curve,
}: {
  walkTimes: PlanBriefingWalkTimes | null
  reason: string | null
  representativePlaceTitle: string | null
  curve: PlanBriefingCurve
}) {
  if (walkTimes === null) {
    return (
      <div className={cn('flex flex-col items-start gap-1 pb-4', INSET_CLASS.card)}>
        <p className="text-body-2 text-fg-muted break-keep">
          {reason ?? messages.plan.briefingWalkUnknown}
        </p>
      </div>
    )
  }

  const status = walkTimes.goldenWindowStatus
  const hasWindow = walkTimes.goldenStart !== null && walkTimes.goldenEnd !== null
  const coverageBroken = walkTimes.forecastCoverage?.code === COVERAGE_UNAVAILABLE

  return (
    <div className={cn('flex flex-col items-start gap-3 pb-4', INSET_CLASS.card)}>
      {status !== null && status.code === 'AVAILABLE' && hasWindow ? (
        <GoldenWindowLine walkTimes={walkTimes} description={status.description} />
      ) : status !== null ? (
        /*
          **모르는 코드도 여기로 온다.** 서버가 상태를 하나 더 내도 화면은 그것을 그대로
          말한다 — 홈이 `#270` 당시 자기 문구를 갖고 있는 것과 다른 선택이다(이 화면은
          서버 metadata 를 쓴다).
        */
        <div className="flex flex-col gap-1">
          <p className="text-body-1 text-fg-muted font-semibold">{status.name}</p>
          {status.description !== null && (
            <p className="text-body-2 text-fg-muted break-keep">{status.description}</p>
          )}
        </div>
      ) : hasWindow ? (
        // 옛 서버 — 상태가 없으면 아는 만큼만 말한다 (창만)
        <GoldenWindowLine walkTimes={walkTimes} description={null} />
      ) : (
        <p className="text-body-1 text-fg-muted font-semibold">{messages.plan.briefingWalkNone}</p>
      )}

      {/*
        곡선은 브리핑 응답에 없다 — 좌표로 tour 를 따로 부른 결과다. **창·상태는 위
        브리핑 응답의 것을 쓰고, 여기 넘기는 것은 `hourly` 하나다** (명세 D3-3).
      */}
      {curve.hourly !== null ? (
        <WalkTimesCurve
          hourly={curve.hourly}
          goldenStart={walkTimes.goldenStart}
          goldenEnd={walkTimes.goldenEnd}
        />
      ) : curve.failed ? (
        <div className="flex flex-col items-start gap-1">
          <p className="text-body-2 text-fg-muted">{messages.plan.briefingCurveErrorTitle}</p>
          <CurveRetry onRetry={curve.onRetry} />
        </div>
      ) : null}

      {/*
        **`UNAVAILABLE` 에만 단다** — 이것만 일시 장애다. `DAY_ENDED` 는 정상이고 자정
        전에는 몇 번을 눌러도 같은 응답이라 버튼을 달면 계속 누른다 (홈과 같은 규칙).
        곡선 조회가 이미 실패해 버튼이 있으면 두 번 두지 않는다.
      */}
      {coverageBroken && !(curve.hourly === null && curve.failed) && (
        <CurveRetry onRetry={curve.onRetry} />
      )}

      <p className="text-caption text-fg-muted font-medium break-keep">
        {representativePlaceTitle === null
          ? messages.plan.briefingWalkBasisNoPlace
          : messages.plan.briefingWalkBasis.replace('{title}', representativePlaceTitle)}
      </p>
    </div>
  )
}

/** 44px — 모바일 최소 터치 영역 (DESIGN.md §7). 홈 `NoForecast` 의 버튼과 같은 모양이다 */
function CurveRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
    >
      {messages.common.retry}
    </button>
  )
}

/**
 * 추천 구간 한 줄.
 *
 * **en dash 는 스크린리더가 "에서" 로 읽지 못한다** — `sr-only` 로 `{from}부터 {to}까지`
 * 를 함께 둔다 (명세 D6). 시각은 서버 문자열을 그대로 자른다.
 */
function GoldenWindowLine({
  walkTimes,
  description,
}: {
  walkTimes: PlanBriefingWalkTimes
  description: string | null
}) {
  const from = hourMinute(walkTimes.goldenStart)
  const to = hourMinute(walkTimes.goldenEnd)

  return (
    <div className="flex flex-col gap-1">
      <p
        className={cn(
          'text-title-1 font-bold tabular-nums',
          METRIC_WORD_TONE[walkSafetyTone(walkTimes.goldenLevel?.code)],
        )}
      >
        <span aria-hidden>
          {from} – {to}
        </span>
        <span className="sr-only">
          {messages.plan.briefingWalkRangeLabel.replace('{from}', from).replace('{to}', to)}
        </span>
      </p>
      {description !== null && (
        <p className="text-body-2 text-fg-muted break-keep">{description}</p>
      )}
    </div>
  )
}

/** `2026-09-13T18:00:00` → `18:00`. `Date` 로 파싱하면 브라우저 타임존으로 밀린다 */
function hourMinute(at: string | null): string {
  return at === null ? '' : at.slice(11, 16)
}
