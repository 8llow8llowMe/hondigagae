'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { logout } from '@/lib/api/auth'
import { messages } from '@/lib/messages'

/**
 * 이미 로그인된 상태로 /login 에 온 경우.
 *
 * 전역 nav 가 아직 없어(#15) 로그아웃 진입점이 여기뿐이다
 * — docs/features/auth/공통명세.md S5-5.
 */
export function LoggedInNotice({ returnTo }: { returnTo: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isSubmitting, setSubmitting] = useState(false)

  async function handleLogout() {
    if (isSubmitting) return
    setSubmitting(true)
    try {
      await logout()
      queryClient.clear()
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title-1 text-fg font-bold">{messages.auth.alreadyLoggedIn}</h1>
      {/*
       * 이동이므로 Button onClick 이 아니라 <a> 다 — 새 탭·가운데클릭·history 대체 없는
       * 이동을 위해서다. `Button` 은 <button> 만 렌더해 href 를 못 받는다
       * (component-guide.md §3, 이슈 #11 선례 PlaceBackLink). `Button` 의 `primary`/`lg`
       * 시각을 그대로 복제한다 — 이 화면의 주 행동이라 텍스트 링크가 아니라 버튼처럼
       * 보여야 한다.
       */}
      <Link
        href={returnTo}
        className="bg-brand-500 text-fg-inverse hover:bg-brand-600 active:bg-brand-700 focus-visible:ring-brand-500 inline-flex h-12 items-center justify-center gap-2 rounded-md px-5 text-center font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {messages.auth.goBack}
      </Link>
      <Button
        variant="secondary"
        size="lg"
        loading={isSubmitting}
        onClick={() => void handleLogout()}
      >
        {messages.auth.logout}
      </Button>
    </div>
  )
}
