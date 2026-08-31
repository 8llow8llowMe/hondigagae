'use client'

import { useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
import { FormAlert } from '@/components/form-alert'
import { useSessionExit } from '@/features/member/use-session-exit'
import { withdraw } from '@/lib/api/member'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * `/mypage/withdraw` — 무엇이 지워지는지 설명하고 확인을 받는다.
 *
 * **모달이 아니라 별도 라우트다** (D8-2). 되돌릴 수 없는 동작이라 사라지는 것을 나열할
 * 자리가 필요하고, 모달 본문에 목록을 넣으면 확인 다이얼로그가 읽을거리가 된다.
 *
 * **비밀번호 재확인을 받지 않는다.** 서버가 요구하지 않으므로 화면이 서버 계약을 넘는
 * 입력을 만들지 않는다 (공통명세 S5-3). 방어는 이 화면의 설명 + 확인 모달 2단계다.
 *
 * 목록의 개수를 숫자로 적지 않는다. **셀 수 없는 것을 숫자로 적지 않는다** —
 * 틀린 개수는 없는 개수보다 나쁘다 (`ConfirmModal` 주석). 지금 화면은 반려견·일정
 * 개수를 조회하지 않으므로 종류만 말한다.
 */
export function WithdrawView() {
  const exitSession = useSessionExit()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await withdraw()
      setOpen(false)
      exitSession('withdrawn')
    } catch (caught) {
      // `MEMBER_004`(이미 탈퇴한 회원) 등 — 서버 문구를 그대로 낸다
      setError(apiErrorToFormErrors(caught, messages.form.submitFailed).form)
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-body-1 text-fg">{messages.member.withdrawLead}</p>

      <ul className="text-body-2 text-fg-muted flex list-disc flex-col gap-1 pl-5">
        {messages.member.withdrawItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <p className="text-body-2 text-danger-700 bg-danger-100 rounded-md px-3 py-2">
        {messages.member.withdrawIrreversible}
      </p>

      <FormAlert message={error} />

      {/*
        되돌릴 수 없는 동작이라 여기서는 danger 채움을 쓴다 — 마이페이지 목록의
        "약하게" 규칙은 **실수로 누를 수 있는 자리**에 대한 것이고, 이 화면은
        이미 탈퇴하러 온 자리다. 취소가 먼저 읽히도록 순서를 뒤집는다.
      */}
      <div className="flex flex-col gap-2">
        <Button variant="danger" size="lg" onClick={() => setOpen(true)}>
          {messages.member.withdrawSubmit}
        </Button>
        <Link
          href="/mypage"
          className="text-body-2 text-fg-muted focus-visible:ring-brand-500 flex min-h-11 items-center justify-center font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.member.withdrawCancel}
        </Link>
      </div>

      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => void handleConfirm()}
        title={messages.member.withdrawConfirmTitle}
        description={messages.member.withdrawConfirmDescription}
        confirmLabel={messages.member.withdrawSubmit}
        destructive
        confirmLoading={submitting}
      />
    </div>
  )
}
