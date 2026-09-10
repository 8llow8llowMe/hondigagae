import { Skeleton } from '@/components/skeleton'

const ROW_COUNT = 3

/**
 * 긴급 시설 **지도 갈래** 패널·시트 전용 로딩.
 *
 * **캡션을 다시 그리지 않는다.** `EmergencySkeleton`(`emergency-skeleton.tsx`)은
 * `EmergencySection`(목록 갈래)의 기준 줄 자리까지 함께 그린다 (칩 자리는 #460 에서
 * 빠졌다 — 칩이 카드 밖에 실제로 서기 때문이다). 지도 갈래는 실제 캡션이 패널·시트 머리에
 * 이미 있으므로, 거기에 `EmergencySkeleton` 을 그대로 쓰면 "실제 캡션 → 캡션 자리 → 행"
 * 으로 같은 줄이 두 벌 보인다. `board.position === null` 인 동안(좌표
 * 대기, 거부·정지 시 최대 11초) 이 화면을 여는 모든 사용자가 이 상태를 먼저 본다.
 *
 * **여백은 패널 자신의 16px 한 축이다** (`px-4`, `md:`/`lg:` 없음). `EmergencyMapPanel`
 * 의 실제 행이 같은 이유로 평평한 `px-4` 를 쓴다 — `md:` 는 뷰포트 기준이라 400px 패널
 * 안에서도 40px 씩 먹어 실제 행과 다른 세로선에 선다 (`lib/ui/inset.ts` 의 `panel` 참고).
 */
export function EmergencyMapSkeleton() {
  return (
    <ul className="divide-border divide-y" aria-hidden>
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <li key={index} className="flex items-center gap-3 px-4 py-3">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton variant="text" className="h-6 w-3/5" />
            <Skeleton variant="text" className="h-4 w-2/5" />
            <Skeleton variant="text" className="h-4 w-1/2" />
          </div>
          <Skeleton variant="card" className="size-13 shrink-0 rounded-md" />
        </li>
      ))}
    </ul>
  )
}
