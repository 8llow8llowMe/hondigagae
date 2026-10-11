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
 * ### 성공 제목은 일정 이름이다 (#1383 — #905 R5 를 뒤집었다)
 *
 * #905 R5 는 이름을 싣지 않았다 — 사용자가 지은 사적 문자열(`제주 가족여행 — 엄마 생신` 같은
 * 것)이 브라우저 히스토리 · 탭 공유 · 화면 공유에 남는다는 근거였다. **#1383 에서 사용자 결정으로
 * 뒤집었다** (2026-10-12, 일정상세-세부명세 D24-5): dev 일정 다섯 중 넷의 이름이 `몽과 제주 2박
 * 3일` 이라 모든 탭이 `여행 일정 · 혼디가개` 로 같아 탭 · 기록에서 구분되지 않았다. 보호 화면이라
 * 크롤러에 노출되지 않는 것은 그대로다. 이름이 비면 목록 제목(`messages.plan.pageTitle`)이다.
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
 * 일정 상세의 탭 제목 — `error` 가 `null` 이면 조회 성공이고 `planTitle` 이 그 일정 이름이다.
 *
 * - 성공: **일정 이름** (#1383 · D24-5). 비었으면 목록 제목 `여행 일정`
 * - 404: `planDetailNotFoundTitle` 의 문구
 * - 5xx · 무응답 · 다른 4xx: 목록 제목 `여행 일정` — `architecture-guide.md` §7 의 #206 규칙
 *   (5xx 는 판정하지 않는 목록 제목으로 떨어뜨린다)과 `src/lib/place/detail-title.ts` 선례.
 *
 * **5xx 뒤 클라이언트 재조회가 성공해도 탭 제목은 `여행 일정` 에 남는다** — 메타데이터는 서버가
 * 한 번 정한다. 예전(#905 R5)에는 성공과 5xx 제목을 같게 둬 이 어긋남이 없었는데, 이름을 싣는
 * 이득이 그보다 크다고 봤다 (D24-5). 장애 뒤 일시적인 덜 구체적인 제목일 뿐 틀린 제목은 아니다.
 */
export function planDetailTitle(error: unknown, planTitle?: string | null): string {
  if (error !== null) return planDetailNotFoundTitle(error) ?? messages.plan.pageTitle

  const title = planTitle?.trim() ?? ''
  return title === '' ? messages.plan.pageTitle : title
}
