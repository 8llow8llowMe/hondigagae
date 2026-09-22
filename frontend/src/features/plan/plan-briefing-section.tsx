import Link from 'next/link'

import { BackLink } from '@/components/back-link'
import { Badge } from '@/components/badge'
import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { Surface } from '@/components/surface'
import { WalkTimesCurve } from '@/components/walk-times-curve'
import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import { PlaceMiniMap } from '@/features/place/place-mini-map'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { PlanDayVerdict, planDayVerdictIsBlank } from '@/features/plan/plan-day-verdict'
import { toLatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import {
  BRIEFING_REASON_LOOKUP_FAILED,
  BRIEFING_REASON_NO_PLACE_ITEM,
  type BriefingTarget,
} from '@/lib/plan/briefing'
import { type BriefingDayFact, briefingDayFacts } from '@/lib/plan/briefing-day-facts'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { HourlyWalkSafetyItem } from '@/types/insight'
import type {
  PlanBriefingItemSummary,
  PlanBriefingResponse,
  PlanBriefingSchedule,
  PlanBriefingWalkTimes,
  PlanBriefingWeatherWarning,
  PlanDailyWeatherItem,
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
  kind,
  basisPetName,
  curve,
  onRetry,
}: {
  briefing: PlanBriefingResponse
  /**
   * `pickBriefingDate` 가 이미 돌려주는 갈래 (#733). **새 판정 축을 만들지 않는다** —
   * 화면이 다시 날짜를 비교하지 않고 진입 배너가 쓰던 값을 그대로 받는다.
   */
  kind: BriefingTarget['kind']
  /** 두 마리 이상 일정에서만 채워진다 — 판정은 `basisPetNameOf()` 가 갖는다 */
  basisPetName: string | null
  curve: PlanBriefingCurve
  /**
   * 브리핑 응답 자체를 다시 부른다 — **곡선 재시도(`curve.onRetry`)와 다른 것이다.**
   * `LOOKUP_FAILED` 는 브리핑이 원격 조회에 실패한 것이라 곡선을 다시 불러도 풀리지 않는다.
   */
  onRetry: () => void
}) {
  const deferred = isDeferredDay(briefing, kind)
  const blankWeather = isBlankWeatherCard(briefing)

  return (
    <>
      <Surface title={messages.plan.briefingScheduleHeading}>
        <ScheduleCard planId={briefing.planId} day={briefing.day} schedule={briefing.schedule} />
      </Surface>

      {/*
        **담을 것이 없으면 카드를 세우지 않는다** (#788 · 명세 D11-1). 판정과 지표 줄이
        둘 다 빠지는 날(오늘 출발인데 항목 0개)에 제목만 남은 카드가 섰다 — 두 조각의
        `null` 은 각자 옳고, 카드 하나를 통째로 내주는 쪽이 여기뿐이라 판정도 여기 있다.
      */}
      {!blankWeather && (
        <Surface
          title={
            kind === 'EVE'
              ? messages.plan.briefingWeatherEveHeading
              : messages.plan.briefingWeatherTodayHeading
          }
        >
          <div className={INSET_CLASS.card}>
            {briefing.weather === null ? (
              <p className="text-body-2 text-fg-muted py-4">
                {messages.plan.briefingWeatherMissing}
              </p>
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

            <DayFactsRow weather={briefing.weather?.weather ?? null} />
          </div>
        </Surface>
      )}

      {/*
        **전날에는 이 둘을 그리지 않는다** (#733). 서버가 당일에만 채우는 값이라
        (`today === false` 면 둘 다 null + 이유 문장) 카드가 정상 크기로 서서 안내 한 줄만
        담았다 — 화면 아래 절반이 값 없는 카드였다.
      */}
      {!deferred && (
        <>
          <Surface title={messages.plan.briefingWarningHeading}>
            <WeatherWarningCard
              warning={briefing.weatherWarning}
              reasonCode={briefing.weatherWarningUnavailableReasonCode}
              reason={briefing.weatherWarningUnavailableReason}
              onRetry={onRetry}
            />
          </Surface>

          <Surface title={messages.plan.briefingWalkHeading}>
            <WalkTimesCard
              planId={briefing.planId}
              day={briefing.day}
              walkTimes={briefing.walkTimes}
              reasonCode={briefing.walkTimesUnavailableReasonCode}
              reason={briefing.walkTimesUnavailableReason}
              representativePlaceTitle={briefing.schedule.representativePlaceTitle}
              hasItems={briefing.schedule.itemCount > 0}
              curve={curve}
              onRetry={onRetry}
            />
          </Surface>
        </>
      )}

      {/*
        **각주는 카드가 아니다** (DESIGN.md §0 의 카드 판정 3문 — 자기 제목이 없다).
        `Surface` 로 감싸면 접은 카드 둘이 카드 하나로 바뀔 뿐이다.

        굵기는 본문(400)이다 — 이슈가 지적한 `16px/600 + 보조 텍스트 색` 을 되풀이하지
        않는다. 모바일에서 `Surface` 가 전폭이라 인셋은 카드 안 글줄과 같은 `card` 다.
      */}
      {deferred && (
        <p className={cn('text-body-2 text-fg-muted py-4 break-keep', INSET_CLASS.card)}>
          {messages.plan.briefingEveFootnote}
        </p>
      )}
    </>
  )
}

/**
 * 날씨 카드가 **담을 것이 없는가** (#788).
 *
 * 카드 안은 판정(`PlanDayVerdict`)과 하루 지표 줄(`DayFactsRow`) 둘뿐이고, 둘 다 빠지는
 * 날이 있다 — **오늘 출발인데 그날 항목이 하나도 없는 날**이다. 서버가 기준 장소를 못
 * 잡아(`NO_PLACE_ITEM`) 점수도 날씨 값도 비우는데, 그때 판정은 "빈 일차 안내가 같은 말을
 * 이미 한다" 는 이유로(#497) 자리를 만들지 않고 지표 줄은 세울 값이 없다.
 *
 * **새 판정 축이 아니라 `isDeferredDay` 와 같은 규칙이다** — 값이 실제로 비어 있을 때만
 * 접는다(명세 D11-2). 날짜나 사유 코드로 다시 가르지 않으므로, 산책 항목만 있는 날처럼
 * 같은 사유인데 할 말이 남은 갈래(`unavailableSentence` 주석)는 그대로 선다.
 *
 * **접은 자리를 대신하는 안내를 세우지 않는다.** 전날 갈래는 각주 한 줄을 남겼지만
 * (D11-1) 이 갈래는 그날 일정 카드의 `이 날에는 담긴 항목이 없어요` + 장소 담기가 이미
 * 이유와 다음 걸음을 말하고 있어, 한 줄을 더 세우면 같은 말이 두 번이 된다.
 *
 * **`weather === null` 은 접지 않는다.** 그때는 "못 받았다" 는 줄이 카드를 채운다 (D5-2).
 */
function isBlankWeatherCard(briefing: PlanBriefingResponse): boolean {
  if (briefing.weather === null) return false

  return (
    planDayVerdictIsBlank(briefing.weather, briefing.schedule.itemCount > 0) &&
    briefingDayFacts(briefing.weather.weather).length === 0
  )
}

/**
 * 특보·골든타임을 **아직 볼 수 없는 날인가** (#733).
 *
 * **갈래는 `pickBriefingDate` 의 `kind` 다** — 화면이 날짜를 다시 비교하지 않는다.
 *
 * **그런데 `kind` 만으로 접지 않는다.** `kind` 는 FE 시계로 고른 값이고 서버는 자기
 * `Clock` 을 보므로 자정 전후에 둘이 갈릴 수 있다(`lib/plan/briefing.ts` 주석). 그때
 * `kind === 'EVE'` 인데 응답에는 **발효 중인 태풍경보**가 실려 올 수 있고, 그것을 카드째
 * 접으면 이 화면이 가장 크게 지키고 있는 규칙(_"이유가 있는데 '없음' 으로 쓰면 태풍경보를
 * 조용히 지운다"_)을 뒤에서 깨는 셈이 된다.
 *
 * 그래서 **값이 실제로 비어 있을 때만** 접는다. 새 판정 축이 아니라 이슈가 한 문장으로
 * 적은 것("값이 없는 카드를 그리지 않는다") 그대로다.
 */
function isDeferredDay(briefing: PlanBriefingResponse, kind: BriefingTarget['kind']): boolean {
  return kind === 'EVE' && briefing.weatherWarning === null && briefing.walkTimes === null
}

/**
 * 그날 일정 (명세 D5-1).
 *
 * **항목 유형(`itemType`)을 배지로 적는다** (#716 · 명세 D12-4). 예전에는 이 응답에서만
 * metadata 가 아니라 `PLACE` 같은 enum 문자열로 와서, 적으려면 FE 에 한국어 매핑 테이블이
 * 필요했다(루트 `CLAUDE.md` 금지) — v1 이 유형을 아예 안 적은 이유다. 서버가 metadata 를
 * 내리면서 그 제약이 사라졌고, 이제 `name` 을 그대로 쓴다.
 *
 * **대표 장소 지도도 여기 있다** (명세 D12-3) — 좌표가 `schedule` 에 오면서 열린 자리다.
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

  const basisTitle = schedule.representativePlaceTitle
  const last = schedule.itemCount > 1 ? schedule.lastItem : null

  /*
    **기준 장소를 제목으로 맞춘다.** 응답의 `representativePlaceId` 는 **장소** id 이고
    항목이 들고 있는 것은 `planItemId` 라, 둘을 잇는 열쇠가 응답에 없다 — 제목이 같으면
    같은 곳으로 본다. 어느 쪽과도 맞지 않으면(가운데 항목이 기준인 날) 예전처럼 아래 줄로
    남는다. **서버가 `representativePlanItemId` 를 주면 그때 제목 대조를 걷는다** (BE 후속).
  */
  const basisOnFirst = basisTitle !== null && schedule.firstItem.title === basisTitle
  const basisOnLast = !basisOnFirst && basisTitle !== null && last?.title === basisTitle
  const basisLine = basisTitle !== null && !basisOnFirst && !basisOnLast ? basisTitle : null

  return (
    <div className={cn('flex flex-col items-start gap-3 pb-4', INSET_CLASS.card)}>
      <p className="text-body-2 text-fg tabular-nums">
        {messages.plan.briefingScheduleCounts
          .replace('{count}', String(schedule.itemCount))
          .replace('{visited}', String(schedule.visitedCount))}
      </p>

      {/*
        **순서를 글자가 아니라 점·선이 말한다** (#733). 예전에는 `처음` · `마지막` 이 값과
        **같은 노드·같은 굵기**로 들어가 `처음 함덕 서우봉 해변` 이 한 문장처럼 읽혔다.

        **`ol` 이다** — 라벨을 걷어도 순서가 마크업에 남아야 스크린리더가 같은 것을 읽는다.
      */}
      <ol className="w-full">
        <FlowNode
          item={schedule.firstItem}
          basis={basisOnFirst}
          betweenCount={last === null ? 0 : schedule.itemCount - 2}
          connected={last !== null}
        />
        {/* 항목이 하나면 처음과 마지막이 같은 항목이다 — 같은 줄을 두 번 두지 않는다 */}
        {last !== null && <FlowNode item={last} basis={basisOnLast} betweenCount={0} />}
      </ol>

      {basisLine !== null && (
        <p className="text-caption text-fg-muted break-keep">
          {schedule.representativePlaceId === null ? (
            messages.plan.briefingScheduleBasisPlace.replace('{title}', basisLine)
          ) : (
            /*
              **id 가 없으면 링크를 렌더하지 않는다** (명세 D4). 제목만 오는 경우가 있어
              (원천에서 사라진 장소) 눌러도 아무 데도 못 가는 링크를 만들지 않는다.
            */
            <Link
              href={`/places/${schedule.representativePlaceId}`}
              className="text-link hover:text-link-hover focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none"
            >
              {messages.plan.briefingScheduleBasisPlace.replace('{title}', basisLine)}
            </Link>
          )}
        </p>
      )}

      {/*
        **대표 장소 지도** (#716 · 명세 D9-3). 좌표가 `schedule` 에 오면서 이 자리가 열렸다 —
        예전에는 좌표가 `walkTimes` 안에만 있어 골든타임을 못 낸 날에는 지도도 없었다.

        `PlaceMiniMap` 을 그대로 쓴다. 같은 질문("여기가 어디쯤이냐")에 답하는 지도를 이
        화면만 다시 만들면 두 화면의 축척·SDK 실패 폴백이 갈린다.

        **좌표를 여기서 직접 확인한다.** `PlaceMiniMap` 이 좌표 없을 때 `null` 을 반환하는
        것은 그쪽 구현 세부이지 공개 계약이 아니고, 그것에 기대면 (a) 감싼 요소가 남아
        `gap-3` 이 두 번 먹는 유령 여백이 생기고 (b) 그쪽이 "좌표 없음" 안내를 그리도록
        바뀌는 날 이 화면에 예고 없이 빈 박스가 선다. `NO_PLACE_POINT` 는 **장소는 있고
        좌표만 없는** 상태라 실제로 도달하는 조합이다.

        **기준을 화면에 적는다.** 항목이 여럿인 날에도 핀은 대표 장소 하나라, 말이 없으면
        "이 날의 경로" 로 읽혀 나머지 항목이 빠진 지도가 된다. 아래 골든타임 카드가 같은
        좌표에 대해 기준을 밝히는 것과 같은 처리다 (DESIGN.md — 기준·단위를 드러낸다).
        `basisLine` 은 기준 장소가 첫/마지막 마디와 제목이 같으면 사라지므로 그것에
        기대지 않는다.
      */}
      {schedule.representativePlaceId !== null &&
        basisTitle !== null &&
        toLatLng({ lat: schedule.representativeLat, lng: schedule.representativeLng }) !== null && (
          <div className="flex w-full flex-col gap-1">
            <p className="text-caption text-fg-muted break-keep">
              {messages.plan.briefingScheduleMapBasis.replace('{title}', basisTitle)}
            </p>

            <PlaceMiniMap
              placeId={schedule.representativePlaceId}
              title={basisTitle}
              lat={schedule.representativeLat}
              lng={schedule.representativeLng}
            />
          </div>
        )}

      {/*
        **카드의 주 액션이다** — `primary` · `md`(44px). `secondary sm`(109×32) 이던 때는
        바로 위 지도의 전폭 `길찾기`(343×44, 같은 테두리 언어)와 면적이 9.7배 벌어져
        **보조 자료의 액션이 주 액션보다 무거웠다** (DESIGN.md — 위계는 크기와 순서).
        44px 은 모바일 최소 터치 영역이기도 하다 (DESIGN.md §7).
      */}
      <ButtonLink
        href={`/plans/${planId}#${planDayAnchorId(day)}`}
        variant="primary"
        size="md"
        className="mt-1"
      >
        {messages.plan.briefingScheduleOpenDay}
      </ButtonLink>
    </div>
  )
}

/**
 * 동선의 한 마디 — 점 · 이어지는 선 · 항목 (#733).
 *
 * **시각은 문자열 슬라이스로 만든다.** `Date` 로 파싱하면 서버가 준 지역 시각이 브라우저
 * 타임존으로 밀린다 (홈 `hourMinute` 과 같은 규칙). 시각이 없는 항목은 그 칸을 비운다 —
 * `--:--` 같은 자리표시를 만들지 않는다.
 *
 * **선 사이에 이동 거리를 넣지 못했다.** 브리핑 응답의 `schedule` 에는 좌표가 없어
 * (`walkTimes` 안에만 온다) 거리를 낼 수 없다 — 대신 응답이 아는 값(사이에 낀 항목 수)을
 * 센다. 거리는 BE 후속 요청이다.
 */
function FlowNode({
  item,
  basis,
  betweenCount,
  connected = false,
}: {
  item: PlanBriefingItemSummary
  /** 그날 판정의 기준이 된 장소인가 — 맞으면 별도 줄 대신 태그로 붙는다 */
  basis: boolean
  /** 이 마디와 다음 마디 사이에 낀 항목 수. `0` 이면 줄을 내지 않는다 */
  betweenCount: number
  /** 아래로 선을 잇는가 (마지막 마디는 잇지 않는다) */
  connected?: boolean
}) {
  return (
    <li className="flex gap-3 pb-4 last:pb-0">
      {/*
        점과 선은 장식이다 — 순서는 `ol` 이 이미 말한다.

        **선을 `absolute` 로 띄우지 않는다.** `flex-1` 이 마디 높이만큼 늘어나므로 제목이
        두 줄로 접히는 긴 장소명(한국어 실데이터)에서도 선이 따라 자란다.
      */}
      <span aria-hidden className="flex w-2 shrink-0 flex-col items-center pt-2">
        <span className="bg-border-strong size-2 shrink-0 rounded-full" />
        {connected && <span className="bg-border w-px flex-1" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-body-1 text-fg font-semibold break-keep">
          {item.startTime !== null && (
            <span className="text-fg-muted tabular-nums">{item.startTime.slice(0, 5)} </span>
          )}
          {item.title}
        </p>

        {/*
          **유형 라벨을 배지로 둔다** (#716 · 명세 D9-1). 제목 줄에 이어 붙이면 `숙박
          동문재래시장` 이 한 문장처럼 읽힌다 — #733 이 `처음`·`마지막` 을 글자에서 점·선
          으로 옮긴 것과 같은 이유다. 기준 장소 태그와 같은 줄에 서는 별개의 조각이다.

          **서버 `name` 을 그대로 쓴다** — FE 에 한국어 매핑 테이블을 만들지 않는다.
        */}
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral" size="sm">
            <span className="sr-only">{messages.plan.briefingScheduleTypeLabel} </span>
            {item.itemType.name}
          </Badge>

          {/*
            **`strong` 으로 한 계급 올린다.** 유형은 마디마다 항상 붙는 분류 라벨이고,
            이 태그는 **그날 날씨·골든타임 판정이 어느 항목에 걸렸는지**를 말하는 유일한
            단서다. 톤·크기가 같으면 뜻이 무거운 쪽이 상시 라벨에 묻힌다.
          */}
          {basis && (
            <Badge tone="neutral" size="sm" strong>
              {messages.plan.briefingScheduleBasisTag}
            </Badge>
          )}
        </span>

        {betweenCount > 0 && (
          <p className="text-caption text-fg-muted mt-2 tabular-nums">
            {messages.plan.briefingScheduleBetween.replace('{count}', String(betweenCount))}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * 하루 지표 줄 — **브리핑 날씨 카드에만 있는 부분이다** (#733).
 *
 * 무엇을 세우고 무엇을 빼는지의 판단은 `lib/plan/briefing-day-facts.ts` 가 갖는다 (거기
 * 머리주석이 "시간축을 만들지 못한 이유" 의 정본이다). 여기는 글자로 옮기기만 한다.
 */
function DayFactsRow({ weather }: { weather: PlanDailyWeatherItem | null }) {
  const facts = briefingDayFacts(weather)
  if (facts.length === 0) return null

  return (
    <p className="text-caption text-fg-muted border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 pb-4 font-medium tabular-nums">
      {facts.map((fact) => (
        <span key={fact.kind}>{factText(fact)}</span>
      ))}
    </p>
  )
}

function factText(fact: BriefingDayFact): string {
  switch (fact.kind) {
    case 'sky':
      // 서버가 표시용 이름으로 낮춰 준 값이다 — 화면이 다시 쓰지 않는다
      return fact.name
    case 'maxTemperature':
      return messages.plan.briefingWeatherMaxTemperature.replace('{value}', fact.value.toFixed(1))
    case 'minTemperature':
      return messages.plan.briefingWeatherMinTemperature.replace('{value}', fact.value.toFixed(1))
    case 'precipitation':
      return messages.plan.briefingWeatherPrecipitation.replace('{value}', String(fact.value))
  }
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
  reasonCode,
  reason,
  onRetry,
}: {
  warning: PlanBriefingWeatherWarning | null
  reasonCode: string | null
  reason: string | null
  onRetry: () => void
}) {
  if (warning === null) {
    /*
      **세 상태를 가르는 규칙은 그대로다** — 문장과 코드가 **둘 다** null 일 때만 "없음"
      이다. 코드만 보고 접으면 v1 이 피하려던 실패(태풍경보를 조용히 지운다)로 되돌아간다.
    */
    const confirmedNone = reason === null && reasonCode === null

    return (
      <div className={cn('flex flex-col items-start gap-1 pb-4', INSET_CLASS.card)}>
        {confirmedNone ? (
          <p className="text-body-1 text-fg-muted font-semibold">
            {messages.plan.briefingWarningNone}
          </p>
        ) : (
          <>
            {/*
              **본문 굵기(400)다** (#733). 예전에는 `body-1`(16/600 — 제목 굵기)에 보조
              텍스트 색을 얹고 있었다. 크기·굵기는 제목인데 색은 본문이라 위계가 어긋났고,
              무엇보다 **이 줄은 답이 아니라 답이 없다는 안내**라 제목 무게를 가질 자리가
              아니다. 아래 서버 문장과 같은 등급으로 내리고 굵기만 갈라 둔다.
            */}
            <p className="text-body-2 text-fg-muted font-semibold">
              {messages.plan.briefingWarningUnavailableTitle}
            </p>
            {/* 서버 문장 그대로 — 화면이 다시 쓰지 않는다. 코드만 온 날은 제목만 남는다 */}
            {reason !== null && <p className="text-body-2 text-fg-muted break-keep">{reason}</p>}

            {/* **`LOOKUP_FAILED` 에만 단다** — 나머지는 눌러도 생기지 않는 값이다 */}
            {reasonCode === BRIEFING_REASON_LOOKUP_FAILED && (
              <RetryButton onRetry={onRetry} label={messages.plan.briefingWarningRetryLabel} />
            )}
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
  planId,
  day,
  walkTimes,
  reasonCode,
  reason,
  representativePlaceTitle,
  hasItems,
  curve,
  onRetry,
}: {
  planId: string
  day: number
  walkTimes: PlanBriefingWalkTimes | null
  reasonCode: string | null
  reason: string | null
  representativePlaceTitle: string | null
  /** 항목 0개인 날은 그날 일정 카드가 이미 같은 주소로 보낸다 — 버튼을 두 번 두지 않는다 */
  hasItems: boolean
  curve: PlanBriefingCurve
  onRetry: () => void
}) {
  if (walkTimes === null) {
    /*
      **판정은 없지만 곡선은 있을 수 있다** (#716 · 명세 D9-3). 좌표가 `schedule` 에도
      오면서 골든타임 조회만 실패한 날(`LOOKUP_FAILED`)에도 곡선을 받을 수 있게 됐다.

      **창을 넘기지 않는다** — 창·상태의 정본은 브리핑 응답이고 그 응답이 이 날은 판정을
      내지 못했다. 곡선은 근거로만 서고, 화면이 추천 구간을 지어내지 않는다 (명세 D3-3).
    */
    return (
      /* `items-start` 를 쓰지 않는 이유는 아래 정상 갈래와 같다 (곡선이 여기에도 선다) */
      <div className={cn('flex flex-col gap-3 pb-4', INSET_CLASS.card)}>
        <p className="text-body-2 text-fg-muted break-keep">
          {reason ?? messages.plan.briefingWalkUnknown}
        </p>

        {curve.hourly !== null && (
          <WalkTimesCurve hourly={curve.hourly} goldenStart={null} goldenEnd={null} />
        )}

        {/*
          **곡선 실패는 곡선 재시도로 푼다** — 정상 갈래(아래)와 같은 처리다 (명세 D5-4).
          브리핑 재시도로 대신할 수 없다: 재조회 결과가 같은 `LOOKUP_FAILED` 면 좌표가
          그대로라 `queryKey` 가 같고, 에러 상태의 곡선 쿼리는 다시 돌지 않는다 — 눌러도
          곡선이 영원히 오지 않는 자리가 된다.
        */}
        {curve.hourly === null && curve.failed && (
          <div className="flex flex-col items-start gap-1">
            <p className="text-body-2 text-fg-muted">{messages.plan.briefingCurveErrorTitle}</p>
            <RetryButton onRetry={curve.onRetry} />
          </div>
        )}

        {/*
          넷 중 이것만 일시 장애다 — **브리핑 응답**을 다시 부른다 (곡선 재시도가 아니다).
          `aria-label` 로 대상을 밝힌다: 특보 카드도 같은 사유에 같은 버튼을 내므로, 원격
          장애가 둘을 동시에 때리면 이름 없는 `다시 시도` 가 화면에 둘 선다.
        */}
        {reasonCode === BRIEFING_REASON_LOOKUP_FAILED && (
          <RetryButton onRetry={onRetry} label={messages.plan.briefingWalkRetryLabel} />
        )}

        {/*
          **재시도가 아니라 할 일이다.** 그날 장소성 항목이 없어서 못 낸 판정이라 다시
          부를 것이 없고, 사용자가 장소를 담으면 풀린다 — 서버 enum 이 지목한 자리다.

          **항목이 아예 없는 날에는 내지 않는다** — 그날 일정 카드의 `EmptyState` 가 이미
          **같은 주소로** 보내고 있어, 라벨만 다른 버튼 둘이 한 화면에 선다.
        */}
        {reasonCode === BRIEFING_REASON_NO_PLACE_ITEM && hasItems && (
          <ButtonLink href={`/plans/${planId}/days/${day}/add`} variant="secondary" size="md">
            {messages.plan.briefingWalkNoPlaceItemAction}
          </ButtonLink>
        )}
      </div>
    )
  }

  const status = walkTimes.goldenWindowStatus
  const hasWindow = walkTimes.goldenStart !== null && walkTimes.goldenEnd !== null
  const coverageBroken = walkTimes.forecastCoverage?.code === COVERAGE_UNAVAILABLE

  /*
    **`items-start` 를 쓰지 않는다** (S1). 이 컨테이너가 `items-start` 면 자식이 max-content
    로 서서 `WalkTimesCurve` 의 `min-w-0`·`overflow-x-auto` 가 무력해지고, 375 에서 문서
    전체가 가로로 구른다 (실측 `scrollWidth 493 / clientWidth 375`). DESIGN.md 가 "375 에서
    가로 스크롤이 생기면 버그" 라고 못박은 그것이다. 같은 곡선을 쓰는 홈 카드에는
    `items-start` 가 없다 — 그쪽 모양에 맞춘다.
  */
  return (
    <div className={cn('flex flex-col gap-3 pb-4', INSET_CLASS.card)}>
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
          <RetryButton onRetry={curve.onRetry} />
        </div>
      ) : null}

      {/*
        **`UNAVAILABLE` 에만 단다** — 이것만 일시 장애다. `DAY_ENDED` 는 정상이고 자정
        전에는 몇 번을 눌러도 같은 응답이라 버튼을 달면 계속 누른다 (홈과 같은 규칙).
        곡선 조회가 이미 실패해 버튼이 있으면 두 번 두지 않는다.
      */}
      {coverageBroken && !(curve.hourly === null && curve.failed) && (
        <RetryButton onRetry={curve.onRetry} />
      )}

      <p className="text-caption text-fg-muted font-medium break-keep">
        {representativePlaceTitle === null
          ? messages.plan.briefingWalkBasisNoPlace
          : messages.plan.briefingWalkBasis.replace('{title}', representativePlaceTitle)}
      </p>
    </div>
  )
}

/**
 * 44px — 모바일 최소 터치 영역 (DESIGN.md §7). 홈 `NoForecast` 의 버튼과 같은 모양이다.
 *
 * **곡선 전용이 아니다** (#716) — 브리핑 응답의 `LOOKUP_FAILED` 갈래도 같은 버튼을 쓴다.
 * 같은 뜻의 버튼이 화면에 두 모양으로 서지 않게 한다.
 */
function RetryButton({ onRetry, label }: { onRetry: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      /* 같은 라벨의 버튼이 여러 카드에 설 수 있다 — 대상을 접근 이름으로 밝힌다 */
      {...(label === undefined ? {} : { 'aria-label': label })}
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
 *
 * **시각에 등급 색을 주지 않는다**
 * ([#671](https://github.com/8llow8llowMe/hondigagae/issues/671) **A-4** — 홈
 * `walk-times-section` 의 A-3 과 같은 판정이다).
 *
 * #637 이 `11:00 – 23:00 [주의]` 배지를 걷은 이유는 그것이 창 **전체**가 주의라는 말로
 * 읽혔기 때문인데, **배지의 글자는 지웠는데 같은 주장을 하던 색이 여기 남아 있었다.**
 * `goldenLevel` 은 서버 `GoldenWalkWindow.level` 이 창 안 등급을 `worseOf` 로 접은 값이라,
 * 22px 굵은 시각을 그 색으로 칠하면 창 안의 안전한 칸들까지 주의색 아래로 들어간다.
 * #656 으로 곡선의 면이 칸마다 갈린 뒤로는 **이 색만 홀로 "창 하나에 등급 하나" 를
 * 말하고 있었다.**
 *
 * **이 줄이 말하는 것은 등급이 아니라 시각**이다. 등급은 아래 곡선이 칸 단위로 말하고,
 * 색이 유일한 채널이 아니어야 한다는 규칙(DESIGN.md §2-3)도 그쪽에서 지켜진다 —
 * 곡선 셀은 `sr-only` 로 등급 이름을 남긴다. 등급이 빠졌으므로 본문 색(`text-fg`)이다.
 *
 * **A-3 과 다른 점**: 홈에는 창 안 분포를 말하는 문장(`GoldenWindowLevels`)이 색을
 * 이어받았지만, 브리핑 응답에는 `hourly` 가 없어(`PlanBriefingWalkTimes` 주석) 그런 문장을
 * 지을 근거가 없다. 아래 줄은 서버 `goldenWindowStatus.description` 이다 — 곡선을 아직
 * 못 받은 순간에는 등급을 말하는 채널이 화면에 없지만, **틀린 주장을 남겨 두는 것보다
 * 말하지 않는 쪽**이다.
 *
 * **`goldenLevel` 은 응답·타입에서 그대로 받는다.** 화면의 소비처가 없어진 것이지 계약이
 * 바뀐 것이 아니다 (`plan-briefing-section.test.ts` 가 소스로 잠근다).
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
      <p className="text-title-1 text-fg font-bold tabular-nums">
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
