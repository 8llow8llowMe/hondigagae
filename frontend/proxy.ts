import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { SESSION_COOKIE_NAME } from '@/lib/auth/cookie-names'
import { isPlaceId } from '@/lib/place/place-id'

/**
 * 보호 경로 가드 (Next 16: `middleware.ts` → `proxy.ts`).
 *
 * proxy 는 nodejs 런타임에서 돌고 런타임을 바꿀 수 없다. 그래도 세션 모듈 전체를
 * 임포트하지 않고 `cookie-names.ts` 만 쓴다 — 쿠키 이름만 필요한 곳이 crypto 와
 * env 검증까지 끌어올 이유가 없다.
 *
 * 화면을 추가하면 이 목록에도 넣는다. 빼먹으면 로그인 없이 접근된다
 * — docs/auth-guide.md §5.
 *
 * 장소 탐색(/places)은 공개다. tour-service 는 security 의존이 없는 공개 조회 서비스다.
 */
export const PROTECTED_PATHS = ['/mypage', '/pets', '/plans', '/ai-plans', '/favorites'] as const

const LOGIN_PATH = '/login'

/** `/places/{placeId}` — 더 깊은 경로(`/places/{id}/…`)는 걸리지 않는다 */
const PLACE_DETAIL_PATH = /^\/places\/([^/]+)$/

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  /*
    **형식이 틀린 장소 id 는 400 으로 답한다** (#563).

    화면은 이미 이 경우를 알고 있다 — `places/[placeId]/page.tsx` 가 `isPlaceId` 로 갈라
    `요청 조건이 올바르지 않아요` 를 그린다. 컨트롤러가 `@PathVariable long` 이라 답이
    400(`PLACE_113`)으로 정해져 있기 때문이다 (`docs/screen-inventory.md` §3). 그런데
    **응답은 200 으로 나갔다.** 공개 화면이라 크롤러가 잘못된 주소를 정상 페이지로 읽고,
    모니터링도 실패를 세지 못한다.

    **여기서만 고칠 수 있다.** server component 는 상태 코드를 정하는 수단이 없다 —
    `notFound()` 가 404 하나를 낼 뿐이고, 그걸 쓰면 404 가 아닌 것을 404 라고 말하는
    데다 화면 문구까지 `not-found.tsx` 의 것으로 바뀐다. 문구는 지금이 맞다.

    **`rewrite` 라서 화면은 그대로다.** 같은 주소로 되돌려 보내 페이지를 정상적으로
    렌더하고 상태 코드만 400 으로 바꾼다. `redirect` 도 `new Response(...)` 도 아니다 —
    둘 다 사용자가 보던 화면을 잃는다.

    판정은 `isPlaceId` 하나를 쓴다. 여기서 패턴을 베끼면 화면과 게이트가 갈릴 수 있다.
  */
  const placeDetail = PLACE_DETAIL_PATH.exec(pathname)
  if (placeDetail !== null && !isPlaceId(placeDetail[1] ?? '')) {
    return NextResponse.rewrite(request.nextUrl, { status: 400 })
  }

  const isProtected = PROTECTED_PATHS.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  )
  if (!isProtected) return NextResponse.next()

  // 세션 쿠키 존재만 확인한다. 유효성은 BFF가 401 로 판정한다
  if (request.cookies.has(SESSION_COOKIE_NAME)) return NextResponse.next()

  // 같은 오리진 리다이렉트는 경로 기반으로 만든다.
  // NextResponse.redirect(req.nextUrl…) 는 standalone 에서 http://0.0.0.0:3000 으로 나간다
  const url = request.nextUrl.clone()
  url.pathname = LOGIN_PATH
  url.search = `?returnTo=${encodeURIComponent(pathname)}`

  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    /*
      **`/places` 는 공개 경로지만 매처에는 있다** — 보호 가드가 아니라 위의 장소 id
      형식 판정 때문이다. 보호 판정은 `PROTECTED_PATHS` 가 따로 보므로 여기 있다고
      로그인을 요구하지 않는다.
    */
    '/places/:path*',
    '/mypage/:path*',
    '/pets/:path*',
    '/plans/:path*',
    '/ai-plans/:path*',
    '/favorites/:path*',
  ],
}
