import next from '@next/eslint-plugin-next'
import prettier from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'

/**
 * 이 설정은 docs/coding-conventions.md · DESIGN.md · architecture-guide.md 의
 * 규칙 중 기계로 강제할 수 있는 것을 못박는다. 규칙 → 강제 수단 매핑은
 * docs/tooling-guide.md §1 이 정본이다.
 *
 * 규칙을 끌 때는 이 파일에서 전역으로 끄지 말고, 해당 줄에
 * eslint-disable + 근거 주석을 남긴다.
 */

/** DESIGN.md 토큰 밖의 arbitrary value / raw hex 차단 (DESIGN.md §2·§4) */
const noArbitraryValue = {
  selector: 'Literal[value=/\\[[0-9.]+(px|rem|em|%)\\]|\\[#[0-9a-fA-F]{3,8}\\]/]',
  message:
    'DESIGN.md 토큰 밖의 arbitrary value 금지. 스케일 밖 값이 필요하면 DESIGN.md 갱신을 먼저 논의한다',
}

/**
 * 복합 arbitrary value 차단.
 *
 * `bg-[linear-gradient(...)_0/1px_100%_no-repeat]` 같은 선언은 Tailwind 가 `/` 를
 * 투명도 수식자로 읽어 **클래스를 조용히 만들지 않는다.** 에러도 경고도 없이 스타일만
 * 사라져 브라우저로 보기 전에는 모른다 (실제로 홈 열 구분선이 이렇게 사라졌다).
 * 함수 호출이 들어가는 복합 선언은 `app/globals.css` 에 이름 있는 클래스로 둔다.
 */
const noComplexArbitrary = {
  selector: 'Literal[value=/\\[[^\\]]*\\([^\\]]*\\)[^\\]]*\\]/]',
  message:
    '함수가 들어간 arbitrary value 금지. Tailwind 가 조용히 무시할 수 있다 — globals.css 에 이름 있는 클래스로 둔다',
}

/** 하드코딩 색상값 차단 — 토큰 CSS 변수만 쓴다 (DESIGN.md §2) */
const noRawHex = {
  selector: 'Literal[value=/^#[0-9a-fA-F]{6}$/]',
  message: 'raw 색상값 금지. DESIGN.md 토큰(CSS 변수)을 쓴다',
}

/** 컴포넌트에서 fetch 직접 호출 차단 (architecture-guide.md §8) */
const noDirectFetch = {
  selector: 'CallExpression[callee.name="fetch"]',
  message: 'fetch 직접 호출 금지. src/lib/api/ 를 경유한다 (architecture-guide.md §8)',
}

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      // E2E 전용 산출물 (#467). dev 서버를 사람이 쓰는 것과 갈라 띄우느라
      // `NEXT_DIST_DIR=.next-e2e` 를 쓴다 — `.next` 와 같은 성격이라 같이 뺀다
      '.next-e2e/**',
      // 워크트리 검사용 산출물 (#671 E-2). `NEXT_DIST_DIR=.next-check` 로 띄운다 —
      // 위와 같은 성격이라 같이 뺀다
      '.next-check/**',
      'coverage/**',
      'node_modules/**',
      'next-env.d.ts',
      // 아트보드 산출물(.gitignore 대상)이다. 우리가 쓴 코드가 아니고 tsconfig include
      // 밖이라 typed lint 가 파싱조차 못 한다 — 없으면 로컬 `pnpm verify` 가 항상 빨갛다.
      // CI 는 이 디렉터리를 체크아웃하지 않아 지금까지 드러나지 않았다.
      'docs/**/*.js',
    ],
  },

  // ── 1. 기본
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // 루트 설정 파일들은 tsconfig include 밖이므로 기본 프로젝트로 허용한다
        projectService: { allowDefaultProject: ['*.mjs', '*.mts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  jsxA11y.flatConfigs.recommended,
  {
    plugins: { '@next/next': next },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
    },
  },

  // ── 2. 전역 규칙
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',

      // coding-conventions.md §2 의 import 4그룹
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^react$', '^react-dom', '^next$', '^next/'],
            ['^node:'],
            ['^@?\\w'],
            ['^@/'],
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',

      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-router-dom',
              message:
                'App Router를 쓴다. useRouter / usePathname / useSearchParams (architecture-guide.md §6)',
            },
          ],
        },
      ],

      // auth-guide.md §2 — 토큰·세션은 서버 전용
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            '토큰·세션을 브라우저 storage에 두지 않는다 (auth-guide.md §2). UI 편의값이면 eslint-disable + 근거 주석',
        },
        {
          name: 'sessionStorage',
          message: '위와 동일 (auth-guide.md §2)',
        },
      ],

      'no-restricted-syntax': ['error', noArbitraryValue, noComplexArbitrary, noRawHex],

      // icon-only 버튼의 라벨. 1차 방어는 타입(component-guide.md §7)이고 이건 보조망이다.
      // 래퍼 컴포넌트에서 오탐이 있어 warn 으로 둔다.
      'jsx-a11y/control-has-associated-label': 'warn',

      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  // ── 3. 계층 역참조 차단 (architecture-guide.md §3)
  {
    files: ['src/lib/**', 'src/components/**', 'src/types/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '**/features/*'],
              message: 'lib / components / types → features 역참조 금지 (architecture-guide.md §3)',
            },
          ],
        },
      ],
    },
  },

  // ── 4. fetch 직접 호출 차단 (src/lib/api, BFF route handler 는 예외)
  {
    files: ['src/features/**', 'src/components/**', 'app/**'],
    ignores: ['app/api/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        noArbitraryValue,
        noComplexArbitrary,
        noRawHex,
        noDirectFetch,
      ],
    },
  },

  // ── 5. 토큰 정의부는 색 하드코딩 예외
  {
    files: ['src/styles/**'],
    rules: { 'no-restricted-syntax': ['error', noDirectFetch] },
  },

  // ── 6. 테스트 파일 완화
  {
    files: ['**/*.test.ts', 'src/test/**'],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  // ── 7. 설정 파일(.mjs/.mts)은 타입 인식 규칙 대상이 아니다.
  //     플러그인 일부가 타입 선언을 제공하지 않아 no-unsafe-* 가 오탐한다.
  {
    files: ['**/*.mjs', '**/*.mts'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // ── 8. Prettier 충돌 해소 — 반드시 마지막
  prettier,
)
