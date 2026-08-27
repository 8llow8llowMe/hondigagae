'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { PET_INVALIDATE_KEY } from '@/features/pet/queries'
import { ApiError } from '@/lib/api/error'
import { deletePet } from '@/lib/api/pet'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { withObjectParticle } from '@/lib/text/korean'

export type PetDeleteConfirmProps = {
  petName: string
  confirming: boolean
  deleting: boolean
  errorMessage: string | null
  onStart: () => void
  onCancel: () => void
  onConfirm: () => void
}

/**
 * 표시 전용.
 *
 * **인라인 2단계 확인이다.** `Modal` 공통 컴포넌트가 없고, `component-guide.md` §7 이
 * `Modal` 에 요구하는 계약(focus trap / `Esc` / 스크롤 잠금 / 포커스 복귀)이 이 화면
 * 하나를 위해 설계할 범위를 넘는다 (수정-세부명세 D8-1).
 */
export function PetDeleteConfirm({
  petName,
  confirming,
  deleting,
  errorMessage,
  onStart,
  onCancel,
  onConfirm,
}: PetDeleteConfirmProps) {
  if (!confirming) {
    return (
      <div className="border-border mt-2 border-t pt-4">
        <Button variant="danger" onClick={onStart}>
          {messages.pet.delete}
        </Button>
      </div>
    )
  }

  return (
    <div className="border-border mt-2 flex flex-col gap-3 border-t pt-4">
      {/*
        전환이 시각적으로만 전달되면 스크린리더 사용자가 무엇을 확인하는지 모른다
        — 수정-세부명세 D6.

        "되돌릴 수 없어요" 라고 쓴다. 백엔드는 소프트 삭제지만 **사용자에게 복원
        수단이 없다.** 서버 구현을 근거로 복원을 약속하면 거짓이 된다 (D4-2).
      */}
      <p role="alert" className="text-body-2 text-fg">
        삭제하면 되돌릴 수 없어요. {withObjectParticle(petName)} 삭제할까요?
      </p>

      <FormAlert message={errorMessage} />

      <div className="flex gap-2">
        {/*
          파괴적 동작에 포커스를 놓으면 Enter 연타로 실수한다.
          autoFocus 는 "취소" 에 둔다 — 수정-세부명세 D6.
        */}
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <Button variant="secondary" onClick={onCancel} autoFocus>
          취소
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={deleting}>
          {messages.pet.delete}
        </Button>
      </div>
    </div>
  )
}

export function PetDeleteSection({ petId, petName }: { petId: string; petName: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // disabled 반영 전 빠른 연속 클릭을 막는다 (form-guide.md §6)
  const deletingRef = useRef(false)

  function handleConfirm() {
    if (deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    setErrorMessage(null)

    void deletePet(petId)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: PET_INVALIDATE_KEY })
        router.replace('/pets')
      })
      .catch((error: unknown) => {
        // 이미 지워진 것이면 목적은 달성됐다 — 목록으로 보낸다 (수정-세부명세 D4-2)
        if (error instanceof ApiError && error.status === 404) {
          void queryClient.invalidateQueries({ queryKey: PET_INVALIDATE_KEY })
          router.replace('/pets')
          return
        }

        // rawMessage 는 unknown 이다 (검증 실패 시 객체가 온다). 집의 정규화
        // 헬퍼를 그대로 쓴다 — 문구 추출 규칙이 폼과 갈리지 않게 한다
        setErrorMessage(apiErrorToFormErrors(error, messages.common.temporaryErrorDescription).form)
        deletingRef.current = false
        setDeleting(false)
      })
  }

  return (
    <PetDeleteConfirm
      petName={petName}
      confirming={confirming}
      deleting={deleting}
      errorMessage={errorMessage}
      onStart={() => setConfirming(true)}
      onCancel={() => {
        setConfirming(false)
        setErrorMessage(null)
      }}
      onConfirm={handleConfirm}
    />
  )
}
