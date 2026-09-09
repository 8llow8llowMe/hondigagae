# 콘텐츠 최대폭 1440 컨테이너 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 넓은 화면에서 본문이 무한히 자라지 않도록 `--content-max: 1440px` 컨테이너를 도입하고, 레일 레이아웃·헤더·레일 밖 형제를 같은 세로 경계에 세운다. 지도 화면은 전폭을 유지한다.

**Architecture:** `globals.css` 에 `.content-container, .rail-layout` 한 규칙으로 캡을 둔다. 캡이 필요한 곳이 여럿이라 값이 갈라지면 좌우 경계가 어긋나므로 셀렉터를 한 규칙에 모은다. 지도 화면은 `.rail-layout` 을 붙이지 않는 기존 구조 그대로 두면 자동으로 전폭이라 예외 코드가 없다.

**Tech Stack:** Next.js App Router · Tailwind v4 · CSS 커스텀 프로퍼티 · vitest (node 환경 + 소스/CSS 문자열 assertion)

**Spec:** `docs/superpowers/specs/2026-09-09-content-max-width-design.md`

**이슈:** #376 · **브랜치:** `refactor/fe/376-content-max-width` · **워크트리:** `/Users/seonghoho/Documents/projects/hondigagae-376`

## Global Constraints

- 모든 파일은 **UTF-8 (no BOM)**.
- **작업 트리를 다른 세션과 공유한다.** `git add -A` / `git add .` / `git stash` 를 쓰지 않는다 — 경로를 하나씩 적어 스테이징한다.
- 커밋 prefix 는 `[FE]`, 형식은 `[FE] refactor: 요약`. 본문에 `Issue Number: #376`.
- **Tailwind arbitrary 로 캡하지 않는다.** `max-w-[var(--content-max)]` 는 `eslint.config.mjs` 의 `noComplexArbitrary`(셀렉터 `Literal[value=/\[[^\]]*\([^\]]*\)[^\]]*\]/]`)에 걸린다. 이름 있는 클래스를 `app/globals.css` 에 둔다.
- **`DESIGN.md` 는 `frontend/` 안이라 CI `format:check` 대상이다.** 표를 고치면 `npx prettier --write DESIGN.md` 로 정렬을 맞춘다. (루트 `docs/` 는 대상이 아니다.)
- 명령은 모두 `frontend/` 에서 실행한다. 테스트 파일은 `.ts` 여야 한다 (`vitest.config.mts` 의 `include`).
- **375px 에서 가로 스크롤이 생기면 버그다** (`DESIGN.md` §7).

---

### Task 1: `--content-max` 토큰과 캡 규칙

**Files:**
- Modify: `frontend/src/styles/tokens.css`
- Modify: `frontend/app/globals.css`
- Modify: `frontend/DESIGN.md`
- Create: `frontend/src/styles/content-max.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 작업)
- Produces: CSS 토큰 `--content-max` (값 `1440px`), CSS 클래스 `.content-container` — Task 2·3 이 이 클래스명을 그대로 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`frontend/src/styles/content-max.test.ts` 를 새로 만든다.

```ts
import { describe, expect, it } from 'vitest'

import { readDesignMd, readGlobalsCss, readTokensCss } from '@/test/tokens'

/**
 * 콘텐츠 컨테이너 회귀 검사 — 이슈 #376.
 *
 * `token-sync.test.ts` 는 **색 토큰만** 본다. 레이아웃 토큰은 기계 동기 대상이 아니라
 * `tokens.css` 와 `DESIGN.md` 가 조용히 갈라질 수 있다. 여기서 그 갈라짐을 잡는다.
 */

const tokens = readTokensCss()
const globals = readGlobalsCss()
const design = readDesignMd()

describe('콘텐츠 컨테이너 — 토큰 (#376)', () => {
  it('--content-max 가 1440px 로 선언돼 있다', () => {
    expect(tokens).toMatch(/--content-max:\s*1440px;/)
  })

  it('1584 에서 레일을 480 으로 넓히던 규칙이 남아 있지 않다', () => {
    // 컨테이너가 1440 에서 멈추므로 99rem(1584) 미디어쿼리는 발동할 수 없다
    expect(tokens).not.toMatch(/--rail-context:\s*480px/)
    expect(tokens).not.toContain('99rem')
  })

  it('--rail-context 는 400 고정이다', () => {
    expect(tokens).toMatch(/--rail-context:\s*400px;/)
  })
})

describe('콘텐츠 컨테이너 — 캡 규칙 (#376)', () => {
  const rule = globals.match(/^\.content-container,\s*\n\.rail-layout\s*\{[^}]*\}/m)?.[0]

  it('.content-container 와 .rail-layout 이 한 규칙에서 캡된다', () => {
    // 값이 두 군데로 갈라지면 헤더 내용과 본문의 좌우 경계가 어긋난다
    expect(rule).toBeDefined()
  })

  it('토큰으로 캡한다 — 리터럴 1440 을 다시 적지 않는다', () => {
    expect(rule).toContain('max-inline-size: var(--content-max)')
    expect(rule).toContain('margin-inline: auto')
  })

  it('캡 규칙이 @media 밖 최상위에 있다', () => {
    /*
      헤더는 lg 미만에서도 이 클래스를 쓰고, 레일의 grid 선언만 lg 안에 남는다.
      최상위 규칙은 들여쓰기가 0 이고 @media 안은 2 다 (prettier 가 강제한다).
    */
    expect(globals).toMatch(/^\.content-container,/m)
  })
})

describe('콘텐츠 컨테이너 — 문서 동기 (#376)', () => {
  it('DESIGN.md §7 레이아웃 토큰 표에 --content-max 가 있다', () => {
    expect(design).toContain('--content-max')
  })

  it('DESIGN.md 에 400 → 480 서술이 남아 있지 않다', () => {
    expect(design).not.toContain('480(1584~)')
    expect(design).not.toContain('좌측만 480까지')
  })
})
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd frontend && npx vitest run src/styles/content-max.test.ts`
Expected: FAIL — 8건 중 **7건 실패**. `--rail-context 는 400 고정이다` 만 이미 참이라 통과한다.
나머지는 `--content-max` 미선언, `rule` 이 `undefined`, `99rem` 잔존, DESIGN.md 문자열 미포함으로 깨진다.

- [ ] **Step 3: 토큰을 추가하고 1584 규칙을 지운다**

`frontend/src/styles/tokens.css` — 레이아웃 블록 첫 줄에 추가한다.

```css
  /* ── 레이아웃 — DESIGN.md §7 */
  --content-max: 1440px;
  --header-h: 56px;
```

같은 파일 맨 아래의 아래 블록을 **통째로 지운다.**

```css
@media (width >= 99rem) {
  :root {
    --rail-context: 480px;
  }
}
```

- [ ] **Step 4: 캡 규칙을 추가한다**

`frontend/app/globals.css` — `/*\n  2단 레일 레이아웃 — DESIGN.md §7-1 · §7-2.` 주석 블록 **바로 앞**(최상위, `@media` 밖)에 넣는다.

```css
/*
  콘텐츠 컨테이너 — DESIGN.md §7 (#376). 넓은 화면에서 본문이 무한히 자라지 않게 한다.

  **캡이 필요한 곳이 여럿이라 한 규칙에 모은다.** 값이 갈라지면 헤더 내용과 본문의
  좌우 경계가 어긋난다 — 1920 에서 40px 대 264px 로 벌어진다.

  **`@media` 밖이다.** 1440 미만에서는 `max-inline-size` 가 걸리지 않고, `margin-inline: auto`
  도 폭이 `auto` 인 블록에서는 무효라 모바일·태블릿은 이 규칙이 있어도 무변화다.
  `.rail-layout` 의 grid 선언만 `lg` 안에 남는다.

  **지도 화면은 여기에 가입하지 않는다** — `.rail-layout` 을 붙이지 않으므로 전폭이다
  (`places/(list)/page.tsx` · `plans/[planId]/days/[day]/add/page.tsx` 의 `view === 'map'` 분기).
  전폭을 예외로 처리하지 않고 **규칙에 가입하지 않는 방식**으로 두는 것이 이 설계의 핵심이다.

  Tailwind arbitrary(`max-w-[var(--content-max)]`)로 쓰지 않는다 — 대괄호 안 함수 호출은
  eslint `noComplexArbitrary` 가 막고, Tailwind 가 조용히 클래스를 만들지 않을 수 있다.
*/
.content-container,
.rail-layout {
  max-inline-size: var(--content-max);
  margin-inline: auto;
}
```

- [ ] **Step 5: 낡은 주석 두 곳을 고친다**

`frontend/app/globals.css` — `.rail-layout` 머리 주석의 마지막 줄.

바꾸기 전:

```
  폭은 `--rail-context` 하나로 묶어 열과 선이 함께 움직인다 (1584+ 에서 480).
```

바꾼 뒤:

```
  폭은 `--rail-context` 하나로 묶어 열과 선이 함께 움직인다 (400 고정).
```

같은 파일 `.rail-layout-filter` 머리 주석.

바꾸기 전:

```
    (`--rail-filter: 280px`, DESIGN.md §7-1). 역할이 다르므로 폭도 다르다는 것이
    디자인 가이드 §4 의 규칙이고, 1584+ 에서 맥락 패널만 480 으로 넓어지는 것과 달리
    필터 레일은 280 을 유지한다 — 라디오 한 줄에 그 이상이 필요하지 않다.
```

바꾼 뒤:

```
    (`--rail-filter: 280px`, DESIGN.md §7-1). 역할이 다르므로 폭도 다르다는 것이
    디자인 가이드 §4 의 규칙이다 — 라디오 한 줄에 280 이상이 필요하지 않다.
```

- [ ] **Step 6: `DESIGN.md` §7 을 고친다**

브레이크포인트 표의 `max` 행.

바꾸기 전:

```
| max     | 1584~    | 64   | —    | 좌측만 480까지. 우측은 늘어난다                   |
```

바꾼 뒤:

```
| max     | 1440~    | 64   | —    | 컨테이너가 1440 에서 멈추고 중앙 정렬. 지도만 전폭 |
```

레이아웃 토큰 표 — `--rail-context` 행을 고치고 `--content-max` 행을 맨 위에 넣는다.

바꾸기 전:

```
| `--header-h`        | 56 → 64(768~)    | 헤더 높이 (검색 필드 없음)    |
```

바꾼 뒤:

```
| `--content-max`     | 1440             | 콘텐츠 컨테이너 최대폭 (지도 제외) |
| `--header-h`        | 56 → 64(768~)    | 헤더 높이 (검색 필드 없음)    |
```

바꾸기 전:

```
| `--rail-context`    | 400 → 480(1584~) | 좌측 맥락 패널 (홈·일정 상세) |
```

바꾼 뒤:

```
| `--rail-context`    | 400              | 좌측 맥락 패널 (홈·일정 상세) |
```

토큰 표 아래 불릿 목록(`- 검색 필드가 있는 헤더는 **64**...` 로 시작하는 목록)의 **맨 앞**에 두 줄을 넣는다.

```
- **콘텐츠는 1440 에서 멈추고 중앙 정렬한다** (`--content-max`). 캡은 `app/globals.css` 의
  `.content-container, .rail-layout` 한 규칙이 갖는다.
- **지도 화면만 전폭이다.** 전폭은 예외 처리가 아니라 `.rail-layout` 에 **가입하지 않는 것**이다.
```

§7-1 의 두 문단.

바꾸기 전:

```
**폭은 `--rail-context` 하나로 묶는다** — 열과 선이 함께 움직여야 1584+ 에서 레일이
480 으로 넓어질 때 선만 400 에 남지 않는다. 레이아웃은 `app/globals.css` 의 `.rail-layout`.
```

바꾼 뒤:

```
**폭은 `--rail-context` 하나로 묶는다** — 열과 선이 함께 움직여야 폭을 바꿀 때 선만
제자리에 남지 않는다. 레이아웃은 `app/globals.css` 의 `.rail-layout`.
```

바꾸기 전:

```
`--rail-filter`(280) 로 바꾸는 변형이다. 맥락 패널과 달리 1584+ 에서도 280 을 유지한다
(라디오 한 줄에 그 이상이 필요하지 않다).
```

바꾼 뒤:

```
`--rail-filter`(280) 로 바꾸는 변형이다 (라디오 한 줄에 280 이상이 필요하지 않다).
```

- [ ] **Step 7: 표 정렬을 prettier 에 맡긴다**

Run: `cd frontend && npx prettier --write DESIGN.md app/globals.css src/styles/tokens.css`
Expected: 세 파일 재포맷. 표 파이프가 다시 정렬된다.

- [ ] **Step 8: 테스트를 돌려 통과를 확인한다**

Run: `cd frontend && npx vitest run src/styles/content-max.test.ts`
Expected: PASS — 8 passed.

- [ ] **Step 9: 전체 검증**

Run: `cd frontend && pnpm verify && pnpm format:check`
Expected: lint · typecheck · test · format 모두 통과. 기존 테스트가 깨지지 않는다.

- [ ] **Step 10: 커밋**

```bash
cd /Users/seonghoho/Documents/projects/hondigagae-376
git add frontend/src/styles/tokens.css frontend/src/styles/content-max.test.ts frontend/app/globals.css frontend/DESIGN.md
git commit -m "$(cat <<'EOF'
[FE] refactor: 콘텐츠 컨테이너 1440 캡을 도입한다

넓은 화면에서 우측 열만 무한히 자라 1920 에서 본문이 1440px 이 됐다.
--content-max 토큰과 .content-container/.rail-layout 한 규칙으로 캡한다.

캡이 필요한 곳이 여럿이라 셀렉터를 한 규칙에 모은다 — 값이 갈라지면
헤더 내용과 본문의 좌우 경계가 어긋난다.

1584 에서 레일을 480 으로 넓히던 규칙을 지운다. 컨테이너가 1440 에서
멈추므로 발동할 수 없는 죽은 규칙이 된다.

레이아웃 토큰은 token-sync 검사 대상이 아니라 문서와 조용히 갈라진다.
content-max.test.ts 가 tokens.css·globals.css·DESIGN.md 를 함께 본다.

Issue Number: #376

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 헤더 안쪽을 컨테이너에 가입시킨다

**Files:**
- Modify: `frontend/src/features/nav/global-header.tsx`
- Modify: `frontend/src/styles/content-max.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `.content-container` 클래스
- Produces: `content-max.test.ts` 안의 `repoSource(relative: string): string` — 저장소 루트 기준 상대경로로 소스를 문자열로 읽는다. Task 3 이 이것을 쓴다.

**왜 바가 아니라 안쪽인가:** `<header>` 자신을 캡하면 `border-b` 가 화면 가운데서 끊긴다. 참조한 당근알바도 바는 전폭이고 안쪽만 캡이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`frontend/src/styles/content-max.test.ts` 파일 **맨 위**의 import 에 두 줄을 더한다.

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
```

같은 파일 **맨 아래**에 붙인다.

```ts
/*
  소스를 문자열로 읽어 본다 — `GlobalHeader` 는 client 자식(`NavLinks` · `AccountMenu` ·
  `PetSwitcherSlot`)을 안고 있어 node 환경에서 통째로 렌더하려면 mock 이 여럿 필요하다.
  여기서 지키려는 것은 렌더 결과가 아니라 **어느 요소가 캡을 갖는가** 하나다.
  `token-usage.test.ts` 가 화면 코드를 문자열로 훑는 것과 같은 방식이다.
*/
function repoSource(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8')
}

describe('콘텐츠 컨테이너 — 헤더 (#376)', () => {
  const header = repoSource('src/features/nav/global-header.tsx')

  it('바(<header>)는 캡하지 않는다 — 캡하면 border-b 가 화면 가운데서 끊긴다', () => {
    const barClasses = header.match(/<header className="([^"]*)"/)?.[1]

    expect(barClasses).toBeDefined()
    expect(barClasses).not.toContain('content-container')
  })

  it('안쪽 div 가 content-container 를 쓴다', () => {
    expect(header).toMatch(/<div className="content-container[^"]*"/)
  })

  it('Tailwind arbitrary 로 캡하지 않는다 — eslint noComplexArbitrary', () => {
    expect(header).not.toContain('max-w-[var(')
  })
})
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd frontend && npx vitest run src/styles/content-max.test.ts`
Expected: FAIL — 11건 중 **1건 실패** (`안쪽 div 가 content-container 를 쓴다`).
바에 캡이 없는 것과 arbitrary 를 안 쓰는 것은 이미 참이라 통과한다.

- [ ] **Step 3: 헤더 안쪽 div 에 클래스를 붙인다**

`frontend/src/features/nav/global-header.tsx`

바꾸기 전:

```tsx
      <div className="flex h-full items-center justify-between gap-3 px-4 md:px-10">
```

바꾼 뒤:

```tsx
      <div className="content-container flex h-full items-center justify-between gap-3 px-4 md:px-10">
```

- [ ] **Step 4: 머리 주석의 낡은 문장을 고친다**

같은 파일의 JSDoc.

바꾸기 전:

```
 * 좌우 패딩 16(모바일) / 40(데스크톱). `max-width` 를 두지 않는다 — 헤더는 화면 폭을 쓴다.
```

바꾼 뒤:

```
 * 좌우 패딩 16(모바일) / 40(데스크톱). **바(`<header>`)에는 `max-width` 를 두지 않는다** —
 * 캡하면 `border-b` 가 화면 가운데서 끊긴다. 안쪽 div 만 `.content-container` 로 캡해
 * 본문(`.rail-layout`)과 같은 세로 경계에 선다 (#376).
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `cd frontend && npx vitest run src/styles/content-max.test.ts`
Expected: PASS — 11 passed (Task 1 의 8 + 헤더 3).

- [ ] **Step 6: 전체 검증**

Run: `cd frontend && pnpm verify && pnpm format:check`
Expected: 전부 통과.

- [ ] **Step 7: 커밋**

```bash
cd /Users/seonghoho/Documents/projects/hondigagae-376
git add frontend/src/features/nav/global-header.tsx frontend/src/styles/content-max.test.ts
git commit -m "$(cat <<'EOF'
[FE] refactor: 헤더 안쪽을 콘텐츠 컨테이너에 가입시킨다

바는 전폭을 유지한다 — <header> 를 캡하면 border-b 가 화면 가운데서
끊겨 아래 본문과 붙은 하나의 경계로 안 읽힌다.

안쪽 div 만 .content-container 로 캡해 본문과 같은 세로 경계에 선다.

Issue Number: #376

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 레일 밖 형제를 같은 경계에 세운다

**Files:**
- Modify: `frontend/src/features/home/weather-warning-strip.tsx`
- Modify: `frontend/src/features/home/weather-warning-strip.test.ts`
- Modify: `frontend/src/features/place/place-detail-section.tsx`
- Modify: `frontend/src/styles/content-max.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `.content-container` 클래스. Task 2 가 `content-max.test.ts` 안에 정의한 `repoSource(relative: string): string` 헬퍼 — 새로 만들지 말고 그것을 쓴다.
- Produces: 없음 (화면 변경)

**왜 필요한가:** `.rail-layout` 만 캡하면 **레일 위에 있는 형제**가 전폭에 남아 1920 에서 좌측 끝이 40px 대 264px 로 어긋난다. 두 곳이 해당한다.

| 위치 | 모양 | 처리 |
| --- | --- | --- |
| 홈 `WeatherWarningStrip` | `border-b` 를 가진 **페이지 폭 바** | 헤더와 같다 — 바는 전폭, 안쪽만 캡 |
| 장소 상세 `DelistedNotice` | 테두리 없는 **인셋 블록** | 블록 자체에 캡 |

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`frontend/src/features/home/weather-warning-strip.test.ts` 의 기존 `describe` **아래**에 붙인다.
이 파일에는 이미 `HEAT_WAVE` 픽스처와 `render(warning)` 헬퍼가 있다 — 그대로 쓴다.

```ts
describe('WeatherWarningStrip — 콘텐츠 컨테이너 (#376)', () => {
  /*
    스트립은 `rail-layout` 밖, 두 열 위에 있다. 레일만 캡하면 1920 에서 이 줄의 글자만
    화면 끝(40px)에 남고 아래 본문은 264px 에서 시작해 **세로 기준선이 꺾인다.**

    헤더와 같은 처리다 — 바는 전폭이라 `border-b` 가 헤더 구분선과 같은 길이로 이어지고,
    안쪽만 캡해 글자가 본문과 같은 세로선에 선다.
  */
  it('바는 전폭이다 — border-b 가 헤더 구분선과 같은 길이로 이어진다', () => {
    const markup = render(HEAT_WAVE)

    expect(markup).toContain('border-b')
    expect(markup).not.toMatch(/<section[^>]*class="[^"]*content-container/)
  })

  it('안쪽 줄이 content-container 로 캡된다', () => {
    expect(render(HEAT_WAVE)).toMatch(/class="content-container/)
  })
})
```

`frontend/src/styles/content-max.test.ts` 맨 아래에도 붙인다.

```ts
describe('콘텐츠 컨테이너 — 레일 밖 형제 (#376)', () => {
  it('장소 상세의 폐업 안내가 컨테이너에 가입한다', () => {
    const section = repoSource('src/features/place/place-detail-section.tsx')
    const notice = section.match(/function DelistedNotice\(\)[\s\S]{0,200}/)?.[0]

    expect(notice).toBeDefined()
    expect(notice).toContain('content-container')
  })
})
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd frontend && npx vitest run src/features/home/weather-warning-strip.test.ts src/styles/content-max.test.ts`
Expected: FAIL — `안쪽에 content-container 로 캡한 줄이 있다` 와 `장소 상세의 폐업 안내가 컨테이너에 가입한다` 2건 실패.

- [ ] **Step 3: 특보 스트립을 바 / 안쪽으로 나눈다**

`frontend/src/features/home/weather-warning-strip.tsx`

바꾸기 전:

```tsx
  return (
    <section
      aria-label={messages.home.warningStripLabel}
      className={`border-border flex flex-wrap items-center gap-x-2 gap-y-1 border-b py-3 ${INSET_CLASS.main}`}
    >
      <WeatherWarningBadge warning={warning} />
      {warning.level.description !== null && (
        <p className="text-body-2 text-fg break-keep">{warning.level.description}</p>
      )}
    </section>
  )
```

바꾼 뒤:

```tsx
  return (
    /*
      **바는 전폭, 안쪽만 캡이다** (#376) — `GlobalHeader` 와 같은 구조다.
      `border-b` 는 페이지를 가로지르는 경계라 캡하면 헤더 구분선보다 짧아져 어긋난다.
      안쪽 줄은 `.content-container` 로 본문(`.rail-layout`)과 같은 세로선에 선다.
    */
    <section aria-label={messages.home.warningStripLabel} className="border-border border-b">
      <div
        className={`content-container flex flex-wrap items-center gap-x-2 gap-y-1 py-3 ${INSET_CLASS.main}`}
      >
        <WeatherWarningBadge warning={warning} />
        {warning.level.description !== null && (
          <p className="text-body-2 text-fg break-keep">{warning.level.description}</p>
        )}
      </div>
    </section>
  )
```

- [ ] **Step 4: 폐업 안내에 캡을 붙인다**

`frontend/src/features/place/place-detail-section.tsx`

바꾸기 전:

```tsx
function DelistedNotice() {
  return (
    <div className="px-4 py-3 md:px-10">
```

바꾼 뒤:

```tsx
function DelistedNotice() {
  return (
    // `rail-layout` 밖, 두 열 위다. 캡하지 않으면 1920 에서 아래 본문과 세로선이 꺾인다 (#376)
    <div className="content-container px-4 py-3 md:px-10">
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `cd frontend && npx vitest run src/features/home/weather-warning-strip.test.ts src/styles/content-max.test.ts`
Expected: PASS — 두 파일 모두 통과. 기존 특보 스트립 테스트도 그대로 통과해야 한다(마크업 구조만 바뀌고 텍스트·`aria-label` 은 그대로다).

- [ ] **Step 6: 전체 검증**

Run: `cd frontend && pnpm verify && pnpm format:check`
Expected: 전부 통과.

- [ ] **Step 7: 커밋**

```bash
cd /Users/seonghoho/Documents/projects/hondigagae-376
git add frontend/src/features/home/weather-warning-strip.tsx frontend/src/features/home/weather-warning-strip.test.ts frontend/src/features/place/place-detail-section.tsx frontend/src/styles/content-max.test.ts
git commit -m "$(cat <<'EOF'
[FE] fix: 레일 밖 형제를 본문과 같은 세로선에 세운다

.rail-layout 만 캡하면 그 위에 있는 형제가 전폭에 남아 1920 에서 글자
왼쪽 끝이 40px 대 264px 로 꺾인다. 두 곳이 해당한다.

특보 스트립은 헤더와 같은 처리를 한다 — border-b 는 페이지를 가로지르는
경계라 바를 전폭으로 두고 안쪽 줄만 캡한다. 캡하면 헤더 구분선보다
짧아져 두 줄이 어긋난 것처럼 보인다.

장소 상세의 폐업 안내는 테두리 없는 인셋 블록이라 블록 자체에 캡한다.

Issue Number: #376

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 브라우저 실측과 PR

**Files:**
- Modify: 실측에서 결함이 나오면 해당 파일 (없으면 코드 변경 없음)

**Interfaces:**
- Consumes: Task 1·2·3 전부
- Produces: PR

- [ ] **Step 1: dev 서버를 띄운다**

Run (Bash, background): `cd /Users/seonghoho/Documents/projects/hondigagae-376/frontend && pnpm dev:alt`

**포트 5174 를 쓴다.** 3000 은 카카오 지도 키에 도메인이 등록돼 있지 않아 지도가 항상 폴백으로 뜬다. `preview_start` 는 샌드박스에 막히므로 Bash 로 띄운다.

- [ ] **Step 2: 1920 에서 중앙 정렬을 확인한다**

`resize_window` 로 1920×1080 을 잡고 아래를 차례로 연다.

| URL | 봐야 할 것 |
| --- | --- |
| `http://localhost:5174/` | 레일이 중앙 정렬. **특보 스트립 글자 왼쪽 끝이 레일 아래 본문과 같은 세로선** |
| `http://localhost:5174/places?view=list` | 필터 레일 + 목록이 중앙 정렬 |
| `http://localhost:5174/plans` | 중앙 정렬 |

헤더 안쪽 내용도 같은 컨테이너 경계 안에 있어야 한다. **바의 `border-b` 는 화면 끝까지 이어져야 한다.**

- [ ] **Step 3: 지도 두 화면이 전폭인지 확인한다**

| URL | 기대 |
| --- | --- |
| `http://localhost:5174/places?view=map` | 지도가 뷰포트 전폭. 좌우 여백 0 |
| `http://localhost:5174/plans/<실재 planId>/days/1/add?view=map` | 같음 |

`planId` 는 `/plans` 에서 하나 열어 URL 에서 딴다. 로그인이 필요하면 먼저 로그인한다.

- [ ] **Step 4: 1440 에서 변경 전과 같은지 확인한다**

`resize_window` 1440×900. 아래를 콘솔에서 실행해 우측 본문 폭이 **960** 인지 본다.

```js
const rail = document.querySelector('.rail-layout')
const right = rail?.lastElementChild
JSON.stringify({
  rail: rail?.getBoundingClientRect().width,
  right: right?.getBoundingClientRect().width,
  rightInner: right ? right.clientWidth - 80 : null,
})
```

Expected: `rail` 1440, `right` 1040, `rightInner` 960.

- [ ] **Step 5: 좁은 폭에서 무변화와 가로 스크롤 0 을 확인한다**

1280 · 1024 · 768 · 375 에서 각각 홈과 `/places?view=list` 를 연다. 375 에서는 아래가 반드시 `true` 여야 한다.

```js
document.scrollingElement.scrollWidth === document.scrollingElement.clientWidth
```

**브라우저 패널이 숨겨져 있으면 rAF·폴링이 멈추고 390 스크린샷이 잘린다.** 계측 전에 패널이 보이는지 확인한다.

- [ ] **Step 6: 결함이 있으면 고치고 Task 1~3 의 검증을 다시 돌린다**

결함이 없으면 이 단계는 건너뛴다. 고쳤다면 `cd frontend && pnpm verify && pnpm format:check` 를 다시 통과시키고 커밋한다.

- [ ] **Step 7: dev 서버를 내리고 push 한다**

```bash
cd /Users/seonghoho/Documents/projects/hondigagae-376
git log --oneline origin/develop..HEAD
git push -u origin refactor/fe/376-content-max-width
```

- [ ] **Step 8: PR 을 연다**

`pr` 스킬로 본문을 쓴다. 반드시 담을 것:

- `Issue Number: #376`
- 1440 을 고른 근거 (1440 노트북에서 오늘과 픽셀이 같다 / 1280 이면 960 → 800 으로 좁아진다)
- 1920 · 1440 · 375 스크린샷
- 지도 두 화면이 전폭임을 보이는 스크린샷
- `--rail-context: 480px` 삭제 사실 (`DESIGN.md` §7 결정을 뒤집은 것이므로 리뷰어가 알아야 한다)

머지는 **Rebase and merge** 만 쓴다.

---

## 범위 밖 — 손대지 않는다

| 대상 | 이유 |
| --- | --- |
| `max-w-lg`(512) · `max-w-2xl`(672) · `max-w-screen-md`(768) 화면 | 폼·읽기 measure 는 그 폭이 맞다. 1440 캡보다 항상 작아 무영향 |
| 응급 지도 `emergency-map` | 768 안에 박힌 **컴포넌트**지 지도 화면이 아니다 |
| 헤더 40 ↔ 레일 24 의 16px 어긋남 | 오늘도 같은 값이다. Task 4 실측에서 거슬리면 **별도 이슈**로 올린다 |
| `INSET_BLEED_*` · `.scroll-rail` | margin 기반 / `contain: layout` 이라 캡과 무관하다 |
