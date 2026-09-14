'use client'

import { useState } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { PetPhoto } from '@/features/pet/pet-photo'
import { PET_INVALIDATE_KEY } from '@/features/pet/queries'
import { PROFILE_IMAGE_ACCEPT } from '@/lib/api/member'
import { markRepresentativePet, removePetImage, uploadPetImage } from '@/lib/api/pet'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { withObjectParticle } from '@/lib/text/korean'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { Pet } from '@/types/pet'

/**
 * 반려견 사진 · 대표 지정 — 수정 화면 상단.
 *
 * **폼과 분리돼 있다.** 셋 다 `PetSaveRequest` 밖의 전용 엔드포인트라 저장 버튼과
 * 생명주기가 다르다 — 사진을 바꾸면 그 자리에서 반영되고, 폼을 저장하지 않고 나가도
 * 사진은 이미 바뀐 상태다. 한 폼처럼 보이게 묶으면 "저장을 안 눌렀는데 왜 바뀌었나" 가 된다.
 *
 * **등록 화면에는 두지 않는다.** 세 API 모두 `petId` 가 필요해 아이가 먼저 있어야 한다.
 *
 * **자기 카드 안의 내용이다** (`DESIGN.md §0`, 이슈 #464). 제목·부제와 테두리는
 * `PetEditView` 가 세우는 `Surface` 가 갖는다 — 2a 때는 이 블록이 스스로 `border-b` 로
 * 폼과 갈렸는데, 3a 에서는 **카드 경계가 그 일을 한다**(경계는 이야기 단위다).
 */
export function PetPhotoSection({ pet }: { pet: Pet }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  function invalidate() {
    // 대표 지정은 **다른 아이의 representative 도 바꾼다** → 목록까지 통째로 무효화한다
    void queryClient.invalidateQueries({ queryKey: PET_INVALIDATE_KEY })
  }

  const upload = useMutation({ mutationFn: (file: File) => uploadPetImage(pet.petId, file) })
  const remove = useMutation({ mutationFn: () => removePetImage(pet.petId) })
  const represent = useMutation({ mutationFn: () => markRepresentativePet(pet.petId) })

  const busy = upload.isPending || remove.isPending || represent.isPending

  async function run(action: () => Promise<unknown>, done: string, fallback: string) {
    setError(null)
    setStatus(null)
    try {
      await action()
      invalidate()
      setStatus(done)
    } catch (caught) {
      setError(apiErrorToFormErrors(caught, fallback).form ?? fallback)
    }
  }

  return (
    <div className={cn('flex flex-col gap-3 pt-2 pb-5', INSET_CLASS.card)}>
      <div className="flex items-center gap-4">
        <PetPhoto name={pet.name} url={pet.profileImageUrl} size={80} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/*
              label 이 곧 버튼이다. `<button>` 안의 label 클릭은 파일 선택기를 열지 못한다
              (회원 프로필과 같은 이유 — features/member/profile-image-field.tsx)
            */}
            <label
              className={
                busy
                  ? 'text-body-2 border-border-strong text-fg-muted inline-flex h-11 cursor-not-allowed items-center rounded-md border px-4 font-semibold opacity-50'
                  : 'text-body-2 border-border-strong text-fg hover:bg-band focus-within:ring-brand-500 inline-flex h-11 cursor-pointer items-center rounded-md border px-4 font-semibold focus-within:ring-2'
              }
            >
              {upload.isPending
                ? messages.pet.photoUploading
                : pet.profileImageUrl === null
                  ? messages.pet.photoUpload
                  : messages.pet.photoChange}
              <input
                type="file"
                className="sr-only"
                accept={PROFILE_IMAGE_ACCEPT}
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  // 같은 파일을 다시 골라도 change 가 나게 값을 비운다 —
                  // 업로드 실패 후 재시도가 조용히 막히는 것을 막는다
                  event.target.value = ''
                  if (file === undefined) return

                  void run(
                    () => upload.mutateAsync(file),
                    messages.member.profileImageUploaded,
                    messages.member.profileImageUploadFailed,
                  )
                }}
              />
            </label>

            {pet.profileImageUrl !== null && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => remove.mutateAsync(),
                    messages.member.profileImageRemoved,
                    messages.member.profileImageUploadFailed,
                  )
                }
                className="text-body-2 text-fg-muted focus-visible:ring-brand-500 inline-flex h-11 items-center px-2 font-medium focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                {messages.pet.photoRemove}
              </button>
            )}
          </div>

          <p className="text-caption text-fg-muted">{messages.member.profileImageHint}</p>
        </div>
      </div>

      {/* ── 대표 반려견 ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {pet.representative ? (
          // **해제 버튼을 두지 않는다.** 해제 API 가 없고, 회원당 하나가 유지되므로
          // 대표를 없애는 것은 가능한 상태가 아니다 — 다른 아이를 지정해 옮긴다
          <p className="text-body-2 text-fg font-semibold">{messages.pet.representativeCurrent}</p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () => represent.mutateAsync(),
                // 목적격 조사(을/를)는 이름의 받침에 따라 갈린다 — 같은 화면의
                // 삭제 확인 문구가 이미 같은 헬퍼를 거친다 (`pet-delete-section.tsx`)
                messages.pet.representativeDone.replace('{name}', withObjectParticle(pet.name)),
                messages.pet.representativeFailed,
              )
            }
            className="text-body-2 border-border-strong text-fg hover:bg-band focus-visible:ring-brand-500 inline-flex h-11 items-center rounded-md border px-4 font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {messages.pet.representativeSet}
          </button>
        )}
        <p className="text-caption text-fg-muted">{messages.pet.representativeHelp}</p>
      </div>

      {/* 사진 교체·대표 변경은 스크린리더에 보이지 않는 변화라 문구로 알린다 */}
      <p aria-live="polite" className="text-caption text-fg-muted">
        {status}
      </p>
      {error !== null && <p className="text-caption text-danger-700">{error}</p>}
    </div>
  )
}
