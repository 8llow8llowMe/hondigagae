import { defineConfig, devices } from '@playwright/test'

/**
 * **E2E 가 아니라 레이아웃·보호 라우트 검증 전용이다** (이슈 #467).
 *
 * vitest 는 `environment: 'node'` 로 마크업 **문자열**만 본다
 * (`docs/testing-guide.md §1`). 그래서 못 보는 것이 둘이었다:
 *
 * 1. **적용된 CSS 와 실제 레이아웃** — 3층 표면(#455) 작업 내내 손으로 쟀다.
 * 2. **로그인 뒤 화면** — `/mypage` · `/pets` · `/favorites` 는 307 로 `/login` 에 걸린다.
 *    임시 하네스가 `renderToStaticMarkup` 결과를 `public/__check/*.html` 로 쓰고 dev 서버
 *    CSS 를 링크해 눈으로 재는 방식이었다 (#67 이 추적하던 한계).
 *
 * 이 설정이 그 둘을 대신한다. **경계는 `docs/testing-guide.md §12` 에 적혀 있다.**
 *
 * ### `next dev` 를 쓰는 이유 (`next build && next start` 가 아니다)
 *
 * `isMockEnabled()` 가 `NODE_ENV === 'production'` 에서 **항상 false** 다
 * (`src/lib/api/mock/index.ts`). 프로덕션 빌드로 띄우면 목이 꺼져 게이트웨이를 실제로
 * 부른다 — 로컬 백엔드는 뜨지 않고 dev 게이트웨이는 공유 환경이라 플레이크의 원흉이 된다.
 * 목을 쓰려면 dev 로 띄우는 수밖에 없다.
 *
 * 그 대가로 **`toHaveScreenshot` 을 아직 쓰지 않는다.** dev 오버레이·HMR 이 픽셀을
 * 흔들고, 스크린샷 기준선은 macOS 와 CI(Linux)의 폰트 렌더가 달라 따로 관리해야 한다.
 * 대신 **계산된 레이아웃 값**을 단언한다 — 3층 표면 검토에서 실제로 결함을 잡아낸 것이
 * 픽셀 비교가 아니라 `getComputedStyle` · `getBoundingClientRect` 실측이었다.
 *
 * ### 목을 쓰므로 백엔드가 필요 없다
 *
 * `MOCK_API=true` 는 **BFF 프록시와 `serverFetch`(SSR 프리페치) 양쪽**을 덮는다
 * (`app/api/bff/[...path]/route.ts` · `src/lib/api/server.ts`). 그래서 `page.route()` 로
 * 브라우저 요청만 가로채는 방식과 달리 서버 렌더까지 같은 fixture 를 본다.
 */
const PORT = Number(process.env.E2E_PORT ?? 5175)
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // 목 저장소가 서버 프로세스 안의 메모리다 — 쓰기 시나리오가 생기면 병렬이 서로를 흔든다.
  // 지금 스펙은 전부 읽기 전용이라 병렬로 둔다.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // `exactOptionalPropertyTypes` 라 `undefined` 를 직접 넣을 수 없다 — 없으면 기본값(코어 절반)
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // 로그인을 한 번만 하고 `storageState` 를 나눠 쓴다. 보호 라우트 검증의 전제다.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    /*
      **`node` 로 진입 스크립트를 직접 부른다.** 제약이 둘이라 이 모양이 됐다 (#773).

      1. **pnpm·corepack 을 거치지 않는다.** corepack 이 `uv_cwd` 로 죽는 일이 있다.
      2. **셸이 경로를 해석하게 두지 않는다.** 전에는 `./node_modules/.bin/next` 였는데,
         playwright 는 이 명령을 **Windows 에서 `cmd` 로** 띄우므로 `./` 표기가
         `'.' 은(는) 내부 또는 외부 명령이 아닙니다` 로 죽었다. 그래서 Windows 에서는
         e2e 가 아예 돌지 않았고, 세션마다 dev 서버를 손으로 띄워 우회하고 있었다.

      `node` 는 어느 OS 에서든 PATH 에 있고, 뒤의 경로는 셸이 아니라 node 가 해석하므로
      슬래시 표기가 문제되지 않는다. 1번 제약도 그대로 지킨다.
    */
    command: `node node_modules/next/dist/bin/next dev -p ${PORT}`,
    url: BASE_URL,
    /*
      **기본은 재사용하지 않는다** (#773). `reuseExistingServer` 가 켜져 있으면 그 포트에
      이미 뜬 서버를 줍는데, 워크트리를 나눠 쓰는 병렬 세션에서는 그것이 **남의 코드를
      검사하고 통과하는** 길이 된다 — 초록불이 내 변경을 증명하지 못한다.

      끄면 포트가 잡혀 있을 때 **시끄럽게 실패한다.** 조용히 틀린 통과보다 낫다.
      반복 실행 속도가 필요하면 `E2E_REUSE_SERVER=1` 로 직접 켠다 — 그때는 그 포트의
      서버가 **내 코드**인지 본인이 책임진다.

      포트 자체는 `E2E_PORT` 로 가른다 (기본 5175 = `dev:alt2`). 세션마다 다른 값을 쓴다.
    */
    reuseExistingServer: process.env.E2E_REUSE_SERVER === '1' && !process.env.CI,
    timeout: 120_000,
    env: {
      MOCK_API: 'true',
      /*
        **산출물 디렉터리를 갈라 둔다.** Next 16 은 한 디렉터리에 dev 서버를 하나만
        허용하는데, 이 저장소는 사람이 5174 에 dev 서버를 띄운 채로 작업한다
        (`next.config.ts` 의 `distDir` 주석). 갈라 두지 않으면 E2E 가 그 서버를
        죽여야 돌아가고, 워크트리를 다른 세션과 공유하므로 남의 서버를 죽이게 된다.
      */
      NEXT_DIST_DIR: '.next-e2e',
      /*
        `env.server.ts` 가 모듈 로드 시점에 zod 로 fail-fast 한다. 목이 켜져 있어
        게이트웨이를 실제로 부르지는 않지만 **형식이 맞는 값은 있어야 한다.**
        `.env.local` 의 실값을 쓰지 않으려고 여기서 덮어쓴다 — 실수로 dev 게이트웨이를
        때리는 경로를 원천에서 없앤다.
      */
      BACKEND_API_URL: 'http://127.0.0.1:1/e2e-should-never-reach-this',
      AUTH_SESSION_SECRET: 'e2e-only-session-secret-not-a-real-key-0123456789',
    },
  },
})
