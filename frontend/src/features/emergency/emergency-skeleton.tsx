import { Skeleton } from '@/components/skeleton'

const ROW_COUNT = 3

/**
 * 긴급 시설 로딩 — 아트보드 `긴급 시설` 03 "불러오는 중".
 *
 * **칩 자리까지 그대로 잡아 둔다.** 개수(`전체 4 · 병원 3`)는 응답이 와야 알 수 있으므로
 * 칩 안 숫자만 늦게 채워진다 — 칩 줄 자체가 나중에 생기면 목록이 아래로 밀린다.
 */
export function EmergencySkeleton() {
  return (
    <div aria-hidden>
      {/* 칩 폭은 글자 수에 따라 다르다 — 대략의 폭을 잡아 줄바꿈 자리를 미리 확보한다 */}
      <div className="flex gap-1.5 px-4 pt-3 md:px-10">
        {['w-20', 'w-20', 'w-20'].map((width, index) => (
          <Skeleton key={index} variant="card" className={`h-11 rounded-md ${width}`} />
        ))}
      </div>
      <div className="border-border flex gap-1.5 border-b px-4 pt-2 pb-3 md:px-10">
        {['w-24', 'w-28'].map((width, index) => (
          <Skeleton key={index} variant="card" className={`h-11 rounded-md ${width}`} />
        ))}
      </div>

      <div className="px-4 pt-3 pb-2 md:px-10">
        <Skeleton variant="text" className="h-4 w-40" />
      </div>

      <ul>
        {Array.from({ length: ROW_COUNT }, (_, index) => (
          <li key={index} className="border-border border-b last:border-b-0">
            <div className="flex items-center gap-3 px-4 py-3.5 md:px-10">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton variant="text" className="h-6 w-3/5" />
                <Skeleton variant="text" className="h-4 w-2/5" />
                <Skeleton variant="text" className="h-4 w-1/2" />
              </div>
              <Skeleton variant="card" className="size-13 shrink-0 rounded-md" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
