'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Banner } from '@/components/banner'
import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { EmergencyIcon } from '@/components/icons'
import { Skeleton } from '@/components/skeleton'
import { Band, RowList, Section } from '@/components/surface'
import { SuitabilityCard } from '@/features/home/suitability-card'
import { UpcomingPlanCard } from '@/features/home/upcoming-plan-card'
import { useSuitabilities, useWalkSafety } from '@/features/home/use-home-insight'
import { WalkVerdictCard } from '@/features/home/walk-verdict-card'
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
 * 홈 본문 — 홈-세부명세 D3 · D5.
 *
 * **최소 골격**: 최악의 경우에도 nav + 적합도 영역 + 긴급 바는 남는다 (공통명세 S4-1).
 * **섹션 단위로 실패한다** — 홈 전체를 `ErrorState` 로 덮지 않는다. 진입점이 죽으면
 * 아무 데도 갈 수 없다.
 */
export function HomeView({
  authed,
  places,
  plans,
}: {
  authed: boolean
  places: PlaceSummary[]
  plans: PlanSummaryItem[]
}) {
  const [recentPlaceId, setRecentPlaceId] = useState<string | null>(null)
  const storedPetId = useSelectedPetStore((state) => state.selectedPetId)
  const restore = useSelectedPetStore((state) => state.restore)

  // localStorage 는 서버에서 읽을 수 없다. 마운트 후에 읽어야 하이드레이션이 어긋나지 않는다
  useEffect(() => {
    restore()
    setRecentPlaceId(readRecentPlaceId())
  }, [restore])

  const petList = usePetList()
  const selectedPet = authed
    ? resolveSelectedPet(petList.data?.pets ?? [], storedPetId ?? null)
    : null
  const condition = toPetCondition(selectedPet)

  // 최근 본 장소 → 일정 첫 장소 → null (공통명세 S5-1)
  const basisPlaceId = resolveBasisPlaceId(recentPlaceId, null)

  const walkSafety = useWalkSafety(basisPlaceId, condition)
  const topPlaces = pickTopPlaces(places, TOP_PLACE_COUNT)
  const suitabilities = useSuitabilities(
    topPlaces.map((place) => place.placeId),
    condition,
  )

  const heading =
    selectedPet === null
      ? messages.home.suitabilityFallback
      : messages.home.suitabilityHeading.replace('{name}', selectedPet.name)

  const loadedSuitabilities = suitabilities.flatMap((query) =>
    query.data === undefined ? [] : [query.data],
  )
  const suitabilityPending = suitabilities.some((query) => query.isPending)
  const suitabilityAllFailed =
    suitabilities.length > 0 && suitabilities.every((query) => query.isError)
  // 반려견 전환 중에는 스켈레톤 대신 이전 값을 흐리게 유지한다 (D4-2)
  const refetching = suitabilities.some((query) => query.isFetching && query.data !== undefined)

  return (
    <main id="main-content" className="flex flex-col">
      {/*
        화면 제목은 h1 이다 (홈-세부명세 D6). 홈은 디자인상 큰 제목을 두지 않으므로
        시각적으로는 감추고 문서 구조에만 남긴다 — h1 이 없으면 스크린리더 사용자가
        이 문서가 무엇인지 알 수 없고, 아래 섹션 h2 들이 상위 없이 뜬다.
      */}
      <h1 className="sr-only">혼디가개 홈</h1>
      {/* ── 오늘 판정. 기준 장소가 없으면 섹션 자체를 렌더하지 않는다 (S4-1) */}
      {basisPlaceId !== null && (
        <>
          {walkSafety.isPending && (
            <div className="px-4 py-5 md:px-10">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-3 h-10 w-56" />
              <Skeleton className="mt-3 h-16 w-full" />
            </div>
          )}
          {walkSafety.isError && (
            <ErrorState
              title={messages.common.temporaryErrorTitle}
              onRetry={() => void walkSafety.refetch()}
            />
          )}
          {walkSafety.data !== undefined && (
            <WalkVerdictCard
              data={walkSafety.data}
              petName={selectedPet?.name ?? null}
              busy={walkSafety.isFetching && !walkSafety.isPending}
            />
          )}
          <Band />
        </>
      )}

      {/* ── 오늘 맞는 곳. **항상 있다** */}
      <Section title={heading}>
        {/* "적합도 순" 이라고 쓰지 않는다 — 상위 3개만 조회하므로 전체 정렬이 아니다 (D8-1) */}
        <p className="text-caption text-fg-muted -mt-3 px-4 pb-3 md:px-10">
          {messages.home.sortNote}
        </p>

        {suitabilityPending && loadedSuitabilities.length === 0 ? (
          <RowList>
            {Array.from({ length: 2 }, (_, index) => (
              <li key={index} className="border-border border-b px-4 py-4 md:px-10">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="mt-3 h-8 w-24" />
              </li>
            ))}
          </RowList>
        ) : suitabilityAllFailed ? (
          <ErrorState
            title={messages.common.temporaryErrorTitle}
            onRetry={() => suitabilities.forEach((query) => void query.refetch())}
          />
        ) : loadedSuitabilities.length === 0 ? (
          <EmptyState
            title={messages.home.emptyPlacesTitle}
            description={messages.home.emptyPlacesDesc}
            action={
              <Link href="/places">
                <Button variant="secondary">{messages.home.findPlaces}</Button>
              </Link>
            }
          />
        ) : (
          <div
            aria-busy={refetching || undefined}
            className={refetching ? 'opacity-55' : undefined}
          >
            <RowList>
              {loadedSuitabilities.map((data, index) => (
                <SuitabilityCard
                  key={data.placeId}
                  data={data}
                  last={index === loadedSuitabilities.length - 1}
                />
              ))}
            </RowList>
          </div>
        )}
      </Section>

      <Band />

      {/* ── 다가오는 일정. 미로그인이면 섹션 미렌더 (D5-3) */}
      {authed && (
        <>
          <Section title={messages.home.upcomingHeading}>
            {plans.length === 0 ? (
              <EmptyState
                title={messages.home.noPlanTitle}
                description={messages.home.noPlanDesc}
              />
            ) : (
              <RowList>
                {plans.slice(0, 1).map((plan) => (
                  <UpcomingPlanCard key={plan.planId} plan={plan} />
                ))}
              </RowList>
            )}
          </Section>
          <Band />
        </>
      )}

      {/* ── 긴급 시설 바. **모든 상태에서 남는다** (가이드 §5 Banner) */}
      <Banner
        href="/emergency"
        title={messages.home.emergencyTitle}
        description={messages.home.emergencyDesc}
        leading={<EmergencyIcon size={24} />}
      />
    </main>
  )
}
