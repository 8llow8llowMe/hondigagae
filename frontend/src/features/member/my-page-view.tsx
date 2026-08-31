'use client'

import { useState } from 'react'

import { ConfirmModal } from '@/components/confirm-modal'
import { MyPageSections } from '@/features/member/my-page-sections'
import { useMyInfo } from '@/features/member/use-my-info'
import { useSessionExit } from '@/features/member/use-session-exit'
import { usePetList } from '@/features/pet/use-pet-list'
import { logout } from '@/lib/api/auth'
import { toErrorStatus } from '@/lib/api/error'
import { messages } from '@/lib/messages'

/**
 * `/mypage` — 조회 상태를 `MyPageSections` 의 props 로 변환하고 로그아웃을 배선한다.
 *
 * **두 조회의 실패를 합치지 않는다.** 반려견 조회가 실패해도 회원 정보는 그대로
 * 그려야 한다 (D5) — 그래서 `pets` 를 `null`(실패)과 `[]`(0마리)로 구분해 넘긴다.
 */
export function MyPageView() {
  const query = useMyInfo()
  const petsQuery = usePetList()
  const exitSession = useSessionExit()

  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
      setLogoutOpen(false)
      exitSession()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <>
      <MyPageSections
        member={query.data ?? null}
        loading={query.isPending}
        errorStatus={toErrorStatus(query.error)}
        pets={petsQuery.isError ? null : (petsQuery.data?.pets ?? null)}
        petsLoading={petsQuery.isPending}
        petsTotalCount={petsQuery.data?.totalCount ?? 0}
        onRetry={() => void query.refetch()}
        onLogout={() => setLogoutOpen(true)}
      />

      <ConfirmModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void handleLogout()}
        title={messages.member.logoutConfirmTitle}
        description={messages.member.logoutConfirmDescription}
        confirmLabel={messages.member.logout}
        confirmLoading={loggingOut}
      />
    </>
  )
}
