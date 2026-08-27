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

/** `dataBody` 없이 성공하는 엔드포인트용 (signup / logout / email 인증) */
export async function clientFetchVoid(path: string, options: RequestOptions = {}): Promise<void> {
  const { payload, status } = await request(path, options)
  unwrapVoid(payload, status)
}
