'use client'

import { useState } from 'react'
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
      <Button size="lg" onClick={() => router.replace(returnTo)}>
        {messages.auth.goBack}
      </Button>
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
