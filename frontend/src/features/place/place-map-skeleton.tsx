'use client'

import { useState } from 'react'

import { MAP_TOP_CONTROLS_INSET, MapSheet, type SheetStop } from '@/components/map-sheet'
import { Skeleton } from '@/components/skeleton'
import { cn } from '@/lib/utils/cn'

const ROW_COUNT = 6

/**
 * 지도 패널·시트의 **행 골격** — `PlaceMapPanel` 한 행과 같은 칸이다.
 *
 * 행은 `py-3` + 썸네일 `size-20`(80) = 104 에 구분선 1 이라 **105** 다 (390 · 1280 실측,
 * 2026-09-29). 글 열이 80 을 넘지 않게 배지 · 제목 · 주소 세 줄로 잡는다. 오른쪽 `w-24`
 * 열은 `상세` 버튼(44) 자리다.
 *
 * **여백은 패널 자신의 16px 한 축이다** (`pl-4` · `pr-4`) — `PlaceMapPanel` 이 그렇다.
 * `md:` 는 뷰포트 기준이라 400px 패널 안에서 다른 세로선에 선다 (`EmergencyMapSkeleton` 과
 * 같은 이유).
 */
export function PlaceMapRowsSkeleton() {
  return (
    <ul aria-hidden className="divide-border divide-y">
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <li key={index} className="flex items-stretch">
          <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4">
            <Skeleton variant="thumbnail" className="size-20 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-sm" />
                <Skeleton className="h-5 w-12 rounded-sm" />
              </div>
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4.5 w-3/5" />
            </div>
          </div>
          <div className="flex w-24 shrink-0 items-center justify-end py-3 pr-4">
            <Skeleton className="h-11 w-16 rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * `PlaceMapFilterBar` 자리 — 유형 칩 한 줄(44) + 조건 버튼 한 줄(44), 사이 `gap-1.5`.
 * 선택값은 `searchParams` 라 골격이 알 수 없어 **높이만** 실화면 값이다.
 */
function FilterBarSkeleton() {
  return (
    <div aria-hidden className="flex min-w-0 flex-col gap-1.5">
      <div className="flex gap-1.5 overflow-hidden">
        {['w-14', 'w-18', 'w-18', 'w-14', 'w-20'].map((width, index) => (
          <Skeleton key={index} className={cn('h-11 shrink-0 rounded-md', width)} />
        ))}
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-11 w-36 rounded-md" />
        <Skeleton className="h-11 w-20 rounded-md" />
        <Skeleton className="h-11 w-24 rounded-md" />
      </div>
    </div>
  )
}

/**
 * `/places` **지도 보기의 로딩 모양** — `PlaceMapView` 가 그리는 표면을 같은 자리에 세운다.
 *
 * **이 화면의 기본 보기가 지도다** (`PLACES_DEFAULT_VIEW`). 예전 `loading.tsx` 는 목록
 * 카드를 그려, 탭바·헤더로 들어온 거의 모든 진입에서 **목록 골격이 섰다가 지도로 바뀌었다.**
 *
 * 흉내 내는 것(1280 · 390 실측, 2026-09-29):
 * - 바닥 — `MapCanvas` 의 SDK 대기 면과 같은 `bg-bg-sunken`, 높이는 `.map-canvas-height`
 * - 우상단 — 보기 전환 버튼(110×44, #1125), 1024 미만은 그 왼쪽 검색(입력 + 아이콘 버튼 44)
 * - 데스크톱 — 좌측 400 패널(`top-6 bottom-8 left-4`): 검색 줄 61 · 필터 줄 111 · 개수 줄 35 · 행
 * - 모바일 — `MapSheet` 를 **그대로** 쓴다(`mid`). 머리 높이(그래버 · 필터 102 · 개수 42)가
 *   시트 자신의 것이라 두 벌로 두면 갈린다
 *
 * **client component 인 이유는 시트 하나다** — `MapSheet` 가 단계 상태를 받는다. 골격을
 * 보는 동안 단계를 바꿔도 해가 없으므로 실제 상태를 준다.
 */
export function PlaceMapSkeleton() {
  const [stop, setStop] = useState<SheetStop>('mid')

  return (
    <div aria-busy className="map-canvas-height relative">
      <div aria-hidden className="bg-bg-sunken size-full" />

      {/* 우상단 — `PlaceMapView` 의 떠 있는 컨트롤 줄과 같은 칸 */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-5 z-30 lg:top-6">
        <div className="content-container flex items-start justify-end gap-2 px-4 md:px-10">
          <div className="flex max-w-md min-w-0 flex-1 gap-2 lg:hidden">
            <Skeleton className="h-11 min-w-0 flex-1 rounded-md" />
            <Skeleton className="size-11 shrink-0 rounded-md" />
          </div>
          <Skeleton className="h-11 w-28 shrink-0 rounded-lg" />
        </div>
      </div>

      {/* 데스크톱 좌측 패널 */}
      <div className="absolute top-6 bottom-8 left-4 z-30 hidden lg:block">
        <div className="map-panel-width h-full">
          <div className="bg-bg border-border flex h-full w-full flex-col overflow-hidden rounded-xl rounded-tr-none border shadow-lg">
            <div aria-hidden className="border-border flex gap-2 border-b px-3 py-2">
              <Skeleton className="h-11 min-w-0 flex-1 rounded-md" />
              <Skeleton className="h-11 w-16 shrink-0 rounded-md" />
            </div>
            <div className="border-border border-b px-3 py-2">
              <FilterBarSkeleton />
            </div>
            <div aria-hidden className="bg-bg-sunken border-border border-b px-4 py-2">
              <Skeleton className="h-4.5 w-20" />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <PlaceMapRowsSkeleton />
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 하단 시트 */}
      <MapSheet
        label="장소 목록"
        stop={stop}
        onStopChange={setStop}
        toolbar={<FilterBarSkeleton />}
        header={<Skeleton className="h-4.5 w-20" />}
        maxTopInset={MAP_TOP_CONTROLS_INSET}
      >
        <PlaceMapRowsSkeleton />
      </MapSheet>
    </div>
  )
}
