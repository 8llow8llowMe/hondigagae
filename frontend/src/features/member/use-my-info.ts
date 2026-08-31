'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { MEMBER_QUERY_OPTIONS, memberKeys } from '@/features/member/queries'
import { fetchMyInfo, removeProfileImage, updateMyInfo, uploadProfileImage } from '@/lib/api/member'
import type { MemberMyInfo, MemberUpdatePayload, ProfileImageUploadResult } from '@/types/member'

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

/**
 * 프로필 이미지 업로드.
 *
 * **응답이 `{key, url}` 뿐이라 `profileImageUrl` 만 갈아끼운다** (D3). 응답으로 캐시를
 * 통째로 바꾸면 이름·이메일·계정 상태가 통째로 사라진다.
 *
 * 캐시가 비어 있으면(직접 진입 직후 등) 갈아끼울 대상이 없으므로 invalidate 로 넘긴다 —
 * 부분 갱신은 **기존 값이 있을 때만** 성립한다.
 */
export function useUploadProfileImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => uploadProfileImage(file),
    onSuccess: (result: ProfileImageUploadResult) => {
      const current = queryClient.getQueryData<MemberMyInfo>(memberKeys.me())
      if (current === undefined) {
        void queryClient.invalidateQueries({ queryKey: memberKeys.me() })
        return
      }
      queryClient.setQueryData<MemberMyInfo>(memberKeys.me(), {
        ...current,
        profileImageUrl: result.profileImageUrl,
      })
    },
  })
}

/** 프로필 이미지 삭제. **응답이 회원 정보 전체라** 통째로 갈아끼운다 (업로드와 다르다) */
export function useRemoveProfileImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => removeProfileImage(),
    onSuccess: (member: MemberMyInfo) => {
      queryClient.setQueryData(memberKeys.me(), member)
    },
  })
}
