'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { EmergencyRow } from '@/features/home/emergency-row'
import { PlaceInsightRow } from '@/features/home/place-insight-row'
import { ProfileCard } from '@/features/home/profile-card'
import { UpcomingPlanRow } from '@/features/home/upcoming-plan-row'
import { useSuitabilities, useWalkSafety } from '@/features/home/use-home-insight'
import { WalkVerdict } from '@/features/home/walk-verdict'
import { useSelectedPetStore } from '@/features/nav/selected-pet-store'
import { usePetList } from '@/features/pet/use-pet-list'
import { toPetCondition } from '@/lib/api/insight'
import { pickTopPlaces, resolveBasisPlaceId } from '@/lib/insight/reasons'
import { readRecentPlaceId } from '@/lib/insight/recent-place'
import { messages } from '@/lib/messages'
import { resolveSelectedPet } from '@/lib/nav/selected-pet'
import type { PlaceSummary } from '@/types/place'
import type { PlanSummaryItem } from '@/types/plan'

/** 홈은 요약 화면이다. 3장이 적당하다 — 공통명세 S5-2 (N=3) */
const TOP_PLACE_COUNT = 3

/**
 * 홈 — 아트보드 `01 홈`(모바일 390) / `02 홈`(데스크톱 1440).
 *
 * **데스크톱은 2단이다.** 좌 400 고정(sticky) + 세로선 1px + 우 가변.
 * 좌측 = 변하지 않는 맥락(프로필 · 판정 · 병원), 우측 = 지금 할 일(적합도 · 일정).
 * 열 구분선은 **그리드 컨테이너의 background** 로 깐다 — sticky 열에 `border-right` 를
 * 주면 그 열 높이에서 선이 끊긴다 (DESIGN.md §7-2).
 *
 * 모바일은 한 컬럼이고 P1 → P2 → P3 순서로 밴드가 끊는다.
 *
 * **최소 골격**: 최악에도 nav + 적합도 영역 + 병원 행은 남는다. 홈 전체를 `ErrorState` 로
 * 덮지 않는다 — 진입점이 죽으면 아무 데도 갈 수 없다.
 */
export function HomeView({
  authed,
  places,
  plans,
  todayLabel,
}: {
  authed: boolean
  places: PlaceSummary[]
  plans: PlanSummaryItem[]
  /** `2026-08-29 (금) · 제주시` — 서버에서 만들어 넘긴다 (하이드레이션 불일치 방지) */
  todayLabel: string
}) {
  const [recentPlaceId, setRecentPlaceId] = useState<string | null>(null)
  const storedPetId = useSelectedPetStore((state) => state.selectedPetId)
  const restore = useSelectedPetStore((state) => state.restore)

  useEffect(() => {
    restore()
    setRecentPlaceId(readRecentPlaceId())
  }, [restore])

  const petList = usePetList()
  const pets = authed ? (petList.data?.pets ?? []) : []
  const selectedPet = resolveSelectedPet(pets, storedPetId ?? null)
  const condition = toPetCondition(selectedPet)

  const basisPlaceId = resolveBasisPlaceId(recentPlaceId, null)
  const walkSafety = useWalkSafety(basisPlaceId, condition)

  const topPlaces = pickTopPlaces(places, TOP_PLACE_COUNT)
  const suitabilities = useSuitabilities(
    topPlaces.map((place) => place.placeId),
    condition,
  )

  const loaded = suitabilities.flatMap((query) => (query.data === undefined ? [] : [query.data]))
  const pending = suitabilities.some((query) => query.isPending)
  const allFailed = suitabilities.length > 0 && suitabilities.every((query) => query.isError)
  const refetching = suitabilities.some((query) => query.isFetching && query.data !== undefined)

  const heading =
    selectedPet === null
      ? messages.home.suitabilityFallback
      : messages.home.suitabilityHeading.replace('{name}', selectedPet.name)

  const placeById = new Map(places.map((place) => [place.placeId, place]))
  const remaining = Math.max(0, places.length - loaded.length)

  return (
    <main id="main-content">
      <h1 className="sr-only">혼디가개 홈</h1>

      {/*
        `rail-layout` 은 `app/globals.css` 에 있다 — 2단 grid + 열 구분선을 한 곳에 묶었다.
        2단은 **데스크톱(1024+)부터**다. 태블릿(768~1023)은 한 컬럼을 유지한다 —
        400px 레일 + 우측 본문이 768 에 안 들어가 가로 스크롤이 난다 (실측으로 확인).
      */}
      <div className="rail-layout">
        {/* ── 좌: 변하지 않는 맥락 */}
        <div className="lg:sticky lg:top-16 lg:self-start">
          <p className="text-caption text-fg-muted px-4 pt-3 font-medium tabular-nums md:px-6 md:pt-6">
            {todayLabel}
          </p>

          {authed ? (
            <ProfileCard pets={pets} totalCount={petList.data?.totalCount ?? pets.length} />
          ) : (
            <ProfileCard pets={[]} totalCount={0} />
          )}

          {/* 판정. 기준 장소가 없으면 섹션 자체를 렌더하지 않는다 */}
          {basisPlaceId !== null && (
            <>
              {walkSafety.isPending && (
                <div className="border-border border-t px-4 py-4 md:px-6">
                  <Skeleton className="h-7 w-40" />
                  <Skeleton className="mt-2 h-5 w-56" />
                </div>
              )}
              {walkSafety.isError && (
                <div className="border-border border-t">
                  <ErrorState
                    title={messages.home.verdictErrorTitle}
                    onRetry={() => void walkSafety.refetch()}
                  />
                </div>
              )}
              {walkSafety.data !== undefined && (
                <WalkVerdict
                  data={walkSafety.data}
                  petName={selectedPet?.name ?? null}
                  busy={walkSafety.isFetching && !walkSafety.isPending}
                />
              )}
            </>
          )}

          <Band />
          <EmergencyRow />
          {/* 모바일에서는 병원 행이 맨 아래라 아래 밴드가 필요 없다 */}
          <Band className="md:hidden" />
        </div>

        {/* ── 우: 지금 할 일 */}
        <div>
          <section aria-labelledby="suitability-heading">
            <div className="flex items-end justify-between gap-4 px-4 pt-5 pb-2 md:px-10 md:pt-6 md:pb-3">
              <div>
                <h2
                  id="suitability-heading"
                  className="text-title-2 text-fg md:text-display font-semibold break-keep md:font-extrabold"
                >
                  {heading}
                </h2>
                <p className="text-caption text-fg-muted mt-1 hidden font-medium tabular-nums md:block">
                  {messages.home.sortNote} · {places.length}곳
                </p>
              </div>
              <p className="text-caption text-fg-muted shrink-0 font-medium md:hidden">
                {messages.home.sortNoteShort}
              </p>
              <Link
                href="/places"
                className="bg-brand-500 text-fg-inverse text-body-1 focus-visible:ring-brand-500 hidden h-11 shrink-0 items-center rounded-md px-5 font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:flex"
              >
                {messages.home.findPlaces}
              </Link>
            </div>

            {pending && loaded.length === 0 ? (
              <ul>
                {Array.from({ length: 2 }, (_, index) => (
                  <li key={index} className="border-border flex gap-3 border-t px-4 py-3 md:px-10">
                    <Skeleton variant="thumbnail" className="size-20 shrink-0 md:size-24" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-6 w-2/3" />
                      <Skeleton className="mt-2 h-4 w-1/2" />
                      <Skeleton className="mt-2 h-7 w-20" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : allFailed ? (
              <ErrorState
                title={messages.common.temporaryErrorTitle}
                onRetry={() => suitabilities.forEach((query) => void query.refetch())}
              />
            ) : loaded.length === 0 ? (
              <EmptyState
                title={messages.home.emptyPlacesTitle}
                description={messages.home.emptyPlacesDesc}
                action={
                  <Link
                    href="/places"
                    className="text-body-2 text-link inline-flex h-11 items-center font-semibold"
                  >
                    {messages.home.findPlaces} ›
                  </Link>
                }
              />
            ) : (
              <div aria-busy={refetching || undefined} className={refetching ? 'opacity-55' : ''}>
                <ul>
                  {loaded.map((data, index) => (
                    <PlaceInsightRow
                      key={data.placeId}
                      data={data}
                      place={placeById.get(data.placeId)}
                      first={index === 0}
                    />
                  ))}
                </ul>

                {remaining > 0 && (
                  <div className="border-border border-t px-4 py-3 md:px-10 md:py-4">
                    {/* 모바일은 테두리 버튼, 데스크톱은 텍스트 링크 (아트보드) */}
                    <Link
                      href="/places"
                      className="border-border-strong text-body-1 text-fg focus-visible:ring-brand-500 flex h-11 items-center justify-center rounded-md border font-semibold tabular-nums focus-visible:ring-2 focus-visible:outline-none md:hidden"
                    >
                      {messages.home.morePlaces.replace('{n}', String(remaining))}
                    </Link>
                    <Link
                      href="/places"
                      className="text-body-1 text-link focus-visible:ring-brand-500 hidden min-h-11 items-center font-semibold tabular-nums focus-visible:ring-2 focus-visible:outline-none md:flex"
                    >
                      {messages.home.allPlaces.replace('{n}', String(places.length))}
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>

          <Band />

          {/* 다가오는 일정. 미로그인이면 섹션 미렌더 */}
          {authed && (
            <section aria-labelledby="plan-heading">
              <div className="flex items-baseline justify-between gap-4 px-4 pt-5 pb-2 md:px-10 md:pt-6 md:pb-3">
                <h2
                  id="plan-heading"
                  className="text-title-2 text-fg md:text-title-1 font-semibold md:font-bold"
                >
                  {messages.home.upcomingHeading}
                </h2>
                {plans.length > 0 && (
                  <Link href="/plans" className="text-body-2 text-link shrink-0 font-semibold">
                    {messages.home.allPlans}
                  </Link>
                )}
              </div>

              {plans.length === 0 ? (
                <EmptyState
                  title={messages.home.noPlanTitle}
                  description={messages.home.noPlanDesc}
                />
              ) : (
                plans
                  .slice(0, 1)
                  .map((plan) => (
                    <UpcomingPlanRow key={plan.planId} plan={plan} today={new Date()} />
                  ))
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  )
}

/** 8px 밴드. 성격이 바뀌는 곳에만 */
function Band({ className }: { className?: string }) {
  return <div aria-hidden className={`bg-band h-2 w-full ${className ?? ''}`} />
}
