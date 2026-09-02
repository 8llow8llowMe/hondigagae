'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
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
 * **`ConfirmModal` 을 쓴다** — 아트보드(`혼디가개 마이페이지·내 반려견.dc.html`)가
 * `role="dialog" aria-modal="true"` 다이얼로그다.
 *
 * 예전에는 인라인 2단계 확인이었고, 그 사유는 "`Modal` 공통 컴포넌트가 없고 그 계약
 * (focus trap / Esc / 스크롤 잠금 / 포커스 복귀)이 이 화면 하나를 위해 설계할 범위를
 * 넘는다"(수정-세부명세 D8-1)였다. **그 사유는 낡았다** — `ConfirmModal` 이 그 뒤에
 * 생겼고 계약을 이미 지킨다 (이슈 #70).
 *
 * 취소가 좌측이고 기본 포커스가 취소인 것도 `ConfirmModal` 이 보장한다 — 파괴 버튼에
 * 포커스를 두면 Enter 한 번에 되돌릴 수 없는 일이 일어난다.
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
  return (
    <div className="border-border mt-2 border-t pt-4">
      {/*
        **채운 빨강이 아니다** (`dangerOutline`). 이 화면의 주 행동은 `저장하기` 인데
        채운 삭제 버튼이 그 바로 아래에서 더 강하게 서 있었다 — 거의 누르지 않는 것이
        화면에서 가장 눈에 띄는 요소였다. 확정의 무게는 확인 다이얼로그가 갖는다
        (`ConfirmModal destructive` 가 거기서 채운 빨강을 쓴다).
      */}
      <Button variant="dangerOutline" onClick={onStart}>
        {messages.pet.delete}
      </Button>

      <ConfirmModal
        open={confirming}
        onClose={onCancel}
        onConfirm={onConfirm}
        title={messages.pet.deleteConfirmTitle.replace('{name}', withObjectParticle(petName))}
        description={messages.pet.deleteConfirmDescription}
        confirmLabel={messages.pet.delete}
        cancelLabel={messages.pet.cancel}
        confirmLoading={deleting}
        destructive
      >
        {/* 삭제 실패는 모달 안에서 말한다 — 모달을 닫고 뒤에서 알리면 무엇이 실패했는지 모른다 */}
        <FormAlert message={errorMessage} />
      </ConfirmModal>
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
