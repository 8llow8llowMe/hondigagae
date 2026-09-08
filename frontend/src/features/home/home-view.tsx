'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Banner } from '@/components/banner'
import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { EmergencyIcon } from '@/components/icons'
import { Skeleton } from '@/components/skeleton'
import { useNearbyFacilities } from '@/features/emergency/use-nearby-facilities'
import { IndoorAlternativesSection } from '@/features/home/indoor-alternatives-section'
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
import { DEFAULT_RADIUS_METERS } from '@/lib/api/emergency'
import { toPetCondition } from '@/lib/api/insight'
import { dayToLocalNoon } from '@/lib/date/day'
import { hospitalBannerDescription, pickNearestHospital } from '@/lib/emergency/nearest'
import { getCurrentPosition, type PositionResult } from '@/lib/geo/current-position'
import { collectIndoorAlternatives } from '@/lib/insight/indoor'
import {
  appliedFactorsOf,
  pickTopPlaces,
  resolveBasisPlaceId,
  splitSharedReasons,
} from '@/lib/insight/reasons'
import { readRecentPlaceId } from '@/lib/insight/recent-place'
import { messages } from '@/lib/messages'
import { resolveSelectedPet } from '@/lib/nav/selected-pet'
import { pickUpcomingPlans } from '@/lib/plan/upcoming'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlaceSummary } from '@/types/place'
import type { PlanSummaryItem } from '@/types/plan'

/** 홈은 요약 화면이다. 3장이 적당하다 — 공통명세 S5-2 (N=3) */
const TOP_PLACE_COUNT = 3

/** 실내 대안도 같은 이유로 3곳이다 — 홈-세부명세 D1 의 "3열" */
const INDOOR_ALTERNATIVE_COUNT = 3

/** 다가오는 일정은 한 건만 — 나머지는 `/plans` 가 센다 */
const UPCOMING_PLAN_COUNT = 1

/**
 * 홈 — 아트보드 `01 홈`(모바일 390) / `02 홈`(데스크톱 1440).
 *
 * **데스크톱은 2단이다.** 좌 400 고정(sticky) + 세로선 1px + 우 가변.
 * 좌측 = 변하지 않는 맥락(프로필 · 판정 · 골든타임 · 병원), 우측 = 지금 할 일
 * (권역 · 적합도 · 실내 대안 · 일정). 열 구분선은 우측 열의 `border-left` 가 그린다 —
 * sticky 열에 `border-right` 를 주면 그 열 높이에서 선이 끊긴다 (DESIGN.md §7-2).
 *
 * **좌우를 한 번 다시 갈랐다.** 좌측 레일이 1277px 까지 부풀어 `lg:sticky` 가 뷰포트
 * (헤더 64 를 뺀 936px)를 넘겨 무력화됐고, 그 사이 우측은 520px 이 비어 있었다. 기준은
 * 축이다 — **시간축**("지금 나가도 되나" → "언제 나가나")은 좌측, **공간축**("어느 권역"
 * → "어느 장소" → "비 오면 어느 실내")은 우측이다. 권역이 우측으로 옮겨 갔다.
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
  todayIso,
  todayLabel,
}: {
  authed: boolean
  places: PlaceSummary[]
  plans: PlanSummaryItem[]
  /**
   * `2026-09-07` — **오늘도 서버가 정한다.** 클라이언트에서 `new Date()` 를 부르면
   * 자정을 걸칠 때 서버와 브라우저가 서로 다른 일정을 고른다 (`dayToLocalNoon`).
   */
  todayIso: string
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

  /*
    병원 배너에 실제 시설을 넣는다. **`granted` 일 때만 조회한다** — 폴백 좌표(제주 중심)
    로 잰 거리를 "480m" 라고 쓰면 거짓말이고(`getCurrentPosition` 머리주석), 거리를 못 쓰면
    이 조회로 화면에 보탤 것이 없다. 그때 배너는 지금까지의 고정 문구로 남는다.
  */
  const grantedPosition = position !== null && position.kind === 'granted' ? position : null
  const facilities = useNearbyFacilities(grantedPosition, DEFAULT_RADIUS_METERS)
  const nearestHospital = pickNearestHospital(facilities.data)

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

  /*
    캡션이 말할 축을 응답에서 읽는다 (`appliedFactorsOf`). **고정 문구가 아니다** — 예전에는
    "오늘 날씨와 혼잡도 반영" 이 늘 나가서, 장소 세 장이 전부 `혼잡도 정보 없음` 인 화면에서
    캡션과 배지가 서로를 부정했다.
  */
  const applied = appliedFactorsOf(loaded)
  const sortNote = messages.home.sortNote[applied]
  const sortNoteShort = messages.home.sortNoteShort[applied]

  const placeById = new Map(places.map((place) => [place.placeId, place]))
  const remaining = Math.max(0, places.length - loaded.length)

  /*
    카드 전부에 똑같이 붙는 문장은 장소별 근거가 아니라 **이 화면의 전제**다 (#304).
    카드에서 걷어 목록 위에 한 번만 적는다 — 남는 문장이 곧 장소 간 차이가 된다.
  */
  const { shared: sharedReasons, perPlace: placeReasons } = splitSharedReasons(
    loaded.map((data) => data.reasons),
  )

  /*
    비 예보일 때의 실내 대안. **추가 호출이 없다** — 위 적합도 응답에 이미 들어 있다.
    위에서 보여 준 장소는 제외한다 (`collectIndoorAlternatives`).
  */
  const indoorAlternatives = collectIndoorAlternatives(
    loaded,
    loaded.map((data) => data.placeId),
    INDOOR_ALTERNATIVE_COUNT,
  )

  /*
    **`GET /plans` 는 날짜순이 아니다** — 최근 생성순이다. 그대로 첫 건을 집으면 지나간
    일정이 "다가오는 일정" 으로 뜬다 (`pickUpcomingPlans`).
  */
  const today = dayToLocalNoon(todayIso)
  const upcomingPlans = today === null ? [] : pickUpcomingPlans(plans, today, UPCOMING_PLAN_COUNT)

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
          <p
            className={cn(
              'text-caption text-fg-muted pt-3 font-medium tabular-nums md:pt-5',
              INSET_CLASS.rail,
            )}
          >
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
                <div className={cn('border-border border-t py-4', INSET_CLASS.rail)}>
                  <Skeleton className="h-7 w-40" />
                  <Skeleton className="mt-2 h-5 w-56" />
                </div>
              )}
              {walkSafety.isError && (
                <div className="border-border border-t">
                  <ErrorState
                    title={messages.home.verdictErrorTitle}
                    inset="rail"
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
            골든타임. **산책 위험도 바로 아래다** — "지금 나가도 되나" 다음에 오는 질문이
            "그럼 언제 나가나" 이고, 둘이 떨어지면 같은 판정 규칙을 쓴다는 것이 안 읽힌다.

            **그래서 사이에 밴드를 두지 않는다** (#305). 밴드는 "여기서 다른 이야기가
            시작된다" 는 유일한 신호인데(DESIGN.md §0), 바로 위 주석이 같은 이야기라고
            말하는 자리에 밴드가 서 있었다. 예전에는 판정이 없는 날 여기서 `<Band />` 를
            그렸고, 판정이 있는 날은 `WalkVerdict` 가 접힘 영역 안에서 그렸다 — **상태에
            따라 경계의 굵기가 바뀌고 있었다.**

            지금 이 레일은 `[누구 · 지금 안전한가 · 언제 나가나]` 와 `[위급하면]` 두
            이야기다. 앞의 셋은 1px 선으로 잇고(이 섹션의 `border-t`), 8px 밴드는 이
            섹션이 스스로 그리는 **아래쪽 하나**뿐이다.

            **조회 실패는 섹션을 숨긴다.** 홈의 최소 골격에 이 섹션은 없고, 여기에
            `ErrorState` 를 하나 더 쌓으면 좌측 열이 오류 두 개로 채워진다.
          */}
          <WalkTimesSection
            data={walkTimes.data ?? null}
            loading={position === null || walkTimes.isPending}
            positionFallback={position !== null && position.kind === 'fallback'}
            /*
              **조회는 성공했는데 날씨를 못 받은 경우의 재조회** (#262). 위 주석의 "조회
              실패는 섹션을 숨긴다" 와 다른 갈래다 — 저쪽은 `data === null`(HTTP 실패)이고
              이쪽은 200 응답 안에서 `forecastCoverage: UNAVAILABLE` 로 온다.
            */
            onRetry={() => void walkTimes.refetch()}
          />

          {/*
            상시 진입점. 오류·빈 화면에서도 제거하지 않는다 (Banner 주석).

            **골든타임 바로 아래다.** 예전에는 권역 비교가 이 사이에 끼어 있었는데, 권역은
            "오늘 어디로" 라 우측 열(공간축)로 옮겼다 — 이 배너는 좌측 레일의 정의
            ("위급하면", DESIGN.md §7-1)에 그대로 남는다.
          */}
          <Banner
            href="/emergency"
            title={messages.home.emergencyTitle}
            description={hospitalBannerDescription(nearestHospital)}
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
          {/*
            권역 비교가 이 열의 머리다. **아래 "맞는 곳" 과 같은 질문을 넓은 단위로 먼저
            답한다** — 권역(어느 권역) → 장소(어느 곳) 로 좁혀 읽힌다. 섹션이 스스로 아래
            밴드를 그리므로 여기에 `Band` 를 따로 두지 않는다.

            **조회 실패는 섹션을 숨긴다.** 그러면 이 열은 "맞는 곳" 으로 시작한다 —
            예전 모양이라 어색하지 않다 (공통명세 S4-1 최소 골격).
          */}
          <RegionalWeatherSection
            data={regionalWeather.data ?? null}
            loading={regionalWeather.isPending}
          />

          <section aria-labelledby="suitability-heading">
            <div className="flex items-end justify-between gap-4 px-4 pt-5 pb-2 md:px-10 md:pt-6 md:pb-3">
              <div>
                <h2
                  id="suitability-heading"
                  className="text-title-2 text-fg md:text-display font-semibold break-keep md:font-extrabold"
                >
                  {heading}
                </h2>
                {/*
                  **개수는 반영 축이 없어도 남는다.** 둘은 다른 사실이다 — 무엇을 반영했는지는
                  모를 수 있어도 목록이 몇 곳인지는 언제나 안다.
                */}
                <p className="text-caption text-fg-muted mt-1 hidden font-medium tabular-nums md:block">
                  {sortNote === null ? '' : `${sortNote} · `}
                  {places.length}곳
                </p>
              </div>
              {/* 모바일은 자리가 없어 개수를 빼고 반영 축만 적는다 — 없으면 줄 자체를 그리지 않는다 */}
              {sortNoteShort !== null && (
                <p className="text-caption text-fg-muted shrink-0 font-medium md:hidden">
                  {sortNoteShort}
                </p>
              )}
              <ButtonLink href="/places" className="hidden shrink-0 md:inline-flex">
                {messages.home.findPlaces}
              </ButtonLink>
            </div>

            {/*
              카드에서 걷어 온 공통 근거 (#304) — 목록의 **전제**로 한 번만 선다.

              **문구는 서버 `description` 그대로다.** 여기서 "오늘은" 같은 말을 앞에 붙이면
              FE 가 서버 문장을 다시 쓰는 것이 된다 (docs/styling-guide.md §7).

              **데스크톱 전용이다.** 카드 근거 자체가 `hidden md:block` 이라, 모바일에서는
              걷어낼 것도 옮겨 올 것도 없다 — 여기에 상시 노출로 두면 없던 줄이 새로 생긴다.
              모바일의 특보는 위 권역 섹션의 `WeatherWarningBadge` 가 이미 말한다.

              **기준 장소가 없는 첫 방문자에게도 보인다.** 좌측 판정 섹션은 그때 렌더되지
              않으므로(`resolveBasisPlaceId`), 카드에서만 걷고 끝냈으면 그 사용자는 특보를
              어디서도 못 봤다. 이 자리는 우측 열이라 로그인 여부와 무관하게 남는다.
            */}
            {sharedReasons.length > 0 && (
              <div className="hidden px-4 pb-3 md:block md:px-10">
                {sharedReasons.map((reason, index) => (
                  <p
                    key={`${index}-${reason.code}`}
                    className={cn(
                      'text-body-2 break-keep',
                      reason.scoreDelta === 0 ? 'text-fg-muted' : 'text-fg',
                    )}
                  >
                    {reason.description}
                  </p>
                ))}
              </div>
            )}

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
                      /*
                        1등만 펼치고 나머지는 접는다 (#307). 홈은 요약 화면인데 세 장이
                        전부 펼쳐져 있어 "요약" 이 아니라 "짧은 목록" 이었다 —
                        `DESIGN.md` §1 "낮은 우선순위는 접는다".
                      */
                      collapsed={index > 0}
                      reasons={placeReasons[index] ?? data.reasons}
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

          {/*
            비 예보일 때의 실내 대안. **장소 목록 바로 아래다** — 위 목록을 뒤집는 정보가
            아니라 "비가 오면 이쪽" 이라는 곁가지라, 목록에서 떨어뜨리면 무엇의 대안인지
            읽히지 않는다.

            **밴드는 대안이 있을 때만 그린다.** 비가 안 오는 날은 섹션이 `null` 이라,
            무조건 그리면 아래 일정 밴드와 회색 줄이 두 겹으로 겹친다 (DESIGN.md §0).
          */}
          {indoorAlternatives.length > 0 && (
            <>
              <Band />
              <IndoorAlternativesSection alternatives={indoorAlternatives} />
            </>
          )}

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

              {/*
                **빈 상태가 두 갈래다.** 일정이 아예 없는 것과, 있지만 전부 지나간 것은
                다음 행동이 다르다 — 앞은 만들라는 유도이고 뒤는 목록으로 보내는 안내다.
                넷 다 지난 계정에 "아직 일정이 없어요" 라고 말하면 사용자는 자기 일정이
                사라졌다고 읽는다.
              */}
              {upcomingPlans.length > 0 ? (
                upcomingPlans.map((plan) => (
                  <UpcomingPlanRow key={plan.planId} plan={plan} today={today as Date} />
                ))
              ) : plans.length === 0 ? (
                <EmptyState
                  title={messages.home.noPlanTitle}
                  description={messages.home.noPlanDesc}
                />
              ) : (
                <EmptyState
                  title={messages.home.noUpcomingPlanTitle}
                  description={messages.home.noUpcomingPlanDesc}
                />
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
