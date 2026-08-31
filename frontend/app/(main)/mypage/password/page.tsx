import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { MyPageBackLink } from '@/features/member/my-page-back-link'
import { PasswordView } from '@/features/member/password-view'
import { memberKeys } from '@/features/member/queries'
import { myInfoPath } from '@/lib/api/member'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { MemberMyInfo } from '@/types/member'

export const metadata = { title: `${messages.member.passwordTitle} · 혼디가개` }

export default async function PasswordPage() {
  /*
    폼 화면이지만 **계정 상태를 알아야 어떤 폼을 그릴지 정해진다** (공통명세 S2).
    그래서 `/members/me` 를 함께 프리페치한다 — 없으면 화면이 스켈레톤부터 시작한다.
    `/mypage` 와 같은 key 를 쓰므로 목록에서 넘어온 경우 캐시가 그대로 재사용된다.
  */
  const session = await readSession()
  const queryClient = getServerQueryClient()

  if (session !== null) {
    const accessToken = session.accessToken
    await queryClient
      .prefetchQuery({
        queryKey: memberKeys.me(),
        queryFn: () => serverFetch<MemberMyInfo>(myInfoPath(), { accessToken }),
        retry: false,
      })
      .catch(() => undefined)
  }

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 px-4 py-6 md:px-10 md:py-8">
      <header className="flex flex-col gap-3">
        <MyPageBackLink />
        <h1 className="text-title-1 text-fg font-bold">{messages.member.passwordTitle}</h1>
      </header>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <PasswordView />
      </HydrationBoundary>
    </main>
  )
}
