'use client'

import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { MEMBER_QUERY_OPTIONS, memberKeys } from '@/features/member/queries'
import { fetchMyInfo, removeProfileImage, updateMyInfo, uploadProfileImage } from '@/lib/api/member'
import type { MemberMyInfo, MemberUpdatePayload, ProfileImageUploadResult } from '@/types/member'

const myInfoQuery = {
  queryKey: memberKeys.me(),
  queryFn: fetchMyInfo,
  staleTime: MEMBER_QUERY_OPTIONS.staleTime,
  gcTime: MEMBER_QUERY_OPTIONS.gcTime,
  retry: MEMBER_QUERY_OPTIONS.retry,
}

export function useMyInfo() {
  return useQuery(myInfoQuery)
}

/**
 * 전역 헤더의 내 정보 — **`memberKeys.header` 를 쓴다** (그 key 의 주석: 하이드레이션 불일치).
 *
 * 사진 · 닉네임이 바뀌면 `setMyInfo` · `replaceMyInfo` 가 이 사본도 함께 갈아끼우므로
 * 마이페이지에서 올린 사진이 새로고침 없이 헤더에 뜬다. 로그인 상태에서만 부른다 —
 * 미로그인에 401 을 내지 않는다.
 */
export function useHeaderMyInfo() {
  return useQuery({ ...myInfoQuery, queryKey: memberKeys.header() })
}

/**
 * 내 정보 **부분** 갱신 — **두 사본(`me` · `header`)을 함께** 바꾼다.
 *
 * 한쪽만 바꾸면 마이페이지에서 사진을 올려도 헤더는 `staleTime`(5분) 동안 옛 사진을 든다.
 * 비어 있는 사본은 건너뛴다 — 부분 갱신은 기존 값이 있을 때만 성립한다.
 */
export function setMyInfo(
  queryClient: QueryClient,
  update: (current: MemberMyInfo) => MemberMyInfo,
): boolean {
  let updated = false
  for (const queryKey of [memberKeys.me(), memberKeys.header()]) {
    const current = queryClient.getQueryData<MemberMyInfo>(queryKey)
    if (current === undefined) continue
    queryClient.setQueryData<MemberMyInfo>(queryKey, update(current))
    updated = true
  }
  return updated
}

/** 응답이 회원 정보 **전체**일 때 — 비어 있는 사본에도 그대로 넣는다 */
export function replaceMyInfo(queryClient: QueryClient, member: MemberMyInfo) {
  queryClient.setQueryData(memberKeys.me(), member)
  queryClient.setQueryData(memberKeys.header(), member)
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
      replaceMyInfo(queryClient, member)
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
      const updated = setMyInfo(queryClient, (current) => ({
        ...current,
        profileImageUrl: result.profileImageUrl,
      }))
      if (!updated) {
        void queryClient.invalidateQueries({ queryKey: memberKeys.all })
      }
    },
  })
}

/** 프로필 이미지 삭제. **응답이 회원 정보 전체라** 통째로 갈아끼운다 (업로드와 다르다) */
export function useRemoveProfileImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => removeProfileImage(),
    onSuccess: (member: MemberMyInfo) => {
      replaceMyInfo(queryClient, member)
    },
  })
}
