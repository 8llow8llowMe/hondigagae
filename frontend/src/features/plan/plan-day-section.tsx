'use client'

import type { ReactNode } from 'react'

import { Button, ButtonLink } from '@/components/button'
import { RowList } from '@/components/surface'
import { PlanDayVerdict } from '@/features/plan/plan-day-verdict'
import { PlanIndoorAlternatives } from '@/features/plan/plan-indoor-alts'
import { PlanItemRow, type PlanItemVisit } from '@/features/plan/plan-item-row'
import { messages } from '@/lib/messages'
import { weekdayOf } from '@/lib/plan/date'
import type { PlanItemRowModel } from '@/lib/plan/detail'
import type { PlanDaySaveError } from '@/lib/plan/save-error'
import type { PlaceDetail } from '@/types/place'
import type { PlanAlternativePlaceItem, PlanDayWeatherItem } from '@/types/plan'

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
  const weekday = date === null ? null : weekdayOf(date)

  /*
    **체크된 항목이 있을 때만 초기화 경고를 낸다** (#124). 일괄 교체가 그 날의 체크를
    지우는 것은 계약이지만(백엔드 스키마 설명 · screen-inventory §4), 잃을 것이 없는
    날에도 띄우면 경고가 배경음이 되어 정작 잃을 날에 읽히지 않는다.
  */
  const hasVisited = rows.some((row) => row.item.visited)

  return (
    <section aria-labelledby={anchorId} className="px-4 md:px-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-6">
        <h2 id={anchorId} className="text-title-1 text-fg font-bold">
          {messages.plan.dayLabel.replace('{day}', String(day))}
        </h2>
        {date !== null && (
          <span className="text-body-2 text-fg-muted font-medium tabular-nums">
            {date.slice(5)}
            {weekday === null ? '' : ` (${weekday})`}
          </span>
        )}

        {!editing && (
          <div className="ml-auto flex items-center gap-2">
            {/*
              **빈 일자에도 남는다.** 담을 곳이 없는 날이야말로 이 버튼이 필요하다 —
              `순서 편집` 과 달리 항목 수를 보지 않는다.
            */}
            <ButtonLink href={add.href} variant="secondary" size="sm">
              {messages.plan.addPlaceAction}
            </ButtonLink>

            {/*
              **빈 일자에도 남는다** — 빈 날을 채우는 것이 이 기능이 가장 쓸모 있는
              순간이다 (하루재생성-세부명세 R3-2). `순서 편집` 과 달리 항목 수를 보지 않는다.

              **일정 자체가 재생성 대상이 아니면 빠진다** — 항목 수가 아니라 기간 때문이다.
            */}
            {regenerateHref !== null && (
              <ButtonLink href={regenerateHref} variant="secondary" size="sm">
                {messages.plan.regenerateDayAction}
              </ButtonLink>
            )}

            {/* 항목이 없으면 바꿀 순서도 없다 */}
            {rows.length > 0 && (
              <Button variant="secondary" size="sm" onClick={onStartEdit}>
                {messages.plan.editDayAction}
              </Button>
            )}
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
      />

      {editing ? (
        // Row 가 자체 좌우 인셋(px-4 / md:px-10)을 갖는다 — 섹션 인셋을 되돌린다
        <div className="border-border -mx-4 border-t md:-mx-10">{editor}</div>
      ) : rows.length === 0 ? (
        <p className="text-body-2 text-fg-muted border-border border-t py-6">
          {messages.plan.dayEmpty}
        </p>
      ) : (
        <RowList className="border-border -mx-4 border-t md:-mx-10">
          {rows.map((row, index) => (
            <PlanItemRow
              key={row.item.planItemId}
              model={row}
              last={index === rows.length - 1}
              visit={visit.visitOf(row.item.planItemId)}
            />
          ))}
        </RowList>
      )}

      {/* 편집 중에는 감춘다 — 순서를 정리하는 중에 다른 조작을 섞지 않는다 */}
      {!editing && (
        <PlanIndoorAlternatives
          alternatives={verdict?.indoorAlternatives ?? []}
          places={places}
          addedPlaceIds={add.addedPlaceIds}
          pendingPlaceId={add.pendingPlaceId}
          disabled={add.busy}
          error={add.error}
          onAdd={add.onAdd}
        />
      )}
    </section>
  )
}
