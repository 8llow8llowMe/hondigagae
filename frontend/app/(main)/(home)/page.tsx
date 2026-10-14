import { cookies } from 'next/headers'

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { JsonLd } from '@/components/json-ld'
import { HomeView } from '@/features/home/home-view'
import { ABOUT_SEEN_COOKIE, hasSeenAbout } from '@/lib/about/seen-cookie'
import { walkTimesPath } from '@/lib/api/insight'
import { paths } from '@/lib/api/paths'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { serviceTodayDay, weekdayOf } from '@/lib/date/day'
import { conditionKey, insightKeys } from '@/lib/insight/queries'
import { WALK_TIMES_PREFETCH_POSITION } from '@/lib/insight/walk-times-position'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import { siteJsonLd } from '@/lib/seo/json-ld'
import { pageMetadata } from '@/lib/seo/page-metadata'
import { siteUrl } from '@/lib/seo/site'
import type { SliceResponse } from '@/types/api'
import type { WalkTimesResponse } from '@/types/insight'
import type { PlanSummaryItem } from '@/types/plan'

/** `2026-08-29 (금) · 제주시` — 지역은 이 서비스가 제주 전용이라 고정이다 */
function formatTodayLabel(todayIso: string): string {
  return `${todayIso} (${weekdayOf(todayIso) ?? ''}) · 제주시`
}

/** 검색어가 든 제목·설명과 정규 주소 (#1130). 문구 근거는 `lib/messages/seo.ts` 머리주석 */
export const metadata = pageMetadata({
  title: messages.seo.homeTitle,
  description: messages.seo.homeDescription,
  path: '/',
})

/**
 * 홈 — 홈-세부명세 D3.
 *
 * **보호 경로가 아니다.** 미로그인도 열리고 로그인 여부로 내용이 갈린다 (공통명세 S1).
 * `proxy.ts` `PROTECTED_PATHS` 에 `/` 를 넣지 않는다 — 넣으면 첫 방문자가 로그인부터 본다.
 *
 * 프리페치는 **전부 `retry: false` + 개별 catch** 다. 한 조회가 실패해도 홈 전체가
 * 죽지 않아야 한다 (architecture-guide.md §9).
 *
 * 판정·장소 추천은 여기서 프리페치하지 않는다 — 기준 장소와 반려견 조건이 **클라이언트
 * localStorage 에서 결정**되므로 서버가 key 를 알 수 없다. 장소 추천은 그에 더해 **캐시 미스
 * 콜드 응답이 dev 실측 18초**라(#1380), 조건 없는 key 로라도 서버에서 기다리면 첫 HTML 이 막힌다.
 *
 * **장소 목록(`GET /places`)을 더는 받지 않는다** (#1380). 홈에서 그 목록의 쓰임은 적합도를 잴
 * 후보(앞 3곳)와 끝 카드의 전체 수뿐이었다 — 추천 API 가 후보를 직접 고르고, 끝 카드는 수를
 * 말하지 않는다 (홈-세부명세 D10-1 · D10-4).
 */
export default async function HomePage() {
  const session = await readSession()
  const authed = session !== null

  const queryClient = getServerQueryClient()

  // 일정은 보호 리소스다. 미로그인이면 부르지 않는다
  const plansPromise =
    session === null
      ? Promise.resolve(null)
      : serverFetch<SliceResponse<PlanSummaryItem>>(paths.plans.list, {
          accessToken: session.accessToken,
        }).catch(() => null)

  /*
    **골든타임 문장을 서버에서 받아 둔다** (#1142). 홈의 LCP 요소인데, 클라이언트가 위치를 판정한
    뒤에야 조회해 FCP 보다 약 5초 늦게 그려졌다. 비로그인 첫 화면은 늘 제주 중심 · 조건 없음이라
    (`lib/insight/walk-times-position.ts`) 같은 key 로 캐시에 넣으면 첫 HTML 에 문장이 들어간다.
    반려견 조건이 있는 로그인 사용자는 key 가 달라 예전처럼 클라이언트가 받는다.

    공개 API 이고 약 80ms 라 일정과 **병렬로** 받는다. 실패하면 클라이언트가 받는다.
  */
  const walkTimesPromise = serverFetch<WalkTimesResponse>(
    walkTimesPath(WALK_TIMES_PREFETCH_POSITION.lat, WALK_TIMES_PREFETCH_POSITION.lng, null),
  ).catch(() => null)

  const [plans, walkTimes] = await Promise.all([plansPromise, walkTimesPromise])

  if (walkTimes !== null) {
    queryClient.setQueryData(
      insightKeys.walkTimes(
        WALK_TIMES_PREFETCH_POSITION.lat,
        WALK_TIMES_PREFETCH_POSITION.lng,
        conditionKey(null),
      ),
      walkTimes,
    )
  }

  /*
    **오늘은 서버가 정한다.** 클라이언트에서 `new Date()` 를 부르면 하이드레이션이
    어긋난다 — 기준 줄의 날짜뿐 아니라 "다가오는 일정" 이 고르는 일정까지 갈린다
    (`lib/date/day.ts` `dayToLocalNoon`). 칸은 서울의 칸(`serviceTodayDay`)이다 (#1507) —
    기준 줄의 요일도 이 칸 문자열에서 읽으므로(`weekdayOf`) 컨테이너 `TZ` 와 무관하다.
  */
  const todayIso = serviceTodayDay(new Date())

  /*
    **소개 카드는 서버가 정한다** (#950). 비로그인이고 소개를 본 적이 없을 때만 선다 —
    쿠키를 여기서 읽으므로 카드가 첫 그림부터 제자리에 있고, 마운트 뒤에 끼어들며 아래
    배너를 밀지 않는다 (`lib/about/seen-cookie.ts`).
  */
  const seenAbout = hasSeenAbout((await cookies()).get(ABOUT_SEEN_COOKIE)?.value)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* 사이트 이름 · 운영 주체 구조화 데이터 (#1131). 보이지 않는다 */}
      <JsonLd data={siteJsonLd(siteUrl())} />
      <HomeView
        authed={authed}
        showAboutIntro={!authed && !seenAbout}
        plans={plans?.contents ?? []}
        todayIso={todayIso}
        todayLabel={formatTodayLabel(todayIso)}
      />
    </HydrationBoundary>
  )
}
