import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { SESSION_COOKIE_NAME } from '@/lib/auth/cookie-names'

/**
 * 보호 경로 가드.
 *
 * 화면을 추가하면 이 목록에도 넣는다. 빼먹으면 로그인 없이 접근된다
 * — docs/auth-guide.md §5.
 *
 * 장소 탐색(/places)은 공개다. tour-service 는 security 의존이 없는 공개 조회 서비스다.
 */
export const PROTECTED_PATHS = ['/mypage', '/pets', '/plans', '/ai-plans'] as const

const LOGIN_PATH = '/login'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: ['/mypage/:path*', '/pets/:path*', '/plans/:path*', '/ai-plans/:path*'],
}
