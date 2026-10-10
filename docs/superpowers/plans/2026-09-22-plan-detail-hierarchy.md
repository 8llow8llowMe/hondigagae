# 일정 상세 정보 계층 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 일정 상세(`/plans/[planId]`)의 좌 레일 개요 카드 · 준비물 빈 상태 · 일차 카드에 정보 계층을 주고, 근거를 접는 토글을 저장소 전체에서 걷어낸다.

**Architecture:** 세 이슈로 나뉜다. **#840(근거 토글 제거)이 선행**이다 — 먼저 머지돼야 #842 의 diff 가 레이아웃 변경만 남는다. #841 과 #842 는 서로 독립이라 #840 머지 뒤 병렬로 간다. 새 API 는 없고, 새 자산은 SVG 3종이다. 등급 tint 밴드는 `components/metric.tsx` 가 이미 갖고 있는 `METRIC_TINT_TONE` · `METRIC_TINT_EDGE_TONE` · `BADGE_TONE_ON_TINT` 를 조립해 쓴다.

**Tech Stack:** Next.js App Router · React 19 · Tailwind v4 · vitest(node 환경 + `renderToStaticMarkup` 문자열 assertion, jsdom 없음)

**Spec:** `docs/superpowers/specs/2026-09-22-plan-detail-hierarchy-design.md`

**Issues:** [#840](https://github.com/8llow8llowMe/hondigagae/issues/840) · [#841](https://github.com/8llow8llowMe/hondigagae/issues/841) · [#842](https://github.com/8llow8llowMe/hondigagae/issues/842)

## Global Constraints

- **파일 인코딩은 UTF-8 (no BOM).** `.editorconfig` · `.gitattributes` 설정을 덮지 않는다.
- **커밋 prefix 는 `[FE]`** (문서만 바뀌면 `[DOCS]`). 형식: `[FE] feat: 요약`. 타입은 `feat` / `fix` / `chore` / `refactor` / `style` / `docs` / `test`.
- **`git add -A` · `git add .` · 맨 `git stash` 를 쓰지 않는다.** 작업 트리를 다른 세션과 공유하므로 경로를 하나씩 적어 스테이징한다.
- **브랜치명**: `<type>/fe/<이슈번호>-<요약>` (예: `refactor/fe/840-drop-reason-toggle`).
- **검증 명령은 `pnpm verify`** (= `eslint . && tsc --noEmit && vitest run`). 커밋 전 통과시킨다. push 전에는 `pnpm format:check` 도 돈다(pre-push 훅).
- **테스트는 node 환경 + `renderToStaticMarkup` 문자열 assertion.** jsdom/testing-library 를 쓰지 않는다. 클릭 상호작용은 테스트하지 않고 **마크업에 무엇이 있는지/없는지**를 본다.
- **문구는 `src/lib/messages/*` 에만 둔다.** 컴포넌트에 한국어 리터럴을 쓰지 않는다.
- **서버 문장을 FE 가 다시 쓰지 않는다.** `description` · `unavailableReason` 등은 완성형으로 온다.
- **색만으로 정보를 전달하지 않는다** (DESIGN.md §2-3). tint 면을 깔면 `-500` 실선을 짝으로 둔다.

---

# Phase 1 — 이슈 #840: 근거 토글 전면 제거

브랜치: `refactor/fe/840-drop-reason-toggle`

## File Structure

| 파일                                             | 책임                  | 변경                                        |
| ------------------------------------------------ | --------------------- | ------------------------------------------- |
| `src/components/reason-list.tsx`                 | 근거 문장 목록 렌더   | 상태·버튼·`'use client'` 제거 → 순수 `<ul>` |
| `src/features/place/place-suitability-panel.tsx` | 장소 적합도 패널      | `ReasonList` 호출 인자 3개 제거             |
| `src/features/place/place-walk-safety-panel.tsx` | 장소 산책 위험도 패널 | 〃 + `FeelsLikeBasis` 토글 제거             |
| `src/features/ai-plan/ai-plan-draft-preview.tsx` | AI 초안 미리보기      | `ReasonList` 호출 인자 2개 제거             |
| `src/features/home/walk-verdict.tsx`             | 홈 판정               | 자체 구현 펼치기 제거                       |
| `src/lib/messages/{home,ai-plan,place}.ts`       | 문구                  | 토글 라벨 6개 삭제                          |

---

### Task 1: `ReasonList` 를 순수 목록으로

**Files:**

- Modify: `src/components/reason-list.tsx`
- Test: `src/components/reason-list.test.ts` (신규)

**Interfaces:**

- Consumes: 없음
- Produces: `ReasonList({ reasons, className })` — `reasons: Reason[]`, `className?: string`. **`initialCount` · `moreLabel` · `lessLabel` 은 더 이상 받지 않는다.** `Reason` 타입(`{ description: string; informational?: boolean }`)은 그대로다.

- **Step 1: 실패하는 테스트를 쓴다**

`src/components/reason-list.test.ts` 를 만든다.

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { ReasonList } from "@/components/reason-list";

const FIVE = [
  { description: "첫째 근거" },
  { description: "둘째 근거" },
  { description: "셋째 근거" },
  { description: "넷째 근거" },
  { description: "다섯째 근거" },
];

function render(reasons: { description: string; informational?: boolean }[]) {
  return renderToStaticMarkup(createElement(ReasonList, { reasons }));
}

/* 접기를 걷었다 (#840) — 아끼는 것이 한 줄인데 버튼이 44px 이라 순손실이었다 */
describe("ReasonList — 근거를 접지 않는다", () => {
  it("다섯 개를 주면 다섯 개가 다 선다", () => {
    const html = render(FIVE);

    for (const reason of FIVE) {
      expect(html).toContain(reason.description);
    }
  });

  it("펼침·접기 버튼을 그리지 않는다", () => {
    const html = render(FIVE);

    expect(html).not.toContain("<button");
    expect(html).not.toContain("aria-expanded");
  });

  it("정보성 근거만 한 단계 흐리다", () => {
    const html = render([
      { description: "감점 근거" },
      { description: "정보 근거", informational: true },
    ]);

    expect(html).toContain("text-fg-muted");
    expect(html).toContain('text-fg"');
  });

  it("근거가 없으면 아무것도 그리지 않는다", () => {
    expect(render([])).toBe("");
  });
});
```

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/components/reason-list.test.ts`
Expected: FAIL — `펼침·접기 버튼을 그리지 않는다` 가 `<button` 을 찾아 실패한다.

- **Step 3: 컴포넌트를 순수 목록으로 바꾼다**

`src/components/reason-list.tsx` 전체를 아래로 교체한다.

```tsx
import { cn } from "@/lib/utils/cn";

/**
 * 근거 목록 (XAI `reasons`) — 디자인 가이드 §5.
 *
 * **서버 순서를 재정렬하지 않는다.** 영향이 큰 순서로 온다. 문장도 서버가 완성형으로
 * 준다(`description`) — FE 가 다시 쓰지 않는다 (styling-guide.md §7).
 *
 * **점수 숫자를 노출하지 않고, 문장 앞에 3px 세로 바를 달지 않는다.** 감점은 문장이
 * 말하고 등급은 상단 요약이 말한다. 바를 달면 목록이 색 줄무늬로 읽힌다.
 *
 * ### 접기를 걷었다 (#840)
 *
 * 예전에는 기본 2~3개만 보이고 나머지를 펼침 버튼 뒤에 뒀다. **접어서 아끼는 것은 문장
 * 한 줄(약 22px)인데 버튼이 44px**(DESIGN.md §7 최소 터치 영역)이라, 근거가 3개인 흔한
 * 경우 접기가 순손실이었다. 상태가 사라지면서 `'use client'` 도 함께 뗐다 — 이제 서버
 * 컴포넌트에서도 쓸 수 있다.
 */

export type Reason = {
  /** 서버가 완성형으로 주는 문장 */
  description: string;
  /**
   * 정보성 항목은 감점이 아니다 — 한 단계 흐리게만 내리고 부호를 붙이지 않는다
   * (예: "혼잡도 정보 없음").
   */
  informational?: boolean;
};

export function ReasonList({
  reasons,
  className,
}: {
  reasons: Reason[];
  className?: string;
}) {
  if (reasons.length === 0) return null;

  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {reasons.map((reason, index) => (
        <li
          key={`${index}-${reason.description}`}
          className={cn(
            "text-body-2",
            reason.informational === true ? "text-fg-muted" : "text-fg",
          )}
        >
          {reason.description}
        </li>
      ))}
    </ul>
  );
}
```

- **Step 4: 통과를 확인한다**

Run: `pnpm vitest run src/components/reason-list.test.ts`
Expected: PASS (4 tests)

타입 오류는 여기서 난다 — 호출부가 아직 사라진 prop 을 넘긴다. Task 2 에서 닫는다.

- **Step 5: 커밋**

```bash
git add src/components/reason-list.tsx src/components/reason-list.test.ts
git commit -m "[FE] refactor: 근거 목록에서 접기를 걷어낸다 (#840)"
```

---

### Task 2: `ReasonList` 호출부 3곳 정리

**Files:**

- Modify: `src/features/place/place-suitability-panel.tsx:119-121`
- Modify: `src/features/place/place-walk-safety-panel.tsx:174-178`
- Modify: `src/features/ai-plan/ai-plan-draft-preview.tsx:185-188`

**Interfaces:**

- Consumes: Task 1 의 `ReasonList({ reasons, className })`
- Produces: 없음 (호출부 정리)

- **Step 1: 타입 오류로 대상을 확정한다**

Run: `pnpm tsc --noEmit`
Expected: 세 파일에서 `initialCount` / `moreLabel` / `lessLabel` 이 존재하지 않는 prop 이라는 오류.

- **Step 2: 세 호출부에서 사라진 prop 을 지운다**

`place-suitability-panel.tsx` — `initialCount` · `moreLabel` · `lessLabel` 세 줄을 지운다.

```tsx
<ReasonList
  reasons={data.reasons.map((reason) => ({
    description: reason.description,
    informational: reason.scoreDelta === 0,
  }))}
/>
```

`place-walk-safety-panel.tsx` — 같은 세 줄을 지운다. **`informational` 은 원래 주지 않는다** (`WalkSafetyReasonItem` 에 `scoreDelta` 가 없다 — 기존 주석 유지).

```tsx
<ReasonList
  reasons={data.reasons.map((reason) => ({ description: reason.description }))}
/>
```

`ai-plan-draft-preview.tsx` — `moreLabel` · `lessLabel` 두 줄을 지운다. 나머지 인자는 그대로 둔다.

- **Step 3: 타입이 통과하는지 확인한다**

Run: `pnpm tsc --noEmit`
Expected: 이 세 파일의 오류가 사라진다. `messages` 쪽 오류는 아직 없다 (Task 5 에서 키를 지운다).

- **Step 4: 커밋**

```bash
git add src/features/place/place-suitability-panel.tsx src/features/place/place-walk-safety-panel.tsx src/features/ai-plan/ai-plan-draft-preview.tsx
git commit -m "[FE] refactor: 근거 목록 호출부에서 접기 인자를 걷어낸다 (#840)"
```

---

### Task 3: `계산 근거` 서랍을 항상 열린 각주로

**Files:**

- Modify: `src/features/place/place-walk-safety-panel.tsx` (`FeelsLikeBasis`, 약 `:215-260`)
- Modify: `src/lib/messages/place.ts:266-267`
- Test: `src/features/place/place-walk-safety-panel.test.ts:200-245`

**Interfaces:**

- Consumes: 없음
- Produces: `messages.place.detailFeelsLikeBasisLabel` — 서랍 대신 서는 **정적 라벨** 문구. 기존 `detailFeelsLikeBasisOpen` / `detailFeelsLikeBasisClose` 를 대체한다.

**왜 라벨이 남는가:** `feelsLikeBasis` 는 산식·입력·임계 출처를 담은 130자 문장이다. 버튼만 지우고 문장을 노출하면 **그 문장이 무엇의 근거인지 말하는 것이 사라진다** — 버튼 라벨이 그 일을 하고 있었다.

- **Step 1: 실패하는 테스트를 쓴다**

`place-walk-safety-panel.test.ts` 의 기존 `detailFeelsLikeBasisOpen` / `Close` assertion 블록(약 `:200-245`)을 아래로 교체한다.

```ts
/* 계산 근거를 접지 않는다 (#840) — 서랍이 사라지고 라벨 + 문장이 늘 선다 */
describe("PlaceWalkSafetyPanel — 체감온도 계산 근거", () => {
  it("근거 문장이 접힘 없이 선다", () => {
    const html = render();

    expect(html).toContain(messages.place.detailFeelsLikeBasisLabel);
    expect(html).toContain("체감온도는 기온과 습도로 계산합니다");
    expect(html).not.toContain("aria-expanded");
  });

  it("feelsLikeBasis 가 없으면 라벨도 서지 않는다", () => {
    const html = render({ feelsLikeBasis: null });

    expect(html).not.toContain(messages.place.detailFeelsLikeBasisLabel);
  });
});
```

`'체감온도는 기온과 습도로 계산합니다'` 는 픽스처(`src/test/fixtures/`)의 `feelsLikeBasis` 값에 맞춘다 — 실제 값을 열어 보고 그 앞부분으로 바꾼다.

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/features/place/place-walk-safety-panel.test.ts`
Expected: FAIL — `detailFeelsLikeBasisLabel` 이 아직 없다.

- **Step 3: 문구를 바꾼다**

`src/lib/messages/place.ts` 에서 `detailFeelsLikeBasisOpen` · `detailFeelsLikeBasisClose` 두 줄을 지우고 한 줄을 더한다.

```ts
  /**
   * 체감온도 계산 근거 문단의 **정적 라벨** (#840). 예전에는 펼침 버튼의 라벨이었다 —
   * 접기를 걷으면서 버튼은 사라졌지만, 130자 문장이 무엇의 근거인지 말하는 일은 남았다.
   */
  detailFeelsLikeBasisLabel: '체감온도 계산 근거',
```

- **Step 4: `FeelsLikeBasis` 에서 상태와 버튼을 뺀다**

`useState` · `useId` · `<button>` · `hidden={!open}` 을 지운다. 머리주석의 "접어 둔다" 항목을 아래 결정으로 바꾼다.

```tsx
function FeelsLikeBasis({ data }: { data: WalkSafetyResponse }) {
  if (data.feelsLikeBasis === null) return null

  const heatIndex = formatCelsius(data.heatIndexCelsius)
  const hasHeatIndex = heatIndex !== null && data.heatIndexBasis !== null

  return (
    <div className="flex flex-col gap-2">
      {/*
        **버튼이 아니라 라벨이다** (#840). 접기를 걷으면서 `aria-expanded`/`aria-controls`
        도 함께 사라졌다 — 여는 것이 없으므로 가리킬 몸통도 없다.
      */}
      <p className="text-caption text-fg-muted font-semibold">
        {messages.place.detailFeelsLikeBasisLabel}
      </p>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-body-2 text-fg-muted">{data.feelsLikeBasis}</p>
```

이하 몸통은 그대로 둔다. **파일 상단의 `useId` import 가 다른 곳에서도 쓰이는지 확인하고**, 안 쓰이면 함께 지운다.

- **Step 5: 통과를 확인한다**

Run: `pnpm vitest run src/features/place/place-walk-safety-panel.test.ts`
Expected: PASS

- **Step 6: 커밋**

```bash
git add src/features/place/place-walk-safety-panel.tsx src/features/place/place-walk-safety-panel.test.ts src/lib/messages/place.ts
git commit -m "[FE] refactor: 체감온도 계산 근거를 접지 않고 늘 보여 준다 (#840)"
```

---

### Task 4: 홈 판정의 자체 구현 펼치기 제거

**Files:**

- Modify: `src/features/home/walk-verdict.tsx` (약 `:310-347`)
- Test: `src/features/home/walk-verdict.test.ts`

**Interfaces:**

- Consumes: 없음
- Produces: 없음 (내부 컴포넌트)

`walk-verdict.tsx` 는 `ReasonList` 를 쓰지 않고 **같은 일을 직접 구현**한다 — `visible` 슬라이스 + 펼침 버튼(접기는 없다).

- **Step 1: 실패하는 테스트를 쓴다**

`walk-verdict.test.ts` 에 더한다.

```ts
/* 근거를 접지 않는다 (#840) */
it("근거가 여러 개여도 전부 선다", () => {
  const reasons = [
    { description: "근거 하나" },
    { description: "근거 둘" },
    { description: "근거 셋" },
    { description: "근거 넷" },
  ];
  const html = renderVerdict({ reasons });

  for (const reason of reasons) {
    expect(html).toContain(reason.description);
  }
  expect(html).not.toContain("aria-expanded");
});
```

`renderVerdict` 는 이 파일에 이미 있는 헬퍼를 쓴다 — 없으면 다른 테스트의 render 헬퍼 이름에 맞춘다.

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/features/home/walk-verdict.test.ts`
Expected: FAIL — 넷째 근거가 없고 `aria-expanded` 가 있다.

- **Step 3: 슬라이스와 버튼을 지운다**

해당 내부 컴포넌트에서 `useState` · `expanded` · `visible` · `hidden` · `<button>` · `ChevronDownIcon` 을 지우고 `reasons` 를 그대로 돌린다.

```tsx
return (
  <div className="flex flex-col gap-2">
    {reasons.map((reason, index) => (
      <p key={`${index}-${reason.description}`} className="text-body-2 text-fg">
        {reason.description}
      </p>
    ))}
  </div>
);
```

`ChevronDownIcon` import 가 이 파일의 다른 곳에서 쓰이는지 확인하고, 안 쓰이면 함께 지운다. 이 컴포넌트가 `'use client'` 를 요구하던 유일한 상태였는지도 확인한다 — 파일에 다른 훅이 있으면 `'use client'` 는 남긴다.

- **Step 4: 통과를 확인한다**

Run: `pnpm vitest run src/features/home/walk-verdict.test.ts`
Expected: PASS

- **Step 5: 커밋**

```bash
git add src/features/home/walk-verdict.tsx src/features/home/walk-verdict.test.ts
git commit -m "[FE] refactor: 홈 판정 근거를 접지 않는다 (#840)"
```

---

### Task 5: 토글 문구 4개 삭제 + 전체 검증

**Files:**

- Modify: `src/lib/messages/home.ts:339-340`
- Modify: `src/lib/messages/ai-plan.ts:331-332`

**Interfaces:**

- Consumes: 없음
- Produces: 없음

- **Step 1: 남은 참조가 없는지 확인한다**

Run:

```bash
grep -rn "moreReasons\|lessReasons\|reasonsMore\|reasonsLess\|detailFeelsLikeBasisOpen\|detailFeelsLikeBasisClose" src app
```

Expected: `src/lib/messages/home.ts` 와 `src/lib/messages/ai-plan.ts` 의 정의 네 줄만 남는다. 다른 곳이 나오면 그 파일을 먼저 정리한다.

- **Step 2: 네 줄을 지운다**

`home.ts` 의 `moreReasons` · `lessReasons`, `ai-plan.ts` 의 `reasonsMore` · `reasonsLess` 를 지운다. `home.ts:458` 의 `morePlaces` 와 `ai-plan.ts` 의 다른 키는 **건드리지 않는다.**

- **Step 3: 문구 톤 테스트가 도는지 본다**

Run: `pnpm vitest run src/lib/messages/message-tone.test.ts`
Expected: PASS

- **Step 4: 전체 검증**

Run: `pnpm verify`
Expected: PASS. `pnpm format:check` 도 돌려 pre-push 훅에서 막히지 않게 한다.

- **Step 5: 커밋**

```bash
git add src/lib/messages/home.ts src/lib/messages/ai-plan.ts
git commit -m "[FE] chore: 쓰이지 않는 근거 토글 문구를 지운다 (#840)"
```

---

### Task 6: `reasons` 최대 개수 실측

**Files:** 없음 (조사)

근거를 전부 노출하면 홈 판정과 장소 패널이 길어진다. **서버가 `reasons` 개수에 상한을 두는지는 계약에 없다.**

- **Step 1: dev 게이트웨이에서 실제 응답을 받는다**

장소 적합도 · 산책 위험도 · 일자 판정 세 엔드포인트를 각각 호출해 `reasons.length` 의 최댓값을 센다. dev Swagger 는 **서비스 접두사가 필요하다** — 없으면 404 가 아니라 빈 스펙 200 이 오므로 `paths` 개수를 먼저 센다.

- **Step 2: 결과를 이슈에 남긴다**

10개를 넘는 응답이 실재하면 [#840](https://github.com/8llow8llowMe/hondigagae/issues/840) 에 코멘트로 적고 **결정을 다시 연다** (그때는 `line-clamp` 또는 개수 상한을 논의한다). 10개 이하면 "실측 N개, 전부 노출 유지" 를 적고 닫는다.

---

# Phase 2 — 이슈 #841: 좌 레일 개요 카드 + 준비물 빈 상태

브랜치: `feature/fe/841-plan-overview-hierarchy` (#840 머지 뒤 `develop` 에서 딴다)

## File Structure

| 파일                                        | 책임              | 변경                                  |
| ------------------------------------------- | ----------------- | ------------------------------------- |
| `src/lib/plan/date.ts`                      | 날짜 형식         | `formatPlanDateRangeCompact` 신규     |
| `src/features/plan/plan-overview-panel.tsx` | 좌 레일 개요 카드 | 세 구획으로 재구성 · 세로 목차        |
| `src/features/plan/plan-packing-list.tsx`   | 준비물 절         | `Intro` 재구성 · `AddSection` variant |
| `src/lib/messages/plan.ts`                  | 문구              | `packingIntro` 교체                   |
| `public/illustrations/packing-empty.svg`    | 자산              | 신규                                  |

---

### Task 7: `formatPlanDateRangeCompact`

**Files:**

- Modify: `src/lib/plan/date.ts`
- Test: `src/lib/plan/date.test.ts` (없으면 신규)

**Interfaces:**

- Consumes: 기존 `formatPlanDay(date)` · `formatPlanDateRange(startDate, endDate)`
- Produces: `formatPlanDateRangeCompact(startDate: string, endDate: string, today: Date): string` — **시작일·종료일이 모두 `today` 의 해**면 연도 없는 형식, 아니면 `formatPlanDateRange` 그대로.

- **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from "vitest";

import {
  formatPlanDateRange,
  formatPlanDateRangeCompact,
} from "@/lib/plan/date";

const TODAY = new Date("2026-09-22T00:00:00+09:00");

describe("formatPlanDateRangeCompact — 올해 일정은 연도를 뗀다 (#841)", () => {
  it("올해 일정이면 연도가 없다", () => {
    expect(formatPlanDateRangeCompact("2026-09-25", "2026-09-27", TODAY)).toBe(
      "9월 25일 (금) – 9월 27일 (일)",
    );
  });

  it("하루짜리도 연도가 없다", () => {
    expect(formatPlanDateRangeCompact("2026-09-25", "2026-09-25", TODAY)).toBe(
      "9월 25일 (금)",
    );
  });

  /* 내년 일정에서 연도를 떼면 언제인지 알 수 없어진다 */
  it("다른 해가 끼면 기존 형식 그대로다", () => {
    expect(formatPlanDateRangeCompact("2026-12-30", "2027-01-02", TODAY)).toBe(
      formatPlanDateRange("2026-12-30", "2027-01-02"),
    );
    expect(formatPlanDateRangeCompact("2027-03-01", "2027-03-03", TODAY)).toBe(
      formatPlanDateRange("2027-03-01", "2027-03-03"),
    );
  });

  /* 읽을 수 없는 날짜는 기존 함수의 폴백(입력 문자열)을 그대로 쓴다 */
  it("형식이 깨진 날짜는 기존 함수에 맡긴다", () => {
    expect(formatPlanDateRangeCompact("깨짐", "2026-09-27", TODAY)).toBe(
      formatPlanDateRange("깨짐", "2026-09-27"),
    );
  });
});
```

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/lib/plan/date.test.ts`
Expected: FAIL — `formatPlanDateRangeCompact is not a function`

- **Step 3: 구현한다**

`src/lib/plan/date.ts` 에 더한다. `formatPlanDateRange` 는 **건드리지 않는다** — 다른 화면이 쓴다.

```ts
/**
 * 개요 카드의 날짜 줄 — `9월 25일 (금) – 9월 27일 (일)` (#841).
 *
 * **올해 일정에서만 연도를 뗀다.** 일차 카드(`formatPlanDay`)와 형식을 맞춰 같은 값이 한
 * 화면에서 두 형식으로 서던 것을 없앤다. 내년 일정에서까지 떼면 언제인지 알 수 없어지므로,
 * 한쪽이라도 다른 해면 `formatPlanDateRange` 를 그대로 돌려준다.
 */
export function formatPlanDateRangeCompact(
  startDate: string,
  endDate: string,
  today: Date,
): string {
  const thisYear = String(today.getFullYear());
  if (startDate.slice(0, 4) !== thisYear || endDate.slice(0, 4) !== thisYear) {
    return formatPlanDateRange(startDate, endDate);
  }

  const startLabel = formatPlanDay(startDate);
  // 읽을 수 없는 날짜는 기존 함수의 폴백에 맡긴다 — 여기서 형식을 또 정하지 않는다
  if (startLabel === null) return formatPlanDateRange(startDate, endDate);
  if (startDate === endDate) return startLabel;

  const endLabel = formatPlanDay(endDate);
  if (endLabel === null) return formatPlanDateRange(startDate, endDate);

  return `${startLabel} – ${endLabel}`;
}
```

- **Step 4: 통과를 확인한다**

Run: `pnpm vitest run src/lib/plan/date.test.ts`
Expected: PASS (4 tests)

- **Step 5: 커밋**

```bash
git add src/lib/plan/date.ts src/lib/plan/date.test.ts
git commit -m "[FE] feat: 올해 일정의 날짜 범위에서 연도를 뗀다 (#841)"
```

---

### Task 8: 개요 카드를 세 구획으로

**Files:**

- Modify: `src/features/plan/plan-overview-panel.tsx`
- Test: `src/features/plan/plan-detail.test.ts` (개요 패널 블록)

**Interfaces:**

- Consumes: Task 7 의 `formatPlanDateRangeCompact`
- Produces: `PLAN_VERDICT_STRIP_MAX_DAYS = 7` (기존 4). export 이름과 타입은 그대로.

**구조:** 카드 안 `flex flex-col` 에 구획 셋. 사이는 `border-t border-border pt-4` 다.

- **Step 1: 실패하는 테스트를 쓴다**

`plan-detail.test.ts` 의 개요 패널 describe 블록에 더한다.

```ts
/* 개요 카드에 계층을 준다 (#841) */
describe("PlanOverviewPanel — 세 구획", () => {
  it("올해 일정이면 날짜 줄에 연도가 없다", () => {
    const html = renderOverview();

    expect(html).not.toContain("2026년");
  });

  it("예산이 없으면 예산 문구가 서지 않는다", () => {
    const html = renderOverview({ budget: null });

    expect(html).not.toContain(messages.plan.budgetEmpty);
  });

  it("일자 목차 줄이 앵커이고 축 라벨은 섹션이 한 번만 갖는다", () => {
    const html = renderOverview();

    expect(html).toContain('href="#day1"');
    expect(html).toContain(messages.plan.verdictTocTitle);
    // 배지에서 축 라벨을 뗐다 — `적합도 보통` 이 배지 안에 붙지 않는다
    expect(html).not.toContain(
      `${messages.common.metricAxisSuitability} </span>`,
    );
  });

  it("동행견이 한 마리면 한 줄로 선다", () => {
    const html = renderOverview();

    expect(html).toContain("몽");
    expect(html).toContain("폼스키");
  });
});
```

`renderOverview` 헬퍼가 없으면 이 파일의 기존 render 헬퍼 이름·시그니처에 맞춘다. 픽스처의 반려견 이름·견종이 `몽`/`폼스키` 가 아니면 실제 값으로 바꾼다.

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/features/plan/plan-detail.test.ts`
Expected: FAIL — `2026년` 이 아직 있고 축 라벨이 배지에 붙어 있다.

- **Step 3: 카드 본문을 세 구획으로 다시 쓴다**

`PlanOverviewPanel` 의 `<Surface>` 안을 아래로 바꾼다. 바깥 fragment 와 `{action}` 슬롯은 그대로 둔다.

```tsx
<Surface>
  <div className={cn("flex flex-col gap-4 py-4 md:py-5", INSET_CLASS.card)}>
    {/* ── 구획 1: 신원 — 상태 · 제목 · 동행견 */}
    <div className="flex flex-col gap-2">
      {/*
              **`초안` 배지가 제목 줄을 떠났다** (#841). 제목이 2~3줄로 접힐 때 배지가
              제목 첫 줄 옆에 붙어 있어 x 위치가 제목 길이를 따라 흔들렸다. eyebrow 줄로
              올리면 `h1` 이 자기 줄을 온전히 쓴다.
            */}
      <div className="flex items-center gap-2">
        <PlanStatusBadge status={plan.status} />
        {menu !== null && <div className="ml-auto">{menu}</div>}
      </div>

      <h1 className="text-title-1 text-fg lg:text-display font-bold break-keep lg:font-extrabold">
        {plan.title}
      </h1>

      <PlanPetCard companions={companions} pending={petPending} />
    </div>

    {/* ── 구획 2: 상태 — D-day 가 이 카드의 헤드라인이다 (#841) */}
    <div className="border-border flex flex-col gap-1 border-t pt-4">
      {phaseText !== null && (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-title-1 text-fg font-bold tabular-nums">
            {phaseText}
          </span>
        </p>
      )}

      <p className="text-caption text-fg-muted flex flex-wrap gap-x-2 font-medium tabular-nums">
        <span>
          {formatPlanDateRangeCompact(plan.startDate, plan.endDate, today)}
        </span>
        <span aria-hidden>·</span>
        <span>
          {messages.plan.totalDays.replace("{days}", String(plan.totalDays))}
        </span>
        {/*
                **예산이 없으면 줄이 아예 없다** (#841). `예산 미정` 은 사실이 아니라 빈
                상태이고, 액션으로 이어지지 않는 빈 상태를 사실처럼 적으면 잡음만 남는다.
              */}
        {plan.budget !== null && (
          <>
            <span aria-hidden>·</span>
            <span>
              {messages.plan.budgetLabel}{" "}
              {messages.plan.budgetAmount.replace(
                "{amount}",
                plan.budget.toLocaleString("ko-KR"),
              )}
            </span>
          </>
        )}
      </p>
    </div>

    {/* ── 구획 3: 일자별 적합도 목차 */}
    <PlanVerdictToc verdicts={verdicts} />
  </div>
</Surface>
```

`formatPlanDateRange` import 를 `formatPlanDateRangeCompact` 로 바꾸고, 머리주석의 "제목 줄도 카드다" 항목 아래에 세 구획 결정을 적는다.

- **Step 4: `PlanPhaseVerdictStrip` 을 `PlanVerdictToc` 로 바꾼다**

같은 파일 아래쪽의 `PlanPhaseVerdictStrip` 을 아래로 교체한다. `phaseText` 는 더 이상 받지 않는다 — 구획 2 로 갔다.

```tsx
/**
 * 스트립에 세우는 일자 수의 상한 (#732 · #841).
 *
 * **세로 목록으로 돌아오면서 4 → 7 이 됐다.** 가로 wrap 이던 동안에는 390 에서 두 줄에
 * 넷이 상한이었다. 세로는 줄당 44px 이라 일곱이면 308px 이고, 그 이상은 요약이 아니라
 * 목록이 된다. **여행은 최대 30일이다** (`PLAN_PERIOD_MAX_DAYS`) — 넘치는 일자는 개수로만
 * 말하고 판정 자체는 아래 일자 카드가 그대로 갖는다.
 */
export const PLAN_VERDICT_STRIP_MAX_DAYS = 7;

/**
 * 일자별 적합도 목차 (#732 · #841).
 *
 * ## 세로로 돌아왔다
 *
 * #732 는 데스크톱 전용 목차 **카드**를 걷어내고 가로 한 줄로 접었다. 걷어낼 이유였던 것은
 * `hidden lg:block` 이었지 **세로 레이아웃 자체가 아니었다** — 카드를 만들지 않고 개요 카드
 * 안에 두면 모든 폭에서 서므로 그 결정이 지켜진다.
 *
 * 가로 wrap 이 잃고 있던 것 셋: ① `D-N` 과 같은 줄이라 wrap 되면 마지막 일자가 고아 행이
 * 됐고 ② 앵커라는 신호(`›`)가 없어 누르는 것인 줄 몰랐고 ③ 배지마다 축 라벨이 붙어
 * `적합도` 가 한 카드에서 세 번 섰다.
 *
 * **축 라벨은 섹션 머리가 한 번만 갖는다.** 그래서 배지에 `axis` 를 주지 않는다 — #652 의
 * 요구("혼잡도의 `보통` 과 구분")를 섹션 라벨이 충족하고, 스크린리더용 이름은 `nav` 의
 * `aria-label` 이 계속 갖는다.
 */
function PlanVerdictToc({ verdicts }: { verdicts: PlanDayWeatherItem[] }) {
  if (verdicts.length === 0) return null;

  const shown = verdicts.slice(0, PLAN_VERDICT_STRIP_MAX_DAYS);
  const hidden = verdicts.length - shown.length;

  return (
    <nav
      aria-label={messages.plan.verdictTocTitle}
      className="border-border border-t pt-4"
    >
      <p className="text-caption text-fg-muted mb-1 font-medium">
        {messages.plan.verdictTocTitle}
      </p>

      <ul className="flex flex-col">
        {shown.map((verdict) => (
          <li key={verdict.day} className="border-border not-first:border-t">
            {/* 44px 터치 영역 (D6) */}
            <a
              href={`#${planDayAnchorId(verdict.day)}`}
              className="focus-visible:ring-brand-500 hover:bg-band flex min-h-11 items-center gap-2 focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="text-body-2 text-fg font-medium tabular-nums">
                {messages.plan.dayLabel.replace("{day}", String(verdict.day))}
              </span>

              <span className="ml-auto">
                {verdict.suitabilityLevel === null ? (
                  // 판정을 못 낸 날을 낮은 등급으로 칠하지 않는다 — 점선 unknown 이다
                  <MetricBadge tone="unknown" size="sm">
                    {messages.plan.verdictTocUnavailable}
                  </MetricBadge>
                ) : (
                  <MetricBadge
                    tone={suitabilityTone(verdict.suitabilityLevel.code)}
                    size="sm"
                  >
                    {verdict.suitabilityLevel.name}
                  </MetricBadge>
                )}
              </span>

              <ChevronRightIcon
                size={16}
                className="text-fg-subtle shrink-0"
                aria-hidden
              />
            </a>
          </li>
        ))}
      </ul>

      {/* 남은 일자를 없는 척하지 않는다 — 판정 자체는 아래 일자 카드가 그대로 갖는다 */}
      {hidden > 0 && (
        <p className="text-caption text-fg-muted mt-2 font-medium tabular-nums">
          {messages.plan.verdictStripMore.replace("{count}", String(hidden))}
        </p>
      )}
    </nav>
  );
}
```

`ChevronRightIcon` 을 이 저장소가 쓰는 아이콘 소스에서 import 한다 — `walk-verdict.tsx` 의 `ChevronDownIcon` import 줄을 보고 같은 패키지를 쓴다.

- **Step 5: 동행견 한 줄 갈래를 더한다**

`PlanPetCard` 를 바꾼다. 여러 마리는 지금 형태 그대로다.

```tsx
/**
 * 동행 반려견. **조회 실패는 숨김이다** — 카드만 빠지고 오류를 말하지 않는다 (D5).
 *
 * **한 마리면 한 줄이다** (#841). #218 이 전원 나열을 요구한 근거는 "일자 판정이
 * `verdictBasisPet` 으로 부르는 이름이 반드시 이 카드 안에 있어야 한다" 인데, **한 마리면
 * `basisPetName` 이 `null` 이라 일자 카드가 이름을 부르지 않는다** (`plan-day-verdict.tsx`
 * 의 `basisPetName` JSDoc). 그 요구는 여러 마리일 때만 생기므로, 여러 마리는 전원을 한
 * 줄씩 그대로 세운다 — 최대 5마리라 길어지지 않는다.
 */
function PlanPetCard({
  companions,
  pending,
}: {
  companions: readonly Pet[];
  pending: boolean;
}) {
  if (pending) return <Skeleton className="h-7 w-40" />;
  if (companions.length === 0) return null;

  if (companions.length === 1) {
    const pet = companions[0] as Pet;
    const traits = [pet.breed, pet.sizeType.name].filter(
      (part): part is string => part !== null && part.length > 0,
    );

    return (
      <div className="flex items-center gap-2">
        <PetAvatar name={pet.name} size="md" />
        <p className="text-caption text-fg-muted min-w-0 truncate font-medium">
          <span className="text-fg font-semibold">{pet.name}</span>
          {traits.length > 0 && ` · ${traits.join(" ")}`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      {companions.map((pet) => (
        <PlanPetRow key={pet.petId} pet={pet} />
      ))}
    </div>
  );
}
```

- **Step 6: 통과를 확인한다**

Run: `pnpm vitest run src/features/plan/plan-detail.test.ts`
Expected: PASS. 기존 테스트가 옛 마크업(`적합도` 축 라벨, `2026년`)을 assert 하고 있으면 그 assertion 을 새 구조에 맞게 고친다 — **테스트를 지우지 말고 고친다.**

- **Step 7: 커밋**

```bash
git add src/features/plan/plan-overview-panel.tsx src/features/plan/plan-detail.test.ts
git commit -m "[FE] feat: 개요 카드를 신원·상태·목차 세 구획으로 나눈다 (#841)"
```

---

### Task 9: 준비물 빈 상태

**Files:**

- Create: `public/illustrations/packing-empty.svg`
- Modify: `src/features/plan/plan-packing-list.tsx` (`Intro` `:284`, `AddSection` `:558-564`, `Result` 캡션)
- Modify: `src/lib/messages/plan.ts:173`
- Test: `src/features/plan/plan-packing-list.test.ts`

**Interfaces:**

- Consumes: 없음
- Produces: `messages.plan.packingIntro` 의 **`{petName}` 치환자**. `Intro` 가 대표 동행견 이름을 받아 치환하고, 못 찾으면 `messages.plan.packingIntroFallbackPet`(`반려견`)으로 떨어진다.

- **Step 1: 일러스트를 만든다**

`public/illustrations/packing-empty.svg` — 기존 `place-*.svg` 를 열어 **뷰박스·stroke 폭·색 지정 방식을 그대로 따른다.** 플랫 라인 여행 가방 1개, 단색이다. 사진인 척하지 않는다.

- **Step 2: 실패하는 테스트를 쓴다**

```ts
/* 빈 상태가 미완성으로 읽히지 않게 한다 (#841) */
describe("PackingListPanel — 빈 상태", () => {
  it("일러스트와 한 문장이 선다", () => {
    const html = renderPacking({
      list: { items: [], checkedCount: 0, generatedAt: null },
    });

    expect(html).toContain("/illustrations/packing-empty.svg");
    expect(html).toContain("의 특성을 읽고 챙길 것을 골라요");
  });

  it("저장 안내가 빈 상태에 서지 않는다", () => {
    const html = renderPacking({
      list: { items: [], checkedCount: 0, generatedAt: null },
    });

    expect(html).not.toContain(messages.plan.packingSavedNote);
  });

  it("동행견을 못 찾으면 반려견으로 떨어진다", () => {
    const html = renderPacking({
      list: { items: [], checkedCount: 0, generatedAt: null },
      petName: null,
    });

    expect(html).toContain(messages.plan.packingIntroFallbackPet);
  });
});
```

`renderPacking` 헬퍼와 `list` 픽스처 모양은 이 파일의 기존 것을 쓴다.

- **Step 3: 실패를 확인한다**

Run: `pnpm vitest run src/features/plan/plan-packing-list.test.ts`
Expected: FAIL

- **Step 4: 문구를 바꾼다**

`src/lib/messages/plan.ts` 의 `packingIntro` 를 교체하고 폴백 낱말을 더한다.

```ts
  /**
   * 빈 상태의 **한 문장** (#841). 예전에는 41자 + 저장 안내 22자로 두 문장이었는데, CTA
   * 하나에 붙기에 무거웠고 **AI 가 무엇을 골라 주는지 짐작할 단서는 여전히 0** 이었다 —
   * 그 일은 이제 일러스트가 맡는다. `{petName}` 은 대표 동행견 이름이다.
   */
  packingIntro: '날짜 · 장소 · 예보 · {petName}의 특성을 읽고 챙길 것을 골라요.',
  /** 동행견을 못 찾았을 때 `{petName}` 자리 — **이름을 지어내지 않는다** */
  packingIntroFallbackPet: '반려견',
```

- **Step 5: `Intro` 를 다시 쓴다**

```tsx
/** 아직 만든 적 없다 — `generatedAt` 이 null 인 갈래 하나뿐이다 */
function Intro(props: PackingListPanelProps) {
  const { generateFailed, onGenerate, petName } = props;
  const intro = messages.plan.packingIntro.replace(
    "{petName}",
    petName ?? messages.plan.packingIntroFallbackPet,
  );

  return (
    <div className="flex flex-col gap-3">
      {/*
        **빈 칸을 메우는 일러스트다** (#841). 결과의 *모양*을 칩으로 미리 보여 주는 안은
        기각했다 — 칩 문구가 실제 AI 응답과 어긋나면 화면이 하지 않은 약속을 한 것이 된다
        (`lib/place/illustration.ts` 가 "우리가 아는 것만 말한다"를 요구한 것과 같은 규율).
        장식이 아니라 자리 채움이므로 `alt=""` 다.
      */}
      <div className="bg-band flex flex-col items-center gap-3 rounded-md px-4 py-6">
        <img
          src="/illustrations/packing-empty.svg"
          alt=""
          width={64}
          height={56}
        />
        {/*
          `text-fg-muted` 를 쓰지 않는 근거는 #397 — 이 문장이 CTA 를 누를지 정하는 유일한
          근거다. **`packingSavedNote` 는 여기 없다** (#841): 저장 여부가 실제로 궁금해지는
          것은 목록이 생긴 뒤라 `Result` 캡션으로 옮겼다.
        */}
        <p className="text-body-2 text-fg text-center break-keep">{intro}</p>
      </div>

      {/*
        생성 실패 코드가 `AIPLAN_016` 하나다 — 일정이 없거나 본인 소유가 아니면 같은
        코드라 화면이 두 경우를 구분해 말하지 않는다.

        **재시도 버튼을 두 개 두지 않는다** — `ErrorState` 가 이미 하나를 갖고 있다.
        **일러스트 면과 안내 문장은 실패해도 남는다** — 다시 눌렀을 때 무엇이 만들어지는지가
        화면에 있어야 한다.
      */}
      {generateFailed ? (
        <ErrorState
          inset="card"
          title={messages.plan.packingErrorTitle}
          onRetry={onGenerate}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onGenerate}>
            {messages.plan.packingCta}
          </Button>
          {/* AI 를 부르기 전에도 직접 적어 둘 수 있다 — 그 항목은 생성·재생성에도 남는다 */}
          <AddSection {...props} categories={[]} />
        </div>
      )}
    </div>
  );
}
```

`PackingListPanelProps` 에 `petName: string | null` 을 더하고, 호출부(`plan-detail-section.tsx:249` 근처의 `<PlanPackingList>`)가 대표 동행견 이름을 내려 주게 한다. **`PlanPackingList` 가 이미 `companions` 를 안 받으면** 호출부에서 `companions[0]?.name ?? null` 로 만들어 넘긴다.

- **Step 6: `AddSection` 의 접힘 버튼 variant 를 올린다**

`:558-564` 의 `!open` 갈래만 바꾼다. 열림 동작은 그대로다.

```tsx
if (!open) {
  return (
    // **`ghost` 가 아니라 `secondary` 다** (#841). 테두리도 채움도 없어 CTA 아래 맨텍스트로
    // 읽히던 것이 원인이었다 — 두 진입점이 같은 줄에 나란히 서야 위계가 보인다
    <Button
      variant="secondary"
      onClick={() => setOpen(true)}
      className="self-start"
    >
      {messages.plan.packingAddAction}
    </Button>
  );
}
```

- **Step 7: 저장 안내를 `Result` 로 옮긴다**

`Result` 컴포넌트의 목록 아래에 캡션 한 줄을 더한다.

```tsx
{
  /* 저장된다는 사실은 목록이 생긴 뒤에 궁금해진다 (#841 — 빈 상태에서 옮겨 왔다) */
}
<p className="text-caption text-fg-muted font-medium">
  {messages.plan.packingSavedNote}
</p>;
```

- **Step 8: 통과를 확인한다**

Run: `pnpm vitest run src/features/plan/plan-packing-list.test.ts`
Expected: PASS. 기존 테스트가 옛 `packingIntro` 전문을 assert 하면 새 문구로 고친다.

- **Step 9: 전체 검증 후 커밋**

Run: `pnpm verify && pnpm format:check`

```bash
git add public/illustrations/packing-empty.svg src/features/plan/plan-packing-list.tsx src/features/plan/plan-packing-list.test.ts src/features/plan/plan-detail-section.tsx src/lib/messages/plan.ts
git commit -m "[FE] feat: 준비물 빈 상태에 일러스트와 한 문장을 세운다 (#841)"
```

---

### Task 10: 390 실측

**Files:** 없음 (계측)

- **Step 1: 워크트리 dev 서버를 띄운다**

`.env.local` 을 워크트리로 복사하고 빈 포트로 띄운다(`AUTH_SESSION_SECRET` 이 없으면 500, 심링크 `node_modules` 면 Turbopack FATAL 이라 `--webpack` 을 붙인다).

```bash
pnpm dev:alt2 -- --webpack
```

- **Step 2: 390 폭에서 좌 레일을 잰다**

브라우저 패널을 **보이는 상태로** 둔 채(숨기면 rAF·폴링이 멈춘다) 390 으로 리사이즈하고, 3일 일정 상세에서 `AI로 준비물 챙기기` 버튼의 `getBoundingClientRect().top` 을 잰다.

- **Step 3: 판정한다**

두 번째 스크롤(약 1600px) 안에 들어오면 통과다. 넘으면 [#841](https://github.com/8llow8llowMe/hondigagae/issues/841) 에 실측값을 적고 `PLAN_VERDICT_STRIP_MAX_DAYS` 를 낮출지 논의한다.

---

# Phase 3 — 이슈 #842: 일차 카드 + 썸네일 폴백

브랜치: `feature/fe/842-day-card-verdict-band` (#840 머지 뒤 `develop` 에서 딴다)

## File Structure

| 파일                                             | 책임                 | 변경                               |
| ------------------------------------------------ | -------------------- | ---------------------------------- |
| `src/lib/plan/illustration.ts`                   | 항목 유형 → 일러스트 | 신규                               |
| `src/features/plan/plan-day-verdict.tsx`         | 일자 판정            | tint 밴드로 감싸고 근거를 불릿으로 |
| `src/features/plan/plan-day-section.tsx`         | 일자 카드            | `이 날 산책 코스` 를 액션 줄로     |
| `src/features/plan/plan-item-row.tsx`            | 항목 행              | 썸네일 폴백                        |
| `src/lib/messages/plan.ts`                       | 문구                 | `walkAction` 교체                  |
| `public/illustrations/plan-item-{walk,move}.svg` | 자산                 | 신규 2종                           |

---

### Task 11: `planItemIllustration`

**Files:**

- Create: `src/lib/plan/illustration.ts`
- Create: `src/lib/plan/illustration.test.ts`
- Create: `public/illustrations/plan-item-walk.svg`
- Create: `public/illustrations/plan-item-move.svg`

**Interfaces:**

- Consumes: 없음
- Produces: `planItemIllustration(itemTypeCode: string | null): string | null` — 일러스트 경로, 모르는 코드는 `null`.

- **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from "vitest";

import { planItemIllustration } from "@/lib/plan/illustration";

/* 회색 타일이 예외가 아니라 기본이었다 — 이미지 없는 장소가 70% 다 (#842) */
describe("planItemIllustration — 항목 유형으로 타일을 채운다", () => {
  it("다섯 유형이 모두 일러스트를 갖는다", () => {
    expect(planItemIllustration("LODGING")).toBe(
      "/illustrations/place-lodging.svg",
    );
    expect(planItemIllustration("MEAL")).toBe(
      "/illustrations/place-restaurant.svg",
    );
    expect(planItemIllustration("PLACE")).toBe(
      "/illustrations/place-tourist_spot.svg",
    );
    expect(planItemIllustration("WALK")).toBe(
      "/illustrations/plan-item-walk.svg",
    );
    expect(planItemIllustration("MOVE")).toBe(
      "/illustrations/plan-item-move.svg",
    );
  });

  /* 유형을 지어내지 않는다 — 호출부가 회색 타일로 떨어뜨린다 */
  it("모르는 코드와 빈 값은 null 이다", () => {
    expect(planItemIllustration("SOMETHING_NEW")).toBeNull();
    expect(planItemIllustration("")).toBeNull();
    expect(planItemIllustration(null)).toBeNull();
  });

  /* 한국어를 키로 쓰는 매핑은 이 저장소가 금지한다 (api-integration-guide §6) */
  it("한국어 이름으로는 고르지 않는다", () => {
    expect(planItemIllustration("숙박")).toBeNull();
  });
});
```

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/lib/plan/illustration.test.ts`
Expected: FAIL — 모듈이 없다.

- **Step 3: 자산 2종을 만든다**

`public/illustrations/plan-item-walk.svg` · `plan-item-move.svg` — 기존 `place-*.svg` 의 뷰박스·stroke 폭·색 지정을 그대로 따른다. 산책은 발자국 또는 길, 이동은 화살표 계열 한 가지다.

- **Step 4: 구현한다**

```ts
/**
 * 일정 항목 타일의 일러스트 — 사진이 없는 항목의 자리를 채운다 (#842).
 *
 * **키가 `contentType` 이 아니라 `itemType` 이다.** `PlanItemPlace` 에는 `contentType` 이
 * 없어서(`addr1` · `indoor` · `firstImage` · `lat` · `lng` 뿐, `types/plan.ts`) `/places`
 * 목록과 홈이 쓰는 `placeIllustration(contentTypeCode)` 를 이 행에서 부를 수 없다. 대신
 * `item.itemType.code` 가 다섯 값 중 하나로 늘 온다 (`PLAN_ITEM_TYPES`).
 *
 * **`lib/place/illustration.ts` 를 고치지 않는다.** 두 표가 같은 파일 몇 개를 가리키지만
 * **키가 다른 두 매핑**이지 중복이 아니다 — 장소 도메인은 계속 `contentType` 으로 고른다.
 *
 * **유형을 지어내지 않는다.** 자산이 없는 코드에는 아무것도 주지 않고 `null` 을 돌려
 * 호출부가 회색 타일로 떨어뜨리게 한다 (`place/illustration.ts` 와 같은 판단).
 *
 * `itemType` 은 metadata 객체(`{code,name}`)로 오므로 호출부가 `code` 를 넘긴다.
 * **`name`(한국어)으로 고르지 않는다** — 서버 문구가 바뀌면 조용히 깨지고, 한국어를 키로
 * 쓰는 매핑 테이블은 이 저장소가 금지한다 (api-integration-guide §6).
 */
const BY_ITEM_TYPE: Record<string, string> = {
  PLACE: "/illustrations/place-tourist_spot.svg",
  MEAL: "/illustrations/place-restaurant.svg",
  LODGING: "/illustrations/place-lodging.svg",
  WALK: "/illustrations/plan-item-walk.svg",
  MOVE: "/illustrations/plan-item-move.svg",
};

/** 그릴 일러스트의 경로. 없으면 `null` — 호출부가 회색 타일로 떨어뜨린다 */
export function planItemIllustration(
  itemTypeCode: string | null,
): string | null {
  if (itemTypeCode === null || itemTypeCode.length === 0) return null;

  return BY_ITEM_TYPE[itemTypeCode] ?? null;
}
```

- **Step 5: 통과를 확인한다**

Run: `pnpm vitest run src/lib/plan/illustration.test.ts`
Expected: PASS (3 tests)

- **Step 6: 커밋**

```bash
git add src/lib/plan/illustration.ts src/lib/plan/illustration.test.ts public/illustrations/plan-item-walk.svg public/illustrations/plan-item-move.svg
git commit -m "[FE] feat: 항목 유형으로 타일 일러스트를 고른다 (#842)"
```

---

### Task 12: 항목 행 썸네일 폴백

**Files:**

- Modify: `src/features/plan/plan-item-row.tsx:130` · `:168-200`
- Test: `src/features/plan/plan-item-row.test.ts`

**Interfaces:**

- Consumes: Task 11 의 `planItemIllustration`
- Produces: 없음

- **Step 1: 실패하는 테스트를 쓴다**

```ts
/* 회색 타일은 예외여야 한다 (#842) */
describe("PlanItemRow — 썸네일 폴백", () => {
  it("사진이 없으면 항목 유형 일러스트가 선다", () => {
    const html = renderRow({ firstImage: null, itemTypeCode: "LODGING" });

    expect(html).toContain("/illustrations/place-lodging.svg");
  });

  it("사진이 있으면 사진이 이긴다", () => {
    const html = renderRow({
      firstImage: "https://example.test/a.jpg",
      itemTypeCode: "LODGING",
    });

    expect(html).not.toContain("/illustrations/place-lodging.svg");
  });

  it("모르는 유형은 회색 타일 그대로다", () => {
    const html = renderRow({ firstImage: null, itemTypeCode: "SOMETHING_NEW" });

    expect(html).not.toContain("/illustrations/");
  });
});
```

`renderRow` 헬퍼는 이 파일의 기존 것을 쓰고, `itemTypeCode` 를 받도록 넓힌다.

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/features/plan/plan-item-row.test.ts`
Expected: FAIL

- **Step 3: 폴백을 더한다**

`:130` 아래에 한 줄을 더하고, 타일 안 갈래를 셋으로 늘린다.

```tsx
const thumbnail = imageSrc(place?.firstImage ?? walkCourse?.firstImage ?? null);
// 사진이 없으면 유형 일러스트 — 회색 타일은 유형을 모를 때만이다 (#842)
const illustration =
  thumbnail === null ? planItemIllustration(item.itemType.code) : null;
```

```tsx
{
  thumbnail !== null ? (
    <Image
      src={thumbnail}
      alt=""
      fill
      sizes="(min-width: 1024px) 96px, 80px"
      className="object-cover"
    />
  ) : illustration !== null ? (
    /* 장식이므로 alt="" — 무엇인지는 제목과 유형 배지가 말한다 (`lib/plan/illustration.ts`) */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={illustration}
      alt=""
      className="absolute inset-0 size-full object-cover"
    />
  ) : (
    <span className="text-fg-subtle absolute inset-0 flex items-center justify-center">
      <ImageIcon size={20} />
    </span>
  );
}
```

`eslint-disable` 주석은 `place-row.tsx:115` 가 같은 자리에서 쓰는 형태를 그대로 따른다 — 그 파일을 열어 확인하고, 없으면 이 줄도 뺀다.

- **Step 4: 통과를 확인한다**

Run: `pnpm vitest run src/features/plan/plan-item-row.test.ts`
Expected: PASS

- **Step 5: 커밋**

```bash
git add src/features/plan/plan-item-row.tsx src/features/plan/plan-item-row.test.ts
git commit -m "[FE] feat: 사진이 없는 항목 타일을 유형 일러스트로 채운다 (#842)"
```

---

### Task 13: 판정을 tint 밴드로

**Files:**

- Modify: `src/features/plan/plan-day-verdict.tsx:89-135`
- Test: `src/features/plan/plan-day-verdict.test.ts`

**Interfaces:**

- Consumes: `METRIC_TINT_TONE` · `METRIC_TINT_EDGE_TONE` (`components/metric.tsx`), `MetricBadge surface="tint"`
- Produces: `PlanDayVerdict` 의 prop 은 그대로다. **`이 날 산책` 버튼이 이 컴포넌트를 떠난다** — Task 14 가 `plan-day-section.tsx` 에서 받는다. `representativePlaceId` 를 읽는 책임도 함께 옮긴다.

- **Step 1: 실패하는 테스트를 쓴다**

```ts
/* 판정이 자기 영역을 갖는다 (#842) */
describe("PlanDayVerdict — tint 밴드", () => {
  it("등급 tint 면과 -500 실선이 짝으로 선다", () => {
    const html = render();

    expect(html).toContain("bg-metric-high-100");
    expect(html).toContain("border-metric-high-500");
  });

  it("밴드 위 배지는 면과 채움을 맞바꾼다", () => {
    const html = render();

    // BADGE_TONE_ON_TINT — 채움이 --bg, 테두리가 -500 이다
    expect(html).toContain("border-metric-high-500");
  });

  it("근거를 전부 불릿으로 세운다", () => {
    const html = render();

    expect(html).toContain("<ul");
    expect(html).not.toContain("aria-expanded");
  });

  it("판정을 못 낸 날은 중립 면에 문장만 든다", () => {
    const html = render({
      score: null,
      suitabilityLevel: null,
      unavailableReasonCode: "PAST_DATE",
    });

    expect(html).toContain("bg-band");
    expect(html).toContain(messages.plan.verdictPastDate);
  });

  /* 말할 것이 없으면 자리도 만들지 않는다 — 빈 밴드가 서면 안 된다 */
  it("할 말이 없는 날은 밴드 자체가 없다", () => {
    const html = render(
      {
        score: null,
        suitabilityLevel: null,
        unavailableReasonCode: "NO_PLACE_ITEM",
      },
      { dayHasItems: false },
    );

    expect(html).toBe("");
  });

  /* 체감온도는 중립 수치다 — 등급 색을 숫자에 쓰지 않는다 (DESIGN.md §2-3) */
  it("온도 값에 등급 색을 쓰지 않는다", () => {
    const html = render();

    expect(html).not.toContain("text-metric-high-500");
  });
});
```

`render` 헬퍼는 이 파일에 이미 있다. `suitabilityLevel` 픽스처의 등급이 `high` 가 아니면 톤에 맞춰 문자열을 바꾼다.

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/features/plan/plan-day-verdict.test.ts`
Expected: FAIL

- **Step 3: 밴드를 만든다**

`PlanDayVerdict` 의 두 반환 갈래를 아래로 바꾼다. `failed` 갈래는 그대로 둔다.

```tsx
if (verdict === undefined) return null;

if (verdict.score === null || verdict.suitabilityLevel === null) {
  // 등급 배지를 만들지 않는다. 무엇을 말할지는 사유 코드가 정한다
  const sentence = unavailableSentence(verdict, dayHasItems);

  // **말할 것이 없으면 자리도 만들지 않는다** — 빈 밴드만 남는다
  if (sentence === null) return null;

  return (
    <div
      className={cn(
        VERDICT_BAND_CLASS,
        METRIC_TINT_TONE.unknown,
        METRIC_TINT_EDGE_TONE.unknown,
      )}
    >
      <p className="text-body-2 text-fg-muted">{sentence}</p>
    </div>
  );
}

const tone = suitabilityTone(verdict.suitabilityLevel.code);

return (
  /*
      **판정이 자기 영역을 갖는다** (#842). 예전에는 헤더와 같은 인셋·같은 바닥이라 근거
      문장이 "1일차의 설명" 인지 "첫 항목의 설명" 인지 갈리지 않았다.

      **면만 깔지 않는다** — `-500` 실선이 짝이다 (DESIGN.md §2-3 · #709). tint 는 바닥과
      밝기로 갈리지 않아(1.01~1.06:1) 면만으로는 적록색약에게 칠하지 않은 것과 같다.
    */
  <div
    className={cn(
      VERDICT_BAND_CLASS,
      METRIC_TINT_TONE[tone],
      METRIC_TINT_EDGE_TONE[tone],
    )}
  >
    <div className="flex flex-wrap items-center gap-3">
      {/*
          **`surface="tint"` 다.** 같은 톤의 tint 면 위에서 기본 채움은 배경과 1.00:1 이라
          배지가 사라진다 — 면과 채움을 맞바꾼다 (`BADGE_TONE_ON_TINT`).

          **축 라벨(`axis`)은 그대로 둔다.** 좌 레일 목차와 달리 여기는 섹션 라벨이 없어,
          떼면 `보통` 이 혼잡도의 `보통` 과 구분되지 않는다 (#652).
        */}
      <MetricBadge tone={tone} surface="tint" axis="suitability">
        {verdict.suitabilityLevel.name}
      </MetricBadge>

      <div className="ml-auto text-right">
        <VerdictTemperatureValue weather={verdict.weather} />
      </div>
    </div>

    {/*
        서버 순서를 유지한다 — `reasons` 는 점수 영향이 큰 순서로 온다. 정보성
        (`scoreDelta === 0`)만 한 단계 흐리게 내린다. **접지 않는다** (#840).
      */}
    <ReasonList
      className="list-disc pl-5"
      reasons={verdict.reasons.map((reason) => ({
        description: reason.description,
        informational: reason.scoreDelta === 0,
      }))}
    />

    <PlanVerdictNotes
      petConditionApplied={petConditionApplied}
      basisPetName={basisPetName}
    />
  </div>
);
```

파일 위쪽에 상수를 더한다.

```tsx
/**
 * 판정 밴드의 골격 — 색은 `METRIC_TINT_TONE` · `METRIC_TINT_EDGE_TONE` 이 얹는다 (#842).
 *
 * 인셋을 스스로 갖는다: 담는 쪽(`plan-day-section`)이 카드 인셋을 주는 자리 **안**에
 * 서지만, 밴드는 그보다 좁게 들어가야 면의 좌우 경계가 보인다.
 */
const VERDICT_BAND_CLASS =
  "my-4 flex flex-col gap-3 rounded-md border px-4 py-3";
```

`ReasonList` 의 `className` 에 `list-disc pl-5` 를 주면 `<ul>` 에 그대로 붙는다(Task 1 의 시그니처).

- **Step 4: `이 날 산책` 버튼을 뺀다**

`VerdictTemperatureValue` 아래에 있던 `ButtonLink` 블록과 `ButtonLink` import 를 지운다. Task 14 가 받는다.

- **Step 5: 통과를 확인한다**

Run: `pnpm vitest run src/features/plan/plan-day-verdict.test.ts`
Expected: PASS. 기존 테스트가 `이 날 산책` 을 이 컴포넌트에서 찾으면 그 assertion 을 Task 14 의 테스트로 옮긴다.

- **Step 6: 커밋**

```bash
git add src/features/plan/plan-day-verdict.tsx src/features/plan/plan-day-verdict.test.ts
git commit -m "[FE] feat: 일자 판정을 등급 tint 밴드로 세운다 (#842)"
```

---

### Task 14: `이 날 산책 코스` 를 액션 줄로

**Files:**

- Modify: `src/features/plan/plan-day-section.tsx` (액션 줄, 약 `:290-310`)
- Modify: `src/lib/messages/plan.ts` (`walkAction`)
- Test: `src/features/plan/plan-day-section.test.ts`

**Interfaces:**

- Consumes: Task 13 이 비운 자리
- Produces: `PlanDaySection` 이 `representativePlaceId` 를 `verdict?.representativePlaceId ?? null` 로 읽어 액션 줄에 쓴다. 새 prop 은 없다 — `verdict` 를 이미 받는다.

- **Step 1: 실패하는 테스트를 쓴다**

```ts
/* 액션을 한 자리로 모은다 (#842 · #653 의 완결) */
describe("PlanDaySection — 액션 줄", () => {
  it("산책 코스 버튼이 액션 줄에 있다", () => {
    const html = renderSection();

    expect(html).toContain(messages.plan.walkAction);
    // 장소 추가 · 순서 편집과 같은 줄이다 — 판정 밴드보다 뒤에 온다
    expect(html.indexOf(messages.plan.walkAction)).toBeGreaterThan(
      html.indexOf(messages.plan.addPlaceAction),
    );
  });

  it("기준 장소가 없으면 버튼이 없다", () => {
    const html = renderSection({ verdict: { representativePlaceId: null } });

    expect(html).not.toContain(messages.plan.walkAction);
  });
});
```

`messages.plan.addPlaceAction` 은 실제 키 이름으로 바꾼다 — `plan.ts` 에서 `장소 추가` 를 찾아 확인한다.

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/features/plan/plan-day-section.test.ts`
Expected: FAIL

- **Step 3: 문구를 바꾼다**

```ts
  /**
   * 일자 판정에서 대표 장소 상세로 나가는 링크 (#842). **목적지를 말한다** — `이 날 산책`
   * 이던 동안에는 무엇이 열리는지 라벨에 없었다. 실제로 여는 것은
   * `representativePlaceId` 의 장소 상세다.
   */
  walkAction: '이 날 산책 코스',
```

- **Step 4: 액션 줄에 버튼을 더한다**

`plan-day-section.tsx` 의 액션 줄(`{!editing && (<div className={cn('flex flex-wrap items-center gap-2 pt-3 pb-5', INSET_CLASS.card)}>`) 안, `장소 추가`·`순서 편집` 뒤에 더한다.

```tsx
{
  /*
            **판정 줄에서 내려왔다** (#842). #653 이 "읽는 순서와 탭 순서를 맞춘다"로 도구를
            판정 아래로 내렸는데 이 버튼만 판정 줄의 `ml-auto` 에 남아 액션이 두 자리로
            흩어져 있었다. 산책 위험도는 장소 상세가 소유하므로 기준 장소가 없으면 부를
            대상이 없다 — 그때는 버튼도 없다.
          */
}
{
  verdict?.representativePlaceId != null && (
    <ButtonLink
      href={`/places/${verdict.representativePlaceId}`}
      variant="secondary"
      size="sm"
      className="ml-auto"
    >
      {messages.plan.walkAction}
    </ButtonLink>
  );
}
```

`ButtonLink` 가 이 파일에 이미 import 돼 있다(`:5`).

- **Step 5: 통과를 확인한다**

Run: `pnpm vitest run src/features/plan/plan-day-section.test.ts`
Expected: PASS

- **Step 6: 전체 검증 후 커밋**

Run: `pnpm verify && pnpm format:check`

```bash
git add src/features/plan/plan-day-section.tsx src/features/plan/plan-day-section.test.ts src/lib/messages/plan.ts
git commit -m "[FE] feat: 산책 코스 링크를 일자 액션 줄로 모은다 (#842)"
```

---

### Task 15: 대비 실측

**Files:** 없음 (계측)

- **Step 1: 밴드 안 텍스트 크기를 확인한다**

브라우저에서 판정 밴드 안 근거 `<li>` 의 `getComputedStyle().fontSize` 를 잰다. `text-body-2` 가 14px 이상이어야 한다 — 밑돌면 §2-3 의 대비 기준(일반 텍스트 4.5:1)이 대형 텍스트 완화를 못 받는다.

- **Step 2: 네 등급에서 대비를 잰다**

`high` · `mid` · `low` · `critical` 각 tint 면 위의 `-700` 텍스트 대비를 잰다. DESIGN.md §2-3 표의 값(7.39 / 5.16 / 6.62 / 4.55)과 맞는지 확인한다. **`critical` 이 4.55 로 가장 빠듯하다** — 여기서 밑돌면 밴드 안 본문 색을 `--fg` 로 되돌린다.

- **Step 3: `MOVE`·`MEAL` 타일을 눈으로 확인한다**

스크린샷의 `이동` · `점심 식사` 항목에 타일이 채워지는지 본다.

- **Step 4: 결과를 이슈에 남긴다**

[#842](https://github.com/8llow8llowMe/hondigagae/issues/842) 에 실측값을 코멘트로 적는다.

---

### Task 16: 문서 동기화

**Files:**

- Modify: `frontend/docs/features/plan/일정상세-세부명세.md`
- Modify: `frontend/docs/features/공통/등급배지-축라벨-세부명세.md`
- Modify: `frontend/DESIGN.md` (§2-3)

- **Step 1: 세부명세를 고친다**

`일정상세-세부명세.md` 에서 좌 레일 개요 카드 · 준비물 절 · 일차 카드 판정 자리의 서술을 새 구조로 바꾼다. **정본은 코드가 아니라 이 문서다** — 구현과 어긋난 채 남기지 않는다.

- **Step 2: 축 라벨 예외를 적는다**

`등급배지-축라벨-세부명세.md` 에 "좌 레일 일자 목차는 섹션 라벨이 축을 맡아 배지에 `axis` 를 주지 않는다 (#841)" 를 예외로 더한다.

- **Step 3: tint 쓰임을 적는다**

`DESIGN.md` §2-3 의 `METRIC_TINT_TONE` 설명에 일자 판정 밴드를 사용처로 더한다.

- **Step 4: 표 정렬 함정을 피한다**

prettier 가 마크다운 표를 재정렬한다 — **새 셀의 폭을 기존 컬럼 최대폭 이하로** 맞춰야 한 줄 추가가 50줄 diff 가 되지 않는다. 고친 뒤 `pnpm format:check` 로 확인한다.

- **Step 5: 커밋**

```bash
git add frontend/docs/features/plan/일정상세-세부명세.md frontend/docs/features/공통/등급배지-축라벨-세부명세.md frontend/DESIGN.md
git commit -m "[DOCS] docs: 일정 상세 재설계를 세부명세에 반영한다 (#841 #842)"
```

---

## Self-Review 기록

**스펙 커버리지** — §3(Task 7·8) · §4(Task 9) · §5-1~5-4(Task 13·14) · §5-5(Task 11·12) · §6(Task 1~5) · §7(Task 9·11) · §8(Phase 구분) · §9(Task 6·10·15) · §10(Task 16). §2(기각안)와 §11(후속)은 구현 대상이 아니다.

**타입 일관성** — `ReasonList` 는 Task 1 이후 `{ reasons, className }` 하나로 고정이고, Task 2·13 이 그 시그니처만 쓴다. `planItemIllustration` 은 Task 11 에서 정의하고 Task 12 만 부른다. `formatPlanDateRangeCompact` 는 Task 7 에서 정의하고 Task 8 만 부른다.

**남은 함정 셋**

1. **테스트 헬퍼 이름을 확인하고 쓴다.** `renderOverview` · `renderPacking` · `renderRow` · `renderSection` 은 이 계획이 지어낸 이름이다 — 각 테스트 파일의 기존 헬퍼에 맞춰 바꾼다.
2. **픽스처 값을 확인하고 쓴다.** 반려견 이름(`몽`) · 견종(`폼스키`) · `feelsLikeBasis` 앞부분 · 판정 등급 톤(`high`)은 `src/test/fixtures/` 의 실제 값으로 바꾼다.
3. **기존 테스트를 지우지 말고 고친다.** 옛 마크업(`2026년` · 배지 안 축 라벨 · `이 날 산책`)을 assert 하는 테스트가 여럿 있다 — 삭제하면 회귀를 못 잡는다.
