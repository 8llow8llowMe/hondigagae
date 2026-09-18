'use client'

import type { ReactNode } from 'react'

import { Button, ButtonLink } from '@/components/button'
import { ErrorState } from '@/components/error-state'
import { Surface, SurfaceList } from '@/components/surface'
import { PlanDayOverflowMenu } from '@/features/plan/plan-day-overflow-menu'
import { PlanDayVerdict } from '@/features/plan/plan-day-verdict'
import { PlanIndoorAlternatives } from '@/features/plan/plan-indoor-alts'
import { PlanItemRow, type PlanItemVisit } from '@/features/plan/plan-item-row'
import { messages } from '@/lib/messages'
import { formatPlanDay } from '@/lib/plan/date'
import type { PlanItemRowModel } from '@/lib/plan/detail'
import type { PlanDaySaveError } from '@/lib/plan/save-error'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlaceDetail } from '@/types/place'
import type {
  PlanAlternativePlaceItem,
  PlanDayWeatherItem,
  PlanItemWalkSafetyItem,
} from '@/types/plan'

/**
 * 이 일자에 장소를 담는 데 필요한 것 한 묶음.
 *
 * **두 진입점(`장소 추가` 라우트 · 실내 대안 `담기`)이 같은 저장을 쓴다** (F0) —
 * 한 덩어리로 내려야 두 곳이 같은 진행/실패 상태를 본다.
 */
export type PlanDayAdd = {
  /** `장소 추가` 가 가는 곳. 모달이 아니라 라우트다 (F5-1) */
  href: string
  /** **이 일자에** 이미 담긴 장소 */
  addedPlaceIds: Set<string>
  /**
   * **이 일자에서** 담는 중인 장소. 호출부가 일자로 좁혀 넘긴다 — 같은 장소가 두 일자의
   * 실내 대안일 수 있어(연속 우천일) 좁히지 않으면 두 행이 함께 진행 표시를 낸다.
   */
  pendingPlaceId: string | null
  /** 다른 일자를 포함해 담기가 진행 중이다. 그동안 모든 담기 버튼을 잠근다 */
  busy: boolean
  /** **이 일자에서** 난 실패만. 좁히지 않으면 안 누른 일자에도 오류가 남는다 */
  error: PlanDaySaveError | null
  onAdd: (alternative: PlanAlternativePlaceItem) => void
}

/**
 * 이 일자의 방문 체크 한 묶음 — 이슈 #124.
 *
 * 훅은 화면 전체에 하나뿐이므로 **항목 단위로 좁혀서 행에 내려 준다** — 좁히지 않으면
 * 한 항목에서 난 실패가 모든 행에 뜬다 (담기와 같은 판단).
 */
export type PlanDayVisit = {
  visitOf: (planItemId: string) => PlanItemVisit
}

/**
 * 이 일자의 항목 산책 위험도 (#625). **판정·상세와 별도 조회**라 호출부가 좁혀서 내려
 * 준다 — 방문 체크·담기와 같은 판단이다.
 */
export type PlanDayWalkSafety = {
  /** 그 항목의 판정. 없으면 아직 안 왔거나 응답에 없는 것이지 오류가 아니다 (D15-6) */
  of: (planItemId: string) => PlanItemWalkSafetyItem | undefined
  /**
   * `BEYOND_FORECAST_RANGE` 를 이 일자 단위로 접은 문장 — `lib/plan/walk-safety.ts` 의
   * `dayBeyondForecastReason()` 가 계산한다. 없으면 `null` 이다.
   */
  beyondForecastReason: string | null
  /**
   * 전체 조회가 5xx·무응답으로 실패했다. **일정 전체에 하나뿐인 사실**이라 호출부가
   * 한 일자에만 `true` 를 준다 — 여러 일자 카드에 같은 오류·재시도를 중복해 세우지
   * 않는다(D15-7 "재시도 버튼은 일자마다가 아니라 한 번").
   */
  failed: boolean
  /**
   * 이 일자에 `LOOKUP_FAILED` 항목이 있다. **문장은 각 행이 이미 보여 준다** — 이 값은
   * 일자 카드에 재시도 버튼을 하나 세울지만 가른다.
   */
  hasLookupFailed: boolean
  /** `planKeys.walkSafety(planId)` 재조회. 전체 실패·`LOOKUP_FAILED` 재시도가 같은 함수다 */
  onRetry: () => void
}

/** 좌측 목차의 앵커 대상. 목차와 제목이 같은 규칙으로 id 를 만들어야 링크가 맞는다 */
export function planDayAnchorId(day: number): string {
  return `day${day}`
}

/**
 * 한 일자 — 판정 + 항목들 + 실내 대안.
 *
 * **일자 안은 1px 선으로 잇는다.** 8px 밴드는 일자 경계에만 쓴다 — 밴드가 일자를
 * 나누는 유일한 신호이므로 안쪽에서 쓰면 신호가 죽는다 (아트보드 01 주석).
 *
 * `<section aria-labelledby>` 가 `<h2 id>` 를 가리킨다 (D6).
 */
export function PlanDaySection({
  day,
  date,
  rows,
  places,
  verdict,
  petConditionApplied,
  basisPetName,
  verdictFailed,
  onRetryVerdict,
  editing,
  onStartEdit,
  editor,
  add,
  visit,
  walkSafety,
  regenerateHref,
}: {
  day: number
  /** `YYYY-MM-DD`. 서버 판정의 날짜가 아니라 일정 기간에서 계산한 값이다 */
  date: string | null
  rows: PlanItemRowModel[]
  /** placeId → 보강 결과. **실내 대안 전용이다** — 항목은 자기 `place` 를 들고 온다 */
  places: Map<string, PlaceDetail>
  verdict: PlanDayWeatherItem | undefined
  petConditionApplied: boolean
  /** 이 일자 판정의 기준 반려견 이름 (#176). 한 마리 일정이면 null */
  basisPetName: string | null
  verdictFailed: boolean
  onRetryVerdict: () => void
  /** 이 일자가 편집 중이다. **한 번에 한 일자만 연다** — 일괄 교체 단위가 일자다 (E0) */
  editing: boolean
  onStartEdit: () => void
  /** 편집 중일 때 항목 목록 자리에 들어간다 */
  editor: ReactNode
  add: PlanDayAdd
  visit: PlanDayVisit
  /** 이 일자의 항목 산책 위험도 (#625) */
  walkSafety: PlanDayWalkSafety
  /**
   * `다시 만들기` 가 가는 곳 (#128). `장소 추가` 와 같이 모달이 아니라 라우트다.
   *
   * **`null` 이면 진입점을 내지 않는다.** 제출(`POST /ai-plans`)이 재생성 검증 앞에서
   * 시작일과 일수를 보므로(`dayRegenerateBlock`) 이미 시작한 여행과 11일 이상 일정은
   * 눌러도 늘 400 이다 — 누를 수 없는 버튼을 보여 주는 대신 뺀다 (`AiPlanFailed.manualHref`
   * 와 같은 판단). **어느 일정이 그런지는 호출부가 안다** — 여기는 `startDate` 를 모른다.
   */
  regenerateHref: string | null
}) {
  const anchorId = planDayAnchorId(day)
  /*
    **날짜 모양은 `formatPlanDay` 한 곳이 소유한다** (#732). 예전에는 여기서 `date.slice(5)`
    로 잘라 `09-19 (토)` 를 만들었는데, 같은 화면의 개요는 `2026-09-19 (토)` 였다 — 한 날을
    두 모양으로 부르는 셈이라 어느 쪽이 기준인지 화면이 말하지 못했다.
  */
  const dayLabel = date === null ? null : formatPlanDay(date)

  /*
    **체크된 항목이 있을 때만 초기화 경고를 낸다** (#124). 일괄 교체가 그 날의 체크를
    지우는 것은 계약이지만(백엔드 스키마 설명 · screen-inventory §4), 잃을 것이 없는
    날에도 띄우면 경고가 배경음이 되어 정작 잃을 날에 읽히지 않는다.
  */
  const hasVisited = rows.some((row) => row.item.visited)

  /*
    **L1 카드 하나다** (`DESIGN.md §0`, #447). 이름은 `aria-label` 이다 — 헤더가 `N일차 ·
    날짜 · 버튼 셋`을 한 줄에 그리고 390 에서는 버튼이 다음 줄로 접혀야 해서 `Surface` 의
    `title` 슬롯(제목 + 우측 액션, 접히지 않음)에 맞지 않는다. `h2` 의 `id` 는 개요의 판정
    목차가 앵커로 쓰므로 그대로 둔다.

    좌우 인셋은 카드 안 값(16/20)이고, 항목 목록은 카드 폭을 다 쓰며 위 1px 선으로 헤더와
    갈린다 — 구분선은 `SurfaceList` 가 항목 사이에만 긋는다.
  */
  return (
    <Surface aria-label={messages.plan.dayLabel.replace('{day}', String(day))}>
      <div className={INSET_CLASS.card}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-5">
          <h2 id={anchorId} className="text-title-1 text-fg font-bold">
            {messages.plan.dayLabel.replace('{day}', String(day))}
          </h2>
          {dayLabel !== null && (
            <span className="text-body-2 text-fg-muted font-medium tabular-nums">{dayLabel}</span>
          )}

          {/*
            **액션은 이 줄을 떠났다** (#653 · 진단 PL-4 · 명세 D11-4). 390 실측에서 액션 셋이
            `top 749`, 판정이 `top 781` — 그 날 갈 수 있는지를 말하는 판정보다 **도구가
            32px 위**였다. 남은 것은 `다시 만들기` 하나이고, 그것도 오버플로 안이다.
          */}
          {!editing && regenerateHref !== null && (
            <div className="ml-auto">
              <PlanDayOverflowMenu day={day} regenerateHref={regenerateHref} />
            </div>
          )}
        </div>

        {/*
        일괄 교체 모델과 부딪히는 지점을 화면이 먼저 말한다 (#124). 편집·담기 두 진입점이
        모두 이 줄 위의 버튼에서 시작하므로 경고를 그 아래 한 번만 둔다.
        **편집 중에는 감춘다** — 그때는 편집기 자체가 저장 지점을 들고 있다.
      */}
        {!editing && hasVisited && (
          <p className="text-caption text-fg-muted mt-2 font-medium">
            {messages.plan.visitResetNotice}
          </p>
        )}

        <PlanDayVerdict
          verdict={verdict}
          petConditionApplied={petConditionApplied}
          basisPetName={basisPetName}
          failed={verdictFailed}
          onRetry={onRetryVerdict}
          /*
            **아래 빈 일차 안내와 같은 말을 두 번 하지 않게 한다** (#497). 항목이 없는 날은
            `이 날은 아직 담은 곳이 없어요.` 가 이미 그 사실을 말하므로 판정 자리의 서버
            문장(`NO_PLACE_ITEM`)이 빠진다.
          */
          dayHasItems={rows.length > 0}
        />

        {/*
          항목 산책 위험도 — 일자 단위 알림 (#625 · 명세 D15-7).

          **전체 5xx 는 일정 전체에 한 번뿐이다** — 호출부가 한 일자에만 `failed: true` 를
          준다(D15-7 "재시도 버튼은 일자마다가 아니라 한 번"). `BEYOND_FORECAST_RANGE` 는
          그 일자 항목이 전부 같은 사유일 때만(`dayBeyondForecastReason()`) 한 줄로 접는다
          — 서버 판정이 날짜만의 함수라 접어도 잃는 것이 없다. **`LOOKUP_FAILED` 재시도는
          문장이 아니라 버튼만 낸다** — 서버 문장은 각 행이 이미 보여 준다.
        */}
        {walkSafety.failed ? (
          <ErrorState
            title={messages.plan.walkSafetyErrorTitle}
            retryLabel={messages.plan.walkSafetyRetryAction}
            onRetry={walkSafety.onRetry}
            inset="card"
            headingLevel={3}
            className="px-0 py-4 md:px-0"
          />
        ) : walkSafety.beyondForecastReason !== null ? (
          <p className="text-caption text-fg-muted mt-2 font-medium">
            {walkSafety.beyondForecastReason}
          </p>
        ) : (
          walkSafety.hasLookupFailed && (
            <div className="pt-2">
              <Button variant="secondary" size="sm" onClick={walkSafety.onRetry}>
                {messages.plan.walkSafetyRetryAction}
              </Button>
            </div>
          )
        )}
      </div>

      {editing ? (
        // 편집기 행이 카드 인셋을 스스로 갖는다 — 목록은 카드 폭을 다 쓴다
        <div className="border-border border-t">{editor}</div>
      ) : rows.length === 0 ? (
        <p
          className={cn('text-body-2 text-fg-muted border-border border-t py-6', INSET_CLASS.card)}
        >
          {messages.plan.dayEmpty}
        </p>
      ) : (
        <SurfaceList className="border-border border-t">
          {rows.map((row) => (
            <PlanItemRow
              key={row.item.planItemId}
              model={row}
              visit={visit.visitOf(row.item.planItemId)}
              walkSafety={walkSafety.of(row.item.planItemId)}
            />
          ))}
        </SurfaceList>
      )}

      {/*
        ── 액션 줄 — **판정과 항목을 읽은 뒤에 온다** (#653 · 진단 PL-4 · 명세 D11-4)

        예전에는 제목 줄 오른쪽이라 판정보다 위였다. 읽는 순서(이 날 갈 만한가 → 어디를
        담았나 → 고칠까)와 탭 순서가 이제 같다.

        **`다시 만들기` 는 여기 없다** — 하루를 통째로 갈아엎는 것이라 나머지 둘과 무게가
        달라 제목 줄의 `⋯` 안이다.

        편집 중에는 감춘다 — 그때는 편집기가 저장 지점을 들고 있다.

        **`pb-5` 를 준다.** 다음에 오는 `PlanIndoorAlternatives` 는 대안이 없으면 `null`
        이라(`plan-indoor-alts.tsx`), **비 예보가 없는 날 = 대부분의 날**은 이 줄이 카드의
        마지막 요소다 — 아래 여백이 없으면 버튼이 카드 테두리에 붙는다(실측 1px).
        헤더의 `pt-5` 와 짝을 맞춘다.
      */}
      {!editing && (
        <div className={cn('flex flex-wrap items-center gap-2 pt-3 pb-5', INSET_CLASS.card)}>
          {/*
            **빈 일자에도 남는다.** 담을 곳이 없는 날이야말로 이 버튼이 필요하다 —
            `순서 편집` 과 달리 항목 수를 보지 않는다.
          */}
          <ButtonLink href={add.href} variant="secondary" size="sm">
            {messages.plan.addPlaceAction}
          </ButtonLink>

          {/* 항목이 없으면 바꿀 순서도 없다 */}
          {rows.length > 0 && (
            <Button variant="secondary" size="sm" onClick={onStartEdit}>
              {messages.plan.editDayAction}
            </Button>
          )}
        </div>
      )}

      {/* 편집 중에는 감춘다 — 순서를 정리하는 중에 다른 조작을 섞지 않는다 */}
      {!editing && (
        <div className={INSET_CLASS.card}>
          <PlanIndoorAlternatives
            alternatives={verdict?.indoorAlternatives ?? []}
            places={places}
            addedPlaceIds={add.addedPlaceIds}
            pendingPlaceId={add.pendingPlaceId}
            disabled={add.busy}
            error={add.error}
            onAdd={add.onAdd}
          />
        </div>
      )}
    </Surface>
  )
}
