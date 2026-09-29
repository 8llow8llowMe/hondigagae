'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
import { FormAlert } from '@/components/form-alert'
import { invalidateAfterPetDeleted } from '@/features/pet/pet-delete-invalidation'
import { usePetCompanionSummary } from '@/features/pet/use-pet-companion-summary'
import { ApiError } from '@/lib/api/error'
import { deletePet } from '@/lib/api/pet'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { petDeleteCompanionLines } from '@/lib/pet/delete-companions'
import { withObjectParticle } from '@/lib/text/korean'
import type { PlanCompanionSummary } from '@/types/plan'

/**
 * 확인창의 동행 일정 집계 상태 (#1042). **셋 중 어느 것이든 삭제 버튼은 열려 있다** —
 * `PetDeleteSection` 머리주석.
 */
export type PetDeleteCompanions =
  { state: 'loading' } | { state: 'failed' } | { state: 'ready'; summary: PlanCompanionSummary }

export type PetDeleteConfirmProps = {
  petName: string
  companions: PetDeleteCompanions
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
  companions,
  confirming,
  deleting,
  errorMessage,
  onStart,
  onCancel,
  onConfirm,
}: PetDeleteConfirmProps) {
  return (
    <div className="flex flex-col items-center gap-2">
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
        description={
          /*
            **일정 문장을 설명 안에 둔다.** `alertdialog` 의 `aria-describedby` 가 이 자리를
            가리킨다 — 본문 슬롯에 두면 제목과 "되돌릴 수 없어요" 만 읽히고 영향 범위는 탐색해야
            들린다.

            **그래도 집계 문장은 `role="status"` 로 따로 알린다.** 집계는 확인창을 여는 렌더에서야
            받기 시작해(`enabled: confirming`) 캐시가 없는 첫 열림의 설명은 늘 `받는 중` 이다.
            `aria-describedby` 는 열릴 때 한 번 읽힐 뿐 live region 이 아니라, 응답이 와서 문장이
            바뀌어도 알리지 않는다 — 없으면 영향 범위를 끝내 듣지 못한다.

            바뀌는 것(일정) 먼저, 되돌릴 수 없다는 경고가 맨 끝이다.
          */
          <div className="flex flex-col gap-2">
            <div role="status" className="flex flex-col gap-2">
              <CompanionLines companions={companions} />
            </div>
            <p>{messages.pet.deleteConfirmDescription}</p>
          </div>
        }
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

/** 집계 문장. 0 인 수는 문장을 내지 않는다 (`petDeleteCompanionLines`) */
function CompanionLines({ companions }: { companions: PetDeleteCompanions }) {
  if (companions.state === 'loading') return <p>{messages.pet.deleteCompanionLoading}</p>
  if (companions.state === 'failed') return <p>{messages.pet.deleteCompanionFailed}</p>

  return petDeleteCompanionLines(companions.summary).map((line) => <p key={line}>{line}</p>)
}

/**
 * 삭제 흐름 — 확인창 · 동행 일정 집계 · 삭제 요청 · 무효화.
 *
 * **집계를 못 받아도 삭제를 막지 않는다** (#1042). 집계는 판단을 돕는 정보이지 삭제의
 * 전제가 아니다 — 서버는 집계와 상관없이 같은 규칙으로 일정을 정리한다(다견 일정에서 떼고,
 * 이 아이만 가던 일정과 다녀온 일정은 남긴다). plan-service 가 잠시 죽었다고 반려견을 못
 * 지우게 하면 다른 서비스의 장애가 이 화면의 기능을 빼앗는다. 그래서 받는 중에도, 실패해도
 * 버튼은 열어 두고 수 없이도 참인 문장(`deleteCompanionFailed`)으로 대신한다.
 *
 * 실패 문장에 재시도 버튼을 달지 않는다 — 확인창을 닫았다 다시 열면 `enabled` 가 다시 켜지며
 * 실패한(데이터 없는) 쿼리를 새로 받는다. 확인창 안에 버튼을 하나 더 세우면 파괴 버튼 옆에
 * 누를 것이 늘어난다.
 */
export function PetDeleteSection({ petId, petName }: { petId: string; petName: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [confirming, setConfirming] = useState(false)
  const summary = usePetCompanionSummary(petId, confirming)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // disabled 반영 전 빠른 연속 클릭을 막는다 (form-guide.md §6)
  const deletingRef = useRef(false)

  function handleConfirm() {
    if (deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    setErrorMessage(null)

    /*
      **`petKeys.all` 을 그대로 무효화하지 않는다** (#1042). 이 화면이 아직 지운 아이의 상세를
      관찰하고 있어 즉시 다시 받고, 그것이 삭제 직후의 404 였다. 무엇을 받고 무엇을 받지
      않는지는 `invalidateAfterPetDeleted` 머리주석의 표가 정본이다.
    */
    void deletePet(petId)
      .then(() => {
        void invalidateAfterPetDeleted(queryClient, petId)
        router.replace('/pets')
      })
      .catch((error: unknown) => {
        // 이미 지워진 것이면 목적은 달성됐다 — 목록으로 보낸다 (수정-세부명세 D4-2).
        // 무효화도 성공 갈래와 같다 — 여기서도 지운 아이의 상세를 다시 받으면 404 다
        if (error instanceof ApiError && error.status === 404) {
          void invalidateAfterPetDeleted(queryClient, petId)
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
      companions={
        summary.data !== undefined
          ? { state: 'ready', summary: summary.data }
          : summary.isError
            ? { state: 'failed' }
            : { state: 'loading' }
      }
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
