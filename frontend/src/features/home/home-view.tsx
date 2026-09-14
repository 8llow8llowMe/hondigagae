'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Banner } from '@/components/banner'
import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { EmergencyIcon } from '@/components/icons'
import { Skeleton } from '@/components/skeleton'
import { Canvas, Surface, SurfaceList, SurfaceStack } from '@/components/surface'
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
import { WeatherWarningStrip } from '@/features/home/weather-warning-strip'
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
import { clearRecentPlaceId, isBasisPlaceGone, readRecentPlaceId } from '@/lib/insight/recent-place'
import { pickWeatherWarning } from '@/lib/insight/weather-warning'
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
 * **3층 표면을 쓰는 첫 화면이다** (#428). `main` 이 `Canvas`(L0)로 화면 끝까지 바닥을
 * 칠하고, 두 열이 각각 `SurfaceStack` 으로 그 위에 `Surface`(L1) 카드를 쌓는다.
 * **바닥과 쌓기를 가른 이유**: 바닥을 열에 걸면 1440 컨테이너 바깥(1800 에서 좌우
 * 177px)이 흰색으로 남는다. 이 화면이 검증 게이트다 — 여기서 "묶어서 파악" 이
 * 좋아지지 않으면 3a 를 걷고 나머지 18화면은 손대지 않는다.
 *
 * **데스크톱은 2단이다.** 좌 400 고정(sticky) + 우 가변.
 * 좌측 = 변하지 않는 맥락(프로필 · 판정 · 골든타임 · 병원), 우측 = 지금 할 일
 * (권역 · 적합도 · 실내 대안 · 일정).
 *
 * **열 구분선 1px 을 걷었다.** 2a 에서는 우측 열의 `border-left` 가 두 기둥을 갈랐는데,
 * L0 바닥이 카드 사이로 비쳐 선 없이 갈린다. 선을 남기면 카드 테두리와 두 겹이 된다.
 * `globals.css` 의 `.rail-layout` 주석이 적어 둔 "배경으로 깔면 우측 열의 흰 목록 행이
 * 덮는다(실측 y=159..569)" 는 함정도 이 열에서는 함께 사라진다.
 *
 * **밴드도 전부 걷었다.** 섹션 사이 간격이 경계를 맡는다 — 2a 에서 폭(1024 미만은
 * 밴드, 이상은 1px 선)과 상태(대안이 있을 때만 밴드)에 따라 경계 굵기가 갈리던 분기가
 * 통째로 없어진다.
 *
 * **좌우를 한 번 다시 갈랐다.** 좌측 레일이 1277px 까지 부풀어 `lg:sticky` 가 뷰포트
 * (헤더 64 를 뺀 936px)를 넘겨 무력화됐고, 그 사이 우측은 520px 이 비어 있었다. 기준은
 * 축이다 — **시간축**("지금 나가도 되나" → "언제 나가나")은 좌측, **공간축**("어느 권역"
 * → "어느 장소" → "비 오면 어느 실내")은 우측이다. 권역이 우측으로 옮겨 갔다.
 *
 * 모바일은 한 컬럼이고 P1 → P2 → P3 순서로 카드가 쌓인다. 카드 사이 8px 로 바닥이
 * 비치는데, 그 값이 2a 의 `Band` 와 같아 모바일 인상은 거의 그대로다.
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

  const storedBasisPlaceId = resolveBasisPlaceId(recentPlaceId, null)
  const walkSafety = useWalkSafety(storedBasisPlaceId, condition)

  /*
    **죽은 기준 장소를 스스로 버린다** (#530). `localStorage` 의 id 가 가리키는 장소가
    서버에서 사라지면 이 조회는 영원히 404 이고, 홈은 `오늘 판정을 불러오지 못했어요` 로
    굳는다 — 404 에는 재시도 버튼도 없으니(`api-integration-guide.md` §3) 사용자가
    빠져나갈 길이 화면에 없다.

    **첫 방문자와 같은 상태로 떨어뜨린다.** 기준이 없는 것은 오류가 아니라 아직 기준을
    고르지 않은 것이고, 그 화면은 이미 있다 (`basisPlaceId === null` → 섹션 미렌더).

    **렌더에서도 같이 끊는다.** effect 만 두면 저장소를 비우기 전 한 프레임 동안
    `ErrorState` 가 번쩍인다 — 지워질 것이 정해진 오류를 한 번 보여 주는 셈이다.
  */
  const basisGone = isBasisPlaceGone(walkSafety.error)
  const basisPlaceId = basisGone ? null : storedBasisPlaceId

  useEffect(() => {
    if (!basisGone) return

    clearRecentPlaceId()
    setRecentPlaceId(null)
  }, [basisGone])
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

  /*
    **기준 장소를 추천에서 뺀다** (#428). 좌측 판정이 "{장소} 기준" 으로 이미 그 장소를
    말하고 있는데 우측 추천 1번에 같은 장소가 다시 섰다 — DESIGN.md §1 "같은 사실을 한
    화면에서 두 번 말하지 않는다. 반복은 강조가 아니라 소음이다".

    **조회는 그대로 두고 렌더에서만 뺀다.** `basisPlaceId` 는 `localStorage` 에서 오므로
    첫 렌더에 `null` 이고 하이드레이션 뒤 값이 생긴다 — 질의 집합을 여기에 묶으면 그
    시점에 키가 바뀌어 재조회가 한 번 더 돈다.
  */
  const visible = loaded.filter((data) => data.placeId !== basisPlaceId)

  /*
    **점수를 낸 곳이 먼저다** (#428). 서버 순서를 그대로 쓰던 동안 `판단 근거 부족`
    (점수 없음) 항목이 목록 맨 위에서 가장 큰 시각 무게를 받고 있었다 — 정보 가치와
    시각 무게가 정반대였다. §1 "위계는 크기와 순서로 만든다".

    **점수 안에서는 서버 순서를 지킨다.** 정렬은 "점수가 있나 없나" 한 축뿐이다 —
    점수끼리 다시 세우면 서버가 고른 순서(적합도 외 요인이 섞인다)를 FE 가 뒤집는다.
  */
  const scored = visible.filter((data) => data.score !== null)
  const unscored = visible.filter((data) => data.score === null)

  const remaining = Math.max(0, places.length - visible.length)

  /*
    카드 전부에 똑같이 붙는 문장은 장소별 근거가 아니라 **이 화면의 전제**다 (#304).
    카드에서 걷어 목록 위에 한 번만 적는다 — 남는 문장이 곧 장소 간 차이가 된다.
  */
  const { shared: sharedReasons, perPlace: placeReasons } = splitSharedReasons(
    scored.map((data) => data.reasons),
  )

  /*
    비 예보일 때의 실내 대안. **추가 호출이 없다** — 위 적합도 응답에 이미 들어 있다.
    위에서 보여 준 장소는 제외한다 (`collectIndoorAlternatives`).
  */
  const indoorAlternatives = collectIndoorAlternatives(
    visible,
    visible.map((data) => data.placeId),
    INDOOR_ALTERNATIVE_COUNT,
  )

  /*
    **`GET /plans` 는 날짜순이 아니다** — 최근 생성순이다. 그대로 첫 건을 집으면 지나간
    일정이 "다가오는 일정" 으로 뜬다 (`pickUpcomingPlans`).
  */
  /*
    날짜 줄의 자리를 가른다 (#428 · #530). **판정 패널이 실제로 서는 날에만** 그쪽이
    날짜를 맡는다 — 스켈레톤·오류 상태에는 판정 줄 자체가 없어 날짜가 사라진다.

    **폭 분기가 없다** (#530). 예전에는 이 조건이 `md:hidden` 과 곱해져 데스크톱만
    판정에 날짜를 넘기고 모바일은 카드 밖에 남겼다 — 같은 줄이 폭에 따라 다른 물건이
    됐다. 이제 `WalkVerdict` 가 두 폭 모두 자기 자리에 날짜를 그린다.
  */
  const verdictShown = basisPlaceId !== null && walkSafety.data !== undefined

  const today = dayToLocalNoon(todayIso)
  const upcomingPlans = today === null ? [] : pickUpcomingPlans(plans, today, UPCOMING_PLAN_COUNT)

  return (
    /* L0 바닥은 `main` 이 전폭으로 칠한다 — 열에 걸면 1440 컨테이너 바깥이 희게 남는다 */
    <Canvas as="main" id="main-content">
      <h1 className="sr-only">혼디가개 홈</h1>

      {/*
        발효 중인 기상특보 — **홈 전체에서 여기 한 번뿐이다** (#349). 예전에는 판정 ·
        골든타임 · 권역이 각자 배지를 그렸는데, 백엔드가 제주 전역 단일 지점에서 특보 하나를
        골라 네 응답에 함께 싣기 때문에 **세 배지의 값이 갈릴 수 없었다.**

        **`rail-layout` 밖, 두 열 위다.** 특보는 어느 한 열의 사실이 아니고, 이 자리가
        로그인·기준 장소·폭과 무관하게 **항상 뜨는 유일한 자리**다.
      */}
      <WeatherWarningStrip
        warning={pickWeatherWarning([
          regionalWeather.data?.weatherWarning,
          walkSafety.data?.weatherWarning,
          walkTimes.data?.weatherWarning,
        ])}
      />

      {/*
        `rail-layout`(`app/globals.css`)이 2단 grid 를 만들고, 열 구분선은 우측 열의
        `border-left` 가 그린다. 2단은 **데스크톱(1024+)부터**다. 태블릿(768~1023)은 한 컬럼을 유지한다 —
        400px 레일 + 우측 본문이 768 에 안 들어가 가로 스크롤이 난다 (실측으로 확인).
      */}
      <div className="rail-layout">
        {/*
          ── 좌: 변하지 않는 맥락.

          **`SurfaceStack` 이 sticky 를 받는다** (#428). 바닥은 `main` 이 이미 칠했고
          이 요소는 카드 간격만 맡는다.
        */}
        {/* 열 사이 24 — 마주 보는 쪽만 절반을 낸다 (globals.css `.rail-layout` 주석, #559) */}
        <SurfaceStack className="lg:sticky lg:top-16 lg:self-start lg:pr-3">
          {/*
            **카드 하나에 셋을 담는다** — `[누구 · 지금 안전한가 · 언제 나가나]`.
            아래 병원 배너가 `[위급하면]` 으로 두 번째 카드다. 이 레일이 두 이야기라는
            정의(DESIGN.md §7-1)를 카드 경계가 그대로 옮긴 것이다.

            **셋을 각자 카드로 쪼개지 않는다.** 프로필과 판정이 갈라지면 판정의 화자
            (누구 기준인가)가 사라지고, 판정과 골든타임이 갈라지면 "지금 나가도 되나 →
            그럼 언제" 가 같은 규칙을 쓴다는 것이 안 읽힌다 (`walk-verdict.tsx` 머리주석).
            카드 안은 1px 선이 잇는다 — 각 블록이 자기 `border-t` 를 그대로 들고 있다.
          */}
          <Surface>
            {/*
              **날짜 줄이 카드 안으로 들어왔다** (#530). 3a 로 바닥이 회색이 되면서 이 줄만
              카드 밖에 떠 **어느 카드의 날짜인지 붙을 곳이 없었다.** #428 이 데스크톱만
              판정 패널로 들였고 모바일은 바닥 위에 남겨, 같은 줄이 폭에 따라 다른 물건이
              됐다.

              **판정이 서는 날은 그리지 않는다.** 그때는 `WalkVerdict` 가 `오늘 산책 {등급}`
              바로 위에 같은 caption 으로 날짜를 그린다 — **두 폭 모두 거기다.** 여기에도
              두면 한 카드가 같은 날짜를 두 번 말한다.

              **판정이 없을 때만 이 자리다** (기준 장소 없음 · 조회 실패 · 로딩). 첫
              방문자가 날짜를 잃지 않으면서, 잃지 않는 자리가 **카드 밖이 아니다.**
            */}
            {!verdictShown && (
              <p
                className={cn(
                  'text-caption text-fg-muted pt-4 font-medium tabular-nums',
                  INSET_CLASS.card,
                )}
              >
                {todayLabel}
              </p>
            )}

            {authed ? (
              <ProfileCard pets={pets} totalCount={petList.data?.totalCount ?? pets.length} />
            ) : (
              <ProfileCard pets={[]} totalCount={0} />
            )}

            {/* 판정. 기준 장소가 없으면 섹션 자체를 렌더하지 않는다 */}
            {basisPlaceId !== null && (
              <>
                {walkSafety.isPending && (
                  /*
                    **카드 안이라 `rail` 이 아니라 `card` 다** (#485). 이 카드는 레일에
                    서지만 인셋 축은 `Surface` 안쪽이라 형제(`ProfileCard` · `WalkVerdict`)가
                    전부 `px-4 md:px-5` 를 쓴다. 여기만 `rail`(md 40) 이면 **로딩(40) →
                    오류(40) → 성공(20)** 으로 재시도를 누르는 동안 글자가 좌우로 움직인다
                    — `ErrorState` 의 `inset` JSDoc 이 적어 둔 바로 그 자리다.
                  */
                  <div className={cn('border-border border-t py-4', INSET_CLASS.card)}>
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="mt-2 h-5 w-56" />
                  </div>
                )}
                {walkSafety.isError && (
                  <div className="border-border border-t">
                    {/*
                      **여기만 `h2` 로 남는다** (#456①). 이 카드(311행 `<Surface>`)는 제목도
                      `aria-label` 도 없어 위에 `h2` 가 없다 — 한 단 내리면 페이지 `h1` 과
                      이 제목 사이가 비어 레벨을 건너뛴다. 카드 안이라고 무조건 `h3` 가
                      아니라, **그 카드가 `h2` 를 갖고 있을 때만** 내린다.
                    */}
                    <ErrorState
                      title={messages.home.verdictErrorTitle}
                      inset="card"
                      onRetry={() => void walkSafety.refetch()}
                    />
                  </div>
                )}
                {walkSafety.data !== undefined && (
                  <WalkVerdict
                    data={walkSafety.data}
                    petName={selectedPet?.name ?? null}
                    todayLabel={todayLabel}
                    busy={walkSafety.isFetching && !walkSafety.isPending}
                  />
                )}
              </>
            )}

            {/*
            골든타임. **산책 위험도 바로 아래다** — "지금 나가도 되나" 다음에 오는 질문이
            "그럼 언제 나가나" 이고, 둘이 떨어지면 같은 판정 규칙을 쓴다는 것이 안 읽힌다.

            **그래서 사이에 밴드를 두지 않는다** (#305). 2a 에서 밴드는 "여기서 다른
            이야기가 시작된다" 는 유일한 신호였는데, 바로 위 주석이 같은 이야기라고 말하는
            자리에 밴드가 서 있었다. 예전에는 판정이 없는 날 여기서 8px 밴드를 그렸고,
            판정이 있는 날은 `WalkVerdict` 가 접힘 영역 안에서 그렸다 — **상태에 따라
            경계의 굵기가 바뀌고 있었다.** (프리미티브는 #475 에서 지웠고, 3a 에서 이
            일은 카드 경계가 맡는다 — `DESIGN.md §0`.)

            지금 이 레일은 `[누구 · 지금 안전한가 · 언제 나가나]` 와 `[위급하면]` 두
            이야기다. 앞의 셋은 1px 선으로 잇고(이 섹션의 `border-t`), **두 이야기의
            경계는 카드 경계와 `SurfaceStack` 간격이 맡는다** — 이 섹션은 8px 밴드를
            하나도 그리지 않는다. 스켈레톤 끝에 마지막 하나가 남아 있던 것을 #475 에서
            걷었다 (카드 안 자식이 자기 배경을 가지면 각진 면이 radius 12 모서리를
            덮는다 — `DESIGN.md §0`).

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
          </Surface>

          {/*
            상시 진입점. 오류·빈 화면에서도 제거하지 않는다 (Banner 주석).

            **골든타임 바로 아래다.** 예전에는 권역 비교가 이 사이에 끼어 있었는데, 권역은
            "오늘 어디로" 라 우측 열(공간축)로 옮겼다 — 이 배너는 좌측 레일의 정의
            ("위급하면", DESIGN.md §7-1)에 그대로 남는다.
          */}
          <Surface>
            <Banner
              href="/emergency"
              title={messages.home.emergencyTitle}
              description={hospitalBannerDescription(nearestHospital)}
              leading={<EmergencyIcon size={24} />}
              inset="card"
            />
          </Surface>
          {/*
            **밴드와 끝맺음 선이 둘 다 사라졌다** (#428). 2a 는 1024 미만에서 좌우가 한
            컬럼으로 이어지는 지점을 밴드로 끊고, 2단에서는 레일의 끝을 1px 선으로
            맺어야 했다 — 폭에 따라 경계의 굵기가 갈리고 있었다.

            3a 는 두 경우 다 **카드 사이 간격**이 경계다. 한 컬럼이든 2단이든 같은 값이라
            폭 분기가 필요 없다.
          */}
        </SurfaceStack>

        {/*
          ── 우: 지금 할 일.

          **열 구분선을 걷었다** (#428). 2a 에서는 이 열의 `border-left` 가 두 기둥을
          갈랐는데, L0 바닥(`Canvas`)이 생기면 흰 카드 사이로 바닥이 비쳐 선 없이도
          갈린다. 선을 남기면 카드 테두리와 두 겹이 된다.

          선을 배경으로 깔지 않는 이유도 함께 사라졌다 — `globals.css` 의 `.rail-layout`
          주석이 "배경으로 깔면 우측 열의 흰 목록 행이 덮는다(실측 y=159..569)" 고
          적어 둔 그 문제다. 3a 는 모든 섹션이 흰 카드라 더 심해졌을 것이다.
        */}
        <SurfaceStack className="lg:pl-3">
          {/*
            권역 비교가 이 열의 머리다. **아래 "맞는 곳" 과 같은 질문을 넓은 단위로 먼저
            답한다** — 권역(어느 권역) → 장소(어느 곳) 로 좁혀 읽힌다.

            **조회 실패는 섹션을 숨긴다.** 그러면 이 열은 "맞는 곳" 으로 시작한다 —
            예전 모양이라 어색하지 않다 (공통명세 S4-1 최소 골격).
          */}
          <RegionalWeatherSection
            data={regionalWeather.data ?? null}
            loading={regionalWeather.isPending}
          />

          <Surface
            lead
            titleId="suitability-heading"
            title={heading}
            description={
              <>
                {/*
                  **개수는 반영 축이 없어도 남는다.** 둘은 다른 사실이다 — 무엇을 반영했는지는
                  모를 수 있어도 목록이 몇 곳인지는 언제나 안다.
                */}
                <p className="text-caption text-fg-muted hidden font-medium tabular-nums md:block">
                  {sortNote === null ? '' : `${sortNote} · `}
                  {places.length}곳
                </p>
                {/* 모바일은 자리가 없어 개수를 빼고 반영 축만 적는다 — 없으면 줄 자체를 그리지 않는다 */}
                {sortNoteShort !== null && (
                  <p className="text-caption text-fg-muted font-medium md:hidden">
                    {sortNoteShort}
                  </p>
                )}
              </>
            }
            trailing={
              <ButtonLink href="/places" className="hidden md:inline-flex">
                {messages.home.findPlaces}
              </ButtonLink>
            }
          >
            {/*
              카드에서 걷어 온 공통 근거 (#304) — 목록의 **전제**로 한 번만 선다.

              **문구는 서버 `description` 그대로다.** 여기서 "오늘은" 같은 말을 앞에 붙이면
              FE 가 서버 문장을 다시 쓰는 것이 된다 (docs/styling-guide.md §7).

              **데스크톱 전용이다.** 카드 근거 자체가 `hidden md:block` 이라, 모바일에서는
              걷어낼 것도 옮겨 올 것도 없다 — 여기에 상시 노출로 두면 없던 줄이 새로 생긴다.
              모바일의 특보는 페이지 최상단 `WeatherWarningStrip` 이 말한다 (#349 — 예전에는
              이 자리에 "위 권역 섹션의 배지" 라고 적혀 있었고, 그 배지는 이제 없다).

              **기준 장소가 없는 첫 방문자에게도 보인다.** 좌측 판정 섹션은 그때 렌더되지
              않으므로(`resolveBasisPlaceId`), 카드에서만 걷고 끝냈으면 그 사용자는 특보를
              어디서도 못 봤다. 이 자리는 우측 열이라 로그인 여부와 무관하게 남는다.
            */}
            {sharedReasons.length > 0 && (
              <div className="hidden px-4 pb-3 md:block md:px-5">
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

            {/*
              **목록과 머리말 사이에 1px 선을 넣는다** (#530). 카드 제목 · 부제 · 공통 근거가
              전부 같은 인셋의 본문 글줄이라, 선이 없으면 첫 행이 바로 위 문장과 한 덩어리로
              읽혔다 — `SurfaceList` 는 **항목 사이에만** 선을 긋고 첫 항목 위는 카드의
              몫이라고 정해 두었다 (`components/surface.tsx`). 그 몫을 여기서 낸다.

              **행을 감싼 쪽에 건다.** 목록에 걸면 `unscored` · `remaining` 행이 있는 날과
              없는 날에 선의 개수가 갈리지 않지만, 스켈레톤 · 오류 · 빈 상태에는 선이 붙지
              않아야 한다 — 그 셋은 행이 아니라 **카드가 통째로 하는 말**이라 위에 선을
              그으면 머리말에서 떨어져 나온다.
            */}
            {pending && visible.length === 0 ? (
              <SurfaceList>
                {Array.from({ length: 2 }, (_, index) => (
                  <li key={index} className="flex gap-3 px-4 py-3 md:px-5">
                    <Skeleton variant="thumbnail" className="size-20 shrink-0 md:size-24" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-6 w-2/3" />
                      <Skeleton className="mt-2 h-4 w-1/2" />
                      <Skeleton className="mt-2 h-7 w-20" />
                    </div>
                  </li>
                ))}
              </SurfaceList>
            ) : allFailed ? (
              <ErrorState
                headingLevel={3}
                inset="card"
                title={messages.common.temporaryErrorTitle}
                onRetry={() => suitabilities.forEach((query) => void query.refetch())}
              />
            ) : visible.length === 0 ? (
              <EmptyState
                headingLevel={3}
                inset="card"
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
              <div
                aria-busy={refetching || undefined}
                className={cn('border-border border-t', refetching && 'opacity-55')}
              >
                <SurfaceList>
                  {scored.map((data, index) => (
                    <PlaceInsightRow
                      key={data.placeId}
                      data={data}
                      place={placeById.get(data.placeId)}
                      /*
                        1등만 펼치고 나머지는 접는다 (#307). 홈은 요약 화면인데 세 장이
                        전부 펼쳐져 있어 "요약" 이 아니라 "짧은 목록" 이었다 —
                        `DESIGN.md` §1 "낮은 우선순위는 접는다".
                      */
                      collapsed={index > 0}
                      reasons={placeReasons[index] ?? data.reasons}
                    />
                  ))}
                </SurfaceList>

                {/*
                  **점수를 못 낸 곳은 접어서 개수로만 말한다** (#428). §1 "낮은 우선순위는
                  접는다". 예전에는 이 항목들이 목록 맨 위에서 썸네일·배지 넷을 달고
                  가장 큰 자리를 차지했다.

                  **지우지는 않는다.** 목록에서 빼면 사용자는 그 장소가 조회되지 않았다는
                  것조차 모른 채 "후보가 둘" 이라고 읽는다 — 권역 섹션이 예보 없는 권역을
                  남기는 것과 같은 이유다.

                  펼침을 두지 않고 `/places` 로 보낸다. 홈은 요약 화면이고, 점수가 없는
                  장소를 홈에서 더 볼 이유가 없다.
                */}
                {unscored.length > 0 && (
                  <Link
                    href="/places"
                    className="text-body-2 text-fg-muted hover:bg-band focus-visible:ring-brand-500 border-border flex min-h-11 items-center justify-between gap-2 border-t px-4 font-medium tabular-nums focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:px-5"
                  >
                    <span>
                      {messages.home.unscoredPlaces.replace('{n}', String(unscored.length))}
                    </span>
                    <span aria-hidden>›</span>
                  </Link>
                )}

                {remaining > 0 && (
                  <div className="border-border border-t px-4 py-3 md:px-5 md:py-4">
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
          </Surface>

          {/*
            비 예보일 때의 실내 대안. **장소 목록 바로 아래다** — 위 목록을 뒤집는 정보가
            아니라 "비가 오면 이쪽" 이라는 곁가지라, 목록에서 떨어뜨리면 무엇의 대안인지
            읽히지 않는다.

            **밴드가 사라졌다** (#428). 2a 에서는 대안이 있을 때만 밴드를 그려야 했다 —
            비가 안 오는 날 섹션이 `null` 이라 무조건 그리면 아래 일정 밴드와 회색 줄이
            두 겹으로 겹쳤다. 3a 는 카드 사이 간격이 경계라 **없는 섹션은 간격도 없다.**
          */}
          {indoorAlternatives.length > 0 && (
            <IndoorAlternativesSection alternatives={indoorAlternatives} />
          )}

          {/* 다가오는 일정. 미로그인이면 섹션 미렌더 */}
          {authed && (
            <Surface
              titleId="plan-heading"
              title={messages.home.upcomingHeading}
              trailing={
                plans.length > 0 ? (
                  <Link href="/plans" className="text-body-2 text-link font-semibold">
                    {messages.home.allPlans}
                  </Link>
                ) : undefined
              }
            >
              {/*
                **빈 상태가 두 갈래다.** 일정이 아예 없는 것과, 있지만 전부 지나간 것은
                다음 행동이 다르다 — 앞은 만들라는 유도이고 뒤는 목록으로 보내는 안내다.
                넷 다 지난 계정에 "아직 일정이 없어요" 라고 말하면 사용자는 자기 일정이
                사라졌다고 읽는다.
              */}
              {upcomingPlans.length > 0 ? (
                <SurfaceList>
                  {upcomingPlans.map((plan) => (
                    <UpcomingPlanRow key={plan.planId} plan={plan} today={today as Date} />
                  ))}
                </SurfaceList>
              ) : plans.length === 0 ? (
                <EmptyState
                  headingLevel={3}
                  inset="card"
                  title={messages.home.noPlanTitle}
                  description={messages.home.noPlanDesc}
                />
              ) : (
                <EmptyState
                  headingLevel={3}
                  inset="card"
                  title={messages.home.noUpcomingPlanTitle}
                  description={messages.home.noUpcomingPlanDesc}
                />
              )}
            </Surface>
          )}
        </SurfaceStack>
      </div>
    </Canvas>
  )
}
