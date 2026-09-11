import { Skeleton } from '@/components/skeleton'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 최초 진입 로딩. 섹션 내부 재조회 로딩은 `MyPageView` 가 담당한다.
 *
 * **route group `(root)` 안에 있다.** `loading.tsx` 는 그 세그먼트와 **모든 하위
 * 세그먼트**를 Suspense 로 감싼다 (architecture-guide.md §7). `mypage/loading.tsx` 로
 * 두면 `/mypage/password` · `/mypage/withdraw` 에도 이 스켈레톤(프로필 + 설정 행)이
 * 떠서, 폼 화면에 오는 사람에게 없는 구조를 먼저 보여준다.
 * `places/(list)` 와 같은 해법이고 **URL 은 `/mypage` 그대로다.**
 *
 * **3층 표면이다** (#466). 바닥·쌓기·카드 둘이 실화면과 같아야 한다 — 층이 다르면
 * 조회가 끝나는 순간 배경색과 카드 경계가 함께 뒤집힌다. `MyPageSections` 의 로딩
 * 분기와 같은 모양을 쓴다 (제목 줄은 서 있고 몸통만 스켈레톤).
 */
export default function MyPageLoading() {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-screen-md">
        <h1 className="sr-only">{messages.member.myPageTitle}</h1>

        <Surface lead title={messages.member.myPageTitle} aria-busy>
          <div aria-hidden className={cn('flex flex-col gap-3 pb-5', INSET_CLASS.card)}>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </Surface>

        <Surface title={messages.member.accountSection} aria-busy>
          {/* 실제 계정 카드 몸통은 `min-h-14` 행 둘(=112)이다 — `gap`·`pb` 를 얹으면 32px 뛴다 */}
          <div aria-hidden className={cn('flex flex-col', INSET_CLASS.card)}>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
