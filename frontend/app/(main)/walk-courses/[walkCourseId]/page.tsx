import { cache } from 'react'

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Canvas } from '@/components/surface'
import { walkCourseKeys } from '@/features/walk-course/queries'
import { WalkCourseDetailInvalidId } from '@/features/walk-course/walk-course-detail-section'
import { WalkCourseDetailView } from '@/features/walk-course/walk-course-detail-view'
import { serverFetch } from '@/lib/api/server'
import { walkCourseDetailPath } from '@/lib/api/walk-course'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import { parseWalkCourseFilters, walkCourseFilterHref } from '@/lib/url/walk-course-filters'
import { isWalkCourseId } from '@/lib/walk-course/id'
import type { WalkCourseDetail } from '@/types/walk-course'

/**
 * `/walk-courses/[walkCourseId]` — 코스 상세 (#618).
 *
 * **공개 화면이다.** `PROTECTED_PATHS` 에 넣지 않는다 (공통명세 S1).
 *
 * **`loading.tsx` 를 두지 않는다.** Suspense 경계가 생기면 응답이 먼저 스트리밍되고,
 * 그 뒤에는 상태 코드를 바꿀 수 없다 (`architecture-guide.md` §7). 형식이 틀린 id 의
 * 400 은 `proxy.ts` 가 `rewrite` 로 맞춘다.
 *
 * **`notFound()` 를 부르지 않는다.** 404 화면이 **서버 `resultMessage` 를 그대로 노출하고**
 * `코스 목록으로` 를 주어야 하는데(`코스상세-세부명세.md` D5), `not-found.tsx` 는 그 문구를
 * 가질 수 없다 — 경계 파일은 왜 없는지를 모른다.
 */
type Params = Promise<{ walkCourseId: string }>

/**
 * 목록에서 실어 보낸 조건 ([#783](https://github.com/8llow8llowMe/hondigagae/issues/783)).
 * 상세는 이 값을 **쓰지 않고 되돌려 주기만 한다** — 조회 파라미터가 아니다.
 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * `generateMetadata` 와 페이지 렌더가 같은 요청 안에서 백엔드를 두 번 부르지 않게 한다.
 * `serverFetch` 는 `cache: 'no-store'` 라 Next 의 fetch 중복 제거가 걸리지 않는다.
 */
const loadWalkCourse = cache((walkCourseId: string) =>
  serverFetch<WalkCourseDetail>(walkCourseDetailPath(walkCourseId)),
)

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { walkCourseId } = await params

  // **형식이 틀리면 묻지 않는다** — 답이 400 으로 정해져 있다. 탭 제목도 화면과 같은 말을 한다
  if (!isWalkCourseId(walkCourseId)) {
    return { title: `${messages.common.validationErrorTitle} · 혼디가개` }
  }

  try {
    const course = await loadWalkCourse(walkCourseId)

    return {
      title: `${course.courseLabel} ${course.name} · 혼디가개`,
      description: messages.walkCourse.pageDescription,
      /*
        **정규 주소를 못박는다** ([#783](https://github.com/8llow8llowMe/hondigagae/issues/783)).
        목록 행이 되돌림용 쿼리(`?activity=…&sort=…`)를 실어 보내면서 **같은 코스가 조합 수만큼
        서로 다른 크롤 가능 URL** 이 됐다. 그 쿼리는 이 화면의 조회 파라미터가 아니라 돌아갈
        곳을 적어 둔 것뿐이라 순전한 중복이다 — 공개 SEO 화면이므로(`architecture-guide.md` §9)
        여기서 하나로 모은다.
      */
      alternates: { canonical: `/walk-courses/${walkCourseId}` },
    }
  } catch {
    // 조회 실패를 메타데이터 단계에서 화면 실패로 만들지 않는다. 판정은 페이지가 한다
    return { title: `${messages.walkCourse.pageTitle} · 혼디가개` }
  }
}

export default async function WalkCourseDetailPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { walkCourseId } = await params

  /*
    **되돌려 줄 목록 주소** (#783). 필터로 좁혀 놓고 상세에 들어온 사용자가 `코스 목록으로`
    를 누르면 전체 29개로 리셋됐다 — 브라우저 뒤로가기는 살아 있었으므로 **화면 안 링크만**
    사용자를 배신했다.

    **받은 쿼리를 그대로 되비추지 않는다.** `parseWalkCourseFilters` 로 한 번 거르고
    `walkCourseFilterHref` 로 다시 조립한다 — 화이트리스트 밖 값(`?sort=DURATION_ASC`)이나
    손으로 적어 넣은 잡음이 우리 화면의 링크에 실려 나가지 않게 한다.
  */
  const backHref = walkCourseFilterHref('/walk-courses', parseWalkCourseFilters(await searchParams))

  /*
    **보내기 전에 가른다** (D0-1). 컨트롤러가 `@PathVariable long` 이라 숫자가 아니면 답이
    400(`WALKCOURSE_113`)으로 정해져 있다 — 물어볼 이유가 없고, **여기서 끊으면 클라이언트
    훅이 마운트되지 않아** 골든타임 요청도 함께 사라진다.

    **`notFound()` 가 아니다.** 이것은 400 이지 404 가 아니고, 화면 안에서 같은 400 을
    잡았을 때와 같은 말을 해야 한다 — 그래서 경계 파일이 아니라 같은 컴포넌트를 그린다.
    상태 코드는 `proxy.ts` 가 `rewrite` 로 400 에 맞춘다.
  */
  if (!isWalkCourseId(walkCourseId)) {
    return (
      <Canvas as="main" id="main-content">
        <WalkCourseDetailInvalidId />
      </Canvas>
    )
  }

  // 골든타임의 반려견 조건을 조회할지 가른다. **토큰을 넘기지 않는다** — 코스는 공개 API 다
  const session = await readSession()

  // 요청마다 새 인스턴스 — 모듈 스코프 공유는 요청 간 데이터 유출이다
  const queryClient = getServerQueryClient()

  /*
    **`prefetchQuery` 가 아니라 `fetchQuery` + try/catch 다.** `prefetchQuery` 는 에러를
    삼켜 404(없는 코스)와 5xx(일시 장애)를 구분할 수 없다. 여기서는 던진 것을 그냥 삼키고
    **판정을 클라이언트에 맡긴다** — 404 화면이 서버 `resultMessage` 를 노출해야 하는데,
    그 값을 서버 컴포넌트에서 화면으로 나르려면 상태 전달 경로를 하나 더 만들어야 한다.
    클라이언트가 재조회하면 같은 404 를 받고(부수 조건이 없는 단건 조회다) 그 문구를 쓴다.

    `retry: false` — 전역 기본값(5xx 2회)을 상속하면 백엔드가 죽었을 때 서버 렌더가
    재시도 백오프만큼 통째로 블로킹된다 (`architecture-guide.md` §9).
  */
  try {
    await queryClient.fetchQuery({
      queryKey: walkCourseKeys.detail(walkCourseId),
      queryFn: () => loadWalkCourse(walkCourseId),
      retry: false,
    })
  } catch {
    // 화면 전체 실패로 만들지 않는다 — 클라이언트가 상태를 그린다
  }

  // `main` 이 L0 바닥이다 (`DESIGN.md §0`) — 카드를 쌓는 일은 `WalkCourseDetailSection` 이 맡는다
  return (
    <Canvas as="main" id="main-content">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <WalkCourseDetailView
          walkCourseId={walkCourseId}
          authed={session !== null}
          backHref={backHref}
        />
      </HydrationBoundary>
    </Canvas>
  )
}
