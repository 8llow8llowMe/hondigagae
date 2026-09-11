import { Skeleton } from '@/components/skeleton'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'

/**
 * 실제 행과 **같은 골격**으로 그린다 — 썸네일과 우측 토글 자리를 포함해 높이·리듬을
 * 흉내 낸다 (가이드 §6 loading).
 *
 * 고정 높이(예: `h-24`)를 쓰면 실데이터 행과 어긋나 로딩이 끝나는 순간 목록이 뛴다.
 * 2a 때는 `rounded-lg` 카드 세 장을 늘어놓아 **카드 안에 카드가 있는 모양**이었는데,
 * 3a 에서는 행 골격 그대로 `SurfaceList` 의 항목이 된다 (#462).
 */
/**
 * 첫 로딩에 세우는 행 수. **2열에서 3행**이 되도록 짝수로 둔다 — 홀수면 로딩 중에만
 * 마지막 행이 한 칸이라 열선 유무(`li:nth-child(odd):not(:last-child)`)가 데이터가 온
 * 뒤와 달라진다. **라우트 스켈레톤과 섹션 스켈레톤이 같은 값을 봐야 해서** 여기 둔다.
 */
export const FAVORITE_SKELETON_COUNT = 6

export function FavoriteRowSkeleton({ inset = 'card' }: { inset?: Inset }) {
  return (
    <li className={INSET_CLASS[inset]}>
      <div className="flex items-center gap-3 py-3 lg:gap-5 lg:py-4">
        <Skeleton variant="thumbnail" className="size-20 shrink-0 lg:size-24" />

        <div className="min-w-0 flex-1">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="mt-1 h-5 w-4/5" />
          <div className="mt-1.5 flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-sm" />
            <Skeleton className="h-5 w-16 rounded-sm" />
          </div>
        </div>

        {/* 우측 토글 자리 — 44px 버튼이 들어온다 */}
        <Skeleton className="size-11 shrink-0 rounded-md" />
      </div>
    </li>
  )
}
