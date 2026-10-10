'use client'

import { useState } from 'react'

import { ConfirmModal } from '@/components/confirm-modal'
import { useFavoriteList } from '@/features/favorite/use-favorite-list'
import { MyPageSections } from '@/features/member/my-page-sections'
import { MyProfileEditModal } from '@/features/member/my-profile-edit-modal'
import { useMyInfo } from '@/features/member/use-my-info'
import { useSessionExit } from '@/features/member/use-session-exit'
import { WithdrawModal } from '@/features/member/withdraw-modal'
import { usePetList } from '@/features/pet/use-pet-list'
import { logout } from '@/lib/api/auth'
import { toErrorStatus } from '@/lib/api/error'
import { messages } from '@/lib/messages'

/**
 * `/mypage` — 조회 상태를 `MyPageSections` 의 props 로 변환하고 로그아웃 · 탈퇴 확인을 배선한다.
 *
 * **두 조회의 실패를 합치지 않는다.** 반려견 조회가 실패해도 회원 정보는 그대로
 * 그려야 한다 (D5) — 그래서 `pets` 를 `null`(실패)과 `[]`(0마리)로 구분해 넘긴다.
 */
export function MyPageView() {
  const query = useMyInfo()
  const petsQuery = usePetList(true)
  // `/mypage` 는 proxy.ts `PROTECTED_PATHS` 라 미로그인이 여기 닿지 않는다 (#200)
  const favoritesQuery = useFavoriteList()
  const exitSession = useSessionExit()

  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

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
        // null = 조회 실패. 진입점은 남기고 개수 줄만 뺀다 (#127)
        favoritesTotalCount={
          favoritesQuery.isError ? null : (favoritesQuery.data?.totalCount ?? null)
        }
        favoritesLoading={favoritesQuery.isPending}
        onRetry={() => void query.refetch()}
        onLogout={() => setLogoutOpen(true)}
        onWithdraw={() => setWithdrawOpen(true)}
        onEditProfile={() => setEditOpen(true)}
      />

      {/* 회원 정보가 없으면 채울 값이 없다 — 조회 성공 뒤에만 연다 */}
      {query.data !== undefined && (
        <MyProfileEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          member={query.data}
        />
      )}

      <ConfirmModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void handleLogout()}
        title={messages.member.logoutConfirmTitle}
        description={messages.member.logoutConfirmDescription}
        confirmLabel={messages.member.logout}
        confirmLoading={loggingOut}
      />

      {/* 탈퇴는 라우트 이동이 아니라 이 화면 위의 확인이다 (`WithdrawModal` 머리주석) */}
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </>
  )
}
