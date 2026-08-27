import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { GATEWAY_UNREACHABLE_STATUS, gatewayUnreachablePayload } from '@/lib/api/bff-error'
import { isMockEnabled, resolveMock } from '@/lib/api/mock'
import { gatewayUrl } from '@/lib/api/server'
import { extractRefreshToken, toCookieHeader } from '@/lib/auth/refresh-cookie'
import { canRetryReissue, isAuthEntryPath, isReissuePath } from '@/lib/auth/reissue'
import { clearSession, readSession, type Session, writeSession } from '@/lib/auth/session'

/**
 * 백엔드 프록시 (catch-all).
 *
 *   브라우저 → /api/bff/{path} → {GATEWAY}/api/v1/{path}
 *
 * 책임
 *  1. 서버 세션의 access token 을 Authorization 헤더로 주입한다
 *  2. 응답 body 에서 토큰을 제거해 브라우저 JS 가 절대 보지 못하게 한다
 *  3. 게이트웨이의 refresh 쿠키를 세션에 봉인한다 (SameSite=Strict / Path 제한 때문에
 *     브라우저가 직접 들고 있을 수 없다 — src/lib/auth/refresh-cookie.ts)
 *  4. 401 이면 reissue 를 1회만 시도하고 원 요청을 재시도한다
 *
 * docs/architecture-guide.md §5, docs/auth-guide.md
 */

const FORWARDED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
type ForwardedMethod = (typeof FORWARDED_METHODS)[number]

/** 응답 body 에서 제거할 필드 — 토큰은 서버 밖으로 나가지 않는다 */
const STRIPPED_BODY_FIELDS = ['accessToken', 'refreshToken'] as const

type GatewayResult = {
  status: number
  payload: unknown
  refreshToken: string | null
}

async function callGateway(
  path: string,
  search: string,
  method: ForwardedMethod,
  body: string | null,
  accessToken: string | null,
  refreshToken: string | null,
): Promise<GatewayResult> {
  // 개발용 mock (MOCK_API=true, 프로덕션에서는 항상 비활성).
  // 여기서 처리하면 게이트웨이를 부르지 않는다. 클라이언트는 차이를 모른다.
  if (isMockEnabled()) {
    const mock = resolveMock(path, method, search, body, accessToken)
    if (mock !== null) {
      // mock 에도 refresh 토큰을 실어야 세션이 완성되고 401 재발급 흐름이 돈다
      return { status: mock.status, payload: mock.payload, refreshToken: mock.refreshToken ?? null }
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== null) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  // reissue 는 게이트웨이가 쿠키에서 refresh 를 읽는다
  if (refreshToken) headers.Cookie = toCookieHeader(refreshToken)

  let response: Response
  try {
    response = await globalThis.fetch(`${gatewayUrl(path)}${search}`, {
      method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
    })
  } catch (cause) {
    // 게이트웨이 미기동 / 네트워크 단절 — 예외를 밖으로 흘리지 않는다
    console.error('[bff] 게이트웨이 호출 실패', { path, method })
    return {
      status: GATEWAY_UNREACHABLE_STATUS,
      payload: gatewayUnreachablePayload(cause),
      refreshToken: null,
    }
  }

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  return {
    status: response.status,
    payload,
    refreshToken: extractRefreshToken(response.headers.getSetCookie()),
  }
}

function stripTokens(payload: unknown): {
  body: unknown
  accessToken: string | null
  memberId: string | null
} {
  if (payload === null || typeof payload !== 'object') {
    return { body: payload, accessToken: null, memberId: null }
  }

  const wrapper = payload as { dataBody?: unknown }
  const dataBody = wrapper.dataBody

  if (dataBody === null || dataBody === undefined || typeof dataBody !== 'object') {
    return { body: payload, accessToken: null, memberId: null }
  }

  const record = dataBody as Record<string, unknown>
  const accessToken = typeof record.accessToken === 'string' ? record.accessToken : null
  const memberId = typeof record.memberId === 'string' ? record.memberId : null

  if (accessToken === null) {
    return { body: payload, accessToken: null, memberId }
  }

  const cleaned: Record<string, unknown> = { ...record }
  for (const field of STRIPPED_BODY_FIELDS) delete cleaned[field]

  return { body: { ...wrapper, dataBody: cleaned }, accessToken, memberId }
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const method = request.method as ForwardedMethod
  if (!FORWARDED_METHODS.includes(method)) {
    return NextResponse.json({ message: '지원하지 않는 메서드입니다.' }, { status: 405 })
  }

  const { path: segments } = await context.params
  const path = `/${segments.join('/')}`
  const search = request.nextUrl.search
  const body = method === 'GET' || method === 'DELETE' ? null : await request.text()

  const session = await readSession()

  let result = await callGateway(
    path,
    search,
    method,
    body === '' ? null : body,
    session?.accessToken ?? null,
    isReissuePath(path) ? (session?.refreshToken ?? null) : null,
  )

  // 401 → reissue 1회 → 원 요청 재시도.
  // 인증 진입 경로(로그인)의 401 은 로그인 실패라 재발급으로 복구되지 않는다
  if (
    result.status === 401 &&
    session !== null &&
    !isReissuePath(path) &&
    !isAuthEntryPath(path) &&
    canRetryReissue(0)
  ) {
    const reissued = await callGateway(
      '/auth/token/reissue',
      '',
      'POST',
      null,
      null,
      session.refreshToken,
    )
    const reissuedTokens = stripTokens(reissued.payload)

    if (reissued.status === 200 && reissuedTokens.accessToken !== null) {
      const next: Session = {
        accessToken: reissuedTokens.accessToken,
        refreshToken: reissued.refreshToken ?? session.refreshToken,
        memberId: reissuedTokens.memberId ?? session.memberId,
      }
      await writeSession(next)

      result = await callGateway(
        path,
        search,
        method,
        body === '' ? null : body,
        next.accessToken,
        null,
      )
    } else {
      await clearSession()
    }
  }

  const stripped = stripTokens(result.payload)

  // 로그인·재발급 성공 → 세션 갱신
  if (stripped.accessToken !== null) {
    await writeSession({
      accessToken: stripped.accessToken,
      refreshToken: result.refreshToken ?? session?.refreshToken ?? '',
      memberId: stripped.memberId ?? session?.memberId ?? '',
    })
  }

  // 로그아웃 → 게이트웨이가 refresh 쿠키를 비운다
  if (result.refreshToken === '') {
    await clearSession()
  }

  return NextResponse.json(stripped.body, { status: result.status })
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
