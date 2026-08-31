'use client'

import { useState } from 'react'

import { Button } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
import { FormAlert } from '@/components/form-alert'
import { useSessionExit } from '@/features/member/use-session-exit'
import { removePassword } from '@/lib/api/member'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 소셜 전용으로 전환 — 비밀번호 제거. **`linked` 상태에서만 그린다.**
 *
 * **되돌릴 수 있다** (다시 최초 설정하면 된다). 그래도 확인을 받는 이유는, 되돌리는
 * 경로를 아는 사람만 되돌릴 수 있고 그 사이에는 이메일로 로그인할 수 없어서다 —
 * 확인 문구가 "다시 설정하면 되돌릴 수 있어요" 를 함께 말한다 (공통명세 S2).
 *
 * 성공하면 **서버가 refresh 쿠키를 지운다.** 재로그인이 필요하다.
 */
export function RemovePasswordSection({ providerLabel }: { providerLabel: string }) {
  const exitSession = useSessionExit()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await removePassword()
      setOpen(false)
      exitSession('password-removed')
    } catch (caught) {
      /*
        `MEMBER_009`(일반 계정) · `MEMBER_007`(이미 소셜 전용)은 화면이 `linked` 에서만
        이 동작을 내므로 정상 흐름에서는 나오지 않는다. 경합(다른 기기에서 먼저 전환)
        대비 2차 방어라 **서버 문구를 그대로** 낸다 — 우리가 다시 쓰면 원인이 흐려진다.
      */
      setError(apiErrorToFormErrors(caught, messages.form.submitFailed).form)
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="border-border flex flex-col gap-3 border-t pt-6">
      <h2 className="text-body-1 text-fg font-semibold">
        {messages.member.removePasswordTitle(providerLabel)}
      </h2>
      <p className="text-body-2 text-fg-muted">{messages.member.removePasswordDescription}</p>

      <FormAlert message={error} />

      {/*
        파괴적이지만 되돌릴 수 있어 danger 채움을 쓰지 않는다 — 마이페이지의
        "위험한 액션은 약하게" 와 같은 판단이다. 확인 단계가 방어를 맡는다.
      */}
      <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        {messages.member.removePasswordSubmit}
      </Button>

      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => void handleConfirm()}
        title={messages.member.removePasswordConfirmTitle}
        description={messages.member.removePasswordDescription}
        confirmLabel={messages.member.removePasswordSubmit}
        confirmLoading={submitting}
      />
    </section>
  )
}
