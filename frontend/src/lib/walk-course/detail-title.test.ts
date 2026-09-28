import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import {
  walkCourseDetailFallbackMetadata,
  walkCourseDetailFallbackTitle,
} from '@/lib/walk-course/detail-title'

/**
 * **#980.** `/olle/{없는 id}` 는 본문 `h1` 이 `없는 코스예요` 인데 탭은 `제주올레 코스` 였다 —
 * `generateMetadata` 의 catch 가 오류 종류를 보지 않고 목록 제목으로 뭉갰다.
 * 장소 상세의 #206 과 같은 결함이고 같은 판정을 쓴다 (`src/lib/place/detail-title.ts`).
 */
describe('walkCourseDetailFallbackTitle', () => {
  it('404 는 본문 h1 과 같은 "없는 코스" 문구다', () => {
    const title = walkCourseDetailFallbackTitle(
      new ApiError(404, 'WALKCOURSE_001', '존재하지 않는 산책 코스입니다.'),
    )

    expect(title).toBe(messages.walkCourse.detailNotFoundTitle)
  })

  /*
    **서버 `resultMessage` 를 탭 제목에 쓰지 않는다.** 본문의 `EmptyState` 제목은 서버 문구지만
    (D5), 탭은 `h1` 과 같은 FE 상수를 쓴다 — 서버 문구는 합쇼체라 다른 404 탭과 말투가 갈린다.
  */
  it('404 에서도 서버 resultMessage 를 싣지 않는다', () => {
    const title = walkCourseDetailFallbackTitle(
      new ApiError(404, 'WALKCOURSE_001', '존재하지 않는 산책 코스입니다.'),
    )

    expect(title).not.toContain('존재하지 않는 산책 코스입니다.')
  })

  it('400 은 404 문구로 뭉개지 않는다 — 본문과 같은 판정을 쓴다', () => {
    const title = walkCourseDetailFallbackTitle(new ApiError(400, 'WALKCOURSE_113', null))

    expect(title).toBe(messages.common.validationErrorTitle)
  })

  /*
    **5xx·무응답에는 아무것도 단정하지 않는다** (`architecture-guide.md` §7 #206). 클라이언트
    재조회가 성공하면 실제 코스가 그려진 화면의 탭에 "없는 코스" 가 남는다.
  */
  it('5xx·무응답·ApiError 아님은 목록 제목으로 떨어진다', () => {
    for (const error of [
      new ApiError(503, null, null),
      new ApiError(0, null, null),
      new TypeError('boom'),
    ]) {
      expect(walkCourseDetailFallbackTitle(error)).toBe(messages.walkCourse.pageTitle)
    }
  })
})

describe('walkCourseDetailFallbackMetadata', () => {
  it('제목에 서비스 접미사를 붙인다', () => {
    const metadata = walkCourseDetailFallbackMetadata(new ApiError(404, 'WALKCOURSE_001', null))

    expect(metadata.title).toBe(`${messages.walkCourse.detailNotFoundTitle} · 혼디가개`)
  })

  /*
    **404 는 색인하지 않는다.** 상태는 200 으로 남는다(soft 200 — 본문이 서버 `resultMessage` 를
    그려야 해서 `notFound()` 를 부르지 않는다, `page.tsx` 머리주석). 공개 SEO 화면이라 크롤러가
    없는 코스를 정상 페이지로 색인하는 것을 `noindex` 로 막는다.
  */
  it('404 는 noindex 다 — soft 200 을 크롤러가 정상 페이지로 색인하지 않게 한다', () => {
    const metadata = walkCourseDetailFallbackMetadata(new ApiError(404, 'WALKCOURSE_001', null))

    expect(metadata.robots).toEqual({ index: false })
  })

  /*
    **일시 장애에는 noindex 를 걸지 않는다.** 5xx 는 다음 크롤에서 살아날 수 있는 실패다 —
    한 번의 장애가 멀쩡한 코스를 색인에서 빼면 안 된다. 400 은 `proxy.ts` 가 상태를 이미 400 으로
    맞춰 크롤러가 스스로 거른다.
  */
  it('400·5xx·무응답에는 robots 를 싣지 않는다', () => {
    for (const error of [
      new ApiError(400, 'WALKCOURSE_113', null),
      new ApiError(503, null, null),
      new ApiError(0, null, null),
    ]) {
      expect(walkCourseDetailFallbackMetadata(error)).not.toHaveProperty('robots')
    }
  })
})
