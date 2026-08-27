'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { PetDeleteSection } from '@/features/pet/pet-delete-section'
import { PetForm } from '@/features/pet/pet-form'
import { PET_INVALIDATE_KEY } from '@/features/pet/queries'
import { usePetDetail } from '@/features/pet/use-pet-detail'
import { classify, toErrorStatus } from '@/lib/api/error'
import { updatePet } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import { toPetFormValues } from '@/lib/pet/form'

export function PetEditView({ petId }: { petId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const query = usePetDetail(petId)

  if (query.isPending) {
    return <Skeleton className="h-96 w-full rounded-lg" />
  }

  // 진입 시점의 조회 실패. 404 는 서버 컴포넌트가 notFound() 로 이미 걸렀으므로
  // 여기 도달하는 것은 대개 일시 장애다 — 재시도를 준다.
  if (query.data === undefined) {
    const status = toErrorStatus(query.error)
    const kind = status === null ? 'temporary' : classify(status)
    return (
      <ErrorState
        title={kind === 'not-found' ? messages.pet.notFoundTitle : messages.pet.loadFailedTitle}
        description={
          kind === 'not-found'
            ? messages.pet.notFoundDescription
            : messages.pet.loadFailedDescription
        }
        onRetry={() => void query.refetch()}
      />
    )
  }

  const pet = query.data

  return (
    <PetForm
      // 응답의 metadata 객체에서 code 를 꺼낸다. 이 변환을 놓치면 수정 저장이
      // 조용히 깨진다 (공통명세 S3-5)
      initialValues={toPetFormValues(pet)}
      submitLabel={messages.pet.save}
      footer={
        <>
          <PetDeleteSection petId={pet.petId} petName={pet.name} />
          <Link href="/pets" className="text-body-2 text-fg-muted text-center underline">
            {messages.pet.backToList}
          </Link>
        </>
      }
      onSave={(payload) => updatePet(pet.petId, payload)}
      onSaved={() => {
        void queryClient.invalidateQueries({ queryKey: PET_INVALIDATE_KEY })
        router.replace('/pets')
      }}
    />
  )
}
