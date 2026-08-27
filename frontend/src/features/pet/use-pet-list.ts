'use client'

import { useQuery } from '@tanstack/react-query'

import { PET_QUERY_OPTIONS, petKeys } from '@/features/pet/queries'
import { clientFetch } from '@/lib/api/client'
import { petListPath } from '@/lib/api/pet'
import type { PetList } from '@/types/pet'

export function usePetList() {
  return useQuery({
    queryKey: petKeys.list(),
    queryFn: () => clientFetch<PetList>(petListPath()),
    staleTime: PET_QUERY_OPTIONS.staleTime,
    gcTime: PET_QUERY_OPTIONS.gcTime,
    retry: PET_QUERY_OPTIONS.retry,
  })
}
