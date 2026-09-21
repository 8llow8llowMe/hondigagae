import { NextRequest } from 'next/server'

import { describe, expect, it } from 'vitest'

import { readSource } from '@/test/source'

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
    expect(PROTECTED_PATHS as readonly string[]).not.toContain('/olle')
  })

  it('세션 쿠키 없이 목록에 들어가도 로그인으로 돌리지 않는다', () => {
    expect(run('/olle').status).toBe(200)
  })

  it('세션 쿠키 없이 상세에 들어가도 로그인으로 돌리지 않는다', () => {
    expect(run('/olle/6911167100216303304').status).toBe(200)
  })
})

describe('형식이 틀린 walkCourseId 는 400 이다 (D0-1)', () => {
  /**
   * 컨트롤러가 `@PathVariable long` 이라 숫자가 아니면 답이 400(`WALKCOURSE_113`)으로
   * 정해져 있다. **공개 경로라 미루면 크롤러가 잘못된 주소를 200 으로 읽고 모니터링이
   * 실패를 세지 못한다** — `/places` 가 같은 이유로 같은 처치를 갖는다 (#563).
   */
  it('숫자가 아닌 id 는 400 이다', () => {
    expect(run('/olle/abc').status).toBe(400)
  })

  it('소수점·부호도 400 이다', () => {
    expect(run('/olle/12.3').status).toBe(400)
    expect(run('/olle/-1').status).toBe(400)
  })

  /** 안전 정수 범위 밖이어도 모양이 맞으면 서버에 묻는다 — 범위는 서버의 것이다 */
  it('19자리 id 는 통과시킨다', () => {
    expect(run('/olle/6911167100216303304').status).toBe(200)
  })

  /** 목록은 id 자리가 아니다 */
  it('목록 경로는 판정 대상이 아니다', () => {
    expect(run('/olle').status).toBe(200)
  })

  /**
   * **`rewrite` 라서 화면은 그대로다.** `redirect` 면 사용자가 보던 화면을 잃는다 —
   * 같은 주소로 되돌려 보내 페이지를 정상 렌더하고 상태 코드만 바꾼다.
   */
  it('redirect 가 아니라 rewrite 다 — 화면을 잃지 않는다', () => {
    const response = run('/olle/abc')

    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toContain('/olle/abc')
  })

  it('proxy matcher 에 있다 — 없으면 판정이 아예 실행되지 않는다', () => {
    expect(proxyConfig.matcher as readonly string[]).toContain('/olle/:path*')
  })

  /**
   * **매처가 가리키는 자리에 실제 라우트가 있는지까지 본다**
   * ([#810](https://github.com/8llow8llowMe/hondigagae/issues/810)).
   *
   * 위 단언들은 `proxy()` 만 부르므로 **라우트 디렉터리를 옮기고 매처를 안 고쳐도(반대도)
   * 전부 초록이다** — 경로를 `/olle` 로 옮길 때 그 어긋남을 잡은 것은 단위 테스트가 아니라
   * dev 실측뿐이었다. `readSource` 는 없는 경로에서 throw 하므로 둘이 갈리면 여기서 깨진다.
   */
  it('매처가 가리키는 자리에 실제 라우트 파일이 있다', () => {
    expect(readSource('app/(main)/olle/[walkCourseId]/page.tsx')).toContain('isWalkCourseId')
  })
})
