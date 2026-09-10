import { cache } from 'react'
import { notFound } from 'next/navigation'

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Canvas } from '@/components/surface'
import { PlaceDetailView } from '@/features/place/place-detail-view'
import { placeKeys } from '@/features/place/queries'
import { ApiError } from '@/lib/api/error'
import { placeDetailPath } from '@/lib/api/place'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { placeDetailFallbackTitle } from '@/lib/place/detail-title'
import { toPlainText } from '@/lib/place/text'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { PlaceDetail } from '@/types/place'

/**
 * **이 세그먼트에는 `loading.tsx` 를 두지 않는다.**
 *
 * `loading.tsx` 는 Suspense 경계를 만들고, 경계가 있으면 응답이 먼저 스트리밍되기 시작한다.
 * 그 뒤에 `notFound()` 를 던지면 **not-found UI 는 나오지만 HTTP 상태가 200 으로 남는다**
 * (soft 404). 공개 화면이라 크롤러가 없는 장소를 정상 페이지로 인식하게 된다.
 *
 * 같은 이유로 목록 라우트를 `(list)` 그룹으로 옮겼다 — `places/loading.tsx` 는 자식 세그먼트인
 * 이 화면까지 감쌌다. 실측: 경계가 있으면 404 요청이 200, 없으면 404 다.
 * (docs/architecture-guide.md §7)
 */
type Params = Promise<{ placeId: string }>

const DESCRIPTION_LIMIT = 120

/**
 * `generateMetadata` 와 페이지 렌더가 같은 요청 안에서 백엔드를 두 번 부르지 않게 한다.
 * `serverFetch` 는 `cache: 'no-store'` 라 Next 의 fetch 중복 제거가 걸리지 않는다.
 */
const loadPlaceDetail = cache((placeId: string) =>
  serverFetch<PlaceDetail>(placeDetailPath(placeId)),
)

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { placeId } = await params

  try {
    const place = await loadPlaceDetail(placeId)

    return {
      title: `${place.title} · 혼디가개`,
      description: summarize(place),
    }
  } catch (error) {
    // 조회 실패를 메타데이터 단계에서 화면 실패로 만들지 않는다. 판정은 페이지가 한다
    return { title: `${placeDetailFallbackTitle(error)} · 혼디가개` }
  }
}

export default async function PlaceDetailPage({ params }: { params: Params }) {
  const { placeId } = await params

  // 게스트 블록의 CTA 가 로그인으로 갈지 반려견 등록으로 갈지 가른다.
  // **토큰을 넘기지 않는다** — 판정은 공개 API 이고 로그인 여부만 필요하다
  const session = await readSession()

  // 요청마다 새 인스턴스 — 모듈 스코프 공유는 요청 간 데이터 유출이다
  const queryClient = getServerQueryClient()

  // 목록과 달리 prefetchQuery 를 쓰지 않는다. prefetchQuery 는 에러를 삼켜서
  // 404(경로가 가리키는 리소스 없음)와 5xx(일시 장애)를 구분할 수 없다.
  // fetchQuery 는 던지므로 잡아서 판정한다 — 성공 시 캐시에 채우는 것은 동일하다.
  //
  // retry: false 가 중요하다. 전역 기본값(5xx 2회 재시도)을 상속하면 백엔드가 죽었을 때
  // 서버 렌더가 재시도 백오프만큼 통째로 블로킹된다 (architecture-guide.md §9).
  try {
    await queryClient.fetchQuery({
      queryKey: placeKeys.detail(placeId),
      queryFn: () => loadPlaceDetail(placeId),
      retry: false,
    })
  } catch (error) {
    // 이 URL 자체가 무효하다 → not-found.tsx (architecture-guide.md §7)
    if (error instanceof ApiError && error.kind === 'not-found') notFound()
    // 그 외(5xx·무응답·400)는 화면 전체 실패로 만들지 않는다. 클라이언트가 재조회·안내한다
  }

  /*
    아트보드 `혼디가개 장소 상세.dc.html` 03 절 — 데스크톱은 **좌 400 판정·기본 정보(sticky) /
    우 가변** 2단이다. 폭 상한을 두지 않고 전폭을 쓴다 — 목록·홈과 같은 레일 문법이고,
    가운데 정렬된 좁은 칼럼으로 두면 좌측 레일이 들어갈 자리가 없다.

    레이아웃·브레드크럼·본문은 전부 `PlaceDetailSection` 이 소유한다. 여기서 감싸지 않는
    이유는 브레드크럼이 2단 위의 전폭 줄이기 때문이다 — 카드 열 안에 들어가면 안 된다.

    **`main` 이 L0 바닥이다** (`DESIGN.md §0`, 이슈 #443). 홈·장소 목록과 같은 3층 표면이고,
    바닥은 전폭이어야 하므로 `Canvas` 를 `main` 에 건다 — 그 위에 카드를 쌓는 일은
    `PlaceDetailSection` 의 `SurfaceStack` 이 맡는다.
  */
  return (
    <Canvas as="main" id="main-content">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PlaceDetailView placeId={placeId} authed={session !== null} />
      </HydrationBoundary>
    </Canvas>
  )
}

/** 개요는 HTML 원문이다. 평문으로 바꾼 뒤 잘라 쓴다 */
function summarize(place: PlaceDetail): string {
  const overview = toPlainText(place.overview)
  const source = overview ?? place.addr1 ?? messages.place.pageDescription
  const single = source.replace(/\s+/g, ' ')

  return single.length <= DESCRIPTION_LIMIT ? single : `${single.slice(0, DESCRIPTION_LIMIT)}…`
}
