import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { GATEWAY_UNREACHABLE_STATUS, gatewayUnreachablePayload } from '@/lib/api/bff-error'
import {
  EVENT_STREAM_MIME,
  eventStreamHeaders,
  isEventStream,
  wantsEventStream,
} from '@/lib/api/event-stream'
import { type ForwardedBody, readForwardedBody, toMockBody } from '@/lib/api/forwarded-body'
import { isMockEnabled, resolveMock, resolveMockStream } from '@/lib/api/mock'
import { toEventStream } from '@/lib/api/mock/stream'
import { gatewayUrl } from '@/lib/api/server'
import { clearOAuthState, readOAuthState, writeOAuthState } from '@/lib/auth/oauth-state'
import {
  extractOAuthState,
  isOAuthAuthorizePath,
  isOAuthCallbackPath,
  toOAuthStateCookiePair,
} from '@/lib/auth/oauth-state-cookie'
import { extractRefreshToken, toCookieHeader } from '@/lib/auth/refresh-cookie'
import { canRetryReissue, isAuthEntryPath, isReissuePath } from '@/lib/auth/reissue'
import { clearSession, readSession, type Session, writeSession } from '@/lib/auth/session'
import { joinCookiePairs } from '@/lib/http/set-cookie'

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
 *  3-1. 소셜 로그인 state 쿠키를 양방향으로 중계한다 (#689 / BE #681 —
 *     src/lib/auth/oauth-state.ts). refresh 와 달리 **브라우저에 심는다**
 *  ⚠ 3-1 은 BE #681 과 **짝이다.** 백엔드가 먼저 나가면 구버전 프론트의 콜백에는
 *     쿠키가 없어 AUTH_010 으로 전부 막힌다. 두 PR 은 함께 머지한다.
 *     (반대 순서는 안전하다 — 백엔드가 쿠키를 안 주면 봉인할 값이 없고, 콜백에
 *     쿠키를 안 실어도 아직 검사하지 않아 그대로 동작한다)
 *  4. 401 이면 reissue 를 1회만 시도하고 원 요청을 재시도한다
 *  5. 본문을 형태 그대로 통과시킨다 — JSON 도, `multipart/form-data`(파일 업로드)도
 *     (`@/lib/api/forwarded-body`)
 *  6. SSE 는 **버퍼링하지 않고 그대로 흘려보낸다** (#91 — `handleEventStream`)
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
  /** `/authorize` 가 내려준 소셜 state. 없으면 null (백엔드 배포 전 과도기 포함) */
  oauthState: string | null
}

/**
 * 게이트웨이로 되돌려 보낼 쿠키.
 *
 * **둘을 한 객체로 묶는다.** `Cookie` 헤더는 하나뿐이라 각자 `headers.Cookie = ...` 를
 * 쓰면 뒤가 앞을 덮어써 한쪽이 조용히 사라진다. 조립은 아래 한 곳에서만 한다.
 */
type GatewayCookies = {
  /** reissue 전용. 게이트웨이가 쿠키에서 refresh 를 읽는다 */
  refreshToken?: string | null
  /** 소셜 콜백 전용. 게이트웨이가 쿼리 state 와 대조한다 (BE #681) */
  oauthState?: string | null
}

async function callGateway(
  path: string,
  search: string,
  method: ForwardedMethod,
  body: ForwardedBody | null,
  accessToken: string | null,
  cookies: GatewayCookies = {},
): Promise<GatewayResult> {
  // 개발용 mock (MOCK_API=true, 프로덕션에서는 항상 비활성).
  // 여기서 처리하면 게이트웨이를 부르지 않는다. 클라이언트는 차이를 모른다.
  if (isMockEnabled()) {
    // state 쿠키도 함께 넘긴다 — mock 이 이 검사를 빼면 실서버에서만 막히는 흐름이 생긴다
    const mock = resolveMock(
      path,
      method,
      search,
      toMockBody(body),
      accessToken,
      cookies.oauthState ?? null,
    )
    if (mock !== null) {
      // mock 에도 refresh 토큰을 실어야 세션이 완성되고 401 재발급 흐름이 돈다
      return {
        status: mock.status,
        payload: mock.payload,
        refreshToken: mock.refreshToken ?? null,
        oauthState: mock.oauthState ?? null,
      }
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  // multipart 는 boundary 가 이 값 안에 있다. 새로 만들지 말고 원본을 그대로 쓴다
  if (body !== null) headers['Content-Type'] = body.contentType
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const cookieHeader = joinCookiePairs([
    cookies.refreshToken ? toCookieHeader(cookies.refreshToken) : null,
    cookies.oauthState ? toOAuthStateCookiePair(cookies.oauthState) : null,
  ])
  if (cookieHeader !== null) headers.Cookie = cookieHeader

  let response: Response
  try {
    response = await globalThis.fetch(`${gatewayUrl(path)}${search}`, {
      method,
      headers,
      body: body?.data ?? null,
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
      oauthState: null,
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

  const setCookies = response.headers.getSetCookie()

  return {
    status: response.status,
    payload,
    refreshToken: extractRefreshToken(setCookies),
    oauthState: extractOAuthState(setCookies),
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

/**
 * SSE 스트림 호출. **응답을 읽지 않고 그대로 돌려준다** — `callGateway` 와 갈라지는 지점이다.
 *
 * `signal` 을 반드시 넘긴다. 브라우저가 `EventSource` 를 닫으면 이 요청도 끊겨야 게이트웨이의
 * `SseEmitter` 가 정리된다 — 안 넘기면 사용자가 화면을 떠난 뒤에도 연결이 남는다.
 */
async function fetchGatewayStream(
  path: string,
  search: string,
  accessToken: string | null,
  signal: AbortSignal,
): Promise<{ response: Response } | { cause: unknown }> {
  // 게이트웨이가 `produces = text/event-stream` 이라 `Accept` 를 맞춰야 한다.
  // `callGateway` 처럼 `application/json` 을 박으면 **406** 이다
  const headers: Record<string, string> = { Accept: EVENT_STREAM_MIME }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  try {
    const response = await globalThis.fetch(`${gatewayUrl(path)}${search}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal,
    })
    return { response }
  } catch (cause) {
    console.error('[bff] 게이트웨이 스트림 호출 실패', { path })
    return { cause }
  }
}

/**
 * SSE 통과 (#91).
 *
 * **토큰 스트립을 건너뛴다.** 근거: 이벤트 `data` 는 작업 상태 조회 응답의 `dataBody` 와
 * 동일한 JSON 이고(`AiPlanWebController.streamJobStatus` 설명), 그 본문은
 * `AiPlanJobStatusResponse` — `jobId`·`status`·`planDraft`·`errorCode`·`errorMessage` 뿐이라
 * **토큰이 들어올 자리가 없다.** 스트립하려면 프레임마다 파싱해야 하고, 그 순간 통과가
 * 아니라 변환이 된다.
 *
 * 스트림이 아닌 응답(스트림 시작 전 오류)은 기존 경로로 되돌려 공통 에러 봉투를 유지한다.
 */
async function handleEventStream(
  request: NextRequest,
  path: string,
  search: string,
  session: Session | null,
): Promise<Response> {
  if (isMockEnabled()) {
    const mock = resolveMockStream(path, 'GET', session?.accessToken ?? null)
    if (mock !== null) {
      if (mock.kind === 'error') {
        return NextResponse.json(mock.result.payload, { status: mock.result.status })
      }
      return new Response(toEventStream(mock.frames, request.signal), {
        status: 200,
        headers: eventStreamHeaders(),
      })
    }
  }

  let called = await fetchGatewayStream(path, search, session?.accessToken ?? null, request.signal)

  /*
    **401 재시도는 스트림이 시작되기 전에만 한다.**

    소유권 검증 실패·인증 실패는 SSE 가 아니라 일반 JSON 오류로 온다(`AiPlanJobSseStreamer`)
    — 즉 401 을 본 시점에는 아직 스트림이 열리지 않았고, 재발급 후 다시 구독하면 된다.

    **중간 끊김은 여기서 다루지 않는다.** 이미 흐르는 스트림에 새 토큰을 주입할 방법이 없다.
    그 경우는 클라이언트가 폴링으로 내려앉고(`use-ai-plan-job.ts`), 폴링은 이 파일의 기존
    경로를 타므로 재발급이 거기서 돈다.

    인증 진입 경로(`isAuthEntryPath`) 검사는 하지 않는다 — SSE 엔드포인트는 로그인이 아니다.
  */
  if (
    'response' in called &&
    called.response.status === 401 &&
    session !== null &&
    canRetryReissue(0)
  ) {
    // 열어 둔 응답 본문을 버린다 — 재시도 전에 소켓을 돌려준다
    await called.response.body?.cancel().catch(() => undefined)

    const reissued = await callGateway('/auth/token/reissue', '', 'POST', null, null, {
      refreshToken: session.refreshToken,
    })
    const reissuedTokens = stripTokens(reissued.payload)

    if (reissued.status === 200 && reissuedTokens.accessToken !== null) {
      const next: Session = {
        accessToken: reissuedTokens.accessToken,
        refreshToken: reissued.refreshToken ?? session.refreshToken,
        memberId: reissuedTokens.memberId ?? session.memberId,
      }
      await writeSession(next)
      called = await fetchGatewayStream(path, search, next.accessToken, request.signal)
    } else {
      await clearSession()
    }
  }

  if (!('response' in called)) {
    return NextResponse.json(gatewayUnreachablePayload(called.cause), {
      status: GATEWAY_UNREACHABLE_STATUS,
    })
  }

  const { response } = called

  /*
    스트림이 아니면 통과시키지 않는다. 여기로 오는 것은 스트림 시작 전 오류
    (`AIPLAN_002` 404 · 재발급 후에도 401)라 **공통 래퍼 JSON** 이다 — 그대로 흘려보내면
    클라이언트의 `EventSource` 가 형식 오류로만 끊기고 화면은 이유를 알 수 없다.

    토큰 스트립을 여기서는 태운다 — 통과 대상이 아닌 JSON 이라 기존 규칙(책임 2)을 지킨다.
  */
  if (!isEventStream(response.headers.get('content-type')) || response.body === null) {
    const text = await response.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = null
      }
    }
    return NextResponse.json(stripTokens(payload).body, { status: response.status })
  }

  return new Response(response.body, { status: response.status, headers: eventStreamHeaders() })
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const method = request.method as ForwardedMethod
  if (!FORWARDED_METHODS.includes(method)) {
    return NextResponse.json({ message: '지원하지 않는 메서드입니다.' }, { status: 405 })
  }

  const { path: segments } = await context.params
  const path = `/${segments.join('/')}`
  const search = request.nextUrl.search

  const session = await readSession()

  /*
    **SSE 는 여기서 갈라진다.** 아래 경로는 응답을 통째로 버퍼링하므로(`await response.text()`)
    스트림을 태우면 작업이 끝난 뒤에야 이벤트가 한꺼번에 도착해 폴링만도 못하다 (#91).

    **요청의 `Accept` 로 판정한다** — 응답 Content-Type 을 보고 갈라지려면 이미 부른 뒤인데,
    게이트웨이는 `Accept: application/json` 에 406 을 낸다.
  */
  if (method === 'GET' && wantsEventStream(request.headers.get('accept'))) {
    return handleEventStream(request, path, search, session)
  }

  // 재시도가 같은 본문을 다시 보내야 하므로 스트림이 아니라 버퍼로 들고 있는다
  const body = await readForwardedBody(request)

  /*
    소셜 로그인 state 쿠키 중계 (#689 / BE #681).

    판정은 `@/lib/auth/oauth-state-cookie` 한 곳에서 한다 — 경로 문자열을 여기저기 박으면
    심는 쪽과 지우는 쪽이 따로 놀아 절반짜리 상태가 된다.

    콜백에서만 봉인을 푼다. 다른 경로에 실으면 게이트웨이가 쓰지도 않는 값을 매 요청
    보내게 되고, 그만큼 값이 새어 나갈 표면이 넓어진다.
  */
  const isOAuthCallback = isOAuthCallbackPath(path)
  const oauthState = isOAuthCallback ? await readOAuthState() : null

  let result = await callGateway(path, search, method, body, session?.accessToken ?? null, {
    refreshToken: isReissuePath(path) ? (session?.refreshToken ?? null) : null,
    oauthState,
  })

  // 401 → reissue 1회 → 원 요청 재시도.
  // 인증 진입 경로(로그인)의 401 은 로그인 실패라 재발급으로 복구되지 않는다
  if (
    result.status === 401 &&
    session !== null &&
    !isReissuePath(path) &&
    !isAuthEntryPath(path) &&
    canRetryReissue(0)
  ) {
    const reissued = await callGateway('/auth/token/reissue', '', 'POST', null, null, {
      refreshToken: session.refreshToken,
    })
    const reissuedTokens = stripTokens(reissued.payload)

    if (reissued.status === 200 && reissuedTokens.accessToken !== null) {
      const next: Session = {
        accessToken: reissuedTokens.accessToken,
        refreshToken: reissued.refreshToken ?? session.refreshToken,
        memberId: reissuedTokens.memberId ?? session.memberId,
      }
      await writeSession(next)

      result = await callGateway(path, search, method, body, next.accessToken)
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

  /*
    소셜 state 쿠키의 수명은 여기서 끝난다.

    - `/authorize` 성공 → 게이트웨이가 준 값을 봉인해 **브라우저에** 심는다.
      값이 비어 오면(백엔드 배포 전 과도기) 심지 않는다 — 빈 쿠키를 만들어 두면
      콜백이 빈 값을 실어 보내 원인이 "위조" 처럼 보인다.
    - 콜백 → **성공·실패와 무관하게 지운다.** state 는 1회용이고 게이트웨이도 조회와
      동시에 버린다. 실패했을 때 남겨 두면 다음 시도가 죽은 값을 들고 간다.

    값은 로그에 남기지 않는다.
  */
  if (isOAuthAuthorizePath(path) && result.status === 200 && result.oauthState) {
    await writeOAuthState(result.oauthState)
  }
  if (isOAuthCallback) {
    await clearOAuthState()
  }

  return NextResponse.json(stripped.body, { status: result.status })
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
