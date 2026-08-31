'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
import { FormAlert } from '@/components/form-alert'
import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { deletePlan } from '@/lib/api/plan'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 위험 영역 — 일정 삭제. `pet-delete-section.tsx` 를 본뜬다.
 *
 * **`ConfirmModal` 이 취소 좌측 · 기본 포커스 취소를 보장한다** — 파괴 버튼에 포커스를
 * 두면 Enter 한 번에 되돌릴 수 없는 일이 일어난다.
 *
 * 영향 범위를 셀 수 있는 것만 말한다. 항목 수는 알지만 **판정·실내 대안까지 개수로
 * 세지 않는다** — 틀린 개수는 없는 개수보다 나쁘다.
 */
export function PlanDeleteSection({ planId, title }: { planId: string; title: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const deletingRef = useRef(false)

  function leave() {
    void queryClient.invalidateQueries({ queryKey: planKeys.list() })
    queryClient.removeQueries({ queryKey: planKeys.detail(planId) })
    router.replace('/plans')
  }

  function handleConfirm() {
    if (deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    setErrorMessage(null)

    void deletePlan(planId)
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
    <section className="border-border border-t px-4 py-6 md:px-10">
      <h2 className="text-caption text-fg-muted font-semibold">{messages.plan.dangerZoneTitle}</h2>
      <Button variant="danger" className="mt-3" onClick={() => setConfirming(true)}>
        {messages.plan.deleteAction}
      </Button>

      <ConfirmModal
        open={confirming}
        onClose={() => {
          setConfirming(false)
          setErrorMessage(null)
        }}
        onConfirm={handleConfirm}
        title={messages.plan.deleteConfirmTitle.replace('{title}', title)}
        description={messages.plan.deleteConfirmDescription}
        confirmLabel={messages.plan.deleteAction}
        cancelLabel={messages.plan.editCancel}
        confirmLoading={deleting}
        destructive
      >
        {/* 삭제 실패는 모달 안에서 말한다 — 닫고 뒤에서 알리면 무엇이 실패했는지 모른다 */}
        <FormAlert message={errorMessage} />
      </ConfirmModal>
    </section>
  )
}
