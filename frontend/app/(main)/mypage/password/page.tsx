import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { Canvas, SurfaceStack } from '@/components/surface'
import { MyPageBackLink } from '@/features/member/my-page-back-link'
import { PasswordView } from '@/features/member/password-view'
import { memberKeys } from '@/features/member/queries'
import { myInfoPath } from '@/lib/api/member'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
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
    /*
      **3층 표면** (`DESIGN.md §0`, 이슈 #466). 폼 규약은 일정 만들기(#453) · 반려견
      등록(#464)과 같다 — `main` 이 L0 바닥을 전폭으로 깔고 폼이 카드 하나가 된다.

      폭이 `max-w-screen-md`(768)에서 **`max-w-2xl`(672)** 로 좁아졌다 — 폼 한 단 폭이고
      #453 · #464 와 같은 값이다. 폭을 가진 것은 `main` 이 아니라 `SurfaceStack` 이다.

      **머리는 L0 다.** 뒤로가기와 `h1` 은 어느 카드에도 속하지 않는다(§0 판정에서
      "페이지 머리" 가 빠진다). 인셋은 `main`(16/40)이 아니라 **`card`(16/20)** 다 —
      L0 위에 있어도 아래 카드 안 글줄과 같은 세로선에 서야 한다
      (`plan-add-place-header` 의 `inset` 주석, #451).

      **`h1` 을 `sr-only` 로 내리지 않는다.** 카드 제목은 계정 상태에 따라
      `비밀번호 변경` / `비밀번호 설정` 으로 갈리므로 페이지 이름(`비밀번호 관리`)을
      대신할 수 없다 — 반려견 목록(#464)이 `h1` 을 숨긴 조건이 여기서는 성립하지 않는다.
    */
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        <header className={cn('flex flex-col gap-1 pt-5 pb-1', INSET_CLASS.card)}>
          <MyPageBackLink className="-ml-1" />
          <h1 className="text-title-1 text-fg font-bold">{messages.member.passwordTitle}</h1>
        </header>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <PasswordView />
        </HydrationBoundary>
      </SurfaceStack>
    </Canvas>
  )
}
