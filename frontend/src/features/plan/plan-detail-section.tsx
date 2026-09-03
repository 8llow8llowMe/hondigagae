'use client'

import { useState } from 'react'

import { Banner } from '@/components/banner'
import { ConfirmModal } from '@/components/confirm-modal'
import { EmptyState } from '@/components/empty-state'
import { EmergencyIcon } from '@/components/icons'
import { Band } from '@/components/surface'
import { PlanDayEditor } from '@/features/plan/plan-day-editor'
import { PlanDaySection } from '@/features/plan/plan-day-section'
import { PlanItemRow } from '@/features/plan/plan-item-row'
import { PlanManageMenu } from '@/features/plan/plan-manage-menu'
import { PlanOverviewPanel } from '@/features/plan/plan-overview-panel'
import { PlanPackingList } from '@/features/plan/plan-packing-list'
import { PlanStatusAction } from '@/features/plan/plan-status-action'
import { usePlanAddPlace } from '@/features/plan/use-plan-add-place'
import { usePlanDayEdit } from '@/features/plan/use-plan-day-edit'
import { usePlanVisit } from '@/features/plan/use-plan-visit'
import { useUnsavedWarning } from '@/lib/form/use-unsaved-warning'
import { messages } from '@/lib/messages'
import { basisPetNameOf } from '@/lib/plan/basis-pet'
import { addPlanDays } from '@/lib/plan/date'
import { placeIdsOf } from '@/lib/plan/day-items'
import {
  groupItemsByDay,
  lodgingBasisFor,
  type PlanItemRowModel,
  toItemRows,
} from '@/lib/plan/detail'
import type { Pet } from '@/types/pet'
import type { PlaceDetail } from '@/types/place'
import type { PlanDetail, PlanWeatherResponse } from '@/types/plan'

/**
 * 일정 상세 레이아웃 — 좌 레일(개요) + 우 본문(일자 섹션).
 *
 * **`.rail-layout` 을 그대로 쓰고 `.rail-layout-detail` 변형은 쓰지 않는다.** 그 변형은
 * DOM 순서와 데스크톱 배치가 다른 장소 상세용이다. 일정 상세는 모바일에서도 개요가 맨
 * 위라 **DOM 순서 그대로(aside 먼저)** 두면 두 레이아웃이 같이 성립한다 (D1).
 *
 * 열 구분선은 우측 열의 `lg:border-l` 이다 — sticky 인 좌측 열에 걸면 선이 끊긴다.
 */
export function PlanDetailSection({
  plan,
  pet,
  pets,
  petPending,
  places,
  weather,
  weatherFailed,
  onRetryWeather,
  today,
}: {
  plan: PlanDetail
  /** 개요 카드가 쓰는 대표 반려견. 조회 실패·삭제면 null 이고 카드만 빠진다 */
  pet: Pet | null
  /**
   * 회원의 반려견 전체 (#176). **일자 판정의 기준 아이 이름을 찾는 데만 쓴다** —
   * 이 일정에 없는 아이가 섞여 있어도 `basisPetId` 로만 조회하므로 문제가 없다.
   */
  pets: readonly Pet[]
  petPending: boolean
  /** placeId → 보강 결과. **실내 대안 전용이다** — 항목은 자기 `place` 를 들고 온다 */
  places: Map<string, PlaceDetail>
  weather: PlanWeatherResponse | undefined
  weatherFailed: boolean
  onRetryWeather: () => void
  today: Date
}) {
  const { days, outOfRange } = groupItemsByDay(plan.items, plan.totalDays)

  /**
   * **한 번에 한 일자만 편집한다** — 일괄 교체 단위가 일자다 (E0).
   * `pendingDay` 는 편집 중에 다른 일자를 눌렀을 때 확인 모달이 들고 있는 대상이다.
   */
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [pendingDay, setPendingDay] = useState<number | null>(null)
  const [discarding, setDiscarding] = useState(false)

  const edit = usePlanDayEdit({
    planId: plan.planId,
    onSaved: () => setEditingDay(null),
  })

  /*
    실내 대안 `담기`. **장소 추가 화면과 같은 훅이다** — 둘 다 같은 일괄 교체 저장이라
    후처리(캐시 갱신 · 판정 무효화 · 토스트)가 갈리면 안 된다 (F0).
  */
  const addPlace = usePlanAddPlace({ planId: plan.planId })

  /*
    방문 체크 (#124). **담기·편집과 달리 항목별로 동시에 진행할 수 있다** — 일괄 교체가
    아니라 항목 한 행만 바꾸므로 두 요청이 겹쳐도 한쪽이 사라지지 않는다. 그래서 전역
    잠금이 없고 진행·실패를 `planItemId` 로 든다.
  */
  const visit = usePlanVisit({ planId: plan.planId })

  // 편집한 것을 브라우저 이탈로 잃지 않게 한다. 저장 중은 제외한다 (form-guide.md §7)
  useUnsavedWarning(edit.dirty && !edit.saving)

  function openEditor(day: number) {
    const group = days[day - 1]
    if (group === undefined) return
    setEditingDay(day)
    edit.start(group.items)
  }

  /** 편집 중이면 먼저 묻는다. 아니면 바로 연다 */
  function requestEditor(day: number) {
    if (editingDay !== null && edit.dirty) {
      setPendingDay(day)
      setDiscarding(true)
      return
    }
    openEditor(day)
  }

  function requestCancel() {
    if (edit.dirty) {
      // 대상이 없으면 "닫기" 다
      setPendingDay(null)
      setDiscarding(true)
      return
    }
    setEditingDay(null)
  }

  /*
    petId → 이름. **일자마다 다시 만들지 않는다** — 기준 아이는 날마다 다를 수 있어
    조회가 일수만큼 일어난다.
  */
  const petNames = new Map(pets.map((candidate) => [candidate.petId, candidate.name]))

  return (
    <div className="rail-layout">
      <aside>
        <PlanOverviewPanel
          plan={plan}
          pet={pet}
          petPending={petPending}
          today={today}
          verdicts={weather?.days ?? []}
          /* 관리 진입점은 일정의 신원 옆에 둔다 — `PlanManageMenu` 주석 참고 */
          menu={<PlanManageMenu plan={plan} />}
        />

        {/*
          준비물 (#155). **개요 바로 아래, 좌측 레일이다** — 일정 전체를 근거로 만드는
          것이라 특정 일자 옆에 두면 그 날 것으로 읽힌다.
        */}
        <PlanPackingList planId={plan.planId} />

        {/*
          응급 브리핑 진입점 (#125). **배너 하나만 둔다** — 응답이 일자 × 방문 장소 ×
          최대 3곳이라 여기 펼치면 개요·준비물이 그만큼 밀린다. 홈이 `/emergency` 를
          배너로 여는 것과 같은 형태다.

          **상시로 둔다.** 담긴 장소가 없으면 브리핑이 비지만, 그 사실도 들어가서 봐야
          알 수 있다 — 진입점을 감추면 기능이 있는 줄도 모른다.
        */}
        <Banner
          href={`/plans/${plan.planId}/emergency`}
          title={messages.plan.emergencyHeading}
          description={messages.plan.emergencyBannerDescription}
          leading={<EmergencyIcon size={24} />}
          inset="rail"
        />
      </aside>

      <div className="border-border lg:border-l">
        {days.map((group, index) => (
          <div key={group.day}>
            {/*
              **첫 일자 위에는 밴드를 두지 않는다.** 밴드는 "여기서 다른 이야기가
              시작된다" 는 신호인데(`surface.tsx`), 열 맨 위에서는 앞에 끊을 것이
              없어 신호가 아니라 두꺼운 회색 띠 하나로만 보였다.
            */}
            {index > 0 && <Band />}
            <PlanDaySection
              day={group.day}
              date={addPlanDays(plan.startDate, group.day - 1)}
              rows={toItemRows(group.items, lodgingBasisFor(group.day, days))}
              places={places}
              verdict={weather?.days.find((entry) => entry.day === group.day)}
              petConditionApplied={weather?.petConditionApplied ?? true}
              basisPetName={basisPetNameOf(
                weather?.days.find((entry) => entry.day === group.day)?.basisPetId ?? null,
                plan.petIds,
                petNames,
              )}
              verdictFailed={weatherFailed}
              onRetryVerdict={onRetryWeather}
              editing={editingDay === group.day}
              onStartEdit={() => requestEditor(group.day)}
              add={{
                href: `/plans/${plan.planId}/days/${group.day}/add`,
                addedPlaceIds: placeIdsOf(group.items),
                /*
                  **일자로 좁혀 넘긴다.** 훅은 화면 전체에 하나뿐이라, 좁히지 않으면
                  3일차에서 난 실패가 실내 대안 블록이 있는 **모든 일자**에 뜨고
                  같은 장소가 두 일자의 대안일 때 두 행이 함께 스피너를 낸다.
                */
                pendingPlaceId:
                  addPlace.pending?.day === group.day ? addPlace.pending.placeId : null,
                busy: addPlace.adding,
                error: addPlace.failure?.target.day === group.day ? addPlace.failure.error : null,
                onAdd: (alternative) =>
                  addPlace.add({
                    day: group.day,
                    // **그 일자의 현재 항목 전부**를 되싣는다 — 일괄 교체다 (E1)
                    dayItems: group.items,
                    place: alternative,
                  }),
              }}
              visit={{
                visitOf: (planItemId) => ({
                  pending: visit.pending.has(planItemId),
                  error: visit.failures.get(planItemId) ?? null,
                  onToggle: (next) => visit.toggle(planItemId, next),
                }),
              }}
              editor={
                editingDay !== group.day ? null : (
                  <PlanDayEditor
                    items={edit.items}
                    dirty={edit.dirty}
                    saving={edit.saving}
                    error={edit.error}
                    announcement={edit.announcement}
                    focusTarget={edit.focusTarget}
                    onClearFocus={edit.clearFocus}
                    onMove={edit.move}
                    onToggleRemoved={edit.toggle}
                    onSave={() => edit.save(group.day)}
                    onCancel={requestCancel}
                  />
                )
              }
            />
          </div>
        ))}

        <PlanOutOfRangeSection items={outOfRange} />

        <Band />
        <PlanStatusAction plan={plan} />
      </div>

      {/*
        편집한 것을 말없이 버리지 않는다 (E4). 되돌릴 수 없는 확인이라 `ConfirmModal`
        이고, 기본 포커스가 취소라 Enter 한 번에 편집이 사라지지 않는다.
      */}
      <ConfirmModal
        open={discarding}
        onClose={() => {
          setDiscarding(false)
          setPendingDay(null)
        }}
        onConfirm={() => {
          setDiscarding(false)
          if (pendingDay === null) setEditingDay(null)
          else openEditor(pendingDay)
          setPendingDay(null)
        }}
        title={messages.plan.editDiscardTitle}
        description={messages.plan.editDiscardDescription}
        confirmLabel={messages.plan.editDiscardConfirm}
        cancelLabel={messages.plan.editCancel}
        destructive
      />
    </div>
  )
}

/**
 * 여행 기간 밖 항목.
 *
 * 서버가 기간을 줄여도 항목을 정리하지 않아 생기는 고아 항목이다
 * (`PlanCommandProcessor.updatePlan`). **숨기지 않는다** — 숨기면 사용자가 자료가
 * 사라진 것을 모른다 (D4). 거리는 재지 않는다 — 어느 일자의 흐름에도 속하지 않는다.
 */
function PlanOutOfRangeSection({ items }: { items: PlanDetail['items'] }) {
  if (items.length === 0) return null

  const rows: PlanItemRowModel[] = items.map((item) => ({
    item,
    distanceMeters: null,
    distanceKind: null,
  }))

  return (
    <>
      <Band />
      <section aria-labelledby="plan-out-of-range" className="px-4 pt-6 md:px-10">
        <h2 id="plan-out-of-range" className="text-title-1 text-fg font-bold">
          {messages.plan.outOfRangeTitle}
        </h2>
        <p className="text-body-2 text-fg-muted mt-1">{messages.plan.outOfRangeDescription}</p>

        <ul className="border-border -mx-4 mt-4 border-t md:-mx-10">
          {rows.map((row, index) => (
            <PlanItemRow key={row.item.planItemId} model={row} last={index === rows.length - 1} />
          ))}
        </ul>
      </section>
    </>
  )
}

/** 일자가 하나도 없는 일정 — `totalDays` 가 0 이하일 때만 나온다 (서버 결함) */
export function PlanNoDays() {
  return <EmptyState title={messages.plan.dayEmpty} />
}
