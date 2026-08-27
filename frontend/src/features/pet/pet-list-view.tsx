'use client'

import { PetListSection } from '@/features/pet/pet-list-section'
import { usePetList } from '@/features/pet/use-pet-list'
import { toErrorStatus } from '@/lib/api/error'

/** 조회 상태를 presentational 컴포넌트가 쓰는 props 로 변환한다 */
export function PetListView() {
  const query = usePetList()

  return (
    <PetListSection
      pets={query.data?.pets ?? []}
      totalCount={query.data?.totalCount ?? 0}
      loading={query.isPending}
      errorStatus={toErrorStatus(query.error)}
      onRetry={() => void query.refetch()}
    />
  )
}
