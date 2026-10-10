import { Skeleton } from '@/components/skeleton'
import { Surface, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 상세 로딩 — `PlaceDetailSection` 이 그리는 **같은 grid · 같은 카드**를 같은 자리에 세운다.
 *
 * 서버 조회가 404 가 아닌 오류로 실패해 클라이언트가 처음 받는 동안에만 보인다
 * (`page.tsx`). 드문 경로지만 서는 순간 완료 화면과 모양이 같아야 한다
 * (`architecture-guide.md` §7 "로딩 골격은 완료 화면과 같은 자리에 선다").
 *
 * **2단 grid 를 흉내 낸다** (#1037 후속). 예전 골격은 "열을 그리면 빈 회색 기둥이 선다" 는
 * 이유로 한 열이었는데, #935 로 실화면이 `rail-layout-detail-head` 3블록(제목 카드 · 판정
 * 레일 · 혼잡도·방문 정보)이 된 뒤로 1024 이상에서는 **데이터가 오는 순간 카드가 전부
 * 옆 열로 옮겨 갔다.** 기둥이 비는 것이 문제였으므로 레일에도 판정 카드 골격을 세운다.
 * 갤러리 · 제목도 이제 한 `Surface` 안이다(#531) — 골격만 바닥 위에 남아 있었다.
 *
 * 치수는 실측이다 (`/places/125445`, 390 · 1280, 2026-09-29):
 * - 브레드크럼 57 (`py-1.5` + 뒤로 44 + 선)
 * - 제목 카드: 갤러리 200/300 + 출처 줄 18 · 제목 28/36 · 메타 22 · 배지 20 ·
 *   판정 요약 3줄 135(1024 미만만) · 반려견 동반 절
 * - 판정 레일: 적합도 274 · 산책 위험도 242 · 하단 바 73(1024 이상만)
 * - 혼잡도 440 · 방문 정보(제목 + 행 + 지도)
 * 개요 · 반려견 동반 · 근거 줄 수처럼 장소마다 길이가 다른 곳은 한 벌의 대표값으로 잡는다.
 *
 * **순서가 본문 DOM 과 같다** — 모바일에서는 grid 가 아니라 DOM 순서로 쌓이므로 제목 카드 →
 * 판정 → 혼잡도·방문 정보 순이다. 어긋나면 데이터가 도착하는 순간 블록이 자리를 맞바꾼다.
 */
export function PlaceDetailSkeleton() {
  return (
    <div aria-hidden>
      {/* 브레드크럼 — `Breadcrumb` 과 같은 줄 */}
      <div
        className={cn(
          'border-border content-container flex items-center gap-1 border-b py-1.5',
          INSET_CLASS.main,
        )}
      >
        <Skeleton className="h-11 w-24 rounded-md" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="rail-layout rail-layout-detail rail-layout-detail-head">
        {/* ── 우 1: 갤러리 + 제목이 한 장의 카드 */}
        <SurfaceStack className="rail-detail-main lg:pl-3">
          <Surface>
            <div className="flex flex-col gap-5 py-4 md:gap-6 md:py-5">
              <div className="flex flex-col gap-2 md:px-5">
                {/* 높이는 토큰에서 — 갤러리와 값이 갈리면 넘어갈 때 튄다 */}
                <div className="px-4 md:hidden">
                  <div style={{ height: 'var(--gallery-h-mobile)' }}>
                    <Skeleton variant="card" className="h-full w-full" />
                  </div>
                </div>
                <div className="hidden md:block" style={{ height: 'var(--gallery-h-desktop)' }}>
                  <Skeleton variant="card" className="h-full w-full" />
                </div>
                {/* 사진 출처 줄 — 사진이 있는 장소에 선다 */}
                <div className="px-4 md:px-0">
                  <CaptionLine className="w-40" />
                </div>
              </div>

              <div className={cn('flex flex-col gap-3', INSET_CLASS.card)}>
                <div className="flex h-7 items-center justify-between gap-2 lg:h-9">
                  <Skeleton className="h-6 w-3/5 lg:h-8" />
                  <Skeleton className="h-7 w-24 shrink-0 rounded-full" />
                </div>
                <div className="flex h-5.5 items-center">
                  <Skeleton className="h-4 w-2/5" />
                </div>
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-20 rounded-sm" />
                  <Skeleton className="h-5 w-16 rounded-sm" />
                </div>
              </div>

              {/* 판정 요약 3줄 — `PlaceVerdictSummary` 와 같이 1024 미만만 */}
              <div className="border-border border-t lg:hidden">
                <ul
                  className={cn(
                    '[&>li+li]:border-border flex flex-col [&>li+li]:border-t',
                    INSET_CLASS.card,
                  )}
                >
                  {Array.from({ length: 3 }, (_, index) => (
                    <li key={index} className="flex min-h-11 items-center gap-2">
                      <div className="w-20 shrink-0">
                        <Skeleton className="h-3.5 w-14" />
                      </div>
                      <Skeleton className="h-4 w-40" />
                    </li>
                  ))}
                </ul>
              </div>

              {/* 장소 소개 한 줄 */}
              <div className={INSET_CLASS.card}>
                <div className="flex h-5.5 items-center lg:h-6">
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>

              {/* 반려견 동반 절 — 길이가 장소마다 달라 실측 두 폭의 가운데(≈255)로 잡는다 */}
              <div
                className={cn('border-border flex flex-col gap-3 border-t pt-5', INSET_CLASS.card)}
              >
                <div className="flex h-6 items-center">
                  <Skeleton className="h-4.5 w-28" />
                </div>
                <Skeleton className="h-24 w-full" />
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex h-5.5 items-center">
                    <Skeleton className={cn('h-4', index === 2 ? 'w-3/5' : 'w-4/5')} />
                  </div>
                ))}
              </div>
            </div>
          </Surface>
        </SurfaceStack>

        {/* ── 좌: 판정 레일 */}
        <SurfaceStack className="rail-detail-aside rail-sticky pt-2 md:pt-0 lg:pt-6 lg:pr-3">
          <Surface>
            {/* 적합도 — 라벨 · 등급 + 점수 · 근거 상자 */}
            <div className={cn('flex flex-col gap-3 py-4', INSET_CLASS.card)}>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-19.5 w-full" />
              <Skeleton className="h-29 w-full" />
            </div>
            {/* 산책 위험도 */}
            <div
              className={cn('border-border flex flex-col gap-3 border-t py-4', INSET_CLASS.card)}
            >
              <div className="flex h-15 items-end justify-between gap-3">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-9 w-20" />
              </div>
              <Skeleton className="h-13 w-full" />
              <Skeleton className="h-11 w-full" />
              <CaptionLine className="w-48" />
            </div>
            {/* 데스크톱 하단 바 — 모바일은 아래 고정 바가 맡는다 */}
            <div className="border-border hidden border-t lg:block">
              <ActionBarSkeleton />
            </div>
          </Surface>
        </SurfaceStack>

        {/* ── 우 2: 혼잡도 · 방문 정보 */}
        <SurfaceStack className="rail-detail-main pt-2 md:pt-0 lg:pl-3">
          <Surface>
            <div className={cn('flex flex-col gap-3 py-4', INSET_CLASS.card)}>
              <Skeleton className="h-6.5 w-32" />
              <Skeleton className="h-18 w-full" />
              <Skeleton className="h-42 w-full" />
              <CaptionLine className="w-3/5" />
              <CaptionLine className="w-2/5" />
              <Skeleton className="h-11 w-16 rounded-md" />
            </div>
          </Surface>

          {/* 제목은 고정 문구라 실제로 그린다 — `DetailCard` 와 같은 머리 */}
          <Surface title={messages.place.detailSectionVisit}>
            <div className={cn('flex flex-col gap-3 pb-5', INSET_CLASS.card)}>
              <div className="place-visit-split grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8 lg:grid-cols-1">
                {/* 정보 행 + 길찾기 — 1280 부터 지도와 나란히 서고 이 열이 높이를 정한다 */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3">
                    {Array.from({ length: 7 }, (_, index) => (
                      <div key={index} className="flex h-5.5 items-center">
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                  </div>
                  <Skeleton className="h-11 w-full rounded-md" />
                </div>
                {/* `PlaceMiniMap` 과 같은 높이다 — 값이 갈리면 지도가 붙는 순간 아래가 밀린다 */}
                <Skeleton variant="card" className="h-44 w-full md:h-52" />
              </div>
            </div>
          </Surface>
        </SurfaceStack>
      </div>

      {/* 모바일 하단 바 — `PlaceDetailActionBar` 와 같은 고정 자리 */}
      <div className="border-border bg-bg sticky bottom-16 z-30 border-t md:bottom-0 lg:hidden">
        <ActionBarSkeleton />
      </div>
    </div>
  )
}

/** 저장 · 담기 두 버튼 — `PlaceDetailActionBar` 의 `flex gap-2 py-3` 줄 */
function ActionBarSkeleton() {
  return (
    <div className={cn('flex gap-2 py-3', INSET_CLASS.card)}>
      <Skeleton className="size-13 shrink-0 rounded-md lg:size-12" />
      <Skeleton className="h-13 flex-1 rounded-md lg:h-12" />
    </div>
  )
}

/** caption 한 줄(18) — 칸은 줄 높이, 막대만 가늘게 */
function CaptionLine({ className }: { className: string }) {
  return (
    <div className="flex h-4.5 items-center">
      <Skeleton className={cn('h-3.5', className)} />
    </div>
  )
}
