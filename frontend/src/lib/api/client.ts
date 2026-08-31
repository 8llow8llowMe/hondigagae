import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import { unwrap, unwrapVoid } from '@/lib/api/response'
import type { ApiResponse } from '@/types/api'

/**
 * 브라우저 전용 전송 계층.
 *
 * baseURL 은 /api/bff 이며 바꾸지 않는다. 브라우저는 게이트웨이를 직접 부르지 않는다.
 * 서버 컴포넌트는 이 파일이 아니라 server.ts 를 쓴다 — docs/architecture-guide.md §8.
 */
const BFF_BASE_URL = '/api/bff'

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

/**
 * 파일 업로드용 요청 옵션.
 *
 * **`FormData` 를 그대로 넘기고 `Content-Type` 을 직접 지정하지 않는다.** multipart 는
 * 파트 경계(boundary)가 헤더에 들어가는데, 그 값은 `fetch` 가 `FormData` 를 보고 만든다.
 * 손으로 `'multipart/form-data'` 를 적으면 boundary 가 빠져 서버가 파싱에 실패한다.
 *
 * BFF 는 이 본문을 형태 그대로 게이트웨이에 통과시킨다 — `src/lib/api/forwarded-body.ts`.
 */
export type FormRequestOptions = {
  method?: 'POST' | 'PUT' | 'PATCH'
  body: FormData
  signal?: AbortSignal
}

/** 전송만 담당한다. 래퍼 판별은 호출부(clientFetch / clientFetchVoid)가 한다 */
async function request(
  path: string,
  options: RequestOptions,
): Promise<{ payload: ApiResponse<unknown>; status: number }> {
  const { method = 'GET', body, signal } = options

  // exactOptionalPropertyTypes 아래에서는 undefined 를 명시적으로 넘길 수 없다.
  // RequestInit.body 는 BodyInit | null 이므로 null 을 쓴다.
  const init: RequestInit = {
    method,
    body: body === undefined ? null : JSON.stringify(body),
  }
  if (body !== undefined) init.headers = { 'Content-Type': 'application/json' }
  if (signal) init.signal = signal

  let response: Response
  try {
    response = await globalThis.fetch(`${BFF_BASE_URL}${path}`, init)
  } catch (cause) {
    // 네트워크 무응답 — 일시 장애로 취급해 재시도 UI를 제공한다
    throw new ApiError(NO_RESPONSE_STATUS, null, cause instanceof Error ? cause.message : null)
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<unknown> | null

  if (payload === null) {
    throw new ApiError(response.status, null, null)
  }

  return { payload, status: response.status }
}

export async function clientFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { payload, status } = await request(path, options)
  return unwrap(payload as ApiResponse<T>, status)
}

/**
 * 파일 업로드. 응답은 다른 호출과 같은 공통 래퍼라 `unwrap` 경로를 그대로 쓴다.
 *
 * `request()` 와 합치지 않는 이유: 그쪽은 본문을 무조건 `JSON.stringify` 하고
 * `Content-Type: application/json` 을 붙인다. 한 함수가 두 계약을 오가면 호출부가
 * 어느 쪽을 보내고 있는지 타입으로 알 수 없다.
 */
export async function clientFetchForm<T>(path: string, options: FormRequestOptions): Promise<T> {
  const { method = 'POST', body, signal } = options

  // headers 를 주지 않는다 — fetch 가 boundary 를 포함한 Content-Type 을 만든다
  const init: RequestInit = { method, body }
  if (signal) init.signal = signal

  let response: Response
  try {
    response = await globalThis.fetch(`${BFF_BASE_URL}${path}`, init)
  } catch (cause) {
    throw new ApiError(NO_RESPONSE_STATUS, null, cause instanceof Error ? cause.message : null)
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (payload === null) throw new ApiError(response.status, null, null)

  return unwrap(payload, response.status)
}

/** `dataBody` 없이 성공하는 엔드포인트용 (signup / logout / email 인증) */
export async function clientFetchVoid(path: string, options: RequestOptions = {}): Promise<void> {
  const { payload, status } = await request(path, options)
  unwrapVoid(payload, status)
}
