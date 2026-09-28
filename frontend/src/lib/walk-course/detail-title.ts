import type { Metadata } from 'next'

import { classify, toErrorStatus } from '@/lib/api/error'
import { messages } from '@/lib/messages'

/**
 * 올레 코스 상세 조회가 실패했을 때의 `<title>` — 이슈 #980.
 *
 * **장소 상세의 #206 과 같은 판정이다** (`src/lib/place/detail-title.ts`). 예전 catch 는 오류
 * 종류를 보지 않고 목록 제목(`제주올레 코스`)으로 뭉개서, `/olle/{없는 id}` 의 탭이 본문
 * `h1`(`없는 코스예요`)과 다른 말을 했다.
 *
 * - **404 → `detailNotFoundTitle`.** 본문 404 갈래의 `h1`(`DetailShell` 의 `heading`)과 같은
 *   상수다. 서버 `resultMessage` 는 싣지 않는다 — 그 문구는 본문 `EmptyState` 제목의 몫이고(D5),
 *   합쇼체라 다른 404 탭과 말투가 갈린다.
 * - **400 → `validationErrorTitle`.** 본문 `WalkCourseDetailInvalidId` 와 같은 말이다.
 * - **5xx·무응답 → 목록 제목.** 일시 장애라 클라이언트 재조회가 성공할 수 있고, 그러면 실제
 *   코스가 그려진 화면의 탭에 "없는 코스" 가 남는다 (`architecture-guide.md` §7 #206).
 *
 * `generateMetadata` 안에 두면 테스트할 수 없어 뽑아냈다 — async server component 는
 * `renderToStaticMarkup` 으로 렌더되지 않는다 (`testing-guide.md` §1).
 */
export function walkCourseDetailFallbackTitle(error: unknown): string {
  const status = toErrorStatus(error)
  if (status === null) return messages.walkCourse.pageTitle

  switch (classify(status)) {
    case 'not-found':
      return messages.walkCourse.detailNotFoundTitle
    case 'validation':
      return messages.common.validationErrorTitle
    default:
      return messages.walkCourse.pageTitle
  }
}

/**
 * 조회 실패 갈래의 메타데이터 전체 — 제목 + (404 · 400 에서만) `noindex`.
 *
 * **404 에 `noindex` 를 거는 이유.** 이 화면은 없는 코스에도 **200** 을 낸다(soft 200). 본문
 * 404 가 서버 `resultMessage` 를 그려야 하는데 `not-found.tsx` 는 그 값을 받을 수 없어
 * `notFound()` 를 부르지 않는다 (`app/(main)/olle/[walkCourseId]/page.tsx` 머리주석,
 * `코스상세-세부명세.md` D5-6). 공개 SEO 화면이라(canonical 을 못박는다) 크롤러가 없는 코스를
 * 정상 페이지로 색인할 수 있는데, 상태를 못 바꾸는 대신 **색인 신호**로 그것을 막는다.
 *
 * **400 도 같다.** 여기 오는 400 은 `proxy.ts` 의 숫자 판정을 **통과한** id 를 서버가 거절한
 * 경우뿐이다 — `/olle/99999999999999999999` 처럼 모양은 숫자인데 `long` 범위를 넘는 주소.
 * 형식이 틀린 id(`/olle/abc`)는 proxy 가 상태를 400 으로 맞추고 이 조회까지 오지도 않지만,
 * 범위 밖 숫자는 proxy 가 가르지 못해 **200 으로 나간다**(MOCK_API 실측). 같은 요청은 같은
 * 400 이라 색인될 이유가 없다.
 *
 * **5xx·무응답에는 걸지 않는다.** 다음 크롤에서 살아날 수 있는 실패다 — 한 번의 장애가
 * 멀쩡한 코스를 색인에서 빼면 안 된다.
 */
export function walkCourseDetailFallbackMetadata(error: unknown): Metadata {
  const title = `${walkCourseDetailFallbackTitle(error)} · 혼디가개`
  const status = toErrorStatus(error)
  const settled = status !== null && ['not-found', 'validation'].includes(classify(status))

  return settled ? { title, robots: { index: false } } : { title }
}
