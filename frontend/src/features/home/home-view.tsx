'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Banner } from '@/components/banner'
import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { EmergencyIcon } from '@/components/icons'
import { Skeleton } from '@/components/skeleton'
import { PlaceInsightRow } from '@/features/home/place-insight-row'
import { ProfileCard } from '@/features/home/profile-card'
import { RegionalWeatherSection } from '@/features/home/regional-weather-section'
import { UpcomingPlanRow } from '@/features/home/upcoming-plan-row'
import {
  useRegionalWeather,
  useSuitabilities,
  useWalkSafety,
  useWalkTimes,
} from '@/features/home/use-home-insight'
import { WalkTimesSection } from '@/features/home/walk-times-section'
import { WalkVerdict } from '@/features/home/walk-verdict'
import { useSelectedPetStore } from '@/features/nav/selected-pet-store'
import { usePetList } from '@/features/pet/use-pet-list'
import { toPetCondition } from '@/lib/api/insight'
import { getCurrentPosition, type PositionResult } from '@/lib/geo/current-position'
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

  const petList = usePetList(authed)
  /*
    **`authed ?` 삼항을 걷었다** (#200). 예전에는 조회를 막지 못해 게스트도 응답(403)을
    받았고 그 결과를 여기서 버렸다. 이제 `usePetList` 가 미로그인에 조회하지 않으므로
    `data` 가 `undefined` 이고, 삼항은 같은 답을 두 번 말하는 줄이 된다.
  */
  const pets = petList.data?.pets ?? []
  const selectedPet = resolveSelectedPet(pets, storedPetId ?? null)
  const condition = toPetCondition(selectedPet)

  const basisPlaceId = resolveBasisPlaceId(recentPlaceId, null)
  const walkSafety = useWalkSafety(basisPlaceId, condition)
  /*
    골든타임 좌표 (#180). **`/emergency` 와 같은 `getCurrentPosition()` 을 쓴다** — 거부·
    타임아웃·미지원을 그 함수가 이미 구분해 처리하고, 어느 경우에도 제주 중심 좌표를
    돌려준다. 여기서 위치 로직을 새로 짜면 두 화면이 다르게 굴게 된다.

    예전에는 제주시청 좌표를 상수로 박아 뒀는데, **그 값이 `JEJU_QUERY_CENTER` 의 폴백과
    같은 값이었다** — 같은 뜻의 상수가 둘이면 반드시 갈라진다.

    **기준 장소가 없어도 조회한다.** 산책 위험도는 장소가 있어야 성립하지만 골든타임은
    좌표만 있으면 되고, 첫 방문자에게도 "오늘 언제 나가면 좋은지" 는 답할 수 있다.
  */
  const [position, setPosition] = useState<PositionResult | null>(null)

  useEffect(() => {
    void getCurrentPosition().then(setPosition)
  }, [])

  const walkTimes = useWalkTimes(position, condition)
  const regionalWeather = useRegionalWeather(condition)

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
        `rail-layout`(`app/globals.css`)이 2단 grid 를 만들고, 열 구분선은 우측 열의
        `border-left` 가 그린다. 2단은 **데스크톱(1024+)부터**다. 태블릿(768~1023)은 한 컬럼을 유지한다 —
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

          {/*
            판정이 그려질 때는 **밴드를 `WalkVerdict` 가 접힘 영역 안에서 그린다** —
            바깥에 두면 모바일에서 접었을 때 빨간 줄 아래 회색 줄만 덩그러니 남는다.
          */}
          {walkSafety.data === undefined && <Band />}

          {/*
            골든타임. **산책 위험도 바로 아래다** — "지금 나가도 되나" 다음에 오는 질문이
            "그럼 언제 나가나" 이고, 둘이 떨어지면 같은 판정 규칙을 쓴다는 것이 안 읽힌다.

            **위 `Band` 뒤에 둔다.** 이 섹션이 스스로 아래 밴드를 그리므로 앞에 두면
            판정이 없는 날 밴드가 연달아 두 줄로 겹친다.

            **조회 실패는 섹션을 숨긴다.** 홈의 최소 골격에 이 섹션은 없고, 여기에
            `ErrorState` 를 하나 더 쌓으면 좌측 열이 오류 두 개로 채워진다.
          */}
          <WalkTimesSection
            data={walkTimes.data ?? null}
            loading={position === null || walkTimes.isPending}
            positionFallback={position !== null && position.kind === 'fallback'}
          />

          {/*
            권역 비교. **골든타임 바로 아래다** — 골든타임이 "오늘 언제" 를 답하고 이쪽이
            "오늘 어디로" 를 답한다. 둘 다 오늘의 날씨 판단이라 떨어뜨리면 짝이 안 읽힌다.
          */}
          <RegionalWeatherSection
            data={regionalWeather.data ?? null}
            loading={regionalWeather.isPending}
          />

          {/* 상시 진입점. 오류·빈 화면에서도 제거하지 않는다 (Banner 주석) */}
          <Banner
            href="/emergency"
            title={messages.home.emergencyTitle}
            description={messages.home.emergencyDesc}
            leading={<EmergencyIcon size={24} />}
            inset="rail"
          />
          {/*
            **1024 미만은 한 컬럼이라 병원 행 다음에 우측 열이 이어진다** — 묶음이
            바뀌므로 밴드로 끊는다 (DESIGN.md §0). 2단이 되는 1024부터는 레일의
            마지막 블록이라 끊을 다음 묶음이 없고, 대신 1px 선으로 끝을 맺는다.
          */}
          <Band className="lg:hidden" />
          <div aria-hidden className="border-border hidden border-t lg:block" />
        </div>

        {/* ── 우: 지금 할 일. 열 구분선은 여기 border-left 다 (globals.css `.rail-layout` 주석) */}
        <div className="lg:border-border lg:border-l">
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
              <ButtonLink href="/places" className="hidden shrink-0 md:inline-flex">
                {messages.home.findPlaces}
              </ButtonLink>
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
                    <ButtonLink
                      href="/places"
                      variant="secondary"
                      className="flex w-full tabular-nums md:hidden"
                    >
                      {messages.home.morePlaces.replace('{n}', String(remaining))}
                    </ButtonLink>
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
