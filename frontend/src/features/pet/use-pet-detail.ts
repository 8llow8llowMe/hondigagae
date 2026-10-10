'use client'

import { useQuery } from '@tanstack/react-query'

import { PET_QUERY_OPTIONS, petKeys } from '@/features/pet/queries'
import { fetchPet } from '@/lib/api/pet'

export function usePetDetail(petId: string) {
  return useQuery({
    queryKey: petKeys.detail(petId),
    queryFn: () => fetchPet(petId),
    staleTime: PET_QUERY_OPTIONS.staleTime,
    gcTime: PET_QUERY_OPTIONS.gcTime,
    retry: PET_QUERY_OPTIONS.retry,
  })
}
