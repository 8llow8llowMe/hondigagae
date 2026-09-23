import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { expect, test as setup } from '@playwright/test'

import type { LoginResult } from '@/lib/api/auth'
import { paths } from '@/lib/api/paths'
import type { ApiResponse } from '@/types/api'

import { requireEnv, STATE_PATH } from './env'

/**
 * dev 일반 계정으로 로그인해 세션을 저장한다 — 이슈 #757.
 *
 * ### 폼이 아니라 BFF 로 로그인한다 — 비밀값 때문이다
 *
 * 목 스위트의 `e2e/auth.setup.ts` 는 실제 폼을 채운다. 여기서는 그렇게 하지 않는다.
 * **playwright 는 `fill` 의 단계 제목에 입력값을 그대로 적는다** (`Fill "{value}"`,
 * playwright-core 1.63 `protocolMetainfo`). 그 제목은 HTML 리포트와 `github` 리포터의
 * 실패 로그에 남고, 리포트는 CI 아티팩트로 올라간다 — 비밀번호가 평문으로 남는다.
 *
 * `request.post` 의 단계 제목은 메서드와 URL 뿐이다. 그래서 **브라우저 폼이 부르는 것과
 * 같은 BFF 경로**(`/api/bff/auth/login`, `src/lib/api/auth.ts` 의 `login()`)를 직접 부른다.
 * 폼 자체의 동작은 목 스위트가 이미 잰다.
 *
 * `page.request` 는 페이지 컨텍스트와 쿠키를 공유하므로, BFF 가 굽는 세션 쿠키가 그대로
 * 브라우저에 남는다.
 *
 * ### 로그인 성공을 보호 라우트가 열리는 것으로 판정한다
 *
 * 200 만 보면 쿠키가 빠져도 통과한다. 그 상태로 저장한 `storageState` 는 뒤의 모든 스모크를
 * `/login` 으로 보내 실패 지점이 멀어진다 — `e2e/auth.setup.ts` 와 같은 이유다.
 */
setup('dev 일반 계정으로 로그인해 세션을 저장한다', async ({ page }) => {
  const response = await page.request.post(`/api/bff${paths.auth.login}`, {
    data: { email: requireEnv('DEV_SMOKE_EMAIL'), password: requireEnv('DEV_SMOKE_PASSWORD') },
  })

  // 실패 원인은 상태와 resultCode 로 말한다. 본문의 다른 값은 싣지 않는다
  const body = (await response.json().catch(() => null)) as ApiResponse<LoginResult> | null
  const resultCode = body?.dataHeader.resultCode ?? '(JSON 아님)'
  expect(response.status(), `로그인 응답 — resultCode=${resultCode}`).toBe(200)
  expect(body?.dataHeader.success, `로그인 응답 — resultCode=${resultCode}`).toBe(true)

  await page.goto('/mypage')
  await expect(page).toHaveURL((url) => url.pathname === '/mypage')

  mkdirSync(dirname(STATE_PATH), { recursive: true })
  await page.context().storageState({ path: STATE_PATH })
})
