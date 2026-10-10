import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { placeDetailFallbackTitle } from '@/lib/place/detail-title'

/**
 * **#206.** dev `/places/abc` 에서 본문 h1 은 `요청 조건이 올바르지 않아요` 인데
 * `<title>` 은 `장소를 찾을 수 없어요` 였다. `generateMetadata` 의 catch 가 오류 종류를
 * 보지 않고 404 문구로 뭉갰기 때문이다.
 *
 * 컨트롤러가 `@PathVariable long` 이라 숫자가 아닌 `placeId` 는 404 가 아니라 **400** 이다.
 */
describe('placeDetailFallbackTitle', () => {
  it('404 는 "찾을 수 없다" 로 말한다', () => {
    const title = placeDetailFallbackTitle(
      new ApiError(404, 'PLACE_002', '존재하지 않는 장소입니다.'),
    )

    expect(title).toBe(messages.place.detailNotFoundTitle)
  })

  it('400 은 404 문구로 뭉개지 않는다 — 본문과 같은 판정을 쓴다', () => {
    const title = placeDetailFallbackTitle(new ApiError(400, 'PLACE_113', null))

    expect(title).toBe(messages.common.validationErrorTitle)
    expect(title).not.toBe(messages.place.detailNotFoundTitle)
  })

  /*
    일시 장애는 클라이언트 재조회가 성공할 수 있다. 그러면 실제 장소가 그려진 화면의 탭에
    "찾을 수 없어요" 가 남는다 — 탭 제목은 판정을 단정하지 않는다.
  */
  it('5xx·무응답에는 아무것도 단정하지 않는다', () => {
    for (const error of [new ApiError(503, null, null), new ApiError(0, null, null)]) {
      const title = placeDetailFallbackTitle(error)

      expect(title).toBe(messages.place.pageTitle)
      expect(title).not.toBe(messages.place.detailNotFoundTitle)
      expect(title).not.toBe(messages.place.detailErrorTitle)
    }
  })

  /* `ApiError` 가 아닌 예외 — 렌더 단계 버그도 404 라고 말하면 안 된다 */
  it('ApiError 가 아니면 목록 제목으로 떨어진다', () => {
    expect(placeDetailFallbackTitle(new TypeError('boom'))).toBe(messages.place.pageTitle)
  })
})
