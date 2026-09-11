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

      **뒤로가기는 L0 다.** 어느 카드에도 속하지 않는다. 인셋은 아래 카드 안 글줄과
      같은 축(`card`, 16/20)이고 데스크톱 세로 여백은 `SurfaceStack` 의 `md:p-6` 이
      맡는다 — `plan-add-place-header`(#451)와 같다.
    */
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        {/*
          **보이는 제목은 카드의 `h2` 다** (§0 "섹션 제목은 섹션 안에 있다"). 카드가
          하나뿐이라 그 이름이 페이지의 이름을 대신한다 — 반려견 등록(#464) · 일정
          만들기(#453)와 같다. `h1` 을 보이게 두면 카드 제목(`lead`, 28/800)이 그보다
          커져 위계가 뒤집힌다 (`DESIGN.md §11`).
        */}
        <h1 className="sr-only">{messages.member.withdrawTitle}</h1>

        <div className={cn('pt-4 md:pt-0', INSET_CLASS.card)}>
          <MyPageBackLink className="-ml-1" />
        </div>

        <WithdrawView />
      </SurfaceStack>
    </Canvas>
  )
}
