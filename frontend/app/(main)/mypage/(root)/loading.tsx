import { Skeleton } from '@/components/skeleton'

/**
 * 최초 진입 로딩. 섹션 내부 재조회 로딩은 `MyPageView` 가 담당한다.
 *
 * **route group `(root)` 안에 있다.** `loading.tsx` 는 그 세그먼트와 **모든 하위
 * 세그먼트**를 Suspense 로 감싼다 (architecture-guide.md §7). `mypage/loading.tsx` 로
 * 두면 `/mypage/password` · `/mypage/withdraw` 에도 이 스켈레톤(프로필 + 설정 행)이
 * 떠서, 폼 화면에 오는 사람에게 없는 구조를 먼저 보여준다.
 * `places/(list)` 와 같은 해법이고 **URL 은 `/mypage` 그대로다.**
 */
export default function MyPageLoading() {
  return (
    <main className="mx-auto w-full max-w-screen-md">
      <div className="border-border flex h-14 items-center border-b px-4 md:px-10">
        <Skeleton variant="text" className="h-7 w-24" />
      </div>
      <div aria-hidden className="flex flex-col gap-3 px-4 py-5 md:px-10">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </main>
  )
}
