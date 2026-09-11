'use client'

import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { Surface } from '@/components/surface'
import { isPetLimitExceeded, PetForm } from '@/features/pet/pet-form'
import { PET_INVALIDATE_KEY } from '@/features/pet/queries'
import { createPet } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import { EMPTY_PET_FORM_VALUES } from '@/lib/pet/form'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * **폼이 카드 하나다** (`DESIGN.md §0`, 이슈 #464) — 카드 판정 3문을 셋 다 통과한다.
 * ① 자기 제목이 있다(`반려견 등록`) ② 혼자 떼어놔도 말이 된다(이 화면이 하는 일 전부다)
 * ③ 담는 항목이 여럿이다(기본 정보 · 크기 · 성향 · 민감도).
 *
 * **카드를 페이지가 아니라 뷰가 그린다** — 일정 만들기(#453)와 같은 판단이다. 페이지가
 * 그리고 뷰가 안만 채우면 **"여기부터 카드 안"** 과 그 인셋(`INSET_CLASS.card`)이 두
 * 파일로 갈린다.
 *
 * **`목록으로` 는 이 카드 밖이다** — 액션은 카드가 아니다(§0 판정에서 "액션 바" 가
 * 빠진다). 페이지가 L0 바닥 위에 세운다.
 */
export function PetCreateView() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <Surface lead titleId="pet-create-heading" title={messages.pet.newTitle}>
      {/* 폼은 카드 안이라 인셋이 16/20 이다 — 페이지 인셋 40 을 쓰면 두 번 밀린다 (§0) */}
      <div className={cn('pt-2 pb-5', INSET_CLASS.card)}>
        <PetForm
          initialValues={EMPTY_PET_FORM_VALUES}
          submitLabel={messages.pet.register}
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
      </div>
    </Surface>
  )
}
