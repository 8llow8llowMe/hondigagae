'use client'

import { useState } from 'react'

import { ConfirmModal } from '@/components/confirm-modal'
import { FormAlert } from '@/components/form-alert'
import { useSessionExit } from '@/features/member/use-session-exit'
import { withdraw } from '@/lib/api/member'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 회원탈퇴 확인 — `/mypage` 위에 뜨는 모달.
 *
 * **별도 라우트(`/mypage/withdraw`)였다.** 사라지는 것을 나열할 자리가 필요하다는 이유였는데
 * (옛 D8-2), 실제 흐름은 `회원탈퇴` → 설명 화면 → `탈퇴하기` → **또 확인 모달**로 확인이
 * 두 번이었고, 설명 화면은 목록 세 줄과 경고 한 줄뿐이라 화면 하나를 쓸 분량이 아니었다.
 * 이제 그 목록과 경고를 확인 모달 본문에 싣고 확인은 한 번이다.
 *
 * **방어는 여전히 둘이다** — 마이페이지 맨 아래 붉은 글자 행(위치 · 색)과 이 모달(무엇이
 * 사라지는지 + 되돌릴 수 없다). 기본 포커스는 `취소` 라 Enter 한 번에 탈퇴되지 않는다
 * (`ConfirmModal`).
 *
 * **비밀번호 재확인을 받지 않는다.** 서버가 요구하지 않으므로 화면이 서버 계약을 넘는
 * 입력을 만들지 않는다 (공통명세 S5-3).
 *
 * 목록의 개수를 숫자로 적지 않는다. **셀 수 없는 것을 숫자로 적지 않는다** —
 * 틀린 개수는 없는 개수보다 나쁘다 (`ConfirmModal` 주석).
 *
 * **실패하면 모달이 닫히지 않는다.** 오류를 낸 것이 이 모달의 버튼이라 문구도 여기 선다 —
 * 닫고 페이지에 띄우면 무엇이 실패했는지 말하는 자리가 원인에서 멀어진다 (D6).
 */
export function WithdrawModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const exitSession = useSessionExit()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    if (submitting) return
    setError(null)
    onClose()
  }

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await withdraw()
      onClose()
      exitSession('withdrawn')
    } catch (caught) {
      // `MEMBER_004`(이미 탈퇴한 회원) 등 — 서버 문구를 그대로 낸다
      setError(apiErrorToFormErrors(caught, messages.form.submitFailed).form)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ConfirmModal
      open={open}
      onClose={handleClose}
      onConfirm={() => void handleConfirm()}
      title={messages.member.withdrawConfirmTitle}
      description={messages.member.withdrawLead}
      confirmLabel={messages.member.withdrawSubmit}
      destructive
      confirmLoading={submitting}
    >
      <div className="flex flex-col gap-3">
        <ul className="text-body-2 text-fg flex list-disc flex-col gap-1 pl-5">
          {messages.member.withdrawItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p className="text-body-2 text-danger-700 bg-danger-100 rounded-md px-3 py-2">
          {messages.member.withdrawIrreversible}
        </p>

        <FormAlert message={error} />
      </div>
    </ConfirmModal>
  )
}
