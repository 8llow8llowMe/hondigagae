import { Skeleton } from '@/components/skeleton'
import { SurfaceList } from '@/components/surface'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

const ROW_COUNT = 3

/**
 * 긴급 시설 로딩 — 아트보드 `긴급 시설` 03 "불러오는 중".
 *
 * **칩 자리를 더 흉내 내지 않는다** (#460). 예전에는 칩이 `EmergencySection` 안에 있어
 * 응답이 올 때까지 칩 폭을 대략 잡아 뒀는데, 칩이 카드 밖 `EmergencyFilterChips` 로 나가
 * 응답과 무관하게 실제로 서 있다(숫자만 늦게 채워진다). 여기 남은 것은 카드 안 내용 —
 * 기준 줄과 행 셋이다.
 *
 * **실데이터와 같은 규약을 쓴다** — `SurfaceList` 의 항목 사이 선, 같은 `inset`.
 * 로딩만 다른 규약이면 데이터가 오는 순간 선과 세로선이 뛴다 (#443 이 상세에서 잡은 것).
 */
export function EmergencySkeleton({ inset = 'card' }: { inset?: Inset }) {
  return (
    <div aria-hidden>
      <div
        className={cn('border-border flex justify-between border-b pt-3 pb-3', INSET_CLASS[inset])}
      >
        <Skeleton variant="text" className="h-4 w-40" />
        <Skeleton variant="text" className="h-4 w-24" />
      </div>

      <SurfaceList>
        {Array.from({ length: ROW_COUNT }, (_, index) => (
          <li key={index} className={INSET_CLASS[inset]}>
            {/*
              **실데이터와 같은 2층이다** (#603) — 머리 한 줄이 전폭이고, 아래 층만
              `[글자 | 버튼 둘]` 로 갈린다. 골격이 한 층이면 데이터가 오는 순간 제목이
              왼쪽으로 늘어나며 행이 튄다.
            */}
            <div className="flex flex-col gap-1.5 py-3">
              <Skeleton variant="text" className="h-6 w-3/5" />

              <div className="flex items-center gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton variant="text" className="h-4 w-4/5" />
                  <Skeleton variant="text" className="h-4 w-2/5" />
                </div>

                {/* 행의 버튼이 둘이다 — 하나만 두면 폭이 88 대신 40 으로 잡힌다 */}
                <div className="flex shrink-0 items-center gap-2">
                  <Skeleton variant="card" className="size-10 rounded-md" />
                  <Skeleton variant="card" className="size-10 rounded-md" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </SurfaceList>
    </div>
  )
}
