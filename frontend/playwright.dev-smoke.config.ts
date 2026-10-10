import { defineConfig, devices } from '@playwright/test'

import { requireEnv, STATE_PATH } from './e2e-dev-smoke/env'

/**
 * **배포된 dev 를 실제로 부르는 읽기 전용 스모크** — 이슈 #757.
 *
 * `playwright.config.ts` 와 **설정을 나눈다.** 저쪽은 `MOCK_API=true` 로 dev 서버를 직접
 * 띄우고 게이트웨이 주소를 닿을 수 없는 값으로 덮어 "실수로 dev 를 때리는 경로" 를
 * 원천에서 없앴다 (`docs/testing-guide.md §12`). 이 스모크는 정반대로 **dev 만** 부른다.
 * 한 파일에 섞으면 `pnpm e2e` 가 dev 를 칠 수 있는 길이 생기므로 파일·디렉터리를 가른다.
 *
 * - 서버를 띄우지 않는다 (`webServer` 없음). `DEV_SMOKE_BASE_URL` 로 이미 배포된 곳을 본다.
 * - 계정은 환경 변수로만 받는다 (`e2e-dev-smoke/env.ts`).
 * - 경계와 비밀값 규칙은 `docs/testing-guide.md §13` 이 정본이다.
 */
export default defineConfig({
  testDir: './e2e-dev-smoke',
  outputDir: './test-results-dev-smoke',
  // 공유 dev 환경이다 — 한 계정 세션으로 순서대로 조용히 훑는다
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // 네트워크 한 번 흔들린 것과 실제 장애를 가른다. 재시도로 통과하면 리포트에 flaky 로 남는다
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-dev-smoke' }]]
    : [['list']],

  use: {
    baseURL: requireEnv('DEV_SMOKE_BASE_URL'),
    // 실패한 것만 남긴다. 통과한 실행의 증거는 필요 없고, 남길수록 세션 쿠키가 담긴
    // 네트워크 기록이 늘어난다 (§13 "비밀값")
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },

  projects: [
    {
      name: 'dev-login',
      testMatch: /login\.setup\.ts/,
      teardown: 'dev-logout',
      /*
        **로그인 단계는 증거를 남기지 않는다.** 요청 본문(계정·비밀번호)이 trace 의
        네트워크 기록에 그대로 담긴다. 실패 원인은 상태 코드와 `resultCode` 로 충분하다.
      */
      use: { trace: 'off', screenshot: 'off', video: 'off' },
    },
    {
      name: 'dev-smoke',
      testMatch: /\.smoke\.ts/,
      dependencies: ['dev-login'],
      use: { ...devices['Desktop Chrome'], storageState: STATE_PATH },
    },
    {
      name: 'dev-logout',
      testMatch: /logout\.teardown\.ts/,
      use: { trace: 'off', screenshot: 'off', video: 'off' },
    },
  ],
})
