import { existsSync, rmSync } from 'node:fs'

import { expect, test as teardown } from '@playwright/test'

import { paths } from '@/lib/api/paths'

import { STATE_PATH } from './env'

/**
 * **스모크가 쓴 세션을 로그아웃으로 끊는다** — 이슈 #757.
 *
 * 실패한 스모크의 trace 는 네트워크 기록을 담고, 그 요청 헤더에 **세션 쿠키**가 실린다.
 * trace 에서 네트워크만 뺄 방법은 없어서, 대신 쿠키를 **죽은 값**으로 만든다 — 로그아웃하면
 * 게이트웨이가 refresh 토큰을 비우고 BFF 가 세션을 지운다
 * (`app/api/bff/[...path]/route.ts` 의 `result.refreshToken === ''` 갈래).
 * 디스크의 `storageState` 도 함께 지운다.
 *
 * 로그인이 실패해 세션 파일이 없으면 끊을 것도 없다.
 */
teardown('dev 세션을 로그아웃으로 끊는다', async ({ playwright, baseURL }) => {
  teardown.skip(!existsSync(STATE_PATH), '로그인 setup 이 세션을 만들지 못했다')

  const request = await playwright.request.newContext({
    ...(baseURL === undefined ? {} : { baseURL }),
    storageState: STATE_PATH,
  })
  try {
    const response = await request.post(`/api/bff${paths.auth.logout}`)
    expect(response.status(), '로그아웃 응답 상태').toBe(200)
  } finally {
    await request.dispose()
    rmSync(STATE_PATH, { force: true })
  }
})
