# 서비스 소개 페이지 — 스크롤 무대 · 첫 화면 리듬 · 만져 보는 예시 · 캐릭터 Implementation Plan

> **For agentic workers:** 이 계획은 이슈 네 개(= PR 네 개)로 나뉜다. PR 하나씩 순서대로 실행한다. 쓰기 역할은 한 번에 하나만 돌린다(루트 `CLAUDE.md`).

**Goal:** `/about` 에 스크롤 무대(#914) · 첫 화면 리듬(#915) · 만져 보는 예시(#916) · 반려견 캐릭터(#917)를 더한다. 절 구성과 문구는 그대로이고 백엔드는 부르지 않는다.

**Architecture:** 절 본문은 서버 컴포넌트로 남는다. 새 클라이언트 경계는 무대 래퍼(`ScrollStage`)와 장식 셋(`HeroParallax` · `SectionNav` · `ScrollProgressBar`), 숫자 하나(`ScaleCount`)다. 무대 단계는 두 길로 흐른다 — 서버 예시에는 래퍼의 **이름 클래스 플래그**(`globals.css` 한 블록), 클라이언트 예시에는 **React 컨텍스트**. 정적 렌더는 언제나 마지막 단계(전부 보임)이고 마운트 뒤 화면 아래인 무대만 0 으로 되감는다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript(`strict` + `exactOptionalPropertyTypes`) · Tailwind CSS v4 · Vitest(node 환경, `renderToStaticMarkup` 문자열 단언) · pnpm

**Spec:** `docs/superpowers/specs/2026-09-25-about-interactive-design.md`. 단계표는 §3-2, 캐릭터 자세표는 §6-3, 검증은 §10. **계획과 명세가 갈리면 명세를 따른다.** 절 문구의 정본은 여전히 `docs/superpowers/specs/2026-09-15-about-landing-design.md` §5 다.

## Global Constraints

- **`frontend/` 에서 `pnpm` 을 실행한다.** Node 20.19+ (`vitest` 가 20.12 미만에서 돌지 않는다).
- **`git add -A` · `git add .` · `git stash` 금지.** 경로를 하나씩 스테이징하고 커밋 전에 `git diff --cached --name-only` 로 본다 (`docs/git-workflow.md` §4-1).
- **커밋 prefix `[FE]`**(문서만이면 `[DOCS]`), 타입 `feat` / `test` / `docs` / `refactor`. 커밋 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **브랜치는 이슈마다 따로다.** `feature/fe/914-about-scroll-stage` → `feature/fe/915-about-hero-rhythm` → `feature/fe/916-about-touchable-specimens` → `feature/fe/917-about-character`. 앞 PR 이 머지된 뒤 develop 에서 딴다(스택 PR 은 Jenkins `pr-merge` 가 ERROR 다).
- **문구는 전부 해요체**(`message-tone.test.ts`). 금지어(`최고의` · `완벽한` · `강아지` · `애견` · `펫 프렌들리` · `여행 계획` · `플랜` · `스팟` · `여행 점수`). **새 문구는 `messages.about` 에만** 두고 뷰에 한국어를 박지 않는다. 개수(`\d+곳`)를 문구에 적지 않는다.
- **타이포 7단 토큰 · spacing 스케일 · arbitrary value 금지.** 대괄호 변형(`group-data-[…]:`)도 쓰지 않는다 — 조합 선택자는 `app/globals.css` 의 소개 페이지 블록에 이름 클래스로 둔다(`surface-list-2col` 선례).
- **새 색 · 새 그림자 · 새 duration 0개.** 쓰는 길이: 등장 200 · 형제 지연 60 · 색·투명도 150 · 카운트업 600 · 곡선 800 · 막대 400.
- **등급 색(`metric-*`)은 예시의 실제 등급 자리에만.** 캐릭터 · 절 내비 · 진행선에 쓰지 않는다. 기상특보 띠는 `metric-mid-*`(데이터 자리).
- **움직이는 속성은 `transform` · `opacity` · SVG `stroke-*` 뿐.** 문서 높이를 바꾸지 않는다.
- **끝 상태가 정본.** 정적 마크업에 숨김 클래스(`opacity-0` · `translate-y-3` · `scale-y-0`)가 없고, 무대 플래그는 전부 붙어 있다. 감속 모션이면 무대는 마지막 단계에 고정된다.
- **`/about` 은 보호 경로가 아니다.** `proxy.ts` 를 건드리지 않는다.
- **모든 파일 UTF-8(no BOM).**
- **검증:** Task 끝마다 `pnpm test <파일>`, PR 끝에 `pnpm verify` 와 `pnpm format:check`. 브라우저 실측은 **미리보기 창을 보이게 둔 상태**에서 한다(숨기면 `IntersectionObserver` 가 돌지 않는다).

---

## PR 1 · #914 스크롤 무대 — `feature/fe/914-about-scroll-stage`

### 파일

| 파일 | 책임 | Task |
| --- | --- | --- |
| `docs/superpowers/specs/2026-09-25-about-interactive-design.md` (생성) | 설계 명세 | 0 |
| `docs/superpowers/plans/2026-09-25-about-interactive.md` (생성) | 이 계획 | 0 |
| `docs/superpowers/specs/2026-09-15-about-landing-design.md` (수정) | 머리에 개정 포인터 한 줄 | 0 |
| `frontend/src/features/about/use-active-step.ts` (생성) | 가운데 띠에 든 항목 번호 | 1 |
| `frontend/src/features/about/use-active-step.test.ts` (생성) | 소스 가드(cleanup · 감속 · IO 부재) | 1 |
| `frontend/src/features/about/scroll-stage.tsx` (생성) | `ScrollStage` · `ScrollStagePoint` · `useStageStep` | 2 |
| `frontend/src/features/about/scroll-stage.test.ts` (생성) | 정적 마크업 = 마지막 단계 | 2 |
| `frontend/app/globals.css` (수정) | 소개 페이지 블록: `about-stage*` | 3 |
| `frontend/src/features/about/places-specimen.tsx` (수정) | 단계용 이름 클래스 | 4 |
| `frontend/src/features/about/emergency-specimen.tsx` (수정) | 단계용 이름 클래스 · 일정 진입 행 | 4 |
| `frontend/src/features/about/golden-curve-specimen.tsx` (수정) | `useStageStep` · 기상특보 띠 · 배지 | 5 |
| `frontend/src/features/about/about-specimen-data.ts` (수정) | 긴급 진입 행 예시값 | 4 |
| `frontend/src/lib/messages/about.ts` (수정) | `curveAlert` · `emergencyEntry` | 4·5 |
| `frontend/src/features/about/about-view.tsx` (수정) | 질문 1·2·위급 절을 무대로 조립 | 6 |
| `frontend/src/features/about/about-specimens.test.ts` (수정) | 새 요소 · 끝 상태 | 4·5 |
| `frontend/src/features/about/about-view.test.ts` (수정) | 무대 세 개 · 플래그 | 6 |
| `frontend/DESIGN.md` (수정) | §8 소개 페이지 줄 | 7 |
| `frontend/docs/features/about/소개페이지-세부명세.md` (수정) | D2 · D4 · D6 · D7 | 7 |

18 파일.

### Task 0: 명세 · 계획 커밋

- **Step 1:** 이 계획과 명세를 `[DOCS] docs: 소개 페이지 스크롤 무대·예시·캐릭터 설계와 계획을 적는다 (#914)` 로 먼저 커밋한다.
- **Step 2:** 선행 명세 머리 `> 상태:` 줄 아래에 한 줄을 더한다.

```md
> 개정: §6-4(모션) · §9(이미지 없음)는 `2026-09-25-about-interactive-design.md` 가 개정했다 (#914~#917).
```

### Task 1: `useActiveStep`

**Files:** Create `use-active-step.ts` · `use-active-step.test.ts`

**Interfaces:**

```ts
export function useActiveStep(count: number): {
  /** 1..count. 무대 밖(아직 안 들어옴)은 0. 감속 모션 · IO 부재 · 첫 렌더는 count */
  step: number
  /** 항목 index(1-based)의 ref 콜백 */
  register: (index: number) => (node: Element | null) => void
}
```

- **Step 1: 동작.** 첫 렌더는 `count`(끝 상태). 마운트 이펙트에서 ① `matchMedia('(prefers-reduced-motion: reduce)')` 이면 그대로 두고 끝, ② `IntersectionObserver` 가 없으면 끝, ③ 첫 항목이 뷰포트 절반 아래면 `0` 으로 되감고, ④ 항목 전부를 `rootMargin: '-45% 0px -45% 0px'` 로 관측해 `isIntersecting` 인 항목 index 를 `setStep` 한다. **뒤로 스크롤하면 내려간다** — `max` 로 누적하지 않는다.
- **Step 2: 무대 위쪽으로 빠져나갈 때.** 마지막 항목이 위로 빠져나가면(`boundingClientRect.top < 0` 이고 `!isIntersecting`) `count` 를 유지한다. 첫 항목이 아래로 빠져나가면 `0`.
- **Step 3: cleanup.** `observer.disconnect()`. StrictMode 이중 실행에서 관측이 두 번 걸리지 않는다.
- **Step 4: 테스트(소스 가드).** jsdom 이 없으므로 `reveal.test.ts` 의 방식대로 소스 문자열을 단언한다.

```ts
it('cleanup 에서 disconnect 한다', () => expect(src).toMatch(/observer\.disconnect\(\)/))
it('감속 모션이면 관측하지 않는다', () => expect(src).toContain('prefers-reduced-motion: reduce'))
it('IO 부재 가드가 있다', () => expect(src).toContain("typeof IntersectionObserver === 'undefined'"))
it('가운데 띠 rootMargin 이다', () => expect(src).toContain("'-45% 0px -45% 0px'"))
it('첫 상태는 count 다 — 정적 렌더가 끝 상태', () => expect(src).toMatch(/useState\(count\)/))
```

### Task 2: `ScrollStage` · `ScrollStagePoint`

**Files:** Create `scroll-stage.tsx` · `scroll-stage.test.ts`

**Interfaces:**

```tsx
'use client'
export function ScrollStage(props: {
  count: number
  className?: string
  /** 왼쪽 열 — ScrollStagePoint 들 */
  copy: ReactNode
  /** 오른쪽 열 — 예시. 1024 이상에서 sticky */
  visual: ReactNode
}): JSX.Element

export function ScrollStagePoint(props: { index: number; children: ReactNode }): JSX.Element

/** 무대 밖이면 null — 곡선 예시가 스스로 1회 재생하는 기존 경로로 돈다 */
export function useStageStep(): number | null
```

- **Step 1: 래퍼 클래스.** `about-stage` 와 `is-step-1 … is-step-{step}` 를 붙인다. `step === count` 면 전부 붙는다 — 정적 렌더가 그렇다.
- **Step 2: 항목.** `ScrollStagePoint` 는 `li` 를 그리고, `register(index)` 를 ref 로 건다. 켜짐은 `about-stage-point` + `is-on`(`index <= step`). **서버 컴포넌트 문장을 children 으로 받는다** — 문장 자체는 서버에 남는다.
- **Step 3: 컨텍스트.** `StageStepContext` 에 `step` 을 넣는다.
- **Step 4: 테스트.**

```ts
it('정적 마크업에 is-step-1..N 이 전부 있다', …)
it('정적 마크업의 항목이 전부 is-on 이다', …)
it('항목 문장이 li 안에 그대로 있다 — 순서가 끝 상태다', …)
it('visual 열에 about-stage-visual 이 있다 — sticky 는 CSS 가 준다', …)
```

### Task 3: `globals.css` 소개 페이지 블록

**Files:** Modify `frontend/app/globals.css` — 감속 모션 블록(`@media (prefers-reduced-motion: reduce)`) **바로 위**에 새 블록.

- **Step 1: 레이아웃.** 1024 이상에서 `.about-stage` 는 12열 그리드 5:7, `.about-stage-point` 는 `min-block-size: 58vh` · 세로 가운데 정렬, `.about-stage-visual` 은 `position: sticky; inset-block-start: calc(var(--header-h) + 1.5rem)`. 1024 미만은 흐름 그대로다.
- **Step 2: 항목 켜짐.** `.about-stage-point` 는 `opacity: .3`, `.is-on` 은 `1`, `transition: opacity 200ms ease-out`. 1024 미만은 `.45` → `1`.
- **Step 3: 예시 단계 선택자.** 서버 예시의 이름 클래스를 단계 플래그로 연다. 예:

```css
/* 질문 1 — 단계 1 전에는 칩이 없고 행이 흐리다 */
.about-stage:not(.is-step-1) .about-stage-chip { opacity: 0; transform: translateY(6px); }
.about-stage:not(.is-step-1) .about-stage-row { opacity: .35; }
/* 단계 2 에만 정보 없음 행 강조 */
.about-stage.is-step-2:not(.is-step-3) .about-stage-row-unknown { background: var(--row-selected); }
```

  **규칙:** "아직 안 온 단계" 를 `:not(.is-step-N)` 으로 숨긴다. 그래서 플래그가 전부 붙은 정적 렌더는 아무것도 숨기지 않는다 — 끝 상태가 CSS 기본값이다.
- **Step 4:** 이 블록에 색 리터럴을 쓰지 않는다(`var(--…)` 만). `token-usage.test.ts` 가 통과해야 한다.

### Task 4: 장소 · 긴급 예시에 단계 클래스

**Files:** Modify `places-specimen.tsx` · `emergency-specimen.tsx` · `about-specimen-data.ts` · `lib/messages/about.ts` · `about-specimens.test.ts`

- **Step 1: 장소.** 칩에 `about-stage-chip`, 행에 `about-stage-row`, `정보 없음` 행에 `about-stage-row-unknown`, 실내 · 운영 태그에 `about-stage-tag-live`. **외형 클래스는 그대로** — 이름 클래스는 선택자 훅일 뿐이다.
- **Step 2: 긴급.** 위치 점(새 요소, `aria-hidden`, `bg-brand-500` 원)에 `about-stage-locate`, 행에 `about-stage-erow`, 거리에 `about-stage-dist`, `진료중` 태그에 `about-stage-open`. 단계 0 에서 두 행이 `translateY` 로 자리를 바꿔 있다가 단계 1 에서 거리순으로 돌아온다 — **DOM 순서는 처음부터 거리순**이다.
- **Step 3: 일정 진입 행.** 긴급 예시 아래에 `2일차 · 가는 곳 주변 병원·약국` 행을 더한다(항목 3 "여행 일정 안에서도 한 번에 들어가요" 가 가리킬 그림). 링크가 아니다 — 예시 안이라 `div`. 문구는 `messages.about.specimen.emergencyEntry`, 일자 라벨은 상수.
- **Step 4: 테스트.** 새 행이 있고 `a` 가 아니다 · 두 시설이 거리순 DOM 이다 · 위치 점은 `aria-hidden` 이다.

### Task 5: 곡선 예시 — 단계 · 배지 · 기상특보 띠

**Files:** Modify `golden-curve-specimen.tsx` · `lib/messages/about.ts` · `about-specimens.test.ts`

- **Step 1: 두 경로.** `const stageStep = useStageStep()`. `null` 이면 지금의 `useRevealOnce` 1회 재생 그대로. 값이 있으면 단계로 그린다 — 선 그리기는 `stageStep >= 1` 로 들어갈 때 한 번(기존 `armed` 계약 그대로: 시작 프레임 transition 끔).
- **Step 2: 판정 배지.** 카드 제목 줄 오른쪽에 `MetricBadge tone="critical" axis="walkSafety"` 로 `위험`. 단계 2 전에는 `opacity-0` 가 아니라 **인라인 `style={{ opacity: 0 }}`** 로 숨긴다 — 정적 렌더에서는 `stageStep` 이 없어 인라인 스타일이 나가지 않는다(정적 마크업 단언과 충돌하지 않게).
- **Step 3: 기상특보 띠.** 범례 아래 `bg-metric-mid-100 text-metric-mid-700` 띠 한 줄, 문구 `messages.about.specimen.curveAlert = '폭염주의보가 발효되면 이것부터 알려요'`. 단계 4 전에는 투명.
- **Step 4: 테스트.** 배지 등급어가 `위험` · `metric-critical` 이다 · 기상특보 띠가 정적 마크업에 있다 · 띠는 `metric-mid` 이다 · 정적 마크업에 인라인 `opacity: 0` 이 없다.

### Task 6: 뷰 조립

**Files:** Modify `about-view.tsx` · `about-view.test.ts`

- **Step 1:** 질문 1 · 2 · 위급 절의 `lg:grid-cols-12` 조립을 `ScrollStage` 로 바꾼다. `QuestionCopy` 는 머리(표지어 · h2 · 리드)만 그리고, 항목은 `ScrollStagePoint` 로 `copy` 에 넣는다. 링크(`MoreLink`)는 항목 목록 뒤에 둔다.
- **Step 2:** 무대 안 예시는 `Reveal` 로 감싸지 않는다 — 무대가 등장을 대신한다(두 모션이 겹치면 단계 0 이 두 번 숨는다).
- **Step 3: 테스트.** `about-stage` 가 정확히 세 번 · 질문 3 과 데이터 절에는 없다 · 기존 단언(출처 · 링크 · 최종값 · 숨김 없음 · 그림자 없음 · 약관) 전부 통과.

### Task 7: 문서 · 실측

- **Step 1: DESIGN.md §8** 소개 페이지 줄 끝에 한 문장: "질문 절의 스크롤 무대(#914)는 1회 재생이 아니라 스크롤 위치의 함수다. 감속 모션이면 마지막 단계에 고정한다."
- **Step 2: 세부명세** D2(경계 표에 `ScrollStage`) · D4(단계표 포인터) · D6(무대는 `aria-live` 없음) · D7(테스트 수).
- **Step 3: 브라우저 실측** — 명세 §10 의 1024 무대 · 뒤로 스크롤 · 감속 모션 · `scrollHeight` 불변 · 375 가로 스크롤 0. 스크린샷을 PR 본문에 붙인다.
- **Step 4:** `pnpm verify` · `pnpm format:check`.

---

## PR 2 · #915 첫 화면 리듬 — `feature/fe/915-about-hero-rhythm`

### 파일

| 파일 | 책임 | Task |
| --- | --- | --- |
| `frontend/src/features/about/split-heading.tsx` (생성) | 어절 등장 h1 (서버) | 1 |
| `frontend/src/features/about/use-scroll-progress.ts` (생성) | 스크롤 y · 문서 진행률 | 2 |
| `frontend/src/features/about/hero-parallax.tsx` (생성) | 판정 카드 패럴랙스 · 스크롤 힌트 | 2 |
| `frontend/src/features/about/scroll-progress-bar.tsx` (생성) | 모바일 진행선 | 2 |
| `frontend/src/features/about/use-active-section.ts` (생성) | 현재 절 | 3 |
| `frontend/src/features/about/section-nav.tsx` (생성) | 절 내비 | 3 |
| `frontend/src/features/about/use-count-up.ts` (생성) | `verdict-specimen` 에서 옮김 | 4 |
| `frontend/src/features/about/scale-count.tsx` (생성) | 규모 숫자 | 4 |
| `frontend/src/features/about/verdict-specimen.tsx` (수정) | 훅 import 로 교체 | 4 |
| `frontend/app/globals.css` (수정) | `about-split-word` · `about-hero-fill` | 1 |
| `frontend/src/features/about/about-view.tsx` (수정) | 조립 | 5 |
| `frontend/src/lib/messages/about.ts` (수정) | `hero.scrollCue` · `nav.*` | 2·3 |
| `frontend/src/features/about/about-rhythm.test.ts` (생성) | 이 PR 의 단언 | 1–5 |
| `frontend/src/features/about/about-view.test.ts` (수정) | 규모 숫자 한 곳 · h1 이름 | 5 |
| `frontend/docs/features/about/소개페이지-세부명세.md` (수정) | D2 · D4 · D6 | 6 |

15 파일.

### Task 1: `SplitHeading` · 첫 화면 높이

- **Step 1:** 서버 컴포넌트. `text.split(' ')` 을 `span.about-split-word` 로 감싸고 `style={{ animationDelay: `${i * 60}ms` }}`. `h1` 에 `aria-label={text}`, 조각은 `aria-hidden`. 조각 사이 공백은 텍스트 노드로 남겨 `break-keep` 줄바꿈이 그대로 되게 한다.
- **Step 2:** `globals.css` 에 `@keyframes about-word-in { from { opacity: 0; transform: translateY(.875rem) } }` 와 `.about-split-word { display: inline-block; animation: about-word-in 200ms ease-out both }`. **정적 마크업에는 숨김 클래스가 없다** — 시작 상태는 keyframes 의 `from` 이다. 감속 모션은 전역 규칙이 한 프레임으로 줄인다.
- **Step 3:** `.about-hero-fill` 을 `@media (min-width: 64rem)` 안에서 `min-block-size: calc(100dvh - var(--header-h))`. 히어로 `IntroBand` 의 안쪽 그리드에 붙인다.

### Task 2: 스크롤 진행 · 패럴랙스 · 진행선 · 힌트

**Interfaces:** `useScrollProgress(): { y: number; progress: number }` — passive `scroll` + rAF 한 번, `progress = y / (scrollHeight - innerHeight)`. 감속 모션이면 `{ y: 0, progress }`(진행선은 남기고 패럴랙스는 멈춘다).

- **Step 1: `HeroParallax`.** 자식(판정 카드)을 감싸 1024 이상에서만 `transform: translateY(${-min(y, 900) * 0.12}px)`. 1024 판정은 `matchMedia` 한 번 + `change` 리스너.
- **Step 2: 스크롤 힌트.** 히어로 카피 아래 `messages.about.hero.scrollCue = '내려가며 질문 다섯 개에 답해요'` 와 아래 화살표 아이콘. 1024 이상에서만 보이고 `y > 40` 이면 `opacity` 0(150ms). 링크로 `#about-q1-heading` 절에 간다.
- **Step 3: `ScrollProgressBar`.** 1024 미만에서만. 헤더 아래 `fixed` 2px, `bg-brand-500`, `transform: scaleX(progress)` · `origin-left`. `aria-hidden`.

### Task 3: 절 내비

- **Step 1: `useActiveSection(ids)`.** 절 `section` 들을 `rootMargin: '-40% 0px -55% 0px'` 로 관측.
- **Step 2: `SectionNav`.** 1280 이상 `fixed` 왼쪽 가운데, `div` + `ul` + 링크 여섯. 라벨은 `messages.about.nav`(처음 · 질문 1 · 질문 2 · 질문 3 · 그리고 · 데이터). 현재 링크 `aria-current="true"` + 점 채움. 링크 높이 44.
- **Step 3:** 히어로 · 절 `section` 에 `id` 를 준다(`about-hero` · `about-q1` …). 기존 `aria-labelledby` 는 그대로.

### Task 4: 카운트업 공유

- **Step 1:** `verdict-specimen.tsx` 의 `useCountUp` 을 `use-count-up.ts` 로 옮기고 import 한다. 동작 · 주석 그대로(600ms 뒤 끝 값 고정 · 감속 모션 즉시 끝 값 · 처음 값은 target).
- **Step 2: `ScaleCount`.** `useRevealOnce(ref, false)` 가 `revealed` 가 되면 `useCountUp(value, true)`. 중간값은 `aria-hidden` 노드, 최종값은 `sr-only` — 판정 카드와 같은 계약.

### Task 5: 조립 · 테스트

- **Step 1:** 히어로 `h1` → `SplitHeading`, 판정 카드 → `HeroParallax`, `ScaleTile` 숫자 → `ScaleCount`, 페이지 끝에 `SectionNav` · `ScrollProgressBar`.
- **Step 2: `about-rhythm.test.ts`.** h1 의 `aria-label` 이 원문 · 조각이 `aria-hidden` · 지연이 60ms 간격 · 정적 마크업에 숨김 클래스 없음 · 절 내비가 `nav` 가 아니다 · 링크 여섯이 실제 절 id 를 가리킨다 · 규모 최종값이 `sr-only` 로 처음부터 있다 · 새 `duration-` 값 없음.

### Task 6: 문서 · 실측

- **Step 1:** 세부명세 D2 · D4 · D6.
- **Step 2: 실측.** 1280 절 내비 활성 전환 · 1024 패럴랙스 · 375 진행선 · 감속 모션에서 즉시 끝 상태 · 가로 스크롤 0.
- **Step 3:** `pnpm verify` · `pnpm format:check`.

---

## PR 3 · #916 만져 보는 예시 — `feature/fe/916-about-touchable-specimens`

### 파일

| 파일 | 책임 | Task |
| --- | --- | --- |
| `frontend/src/features/about/places-specimen.tsx` (수정) | 칩 토글 → 클라이언트 | 1 |
| `frontend/src/features/about/golden-curve-specimen.tsx` (수정) | 시각 핸들 · 읽기 줄 | 2 |
| `frontend/src/features/about/congestion-specimen.tsx` (수정) | 막대 버튼 · 툴팁 | 3 |
| `frontend/src/features/about/plan-specimen.tsx` (수정) | 다시 짜기 버튼 · 진행 단계 · 대체 세트 | 4 |
| `frontend/src/features/about/about-specimen-data.ts` (수정) | `GOLDEN_CURVE_HOURLY` · `CONGESTION_SPECIMEN.dates/levels` · `PLAN_ALT_SPECIMEN` | 2–4 |
| `frontend/src/lib/messages/about.ts` (수정) | 핸들 라벨 · 읽기 줄 · 진행 단계 · 캡션 | 1–4 |
| `frontend/src/features/about/about-specimens.test.ts` (수정) | 조작 요소 단언 | 1–4 |
| `frontend/docs/features/about/소개페이지-세부명세.md` (수정) | D4 · D8(3단 해제) | 5 |

8 파일.

### Task 1: 필터 칩

- **Step 1:** `'use client'`. `실내` · `운영 중` 칩을 `button` + `aria-pressed` 로. 상태 `{ indoor: boolean; open: boolean }`.
- **Step 2:** 조건에 안 맞는 행에 `opacity-30`(`transition-opacity duration-150`). **행을 지우지 않는다.** `unknown` 행은 `indoor` 가 켜지면 흐려진다.
- **Step 3:** 첫 칩(`내 반려견 기준 · 소형 · 7kg`)은 선택된 상태로 고정된 표시이고 버튼이 아니다.
- **Step 4: 테스트.** 두 칩이 `aria-pressed="false"` 버튼 · 첫 칩은 버튼이 아니다 · 정적 마크업에 `opacity-30` 없음 · 칩 높이 44.

### Task 2: 곡선 시각 핸들

- **Step 1: 데이터.** `GOLDEN_CURVE_HOURLY: readonly { temp: number; pavement: number }[]`(24개). 곡선 path 와 같은 장면이어야 한다 — **06–08시는 노면 40℃ 미만(안전), 12시 봉우리가 `VERDICT_SPECIMEN.pavement`(56.0)**. 테스트가 이 두 가지를 잠근다.
- **Step 2: 판정.** 등급 경계는 **데이터 파일의 예시 상수**(`HOURLY_GRADE_EDGES = { caution: 40, danger: VERDICT_SPECIMEN.pavementThreshold }`)다. 서버 판정식을 흉내 내는 것이 아니라 표에 붙인 라벨이다 — 파일 주석에 그렇게 적는다.
- **Step 3: UI.** SVG 아래 `<label>` + `input type="range" min=0 max=23 step=1`(기본 12). 입력하면 세로 점선 · 점이 그 시각 x(`12 + h × 15`)로 가고, 점의 y 는 노면 path 위(`getPointAtLength` 이분 탐색, 마운트 뒤 계산). 읽기 줄은 `aria-live="polite"` — `07:00 · 기온 24℃ · 노면 26.0℃` + `MetricBadge axis="walkSafety"`.
- **Step 4:** 핸들을 만지면 `onGrade(grade)` 를 컨텍스트나 상태로 노출한다(#917 의 자세가 읽는다). 이 PR 에서는 상태만 두고 소비자는 없다.
- **Step 5: 테스트.** 라벨이 있는 range · 기본값 12 · 06–08시 안전 · 12시 = 56.0 · 표 길이 24 · 읽기 줄 `aria-live`.

### Task 3: 혼잡도 툴팁

- **Step 1:** 막대를 `button`(`aria-label="9월 18일(목) · 가장 한산"`)으로. hover · focus-visible · 탭한 막대에 툴팁. 첫 · 마지막 막대의 툴팁은 가장자리에 붙인다(375 가로 넘침 방지 — 시안에서 2px 넘쳤다).
- **Step 2: 테스트.** 막대 일곱이 버튼 · 라벨이 날짜와 수준 · 가장 한산한 날 문장은 그대로.

### Task 4: 다시 짜기 시연

- **Step 1:** `하루만 다시 짜기` 를 `button` 으로. 누르면 진행 단계 셋(`장소 후보를 고르고 있어요` · `동선을 맞추고 있어요` · `준비물을 붙이고 있어요`, 500ms 씩, `aria-live="polite"`)을 지나 1일차가 `PLAN_ALT_SPECIMEN` 으로 바뀐다. 다시 누르면 원래 세트. 진행 중에는 `disabled`.
- **Step 2:** 새 항목은 60ms 간격 200ms 로 올라온다(기존 길이). 감속 모션이면 진행 단계를 건너뛴다.
- **Step 3:** 패널 아래 캡션 `planRegenerateNote = '화면 예시예요. 실제로는 서버가 다시 짜요.'`.
- **Step 4: 테스트.** 기존 "다시 짜기는 a 태그가 아니다" 단언을 "button 이고 a 가 아니다" 로 바꾼다 · 캡션이 있다 · 대체 세트가 같은 데이터 파일의 상수다.

### Task 5: 문서 · 실측

- **Step 1:** 세부명세 D4 에 조작 넷, D8 에서 "만져 보는 예시는 범위 밖" 을 걷고 "3단 해제(#916)" 로.
- **Step 2: 실측.** 칩 토글 전후 `scrollHeight` 불변 · 핸들 키보드(화살표 · Home · End) · 막대 탭 · 다시 짜기 · 375 가로 스크롤 0.
- **Step 3:** `pnpm verify` · `pnpm format:check`.

---

## PR 4 · #917 캐릭터 — `feature/fe/917-about-character`

### 파일

| 파일 | 책임 | Task |
| --- | --- | --- |
| `frontend/public/illustrations/about/*.png` (생성 6) | 캐릭터 에셋 | 1 |
| `frontend/src/features/about/about-character.tsx` (생성) | 에셋 표 · `HeroDog` · `CtaDog` | 2 |
| `frontend/src/features/about/curve-pose.tsx` (생성) | 질문 2 자세 스택 | 3 |
| `frontend/src/features/about/golden-curve-specimen.tsx` (수정) | 자세 스택 배치 · 카드 위 여백 | 3 |
| `frontend/src/features/about/about-view.tsx` (수정) | 히어로 · 마무리 배치, 마무리 7:5 | 2 |
| `frontend/app/globals.css` (수정) | 자세 스택 크기 변수 | 3 |
| `frontend/src/features/about/about-character.test.ts` (생성) | 세 자리 · 접근성 · 색 | 4 |
| `frontend/DESIGN.md` (수정) | §0-2 캐릭터 행 | 5 |
| `frontend/docs/hondi_img/README.md` (수정) | 미결 포인터 | 5 |
| `frontend/docs/features/about/소개페이지-세부명세.md` (수정) | D2 · D6 | 5 |

15 파일(에셋 6 포함).

### Task 1: 에셋

- **Step 1:** 시안에서 자른 투명 PNG 여섯을 `frontend/public/illustrations/about/` 에 둔다: `dog-sit-lookup` · `dog-leash` · `dog-stand` · `dog-hot` · `heat-lines` · `dog-sit-front`. 파일마다 알파 채널이 있는지 `sips -g hasAlpha` 로 확인한다.
- **Step 2: 검수(명세 §6-4).** 외곽선 · 그라디언트 없음 · 보이는 발가락 3개 · 개 몸에 등급 색 없음 · 옆 칸 조각(코 · 꼬리) 없음. 시안에서 두 번 걸린 것이 옆 칸 조각이다 — 사분면을 반으로 자르지 말고 가장 큰 연결 덩어리만 남기는 방식으로 자른다.

### Task 2: 히어로 · 마무리

- **Step 1: `about-character.tsx`.** 에셋 표 `CHARACTER = { sitLookup: { src, width, height }, … } as const`. `next/image` 로 그리고 `alt=""`, 감싸는 `span` 에 `aria-hidden`.
- **Step 2: 히어로.** 판정 카드 열을 `relative` 로 두고 개를 `absolute` 로 카드 왼쪽 아래(모바일 폭 96 · 1024↑ 150, 1024↑ 에서 카드 왼쪽 바깥으로 104). #915 가 들어와 있으면 제목 어절 등장 뒤 500ms 에 한 번 올라온다(`about-split-word` 와 같은 keyframes, 지연만 다르게).
- **Step 3: 마무리.** 1024↑ 에서 CTA 안쪽을 12열 7:5 로 바꾸고 오른쪽 열 가운데에 정면 앉기(폭 136), `align-self: end` + 절 아래 패딩만큼 음수 여백으로 **절 끝선에 발을 댄다**. 모바일은 버튼 아래 오른쪽(폭 96–120).

### Task 3: 질문 2 자세 스택

- **Step 1: `CurvePose`.** 세 장(산책 · 서기 · 앞발)을 코끝(오른쪽) 기준으로 겹치고, 열기 선을 앞발 아래에 둔다. 폭 변수 `--about-pose-w`(모바일 150 · 1024↑ 196). 각 장의 폭은 같은 축척 비율(산책 .936 · 서기 .904 · 앞발 .981). 자세는 `data-pose` 로 고르고 `opacity` 150ms.
- **Step 2: 자세 결정(명세 §6-3).** `useStageStep()` 과 #916 의 핸들 판정 중 **마지막 사건**이 이긴다. 정적 렌더는 `hot`.
- **Step 3: 배치.** 곡선 카드 `relative`, 스택은 `absolute; bottom: 100%; right: 20px` 로 **카드 윗변 위**에 선다. 카드를 감싼 열에 `padding-top: calc(var(--about-pose-w) * .87)` — 무대 sticky 에서도 개가 헤더 아래로 들어가지 않는다.
- **Step 4:** 열기 선은 `hot` 일 때만 `opacity` 1 · `translateY(0)`(200ms).

### Task 4: 테스트

`about-character.test.ts`:

```ts
it('illustrations/about/ 참조가 히어로 · 질문 2 · 마무리 세 곳에만 있다', …)
it('캐릭터 이미지는 alt 가 비어 있고 부모가 aria-hidden 이다', …)
it('캐릭터 래퍼에 metric- 클래스가 없다 — 등급 색을 칠하지 않는다', …)
it('정적 렌더의 질문 2 자세는 hot 이고 열기 선이 보인다', …)
it('에셋 표의 width/height 가 실제 파일 치수와 같다', …) // PNG IHDR 를 읽는다
it('정적 마크업에 숨김 클래스가 없다', …)
```

### Task 5: 문서 · 실측

- **Step 1: DESIGN.md §0-2** 표에 행 하나: "캐릭터 일러스트 | 히어로 · 질문 2 · 마무리 세 자리, 카드 밖 | 등급 색을 칠하지 않는다 · 반복 없음 · 다른 화면은 쓰지 않는다".
- **Step 2: `hondi_img/README.md`** 미결 "견종 일러스트" 에 "소개 페이지 캐릭터가 첫 사례다(#917) — 벡터화는 후속" 한 줄.
- **Step 3: 세부명세** D2 · D6.
- **Step 4: 실측.** 1280 · 1024 · 375 에서 세 자리 발 위치(카드 윗변 · 절 끝선과 같은 y) · 질문 2 단계별 자세 · 핸들 07 · 10 · 13시 자세 · 375 가로 스크롤 0.
- **Step 5:** `pnpm verify` · `pnpm format:check`.
- **Step 6:** 벡터화 후속 이슈를 만든다(명세 §12).

---

## 머지 뒤

- 이슈마다 체크박스를 갱신하고 `gh issue close` 로 닫는다 — PR 본문의 `Issue Number` 는 이슈를 자동으로 닫지 않는다.
- 네 PR 이 모두 머지되면 설계 명세 머리 상태 줄을 `> 상태: **구현 완료** (#914 · #915 · #916 · #917, YYYY-MM-DD)` 로 바꾼다.
