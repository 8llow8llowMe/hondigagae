# 서비스 소개 페이지(`/about` 확장) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 공개 `/about` 을 8절(히어로 · 질문 3 · 위급 · 데이터 · 알아두실 점 · CTA) 소개 페이지로 다시 짜고, 스크롤 등장 + 예시 1회 재생 모션을 붙인다. 백엔드는 부르지 않는다.

**Architecture:** 페이지와 절 본문은 서버 컴포넌트다. 전폭 그린/연녹 밴드(`IntroBand`)가 `Canvas` 안에 쌓이고 안쪽 내용만 `max-w-6xl`(1152) 이다. 클라이언트 경계는 다섯 개 — 등장을 맡는 `Reveal` 과 고정 예시를 1회 재생하는 `VerdictSpecimen` · `GoldenCurveSpecimen` · `CongestionSpecimen` · `PlanSpecimen`. 모두 처음 렌더는 보이는 상태이고 마운트 뒤 화면 밖 요소만 숨겨 등장시킨다(`useRevealOnce`). 예시 값은 `about-specimen-data.ts` 상수 하나에, 문구는 `messages.about` 에 둔다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript(`strict` + `exactOptionalPropertyTypes`) · Tailwind CSS v4(`@theme inline` 토큰) · Vitest(node 환경, `renderToStaticMarkup` 문자열 단언) · pnpm

**Spec:** `docs/superpowers/specs/2026-09-15-about-landing-design.md` — 절별 확정 문구는 §5, 시각 톤 예외는 §6, 모션은 §6-4, 검증은 §10. **문구는 이 계획이 아니라 명세 §5 가 정본이다.** 계획의 코드 블록과 명세가 갈리면 명세를 따른다.

## Global Constraints

- **저장소 루트가 아니라 `frontend/` 에서 `pnpm` 명령을 실행한다.** 워크트리 경로: `/Users/seonghoho/Documents/projects/hondigagae/.claude/worktrees/hondigagae-landing-page-bb243b/frontend`
- **`git add -A` · `git add .` · `git stash` 금지.** 경로를 하나씩 스테이징한다 (`docs/git-workflow.md` §4-1). 작업 트리를 다른 세션과 공유한다.
- **커밋 prefix `[FE]`**, 타입 `feat`/`test`/`docs`. 형식: `[FE] feat: ...`. 커밋 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` 한 줄.
- **문구는 전부 해요체**(`message-tone.test.ts` 가 감시). 금지어(홍보성 용례): `최고의`, `완벽한`, `강아지`, `애견`, `펫 프렌들리`, `여행 계획`, `플랜`, `스팟`, `여행 점수`. **기상 용어 `최고 체감온도` 의 "최고" 는 금지어가 아니다**(홈이 이미 쓴다). 용어는 `반려견` · `여행 일정` · `장소` · `여행 적합도` · `반려견 동반 가능`.
- **FE 문구에 개수(`\d+곳`)를 적지 않는다** — 규모 타일의 숫자는 `about-specimen-data.ts` 의 상수이고 `messages.about` 에는 숫자가 없다.
- **`className` 으로 공용 컴포넌트 외형(색·radius·shadow·padding)을 덮지 않는다.** 레이아웃 유틸리티만. 버튼 외형이 필요하면 `Button` 변형을 추가한다.
- **타이포는 7단 토큰만**: `text-page` `text-display` `text-title-1` `text-title-2` `text-body-1` `text-body-2` `text-caption`. **spacing 은 스케일 `4 6 8 12 16 20 24 32 40 48 64`** 안의 Tailwind 유틸리티만(`p-1`=4 … `p-16`=64). **arbitrary value(`max-w-[1120px]`, `p-[13px]`) 금지.**
- **등급 색(`bg/text-metric-*`)은 예시의 실제 등급 자리에만.** 혼잡 막대는 `bg-congestion-bar` / `bg-congestion-best`. 영업 상태는 `bg-status-open-100 text-status-open-700`. 절 배경은 `bg-intro-band` · `bg-brand-700`. **`brand-50` · `brand-100` 이라는 이름을 쓰지 않는다**(폐기 토큰 가드).
- **`shadow-*` 를 쓰지 않는다** (`token-usage.test.ts` `FLOATING` 허용 목록 밖).
- **새 색 0개.** `--intro-band: #f0f7f3`(= `--row-selected`) · `--intro-tint: #e4f0ea`(= `--metric-high-100`).
- **모션**: 등장 `transition duration-200 ease-out` + `translate-y-3 opacity-0`, 형제 지연 60ms(`style={{ transitionDelay }}`), 카운트업 600ms, 곡선 800ms, 막대 400ms, 색 150ms. 1회 재생, 무한 반복 없음. **끝 상태가 정본** — 정적 마크업에 `opacity-0` · `scale-y-0` · `translate-y-3` 이 없어야 하고 최종값(`29` `56.0` `31` `위험`)이 처음부터 DOM 에 있어야 한다.
- **`/about` 은 보호 경로가 아니다.** `proxy.ts` `PROTECTED_PATHS` 에 넣지 않는다. 보호 경로 링크(`/ai-plans/new` · `/pets/new`)는 그 경로로 바로 건다(proxy 가 `returnTo` 를 붙인다).
- **모든 파일 UTF-8(no BOM).**
- 각 Task 끝의 검증은 최소 `pnpm test <파일>` 이고, Task 7 이후는 `pnpm verify`(lint + typecheck + test) 다. `pnpm format:check` 는 pre-push 훅이 돌리므로 Task 10 에서 한 번 돌린다.

---

## 파일 구조

| 파일 | 책임 | Task |
| --- | --- | --- |
| `frontend/src/styles/tokens.css` (수정) | `--intro-band` · `--intro-tint` 선언 | 1 |
| `frontend/app/globals.css` (수정) | `@theme inline` 에 두 토큰 매핑 | 1 |
| `frontend/src/styles/contrast.test.ts` (수정) | 두 토큰 대비 + "새 색 아님" 단언 | 1 |
| `frontend/src/components/button.tsx` (수정) | `inverse` · `inverseOutline` 변형 | 1 |
| `frontend/src/components/button-inverse.test.ts` (생성) | 두 변형의 클래스 단언 | 1 |
| `frontend/DESIGN.md` (수정) | §0-2 소개 페이지 표면 · §2-1 포인터 · §8 재생 길이 | 1 |
| `frontend/src/lib/messages/about.ts` (수정) | §5 확정 문구 전부 | 2 |
| `frontend/src/lib/messages/message-tone.test.ts` (수정) | `aboutMessages` 에 개수 없음 | 2 |
| `frontend/src/features/about/use-reveal-once.ts` (생성) | 1회 등장/재생 위상 훅 | 3 |
| `frontend/src/features/about/reveal.tsx` (생성) | 스크롤 등장 래퍼 | 3 |
| `frontend/src/features/about/reveal.test.ts` (생성) | 정적 마크업이 숨기지 않음 | 3 |
| `frontend/src/features/about/about-specimen-data.ts` (생성) | 예시 상수(숫자 · 좌표 · 예시 장소명) | 4 |
| `frontend/src/features/about/verdict-specimen.tsx` (생성) | 히어로 판정 카드 + 카운트업 | 4 |
| `frontend/src/features/about/golden-curve-specimen.tsx` (생성) | 곡선 그리기 | 5 |
| `frontend/src/features/about/congestion-specimen.tsx` (생성) | 막대 자라남 | 6 |
| `frontend/src/features/about/plan-specimen.tsx` (생성) | 일자 탭 전환 | 6 |
| `frontend/src/features/about/about-specimens.test.ts` (생성) | 예시 4개 정적 단언 | 4·5·6 |
| `frontend/src/features/about/intro-band.tsx` (생성) | 전폭 밴드 + 1152 컨테이너 | 7 |
| `frontend/src/features/about/about-view.tsx` (재작성) | 8절 조립 (서버) | 7 |
| `frontend/app/(main)/about/page.tsx` (수정) | `SurfaceStack` 제거, `Canvas` 만 | 7 |
| `frontend/src/features/about/about-view.test.ts` (재작성) | 출처 · 링크 · 최종값 · 숨김 없음 | 7 |
| `frontend/docs/features/about/소개페이지-세부명세.md` (생성) | D0~D8 | 9 |
| `frontend/docs/features/_index.md` · `frontend/docs/screen-inventory.md` (수정) | `about` 행 | 9 |

총 23 파일(문서 포함). 30 파일 목표 안이다.

---

### Task 1: 토큰 · Button 변형 · DESIGN.md 예외 절

**Files:**
- Modify: `frontend/src/styles/tokens.css` (`--brand-700` 선언 바로 아래, 약 74행)
- Modify: `frontend/app/globals.css` (`@theme inline` 의 `--color-link-hover` 바로 아래, 약 42행)
- Modify: `frontend/src/styles/contrast.test.ts` (파일 끝에 describe 추가)
- Modify: `frontend/src/components/button.tsx:7` (`ButtonVariant`) · `:30-` (`VARIANT`)
- Create: `frontend/src/components/button-inverse.test.ts`
- Modify: `frontend/src/components/brand/symbol.tsx` (`tone` prop)
- Modify: `frontend/src/components/brand/symbol.test.ts` (inverse 단언 추가)
- Modify: `frontend/DESIGN.md` — §0-1 끝(99행 `## 1. 제품 톤` 바로 위) · §2-1 표 아래 · §8

**Interfaces:**
- Produces: CSS 토큰 `--intro-band` · `--intro-tint`, Tailwind 유틸리티 `bg-intro-band` · `bg-intro-tint` · `hover:bg-intro-band`; `ButtonVariant` 에 `'inverse' | 'inverseOutline'`; `BrandSymbol({ size?: 24 | 48; tone?: 'default' | 'inverse'; className? })` — `inverse` 는 흰 사각 + `--brand-700` 발바닥(그린 면 위용). `Wordmark({ height?: 20 | 40 })` 는 `currentColor` 라 그대로 쓴다.

- **Step 1: 대비 테스트를 먼저 쓴다**

`frontend/src/styles/contrast.test.ts` 끝에 추가:

```ts
describe('토큰 대비 — 소개 페이지 표면 (DESIGN.md §0-2, #635)', () => {
  it.each([['--fg'], ['--fg-muted']])('%s 가 --intro-band 위에서 4.5:1 이상이다', (name) => {
    expect(contrastRatio(token(name), token('--intro-band'))).toBeGreaterThanOrEqual(4.5)
  })

  it.each([['--fg'], ['--fg-muted']])('%s 가 --intro-tint 위에서 4.5:1 이상이다', (name) => {
    expect(contrastRatio(token(name), token('--intro-tint'))).toBeGreaterThanOrEqual(4.5)
  })

  /* 새 색이 아니다 — 팔레트의 값을 이름만 새로 부른 것 (명세 §6-2) */
  it('밴드 토큰은 기존 값과 같다 — 22번째 색을 만들지 않는다', () => {
    expect(token('--intro-band')).toBe(token('--row-selected'))
    expect(token('--intro-tint')).toBe(token('--metric-high-100'))
  })

  /* 그린 밴드 위 글자 — 채운 버튼 hover 와 같은 쌍이지만 이 화면은 면 전체가 이 색이다 */
  it('그린 밴드(--brand-700) 위 흰 글자가 4.5:1 이상이다', () => {
    expect(contrastRatio(token('--fg-inverse'), token('--brand-700'))).toBeGreaterThanOrEqual(4.5)
  })
})
```

- **Step 2: 실패 확인**

Run (frontend/): `pnpm test src/styles/contrast.test.ts`
Expected: FAIL — `tokens.css 에 --intro-band 이 없다`

- **Step 3: 토큰 선언 + 매핑**

`frontend/src/styles/tokens.css` — `--brand-700: #1d6646;` 줄 아래에:

```css
  /*
    소개 페이지 표면 (DESIGN.md §0-2, #635). 값은 --row-selected · --metric-high-100 과 같고
    **이름만 이 축의 것**이다 — 브랜드 tint 로 읽혀 다른 화면이 가져다 쓰지 못하게 한다.
    --brand-50/100 은 §2-7 폐기 토큰이라 되살리지 않는다.
  */
  --intro-band: #f0f7f3;
  --intro-tint: #e4f0ea;
```

`frontend/app/globals.css` — `--color-link-hover: var(--link-hover);` 아래에:

```css
  --color-intro-band: var(--intro-band);
  --color-intro-tint: var(--intro-tint);
```

- **Step 4: 통과 확인**

Run: `pnpm test src/styles/contrast.test.ts`
Expected: PASS (새 describe 6건 포함)

- **Step 5: Button 변형 테스트**

`frontend/src/components/button-inverse.test.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ButtonLink } from '@/components/button'

/**
 * 그린 밴드(`--brand-700`) 위에 서는 두 변형 — 소개 페이지 전용 (DESIGN.md §0-2, #635).
 * `className` 으로 외형을 덮지 않고 변형을 낸다 (`component-guide.md` §3).
 */
describe('Button — inverse 변형', () => {
  it('inverse 는 흰 면 + brand-700 글자다', () => {
    const markup = renderToStaticMarkup(
      createElement(ButtonLink, { href: '/', variant: 'inverse' }, '홈으로 가기'),
    )
    expect(markup).toContain('bg-bg')
    expect(markup).toContain('text-brand-700')
    expect(markup).not.toContain('text-fg-inverse')
  })

  it('inverseOutline 은 투명 면 + 흰 글자 + 흰 테두리다', () => {
    const markup = renderToStaticMarkup(
      createElement(ButtonLink, { href: '/places', variant: 'inverseOutline' }, '장소 찾기'),
    )
    expect(markup).toContain('text-fg-inverse')
    expect(markup).toContain('border-fg-inverse/55')
    expect(markup).not.toContain('bg-bg')
  })
})
```

- **Step 6: 실패 확인**

Run: `pnpm test src/components/button-inverse.test.ts`
Expected: FAIL (typecheck 는 vitest 가 안 하므로 런타임에서 `VARIANT[variant]` 가 `undefined` → 클래스 없음)

- **Step 7: 변형 추가**

`frontend/src/components/button.tsx`:

```ts
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'dangerOutline'
  | 'kakao'
  | 'inverse'
  | 'inverseOutline'
```

`VARIANT` 객체의 `kakao` 항목 아래에:

```ts
  /*
    그린 밴드(`--brand-700`) 위에 서는 둘 — 소개 페이지(`/about`) 전용 (DESIGN.md §0-2, #635).
    `inverse` 는 흰 면 + `--brand-700` 글자(6.91:1), `inverseOutline` 은 투명 면 + 흰 글자 +
    흰 55% 테두리. hover 는 `inverse` 가 연녹(`--intro-band`), outline 이 흰 10% 채움 —
    둘 다 색을 새로 만들지 않는다.
  */
  inverse: 'bg-bg text-brand-700 hover:bg-intro-band active:bg-intro-band',
  inverseOutline:
    'border border-fg-inverse/55 text-fg-inverse hover:bg-fg-inverse/10 active:bg-fg-inverse/10',
```

- **Step 8: 통과 확인**

Run: `pnpm test src/components/button-inverse.test.ts src/styles`
Expected: PASS. `token-usage.test.ts` 도 함께 통과해야 한다(`brand-50/100` 을 쓰지 않았다).

- **Step 8-1: BrandSymbol `inverse` 톤 테스트**

`frontend/src/components/brand/symbol.test.ts` 끝에 추가 (파일의 기존 import — `createElement` · `renderToStaticMarkup` · `BrandSymbol` — 를 그대로 쓴다):

```ts
describe('BrandSymbol — inverse 톤 (그린 면 위, #635)', () => {
  it('사각은 흰색, 발바닥은 brand-700 이다 — 등급 색을 쓰지 않는다', () => {
    const markup = renderToStaticMarkup(createElement(BrandSymbol, { size: 48, tone: 'inverse' }))
    expect(markup).toContain('fill="var(--bg)"')
    expect(markup).toContain('fill="var(--brand-700)"')
    expect(markup).not.toContain('fill="var(--brand-500)"')
    expect(markup).not.toContain('metric-')
  })

  it('기본 톤은 바뀌지 않는다 — brand-500 사각 + 흰 발바닥', () => {
    const markup = renderToStaticMarkup(createElement(BrandSymbol))
    expect(markup).toContain('fill="var(--brand-500)"')
  })
})
```

Run: `pnpm test src/components/brand/symbol.test.ts` → Expected: FAIL (`tone` 무시되어 brand-500 이 남는다)

- **Step 8-2: `tone` prop**

`frontend/src/components/brand/symbol.tsx`:

```tsx
export function BrandSymbol({
  size = 24,
  tone = 'default',
  className,
}: {
  size?: 24 | 48
  /**
   * `inverse` 는 그린 면(`--brand-700`) 위용 — 소개 페이지 히어로 하나가 쓴다 (DESIGN.md §0-2,
   * #635). 사각을 흰색으로, 발바닥을 `--brand-700` 으로 뒤집는다. 브랜드 README 가 막는 것은
   * "심볼을 등급 색으로 칠하는 것" 이고, 이 뒤집기는 브랜드 두 색 안에서만 움직인다.
   */
  tone?: 'default' | 'inverse'
  className?: string
}) {
  const square = tone === 'inverse' ? 'var(--bg)' : 'var(--brand-500)'
  const paw = tone === 'inverse' ? 'var(--brand-700)' : 'var(--bg)'
  return (
    <svg /* 기존 속성 그대로 */>
      <rect width="32" height="32" rx="4" fill={square} />
      <g fill={paw}>
        {/* 기존 circle × 3 + path 그대로 */}
      </g>
    </svg>
  )
}
```

Run: `pnpm test src/components/brand` → Expected: PASS

- **Step 9: DESIGN.md 갱신**

`frontend/DESIGN.md` — `## 1. 제품 톤` 바로 위에 삽입:

```markdown
### 0-2. 소개 페이지 표면 — `/about` 하나의 예외 (2026-09-15, #635)

소개 페이지는 제품을 **쓰는** 화면이 아니라 **소개하는** 화면이다. 브랜드 에셋 규칙
(`docs/hondi_img/README.md`)이 "인터페이스 안은 무채색, **밖**은 브랜드 컬러" 로 가른 그
경계의 바깥쪽이고, 락업의 "스플래시·외부 노출" 자리와 같은 쪽이다. **적용 범위는 `/about`
하나다.** 다른 화면이 이 절을 근거로 그린 면을 쓰지 않는다.

| 여는 것 | 값 | 지키는 것 |
| --- | --- | --- |
| 전폭 밴드 배경 | `--brand-700`(흰 글자 6.91:1) · `--intro-band` | 등급 색 `--metric-*` 은 예시의 실제 등급 자리에만 |
| 규모 타일 · 아이콘 배경 | `--intro-tint` | 혼잡 막대 `--congestion-*` · 영업 상태 `--status-open-*` 그대로 |
| 히어로 락업 | `(auth)` 셸 크기(심볼 48 · 워드마크 40×148), 심볼은 `tone="inverse"`(흰 사각 + `--brand-700` 발바닥) | 헤더 24px 은 그대로. 심볼을 등급 색으로 칠하지 않는다 |
| 그린 면 위 버튼 | `Button` 변형 `inverse` · `inverseOutline` | `className` 으로 외형을 덮지 않는다 |

**토큰 둘은 새 색이 아니다.** `--intro-band #F0F7F3` = `--row-selected`,
`--intro-tint #E4F0EA` = `--metric-high-100`. 값이 같아도 이름을 분리하는 것은 §2-3 #598
의 원칙이다 — `--metric-high-100` 을 절 배경에 그대로 쓰면 "적합도 높음" 의 tint 가 브랜드
면이 된다. **`--brand-50/100` 은 §2-7 폐기 토큰이라 되살리지 않는다.**

**마케팅 톤 금지(§1)는 열지 않는다.** 룩만 열고 카피는 그대로다 — 과장은 데이터 신뢰형
컨셉을 스스로 깎는다.

**그림자는 여기서도 없다.** 그린 면 위의 흰 카드는 그림자 없이 충분히 갈린다.

정본: `docs/superpowers/specs/2026-09-15-about-landing-design.md` §6.
```

`### 2-1. 표면 · 테두리` 표 아래 인용문 끝에 한 줄 추가:

```markdown
> **`--intro-band` · `--intro-tint`** 는 소개 페이지(`/about`) 밴드 전용이다 — §0-2.
```

`## 8. 모션` 목록 끝에 추가:

```markdown
- **소개 페이지 예시 재생** (`/about`, #635): 숫자 카운트업 **600ms** · 곡선 그리기 **800ms**.
  화면에 들어올 때 **1회** 재생하고 끝 상태에 머문다. 다른 화면은 이 길이를 쓰지 않는다.
  근거는 `docs/superpowers/specs/2026-09-15-about-landing-design.md` §6-4.
```

- **Step 10: 커밋**

```bash
git add frontend/src/styles/tokens.css frontend/app/globals.css frontend/src/styles/contrast.test.ts frontend/src/components/button.tsx frontend/src/components/button-inverse.test.ts frontend/src/components/brand/symbol.tsx frontend/src/components/brand/symbol.test.ts frontend/DESIGN.md
git commit -m "[FE] feat: 소개 페이지 표면 토큰 intro-band/tint · Button inverse 변형 · BrandSymbol inverse 톤 (#635)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: 문구 — `messages.about`

**Files:**
- Modify: `frontend/src/lib/messages/about.ts` (전체 교체)
- Modify: `frontend/src/lib/messages/message-tone.test.ts` (끝에 describe 추가)

**Interfaces:**
- Produces: `aboutMessages` 의 키 — `title` `description` `hero` `q1` `q2` `q3` `q4` `data` `notice` `cta` `specimen` `scale` (아래 코드가 정본 형태). 이후 Task 는 `messages.about.hero.heading` 처럼 접근한다.

- **Step 1: 개수 금지 테스트**

`frontend/src/lib/messages/message-tone.test.ts` 끝에:

```ts
import { aboutMessages } from '@/lib/messages/about'

/**
 * 소개 페이지(#635) 문구 — 규모 숫자는 `features/about/about-specimen-data.ts` 의 상수이고
 * **문구에는 없다.** 홈 응급 배너가 `3곳` 이라 말하는 동안 목록은 0건이던 위의 사례와 같은
 * 판단이다. 예외 없이 `aboutMessages` 전체를 훑는다.
 */
describe('소개 페이지 문구 — 개수를 적어 두지 않는다', () => {
  function leaves(value: unknown): string[] {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.flatMap(leaves)
    if (value !== null && typeof value === 'object') return Object.values(value).flatMap(leaves)
    return []
  }

  it('aboutMessages 어디에도 "N곳" 이 없다', () => {
    expect(leaves(aboutMessages).filter((text) => /\d+\s*곳/.test(text))).toEqual([])
  })
})
```

(import 는 파일 상단 import 블록으로 올린다 — eslint `import/first`.)

- **Step 2: 실행 — 현재는 통과해야 한다** (기존 about.ts 에 개수가 없다). 이 테스트는 Task 2 의 문구가 원칙을 어기지 않게 잠그는 것이다.

Run: `pnpm test src/lib/messages`
Expected: PASS

- **Step 3: `about.ts` 전체 교체**

```ts
/**
 * 서비스 소개 화면 문구 — `/about` (#635).
 *
 * **이 화면은 #611 에서 출처 표기가 갈 곳으로 생겼고, #635 에서 소개 페이지가 됐다.** 절은
 * 기능 이름이 아니라 **보호자의 질문 순서**다 — 데려가도 돼요? → 지금 나가도 돼요? → 오늘
 * 어디 가요? → 위급하면? → 무엇을 보고 판단하나요. 정본은
 * `docs/superpowers/specs/2026-09-15-about-landing-design.md` §5.
 *
 * **보호 라우트가 아니다.** `proxy.ts` `PROTECTED_PATHS` 에 넣지 않는다 — 심사자가 로그인
 * 없이 모바일로 둘러본다.
 *
 * **출처 · 면책 · 공모전 표기를 여기서 다시 적지 않는다.** `footerMessages` 를 그대로 읽는다.
 *
 * **개수를 적지 않는다.** `315곳` 같은 규모 숫자는 `features/about/about-specimen-data.ts`
 * 의 상수다 — `message-tone.test.ts` 가 잠근다.
 *
 * **예시 카드의 문장도 여기 있다.** 값(29 · 56.0 · 31)은 상수 파일에, 그 값을 감싸는 말은
 * 여기에 — 해요체 감시가 예시 문장까지 덮게 하기 위해서다.
 */
export const aboutMessages = {
  title: '서비스 소개',
  description: '혼디가개가 무엇을 보고 판단하는지와 데이터 출처를 모았어요.',

  hero: {
    eyebrow: '반려견과 함께하는 제주 여행',
    heading: '동반 가능한 곳만 골라서, 지금 가도 되는지까지 봐요',
    sub: '날씨·노면 온도·혼잡도를 공공데이터로 확인하고, 반려견의 크기와 성향에 맞는 장소로 하루 일정을 짜요. 회원가입 없이도 오늘 판정부터 볼 수 있어요.',
    ctaPrimary: '오늘 판정 보러 가기',
    ctaSecondary: '장소 찾기',
  },

  /** 히어로 판정 카드 예시 — 값은 `about-specimen-data.ts` */
  specimen: {
    verdictAria: '산책 판정 화면 예시',
    verdictLabel: '오늘 산책 · 제주시 기준',
    verdictTitle: '지금은 나가지 않는 편이 좋아요',
    verdictGrade: '위험',
    temperatureLabel: '기온',
    pavementLabel: '추정 노면(아스팔트)',
    feelsLikeLabel: '체감온도',
    /** `{threshold}` 치환 */
    reasonPavement: '노면 온도가 {threshold}℃ 를 넘어 발바닥 화상 위험이 있어요',
    /** `{window}` 치환 */
    reasonWindow: '오늘 산책하기 좋은 시간은 {window} 이에요',
    verdictNote: '화면 예시예요. 실제 값은 기상청 실시간 관측으로 계산해요.',

    placesAria: '내 반려견 기준 필터 화면 예시',
    placesChip: '내 반려견 기준 · 소형 · 7kg',
    placesNote: '화면 예시예요. 장소 이름과 조건은 실제와 달라요.',
    unknownTag: '동반 정보 없음',

    curveAria: '시간대별 기온과 추정 노면 온도 곡선 예시. 06시부터 08시 사이가 추천 구간이에요.',
    curveTitle: '오늘 산책하기 좋은 시간',
    /** `{window}` 치환 */
    curveSub: '제주시 기준 · {window} 을 추천해요',
    curveLegendTemperature: '기온',
    curveLegendPavement: '추정 노면(아스팔트) 온도',
    curveLegendWindow: '추천 구간',
    curveNote: '화면 예시예요. 곡선은 기상청 시간별 예보로 매일 새로 계산해요.',

    suitabilityGrade: '적합도 높음',
    suitabilityReasons: [
      '오전에는 구름 많고 최고 체감온도 27℃ 예요',
      '이 시기 방문객이 적은 편이에요',
    ] as const,

    congestionAria: '일주일 혼잡도 막대 예시. 목요일이 가장 한산해요.',
    /** `{date}` 치환 */
    congestionBest: '{date}이 가장 한산할 것으로 보여요',

    planTablistLabel: '예시 일정의 일자',
    planRegenerate: '하루만 다시 짜기',
    planAiTag: 'AI 제안',

    weatherAria: '3일 날씨 브리핑 예시. 2일차에 비가 와요.',
    indoorTitle: '비가 오면 갈 만한 실내',

    emergencyAria: '긴급 시설 목록 예시',
    emergencyTitle: '가까운 동물병원·약국',
    emergencySub: '현재 위치 기준 · 거리순',
    emergencyNote: '화면 예시예요. 시설 이름과 거리는 실제와 달라요.',
  },

  q1: {
    kicker: '질문 1',
    heading: '데려가도 돼요?',
    lead: '장소마다 갈리는 동반 조건을 내 반려견 기준으로 걸러요.',
    points: [
      '크기와 체중을 등록하면 그 조건으로 제주의 동반 가능 장소를 걸러요',
      "동반 정보가 없는 곳은 '불가'로 단정하지 않고 정보 없음으로 따로 보여 줘요",
      '실내인지, 지금 운영 중인지도 함께 봐요',
    ] as const,
    link: '장소 찾기',
  },

  q2: {
    kicker: '질문 2',
    heading: '지금 나가도 돼요?',
    lead: '기온이 괜찮아도 아스팔트는 뜨거워요. 발바닥이 닿는 온도로 판정해요.',
    points: [
      '기상청 실시간 관측으로 노면(아스팔트) 온도를 추정해요',
      '체감온도와 함께 안전·주의·위험으로 판정하고 이유를 붙여요',
      '하루 중 산책하기 좋은 시간을 골라 줘요',
      '기상특보가 발효되면 그것부터 알려요',
    ] as const,
    link: '오늘 판정 보기',
  },

  q3: {
    kicker: '질문 3',
    heading: '오늘 어디 가요?',
    lead: '점수만 주지 않아요. 왜 그런지 이유를 함께 보여 줘요.',
    cards: {
      suitability: {
        title: '여행 적합도',
        desc: '날씨·동반 조건·혼잡도를 묶어 등급으로 답하고, 근거를 접어 둬요.',
      },
      congestion: {
        title: '한산한 날',
        desc: '앞으로 30일 혼잡도 예측에서 가장 한산한 날을 골라요.',
      },
      aiPlan: {
        title: 'AI 일정',
        desc: '반려견 조건과 여행 기간을 넣으면 하루 단위 초안을 만들어요. 실제 있는 장소만 후보로 써서 없는 곳을 지어내지 않아요.',
      },
      indoor: {
        title: '비가 오면 실내로',
        desc: '일자별 날씨를 미리 브리핑하고, 비 오는 날은 가까운 실내 대안을 함께 보여 줘요.',
      },
    },
    link: 'AI 일정 만들기',
  },

  q4: {
    kicker: '그리고',
    heading: '위급하면?',
    lead: '여행 중 가장 급한 질문에는 가장 짧게 답해요.',
    points: [
      '현재 위치 기준으로 동물병원·동물약국을 거리순으로 찾아요',
      '지금 진료 중인지 함께 보여 줘요',
      '여행 일정 안에서도 한 번에 들어가요',
    ] as const,
    link: '가까운 병원·약국',
  },

  data: {
    kicker: '데이터',
    heading: '무엇을 보고 판단하나요',
    lead: '화면의 모든 등급에는 출처와 이유가 붙어요.',
    /** 규모 타일 라벨 — 숫자는 `SCALE_SPECIMEN` */
    scaleLabels: {
      places: '반려견 동반 가능 장소',
      emergency: '동물병원·동물약국',
      sources: '공공데이터 원천',
    },
    scaleUnit: '곳',
    scaleNote: '2026년 9월 적재 기준이에요. 실시간으로 세는 값은 아니에요.',
    rules: [
      '추천에는 항상 근거를 붙여요',
      '공공데이터는 미리 모아 두고, 화면은 그 데이터만 읽어요',
      'AI는 실제 있는 장소 목록 안에서만 골라요',
      '일정의 저장과 확정은 사용자가 해요. AI는 제안만 해요',
    ] as const,
    sourcesDescription: '화면에 나오는 정보가 무엇에 근거하는지 적어 두었어요.',
    architecture: 'Next.js BFF · Spring MSA 5서비스 · Spring AI + Ollama',
  },

  notice: {
    title: '알아두실 점',
  },

  cta: {
    heading: '가입 없이 오늘 판정부터 봐요',
    sub: '반려견을 등록하면 판정과 장소 필터가 내 아이 기준으로 바뀌어요.',
    primary: '홈으로 가기',
    secondary: '반려견 등록하기',
  },
} as const
```

**주의:** `scaleUnit: '곳'` 은 숫자 없이 단위만이라 `\d+\s*곳` 에 걸리지 않는다. `curveAria` 의 `06시부터 08시` 는 `곳` 이 아니다.

- **Step 4: 통과 확인**

Run: `pnpm test src/lib/messages`
Expected: PASS (해요체 · 개수 둘 다)

- **Step 5: typecheck** — 기존 `about-view.tsx` 가 `messages.about.introTitle` · `intro` · `noticeTitle` 을 참조하므로 **여기서 깨진다.** 예상된 실패다. Task 7 이 고친다. 커밋은 한다(문구만 바뀐 상태를 남긴다).

Run: `pnpm typecheck`
Expected: FAIL — `about-view.tsx` 3곳. **다른 파일에서 실패하면 멈추고 보고한다.**

- **Step 6: 커밋**

```bash
git add frontend/src/lib/messages/about.ts frontend/src/lib/messages/message-tone.test.ts
git commit -m "[FE] feat: 소개 페이지 8절 문구를 messages.about 에 확정한다 (#635)

about-view 는 Task 7 에서 새 키로 옮긴다 — 그때까지 typecheck 가 그 파일에서 깨진다.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `useRevealOnce` + `Reveal`

**Files:**
- Create: `frontend/src/features/about/use-reveal-once.ts`
- Create: `frontend/src/features/about/reveal.tsx`
- Create: `frontend/src/features/about/reveal.test.ts`

**Interfaces:**
- Produces:
  - `type RevealPhase = 'idle' | 'armed' | 'revealed'`
  - `useRevealOnce<T extends Element>(ref: RefObject<T | null>, playIfVisible: boolean): RevealPhase`
  - `Reveal({ delay?: number; className?: string; children: ReactNode })` — 항상 `div` 를 그린다.
  - `REVEAL_HIDDEN_CLASS = 'translate-y-3 opacity-0'` (테스트가 "정적 마크업에 없음" 을 이 상수로 단언한다)

- **Step 1: 테스트**

`frontend/src/features/about/reveal.test.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Reveal, REVEAL_HIDDEN_CLASS } from '@/features/about/reveal'
import { readSourceWithoutComments } from '@/test/source'

/**
 * 스크롤 등장 래퍼 (#635, 명세 §6-4 1단).
 *
 * **처음 렌더는 보이는 상태다.** 숨김은 마운트 뒤 화면 밖 요소에만 건다 — 검색 봇 · JS 실패 ·
 * 느린 기기에서 빈 화면이 생기지 않는다. 그래서 정적 마크업에는 숨김 클래스가 없어야 한다.
 */
describe('Reveal — 정적 렌더', () => {
  const markup = renderToStaticMarkup(
    createElement(Reveal, { delay: 60 }, createElement('p', null, '내용')),
  )

  it('자식을 그대로 그린다', () => {
    expect(markup).toContain('<p>내용</p>')
  })

  it('숨김 클래스가 없다 — JS 없이도 보인다', () => {
    for (const cls of REVEAL_HIDDEN_CLASS.split(' ')) expect(markup).not.toContain(cls)
  })

  it('지연은 transition-delay 인라인 값이다 — 형제 60ms 간격', () => {
    expect(markup).toContain('transition-delay:60ms')
  })

  it('전환 길이는 §8 변형 값 200ms 다', () => {
    expect(markup).toContain('duration-200')
    expect(markup).toContain('ease-out')
  })
})

describe('useRevealOnce — 규칙', () => {
  const source = readSourceWithoutComments('src/features/about/use-reveal-once.ts')

  it('IntersectionObserver 를 cleanup 에서 disconnect 한다', () => {
    expect(source).toContain('observer.disconnect()')
  })

  it('IntersectionObserver 가 없는 환경에서는 손대지 않는다', () => {
    expect(source).toContain("typeof IntersectionObserver === 'undefined'")
  })
})
```

- **Step 2: 실패 확인**

Run: `pnpm test src/features/about/reveal.test.ts`
Expected: FAIL — 모듈 없음

- **Step 3: 훅**

`frontend/src/features/about/use-reveal-once.ts`:

```ts
'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

export type RevealPhase = 'idle' | 'armed' | 'revealed'

/**
 * 1회 등장/재생 위상 (#635, 명세 §6-4).
 *
 * - 마운트 시 요소가 **뷰포트 아래**면 `armed`(숨김) → 뷰포트 하단 10% 안으로 들어오면 `revealed`.
 * - 마운트 시 **이미 보이면**: `playIfVisible` 이 참일 때만 `armed` → 두 프레임 뒤 `revealed`
 *   로 밟아 1회 재생한다(히어로 예시 · 데스크톱에서 첫 화면에 걸린 예시). 거짓이면 `idle`
 *   그대로 — 로드 시 보이는 요소는 등장 애니메이션을 하지 않는다.
 * - `IntersectionObserver` 가 없으면 `idle`. **어느 경로에서도 처음 렌더는 `idle`(보임)이다.**
 *
 * 두 프레임을 쓰는 이유: `armed` 가 한 번 그려진 뒤에 `revealed` 로 바뀌어야 CSS transition
 * 이 시작점을 갖는다. 같은 프레임에 두 상태를 바꾸면 전환 없이 끝 상태만 그려진다.
 *
 * `done` 은 StrictMode 의 이펙트 이중 실행과 재관측을 막는다 — 재생은 1회다.
 */
export function useRevealOnce<T extends Element>(
  ref: RefObject<T | null>,
  playIfVisible: boolean,
): RevealPhase {
  const [phase, setPhase] = useState<RevealPhase>('idle')
  const done = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (node === null || done.current) return
    if (typeof IntersectionObserver === 'undefined') return

    const reveal = () => {
      done.current = true
      setPhase('revealed')
    }

    const rect = node.getBoundingClientRect()
    const visible = rect.top < window.innerHeight && rect.bottom > 0

    if (visible) {
      if (!playIfVisible) {
        done.current = true
        return
      }
      setPhase('armed')
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(reveal)
      })
      return () => cancelAnimationFrame(frame)
    }

    setPhase('armed')
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal()
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, playIfVisible])

  return phase
}
```

- **Step 4: `Reveal`**

`frontend/src/features/about/reveal.tsx`:

```tsx
'use client'

import { useRef, type ReactNode } from 'react'

import { useRevealOnce } from '@/features/about/use-reveal-once'
import { cn } from '@/lib/utils/cn'

/** 숨김 상태 — 12px 아래 · 투명. 테스트가 정적 마크업에 이것이 **없음**을 단언한다 */
export const REVEAL_HIDDEN_CLASS = 'translate-y-3 opacity-0'

/**
 * 스크롤 등장 (#635, 명세 §6-4 1단).
 *
 * 항상 `div` 다 — `li` 안에 넣을 때는 `<li><Reveal>…</Reveal></li>` 로 감싼다. 태그를 prop
 * 으로 열면 ref 타입이 태그마다 갈려 `exactOptionalPropertyTypes` 아래서 캐스팅이 필요해진다.
 *
 * `delay` 는 형제 사이 60ms 간격용이다. 값이 0 이면 `style` 을 아예 내지 않는다.
 */
export function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const phase = useRevealOnce(ref, false)

  return (
    <div
      ref={ref}
      className={cn(
        'transition duration-200 ease-out',
        phase === 'armed' && REVEAL_HIDDEN_CLASS,
        className,
      )}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
```

- **Step 5: 통과 확인**

Run: `pnpm test src/features/about/reveal.test.ts`
Expected: PASS

- **Step 6: 커밋**

```bash
git add frontend/src/features/about/use-reveal-once.ts frontend/src/features/about/reveal.tsx frontend/src/features/about/reveal.test.ts
git commit -m "[FE] feat: 소개 페이지 스크롤 등장 — useRevealOnce · Reveal (#635)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 예시 데이터 + `VerdictSpecimen`(카운트업)

**Files:**
- Create: `frontend/src/features/about/about-specimen-data.ts`
- Create: `frontend/src/features/about/verdict-specimen.tsx`
- Create: `frontend/src/features/about/about-specimens.test.ts` (이 Task 에서 시작, 5·6 이 이어 쓴다)

**Interfaces:**
- Produces (데이터):
  ```ts
  export const VERDICT_SPECIMEN = { temperature: 29, pavement: 56.0, feelsLike: 31, pavementThreshold: 52, window: '06:00–08:00' } as const
  export const PLACE_ROWS_SPECIMEN: readonly { name: string; tags: readonly string[]; unknown?: true; open?: true }[]
  export const GOLDEN_CURVE_SPECIMEN: { temperaturePath: string; pavementPath: string; windowX: number; windowWidth: number; peak: { x: number; y: number; label: string }; hours: readonly { x: number; label: string }[] }
  export const CONGESTION_SPECIMEN = { heights: readonly number[]; labels: readonly string[]; bestIndex: number; bestDate: string }
  export const PLAN_SPECIMEN: readonly { day: string; items: readonly { time: string; title: string; meta: string }[] }[]
  export const WEATHER_SPECIMEN: readonly { day: string; icon: string; temp: string }[]
  export const INDOOR_SPECIMEN: readonly string[]
  export const EMERGENCY_ROWS_SPECIMEN: readonly { name: string; status: string; kind: string; distance: string }[]
  export const SCALE_SPECIMEN = { places: 315, emergency: 214, sources: 5 } as const
  ```
- Produces (컴포넌트): `VerdictSpecimen()` — props 없음. 내부 `useCountUp(target, play, decimals)`.

- **Step 1: 테스트 (이 Task 몫)**

`frontend/src/features/about/about-specimens.test.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { VERDICT_SPECIMEN } from '@/features/about/about-specimen-data'
import { VerdictSpecimen } from '@/features/about/verdict-specimen'
import { messages } from '@/lib/messages'

/**
 * 고정 예시 4개 (#635, 명세 §6-4 2단). **끝 상태가 정본이다** — 정적 마크업에 최종값이 있고
 * 숨김 클래스가 없다. 재생은 마운트 뒤 클라이언트 몫이라 여기서는 보지 않는다.
 */
describe('VerdictSpecimen — 히어로 판정 카드', () => {
  const markup = renderToStaticMarkup(createElement(VerdictSpecimen))

  it('최종값이 처음부터 DOM 에 있다 — 29 · 56.0 · 31 · 위험', () => {
    expect(markup).toContain('>29<')
    expect(markup).toContain('>56.0<')
    expect(markup).toContain('>31<')
    expect(markup).toContain(messages.about.specimen.verdictGrade)
  })

  it('등급어는 metric-critical 로 칠한다 — 예시라도 실제 등급 자리다', () => {
    expect(markup).toContain('metric-critical')
  })

  it('노면 값에만 등급 색이 붙는다 — 기온·체감은 중립 수치다', () => {
    expect(markup.match(/text-metric-critical-500/g)?.length).toBe(1)
  })

  it('근거 문장이 치환돼 들어간다', () => {
    expect(markup).toContain(`${VERDICT_SPECIMEN.pavementThreshold}℃`)
    expect(markup).toContain(VERDICT_SPECIMEN.window)
    expect(markup).not.toContain('{threshold}')
    expect(markup).not.toContain('{window}')
  })

  it('예시 캡션이 있다 — 지금 제주 날씨로 읽히지 않게', () => {
    expect(markup).toContain(messages.about.specimen.verdictNote)
  })

  it('숨김 클래스가 없다', () => {
    expect(markup).not.toContain('opacity-0')
  })
})
```

- **Step 2: 실패 확인**

Run: `pnpm test src/features/about/about-specimens.test.ts`
Expected: FAIL — 모듈 없음

- **Step 3: 데이터 파일**

`frontend/src/features/about/about-specimen-data.ts`:

```ts
/**
 * 소개 페이지 고정 예시 값 (#635). **계약이 아니라 그림이다** — `types/` · `mocks/` 에 두지
 * 않는다. 서버를 부르지 않으므로 여기 숫자는 실시간 값이 아니고, 화면마다 `화면 예시예요`
 * 캡션이 그것을 밝힌다.
 *
 * 문장은 `messages.about.specimen` 에 있다 — 해요체 감시가 그쪽을 본다. 여기는 숫자 · 좌표 ·
 * 예시 이름만.
 *
 * `VERDICT_SPECIMEN` 의 29 · 56.0 은 홈 `pavementLabel` 주석의 실제 제보 사례다(#269) —
 * 기온은 괜찮은데 지면이 뜨겁다는 이 서비스의 요점을 한 장면으로 보여 준다.
 */
export const VERDICT_SPECIMEN = {
  temperature: 29,
  pavement: 56.0,
  feelsLike: 31,
  pavementThreshold: 52,
  window: '06:00–08:00',
} as const

export const PLACE_ROWS_SPECIMEN = [
  { name: '사계 해안 산책로', tags: ['소형·중형 동반 가능', '실외'], open: true },
  { name: '애월 북카페', tags: ['10kg 이하', '실내'], open: true },
  { name: '저지 예술인마을', tags: ['실외'], unknown: true },
] as const satisfies readonly {
  name: string
  tags: readonly string[]
  open?: true
  unknown?: true
}[]

/** viewBox 0 0 360 150. 곡선은 손으로 그린 베지어다 — 계산식이 아니다 */
export const GOLDEN_CURVE_SPECIMEN = {
  temperaturePath:
    'M12 96 C 40 100, 60 104, 87 100 S 140 74, 192 60 S 260 70, 300 88 S 330 98, 348 100',
  pavementPath:
    'M12 106 C 40 110, 60 112, 87 96 S 150 32, 192 18 S 260 36, 300 76 S 330 96, 348 104',
  windowX: 72,
  windowWidth: 30,
  peak: { x: 192, y: 18, label: '56.0℃' },
  hours: [
    { x: 12, label: '00' },
    { x: 72, label: '06' },
    { x: 132, label: '10' },
    { x: 192, label: '14' },
    { x: 252, label: '18' },
    { x: 312, label: '22' },
  ],
} as const

export const CONGESTION_SPECIMEN = {
  heights: [70, 52, 46, 28, 58, 92, 100],
  labels: ['월', '화', '수', '목', '금', '토', '일'],
  bestIndex: 3,
  bestDate: '9월 18일(목)',
} as const

export const PLAN_SPECIMEN = [
  {
    day: '1일차',
    items: [
      { time: '09:00', title: '사계 해안 산책로', meta: '실외 · 소형·중형 동반 가능' },
      { time: '12:30', title: '반려견 동반 식당', meta: '실내 · 10kg 이하' },
      { time: '15:00', title: '애월 북카페', meta: '실내 · 비 오는 날 대안' },
    ],
  },
  {
    day: '2일차',
    items: [
      { time: '10:00', title: '실내 놀이터', meta: '실내 · 비 예보' },
      { time: '13:00', title: '반려견 동반 카페', meta: '실내 · 전 크기' },
      { time: '16:00', title: '동물병원 근처 산책로', meta: '실외 · 짧게' },
    ],
  },
  {
    day: '3일차',
    items: [
      { time: '08:30', title: '함덕 해변 산책', meta: '실외 · 이른 시간' },
      { time: '11:30', title: '동반 가능 식당', meta: '실내 · 10kg 이하' },
      { time: '14:00', title: '공항 근처 카페', meta: '실내 · 출발 전' },
    ],
  },
] as const

export const WEATHER_SPECIMEN = [
  { day: '1일차', icon: '☀️', temp: '27℃' },
  { day: '2일차', icon: '🌧️', temp: '23℃' },
  { day: '3일차', icon: '⛅', temp: '26℃' },
] as const

export const INDOOR_SPECIMEN = ['애월 북카페 · 1.2km', '실내 놀이터 · 3.4km'] as const

export const EMERGENCY_ROWS_SPECIMEN = [
  { name: '제주 24시 동물의료센터', status: '진료중', kind: '동물병원', distance: '1.8km' },
  { name: '노형 동물약국', status: '영업중', kind: '동물약국', distance: '2.4km' },
] as const

/**
 * 규모 — `README.md` 의 설계 규모다. **실측치와 갈리면 README 도 함께 고친다** (명세 §5-6).
 * 공개 API 가 총 개수를 주지 않아(커서 슬라이스) 화면이 실시간으로 셀 수 없다 — 기준 시점
 * 캡션(`messages.about.data.scaleNote`)이 그것을 밝힌다.
 */
export const SCALE_SPECIMEN = { places: 315, emergency: 214, sources: 5 } as const
```

- **Step 4: `VerdictSpecimen`**

`frontend/src/features/about/verdict-specimen.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

import { VERDICT_SPECIMEN } from '@/features/about/about-specimen-data'
import { useRevealOnce } from '@/features/about/use-reveal-once'
import { MetricBadge } from '@/components/metric'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

const COUNT_UP_MS = 600

/**
 * 0 → target 카운트업 (#635, 명세 §6-4). `play` 가 참이 되는 순간 시작하고 600ms 뒤 **반드시
 * 끝 값으로 고정**한다 — 브라우저 패널이 숨겨지면 rAF 가 멈춰 중간값에 머무는 함정이 있다.
 * `prefers-reduced-motion` 이면 즉시 끝 값 — JS 가 그리는 값이라 전역 CSS 규칙이 못 덮는다.
 * 처음 값은 **target 이다** (정적 렌더 = 끝 상태).
 */
function useCountUp(target: number, play: boolean): number {
  const [value, setValue] = useState(target)

  useEffect(() => {
    if (!play) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS)
      const eased = 1 - (1 - t) ** 3
      setValue(Math.round(target * eased * 10) / 10)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    setValue(0)
    frame = requestAnimationFrame(tick)
    const settle = window.setTimeout(() => setValue(target), COUNT_UP_MS + 50)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(settle)
    }
  }, [target, play])

  return value
}

function Metric({
  label,
  value,
  final,
  decimals,
  hot = false,
}: {
  label: string
  value: number
  final: number
  decimals: 0 | 1
  hot?: boolean
}) {
  return (
    <div className="bg-band rounded-md px-3 py-2">
      <p className="text-caption text-fg-muted font-medium">{label}</p>
      <p className="text-title-1 text-fg mt-1 font-black tabular-nums">
        {/* 스크린리더는 최종값만 — 카운트업 중간값은 시각 노드에만 */}
        <span className="sr-only">{final.toFixed(decimals)}℃</span>
        <span aria-hidden className={cn(hot && 'text-metric-critical-500')}>
          {value.toFixed(decimals)}
        </span>
        <span aria-hidden className="text-caption text-fg-muted ml-0.5 font-medium">
          ℃
        </span>
      </p>
    </div>
  )
}

/**
 * 히어로 판정 카드 예시 (#635, 명세 §5-1 · §6-4).
 *
 * 히어로는 로드 시 보이므로 `playIfVisible` 로 **마운트 직후** 재생한다. 숫자가 끝나면
 * (`revealed` 뒤 150ms) 배지가 나타난다 — 배지는 `opacity` 전환이라 전역 reduced-motion
 * 규칙이 덮는다. **배지는 다른 등급을 거치지 않는다** — `위험` 하나가 나타날 뿐이다.
 */
export function VerdictSpecimen() {
  const ref = useRef<HTMLDivElement>(null)
  const phase = useRevealOnce(ref, true)
  const play = phase === 'revealed'

  const { temperature, pavement, feelsLike, pavementThreshold, window: saferWindow } =
    VERDICT_SPECIMEN
  const t = useCountUp(temperature, play)
  const p = useCountUp(pavement, play)
  const f = useCountUp(feelsLike, play)
  const copy = messages.about.specimen

  return (
    <div
      ref={ref}
      role="group"
      aria-label={copy.verdictAria}
      className="bg-bg border-border -mx-4 border-y md:mx-0 md:rounded-lg md:border"
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 md:px-5">
        <div>
          <p className="text-caption text-fg-muted font-semibold">{copy.verdictLabel}</p>
          <p className="text-title-2 text-fg mt-1 font-semibold">{copy.verdictTitle}</p>
        </div>
        <MetricBadge
          tone="critical"
          className={cn(
            'transition-opacity duration-150 ease-out',
            phase === 'armed' && 'opacity-0',
          )}
        >
          {copy.verdictGrade}
        </MetricBadge>
      </div>
      <div className="px-4 pt-3 pb-4 md:px-5">
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          <Metric label={copy.temperatureLabel} value={t} final={temperature} decimals={0} />
          <Metric label={copy.pavementLabel} value={p} final={pavement} decimals={1} hot />
          <Metric label={copy.feelsLikeLabel} value={f} final={feelsLike} decimals={0} />
        </div>
        <ul className="border-border mt-4 grid gap-2 border-t pt-3">
          <li className="text-body-2 text-fg flex gap-2">
            <span aria-hidden className="bg-fg-muted mt-2 size-1.5 shrink-0 rounded-full" />
            {copy.reasonPavement.replace('{threshold}', String(pavementThreshold))}
          </li>
          <li className="text-body-2 text-fg flex gap-2">
            <span aria-hidden className="bg-fg-muted mt-2 size-1.5 shrink-0 rounded-full" />
            {copy.reasonWindow.replace('{window}', saferWindow)}
          </li>
        </ul>
        <p className="text-caption text-fg-muted mt-3 font-medium">{copy.verdictNote}</p>
      </div>
    </div>
  )
}
```

**주의 (테스트와의 정합):** `>29<` 는 `aria-hidden` 시각 노드의 `{value.toFixed(0)}` 이 `<span aria-hidden="true" class="">29</span>` 로 렌더될 때 나온다. `cn(false)` 는 빈 문자열을 내므로 `class=""` 가 붙는다 — 테스트는 `>29<` 만 본다. `MetricBadge` 의 `className` 은 **레이아웃/전환 유틸리티만** 넘긴다(외형 덮기 아님).

- **Step 5: 통과 확인**

Run: `pnpm test src/features/about/about-specimens.test.ts`
Expected: PASS

- **Step 6: 커밋**

```bash
git add frontend/src/features/about/about-specimen-data.ts frontend/src/features/about/verdict-specimen.tsx frontend/src/features/about/about-specimens.test.ts
git commit -m "[FE] feat: 소개 페이지 예시 데이터와 히어로 판정 카드 카운트업 (#635)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `GoldenCurveSpecimen`(곡선 그리기)

**Files:**
- Create: `frontend/src/features/about/golden-curve-specimen.tsx`
- Modify: `frontend/src/features/about/about-specimens.test.ts` (describe 추가)

**Interfaces:**
- Produces: `GoldenCurveSpecimen()` — props 없음. 카드(제목 · 부제 · SVG · 범례 · 캡션)까지 그린다.

- **Step 1: 테스트 추가**

```ts
import { GoldenCurveSpecimen } from '@/features/about/golden-curve-specimen'

describe('GoldenCurveSpecimen — 골든타임 곡선', () => {
  const markup = renderToStaticMarkup(createElement(GoldenCurveSpecimen))

  it('그래프는 role=img + 한 문장 라벨이다', () => {
    expect(markup).toContain('role="img"')
    expect(markup).toContain(messages.about.specimen.curveAria)
  })

  it('정적 렌더는 다 그려진 상태다 — dashoffset 0', () => {
    expect(markup).toContain('stroke-dashoffset:0')
    expect(markup).not.toContain('stroke-dashoffset:1;')
  })

  it('노면 선만 등급 색이다 — 기온 선은 중립', () => {
    expect(markup).toContain('stroke-metric-critical-500')
    expect(markup).toContain('stroke-fg-muted')
  })

  it('추천 구간 면은 tint 층이다 — 글자를 얹지 않는 면', () => {
    expect(markup).toContain('fill-metric-high-100')
  })

  it('부제에 추천 구간이 치환돼 들어간다', () => {
    expect(markup).toContain(VERDICT_SPECIMEN.window)
    expect(markup).not.toContain('{window}')
  })
})
```

- **Step 2: 실패 확인**

Run: `pnpm test src/features/about/about-specimens.test.ts`
Expected: FAIL — 모듈 없음

- **Step 3: 구현**

`frontend/src/features/about/golden-curve-specimen.tsx`:

```tsx
'use client'

import { useRef, type CSSProperties } from 'react'

import { GOLDEN_CURVE_SPECIMEN, VERDICT_SPECIMEN } from '@/features/about/about-specimen-data'
import { useRevealOnce } from '@/features/about/use-reveal-once'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

const DRAW_MS = 800

/**
 * 골든타임 곡선 예시 (#635, 명세 §5-3 · §6-4).
 *
 * 선은 `pathLength=1` 위에서 `stroke-dashoffset` 1 → 0 으로 그려진다. **정적 렌더는 0(다
 * 그려짐)** 이고 `armed` 일 때만 1 이다 — JS 없이도 곡선이 보인다. 추천 구간 면은 선이 끝난
 * 뒤(800ms) 200ms 로 나타난다.
 *
 * SVG 속성 전환은 Tailwind 유틸리티가 없어 인라인 `style` 로 건다. 색은 유틸리티
 * (`stroke-*` · `fill-*`)다 — 노면 선만 `metric-critical-500`, 기온은 `fg-muted`, 추천 구간
 * 면은 `metric-high-100`(글자를 얹지 않는 tint 층).
 */
export function GoldenCurveSpecimen() {
  const ref = useRef<SVGSVGElement>(null)
  const phase = useRevealOnce(ref, true)
  const drawing = phase === 'armed'
  const copy = messages.about.specimen
  const data = GOLDEN_CURVE_SPECIMEN

  const lineStyle: CSSProperties = {
    strokeDasharray: 1,
    strokeDashoffset: drawing ? 1 : 0,
    transition: `stroke-dashoffset ${DRAW_MS}ms ease-out`,
  }

  return (
    <div className="bg-bg border-border -mx-4 border-y md:mx-0 md:rounded-lg md:border">
      <div className="px-4 pt-4 md:px-5">
        <p className="text-title-2 text-fg font-semibold">{copy.curveTitle}</p>
        <p className="text-caption text-fg-muted mt-1 font-medium">
          {copy.curveSub.replace('{window}', VERDICT_SPECIMEN.window)}
        </p>
      </div>
      <div className="px-4 pt-3 pb-4 md:px-5">
        <svg
          ref={ref}
          viewBox="0 0 360 150"
          className="block h-auto w-full"
          role="img"
          aria-label={copy.curveAria}
        >
          <rect
            x={data.windowX}
            y={8}
            width={data.windowWidth}
            height={118}
            rx={4}
            className={cn(
              'fill-metric-high-100 transition-opacity duration-200 ease-out',
              drawing && 'opacity-0',
            )}
            style={{ transitionDelay: drawing ? '0ms' : `${DRAW_MS}ms` }}
          />
          <g className="stroke-border" strokeWidth={1}>
            <line x1={12} y1={126} x2={348} y2={126} />
            <line x1={12} y1={86} x2={348} y2={86} strokeDasharray="3 4" />
            <line x1={12} y1={46} x2={348} y2={46} strokeDasharray="3 4" />
          </g>
          <g className="fill-fg-muted text-caption font-medium">
            {data.hours.map((hour) => (
              <text key={hour.label} x={hour.x} y={143}>
                {hour.label}
              </text>
            ))}
            <text x={330} y={42} textAnchor="end">
              50℃
            </text>
            <text x={330} y={82} textAnchor="end">
              30℃
            </text>
          </g>
          <path
            d={data.temperaturePath}
            pathLength={1}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            className="stroke-fg-muted"
            style={lineStyle}
          />
          <path
            d={data.pavementPath}
            pathLength={1}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            className="stroke-metric-critical-500"
            style={lineStyle}
          />
          <g
            className={cn('transition-opacity duration-150 ease-out', drawing && 'opacity-0')}
            style={{ transitionDelay: drawing ? '0ms' : `${DRAW_MS}ms` }}
          >
            <circle cx={data.peak.x} cy={data.peak.y} r={4} className="fill-metric-critical-500" />
            <text
              x={data.peak.x + 8}
              y={data.peak.y - 2}
              className="fill-metric-critical-700 text-caption font-bold"
            >
              {data.peak.label}
            </text>
          </g>
        </svg>
        <ul className="text-caption text-fg-muted mt-2 flex flex-wrap gap-x-4 gap-y-1.5 font-medium">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="bg-fg-muted inline-block h-0.5 w-3 rounded-sm" />
            {copy.curveLegendTemperature}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="bg-metric-critical-500 inline-block h-0.5 w-3 rounded-sm" />
            {copy.curveLegendPavement}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="bg-metric-high-100 inline-block h-2.5 w-3.5 rounded-sm" />
            {copy.curveLegendWindow}
          </li>
        </ul>
        <p className="text-caption text-fg-muted mt-3 font-medium">{copy.curveNote}</p>
      </div>
    </div>
  )
}
```

**주의:** `useRevealOnce` 의 제네릭이 `T extends Element` 라 `SVGSVGElement` ref 가 들어간다. React 는 `strokeDashoffset: 0` 을 `stroke-dashoffset:0` 으로 직렬화한다(단위 없음 — 테스트가 이 문자열을 본다).

- **Step 4: 통과 확인**

Run: `pnpm test src/features/about/about-specimens.test.ts`
Expected: PASS

- **Step 5: 커밋**

```bash
git add frontend/src/features/about/golden-curve-specimen.tsx frontend/src/features/about/about-specimens.test.ts
git commit -m "[FE] feat: 소개 페이지 골든타임 곡선 예시 — 선 그리기 800ms (#635)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `CongestionSpecimen`(막대) + `PlanSpecimen`(일자 탭)

**Files:**
- Create: `frontend/src/features/about/congestion-specimen.tsx`
- Create: `frontend/src/features/about/plan-specimen.tsx`
- Modify: `frontend/src/features/about/about-specimens.test.ts`

**Interfaces:**
- Produces: `CongestionSpecimen()` · `PlanSpecimen()` — props 없음. 둘은 **카드 안 `ex` 블록만** 그린다(카드 제목 · 설명은 Task 7 의 `about-view.tsx` 가 `Surface` 로 감싼다).

- **Step 1: 테스트 추가**

```ts
import { CONGESTION_SPECIMEN, PLAN_SPECIMEN } from '@/features/about/about-specimen-data'
import { CongestionSpecimen } from '@/features/about/congestion-specimen'
import { PlanSpecimen } from '@/features/about/plan-specimen'

describe('CongestionSpecimen — 한산한 날 막대', () => {
  const markup = renderToStaticMarkup(createElement(CongestionSpecimen))

  it('막대는 congestion 토큰이다 — 등급 색을 쓰지 않는다 (§2-3 #603)', () => {
    expect(markup.match(/bg-congestion-bar/g)?.length).toBe(CONGESTION_SPECIMEN.heights.length - 1)
    expect(markup.match(/bg-congestion-best/g)?.length).toBe(1)
    expect(markup).not.toContain('bg-metric-')
  })

  it('정적 렌더는 자라난 상태다 — scale-y-0 없음', () => {
    expect(markup).not.toContain('scale-y-0')
  })

  it('가장 한산한 날을 문장으로도 말한다 — 색만으로 전달하지 않는다', () => {
    expect(markup).toContain(CONGESTION_SPECIMEN.bestDate)
    expect(markup).toContain('role="img"')
  })
})

describe('PlanSpecimen — AI 일정 일자 탭', () => {
  const markup = renderToStaticMarkup(createElement(PlanSpecimen))

  it('탭은 tablist 이고 1일차가 선택돼 있다', () => {
    expect(markup).toContain('role="tablist"')
    expect(markup.match(/aria-selected="true"/g)?.length).toBe(1)
    expect(markup).toContain(PLAN_SPECIMEN[0].day)
  })

  it('1일차 항목 셋이 처음부터 보인다', () => {
    for (const item of PLAN_SPECIMEN[0].items) expect(markup).toContain(item.title)
  })

  it('다시 짜기 링크는 실제 화면이 아니라 예시 안 문구다 — a 태그가 아니다', () => {
    expect(markup).toContain(messages.about.specimen.planRegenerate)
    expect(markup).not.toContain('<a ')
  })
})
```

- **Step 2: 실패 확인**

Run: `pnpm test src/features/about/about-specimens.test.ts`
Expected: FAIL — 모듈 없음

- **Step 3: `CongestionSpecimen`**

`frontend/src/features/about/congestion-specimen.tsx`:

```tsx
'use client'

import { useRef } from 'react'

import { CONGESTION_SPECIMEN } from '@/features/about/about-specimen-data'
import { useRevealOnce } from '@/features/about/use-reveal-once'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

const GROW_MS = 400
const STAGGER_MS = 60

/**
 * 한산한 날 막대 예시 (#635, 명세 §5-4 b · §6-4).
 *
 * 막대는 `--congestion-bar`, 고른 날만 `--congestion-best` — 등급 스케일이 아니다(§2-3 #603,
 * 붐비는 날은 위험한 날이 아니라 사람 많은 날). 높이는 고정 %, `armed` 일 때 `scale-y-0`
 * 에서 자라나고 형제 60ms 지연. **고른 날의 진한 색은 마지막에** 붙는다 — 색 전환 지연을
 * 막대 전부가 끝난 뒤(7×60 + 400)로 둔다.
 */
export function CongestionSpecimen() {
  const ref = useRef<HTMLDivElement>(null)
  const phase = useRevealOnce(ref, true)
  const armed = phase === 'armed'
  const { heights, labels, bestIndex, bestDate } = CONGESTION_SPECIMEN
  const copy = messages.about.specimen
  const colorDelay = heights.length * STAGGER_MS + GROW_MS

  return (
    <div ref={ref}>
      <div role="img" aria-label={copy.congestionAria} className="flex h-16 items-end gap-1.5 px-0.5">
        {heights.map((height, index) => {
          const best = index === bestIndex
          return (
            <span
              key={labels[index]}
              className={cn(
                'block flex-1 origin-bottom rounded-t-sm transition-[transform,background-color] ease-out',
                armed && 'scale-y-0',
                best && !armed ? 'bg-congestion-best' : 'bg-congestion-bar',
              )}
              style={{
                height: `${height}%`,
                transitionDuration: `${GROW_MS}ms, 150ms`,
                transitionDelay: armed ? '0ms' : `${index * STAGGER_MS}ms, ${colorDelay}ms`,
              }}
            />
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5" aria-hidden>
        {labels.map((label, index) => (
          <span
            key={label}
            className={cn(
              'text-caption flex-1 text-center',
              index === bestIndex ? 'text-congestion-best font-bold' : 'text-fg-muted',
            )}
          >
            {label}
          </span>
        ))}
      </div>
      <p className="text-caption text-fg-muted mt-3 font-medium">
        {copy.congestionBest.replace('{date}', bestDate)}
      </p>
    </div>
  )
}
```

**주의:** `transition-[transform,background-color]` 는 Tailwind 의 **property 지정**이고 spacing arbitrary value 가 아니다 — `token-usage.test.ts` 가 보는 것은 `bg|text|border-` 색 리터럴과 spacing 이다. lint 의 arbitrary 금지 규칙이 이것을 잡으면 `transition` (모든 속성) 으로 바꾼다 — 동작은 같다. `text-congestion-best` 는 `--color-congestion-best` 매핑이 있어 유효하다(비텍스트 3:1 만 실측된 색이지만 12px **굵은** 요일 글자 하나이고 라벨 `aria-hidden` — 문장이 따로 `bestDate` 를 읽는다). `gap-1.5`(6) · `h-16`(64) · `mt-1.5`(6) · `mt-3`(12) · `px-0.5`(2) — **`px-0.5` 는 스케일 밖(2px)이다. `px-0.5` 를 지운다.**

- **Step 4: `PlanSpecimen`**

`frontend/src/features/about/plan-specimen.tsx`:

```tsx
'use client'

import { useState } from 'react'

import { PLAN_SPECIMEN } from '@/features/about/about-specimen-data'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * AI 일정 예시 — 일자 탭이 **실제로 눌린다** (#635, 명세 §5-4 c · §6-4). 자동 순환은 없다.
 * 고정 예시 3세트 사이만 오간다. `하루만 다시 짜기` 는 기능이 있다는 표시일 뿐 링크가 아니다 —
 * 예시 안에 실제 라우트를 심으면 "이 화면이 그 기능" 으로 읽힌다. 실제 진입은 절의
 * `AI 일정 만들기` 링크가 맡는다.
 *
 * URL `searchParams` 에 두지 않는다 — 필터가 아니라 그림의 페이지 넘김이다(architecture-guide §10 의 대상은 목록 필터·정렬·탭이고, 이 탭은 데이터에 영향이 없다).
 */
export function PlanSpecimen() {
  const [selected, setSelected] = useState(0)
  const copy = messages.about.specimen
  const day = PLAN_SPECIMEN[selected] ?? PLAN_SPECIMEN[0]

  return (
    <div>
      <div role="tablist" aria-label={copy.planTablistLabel} className="flex gap-1.5">
        {PLAN_SPECIMEN.map((entry, index) => {
          const active = index === selected
          return (
            <button
              key={entry.day}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`about-plan-panel-${index}`}
              id={`about-plan-tab-${index}`}
              onClick={() => setSelected(index)}
              className={cn(
                'text-caption inline-flex h-7 items-center rounded-full px-3 font-semibold transition-colors duration-150 ease-out',
                'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
                active ? 'bg-fg text-fg-inverse' : 'bg-band text-fg-muted hover:text-fg',
              )}
            >
              {entry.day}
            </button>
          )
        })}
      </div>
      <ul
        role="tabpanel"
        id={`about-plan-panel-${selected}`}
        aria-labelledby={`about-plan-tab-${selected}`}
        className="mt-2 grid"
      >
        {day.items.map((item, index) => (
          <li
            key={item.time}
            className={cn('flex gap-3 py-2', index > 0 && 'border-border border-t')}
          >
            <span className="text-body-2 text-fg-muted w-11 shrink-0 font-semibold tabular-nums">
              {item.time}
            </span>
            <span>
              <span className="text-body-2 text-fg block font-semibold">{item.title}</span>
              <span className="text-body-2 text-fg-muted block">{item.meta}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-body-2 text-link mt-2 font-semibold" aria-hidden>
        {copy.planRegenerate} →
      </p>
    </div>
  )
}
```

**주의:** 탭 높이 `h-7`(28) 은 스케일 밖처럼 보이지만 spacing 스케일은 **padding/margin/gap** 에 적용된다(token-usage 테스트가 훑는 유틸리티가 그것이다). `px-3`(12) · `py-2`(8) · `gap-1.5`(6) · `gap-3`(12) · `mt-2`(8) 는 스케일 안. `w-11`(44) 은 폭이다.

- **Step 5: 통과 확인**

Run: `pnpm test src/features/about`
Expected: PASS (reveal · specimens 전부)

- **Step 6: 커밋**

```bash
git add frontend/src/features/about/congestion-specimen.tsx frontend/src/features/about/plan-specimen.tsx frontend/src/features/about/about-specimens.test.ts
git commit -m "[FE] feat: 소개 페이지 혼잡 막대·AI 일정 탭 예시 (#635)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `IntroBand` + `AboutView` 8절 조립 + `page.tsx`

**Files:**
- Create: `frontend/src/features/about/intro-band.tsx`
- Rewrite: `frontend/src/features/about/about-view.tsx`
- Modify: `frontend/app/(main)/about/page.tsx`
- Rewrite: `frontend/src/features/about/about-view.test.ts`

**Interfaces:**
- Consumes: Task 1~6 전부 — `ButtonLink variant="inverse" | "inverseOutline"`, `messages.about.*`, `Reveal`, `VerdictSpecimen`, `GoldenCurveSpecimen`, `CongestionSpecimen`, `PlanSpecimen`, `*_SPECIMEN` 상수, `MetricBadge`, `Surface`, `INSET_CLASS`.
- Produces: `IntroBand({ tone: 'plain' | 'tint' | 'brand'; labelledBy: string; className?: string; children })`, `AboutView()`.

- **Step 1: 테스트 재작성**

`frontend/src/features/about/about-view.test.ts` 전체 교체:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SCALE_SPECIMEN } from '@/features/about/about-specimen-data'
import { AboutView } from '@/features/about/about-view'
import { REVEAL_HIDDEN_CLASS } from '@/features/about/reveal'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { readSourceWithoutComments } from '@/test/source'

/**
 * 서비스 소개 — `/about` (#611 → #635).
 *
 * **서버 컴포넌트라 통째로 렌더된다.** 안의 클라이언트 예시들은 초기 상태(끝 상태)로 그려진다
 * (`testing-guide.md` §1).
 */
const markup = renderToStaticMarkup(createElement(AboutView))
const hrefs = [...markup.matchAll(/href="([^"]*)"/g)].map((match) => match[1])

describe('AboutView — 출처 표기 (#611 의 존재 이유를 잃지 않는다)', () => {
  it('데이터 출처를 남긴다 — 푸터와 같은 다섯 곳', () => {
    expect(markup).toContain(messages.footer.sourcesLabel)
    for (const source of messages.footer.sources) expect(markup).toContain(source)
  })

  it('공모전 표기와 한계 안내를 남긴다', () => {
    expect(markup).toContain(messages.footer.contest)
    expect(markup).toContain(messages.footer.disclaimer)
  })

  it('출처·면책·공모전 문구를 messages.footer 에서 읽는다 — 다시 적지 않는다', () => {
    const source = readSourceWithoutComments('src/features/about/about-view.tsx')
    expect(source).toContain('messages.footer.sources')
    expect(source).toContain('messages.footer.disclaimer')
    expect(source).toContain('messages.footer.contest')
    for (const literal of messages.footer.sources) expect(source).not.toContain(`'${literal}'`)
  })
})

describe('AboutView — 8절 (#635)', () => {
  it('h1 이 보인다 — 히어로가 화면 제목이다', () => {
    const h1 = markup.match(/<h1[^>]*>/)?.[0] ?? ''
    expect(h1).not.toBe('')
    expect(h1).not.toContain('sr-only')
    expect(markup).toContain(messages.about.hero.heading)
  })

  it('질문 순서로 h2 가 선다', () => {
    const order = [
      messages.about.q1.heading,
      messages.about.q2.heading,
      messages.about.q3.heading,
      messages.about.q4.heading,
      messages.about.data.heading,
    ].map((heading) => markup.indexOf(heading))
    expect(order.every((position) => position > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('링크는 전부 실제 라우트다 — 갈 곳 있는 링크만', () => {
    expect(new Set(hrefs)).toEqual(new Set(['/', '/places', '/ai-plans/new', '/emergency', '/pets/new']))
  })

  it('최종값이 처음부터 DOM 에 있다', () => {
    for (const text of ['>29<', '>56.0<', '>31<', messages.about.specimen.verdictGrade]) {
      expect(markup).toContain(text)
    }
    expect(markup).toContain(messages.about.specimen.suitabilityGrade)
  })

  it('정적 마크업에 숨김 클래스가 없다 — JS 없이도 보인다', () => {
    for (const cls of [...REVEAL_HIDDEN_CLASS.split(' '), 'scale-y-0']) {
      expect(markup).not.toContain(cls)
    }
  })

  it('규모 숫자는 타일 한 곳에만 있다 — 같은 사실을 두 번 말하지 않는다', () => {
    expect(markup.match(new RegExp(String(SCALE_SPECIMEN.places), 'g'))?.length).toBe(1)
    expect(markup.match(new RegExp(String(SCALE_SPECIMEN.emergency), 'g'))?.length).toBe(1)
    expect(markup).toContain(messages.about.data.scaleNote)
  })

  it('등급 색은 예시 자리에만 — 절 제목·아이콘에 metric 이 없다', () => {
    const h2s = markup.match(/<h2[^>]*>/g) ?? []
    for (const h2 of h2s) expect(h2).not.toContain('metric-')
  })

  it('그림자를 쓰지 않는다', () => {
    expect(markup).not.toMatch(/\bshadow-(md|lg)\b/)
  })
})

describe('AboutView — 자리', () => {
  it('카드 안쪽 인셋을 INSET_CLASS.card 로 참조한다', () => {
    const source = readSourceWithoutComments('src/features/about/about-view.tsx')
    expect(source).toContain('INSET_CLASS.card')
    expect(markup).toContain(INSET_CLASS.card)
  })

  it('/about 을 보호 경로로 두지 않는다', () => {
    expect(readSourceWithoutComments('proxy.ts')).not.toContain('/about')
  })

  it('밴드 배경은 intro 토큰과 brand-700 이다 — brand-50/100 을 되살리지 않는다', () => {
    expect(markup).toContain('bg-intro-band')
    expect(markup).toContain('bg-brand-700')
    expect(markup).not.toMatch(/\bbg-brand-(50|100)\b/)
  })
})
```

- **Step 2: 실패 확인**

Run: `pnpm test src/features/about/about-view.test.ts`
Expected: FAIL (기존 뷰에 h1 sr-only · 링크 없음 등)

- **Step 3: `IntroBand`**

`frontend/src/features/about/intro-band.tsx`:

```tsx
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export type IntroBandTone = 'plain' | 'tint' | 'brand'

const TONE: Record<IntroBandTone, string> = {
  plain: 'bg-bg-sunken text-fg',
  tint: 'bg-intro-band text-fg',
  brand: 'bg-brand-700 text-fg-inverse',
}

/**
 * 소개 페이지 전폭 밴드 (#635, 명세 §6 · §7). **`Canvas` 안에서 전폭으로 서고 안쪽 내용만
 * 1152(`max-w-6xl`)다** — §0 "바닥은 전폭, 쌓기는 폭 안". 이 화면은 `SurfaceStack` 을 쓰지
 * 않는다. 밴드가 그 역할(세로 쌓기 · 간격)을 맡는다.
 *
 * 이름이 `Band` 가 아닌 이유: 2a 의 `Band`(8px 경계 밴드)는 폐기됐고(#475) 그 이름을 되살리면
 * 다른 것으로 읽힌다. 이 밴드는 경계가 아니라 **면**이다.
 *
 * 그린 밴드(`brand`)의 글자는 `--fg-inverse`(6.91:1). 안의 링크·버튼은 `inverse` 변형을 쓴다.
 */
export function IntroBand({
  tone,
  labelledBy,
  className,
  children,
}: {
  tone: IntroBandTone
  labelledBy: string
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={labelledBy} className={cn('w-full', TONE[tone])}>
      <div className={cn('mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-16 lg:px-10', className)}>
        {children}
      </div>
    </section>
  )
}
```

- **Step 4: `AboutView` 재작성**

`frontend/src/features/about/about-view.tsx` 전체 교체:

```tsx
import Link from 'next/link'
import type { ReactNode } from 'react'

import { BrandSymbol } from '@/components/brand/symbol'
import { Wordmark } from '@/components/brand/wordmark'
import { ButtonLink } from '@/components/button'
import { MetricBadge } from '@/components/metric'
import { Surface } from '@/components/surface'
import {
  EMERGENCY_ROWS_SPECIMEN,
  INDOOR_SPECIMEN,
  PLACE_ROWS_SPECIMEN,
  SCALE_SPECIMEN,
  WEATHER_SPECIMEN,
} from '@/features/about/about-specimen-data'
import { CongestionSpecimen } from '@/features/about/congestion-specimen'
import { GoldenCurveSpecimen } from '@/features/about/golden-curve-specimen'
import { IntroBand } from '@/features/about/intro-band'
import { PlanSpecimen } from '@/features/about/plan-specimen'
import { Reveal } from '@/features/about/reveal'
import { VerdictSpecimen } from '@/features/about/verdict-specimen'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 서비스 소개 — `/about` (#611 → #635).
 *
 * **서버 컴포넌트다.** 세션도 프리페치도 없고 백엔드를 부르지 않는다. 클라이언트 경계는
 * `Reveal` 과 예시 4개뿐이다 (명세 §6-4).
 *
 * 절은 보호자의 **질문 순서**다: 데려가도 돼요? → 지금 나가도 돼요? → 오늘 어디 가요? →
 * 위급하면? → 무엇을 보고 판단하나요. 앞은 보호자, 마지막은 심사자 몫이다 (명세 §2 · §4).
 *
 * **홈과 경쟁하지 않는다.** 예시는 전부 고정값이고 캡션이 그것을 밝힌다. 실제 판정은 홈이
 * 답하고, 이 화면은 홈으로 보낸다.
 *
 * **출처 · 면책 · 공모전 표기는 `messages.footer` 를 그대로 읽는다** — 데스크톱(푸터)과
 * 모바일(이 화면)에서 같은 데이터의 출처가 갈리지 않게.
 *
 * **보호 라우트가 아니다.** `proxy.ts` `PROTECTED_PATHS` 에 넣지 않는다. 보호 경로 링크
 * (`/ai-plans/new` · `/pets/new`)는 proxy 가 `returnTo` 를 붙이므로 바로 건다.
 *
 * **`h1` 이 보인다** — 히어로가 화면 제목이라 `h2` 는 `lg:` 에서 올라간다 (DESIGN.md §3-1 #358).
 */
export function AboutView() {
  const about = messages.about

  return (
    <>
      {/* ── 1. 히어로 ── */}
      <IntroBand
        tone="brand"
        labelledBy="about-hero-heading"
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:gap-16"
      >
        <div>
          {/*
            락업 — `(auth)` 셸과 같은 2배 크기(심볼 48 · 워드마크 40). 히어로에는 데이터가 없어
            로고가 첫 시선을 받아도 된다 (DESIGN.md §1 · §0-2). 워드마크는 currentColor 라
            밴드의 `text-fg-inverse` 를 물려받고, 심볼은 `inverse` 톤으로 뒤집는다.
          */}
          <div className="mb-6 inline-flex items-center gap-4" aria-hidden>
            <BrandSymbol size={48} tone="inverse" />
            <Wordmark height={40} />
          </div>
          <p className="text-caption flex items-center gap-2 font-semibold tracking-wide">
            <span aria-hidden className="bg-fg-inverse inline-block size-1.5 rounded-full" />
            {about.hero.eyebrow}
          </p>
          <h1
            id="about-hero-heading"
            className="text-display md:text-page mt-3 font-extrabold break-keep"
          >
            {about.hero.heading}
          </h1>
          <p className="text-body-1 mt-4 max-w-2xl font-normal break-keep opacity-90">
            {about.hero.sub}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/" variant="inverse">
              {about.hero.ctaPrimary}
            </ButtonLink>
            <ButtonLink href="/places" variant="inverseOutline">
              {about.hero.ctaSecondary}
            </ButtonLink>
          </div>
        </div>
        <VerdictSpecimen />
      </IntroBand>

      {/* ── 2. 데려가도 돼요? ── */}
      <IntroBand tone="plain" labelledBy="about-q1-heading" className="lg:grid lg:grid-cols-[5fr_7fr] lg:gap-10">
        <QuestionCopy
          id="about-q1-heading"
          kicker={about.q1.kicker}
          heading={about.q1.heading}
          lead={about.q1.lead}
          points={about.q1.points}
          href="/places"
          link={about.q1.link}
        />
        <Reveal className="mt-6 lg:mt-0">
          <Surface aria-label={about.specimen.placesAria} className="-mx-4 md:mx-0">
            <div className={cn('flex flex-wrap gap-1.5 pt-4', INSET_CLASS.card)}>
              <span className="bg-fg text-fg-inverse text-caption inline-flex h-7 items-center rounded-full px-3 font-semibold">
                {about.specimen.placesChip}
              </span>
              <span className="border-border-strong text-caption text-fg inline-flex h-7 items-center rounded-full border px-3 font-semibold">
                실내
              </span>
              <span className="border-border-strong text-caption text-fg inline-flex h-7 items-center rounded-full border px-3 font-semibold">
                운영 중
              </span>
            </div>
            <ul className={cn('pt-3 pb-4', INSET_CLASS.card)}>
              {PLACE_ROWS_SPECIMEN.map((row, index) => (
                <li
                  key={row.name}
                  className={cn('flex items-center gap-3 py-3', index > 0 && 'border-border border-t')}
                >
                  <span aria-hidden className="bg-band size-12 shrink-0 rounded-md" />
                  <div>
                    <p className="text-body-1 text-fg">{row.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {'unknown' in row && (
                        <span className="border-metric-unknown-500 text-caption text-fg-muted inline-flex h-5.5 items-center rounded-sm border border-dashed px-2 font-medium">
                          {about.specimen.unknownTag}
                        </span>
                      )}
                      {row.tags.map((tag) => (
                        <span key={tag} className="bg-band text-caption text-fg-muted inline-flex h-5.5 items-center rounded-sm px-2 font-medium">
                          {tag}
                        </span>
                      ))}
                      {'open' in row && (
                        <span className="bg-status-open-100 text-status-open-700 text-caption inline-flex h-5.5 items-center rounded-sm px-2 font-semibold">
                          운영 중
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className={cn('text-caption text-fg-muted pb-4 font-medium', INSET_CLASS.card)}>
              {about.specimen.placesNote}
            </p>
          </Surface>
        </Reveal>
      </IntroBand>

      {/* ── 3. 지금 나가도 돼요? ── */}
      <IntroBand tone="tint" labelledBy="about-q2-heading" className="lg:grid lg:grid-cols-[5fr_7fr] lg:gap-10">
        <QuestionCopy
          id="about-q2-heading"
          kicker={about.q2.kicker}
          heading={about.q2.heading}
          lead={about.q2.lead}
          points={about.q2.points}
          href="/"
          link={about.q2.link}
        />
        <Reveal className="mt-6 lg:mt-0">
          <GoldenCurveSpecimen />
        </Reveal>
      </IntroBand>

      {/* ── 4. 오늘 어디 가요? ── */}
      <IntroBand tone="plain" labelledBy="about-q3-heading">
        <QuestionCopy
          id="about-q3-heading"
          kicker={about.q3.kicker}
          heading={about.q3.heading}
          lead={about.q3.lead}
        />
        <div className="mt-6 grid gap-2 md:grid-cols-2 md:gap-6">
          <Reveal>
            <FeatureCard title={about.q3.cards.suitability.title} desc={about.q3.cards.suitability.desc}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-body-1 text-fg">협재 해수욕장</p>
                <MetricBadge tone="high">{about.specimen.suitabilityGrade}</MetricBadge>
              </div>
              <ul className="mt-3 grid gap-2">
                {about.specimen.suitabilityReasons.map((reason) => (
                  <li key={reason} className="text-body-2 text-fg flex gap-2">
                    <span aria-hidden className="bg-fg-muted mt-2 size-1.5 shrink-0 rounded-full" />
                    {reason}
                  </li>
                ))}
              </ul>
            </FeatureCard>
          </Reveal>
          <Reveal delay={60}>
            <FeatureCard title={about.q3.cards.congestion.title} desc={about.q3.cards.congestion.desc}>
              <CongestionSpecimen />
            </FeatureCard>
          </Reveal>
          <Reveal delay={120}>
            <FeatureCard
              title={about.q3.cards.aiPlan.title}
              tag={about.specimen.planAiTag}
              desc={about.q3.cards.aiPlan.desc}
            >
              <PlanSpecimen />
            </FeatureCard>
          </Reveal>
          <Reveal delay={180}>
            <FeatureCard title={about.q3.cards.indoor.title} desc={about.q3.cards.indoor.desc}>
              <div role="img" aria-label={about.specimen.weatherAria} className="flex gap-2">
                {WEATHER_SPECIMEN.map((day) => (
                  <div key={day.day} className="bg-band flex-1 rounded-md p-2 text-center">
                    <p className="text-caption text-fg-muted font-semibold">{day.day}</p>
                    <p className="text-title-2 leading-7">{day.icon}</p>
                    <p className="text-caption text-fg font-semibold">{day.temp}</p>
                  </div>
                ))}
              </div>
              <p className="text-body-2 text-fg mt-3 font-semibold">{about.specimen.indoorTitle}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {INDOOR_SPECIMEN.map((item) => (
                  <span key={item} className="bg-band text-caption text-fg-muted inline-flex h-5.5 items-center rounded-sm px-2 font-medium">
                    {item}
                  </span>
                ))}
              </div>
            </FeatureCard>
          </Reveal>
        </div>
        <MoreLink href="/ai-plans/new" className="mt-6">
          {about.q3.link}
        </MoreLink>
      </IntroBand>

      {/* ── 5. 위급하면? ── */}
      <IntroBand tone="tint" labelledBy="about-q4-heading" className="lg:grid lg:grid-cols-[5fr_7fr] lg:gap-10">
        <QuestionCopy
          id="about-q4-heading"
          kicker={about.q4.kicker}
          heading={about.q4.heading}
          lead={about.q4.lead}
          points={about.q4.points}
          href="/emergency"
          link={about.q4.link}
        />
        <Reveal className="mt-6 lg:mt-0">
          <Surface aria-label={about.specimen.emergencyAria} className="-mx-4 md:mx-0">
            <div className={cn('pt-4', INSET_CLASS.card)}>
              <p className="text-title-2 text-fg font-semibold">{about.specimen.emergencyTitle}</p>
              <p className="text-caption text-fg-muted mt-1 font-medium">{about.specimen.emergencySub}</p>
            </div>
            <ul className={cn('pt-3', INSET_CLASS.card)}>
              {EMERGENCY_ROWS_SPECIMEN.map((row, index) => (
                <li key={row.name} className={cn('flex items-center gap-3 py-3', index > 0 && 'border-border border-t')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-1 text-fg">{row.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="bg-status-open-100 text-status-open-700 text-caption inline-flex h-5.5 items-center rounded-sm px-2 font-semibold">
                        {row.status}
                      </span>
                      <span className="bg-band text-caption text-fg-muted inline-flex h-5.5 items-center rounded-sm px-2 font-medium">
                        {row.kind}
                      </span>
                    </div>
                  </div>
                  <span className="text-body-2 text-fg shrink-0 font-semibold tabular-nums">{row.distance}</span>
                </li>
              ))}
            </ul>
            <p className={cn('text-caption text-fg-muted pt-3 pb-4 font-medium', INSET_CLASS.card)}>
              {about.specimen.emergencyNote}
            </p>
          </Surface>
        </Reveal>
      </IntroBand>

      {/* ── 6. 무엇을 보고 판단하나요 (+ 7. 알아두실 점) ── */}
      <IntroBand tone="plain" labelledBy="about-data-heading">
        <QuestionCopy
          id="about-data-heading"
          kicker={about.data.kicker}
          heading={about.data.heading}
          lead={about.data.lead}
        />
        <div className="mt-6 grid grid-cols-3 gap-2 md:gap-6">
          <ScaleTile value={SCALE_SPECIMEN.places} label={about.data.scaleLabels.places} />
          <ScaleTile value={SCALE_SPECIMEN.emergency} label={about.data.scaleLabels.emergency} delay={60} />
          <ScaleTile value={SCALE_SPECIMEN.sources} label={about.data.scaleLabels.sources} delay={120} />
        </div>
        <p className="text-caption text-fg-muted mt-2 font-medium">{about.data.scaleNote}</p>
        <ol className="mt-6 grid gap-2 md:grid-cols-2">
          {about.data.rules.map((rule, index) => (
            <li key={rule}>
              <Reveal delay={index * 60}>
                <div className="bg-bg border-border flex items-start gap-3 rounded-lg border px-4 py-3">
                  <span aria-hidden className="bg-fg text-fg-inverse text-caption grid size-6 shrink-0 place-items-center rounded-full font-bold">
                    {index + 1}
                  </span>
                  <p className="text-body-2 text-fg font-medium">{rule}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid gap-2 md:grid-cols-2 md:gap-6">
          <Reveal>
            <Surface
              titleId="about-sources-heading"
              title={messages.footer.sourcesLabel}
              description={<p className="text-caption text-fg-muted font-medium">{about.data.sourcesDescription}</p>}
              className="-mx-4 md:mx-0"
            >
              <ul className={cn('pb-3', INSET_CLASS.card)}>
                {messages.footer.sources.map((source, index) => (
                  <li key={source} className={cn('text-body-2 text-fg flex items-center gap-2 py-2 font-semibold', index > 0 && 'border-border border-t')}>
                    <span aria-hidden className="bg-brand-500 size-2 shrink-0 rounded-sm" />
                    {source}
                  </li>
                ))}
              </ul>
              <p className={cn('text-caption text-fg-muted pb-5 font-medium', INSET_CLASS.card)}>
                {about.data.architecture}
              </p>
            </Surface>
          </Reveal>
          <Reveal delay={60}>
            <Surface titleId="about-notice-heading" title={about.notice.title} className="-mx-4 md:mx-0">
              <div className={cn('flex flex-col gap-2 pb-5', INSET_CLASS.card)}>
                <p className="text-body-2 text-fg-muted">{messages.footer.disclaimer}</p>
                <p className="text-caption text-fg-subtle font-medium">{messages.footer.contest}</p>
              </div>
            </Surface>
          </Reveal>
        </div>
      </IntroBand>

      {/* ── 8. 마무리 CTA ── */}
      <IntroBand tone="brand" labelledBy="about-cta-heading" className="grid gap-5">
        <div>
          <h2 id="about-cta-heading" className="text-title-1 lg:text-display font-bold break-keep lg:font-extrabold">
            {about.cta.heading}
          </h2>
          <p className="text-body-1 mt-2 font-normal break-keep opacity-90">{about.cta.sub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/" variant="inverse">
            {about.cta.primary}
          </ButtonLink>
          <ButtonLink href="/pets/new" variant="inverseOutline">
            {about.cta.secondary}
          </ButtonLink>
        </div>
      </IntroBand>
    </>
  )
}

/** 절 머리 — 표지어 · h2 · 리드 · (항목 · 링크). `points` 항목마다 `Reveal` 로 60ms 씩 등장 */
function QuestionCopy({
  id,
  kicker,
  heading,
  lead,
  points,
  href,
  link,
}: {
  id: string
  kicker: string
  heading: string
  lead: string
  points?: readonly string[]
  href?: string
  link?: string
}) {
  return (
    <div>
      <p className="text-caption text-link font-semibold tracking-wide">{kicker}</p>
      <h2 id={id} className="text-title-1 lg:text-display text-fg mt-1 font-bold break-keep lg:font-extrabold">
        {heading}
      </h2>
      <p className="text-body-1 text-fg-muted mt-2 max-w-2xl font-normal break-keep">{lead}</p>
      {points !== undefined && (
        <ul className="mt-5 grid gap-3">
          {points.map((point, index) => (
            <li key={point}>
              <Reveal delay={index * 60} className="flex items-start gap-3">
                <span aria-hidden className="bg-intro-tint text-brand-700 grid size-7 shrink-0 place-items-center rounded-md">
                  <span className="bg-brand-700 size-1.5 rounded-full" />
                </span>
                <p className="text-body-2 text-fg pt-1 break-keep">{point}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      )}
      {href !== undefined && link !== undefined && (
        <MoreLink href={href} className="mt-3">
          {link}
        </MoreLink>
      )}
    </div>
  )
}

/** 인라인 액션 링크 — `--link`, 터치 영역 44 */
function MoreLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center gap-1 font-semibold focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      {children} <span aria-hidden>→</span>
    </Link>
  )
}

/** 질문 3 의 하위 카드 — 제목(h3) · 설명 · 예시 블록. `Surface` 는 h2 를 그리므로 여기서는 제목 없이 쓰고 h3 를 직접 둔다 */
function FeatureCard({
  title,
  tag,
  desc,
  children,
}: {
  title: string
  tag?: string
  desc: string
  children: ReactNode
}) {
  return (
    <Surface className="-mx-4 h-full md:mx-0">
      <div className={cn('pt-4 pb-4', INSET_CLASS.card)}>
        <h3 className="text-title-2 text-fg font-semibold">
          {title}
          {tag !== undefined && (
            <span className="text-caption text-fg-muted ml-1.5 font-semibold">· {tag}</span>
          )}
        </h3>
        <p className="text-body-2 text-fg-muted mt-1 break-keep">{desc}</p>
        <div className="border-border mt-4 border-t pt-3">{children}</div>
      </div>
    </Surface>
  )
}

/** 규모 타일 — 중립 수치라 `--fg` 다. 등급 색을 쓰지 않는다 (§2-3) */
function ScaleTile({ value, label, delay = 0 }: { value: number; label: string; delay?: number }) {
  return (
    <Reveal delay={delay} className="bg-intro-tint rounded-lg p-4">
      <p className="text-display md:text-page text-fg font-black tabular-nums">
        {value}
        <span className="text-body-2 text-fg-muted ml-0.5 font-semibold">{messages.about.data.scaleUnit}</span>
      </p>
      <p className="text-caption text-fg-muted mt-1 font-semibold break-keep">{label}</p>
    </Reveal>
  )
}
```

**구현 시 주의 (스케일 · 토큰 가드):**
- `h-5.5`(22) · `size-1.5`(6) · `size-6`(24) · `size-7`(28) · `size-12`(48) · `ml-0.5`(2) 는 **크기**라 spacing 스케일 검사 대상이 아니다. **spacing(`p-` `m-` `gap-` `space-`) 만 스케일 안이어야 한다** — 위 코드의 `p-2 p-4 px-2 px-3 px-4 py-2 py-3 pt-1 pt-3 pt-4 pb-3 pb-4 pb-5 mt-1 mt-2 mt-3 mt-4 mt-5 mt-6 gap-1.5 gap-2 gap-3 gap-5 gap-8 gap-10 gap-16 -mx-4` 는 전부 `4 6 8 12 16 20 24 32 40 64` 안이다. **`ml-1.5`(6) 도 안.** `pt-1`(4) 안.
- `token-usage.test.ts` 가 실패하면 그 메시지의 파일 :: 리터럴을 보고 **값을 스케일 안으로 바꾼다**. baseline 에 추가하지 않는다.
- `grid-cols-[minmax(0,1fr)_400px]` · `grid-cols-[5fr_7fr]` 는 grid 템플릿 arbitrary 다. lint 가 arbitrary 를 전면 금지하면 `lg:grid-cols-12` + `lg:col-span-5` / `lg:col-span-7` 로 바꾸고, 히어로는 `lg:grid-cols-3` + 카피 `lg:col-span-2` 로 바꾼다.
- `협재 해수욕장` 하나가 뷰 안에 리터럴로 남는다 — 예시 장소명이라 `about-specimen-data.ts` 로 옮기고 싶으면 `SUITABILITY_SPECIMEN = { place: '협재 해수욕장' }` 를 추가해 참조한다. **데이터 파일에 두는 쪽을 택한다.**
- 링크 다섯 개는 전부 앱 안 라우트라 `MoreLink` 도 `next/link` 의 `Link` 다. 테스트는 `href="…"` 만 본다.
- 락업 `div` 에 `aria-hidden` 을 둔 이유: `Wordmark` 가 `role="img" aria-label="혼디가개"` 를 갖는데 바로 아래 `h1` 이 화면 제목이라 스크린리더가 "혼디가개" 를 한 번 더 읽을 필요가 없다. 헤더의 락업이 이미 사이트 이름을 말한다.

- **Step 5: `page.tsx`**

`frontend/app/(main)/about/page.tsx`:

```tsx
import { Canvas } from '@/components/surface'
import { AboutView } from '@/features/about/about-view'
import { messages } from '@/lib/messages'

export const metadata = {
  title: `${messages.about.title} · 혼디가개`,
  description: messages.about.description,
}

/**
 * 서비스 소개 — `/about` (#611 → #635).
 *
 * **보호 경로가 아니다.** `proxy.ts` `PROTECTED_PATHS` 에 넣지 않는다 — 심사자가 로그인 없이
 * 모바일로 둘러본다.
 *
 * **프리페치도 세션 조회도 없다.** 백엔드를 부르지 않는 정적 화면이라 `HydrationBoundary` 를
 * 두지 않는다.
 *
 * **`SurfaceStack` 을 쓰지 않는다.** 그린/연녹 밴드가 전폭이어야 해서(§0 "바닥은 전폭")
 * `Canvas` 바로 아래에 `IntroBand` 가 쌓인다. 안쪽 폭 1152 는 밴드가 갖는다.
 */
export default function AboutPage() {
  return (
    <Canvas as="main" id="main-content">
      <AboutView />
    </Canvas>
  )
}
```

- **Step 6: 테스트 · typecheck · lint**

Run: `pnpm test src/features/about && pnpm typecheck && pnpm lint`
Expected: 전부 PASS. `token-usage.test.ts` 도 돌려 본다: `pnpm test src/styles`

- **Step 7: 전체 테스트**

Run: `pnpm test`
Expected: PASS. `home-about-link.test.ts` · `site-footer.test.ts` 는 건드리지 않았으므로 그대로 통과해야 한다.

- **Step 8: 커밋**

```bash
git add frontend/src/features/about/intro-band.tsx frontend/src/features/about/about-view.tsx frontend/src/features/about/about-view.test.ts "frontend/app/(main)/about/page.tsx" frontend/src/features/about/about-specimen-data.ts
git commit -m "[FE] feat: /about 을 8절 소개 페이지로 다시 짠다 — 질문 3개 구조 (#635)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: 브라우저 검증

**Files:** 없음(검증만). 문제가 나오면 해당 Task 의 파일을 고치고 그 Task 의 커밋 메시지 형식으로 `fix` 커밋을 낸다.

- **Step 1: dev 서버**

`preview_start` 는 이 저장소에서 샌드박스에 막힌다(메모리). **Bash 백그라운드**로 띄운다. 5174 는 다른 워크트리가 쓸 수 있으므로 **5175** 를 쓴다(`/about` 은 카카오 지도를 쓰지 않아 도메인 미등록이 무관하다).

```bash
cd frontend && pnpm dev -p 5175
```

(run_in_background: true.) 준비되면 `curl -s -o /dev/null -w "%{http_code}" http://localhost:5175/about` 가 `200`.

- **Step 2: 375 — 가로 스크롤 0 · 숨김 없음**

브라우저 `navigate` → `http://localhost:5175/about`, `resize_window` 375×812, `javascript_tool`:

```js
({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
   hidden: document.querySelectorAll('.opacity-0').length,
   h1: getComputedStyle(document.querySelector('h1')).fontSize })
```

Expected: `sw === cw === 375`, `hidden === 0` **(히어로는 재생 뒤라 0. 아래 절은 아직 `armed` 라 0 이 아닐 수 있다 → 이때는 `document.querySelectorAll('[class*="opacity-0"]')` 이 전부 뷰포트 아래(`getBoundingClientRect().top > innerHeight`)인지 확인한다)**, `h1 === '28px'`.

- **Step 3: 카운트업 끝 값 고정**

로드 1.5초 뒤:

```js
[...document.querySelectorAll('[aria-hidden="true"]')].map(e => e.textContent).filter(t => /^(29|56\.0|31)$/.test(t)).length
```

Expected: `3` (끝 값 셋이 시각 노드에 있다).

- **Step 4: 1회 재생 · 등장 · 문서 높이 불변**

```js
const before = document.documentElement.scrollHeight
window.scrollTo(0, document.body.scrollHeight); await new Promise(r => setTimeout(r, 1200))
const after = document.documentElement.scrollHeight
window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 400))
({ before, after, stillHidden: document.querySelectorAll('.opacity-0, .scale-y-0').length,
   dashoffsetDrawn: [...document.querySelectorAll('path[pathLength]')].every(p => p.style.strokeDashoffset === '0') })
```

Expected: `before === after`, `stillHidden === 0`(끝까지 내렸으니 전부 revealed, 위로 올려도 다시 숨지 않음), `dashoffsetDrawn === true`.

**패널이 숨겨지면 rAF · IntersectionObserver 가 멈춘다**(메모리) — 브라우저 패널을 앞에 둔 상태로 잰다. 값이 이상하면 결함이 아니라 계측 함정인지 먼저 의심한다.

- **Step 5: 1280 — 히어로 2열 · 스크린샷**

`resize_window` 1280×900, 스크린샷(scale 0.6). 히어로가 좌 카피 · 우 예시 카드 2열인지, 그린 밴드가 전폭이고 안쪽 내용이 1152 캡인지 본다:

```js
({ band: document.querySelector('section').getBoundingClientRect().width,
   inner: document.querySelector('section > div').getBoundingClientRect().width })
```

Expected: `band === 1280` 근처(스크롤바 제외), `inner <= 1152`.

- **Step 6: reduced-motion**

브라우저 도구로 `prefers-reduced-motion` 을 에뮬레이션할 수 없으면 **코드 경로로 갈음한다**: `useCountUp` 이 `matchMedia('(prefers-reduced-motion: reduce)')` 를 보고 즉시 끝 값을 두는지(Task 4 코드), 전역 규칙이 `app/globals.css` 에 있는지(`pnpm test src/features/home/home-about-link.test.ts` 가 `readGlobalsCss` 로 같은 파일을 읽는다). 결과 보고에 **"에뮬레이션 불가 → 코드 경로 확인"** 이라고 적는다.

- **Step 7: 콘솔 오류 0**

`read_console_messages onlyErrors: true` → 빈 배열. hydration mismatch 경고가 있으면 **끝 상태 초기 렌더 규칙이 깨진 것**이다 — 어떤 컴포넌트가 서버/클라이언트 첫 렌더를 다르게 그리는지 찾아 고친다(`useState` 초기값이 `target` 인지, `phase` 초기값이 `'idle'` 인지).

- **Step 8: 서버 내리기**

`pkill -f "next dev -p 5175"` 또는 해당 백그라운드 태스크 종료. `resize_window preset: desktop`.

---

### Task 9: 문서 — 세부명세 · 인덱스 · 인벤토리

**Files:**
- Create: `frontend/docs/features/about/소개페이지-세부명세.md`
- Modify: `frontend/docs/features/_index.md` (상태 표에 `about` 행)
- Modify: `frontend/docs/screen-inventory.md` (§1 표 끝에 행)

- **Step 1: 세부명세**

`frontend/_DocumentTemplates/_template-세부명세.md` 의 D0~D9 절 구조를 그대로 쓴다. 내용은 설계 명세를 **옮기는 것**이고 창작하지 않는다.

```markdown
# 서비스 소개 세부 명세

> 정본 설계: `docs/superpowers/specs/2026-09-15-about-landing-design.md` (루트). 이 문서는 그 설계를 D-템플릿으로 옮긴 것이다. 갈리면 설계 문서가 이긴다.
> 이슈: #611(출처 표기용 신설) → #635(소개 페이지 확장)
> 목업: `docs/features/about/소개페이지-목업.html`

## D0. 화면 정의

- 경로 `/about`. **보호 경로가 아니다.** 미로그인 모바일 방문자(심사자 포함)가 대상이다.
- 역할: 서비스가 무엇을 판단하고 왜 믿을 수 있는지 한 화면에서 답하고 홈으로 보낸다. 홈과 경쟁하지 않는다 — 예시는 전부 고정값.
- 청중 우선순위: 첫 동반여행 보호자 → 여행 중 보호자 → 심사자(마지막 절).

## D1. 레이아웃

- 8절: 히어로(그린) · 데려가도 돼요?(바닥) · 지금 나가도 돼요?(연녹) · 오늘 어디 가요?(바닥) · 위급하면?(연녹) · 무엇을 보고 판단하나요 + 알아두실 점(바닥) · CTA(그린).
- 밴드는 `Canvas` 안 전폭, 안쪽 1152(`max-w-6xl`). `SurfaceStack` 없음.
- 375: 1단, 카드 전폭(`-mx-4`). 768: 하위 카드 2열. 1024: 히어로 2열(카피 | 예시 400), 질문 절 5:7.

## D2. 컴포넌트 구성

| 컴포넌트 | 경계 | 책임 |
| --- | --- | --- |
| `IntroBand` | 서버 | 전폭 밴드 + 1152 컨테이너, tone 3종 |
| `AboutView` | 서버 | 8절 조립, `QuestionCopy` · `FeatureCard` · `ScaleTile` · `MoreLink` |
| `Reveal` | 클라이언트 | 스크롤 등장 1회 |
| `VerdictSpecimen` | 클라이언트 | 카운트업 600ms + 배지 |
| `GoldenCurveSpecimen` | 클라이언트 | 선 그리기 800ms |
| `CongestionSpecimen` | 클라이언트 | 막대 400ms, 고른 날 색 마지막 |
| `PlanSpecimen` | 클라이언트 | 일자 탭 로컬 상태 |

## D3. 데이터 흐름

- 백엔드 호출 0. 프리페치 · 세션 조회 없음. 예시 값은 `features/about/about-specimen-data.ts`, 문구는 `messages.about`, 출처·면책·공모전은 `messages.footer` 재사용.
- 규모 숫자(315 · 214 · 5)는 README 설계 규모. 공개 API 가 총 개수를 주지 않아 실시간으로 셀 수 없다 → 캡션 `2026년 9월 적재 기준이에요`.

## D4. 상호작용

- 스크롤 등장: 뷰포트 하단 10% 진입 시 200ms, 형제 60ms. 로드 시 보이는 요소는 등장하지 않는다.
- 예시 재생: 진입 시 1회. 무한 반복 없음. `prefers-reduced-motion` 이면 즉시 끝 상태.
- AI 일정 탭: 눌러서 3세트 전환. 자동 순환 없음.
- 링크 5개: `/` `/places` `/ai-plans/new` `/emergency` `/pets/new`. 보호 경로는 proxy 가 `returnTo` 를 붙인다.

## D5. 상태별 화면

- 상태가 없다. JS 없이도 끝 상태로 보인다(정적 마크업에 숨김 클래스 없음).

## D6. 접근성

- `h1` 보임. `h2` 는 `lg:` 상향(#358). 절은 `section` + `aria-labelledby`.
- 그래프는 `role="img"` + 한 문장. 카운트업 중간값은 `aria-hidden`, 최종값은 `sr-only`.
- 등급·상태는 글자가 먼저(`위험` · `적합도 높음` · `진료중`).
- 그린 면 위 글자 `--fg-inverse` on `--brand-700` 6.91:1. 버튼 최소 44.

## D7. 테스트 케이스

- `about-view.test.ts` · `about-specimens.test.ts` · `reveal.test.ts` · `button-inverse.test.ts` · `contrast.test.ts`(intro 토큰) · `message-tone.test.ts`(개수 없음). 브라우저: 375 가로 스크롤 0 · 1회 재생 · scrollHeight 불변.

## D8. 미결 사항

- 규모 숫자 실측: 공개 API 가 총 개수를 주지 않는다. **선택지** ① README 값 유지 + 시점 캡션(채택) ② BE 에 집계 API 요청 ③ 숫자 삭제. 추천 ①.
- 만져 보는 예시(필터 칩 전환 · 곡선 문지르기)는 범위 밖(설계 §6-4 3단). 기온 슬라이더는 기각.

## D9. BE 후속 요청 (있으면)

- 없음. (D8 ② 를 택하면 `GET /places/count` 류 집계가 필요해지지만 지금은 요청하지 않는다.)
```

- **Step 2: `_index.md` 행**

`brand` 행 아래에:

```markdown
| about    | `소개페이지-세부명세.md`                                                                                        | 구현 완료                                     | 무관                 | `/about` 공개 소개 페이지 (#635). 정본 설계는 루트 `docs/superpowers/specs/2026-09-15-about-landing-design.md`. 백엔드 호출 없음  |
```

- **Step 3: `screen-inventory.md` 행**

§1 표(`비밀번호 관리` 행) 아래에:

```markdown
| 서비스 소개   | `/about`                            | —(백엔드 호출 없음)                                                          | **구현 완료** — 공개 경로. 8절 소개 + 예시 1회 재생 ([#635](https://github.com/8llow8llowMe/hondigagae/issues/635))              |
```

- **Step 4: 커밋**

```bash
git add frontend/docs/features/about/소개페이지-세부명세.md frontend/docs/features/_index.md frontend/docs/screen-inventory.md
git commit -m "[DOCS] docs: 서비스 소개 세부명세와 인덱스·인벤토리 행 (#635)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: 최종 검증 · PR 초안

**Files:** 없음(검증 · PR).

- **Step 1: 전체 검증**

Run (frontend/): `pnpm verify && pnpm format:check`
Expected: 전부 PASS. `format:check` 가 실패하면 `pnpm format` 뒤 **바뀐 파일이 이 이슈의 파일인지 확인하고 그 파일만** 스테이징해 `[FE] style: prettier` 커밋. 다른 세션의 파일이 잡히면 건드리지 않는다(메모리 — 포맷 실패는 실제 경로에서 확인).

- **Step 2: 변경 파일 수**

Run: `git diff --stat develop...HEAD | tail -1`
Expected: 30 파일 이내(문서 · 명세 포함 약 25). 넘으면 PR 본문에 이유를 적는다.

- **Step 3: 명세 상태 갱신**

`docs/superpowers/specs/2026-09-15-about-landing-design.md` 머리 `상태:` 를 `구현 완료 (#635)` 로. 커밋 `[DOCS] docs: 소개 페이지 명세 상태를 구현 완료로 (#635)`.

- **Step 4: PR 본문 초안**

`pr` 스킬(`.claude/skills/pr`)로 본문을 만든다. `Issue Number` 는 `#635`, 제목 `[FE] feat: /about 을 서비스 소개 페이지로 확장한다 — 질문 3개 구조 + 스크롤 등장·예시 재생`. 본문에 Task 8 의 스크린샷 요약(375 · 1280)과 검증 결과를 적는다.

- **Step 5: push 와 PR 생성은 사용자 확인 뒤**

`git push -u origin feature/fe/635-about-landing` 과 `gh pr create --assignee @me --label frontend-web --base develop` 은 **사용자가 "올려" 라고 한 뒤** 실행한다. pre-push 훅이 `format:check` 를 돌린다 — Step 1 에서 이미 통과했어야 한다.

---

## Self-Review 기록

- **명세 커버리지**: §5-1~5-8 절 → Task 7; §6-1/6-2 토큰·변형 → Task 1; §6-1 락업 → Task 1(`BrandSymbol tone="inverse"`, 실제 파일 `src/components/brand/symbol.tsx` · `wordmark.tsx`, `size 24|48` · `height 20|40` 열거 확인함) + Task 7 히어로 첫 블록; §6-4 모션 → Task 3~6; §7 반응형 → Task 7 클래스 + Task 8; §8 접근성 → Task 4~7 마크업 + Task 7 테스트; §9 → Task 7 주석; §10 검증 표 → Task 1(대비) · 2(개수) · 7(링크 · 숨김 · 최종값 · 등급 색 · 그림자 · 새 색) · 8(브라우저) · 10(verify); §11 문서 → Task 1(DESIGN) · 9(세부명세 · 인덱스 · 인벤토리). README 숫자는 실측 불가라 유지(D8).
- **플레이스홀더**: 없음. 코드 블록은 전부 실제 내용.
- **타입 정합**: `useRevealOnce<T extends Element>(ref, playIfVisible)` — Task 3 정의, Task 4(`HTMLDivElement`) · 5(`SVGSVGElement`) · 6(`HTMLDivElement`) 사용 일치. `REVEAL_HIDDEN_CLASS` — Task 3 export, Task 7 테스트 import. `messages.about.*` 키 — Task 2 정의와 Task 4~7 참조 일치(`specimen.verdictGrade` · `q1.points` · `data.scaleLabels.places` · `cta.primary` 등). `SCALE_SPECIMEN.places/emergency/sources` — Task 4 정의, Task 7 사용. `ButtonLink variant="inverse"|"inverseOutline"` — Task 1 정의, Task 7 사용. `IntroBand tone` — Task 7 안에서 정의·사용.
- **알려진 결정 지점(구현 중 판단)**: Task 6 `transition-[…]` 과 Task 7 `grid-cols-[…]` 가 lint 의 arbitrary 금지에 걸리면 대체 클래스로(각 Task 의 주의 참고). Task 7 `협재 해수욕장` 리터럴은 데이터 파일로.
