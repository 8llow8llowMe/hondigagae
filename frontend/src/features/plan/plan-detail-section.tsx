'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
import { EmptyState } from '@/components/empty-state'
import { MoreIcon } from '@/components/icons'
import { Menu, MenuAnchor } from '@/components/menu'
import { Band } from '@/components/surface'
import { PlanDayEditor } from '@/features/plan/plan-day-editor'
import { PlanDaySection } from '@/features/plan/plan-day-section'
import { PlanDeleteSection } from '@/features/plan/plan-delete-section'
import { PlanEditModal } from '@/features/plan/plan-edit-modal'
import { PlanItemRow } from '@/features/plan/plan-item-row'
import { PlanOverviewPanel } from '@/features/plan/plan-overview-panel'
import { PlanStatusAction } from '@/features/plan/plan-status-action'
import { usePlanAddPlace } from '@/features/plan/use-plan-add-place'
import { usePlanDayEdit } from '@/features/plan/use-plan-day-edit'
import { useUnsavedWarning } from '@/lib/form/use-unsaved-warning'
import { toLatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
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
  petPending,
  places,
  missingPlaces,
  weather,
  weatherFailed,
  onRetryWeather,
  today,
}: {
  plan: PlanDetail
  pet: Pet | null
  petPending: boolean
  places: Map<string, PlaceDetail>
  /** 장소 조회가 404 인 placeId. 편집모드가 `PLAN_004` 후보를 미리 짚는 데 쓴다 */
  missingPlaces: Set<string>
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

  const coordOf = (item: { targetId: string | null }) => {
    const place = item.targetId === null ? undefined : places.get(item.targetId)
    return place === undefined ? null : toLatLng(place)
  }

  return (
    <div className="rail-layout">
      <aside>
        <PlanOverviewPanel
          plan={plan}
          pet={pet}
          petPending={petPending}
          today={today}
          verdicts={weather?.days ?? []}
        />
      </aside>

      <div className="border-border lg:border-l">
        <PlanDetailMenuBar plan={plan} />

        {days.map((group) => (
          <div key={group.day}>
            <Band />
            <PlanDaySection
              day={group.day}
              date={addPlanDays(plan.startDate, group.day - 1)}
              rows={toItemRows(group.items, coordOf, lodgingBasisFor(group.day, days))}
              places={places}
              verdict={weather?.days.find((entry) => entry.day === group.day)}
              petConditionApplied={weather?.petConditionApplied ?? true}
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
              editor={
                editingDay !== group.day ? null : (
                  <PlanDayEditor
                    items={edit.items}
                    missing={missingPlaces}
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

        <PlanOutOfRangeSection items={outOfRange} places={places} />

        <Band />
        <PlanStatusAction plan={plan} />
        <PlanDeleteSection planId={plan.planId} title={plan.title} />
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
 * 더보기 메뉴 — 이름·예산 수정 · 일정 삭제.
 *
 * icon-only 라 `aria-label` 이 접근 가능한 이름이다 (D6). 키보드 순회는 `Menu` 가
 * 이미 보장한다.
 */
function PlanDetailMenuBar({ plan }: { plan: PlanDetail }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="flex justify-end px-4 pt-4 md:px-10">
      <MenuAnchor>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={messages.plan.manageLabel}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          leading={<MoreIcon size={20} />}
          onClick={() => setMenuOpen((open) => !open)}
        />
        <Menu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          triggerRef={triggerRef}
          label={messages.plan.manageLabel}
          className="top-full right-0 mt-1"
          items={[
            {
              label: messages.plan.editAction,
              onSelect: () => {
                setMenuOpen(false)
                setEditOpen(true)
              },
            },
          ]}
        />
      </MenuAnchor>

      <PlanEditModal plan={plan} open={editOpen} onClose={() => setEditOpen(false)} />
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
function PlanOutOfRangeSection({
  items,
  places,
}: {
  items: PlanDetail['items']
  places: Map<string, PlaceDetail>
}) {
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
            <PlanItemRow
              key={row.item.planItemId}
              model={row}
              place={row.item.targetId === null ? undefined : places.get(row.item.targetId)}
              last={index === rows.length - 1}
            />
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
