import { MyPageBackLink } from '@/features/member/my-page-back-link'
import { WithdrawView } from '@/features/member/withdraw-view'
import { messages } from '@/lib/messages'

export const metadata = { title: `${messages.member.withdrawTitle} · 혼디가개` }

/**
 * 확인 화면이라 **초기 데이터가 없다.** 프리페치할 것이 없으므로
 * `HydrationBoundary` 도 두지 않는다 (반려견 등록 폼과 같다 —
 * architecture-guide.md §9 확정표).
 */
export default function WithdrawPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 px-4 py-6 md:px-10 md:py-8">
      <header className="flex flex-col gap-3">
        <MyPageBackLink />
        <h1 className="text-title-1 text-fg font-bold">{messages.member.withdrawTitle}</h1>
      </header>

      <WithdrawView />
    </main>
  )
}
