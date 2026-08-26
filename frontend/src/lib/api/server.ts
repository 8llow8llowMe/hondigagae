import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import { unwrap } from '@/lib/api/response'
import { serverEnv } from '@/lib/env.server'
import type { ApiResponse } from '@/types/api'

import 'server-only'

/**
 * 서버 전용 전송 계층 (server component / route handler).
 *
 * 게이트웨이를 직접 부른다. /api/bff 를 부르면 자기 오리진을 HTTP로 재호출하는 것이라
 * 왕복이 낭비되고 standalone 서버에서 깨진다 — docs/architecture-guide.md §8.
 */
const API_PREFIX = '/api/v1'

export type ServerRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** 서버 세션에서 꺼낸 access token. 공개 API 는 생략한다 */
  accessToken?: string | undefined
  signal?: AbortSignal
}

export function gatewayUrl(path: string): string {
  return `${serverEnv.BACKEND_BASE_URL}${API_PREFIX}${path}`
}

export async function serverFetch<T>(path: string, options: ServerRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, accessToken, signal } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const init: RequestInit = {
    method,
    headers,
    body: body === undefined ? null : JSON.stringify(body),
    cache: 'no-store',
  }
  if (signal) init.signal = signal

  let response: Response
  try {
    response = await globalThis.fetch(gatewayUrl(path), init)
  } catch (cause) {
    throw new ApiError(NO_RESPONSE_STATUS, null, cause instanceof Error ? cause.message : null)
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (payload === null) {
    throw new ApiError(response.status, null, null)
  }

  return unwrap(payload, response.status)
}
