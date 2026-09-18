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
 * **일정 상세가 아니라도, 성공·5xx·무응답에는 아무것도 단정하지 않는다.**
 * `null` 을 돌려주면 `generateMetadata` 가 `title` 필드를 아예 넣지 않아 부모(루트
 * 레이아웃)의 제목을 그대로 물려받는다 — 지금까지의 동작(제목 없음)을 그대로 보존한다.
 * 이 화면은 보호 화면이라 크롤러가 못 들어오므로, 성공했을 때 일정 제목을 굳이 붙이는
 * 것까지는 이 이슈의 범위가 아니다.
 */
export function planDetailNotFoundTitle(error: unknown): string | null {
  const status = toErrorStatus(error)
  if (status === null) return null

  return classify(status) === 'not-found' ? messages.plan.detailNotFoundTitle : null
}
