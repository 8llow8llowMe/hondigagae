import { Skeleton } from '@/components/skeleton'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'

/**
 * 첫 로딩에 세우는 행 수. 상한이 5마리라 목록이 짧다 — 화면을 덮지 않을 만큼만 세운다.
 *
 * **라우트 스켈레톤(`app/(main)/pets/loading.tsx`)과 섹션 스켈레톤이 같은 값을 봐야 해서**
 * 여기 둔다 — 한쪽만 바뀌면 폴백에서 하이드레이션으로 넘어갈 때 행 수가 변한다
 * (저장한 곳 #462 의 `FAVORITE_SKELETON_COUNT` 와 같은 이유).
 */
export const PET_SKELETON_COUNT = 2

/**
 * 실제 행과 **같은 골격**으로 그린다 — 아바타·이름·품종·생년월·성향 배지에 데스크톱
 * 화살표 자리까지 (가이드 §6 loading).
 *
 * 고정 높이(예: `h-32`)를 쓰면 실데이터 행과 어긋나 로딩이 끝나는 순간 목록이 뛴다.
 * 2a 때는 `rounded-lg` 카드 두 장이라 **카드 안에 카드**였다 (#464).
 *
 * **배지 자리를 셋 둔다.** `PetTraitBadges` 의 크기·활동량·사회성은 필수 필드라 **항상**
 * 그려진다 — 둘만 두면 로딩이 끝날 때 한 줄이 밀린다. 높이도 `Badge` 기본(`md`)에 맞춘다
 * (성향 배지는 `sm` 이 아니다).
 */
export function PetRowSkeleton({ inset = 'card' }: { inset?: Inset }) {
  return (
    <li className={INSET_CLASS[inset]}>
      <div className="flex items-center gap-4 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-3">
            {/* 원형은 사진·아바타에만 허용된 곡선이다 (DESIGN.md §5). `PetPhoto` 기본 48 */}
            <Skeleton className="size-12 shrink-0 rounded-full" />

            <div className="flex min-w-0 flex-col gap-1">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>

          <Skeleton className="h-4 w-40" />

          <div className="flex gap-1.5">
            <Skeleton className="h-6 w-16 rounded-sm" />
            <Skeleton className="h-6 w-24 rounded-sm" />
            <Skeleton className="h-6 w-24 rounded-sm" />
          </div>
        </div>

        {/* 실제 행의 `ChevronRightIcon` 자리 — md 부터만 선다 */}
        <Skeleton className="hidden size-5 shrink-0 rounded-sm md:block" />
      </div>
    </li>
  )
}

/**
 * 목록 위 기준 줄(`N/5마리`)의 자리. **로딩에도 세운다** — 없으면 로드되는 순간 이 줄과
 * 아래 선이 통째로 끼어들어 행 전체가 35px 내려앉는다 (검토 지적).
 */
export function PetListBaselineSkeleton({ inset = 'card' }: { inset?: Inset }) {
  return (
    <div className={`border-border border-b pt-3 pb-3 ${INSET_CLASS[inset]}`}>
      <Skeleton variant="text" className="h-5 w-20" />
    </div>
  )
}
