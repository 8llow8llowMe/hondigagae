# Frontend Tooling Guide

> **목적**: `docs/coding-conventions.md` 와 `DESIGN.md` 의 규칙 중 **기계로 강제할 수 있는 것을 설정으로 못박는다.**
> 문서로만 있는 규칙은 반드시 깨진다. 리뷰어가 매번 같은 지적을 반복하지 않게 하는 것이 이 문서의 존재 이유다.
> 상태: **스펙 확정 / 파일 미생성.** Phase 3(프로젝트 부트스트랩)에서 이 스펙 그대로 적용한다.

## 1. 규칙 → 강제 수단 매핑

| 규칙 (정본)                                                  | 강제 수단                                          | 강제 불가 시                    |
| ------------------------------------------------------------ | -------------------------------------------------- | ------------------------------- |
| `react-router-dom` 금지                                      | `no-restricted-imports`                            | —                               |
| 계층 역참조 금지 (`lib`→`features`, `components`→`features`) | `no-restricted-imports` (파일별 override)          | —                               |
| 토큰을 storage에 넣지 않기                                   | `no-restricted-globals`                            | —                               |
| 컴포넌트에서 `fetch` 직접 호출 금지                          | `no-restricted-syntax`                             | —                               |
| `any` 금지                                                   | `@typescript-eslint/no-explicit-any`               | —                               |
| import 순서 4그룹                                            | `simple-import-sort`                               | —                               |
| spacing/색 스케일 밖 arbitrary value 금지                    | `no-restricted-syntax` (정규식)                    | 리뷰 (`fe-design-reviewer`)     |
| icon-only 버튼 `aria-label`                                  | `jsx-a11y/control-has-associated-label`            | 리뷰                            |
| nullable 응답 안전 접근                                      | **`noUncheckedIndexedAccess`**                     | 리뷰                            |
| `import type` 사용                                           | `verbatimModuleSyntax`                             | —                               |
| Tailwind 클래스 순서                                         | `prettier-plugin-tailwindcss` (자동 정렬)          | —                               |
| UTF-8 / LF / 2-space                                         | 루트 `.editorconfig` + `.gitattributes` + Prettier | —                               |
| 커밋 prefix `[FE]`                                           | `commit-msg` 훅                                    | 리뷰                            |
| **문자열 ID를 number로 타이핑**                              | ✕ 불가                                             | **리뷰 (`fe-api-contract`)**    |
| **404에 재시도 버튼 금지**                                   | ✕ 불가                                             | **테스트 (`testing-guide.md`)** |
| **enum 한국어 매핑 테이블 금지**                             | ✕ 불가                                             | **리뷰 (`fe-reviewer`)**        |
| **없는 API 호출 금지**                                       | ✕ 불가                                             | **`/fe-api-check`**             |

**아래 4개는 자동화가 불가능하다.** 그래서 리뷰 에이전트와 테스트가 존재한다. 설정이 늘어도 이 4개는 여전히 사람·에이전트의 몫이다.

## 2. 버전 고정

```jsonc
// package.json
{
  "packageManager": "pnpm@<설치된 버전>",
  "engines": { "node": ">=20.0.0" },
}
```

```text
// .nvmrc
20
```

- Next.js가 요구하는 최소 Node 버전을 확인해 `engines` 에 반영한다. 임의로 낮추지 않는다.
- `packageManager` 필드를 두면 Corepack이 버전을 고정한다. **npm/yarn 사용을 막는 1차 방어선이다.**

## 3. package.json 스크립트 계약

문서 8곳이 이 명령을 참조한다. **이름을 바꾸면 문서·에이전트·스킬을 함께 고쳐야 한다.**

```jsonc
{
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",

    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",

    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",

    "verify": "pnpm lint && pnpm typecheck && pnpm test",
  },
}
```

- 포트 `3000` 은 관례다. BFF 경유라 FE 포트는 게이트웨이 CORS 와 무관하다. 게이트웨이 직접 호출이 필요할 때만 `5174`(`pnpm dev:alt`) 여야 한다 (`local-run-guide.md` §2).
- `pnpm verify` 가 커밋 전 최소 게이트다.

## 4. TypeScript

```jsonc
// tsconfig.json (compilerOptions 발췌)
{
  "strict": true,
  "noUncheckedIndexedAccess": true, // 핵심
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "verbatimModuleSyntax": true,
  "paths": { "@/*": ["./src/*"] },
}
```

**`noUncheckedIndexedAccess` 가 이 프로젝트에서 특히 중요한 이유**: 백엔드 응답에 nullable이 많고(`SliceResponse.contents`, 장소 상세의 intro/petInfo/images, job 결과 페이로드) 문서로 "non-null 가정 금지"를 반복해 적었다. 이 플래그 하나가 `contents[0].title` 을 타입 수준에서 막는다.

- `verbatimModuleSyntax` 는 `import type` 을 강제한다 (`coding-conventions.md` §2). 초기 마찰이 있으면 이것만 끄고 나머지는 유지한다.
- `paths` 의 `@` alias는 `vitest.config.ts` 와 값이 같아야 한다.

## 5. ESLint (flat config)

```js
// eslint.config.mjs — 구조 스펙
import tseslint from 'typescript-eslint'
import next from '@next/eslint-plugin-next'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  // 1) 기본
  ...tseslint.configs.recommendedTypeChecked,
  { plugins: { '@next/next': next, 'simple-import-sort': simpleImportSort, 'jsx-a11y': jsxA11y } },

  // 2) 전역 규칙
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',

      'simple-import-sort/imports': [
        'error',
        {
          // coding-conventions.md §2 의 4그룹과 일치시킨다
          groups: [
            ['^react$', '^next', '^next/'], // 1. react / next
            ['^@?\\w'], // 2. 외부 패키지
            ['^@/'], // 3. 내부
            ['^\\.'], // 3-1. 상대 경로
            ['^.+\\u0000$'], // 4. type-only (verbatim 접미)
          ],
        },
      ],

      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-router-dom',
              message:
                'App Router를 쓴다. useRouter/usePathname/useSearchParams (architecture-guide §6)',
            },
          ],
        },
      ],

      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            '토큰·세션을 브라우저 storage에 두지 않는다 (auth-guide §2). UI 편의값이면 eslint-disable + 근거 주석',
        },
        { name: 'sessionStorage', message: '위와 동일' },
      ],

      'no-restricted-syntax': [
        'error',
        {
          // DESIGN.md §4 spacing 스케일 / §2 색 토큰 밖 값
          selector: 'Literal[value=/\\[[0-9.]+(px|rem|em|%)\\]|\\[#[0-9a-fA-F]{3,8}\\]/]',
          message:
            'DESIGN.md 토큰 밖의 arbitrary value 금지. 스케일 밖 값이 필요하면 DESIGN.md 갱신을 먼저 논의한다',
        },
        {
          // 하드코딩 hex — 토큰 CSS 변수만 쓴다
          selector: 'Literal[value=/^#[0-9a-fA-F]{6}$/]',
          message: 'raw 색상값 금지. DESIGN.md 토큰(CSS 변수)을 쓴다',
        },
      ],

      'jsx-a11y/control-has-associated-label': 'warn',
      'jsx-a11y/alt-text': 'error',
    },
  },

  // 3) 계층 역참조 차단 (architecture-guide §3)
  {
    files: ['src/lib/**', 'src/components/**', 'src/types/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '**/features/*'],
              message: 'lib/components/types → features 역참조 금지 (architecture-guide §3)',
            },
          ],
        },
      ],
    },
  },

  // 4) fetch 직접 호출 차단 (architecture-guide §7)
  {
    files: ['src/features/**', 'src/components/**', 'app/**'],
    ignores: ['app/api/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name="fetch"]',
          message: 'fetch 직접 호출 금지. src/lib/api/ 를 경유한다 (architecture-guide §7)',
        },
      ],
    },
  },

  // 5) 색 하드코딩 예외 — 토큰 정의 파일
  { files: ['src/styles/**'], rules: { 'no-restricted-syntax': 'off' } },

  // 6) Prettier 충돌 해소 — 반드시 마지막
  prettier,
)
```

**주의 사항**

- `no-restricted-syntax` 는 flat config에서 **뒤 블록이 앞 블록을 덮어쓴다.** 3~4번 블록처럼 파일별로 나눌 때 전역 규칙이 사라지지 않도록 필요한 항목을 다시 나열하거나 블록 순서를 검증한다. 설정 후 **의도적으로 위반 코드를 넣어 걸리는지 확인한다.**
- `prettier` (eslint-config-prettier)는 **항상 마지막**에 둔다.
- Tailwind 전용 lint 플러그인은 v4 지원 상태가 불안정하다. 위 정규식 방식이 폴백이며, 플러그인 도입 시 이 문서를 갱신한다.
- 규칙을 끌 때는 파일 단위 `eslint-disable` 에 **근거 주석을 함께** 남긴다. 설정에서 전역으로 끄지 않는다.

## 6. Prettier

```jsonc
// .prettierrc.json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all",
  "tabWidth": 2,
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"],
}
```

```text
// .prettierignore
.next
node_modules
pnpm-lock.yaml
public
```

- `endOfLine: "lf"` — 루트 `.gitattributes`(`eol=lf`)와 일치시킨다. Windows에서 CRLF로 저장되는 것을 막는다.
- `tabWidth: 2` — 루트 `.editorconfig` 의 ts/tsx 설정과 일치.
- **`prettier-plugin-tailwindcss` 가 클래스 순서를 자동 정렬한다.** 순서 논쟁이 사라지므로 필수로 둔다.
- 문서(`.md`)도 포맷 대상이다. `format:check` 를 CI에 넣는다.

## 7. 환경변수 (런타임 검증)

문서만 있으면 `undefined` 로 런타임에 터진다. **부팅 시 fail-fast** 하게 만든다.

```ts
// src/lib/env.server.ts
import 'server-only'

import { z } from 'zod'

const schema = z.object({
  BACKEND_API_URL: z.string().url(),
  AUTH_SESSION_SECRET: z.string().min(32, 'AUTH_SESSION_SECRET 은 32자 이상이어야 한다'),
})

export const serverEnv = schema.parse(process.env)
```

```ts
// src/lib/env.client.ts
import { z } from 'zod'

const schema = z.object({ NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY: z.string().min(1) })

// Next는 리터럴 참조만 인라인한다. process.env 를 통째로 넘기면 값이 비어 온다
export const clientEnv = schema.parse({
  NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY: process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY,
})
```

```bash
# .env.example  (커밋한다. .env.local 은 커밋하지 않는다)
BACKEND_API_URL=http://localhost:8000
AUTH_SESSION_SECRET=change-me-to-a-random-string-at-least-32-chars
NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=
```

- **`NEXT_PUBLIC_` 은 클라이언트 번들에 박힌다.** `BACKEND_API_URL`, `AUTH_SESSION_SECRET` 에 절대 붙이지 않는다.
- `env.server.ts` 는 `import 'server-only'` 로 잠근다.

## 8. next.config — 외부 이미지 (필수)

장소 이미지는 **백엔드가 TourAPI 원본 URL을 그대로 저장**한다 (`backend/docs/entity-design.md`: `first_image`, `first_image2`, `origin_img_url`, `small_image_url` — VARCHAR(300) 원본 URL).

**`remotePatterns` 를 등록하지 않으면 `next/image` 가 전부 실패한다.**

```ts
// next.config.ts
const nextConfig = {
  images: {
    remotePatterns: [
      // 실제 응답의 호스트를 확인해 등록한다 (아래는 TourAPI 표준 호스트 후보)
      { protocol: 'http', hostname: 'tong.visitkorea.or.kr' },
      { protocol: 'https', hostname: 'tong.visitkorea.or.kr' },
    ],
  },
}
```

**확인 절차** — 추측으로 등록하지 않는다.

```bash
curl -s --max-time 15 "http://localhost:8000/api/v1/places" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d)" | grep -o 'https\?://[^"]*' | head
```

주의:

- TourAPI 이미지가 **`http`** 로 오는 경우가 있다. https 페이지에서 mixed content로 차단되므로 `protocol` 을 실측대로 등록하고, 필요하면 프록시를 검토한다.
- 이미지 URL이 빈 문자열/`null` 인 장소가 있다 → `next/image` 에 빈 `src` 를 넘기면 예외다. 폴백 이미지를 둔다.
- 신규 호스트가 나타나면 이 문서와 `next.config.ts` 를 함께 갱신한다.

## 9. Git 훅

```jsonc
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,css,md}": ["prettier --write"],
  },
}
```

```bash
# .husky/pre-commit
pnpm lint-staged
```

```bash
# .husky/commit-msg — 커밋 prefix 강제 (루트 CLAUDE.md 규약)
grep -qE '^\[(BE|FE|DOCS|INFRA)\] (feat|fix|chore|refactor|style|docs|test): .+' "$1" || {
  echo "커밋 메시지 형식: [BE|FE|DOCS|INFRA] type: 요약"
  echo "예: [FE] feat: 장소 목록 무한 스크롤 구현"
  exit 1
}
```

- `pre-commit` 에 `typecheck`/`test` 를 넣지 않는다. 느려서 훅을 우회하게 된다. 그건 CI 몫이다.
- 훅은 `frontend/` 하위가 아니라 **저장소 루트**에 설치해야 동작한다. 백엔드 커밋에도 `commit-msg` 가 적용되므로 도입 전에 팀 합의를 받는다.

## 10. CI

```yaml
# .github/workflows/frontend-ci.yml
name: frontend-ci

on:
  pull_request:
    paths: ['frontend/**', '.github/workflows/frontend-ci.yml']

jobs:
  verify:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

- `paths` 필터로 백엔드 PR에서는 돌지 않게 한다.
- `--frozen-lockfile` 로 lockfile 불일치를 잡는다.
- `pnpm build` 를 넣는 이유: **server/client 경계 오류는 빌드에서만 잡히는 것이 많다** (`architecture-guide.md` §4).
- 백엔드 CI는 아직 없다. 필요하면 같은 형태로 별도 워크플로를 추가한다.

## 11. 디자인 토큰 코드 바인딩

`DESIGN.md` 는 표일 뿐이므로 코드와 연결한다.

```css
/* src/styles/tokens.css — DESIGN.md 값을 그대로 옮긴다 */
:root {
  --brand-500: #2e9b6b;
  --fg: #1a1d1b;
  --danger-500: #d64545;
  /* ... DESIGN.md §2 전체 */
  --radius-lg: 16px;
  --shadow-sm: 0 1px 2px rgb(26 29 27 / 6%);
}
```

```css
/* app/globals.css — Tailwind v4 테마 매핑 */
@import 'tailwindcss';
@import '../src/styles/tokens.css';

@theme {
  --color-brand-500: var(--brand-500);
  --color-fg: var(--fg);
  --color-danger-500: var(--danger-500);
  --radius-lg: var(--radius-lg);
}
```

**규칙**

- **`DESIGN.md` → `tokens.css` 는 수동 동기다.** 토큰을 바꿀 때 두 파일을 같이 고친다. `done-checklist.md` §9에 항목이 있다.
- 컴포넌트는 `bg-brand-500` 같은 **토큰 클래스만** 쓴다. raw hex는 §5의 lint 규칙이 막는다.
- `src/styles/**` 는 색 하드코딩 lint 예외 대상이다 (토큰 정의부).

## 12. 폰트 (Pretendard Variable, dynamic subset)

**적용 완료.** `pnpm add pretendard` (OFL-1.1) 후 `app/layout.tsx` 가 CSS 를 import 한다.

```ts
// app/layout.tsx — globals.css 보다 먼저 (@font-face 가 먼저 선언되어야 한다)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
```

`--font-sans` 는 `app/globals.css` 의 `@theme` 에서 `'Pretendard Variable'` 을 첫 순위로 둔다.

### 왜 이 배포본인가 (실측 비교)

| 방식                           | 총량           | 9 weight | 실제 다운로드                          |
| ------------------------------ | -------------- | -------- | -------------------------------------- |
| static woff2 × 9 (전체 글리프) | 6.6 MB         | ✅       | 쓴 weight 마다 ~750KB                  |
| variable woff2 통짜            | 2.0 MB         | ✅       | 무조건 2.0MB                           |
| static subset × 9              | 2.3 MB         | ✅       | 개당 ~265KB                            |
| **variable dynamic-subset**    | 3.0MB / 92파일 | ✅       | **등장한 글자 범위만, 조각 평균 31KB** |

여행 중 모바일에서 보는 서비스라 **초기 로드**가 가장 중요하다. dynamic subset 은
`unicode-range` 로 92개 조각을 선언하고 브라우저가 페이지에 실제 나온 글자 범위만 받는다.

가변 축은 `font-weight: 45 920` 이라 100~900 전 구간이 동작한다.

### 트레이드오프 (알고 선택한 것)

`next/font/local` 을 쓰지 않는다. `unicode-range` 분할을 지원하지 않기 때문이다. 그래서 잃는 것:

| 항목                                               | 상태 | 대응                                                                                               |
| -------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| 자동 preload                                       | ✕    | 초기 로드가 이미 작아 영향이 제한적                                                                |
| **폰트 metric 기반 CLS 보정** (`size-adjust` 폴백) | ✕    | `font-display: swap` + 폴백 스택 정렬로 완화. **레이아웃 이동이 문제가 되면 이 결정을 재검토한다** |
| self-host                                          | ✅   | node_modules → 번들러가 에셋으로 방출                                                              |

### 라이선스

OFL-1.1. `node_modules/pretendard` 에 라이선스가 포함되고 CSS 상단에도 고지가 들어 있다.
배포물에 별도 고지 페이지가 필요한지는 공모전 제출 요건 확인 후 결정한다.

## 13. 적용 결과 / 스펙과의 편차 (2026-08-26 Phase 3)

스펙대로 적용하면서 **실제로 조정이 필요했던 것들**이다. 다음 사람이 같은 곳에서 막히지 않게 남긴다.

| #   | 편차                                                                            | 이유                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **TypeScript 를 5.9.3 으로 고정**                                               | 레지스트리 최신은 7.0.2 지만 `typescript-eslint` 8.x 의 지원이 확립되지 않았다. 7 로 올릴 때 lint 부터 확인한다                                                                                                                     |
| 2   | `vitest.config` 를 **`.mts`** 로 둔다                                           | `.ts` 는 CJS 로 로드돼 "ESM syntax in a file loaded as CommonJS" 경고가 난다. `package.json` 에 `type: module` 을 넣는 것보다 영향 범위가 작다                                                                                      |
| 3   | `parserOptions.projectService` 에 **`allowDefaultProject: ['*.mjs', '*.mts']`** | 루트 설정 파일들이 tsconfig `include` 밖이라 "was not found by the project service" 파싱 오류가 난다                                                                                                                                |
| 4   | `**/*.mjs`, `**/*.mts` 에 **`disableTypeChecked`** 적용                         | `eslint-plugin-jsx-a11y` 가 타입 선언을 제공하지 않아 `no-unsafe-member-access` 가 설정 파일 자체를 오탐한다                                                                                                                        |
| 5   | `jsx-a11y/control-has-associated-label` **명시 활성화**                         | `flatConfigs.recommended` 에 포함되지 않는다. §1 표가 이 규칙을 전제하므로 직접 켠다 (오탐 때문에 `warn`)                                                                                                                           |
| 6   | `fetch` init 에 **`undefined` 를 명시 전달하지 않는다**                         | `exactOptionalPropertyTypes: true` 아래에서 `body: undefined` 는 타입 오류다. `RequestInit.body` 는 `BodyInit \| null` 이므로 `null` 을 쓰고, 나머지 옵션은 조건부로 대입한다                                                       |
| 7   | 쿠키 이름을 **`src/lib/auth/cookie-names.ts`** 로 분리                          | 처음엔 `middleware.ts`(Edge Runtime)가 `node:crypto` 를 끌어와 빌드 경고가 났다. Next 16 의 `proxy.ts` 는 nodejs 런타임이라 그 제약은 사라졌지만, 쿠키 이름만 필요한 곳이 crypto 와 env 검증까지 끌어올 이유가 없어 분리를 유지한다 |
| 8   | **`middleware.ts` → `proxy.ts`**                                                | Next 16 에서 `middleware` 파일·함수명이 deprecated 됐다. `proxy` 는 **nodejs 런타임 고정**이며 edge 를 지원하지 않는다 (`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`)                                     |
| 9   | `dev:alt` 스크립트(포트 5174) 추가                                              | 3000 이 다른 로컬 앱에 점유되면 요청이 그 앱으로 간다. BFF 경유이므로 FE 포트는 게이트웨이 CORS 와 무관하니 아무 빈 포트를 써도 된다                                                                                                |

**#6 과 #7 은 스펙이 틀린 것이 아니라, 스펙이 강하게 잡아둔 설정(`exactOptionalPropertyTypes`, Edge Runtime 분리)이 실제로 문제를 잡아낸 사례다.** 두 경우 모두 설정을 완화하지 않고 코드를 고쳤다.

### 규칙 발화 검증 (스펙 §13 5단계)

의도적 위반 코드를 넣어 **8종 전부 실제로 걸리는지** 확인했다.

| 규칙                                                   | 결과      |
| ------------------------------------------------------ | --------- |
| `no-restricted-globals` (localStorage)                 | ✅        |
| `no-restricted-syntax` (컴포넌트 `fetch`)              | ✅        |
| `no-explicit-any`                                      | ✅        |
| `no-restricted-syntax` (arbitrary value `p-[13px]`)    | ✅        |
| `no-restricted-syntax` (raw hex `#ff0000`)             | ✅        |
| `no-restricted-imports` (계층 역참조 `lib`→`features`) | ✅        |
| `no-restricted-imports` (`react-router-dom`)           | ✅        |
| `jsx-a11y/control-has-associated-label`                | ✅ (warn) |

**설정을 바꾼 뒤에는 이 검증을 다시 한다.** 설정을 써놓고 안 걸리는 경우가 흔하다.

## 14. 남은 항목

| 항목                                       | 상태                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| husky / lint-staged (§9)                   | **미적용** — `commit-msg` 훅이 백엔드 커밋에도 적용되므로 팀 합의 후 도입한다     |
| Pretendard 폰트 (§12)                      | **미적용** — 폴백 스택만 적용. `app/globals.css` 에 `TODO(FONT)` 로 표시          |
| `next.config` `remotePatterns` 호스트 (§8) | **가등록** — `tong.visitkorea.or.kr` 만 넣었다. 백엔드 기동 후 실호출로 확인·보강 |
| `docs/api/openapi/` 스냅샷                 | **미생성** — 백엔드 기동 후                                                       |
