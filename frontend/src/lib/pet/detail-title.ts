import { toErrorStatus } from '@/lib/api/error'
import { messages } from '@/lib/messages'

/**
 * 반려견 상세(수정 화면) 조회 결과의 `<title>` — 이슈 #676.
 *
 * **`generateMetadata` 안에 두면 테스트할 수 없어 뽑아냈다** — async server component 는
 * `renderToStaticMarkup` 으로 렌더되지 않는다 (`testing-guide.md` §1). 선례는
 * `src/lib/place/detail-title.ts`.
 *
 * **`not-found.tsx` 자체의 `metadata` 로는 못 고친다.** `[petId]/page.tsx` 가 비동기
 * 조회 뒤 조건부로 `notFound()` 를 던지는데, Next 16 은 이 경우 **`page.tsx` 자신의
 * (정상 화면용) `metadata` 를 이미 확정해 두고 형제 `not-found.tsx` 의 `metadata` 로
 * 되돌리지 않는다** — 실측(Playwright, dev 서버, 하이드레이션 뒤 `toHaveTitle`)으로
 * 확인했다. 그래서 404 에서도 탭이 "반려견 정보 수정" 으로 남아 있었다(이슈에 적힌
 * "어긋남" 그대로). 전역 404(`app/not-found.tsx`, 경쟁하는 `page.tsx` 가 없다)에서만
 * `not-found.tsx` 의 `metadata` 가 먹힌다. `docs/architecture-guide.md` §7 참고.
 *
 * **404 가 아닌 모든 경우는 기존과 같은 `pet.editTitle` 이다.** 원래 `export const
 * metadata` 가 정적 객체였다 — 이 화면은 성공이든 5xx·무응답이든 항상 "반려견 정보
 * 수정" 이었다. 그 동작을 그대로 보존하고 **404 하나만** 갈라낸다.
 */
export function petEditPageTitle(error: unknown): string {
  return toErrorStatus(error) === 404 ? messages.pet.notFoundTitle : messages.pet.editTitle
}
