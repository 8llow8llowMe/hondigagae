import { Skeleton } from '@/components/skeleton'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { PlanListSkeleton } from '@/features/plan/plan-list-skeleton'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 여행 일정 목록 최초 진입 로딩 (#907). 섹션 내부 재조회 로딩은 `PlanListSection` 이
 * 같은 `PlanListSkeleton` 으로 담당한다.
 *
 * **목록이 `(list)` 그룹으로 옮겨 왔다.** `plans/[planId]/page.tsx` 가 `notFound()` 를
 * 던지므로 `plans/loading.tsx` 는 둘 수 없다 — 상세까지 Suspense 로 감싸 없는 일정이
 * **200** 으로 나간다 (`architecture-guide.md` §7 soft 404). 장소(#475)·반려견(#563)과
 * 같은 처방이고, 상세 `page.tsx` 머리주석이 "생기면 그때 옮긴다" 로 미뤄 둔 그 시점이다.
 *
 * **가로 배치는 `page.tsx` 와 같다** — `Canvas` 에 `rail-layout rail-layout-filter` 를
 * 걸어 lg 에서 카드가 `--rail-filter`(280) 다음부터 시작한다. 레일 열은 **자리만**
 * 세운다: `PlanFilterRail` 은 반려견 목록과 상태별 개수를 받는데 `loading.tsx` 는 그것을
 * 모른다 (Next 규약). 칩·탭도 같은 이유로 자리만 잡는다 — 상태 탭은 `grid-cols-4`
 * 한 줄, 반려견 칩은 그 아래 한 줄이 실화면의 모양이다.
 *
 * **카드는 실화면과 같은 `lead` 카드 하나다** (`PlanListView`). 제목 오른쪽의 만들기
 * 버튼 자리도 비워 둔다 — 반려견이 있어야 서는 버튼이라 있는지 없는지 모르지만, 없는
 * 쪽으로 두면 로딩이 끝날 때 제목이 버튼 폭만큼 밀린다. **개수 줄도 자리를 잡는다** —
 * `countable` 은 "마지막 페이지까지 받았는가" 라 일정이 0건이어도 조회만 끝나면 선다.
 *
 * **높이는 실화면의 값이다** (390 실측). 상태 탭은 `h-12`, 반려견 칩은 `Chip` 기본 `md`(44)
 * 다 — 처음 골격을 탭 44 · 칩 32 로 두었다가 목록 첫 행이 폴백이 풀릴 때 40px 가까이
 * 밀리는 것을 캡처로 확인하고 맞췄다.
 */
export default function PlansLoading() {
  return (
    <Canvas as="main" id="main-content" className="rail-layout rail-layout-filter">
      {/* 레일의 자리만 잡는다 — 내용은 위 주석 참고 */}
      <div aria-hidden className="rail-column hidden lg:block" />

      <SurfaceStack className="list-column">
        <h1 className="sr-only">{messages.plan.pageTitle}</h1>

        <Surface
          fill
          lead
          titleId="plan-list-heading"
          title={messages.plan.pageTitle}
          description={<Skeleton className="h-4 w-16" />}
          /* 만들기 버튼 자리 — 데스크톱은 md(44), 모바일은 sm(32) 크기다 */
          trailing={<Skeleton className="h-8 w-24 shrink-0 lg:h-11 lg:w-28" />}
          aria-busy
        >
          {/* 상태 탭 + 반려견 칩 — 모바일·태블릿에서만 카드 안에 선다 */}
          <div aria-hidden className="lg:hidden">
            <div className="border-border grid grid-cols-4 border-b">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="flex h-12 items-center justify-center">
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
            <div className={cn('border-border flex gap-1.5 border-b py-3', INSET_CLASS.card)}>
              <Skeleton className="h-11 w-24 rounded-md" />
              <Skeleton className="h-11 w-20 rounded-md" />
            </div>
          </div>

          {/*
            묶음 제목(`다가오는 일정` 등) 자리 — 일정이 한 건이라도 있으면 늘 선다
            (`PlanGroup`, `pt-3 pb-1` + caption). 공용 `PlanListSkeleton` 에 넣지 않는 것은
            시트·만들기 화면도 그것을 쓰는데 거기에는 묶음이 없어서다.
          */}
          <div aria-hidden className={cn('pt-3 pb-1', INSET_CLASS.card)}>
            <Skeleton className="h-5 w-20" />
          </div>
          <PlanListSkeleton />
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
