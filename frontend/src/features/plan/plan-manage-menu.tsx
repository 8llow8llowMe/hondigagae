'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
import { FormAlert } from '@/components/form-alert'
import { MoreIcon } from '@/components/icons'
import { Menu, MenuAnchor } from '@/components/menu'
import { PlanEditModal } from '@/features/plan/plan-edit-modal'
import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { deletePlan } from '@/lib/api/plan'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
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
 * icon-only 라 `aria-label` 이 접근 가능한 이름이다 (D6). 키보드 순회는 `Menu` 가 보장한다.
 */
export function PlanManageMenu({ plan, today }: { plan: PlanDetail; today: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const triggerRef = useRef<HTMLButtonElement>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // disabled 반영 전 빠른 연속 클릭을 막는다 (form-guide.md §6)
  const deletingRef = useRef(false)

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
              label: messages.plan.editAction,
              onSelect: () => {
                setMenuOpen(false)
                setEditOpen(true)
              },
            },
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

      <PlanEditModal plan={plan} today={today} open={editOpen} onClose={() => setEditOpen(false)} />

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
