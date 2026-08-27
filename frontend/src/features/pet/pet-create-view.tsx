'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { isPetLimitExceeded, PetForm } from '@/features/pet/pet-form'
import { PET_INVALIDATE_KEY } from '@/features/pet/queries'
import { createPet } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import { EMPTY_PET_FORM_VALUES } from '@/lib/pet/form'

export function PetCreateView() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <PetForm
      initialValues={EMPTY_PET_FORM_VALUES}
      submitLabel={messages.pet.register}
      footer={
        <Link href="/pets" className="text-body-2 text-fg-muted text-center underline">
          {messages.pet.backToList}
        </Link>
      }
      onSave={async (payload) => {
        try {
          return await createPet(payload)
        } catch (error) {
          // PET_002 는 필드 오류가 아니다. 붙일 필드가 없고(상한은 요청 전체의
          // 성질이다), 목록에서 이미 막고 있으므로 여기까지 온 것은 다른 탭에서
          // 동시 등록한 경합이다 — 등록-세부명세 D4.
          if (isPetLimitExceeded(error)) {
            // 목록 캐시를 무효화해 사용자가 목록으로 돌아가면 실제 건수를 본다
            void queryClient.invalidateQueries({ queryKey: PET_INVALIDATE_KEY })
          }
          throw error
        }
      }}
      onSaved={() => {
        void queryClient.invalidateQueries({ queryKey: PET_INVALIDATE_KEY })
        // push 를 쓰면 뒤로가기로 폼에 돌아와 같은 반려견을 두 번 등록할 수 있다
        router.replace('/pets')
      }}
    />
  )
}
