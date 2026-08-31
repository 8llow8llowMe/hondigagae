'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { MEMBER_QUERY_OPTIONS, memberKeys } from '@/features/member/queries'
import { fetchMyInfo, updateMyInfo } from '@/lib/api/member'
import type { MemberMyInfo, MemberUpdatePayload } from '@/types/member'

export function useMyInfo() {
  return useQuery({
    queryKey: memberKeys.me(),
    queryFn: fetchMyInfo,
    staleTime: MEMBER_QUERY_OPTIONS.staleTime,
    gcTime: MEMBER_QUERY_OPTIONS.gcTime,
    retry: MEMBER_QUERY_OPTIONS.retry,
  })
}

/**
 * 닉네임 수정.
 *
 * 응답이 **회원 정보 전체**라 invalidate 가 아니라 `setQueryData` 로 갈아끼운다 (D3).
 * invalidate 를 쓰면 방금 받은 최신값을 버리고 같은 것을 한 번 더 받아온다.
 */
export function useUpdateMyInfo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: MemberUpdatePayload) => updateMyInfo(payload),
    onSuccess: (member: MemberMyInfo) => {
      queryClient.setQueryData(memberKeys.me(), member)
    },
  })
}
