import { classify, toErrorStatus } from '@/lib/api/error'
import { messages } from '@/lib/messages'

/**
 * 일정 상세 조회가 404 일 때의 `<title>` 오버라이드 — 이슈 #676.
 *
 * **`generateMetadata` 안에 두면 테스트할 수 없어 뽑아냈다** — async server component 는
 * `renderToStaticMarkup` 으로 렌더되지 않는다 (`testing-guide.md` §1). 선례는
 * `src/lib/place/detail-title.ts` 다.
 *
 * **`not-found.tsx` 자체의 `metadata` 로는 못 고친다.** `[planId]/page.tsx` 가 비동기
 * 조회 뒤 조건부로 `notFound()` 를 던지는데, Next 16 은 이 경우 **`page.tsx` 가 이미
 * 낙관적으로 확정한 메타데이터를 그대로 쓰고 형제 `not-found.tsx` 의 `metadata` 로
 * 되돌리지 않는다** — 실측(Playwright, dev 서버, 하이드레이션 뒤 `toHaveTitle`)으로
 * 확인했다. `page.tsx` 는 애초에 `metadata`/`generateMetadata` 가 없었으므로 루트
 * 레이아웃의 평문 `혼디가개` 로 떨어졌다. **주소 자체가 없는 전역 404**(`app/not-found.tsx`,
 * 경쟁하는 `page.tsx` 가 없다)에서만 `not-found.tsx` 의 `metadata` 가 먹힌다. 이 비대칭이
 * `docs/architecture-guide.md` §7 `not-found.tsx` 절에 실측으로 정리돼 있다.
 *
 * **5xx·무응답·다른 4xx 에는 아무것도 단정하지 않는다.** `null` 을 돌려주면
 * `generateMetadata` 가 `title` 필드를 아예 넣지 않아 부모(루트 레이아웃)의 제목을 그대로
 * 물려받는다.
 *
 * ### 성공 제목은 `여행 일정` 이다 — 일정 이름은 넣지 않는다 (#905 R5)
 *
 * 예전에는 성공도 `null` 이라 탭이 루트의 평문 `혼디가개` 로 떨어졌다 — 탭 여러 개 사이에서
 * 어느 것이 일정인지 알 수 없었다. **이름은 여전히 싣지 않는다.** 일정 이름은 사용자가 지은
 * 사적 문자열이라(`제주 가족여행 — 엄마 생신` 같은 것) 탭 제목에 오르면 브라우저
 * 히스토리·탭 공유·화면 공유에 그대로 남는다. 보호 화면이라 크롤러가 볼 일도 없어 이름을
 * 실을 이득이 없다. 그래서 목록(`/plans`)과 같은 `messages.plan.pageTitle` 을 낸다.
 *
 * 성공 분기는 `planDetailTitle` 이 갖고, `planDetailNotFoundTitle` 의 계약(404 만 문구,
 * 나머지 `null`)은 그대로 둔다.
 */
export function planDetailNotFoundTitle(error: unknown): string | null {
  const status = toErrorStatus(error)
  if (status === null) return null

  return classify(status) === 'not-found' ? messages.plan.detailNotFoundTitle : null
}

/**
 * 일정 상세의 탭 제목 — `error` 가 `null` 이면 조회 성공이다 (#905 R5).
 *
 * 404 만 `planDetailNotFoundTitle` 의 문구이고, **성공·5xx·무응답은 전부 목록 제목
 * `여행 일정`** 이다 — `architecture-guide.md` §7 의 #206 규칙(5xx 는 판정하지 않는 목록
 * 제목으로 떨어뜨린다)과 `src/lib/place/detail-title.ts` 선례를 따른다. 5xx 뒤 클라이언트
 * 재조회가 성공해도 탭 제목이 바뀌지 않으므로, 성공 제목과 5xx 제목이 같아야 한다.
 */
export function planDetailTitle(error: unknown): string {
  return planDetailNotFoundTitle(error) ?? messages.plan.pageTitle
}
