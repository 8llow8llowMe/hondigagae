'use client'

import { useState } from 'react'

import { Banner } from '@/components/banner'
import { ConfirmModal } from '@/components/confirm-modal'
import { EmergencyIcon } from '@/components/icons'
import { Surface, SurfaceList, SurfaceStack } from '@/components/surface'
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
import { dayRegenerateBlock } from '@/lib/ai-plan/regenerate'
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
 * 위라 **DOM 순서 그대로(레일 먼저)** 두면 두 레이아웃이 같이 성립한다 (D1).
 *
 * **3층 표면이다** (`DESIGN.md §0`, 이슈 #447). `main` 이 L0 바닥(`Canvas`, 페이지가 건다),
 * 좌 레일과 우 열이 각각 `SurfaceStack` 으로 L1 카드를 쌓는다. **열 구분선과 밴드를
 * 걷었다** — 카드 사이·열 사이로 바닥이 비쳐 L0 이 그 일을 한다 (홈 #428 과 같은 구조).
 *
 * **카드 판정**:
 * - 제목 줄(제목 · 상태 · 기간 · D-day · 동행 반려견)도 **카드다** (#553) — 판정 3문에
 *   셋 다 걸린다. 근거는 `PlanOverviewPanel` 머리주석이 정본이다.
 * - 좌 레일 카드 넷: `개요` · `일자별 판정` 목차 · `준비물` · `병원 배너`(홈이 배너를 카드에
 *   넣는 것과 같다 — 상시 진입점은 자기 카드를 갖지 않지만 레일의 한 이야기 "위급하면" 은 카드다).
 * - 우 열은 **일자마다 카드 하나** (`PlanDaySection`), 기간 밖 항목도 카드.
 * - 확정 버튼은 **액션이라 카드가 아니다** — 개요 카드 아래, 바닥 위에 선다 (#553).
 */
export function PlanDetailSection({
  plan,
  companions,
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
  /** 이 일정의 동행 반려견, `petIds` 순서 (#218). 못 찾은 아이는 빠진다 */
  companions: readonly Pet[]
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

  /*
    **하루 재생성 진입점을 낼 수 있는 일정인가** (#128). 제출은 이 일정의 기간을 그대로
    싣는데 `POST /ai-plans` 가 재생성 검증 앞에서 시작일(`AIPLAN_017`)과 일수
    (`AIPLAN_018`)를 본다 — 이미 시작한 여행과 11일 이상 일정은 눌러도 늘 400 이다.
    **일자마다 다시 판정하지 않는다** — 일정 하나에 대한 답이 하루마다 다를 수 없다.
  */
  const regenerateBlocked = dayRegenerateBlock(plan, today) !== null

  return (
    <div className="rail-layout">
      {/*
        **레일을 고정하지 않는다 — 페이지가 레일만큼 길어진다.**

        레일은 자기 높이대로 서고, grid 행 높이가 `max(좌, 우)` 가 되어 페이지가 그만큼
        늘어난다. `.rail-layout` 의 `min-block-size: 100dvh - 헤더` 는 최소값이므로 레일이
        더 길면 그쪽이 이긴다.

        **고정을 두 번 시도했다가 걷었다.** 처음에는 `lg:sticky lg:self-start` 였는데, 개요가
        카드가 되고 확정 액션까지 레일로 들어오면서(#553) 초안 일정의 레일이 1000px 을
        넘었다 — **고정된 요소가 뷰포트보다 길면 아래쪽이 화면 밖에 영원히 남는다.**
        그래서 `rail-sticky`(자기 스크롤)로 바꿨더니 이번엔 **레일 안에 세로 막대**가 떴다.

        둘 다 "레일이 뷰포트보다 길다" 는 같은 사실의 다른 증상이다. 고정을 걷으면 그 사실
        자체가 문제가 아니게 된다 — 레일 아래쪽은 페이지를 굴리면 그대로 올라온다.

        **치르는 값**: 우측 일자 카드를 길게 내려가면 개요와 확정 버튼이 화면에서 사라진다.
        "짧으면 고정, 길면 흐름" 은 CSS 로 쓸 수 없어(고정 요소의 높이를 조건으로 걸 수단이
        없다) 둘 중 하나를 골라야 했고, **손이 닿지 않는 쪽보다 사라지는 쪽**을 골랐다.

        `PlanOverviewPanel` 안쪽에 고정을 되살리지 않는다 — 첫 블록만 고정하면 준비물·병원
        배너가 그 위로 올라와 글자가 겹친다 (실측 scrollY=700: 개요 top 64~519 고정,
        준비물 top −181, 배너 top −18).
      */}
      <SurfaceStack>
        <PlanOverviewPanel
          plan={plan}
          companions={companions}
          petPending={petPending}
          today={today}
          verdicts={weather?.days ?? []}
          /* 관리 진입점은 일정의 신원 옆에 둔다 — `PlanManageMenu` 주석 참고 */
          menu={<PlanManageMenu plan={plan} />}
          /*
            **확정 액션이 개요 카드 바로 아래다** (이슈 #553). 예전에는 우측 일자 열의
            **맨 끝**이라, 3일 일정이면 마지막 날 카드까지 굴려야 버튼이 나왔다 — 초안을
            확정하는 것은 특정 일자가 아니라 **일정 전체**의 상태 변경인데 자리가 마지막
            일자에 딸린 것처럼 읽혔다.

            **상태 배지 바로 아래가 맞는 자리다.** `초안 → 확정` 은 그 배지가 말하는 값을
            바꾸는 일이고, 좌측 레일은 lg 에서 자기 스크롤을 갖는 열이라 일자 카드를
            아무리 굴려도 버튼이 시야에서 사라지지 않는다.
          */
          action={<PlanStatusAction plan={plan} />}
        />

        {/*
          준비물 (#155). **개요 바로 아래, 좌측 레일이다** — 일정 전체를 근거로 만드는
          것이라 특정 일자 옆에 두면 그 날 것으로 읽힌다.
        */}
        <Surface aria-label={messages.plan.packingHeading}>
          <PlanPackingList planId={plan.planId} />
        </Surface>

        {/*
          응급 브리핑 진입점 (#125). **배너 하나만 둔다** — 응답이 일자 × 방문 장소 ×
          최대 3곳이라 여기 펼치면 개요·준비물이 그만큼 밀린다. 홈이 `/emergency` 를
          배너로 여는 것과 같은 형태다.

          **상시로 둔다.** 담긴 장소가 없으면 브리핑이 비지만, 그 사실도 들어가서 봐야
          알 수 있다 — 진입점을 감추면 기능이 있는 줄도 모른다.
        */}
        <Surface>
          <Banner
            href={`/plans/${plan.planId}/emergency`}
            title={messages.plan.emergencyHeading}
            description={messages.plan.emergencyBannerDescription}
            leading={<EmergencyIcon size={24} />}
            inset="card"
          />
        </Surface>
      </SurfaceStack>

      {/*
        우: 일자마다 카드 하나. 카드 사이 간격(24 / 모바일 8)이 2a 밴드의 자리를 대신한다.

        **위 여백** — 모바일은 앞 스택(레일)과 8, 태블릿 한 컬럼은 앞 스택의 아래 24 가 이미
        있어 0, 데스크톱 2단은 자기 열의 첫 요소라 24 다 (장소 상세 #443 과 같은 처리).
      */}
      <SurfaceStack className="pt-2 md:pt-0 lg:pt-6">
        {days.map((group) => (
          <PlanDaySection
            key={group.day}
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
            regenerateHref={
              regenerateBlocked ? null : `/plans/${plan.planId}/days/${group.day}/regenerate`
            }
            add={{
              href: `/plans/${plan.planId}/days/${group.day}/add`,
              addedPlaceIds: placeIdsOf(group.items),
              /*
                  **일자로 좁혀 넘긴다.** 훅은 화면 전체에 하나뿐이라, 좁히지 않으면
                  3일차에서 난 실패가 실내 대안 블록이 있는 **모든 일자**에 뜨고
                  같은 장소가 두 일자의 대안일 때 두 행이 함께 스피너를 낸다.
                */
              pendingPlaceId: addPlace.pending?.day === group.day ? addPlace.pending.placeId : null,
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
        ))}

        <PlanOutOfRangeSection items={outOfRange} />
      </SurfaceStack>

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
    <Surface
      titleId="plan-out-of-range"
      title={messages.plan.outOfRangeTitle}
      description={
        <p className="text-body-2 text-fg-muted">{messages.plan.outOfRangeDescription}</p>
      }
    >
      <SurfaceList className="border-border border-t">
        {rows.map((row) => (
          <PlanItemRow key={row.item.planItemId} model={row} />
        ))}
      </SurfaceList>
    </Surface>
  )
}
