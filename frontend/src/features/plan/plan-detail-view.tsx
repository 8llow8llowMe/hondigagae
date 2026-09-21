'use client'

import type { ReactNode } from 'react'

import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { SurfaceStack } from '@/components/surface'
import { usePetList } from '@/features/pet/use-pet-list'
import { PlanDetailSection } from '@/features/plan/plan-detail-section'
import { useAnchorScroll } from '@/features/plan/use-anchor-scroll'
import {
  usePlaceEnrichment,
  usePlanDetail,
  usePlanWalkSafety,
  usePlanWeather,
} from '@/features/plan/use-plan-detail'
import { ApiError, isRetriable } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { companionPetsOf } from '@/lib/plan/companion-pets'
import { alternativePlaceIds } from '@/lib/plan/detail'

/**
 * 일정 상세 — 조회 3종을 묶는 껍데기.
 *
 * **오류를 한 덩어리로 다루지 않는다** (D5).
 *  - 일정 본문 5xx → 화면 전체 `ErrorState`
 *  - 판정 5xx → **일자 섹션 안에만** 인라인 (아트보드 06 ③)
 *  - 반려견 조회 실패 → 카드만 빠진다
 *  - 항목의 `place` 가 비어 옴 → 주소 없이 제목만 남고 행은 유지된다 (#86·#115)
 *  - 항목 산책 위험도 5xx → **첫 일자 카드 안에만** 인라인 + 재시도. 404/400 은 자리를
 *    통째로 숨긴다 (#625 · D15-7)
 *
 * 404 는 여기 오지 않는다 — `page.tsx` 가 `notFound()` 로 보낸다.
 */
export function PlanDetailView({ planId, today }: { planId: string; today: string }) {
  const detail = usePlanDetail(planId)
  const weather = usePlanWeather(planId)
  const walkSafety = usePlanWalkSafety(planId)
  const pets = usePetList(true)
  // `/plans` 는 proxy.ts `PROTECTED_PATHS` 라 미로그인이 여기 닿지 않는다 (#200)

  /*
    **보강은 실내 대안만 남았다** (#115). 항목은 상세 응답이 `place` 요약을 함께 주지만
    (#86) `indoorAlternatives` 는 `{placeId, title, lat, lng, distanceMeters}` 뿐이라
    주소를 말하려면 여전히 `GET /places/{id}` 가 필요하다. 판정이 늦게 오면 목록이
    늘어나고 그때 새 id 만 요청이 나간다.
  */
  const alternatives = weather.data?.days.flatMap((day) => day.indoorAlternatives) ?? []
  const { places, pending: enriching } = usePlaceEnrichment(alternativePlaceIds(alternatives))

  /*
    **세 조회가 모두 앉은 뒤** 해시 앵커로 다시 맞춘다. 늦게 도착하는 것이 전부 앵커 위
    콘텐츠를 키우기 때문이다 — 보강은 실내 대안 행마다 주소 줄을 더하고, **판정은
    일자마다 브리핑 블록을 통째로 더한다.** (항목의 주소·거리 줄은 #115 이후 상세
    응답과 함께 오므로 더 이상 늦게 자라지 않는다.)

    **`weather.isFetching` 까지 봐야 한다.** 담기 성공은 판정을 invalidate 하므로
    (항목이 늘면 그날 기준 장소가 바뀐다) 돌아온 직후 판정이 다시 날아온다. 보강만 보고
    맞추면 판정이 늦게 도착하며 `#day3` 이 다시 밀린다 — 실측에서 938px 로 뷰포트를
    벗어났다.
  */
  useAnchorScroll(!detail.isPending && !weather.isFetching && !enriching)

  if (detail.isPending) return null

  if (detail.isError) {
    /*
      **400 에는 재시도를 주지 않는다.** 숫자가 아닌 `planId` 는 404 가 아니라
      400 `PLAN_124` 이고(`@PathVariable long`), 같은 주소를 다시 불러도 같은 400 이다.
      `ErrorState` 는 재시도가 필수 prop 이라 중립 톤 `EmptyState` 를 쓴다 (D5).
    */
    if (detail.error instanceof ApiError && detail.error.status === 400) {
      return (
        <DetailStateShell heading={messages.plan.detailBadRequestTitle}>
          <EmptyState
            title={messages.plan.detailBadRequestTitle}
            description={messages.plan.detailBadRequestDescription}
            inset="card"
            action={
              <ButtonLink href="/plans" variant="secondary">
                {messages.plan.backToList}
              </ButtonLink>
            }
          />
        </DetailStateShell>
      )
    }

    return (
      <DetailStateShell heading={messages.plan.detailErrorTitle}>
        <ErrorState
          title={messages.plan.detailErrorTitle}
          description={messages.plan.errorDescription}
          inset="card"
          onRetry={() => void detail.refetch()}
        />
      </DetailStateShell>
    )
  }

  if (detail.data === undefined) return null

  /*
    이 일정의 **동행 반려견 전체**를 `petIds` 순서로 찾는다 (#218). 대표 한 마리만 읽으면
    두 마리 일정이 한 마리로 보이는데, 같은 화면의 일자 판정은 `basisPetNameOf` 로
    "함께 가는 아이 중" 을 말한다 — 그때 부르는 이름이 화면 어디에도 없게 된다.

    조회 실패·삭제된 반려견이면 그만큼 빠지고, 전부 빠지면 카드만 사라진다 (D5).
  */
  const companions = companionPetsOf(detail.data.petIds, pets.data?.pets ?? [])

  return (
    <PlanDetailSection
      plan={detail.data}
      companions={companions}
      pets={pets.data?.pets ?? []}
      petPending={pets.isPending}
      places={places}
      weather={weather.data}
      weatherFailed={weather.isError}
      onRetryWeather={() => void weather.refetch()}
      /*
        **404/400 은 여기서 걸러진다.** `walkSafety.data` 는 성공했을 때만 채워지므로,
        조회 중이든 404/400 이든 빈 배열이 내려가 자리가 통째로 숨는다 — 둘을 구분해서
        넘길 이유가 없다 (D15-7).
      */
      walkSafetyItems={walkSafety.data?.items ?? []}
      walkSafetyFailed={walkSafety.isError && isRetriable(walkSafety.error)}
      onRetryWalkSafety={() => void walkSafety.refetch()}
      today={new Date(today)}
    />
  )
}

/**
 * 상태 갈래의 껍데기 — **서버 경계와 같은 축에 세운다** (#480).
 *
 * 같은 404·오류가 "누가 잡았는가" 에 따라 다른 자리에 서 있었다. 서버가 404 를 잡으면
 * `app/(main)/plans/[planId]/not-found.tsx` 가 뜨는데 거기는 `content-container`(1440 캡)
 * 안에서 인셋이 `card` 라 md 이상에서 글줄이 44 다. 화면 안 재조회가 잡으면 여기가 뜨는데
 * **캡도 없고 인셋도 기본값 `main`(40)** 이었다.
 *
 * **경계 쪽으로 맞췄다** — 캡 없는 40 은 넓은 화면에서 글줄이 갈 데까지 가고, #475 가
 * 라우트 상태 파일을 옮길 때 이미 캡 + 44 를 고른 판단이 있다. 장소 상세
 * (`place-detail-section.tsx`)의 같은 이름 껍데기와 짝이다.
 *
 * **`h1` 도 경계와 같은 키를 쓴다.** 이 갈래들은 정상 화면 트리에 닿기 전에 반환하므로
 * 예전에는 문서에 `h1` 이 하나도 없었다 — 서버가 잡았을 때는 경계가 `sr-only h1` 을 그렸다.
 */
function DetailStateShell({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <SurfaceStack className="content-container">
      <h1 className="sr-only">{heading}</h1>
      {children}
    </SurfaceStack>
  )
}
