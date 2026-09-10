import type { ReactNode } from 'react'

import { Skeleton } from '@/components/skeleton'
import { Surface, SurfaceStack } from '@/components/surface'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 상세 로딩 — 아트보드 `장소 상세` 04-④ (이미지 + 제목 + 기본 정보 + 판정 + 3섹션 리듬).
 *
 * **순서가 본문 DOM 과 같아야 한다.** 기본 정보가 레일에서 제목 바로 아래로 옮겨 왔으므로
 * 여기서도 판정보다 앞이다 — 어긋나면 데이터가 도착하는 순간 블록이 자리를 맞바꾼다.
 *
 * **리듬도 본문과 같은 3층 표면이다** (#443). 카드는 `Surface`, 간격은 `SurfaceStack` —
 * 본문이 2a 밴드에서 카드로 바뀌었는데 로딩만 밴드로 남으면 데이터가 오는 순간 표면이
 * 통째로 바뀐다.
 *
 * 실제 콘텐츠와 크기를 맞춰 레이아웃 점프를 막는다 (coding-conventions.md §6).
 * **2단 grid 를 흉내내지 않는다** — 로딩은 한 컬럼이다. 데이터가 오기 전에 열을 그리면
 * 레일 폭만큼 빈 회색 기둥이 서고, 실제 배치가 오면 그 기둥이 사라지며 화면이 흔들린다.
 * 그래서 스택도 하나다.
 */
export function PlaceDetailSkeleton() {
  return (
    <div aria-hidden>
      {/* 브레드크럼 줄 */}
      <div className="border-border h-9 border-b" />

      <SurfaceStack>
        {/* 갤러리 + 제목 줄 — 본문과 같은 묶음 여백 */}
        <div className="flex flex-col gap-5 pt-4 pb-4 md:gap-6 md:pt-0 md:pb-0">
          {/* 높이를 토큰에서 가져온다 — 갤러리와 값이 갈리면 로딩에서 본문으로 넘어갈 때 튄다 */}
          <div className="px-4 md:px-0">
            <div className="w-full" style={{ height: 'var(--gallery-h-mobile)' }}>
              <Skeleton variant="card" className="h-full w-full" />
            </div>
          </div>

          <div className={cn('flex flex-col gap-3', INSET_CLASS.card)}>
            <div className="flex items-center justify-between gap-2">
              <Skeleton variant="text" className="h-8 w-3/5" />
              <Skeleton variant="text" className="h-6 w-20" />
            </div>
            <Skeleton variant="text" className="h-5 w-2/5" />
          </div>
        </div>

        {/* 기본 정보 — 제목 + 값 줄 + 작은 지도 + 길찾기 */}
        <SkeletonCard>
          <Skeleton variant="text" className="h-7 w-28" />
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} variant="text" className="h-5 w-full" />
          ))}
          {/* `PlaceMiniMap` 과 같은 높이다 — 값이 갈리면 지도가 붙는 순간 아래가 밀린다 */}
          <Skeleton variant="card" className="h-44 w-full md:h-52" />
          <Skeleton variant="card" className="h-11 w-full" />
        </SkeletonCard>

        {/* 판정 — 문장 + 점수 */}
        <SkeletonCard>
          <div className="flex items-end justify-between gap-3">
            <Skeleton variant="text" className="h-7 w-40" />
            <Skeleton variant="text" className="h-9 w-16" />
          </div>
          <Skeleton variant="text" className="h-5 w-full" />
          <Skeleton variant="text" className="h-5 w-3/4" />
        </SkeletonCard>

        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonCard key={index}>
            <Skeleton variant="text" className="h-7 w-28" />
            <Skeleton variant="text" className="h-5 w-full" />
            <Skeleton variant="text" className="h-5 w-4/5" />
          </SkeletonCard>
        ))}
      </SurfaceStack>
    </div>
  )
}

/** 카드 한 장 — `DetailCard` 와 같은 인셋·세로 여백이다 */
function SkeletonCard({ children }: { children: ReactNode }) {
  return (
    <Surface>
      <div className={cn('flex flex-col gap-3 py-5', INSET_CLASS.card)}>{children}</div>
    </Surface>
  )
}
