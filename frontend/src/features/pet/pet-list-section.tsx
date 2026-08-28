import Link from 'next/link'

import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { RowList } from '@/components/surface'
import { PetRow } from '@/features/pet/pet-row'
import { MAX_PET_COUNT } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import type { Pet } from '@/types/pet'

export type PetListSectionProps = {
  pets: Pet[]
  totalCount: number
  loading: boolean
  errorStatus: number | null
  onRetry: () => void
}

/**
 * 표시 전용. 조회 상태는 `PetListView` 가 props 로 변환해 넘긴다.
 *
 * 상태 분기는 목록-세부명세 D5 를 따른다 —
 * 빈 목록은 `EmptyState`(재시도 없음), 5xx 는 `ErrorState`(재시도 있음).
 */
export function PetListSection({
  pets,
  totalCount,
  loading,
  errorStatus,
  onRetry,
}: PetListSectionProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    )
  }

  // 404 는 목록에 없다 — /pets 는 항상 존재하는 컬렉션이다.
  // 남는 것은 일시 장애뿐이라 재시도를 준다.
  if (errorStatus !== null) {
    return (
      <ErrorState
        title={messages.pet.loadFailedTitle}
        description={messages.pet.loadFailedDescription}
        onRetry={onRetry}
      />
    )
  }

  const limitReached = totalCount >= MAX_PET_COUNT

  if (pets.length === 0) {
    return (
      <EmptyState
        title={messages.pet.emptyTitle}
        description={messages.pet.emptyDescription}
        action={
          <Link href="/pets/new">
            <Button variant="primary">{messages.pet.register}</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-2 text-fg-muted">
          {totalCount} / {MAX_PET_COUNT}
        </p>

        {/*
          상한을 서버 오류로 알게 하지 않는다. 등록 화면까지 들어가 필드 10개를 채운 뒤
          PET_002 를 받는 것은 낭비다 — 목록-세부명세 D4.

          disabled 만 두지 않고 이유를 텍스트로 함께 낸다. disabled 는 스크린리더에
          "왜" 를 전달하지 못한다 (D6).
        */}
        {limitReached ? (
          <div className="flex flex-col items-end gap-1">
            <Button variant="primary" disabled>
              {messages.pet.register}
            </Button>
            <p className="text-caption text-fg-muted">{messages.pet.limitReached}</p>
          </div>
        ) : (
          <Link href="/pets/new">
            <Button variant="primary">{messages.pet.register}</Button>
          </Link>
        )}
      </div>

      <RowList>
        {pets.map((pet, index) => (
          <PetRow key={pet.petId} pet={pet} last={index === pets.length - 1} />
        ))}
      </RowList>
    </div>
  )
}
