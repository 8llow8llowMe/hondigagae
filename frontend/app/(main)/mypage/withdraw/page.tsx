import { Canvas, SurfaceStack } from '@/components/surface'
import { MyPageBackLink } from '@/features/member/my-page-back-link'
import { WithdrawView } from '@/features/member/withdraw-view'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

export const metadata = { title: `${messages.member.withdrawTitle} · 혼디가개` }

/**
 * 확인 화면이라 **초기 데이터가 없다.** 프리페치할 것이 없으므로
 * `HydrationBoundary` 도 두지 않는다 (반려견 등록 폼과 같다 —
 * architecture-guide.md §9 확정표).
 */
export default function WithdrawPage() {
  return (
    /*
      **3층 표면** (`DESIGN.md §0`, 이슈 #466). `main` 이 L0 바닥을 전폭으로 깔고,
      사라지는 것들의 설명이 카드 하나가 된다 — 카드는 `WithdrawView` 가 그린다.
      폭은 폼 화면과 같은 `max-w-2xl`(672)이고, 그 폭을 갖는 것은 `SurfaceStack` 이다.

      **머리는 L0 이고 `h1` 이 보인다.** 이 화면의 카드는 제목 없는 설명 묶음이라
      페이지 이름을 대신할 수 없다 — `plan-add-place-header`(#451)와 같은 조건이고,
      반려견 목록(#464)이 `h1` 을 숨긴 조건("카드 이름이 곧 페이지 이름")과는 다르다.
      인셋은 아래 카드 안 글줄과 같은 축(`card`, 16/20)이다.
    */
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        <header className={cn('flex flex-col gap-1 pt-5 pb-1', INSET_CLASS.card)}>
          <MyPageBackLink className="-ml-1" />
          <h1 className="text-title-1 text-fg font-bold">{messages.member.withdrawTitle}</h1>
        </header>

        <WithdrawView />
      </SurfaceStack>
    </Canvas>
  )
}
