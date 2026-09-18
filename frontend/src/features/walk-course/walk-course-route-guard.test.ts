import { NextRequest } from 'next/server'

import { describe, expect, it } from 'vitest'

import { config as proxyConfig, PROTECTED_PATHS, proxy } from '../../../proxy'

/**
 * 라우트 가드 계약 — `코스상세-세부명세.md` D0-1 · D8-3.
 *
 * **`proxy` 를 실제로 호출한다** (`favorite-entry.test.ts` 가 같은 파일을 임포트한다).
 * 문자열 단언보다 강하다 — 매처와 판정이 어긋나면 여기서 잡힌다.
 */
function run(pathname: string) {
  return proxy(new NextRequest(`http://localhost:3000${pathname}`))
}

describe('산책 코스는 공개 경로다 (공통명세 S1)', () => {
  /**
   * dev OpenAPI 의 두 operation 모두 `security` 키가 없고, `tour-service` 는 security
   * 의존이 없는 공개 조회 서비스다 — `/places` 와 같다. 보호 목록에 넣으면 미로그인
   * 사용자가 코스를 보지 못한다.
   */
  it('PROTECTED_PATHS 에 넣지 않는다', () => {
    expect(PROTECTED_PATHS as readonly string[]).not.toContain('/walk-courses')
  })

  it('세션 쿠키 없이 목록에 들어가도 로그인으로 돌리지 않는다', () => {
    expect(run('/walk-courses').status).toBe(200)
  })

  it('세션 쿠키 없이 상세에 들어가도 로그인으로 돌리지 않는다', () => {
    expect(run('/walk-courses/6911167100216303304').status).toBe(200)
  })
})

describe('형식이 틀린 walkCourseId 는 400 이다 (D0-1)', () => {
  /**
   * 컨트롤러가 `@PathVariable long` 이라 숫자가 아니면 답이 400(`WALKCOURSE_113`)으로
   * 정해져 있다. **공개 경로라 미루면 크롤러가 잘못된 주소를 200 으로 읽고 모니터링이
   * 실패를 세지 못한다** — `/places` 가 같은 이유로 같은 처치를 갖는다 (#563).
   */
  it('숫자가 아닌 id 는 400 이다', () => {
    expect(run('/walk-courses/abc').status).toBe(400)
  })

  it('소수점·부호도 400 이다', () => {
    expect(run('/walk-courses/12.3').status).toBe(400)
    expect(run('/walk-courses/-1').status).toBe(400)
  })

  /** 안전 정수 범위 밖이어도 모양이 맞으면 서버에 묻는다 — 범위는 서버의 것이다 */
  it('19자리 id 는 통과시킨다', () => {
    expect(run('/walk-courses/6911167100216303304').status).toBe(200)
  })

  /** 목록은 id 자리가 아니다 */
  it('목록 경로는 판정 대상이 아니다', () => {
    expect(run('/walk-courses').status).toBe(200)
  })

  /**
   * **`rewrite` 라서 화면은 그대로다.** `redirect` 면 사용자가 보던 화면을 잃는다 —
   * 같은 주소로 되돌려 보내 페이지를 정상 렌더하고 상태 코드만 바꾼다.
   */
  it('redirect 가 아니라 rewrite 다 — 화면을 잃지 않는다', () => {
    const response = run('/walk-courses/abc')

    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toContain('/walk-courses/abc')
  })

  it('proxy matcher 에 있다 — 없으면 판정이 아예 실행되지 않는다', () => {
    expect(proxyConfig.matcher as readonly string[]).toContain('/walk-courses/:path*')
  })
})
