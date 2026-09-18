'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
import { FormAlert } from '@/components/form-alert'
import { MoreIcon } from '@/components/icons'
import { Menu, MenuAnchor } from '@/components/menu'
import { PlanCopyModal } from '@/features/plan/plan-copy-modal'
import { PlanEditModal } from '@/features/plan/plan-edit-modal'
import { PlanShareModal } from '@/features/plan/plan-share-modal'
import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { deletePlan } from '@/lib/api/plan'
import { dayToLocalNoon } from '@/lib/date/day'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { canCopyPlan } from '@/lib/plan/copy'
import { isShareablePlan } from '@/lib/plan/share-link'
import { PLAN_STATUS_ACTION_LABELS, type PlanStatusActionSpec } from '@/lib/plan/status-action'
import type { Pet } from '@/types/pet'
import type { PlanDetail } from '@/types/plan'

/**
 * 일정 관리 — 이름·기간·예산 수정 · 일정 삭제.
 *
 * **좌 레일(개요 패널) 우측 상단에 둔다.** 원래는 우측 본문 맨 위에 있었는데, 이 메뉴가
 * 다루는 것은 일자 목록이 아니라 **일정 그 자체**(이름 · 예산 · 존재 여부)다. 개요 패널이
 * 그 일정의 신원을 들고 있는 자리라 관리 진입점도 거기 붙는 것이 맞고, 우측 본문 맨 위를
 * 비우면 그 열이 "일자 목록" 하나로 읽힌다.
 *
 * **`일정 삭제` 가 이 메뉴 안이다.** 예전에는 본문 맨 아래 `위험 영역` 섹션에 채운 빨간
 * 버튼으로 있었다 — 스크롤 끝에 화면에서 가장 강한 요소가 서 있는 셈이었고, 거의 누르지
 * 않는 액션에 그 무게를 줄 이유가 없다. `Menu` 는 파괴적 항목을 마지막에 두고 위에 선을
 * 그으며 `danger-900` 을 쓴다 (DESIGN.md §2-6 이 그 톤을 "메뉴 안 파괴적 항목" 으로
 * 정의한다). 확정의 무게는 `ConfirmModal` 이 갖는다.
 *
 * **역방향 상태 변경도 여기다** (#653 · 진단 PL-2 · 명세 D11-2). `초안으로 되돌리기` ·
 * `확정으로 되돌리기` 는 여행의 진행 방향을 거스르는 것이라 개요 아래 전폭 버튼 자리를
 * 차지할 이유가 없었다 — 390 실측에서 **완료 일정의 유일한 전폭 버튼이 `확정으로
 * 되돌리기`(top 252)** 였다. 정방향(`확정하기` · `완료하기`)은 그 자리에 그대로 남는다.
 *
 * **역방향은 파괴적이 아니다** — 되돌릴 수 있다(`plan-status-action.tsx` 가 확인 대화상자를
 * 붙이지 않는 근거와 같다). 그래서 `수정` 과 `삭제` 사이, **선 위**에 둔다. 선 아래
 * `danger-900` 자리는 `삭제` 혼자다 (DESIGN.md §2-6).
 *
 * **저장 중에는 메뉴를 열 수 있지만 상태 항목이 잠긴다** — 진행은 `usePlanStatus` 한 곳이
 * 들어 전폭 버튼과 이 항목이 같은 것을 본다.
 *
 * **`status` 는 필수이고 둘을 한 덩어리로 받는다.** 선택 prop 으로 두면 새 호출부가
 * 빠뜨렸을 때 **역방향 상태 변경의 유일한 진입점이 타입 오류 없이 사라지고**, `saving`
 * 만 빠뜨리면 잠금이 조용히 없어진다. 이 저장소가 `iconOnly`/`aria-label` 을 타입으로
 * 강제하는 것과 같은 이유다 (component-guide.md §5).
 *
 * icon-only 라 `aria-label` 이 접근 가능한 이름이다 (D6). 키보드 순회는 `Menu` 가 보장한다.
 */
export function PlanManageMenu({
  plan,
  pets,
  today,
  status,
  statusActions,
}: {
  plan: PlanDetail
  /**
   * 수정 모달의 동행견 옵션 (#622). **이 메뉴가 쓰지 않고 그대로 넘긴다** — 목록을 이미
   * 읽고 있는 `PlanDetailView` 에서 내려오는 경로다(`PlanEditModal` 의 `pets` 주석).
   */
  pets: readonly Pet[]
  today: string
  /** `usePlanStatus` 가 돌려주는 것 그대로. 전폭 버튼과 같은 진행·실행을 본다 */
  status: { saving: boolean; run: (action: PlanStatusActionSpec) => void }
  /**
   * 이 메뉴에 설 상태 전이 액션 (#732). **호출부가 `planStatusActionLayout()` 으로 정한다** —
   * 예전에는 이 컴포넌트가 `reverseStatusActions()` 를 직접 불렀는데, 시점 축이 생기면서
   * (출발 전에는 `여행 완료하기` 도 여기로 내려온다) 버튼 쪽과 판정이 갈릴 수 있게 됐다.
   * 한 번 셈한 결과를 나눠 받으면 같은 액션이 두 곳에 서거나 사라지는 갈래가 없다.
   */
  statusActions: PlanStatusActionSpec[]
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const triggerRef = useRef<HTMLButtonElement>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // disabled 반영 전 빠른 연속 클릭을 막는다 (form-guide.md §6)
  const deletingRef = useRef(false)

  /*
    **지난 OR 완료만** 보인다 (#617, `일정복사-세부명세.md` D4-1 · D17-2). `today` 는
    문자열로 받아 `Date` 로 되돌린다 — 이 컴포넌트가 `new Date()` 를 새로 부르면 자정
    근처에서 SSR 과 갈린다(`home-view.tsx` 의 같은 변환과 같은 근거).
  */
  const todayDate = dayToLocalNoon(today)
  const canCopy = todayDate !== null && canCopyPlan(plan, todayDate)

  function leave() {
    void queryClient.invalidateQueries({ queryKey: planKeys.list() })
    queryClient.removeQueries({ queryKey: planKeys.detail(plan.planId) })
    router.replace('/plans')
  }

  function handleConfirm() {
    if (deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    setErrorMessage(null)

    void deletePlan(plan.planId)
      .then(leave)
      .catch((error: unknown) => {
        // 이미 지워진 것이면 목적은 달성됐다 — 목록으로 보낸다 (pet 삭제와 같은 판단)
        if (error instanceof ApiError && error.status === 404) {
          leave()
          return
        }

        setErrorMessage(apiErrorToFormErrors(error, messages.plan.deleteError).form)
        deletingRef.current = false
        setDeleting(false)
      })
  }

  return (
    <>
      <MenuAnchor className="shrink-0">
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
          /* 정렬은 기본값(왼쪽)이다 — 이 메뉴는 왼쪽 축을 가진 개요 패널 안에 있다 */
          className="top-full right-0 mt-1"
          items={[
            {
              /*
                **문구를 상태로 가른다** (#622 · 명세 D13-3). 메뉴 항목은 안에서 무엇을
                고칠 수 있는지로 읽힌다 — 완료 일정에는 동행견 그룹이 없으므로(`PLAN_019`)
                그 상태에서 `동행견` 이 적힌 항목을 열면 #585 의 근거가 반대로 깨진다.
              */
              label:
                plan.status.code === 'COMPLETED'
                  ? messages.plan.editAction
                  : messages.plan.editActionWithPets,
              onSelect: () => {
                setMenuOpen(false)
                setEditOpen(true)
              },
            },
            /*
              **`수정` 다음, 역방향 상태 항목보다 위** (#617, D17-1). 복사는 이 일정을
              바꾸지 않고 새 일정을 만드는 비파괴 동작이라, 이 일정에 손대는 아래 두
              묶음(상태를 바꾼다 / 지운다)보다 위에 둔다. 선 아래 `danger-900` 자리는
              `삭제` 혼자 남는다 — 복사는 파괴적이지 않으므로 내려가지 않는다.
            */
            ...(canCopy
              ? [
                  {
                    label: messages.plan.copyAction,
                    onSelect: () => {
                      setMenuOpen(false)
                      setCopyOpen(true)
                    },
                  },
                ]
              : []),
            /*
              **정방향은 대개 여기 없다.** `확정하기` · `완료하기` 는 개요 아래 전폭
              버튼이다 (`plan-status-action.tsx`). 초안에는 되돌아갈 앞 상태가 없어 이
              갈래가 비고, 그때 메뉴는 예전과 똑같이 `수정 · 삭제` 둘이다.

              **예외가 하나 생겼다** (#732): 출발 전(`upcoming`)의 `여행 완료하기` 는
              그날 누를 수 있는 일이 아니라 이 배열로 내려온다. 정방향이 먼저, 역방향이
              그 뒤인 순서는 `planStatusActionLayout()` 이 정한다.
            */
            /*
              **공유는 확정·완료에만 있다** (#628). 초안에서 항목을 보여 주고 누르면
              `PLAN_022` 400 을 띄우는 방식을 쓰지 않는다 — 눌러서 배우게 하는 자리가
              아니다. 판정은 백엔드 `PlanStatus.isShareable()` 복제본을 쓴다.

              **역방향 상태 변경보다 위다.** 공유는 되돌릴 수 있는 평범한 액션이고,
              아래 둘(되돌리기 · 삭제)로 갈수록 무게가 는다.
            */
            ...(isShareablePlan(plan.status.code)
              ? [
                  {
                    label: messages.plan.shareAction,
                    onSelect: () => {
                      setMenuOpen(false)
                      setShareOpen(true)
                    },
                  },
                ]
              : []),
            ...statusActions.map((action) => ({
              label: PLAN_STATUS_ACTION_LABELS[action.kind],
              disabled: status.saving,
              onSelect: () => {
                setMenuOpen(false)
                status.run(action)
              },
            })),
            {
              label: messages.plan.deleteAction,
              destructive: true,
              onSelect: () => {
                setMenuOpen(false)
                setConfirming(true)
              },
            },
          ]}
        />
      </MenuAnchor>

      <PlanEditModal
        plan={plan}
        pets={pets}
        today={today}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />

      <PlanShareModal planId={plan.planId} open={shareOpen} onClose={() => setShareOpen(false)} />
      <PlanCopyModal plan={plan} today={today} open={copyOpen} onClose={() => setCopyOpen(false)} />

      {/*
        **`ConfirmModal` 이 취소 좌측 · 기본 포커스 취소를 보장한다** — 파괴 버튼에 포커스를
        두면 Enter 한 번에 되돌릴 수 없는 일이 일어난다.

        영향 범위를 셀 수 있는 것만 말한다. 항목 수는 알지만 **판정·실내 대안까지 개수로
        세지 않는다** — 틀린 개수는 없는 개수보다 나쁘다.
      */}
      <ConfirmModal
        open={confirming}
        onClose={() => {
          setConfirming(false)
          setErrorMessage(null)
        }}
        onConfirm={handleConfirm}
        title={messages.plan.deleteConfirmTitle.replace('{title}', plan.title)}
        description={messages.plan.deleteConfirmDescription}
        confirmLabel={messages.plan.deleteAction}
        cancelLabel={messages.plan.editCancel}
        confirmLoading={deleting}
        destructive
      >
        {/* 삭제 실패는 모달 안에서 말한다 — 닫고 뒤에서 알리면 무엇이 실패했는지 모른다 */}
        <FormAlert message={errorMessage} />
      </ConfirmModal>
    </>
  )
}
