import { classify, toErrorStatus } from '@/lib/api/error'
import { messages } from '@/lib/messages'

/**
 * 장소 상세 조회가 실패했을 때의 `<title>` (#206).
 *
 * `generateMetadata` 안에 두면 테스트할 수 없어 뽑아냈다 — async server component 는
 * `renderToStaticMarkup` 으로 렌더되지 않는다 (testing-guide.md §1).
 *
 * **본문과 같은 판정을 쓴다.** 컨트롤러가 `@PathVariable long` 이라 숫자가 아닌 `placeId` 는
 * 404 가 아니라 **400** 이고, 본문은 그것을 "요청 조건이 올바르지 않아요" 로 구분한다
 * (`place-detail-section.tsx`). 메타데이터만 404 문구로 뭉개면 **탭·히스토리·공유
 * 미리보기에 본문과 다른 말이 남는다** — dev `/places/abc` 에서 h1 과 title 이 어긋나는
 * 것을 관측했다.
 *
 * **5xx·무응답에는 아무것도 단정하지 않는다.** 일시 장애라 클라이언트 재조회가 성공할 수
 * 있고, 그러면 실제 장소가 그려진 화면의 탭에 "찾을 수 없어요" 가 남는다. 본문의 5xx 문구
 * (`detailErrorTitle`)를 쓰지 않는 것도 같은 이유다 — 그쪽은 그 순간 실패한 영역을
 * 가리키지만 탭 제목은 페이지가 살아난 뒤에도 남는다. 판정하지 않는 목록 제목으로 떨어뜨린다.
 */
export function placeDetailFallbackTitle(error: unknown): string {
  const status = toErrorStatus(error)
  if (status === null) return messages.place.pageTitle

  switch (classify(status)) {
    case 'not-found':
      return messages.place.detailNotFoundTitle
    case 'validation':
      return messages.common.validationErrorTitle
    default:
      return messages.place.pageTitle
  }
}
