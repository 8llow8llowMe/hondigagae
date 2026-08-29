import { Skeleton } from '@/components/skeleton'
import { Band } from '@/components/surface'

/**
 * 상세 로딩 — 아트보드 `장소 상세` 04-④ (이미지 + 제목 + 판정 + 3섹션 리듬).
 *
 * 실제 콘텐츠와 크기를 맞춰 레이아웃 점프를 막는다 (coding-conventions.md §6).
 * **2단 grid 를 흉내내지 않는다** — 로딩은 한 컬럼이다. 데이터가 오기 전에 열을 그리면
 * 레일 폭만큼 빈 회색 기둥이 서고, 실제 배치가 오면 그 기둥이 사라지며 화면이 흔들린다.
 */
export function PlaceDetailSkeleton() {
  return (
    <div aria-hidden>
      <div className="border-border h-12 border-b" />

      {/* 높이를 토큰에서 가져온다 — 갤러리와 값이 갈리면 로딩에서 본문으로 넘어갈 때 튄다 */}
      <div className="px-4 pt-4 md:px-10 md:pt-6">
        <div className="w-full" style={{ height: 'var(--gallery-h-mobile)' }}>
          <Skeleton variant="card" className="h-full w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pt-5 pb-6 md:px-10">
        <div className="flex items-center justify-between gap-2">
          <Skeleton variant="text" className="h-8 w-3/5" />
          <Skeleton variant="text" className="h-6 w-20" />
        </div>
        <Skeleton variant="text" className="h-5 w-2/5" />
      </div>

      <Band />

      {/* 판정 — 문장 + 점수 */}
      <div className="flex flex-col gap-3 px-4 py-4 md:px-10 lg:px-6">
        <div className="flex items-end justify-between gap-3">
          <Skeleton variant="text" className="h-7 w-40" />
          <Skeleton variant="text" className="h-9 w-16" />
        </div>
        <Skeleton variant="text" className="h-5 w-full" />
        <Skeleton variant="text" className="h-5 w-3/4" />
      </div>

      {Array.from({ length: 3 }, (_, index) => (
        <div key={index}>
          <Band />
          <div className="flex flex-col gap-3 px-4 py-5 md:px-10">
            <Skeleton variant="text" className="h-7 w-28" />
            <Skeleton variant="text" className="h-5 w-full" />
            <Skeleton variant="text" className="h-5 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
