# 브리핑 그날 일정 전체 · 동선 지도 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> 이 계획서는 **착수 시점의 스냅숏**이다 — 진행 상황은 이슈 #1415 와 PR 이 말한다(루트 `CLAUDE.md` #860).

**Goal:** 브리핑 일정 카드가 그날 일정 전부를 간결한 타임라인으로, 지도가 그날 동선을 보이게 한다.

**Architecture:** 브리핑 page 가 이미 서버에서 받는 일정 상세(`planKeys.detail`)를 `HydrationBoundary` 로 넘기고, 뷰가 `usePlanDetail` 로 그날 항목 · 전날 숙소를 골라 `PlanBriefingSection` 에 prop 으로 넘긴다(섹션은 훅 없는 순수 컴포넌트로 남는다). 지도는 `PlanRouteCard` 에서 떼어 낸 `PlanRouteMap` 을 공용으로 쓰고, 목록 번호는 같은 동선 모델(`toPlanRouteModel`)의 `order` 를 받는다.

**Tech Stack:** Next.js App Router · React 19 · TanStack Query(`HydrationBoundary`) · Kakao Maps(`MapCanvas`, `ssr: false`) · vitest(node + `renderToStaticMarkup`)

**Spec:** `frontend/docs/features/plan/여행브리핑-세부명세.md` **D15** (#1415)

## Global Constraints

- BE 변경 없음 — 브리핑 응답 타입(`PlanBriefingSchedule`)은 그대로다
- 판정(날씨 · 골든타임 · 기준 장소)은 브리핑 응답 그대로 — 상세 좌표로 판정을 새로 만들지 않는다(D8-1)
- 브리핑 응답(`planKeys.briefing`)은 서버 프리페치하지 않는다(현행 유지)
- 일정 카드는 **읽기 전용** — 행은 링크가 아니고 방문 토글이 없다
- 기준 매칭은 `itemType.code === 'PLACE'` 인 항목의 `targetId === schedule.representativePlaceId`, 첫 항목 하나
- 길찾기 = 다음 갈 곳: `EVE` 는 좌표 있는 첫 항목, `TODAY` 는 좌표 있고 `visited === false` 인 첫 항목. 없으면 버튼 없음
- 서버 enum 문구는 그대로(`itemType.name`), 한국어 매핑 표 금지
- `PlanRouteCard` 의 겉모습 · 일자 칩 · `?day=` 는 바뀌지 않는다 — `plan-route-card.test.ts` 가 그대로 통과해야 한다
- 카드 `h2` 개수(D13 테스트)는 바뀌지 않는다 — 새 카드는 `h2` 를 더하지 않는다
- 문구는 `src/lib/messages/plan.ts` 에 둔다. 해요체
- 모든 검증은 `frontend/` 에서 `npx vitest run` · `npx tsc --noEmit` · `npx eslint .` · `pnpm -s format:check`

## Review Focus

1. **같은 장소가 하루에 두 번** — 기준 배지는 첫 행 하나에만 붙는다 → Task 1 표 테스트
2. **좌표 있는 항목이 하나도 없는 날**(전부 직접 입력 메모 등) — 지도 · 길찾기가 사라지고 목록 · `이 날 일정 보기` 는 남는다 → Task 3 테스트
3. **오늘 브리핑에서 전부 다녀온 날** — 길찾기 버튼이 없다 → Task 1 표 테스트
4. **기준 장소가 그날 항목에 없음**(서버 기준과 상세가 어긋남) — 예전 `기준 장소 · {title}` 한 줄로 남는다 → Task 3 테스트
5. **상세 캐시가 없음**(뷰가 `null` 을 넘김) — 예전 요약 카드가 그대로 선다 → Task 4 테스트

---

### Task 1: 순수 판단 — 기준 행 · 다음 갈 곳 · 동선 모델

**Files:**

- Create: `frontend/src/lib/plan/briefing-day.ts`
- Test: `frontend/src/lib/plan/briefing-day.test.ts`

**Interfaces:**

- Produces:
  - `export const PLACE_ITEM_TYPE = 'PLACE'`
  - `export function basisItemId(items: readonly PlanItemDetail[], representativePlaceId: string | null): string | null`
  - `export function nextDestination(items: readonly PlanItemDetail[], kind: BriefingTarget['kind']): PlanItemDetail | null`
  - `export function toPlanRouteModel(items: readonly PlanItemDetail[], lodgingBasis: PlanItemDetail | null): RouteModel`

**Step 1: 실패하는 테스트**

```ts
// frontend/src/lib/plan/briefing-day.test.ts
import { describe, expect, it } from "vitest";

import {
  basisItemId,
  nextDestination,
  toPlanRouteModel,
} from "@/lib/plan/briefing-day";
import { planItem, planItemPlace } from "@/test/fixtures/plan";

const LODGING = { code: "LODGING", name: "숙박", description: null };
const MOVE = { code: "MOVE", name: "이동", description: null };

const a = planItem({
  planItemId: "a",
  day: 1,
  sequence: 0,
  targetId: "P1",
  title: "중문",
});
const b = planItem({
  planItemId: "b",
  day: 1,
  sequence: 1,
  targetId: "P2",
  title: "식당",
});
const noCoord = planItem({
  planItemId: "c",
  day: 1,
  sequence: 2,
  targetId: "P3",
  place: null,
});
const move = planItem({
  planItemId: "m",
  day: 1,
  sequence: 3,
  itemType: MOVE,
  targetId: null,
  place: null,
});
const lodging = planItem({
  planItemId: "l",
  day: 1,
  sequence: 4,
  itemType: LODGING,
  targetId: "P1",
});

describe("basisItemId", () => {
  it("PLACE 항목의 targetId 가 대표 장소 id 와 같은 첫 항목", () => {
    expect(basisItemId([a, b], "P2")).toBe("b");
  });
  it("같은 장소가 두 번이면 첫 항목 하나", () => {
    const again = planItem({
      planItemId: "a2",
      day: 1,
      sequence: 5,
      targetId: "P1",
    });
    expect(basisItemId([a, again], "P1")).toBe("a");
  });
  it("PLACE 가 아닌 항목(숙박)의 targetId 는 보지 않는다", () => {
    expect(basisItemId([lodging], "P1")).toBeNull();
  });
  it("대표 장소가 없거나 맞는 항목이 없으면 null", () => {
    expect(basisItemId([a], null)).toBeNull();
    expect(basisItemId([a], "NOPE")).toBeNull();
  });
});

describe("nextDestination", () => {
  it("내일(EVE)은 좌표 있는 첫 항목 — 다녀옴 여부를 보지 않는다", () => {
    expect(
      nextDestination([noCoord, { ...a, visited: true }, b], "EVE")?.planItemId,
    ).toBe("a");
  });
  it("오늘(TODAY)은 좌표 있고 아직 안 간 첫 항목", () => {
    expect(
      nextDestination([{ ...a, visited: true }, noCoord, b], "TODAY")
        ?.planItemId,
    ).toBe("b");
  });
  it("오늘 전부 다녀왔으면 null", () => {
    expect(
      nextDestination(
        [
          { ...a, visited: true },
          { ...b, visited: true },
        ],
        "TODAY",
      ),
    ).toBeNull();
  });
  it("좌표 있는 항목이 없으면 null", () => {
    expect(nextDestination([noCoord, move], "EVE")).toBeNull();
  });
});

describe("toPlanRouteModel", () => {
  it("좌표 있는 항목만 번호를 받고, 좌표 없는 장소는 omitted 로 센다 — 이동은 세지 않는다", () => {
    const model = toPlanRouteModel([a, noCoord, move, b], null);
    expect(model.stops.map((stop) => [stop.id, stop.order])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    expect(model.omittedCount).toBe(1);
  });
  it("전날 숙소가 있으면 첫 정류점으로 가는 점선 구간이 붙는다", () => {
    const prev = planItem({
      planItemId: "prev",
      day: 0,
      sequence: 9,
      itemType: LODGING,
      place: planItemPlace({ lat: 33.3, lng: 126.3 }),
    });
    expect(toPlanRouteModel([a], prev).legs[0]?.fromLodging).toBe(true);
  });
});
```

**Step 2: 실패 확인** — `cd frontend && npx vitest run src/lib/plan/briefing-day.test.ts` → FAIL (모듈 없음)

**Step 3: 구현**

```ts
// frontend/src/lib/plan/briefing-day.ts
import {
  type RouteItemInput,
  type RouteModel,
  toRouteModel,
} from "@/lib/map/route";
import type { BriefingTarget } from "@/lib/plan/briefing";
import { planItemMapCoord } from "@/lib/plan/detail";
import type { PlanItemDetail } from "@/types/plan";

/**
 * 브리핑 그날 일정의 순수 판단 (#1415 · 여행브리핑-세부명세 D15).
 *
 * 화면(`briefing-day-timeline.tsx`)은 받은 값만 그리고, **무엇이 기준 행인지 · 어디로 길을 안내할지 · 몇 번인지** 는
 * 여기서 정한다 — 렌더 분기가 아니라 판정이라 함수 단위로 잠근다.
 */
export const PLACE_ITEM_TYPE = "PLACE";

/**
 * 날씨 기준 장소의 행 (D15-3). 브리핑 응답의 `representativePlaceId` 는 **장소** id 라 상세 장소 항목의 `targetId` 와
 * 맞춘다 — 산책 코스 · 숙박의 `targetId` 는 다른 종류의 id 라 보지 않는다. 같은 장소가 두 번이면 첫 항목 하나.
 */
export function basisItemId(
  items: readonly PlanItemDetail[],
  representativePlaceId: string | null,
): string | null {
  if (representativePlaceId === null) return null;

  const hit = items.find(
    (item) =>
      item.itemType.code === PLACE_ITEM_TYPE &&
      item.targetId === representativePlaceId,
  );
  return hit?.planItemId ?? null;
}

/**
 * 길찾기가 안내할 다음 갈 곳 (D15-6). 내일 브리핑은 첫 장소, 오늘 브리핑은 아직 안 간 첫 장소 — 좌표 없는 항목은 길을
 * 낼 수 없어 건너뛴다. 없으면 `null`(버튼을 그리지 않는다).
 */
export function nextDestination(
  items: readonly PlanItemDetail[],
  kind: BriefingTarget["kind"],
): PlanItemDetail | null {
  return (
    items.find(
      (item) =>
        planItemMapCoord(item) !== null && (kind === "EVE" || !item.visited),
    ) ?? null
  );
}

function toRouteInput(item: PlanItemDetail): RouteItemInput {
  return {
    id: item.planItemId,
    itemTypeCode: item.itemType.code,
    title: item.title,
    coord: planItemMapCoord(item),
  };
}

/**
 * 하루 동선 모델 — 일정 상세의 동선 카드와 브리핑이 **같은 함수**로 번호 · 선을 만든다. 목록 번호가 지도 핀 번호와
 * 같아야 하므로(D15-4) 두 화면이 각자 만들지 않는다.
 */
export function toPlanRouteModel(
  items: readonly PlanItemDetail[],
  lodgingBasis: PlanItemDetail | null,
): RouteModel {
  return toRouteModel({
    items: items.map(toRouteInput),
    lodgingBasis: lodgingBasis === null ? null : toRouteInput(lodgingBasis),
  });
}
```

**Step 4: 통과 확인** — 같은 명령 → PASS

**Step 5: 커밋**

```bash
git add frontend/src/lib/plan/briefing-day.ts frontend/src/lib/plan/briefing-day.test.ts
git commit -m "[FE] feat: 브리핑 그날 일정의 기준 행 · 다음 갈 곳 · 동선 모델 판단을 순수 함수로 둔다 (#1415)"
```

---

### Task 2: `PlanRouteMap` 추출 — 동선 카드는 겉모습 그대로

**Files:**

- Create: `frontend/src/features/plan/plan-route-map.tsx`
- Modify: `frontend/src/features/plan/plan-route-card.tsx` (모델 · 카메라 · 핀 · `MapCanvas` 부분)
- Test: `frontend/src/features/plan/plan-route-card.test.ts` (그대로 통과해야 한다) · `frontend/src/features/plan/plan-route-map.test.ts`

**Interfaces:**

- Consumes: `toPlanRouteModel` (Task 1)
- Produces:
  - `export function PlanRouteMap(props: { model: RouteModel; day: number; selectedId?: string | null; onSelect?: (id: string) => void; onFailure: (failure: MapSdkFailure) => void; className?: string }): ReactNode` — 카메라가 없으면(정류점 0) `null`

**Step 1: 테스트** — 정류점이 없으면 아무것도 그리지 않는다(카메라 `null`). `MapCanvas` 는 `ssr: false` 라 문자열 렌더에서 빈 자리다.

```ts
// frontend/src/features/plan/plan-route-map.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlanRouteMap } from "@/features/plan/plan-route-map";
import { toRouteModel } from "@/lib/map/route";

describe("PlanRouteMap", () => {
  it("정류점이 없으면 아무것도 그리지 않는다", () => {
    const markup = renderToStaticMarkup(
      createElement(PlanRouteMap, {
        model: toRouteModel({ items: [], lodgingBasis: null }),
        day: 1,
        onFailure: () => undefined,
      }),
    );
    expect(markup).toBe("");
  });
});
```

**Step 2: 실패 확인** — `npx vitest run src/features/plan/plan-route-map.test.ts` → FAIL

**Step 3: 구현** — `plan-route-card.tsx` 의 `cameraKey` · `camera` · `pins` · `route` · `<MapCanvas>` 를 그대로 옮긴다(주석 포함).

```tsx
// frontend/src/features/plan/plan-route-map.tsx
"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

import type { MapPin } from "@/features/map/map-canvas";
import {
  routeCamera,
  routeCameraKey,
  type RouteModel,
  toRouteSegments,
} from "@/lib/map/route";
import type { MapSdkFailure } from "@/lib/map/sdk";

const MapCanvas = dynamic(
  () => import("@/features/map/map-canvas").then((module) => module.MapCanvas),
  { ssr: false },
);

/**
 * 하루 동선 지도 — 번호 핀 · 순서 선 · 전날 숙소 점선 (#1415 에서 `PlanRouteCard` 에서 뗐다).
 *
 * **URL 을 모른다.** 일자 · 선택은 호출부가 정한다 — 일정 상세 동선 카드는 `?day=` 로, 브리핑은 그날 하나로.
 * **실패 판단도 호출부 몫이다**(`onFailure`) — 동선 카드는 카드째 접고, 브리핑은 지도만 접는다(D15-5).
 */
export function PlanRouteMap({
  model,
  day,
  selectedId = null,
  onSelect,
  onFailure,
  className = "h-56 w-full overflow-hidden rounded-md md:h-64",
}: {
  model: RouteModel;
  day: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onFailure: (failure: MapSdkFailure) => void;
  className?: string;
}) {
  // (plan-route-card.tsx 의 cameraKey 주석을 옮긴다)
  const cameraKey = routeCameraKey(day, model.stops);

  const camera = useMemo(() => {
    const frame = routeCamera(model.stops);
    return frame === null
      ? null
      : { ...frame, anchorRatio: 0.5, refitOnResize: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 서명이 model.stops 의 카메라 입력을 전부 담는다
  }, [cameraKey]);

  const pins: MapPin[] = useMemo(
    () =>
      model.stops.map((stop) => ({
        id: stop.id,
        title: stop.title,
        lat: stop.coord.lat,
        lng: stop.coord.lng,
        order: stop.order,
      })),
    [model.stops],
  );

  const route = useMemo(() => toRouteSegments(model.legs), [model.legs]);

  if (camera === null) return null;

  return (
    <MapCanvas
      pins={pins}
      route={route}
      selectedId={selectedId}
      onSelect={onSelect}
      camera={camera}
      onFailure={onFailure}
      className={className}
    />
  );
}
```

`plan-route-card.tsx`: `useMemo` 모델을 `toPlanRouteModel(group?.items ?? [], lodgingBasisFor(selectedDay, days))` 로 바꾸고, `if (routeCamera(model.stops) === null || failure !== null) return null`, `<MapCanvas …/>` 자리를 `<PlanRouteMap model={model} day={selectedDay} selectedId={selectedId} onSelect={(id) => setSelection({ day: selectedDay, id })} onFailure={setFailure} />` 로 바꾼다. 쓰지 않게 된 import(`dynamic` · `MapPin` · `routeCameraKey` · `toRouteSegments` · `RouteItemInput` · `toRouteModel` · `planItemMapCoord`)를 걷는다. 기존 `eslint-disable` 이 원본에 있으면 그 형태를 그대로 따른다.

**Step 4: 통과 확인** — `npx vitest run src/features/plan/plan-route-map.test.ts src/features/plan/plan-route-card.test.ts src/lib/map` → 전부 PASS · `npx tsc --noEmit` 깨끗

**Step 5: 커밋**

```bash
git add frontend/src/features/plan/plan-route-map.tsx frontend/src/features/plan/plan-route-map.test.ts frontend/src/features/plan/plan-route-card.tsx
git commit -m "[FE] refactor: 동선 카드에서 하루 동선 지도를 PlanRouteMap 으로 뗀다 — 겉모습은 그대로 (#1415)"
```

---

### Task 3: 브리핑 타임라인 카드

**Files:**

- Create: `frontend/src/features/plan/briefing-day-timeline.tsx`
- Modify: `frontend/src/lib/messages/plan.ts` (키 둘 · 기준 태그 문구)
- Test: `frontend/src/features/plan/briefing-day-timeline.test.ts`

**Interfaces:**

- Consumes: `basisItemId` · `nextDestination` · `toPlanRouteModel` (Task 1), `PlanRouteMap` (Task 2)
- Produces:
  - `export type BriefingDayPlan = { items: PlanItemDetail[]; lodgingBasis: PlanItemDetail | null }`
  - `export function BriefingDayTimeline(props: { planId: string; day: number; kind: BriefingTarget['kind']; plan: BriefingDayPlan; representativePlaceId: string | null; representativePlaceTitle: string | null }): ReactNode`
  - `export function BriefingScheduleEmpty(props: { planId: string; day: number }): ReactNode` — 지금 `ScheduleCard` 의 빈 날 `EmptyState` 를 옮긴 것

**Step 1: 문구**

```ts
// frontend/src/lib/messages/plan.ts — briefingScheduleBasisTag 를 바꾸고 둘을 더한다
  /** 날씨 · 골든타임 판정이 걸린 행의 배지 (#1415 D15-1) — 무엇의 기준인지 말한다 */
  briefingScheduleBasisTag: '날씨 기준',
  /** 다녀온 행의 배지 (#1415 D15-4) — 흐림(색)만으로 말하지 않는다 */
  briefingScheduleVisited: '다녀옴',
  /** 다음 갈 곳 길찾기 (#1415 D15-6) */
  briefingScheduleDirections: '{title} 길찾기',
```

**Step 2: 실패하는 테스트**

```ts
// frontend/src/features/plan/briefing-day-timeline.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BriefingDayTimeline } from "@/features/plan/briefing-day-timeline";
import { messages } from "@/lib/messages";
import { planItem } from "@/test/fixtures/plan";

const MOVE = { code: "MOVE", name: "이동", description: null };
const items = [
  planItem({
    planItemId: "a",
    day: 1,
    sequence: 0,
    targetId: "P1",
    title: "중문색달해수욕장",
    startTime: "10:05:00",
  }),
  planItem({
    planItemId: "b",
    day: 1,
    sequence: 1,
    targetId: "P2",
    title: "식당",
    visited: true,
  }),
  planItem({
    planItemId: "m",
    day: 1,
    sequence: 2,
    itemType: MOVE,
    targetId: null,
    title: "이동",
    place: null,
  }),
  planItem({
    planItemId: "c",
    day: 1,
    sequence: 3,
    targetId: "P3",
    title: "메모장소",
    place: null,
  }),
];

function render(
  overrides: Partial<Parameters<typeof BriefingDayTimeline>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(BriefingDayTimeline, {
      planId: "plan-1",
      day: 1,
      kind: "TODAY",
      plan: { items, lodgingBasis: null },
      representativePlaceId: "P1",
      representativePlaceTitle: "중문색달해수욕장",
      ...overrides,
    }),
  );
}

describe("BriefingDayTimeline (#1415)", () => {
  it("그날 항목 전부가 한 행씩 선다 — 사이 N곳 접기가 없다", () => {
    const markup = render();
    expect(markup.match(/<li\b/g)).toHaveLength(4);
    expect(markup).not.toContain("사이 ");
  });
  it("개수 줄은 상세에서 센다", () => {
    expect(render()).toContain(
      messages.plan.briefingScheduleCounts
        .replace("{count}", "4")
        .replace("{visited}", "1"),
    );
  });
  it("번호는 동선 순번 — 좌표 있는 항목만 1, 2 … 이동 · 좌표 없음은 번호가 없다", () => {
    const markup = render();
    expect(markup.match(/data-route-order="\d+"/g)).toEqual([
      'data-route-order="1"',
      'data-route-order="2"',
    ]);
  });
  it("좌표 없는 장소 수를 알린다 — 이동은 세지 않는다", () => {
    expect(render()).toContain(messages.map.routeOmitted.replace("{n}", "1"));
  });
  it("기준 배지는 targetId 가 맞는 첫 행에만", () => {
    const markup = render();
    expect(
      markup.match(new RegExp(messages.plan.briefingScheduleBasisTag, "g")),
    ).toHaveLength(1);
    expect(markup.indexOf(messages.plan.briefingScheduleBasisTag)).toBeLessThan(
      markup.indexOf("식당"),
    );
  });
  it("기준 장소가 그날 항목에 없으면 기준 한 줄로 남는다", () => {
    const markup = render({
      representativePlaceId: "ELSEWHERE",
      representativePlaceTitle: "다른곳",
    });
    expect(markup).toContain(
      messages.plan.briefingScheduleBasisPlace.replace("{title}", "다른곳"),
    );
  });
  it("다녀온 행은 흐리고 다녀옴 배지가 붙는다", () => {
    const markup = render();
    expect(markup).toContain(messages.plan.briefingScheduleVisited);
    expect(markup).toMatch(/data-visited="true"[^>]*class="[^"]*text-fg-muted/);
  });
  it("시각이 있으면 HH:mm, 없으면 빈 칸", () => {
    const markup = render();
    expect(markup).toContain("10:05");
    expect(markup).not.toContain("10:05:00");
  });
  it("행은 링크가 아니다 — 링크는 길찾기 · 이 날 일정 보기 둘뿐", () => {
    const markup = render();
    expect(markup.match(/<a\b/g)).toHaveLength(2);
  });
  it("오늘 길찾기는 아직 안 간 첫 장소 — 다녀온 식당이 아니다", () => {
    const markup = render({
      kind: "TODAY",
      plan: {
        items: [
          { ...items[0]!, visited: true },
          { ...items[1]!, visited: false },
        ],
        lodgingBasis: null,
      },
    });
    expect(markup).toContain(
      messages.plan.briefingScheduleDirections.replace("{title}", "식당"),
    );
  });
  it("좌표 있는 항목이 없으면 길찾기가 없고 목록 · 이 날 일정 보기는 남는다", () => {
    const markup = render({
      plan: { items: [items[2]!, items[3]!], lodgingBasis: null },
    });
    expect(markup).not.toContain("map.kakao.com/link/to");
    expect(markup).toContain(messages.plan.briefingScheduleOpenDay);
    expect(markup.match(/<li\b/g)).toHaveLength(2);
  });
  it("항목이 없으면 빈 상태와 담기 링크", () => {
    const markup = render({ plan: { items: [], lodgingBasis: null } });
    expect(markup).toContain(messages.plan.briefingScheduleEmptyTitle);
    expect(markup).toContain("/plans/plan-1/days/1/add");
    expect(markup).not.toContain("<ol");
  });
  it("h2 를 더하지 않는다", () => {
    expect(render()).not.toContain("<h2");
  });
});
```

**Step 3: 실패 확인** — `npx vitest run src/features/plan/briefing-day-timeline.test.ts` → FAIL

**Step 4: 구현** — 점 · 선 · 배지 마크업은 `plan-briefing-section.tsx` 의 `FlowNode` 를 따른다(같은 크기 · 같은 `Badge`). 다녀온 행은 `data-visited="true"` 와 `text-fg-muted`. 번호는 `data-route-order` 를 단 원(장식이 아니라 번호라 `aria-hidden` 을 걸지 않는다).

```tsx
// frontend/src/features/plan/briefing-day-timeline.tsx
"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/badge";
import { ButtonLink } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { planDayAnchorId } from "@/features/plan/plan-day-section";
import { PlanRouteMap } from "@/features/plan/plan-route-map";
import { directionsUrl } from "@/lib/geo/map-link";
import { messages } from "@/lib/messages";
import type { BriefingTarget } from "@/lib/plan/briefing";
import {
  basisItemId,
  nextDestination,
  toPlanRouteModel,
} from "@/lib/plan/briefing-day";
import { planItemMapCoord } from "@/lib/plan/detail";
import { INSET_CLASS } from "@/lib/ui/inset";
import { cn } from "@/lib/utils/cn";
import type { PlanItemDetail } from "@/types/plan";

/** 브리핑이 상세에서 고른 그날 (#1415 D15-2) — 뷰가 `groupItemsByDay` · `lodgingBasisFor` 로 만든다 */
export type BriefingDayPlan = {
  items: PlanItemDetail[];
  lodgingBasis: PlanItemDetail | null;
};

/** 빈 날 — 예전 `ScheduleCard` 의 것을 옮겼다. 두 카드가 같이 쓴다 */
export function BriefingScheduleEmpty({
  planId,
  day,
}: {
  planId: string;
  day: number;
}) {
  return (
    <EmptyState
      title={messages.plan.briefingScheduleEmptyTitle}
      inset="card"
      headingLevel={3}
      action={
        <ButtonLink
          href={`/plans/${planId}/days/${day}/add`}
          variant="secondary"
          size="sm"
        >
          {messages.plan.briefingScheduleEmptyAction}
        </ButtonLink>
      }
    />
  );
}

/**
 * 그날 일정 전체 · 동선 지도 (#1415 · 여행브리핑-세부명세 D15). **읽기 전용** — 체크는 `이 날 일정 보기`(상세)에서.
 */
export function BriefingDayTimeline({
  planId,
  day,
  kind,
  plan,
  representativePlaceId,
  representativePlaceTitle,
}: {
  planId: string;
  day: number;
  kind: BriefingTarget["kind"];
  plan: BriefingDayPlan;
  representativePlaceId: string | null;
  representativePlaceTitle: string | null;
}) {
  const [mapFailed, setMapFailed] = useState(false);
  const model = useMemo(
    () => toPlanRouteModel(plan.items, plan.lodgingBasis),
    [plan],
  );

  if (plan.items.length === 0)
    return <BriefingScheduleEmpty planId={planId} day={day} />;

  const orderOf = new Map(model.stops.map((stop) => [stop.id, stop.order]));
  const basisId = basisItemId(plan.items, representativePlaceId);
  const visited = plan.items.filter((item) => item.visited).length;
  const next = nextDestination(plan.items, kind);
  const nextCoord = next === null ? null : planItemMapCoord(next);
  const directions =
    next === null || nextCoord === null
      ? null
      : directionsUrl({
          name: next.title,
          lat: nextCoord.lat,
          lng: nextCoord.lng,
        });

  return (
    <div
      className={cn("flex flex-col items-stretch gap-3 pb-4", INSET_CLASS.card)}
    >
      <p className="text-body-2 text-fg tabular-nums">
        {messages.plan.briefingScheduleCounts
          .replace("{count}", String(plan.items.length))
          .replace("{visited}", String(visited))}
      </p>

      <ol>
        {plan.items.map((item, index) => (
          <TimelineRow
            key={item.planItemId}
            item={item}
            order={orderOf.get(item.planItemId) ?? null}
            basis={item.planItemId === basisId}
            connected={index < plan.items.length - 1}
          />
        ))}
      </ol>

      {/* 기준 장소가 그날 항목에 없는 갈래 (D15-3) */}
      {basisId === null && representativePlaceTitle !== null && (
        <p className="text-caption text-fg-muted">
          {messages.plan.briefingScheduleBasisPlace.replace(
            "{title}",
            representativePlaceTitle,
          )}
        </p>
      )}

      {!mapFailed && (
        <PlanRouteMap
          model={model}
          day={day}
          onFailure={() => setMapFailed(true)}
        />
      )}

      {model.omittedCount > 0 && (
        <p className="text-caption text-fg-subtle">
          {messages.map.routeOmitted.replace("{n}", String(model.omittedCount))}
        </p>
      )}

      {directions !== null && next !== null && (
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border-strong text-fg hover:bg-band focus-visible:ring-brand-500 text-body-2 flex h-11 items-center justify-center rounded-md border font-semibold focus-visible:ring-1 focus-visible:outline-none"
        >
          {messages.plan.briefingScheduleDirections.replace(
            "{title}",
            next.title,
          )}
        </a>
      )}

      <ButtonLink
        href={`/plans/${planId}#${planDayAnchorId(day)}`}
        variant="primary"
        size="md"
        className="w-full"
      >
        {messages.plan.briefingScheduleOpenDay}
      </ButtonLink>
    </div>
  );
}

function TimelineRow({
  item,
  order,
  basis,
  connected,
}: {
  item: PlanItemDetail;
  order: number | null;
  basis: boolean;
  connected: boolean;
}) {
  return (
    <li
      data-visited={item.visited ? "true" : undefined}
      className={cn(
        "flex gap-3 pb-4 last:pb-0",
        item.visited ? "text-fg-muted" : "text-fg",
      )}
    >
      <span className="flex w-6 shrink-0 flex-col items-center">
        {order === null ? (
          <span
            aria-hidden
            className="bg-border-strong mt-2 size-2 shrink-0 rounded-full"
          />
        ) : (
          <span
            data-route-order={order}
            className="bg-brand-600 text-caption flex size-6 shrink-0 items-center justify-center rounded-full font-bold text-white tabular-nums"
          >
            {order}
          </span>
        )}
        {connected && <span aria-hidden className="bg-border w-px flex-1" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-body-1 font-semibold break-keep">
          {item.startTime !== null && (
            <span className="text-fg-muted tabular-nums">
              {item.startTime.slice(0, 5)}{" "}
            </span>
          )}
          {item.title}
        </p>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral" size="sm">
            <span className="sr-only">
              {messages.plan.briefingScheduleTypeLabel}{" "}
            </span>
            {item.itemType.name}
          </Badge>
          {basis && (
            <Badge tone="neutral" size="sm" strong>
              {messages.plan.briefingScheduleBasisTag}
            </Badge>
          )}
          {item.visited && (
            <Badge tone="neutral" size="sm">
              {messages.plan.briefingScheduleVisited}
            </Badge>
          )}
        </span>
      </div>
    </li>
  );
}
```

구현자가 확인할 것: `ButtonLink` 가 `className` 레이아웃 유틸리티를 받는지(받지 않으면 기존 `ScheduleCard` 의 전폭 처리 방식을 그대로 따른다), 핀 번호 원의 색 토큰은 `MapCanvas` 의 순번 핀(`order`)과 같은 토큰을 쓴다(`map-canvas.tsx` 에서 확인 — 다르면 그쪽 값으로).

**Step 5: 통과 확인** — `npx vitest run src/features/plan/briefing-day-timeline.test.ts` → PASS · `npx tsc --noEmit` · `npx eslint src/features/plan`

**Step 6: 커밋**

```bash
git add frontend/src/features/plan/briefing-day-timeline.tsx frontend/src/features/plan/briefing-day-timeline.test.ts frontend/src/lib/messages/plan.ts
git commit -m "[FE] feat: 브리핑 그날 일정을 전부 보이는 타임라인 카드와 동선 지도를 만든다 (#1415)"
```

---

### Task 4: 섹션 · 뷰 · page 연결

**Files:**

- Modify: `frontend/src/features/plan/plan-briefing-section.tsx` (prop 하나 · 카드 갈림 · 빈 날을 `BriefingScheduleEmpty` 로)
- Modify: `frontend/src/features/plan/plan-briefing-view.tsx` (`usePlanDetail` · 그날 고르기)
- Modify: `frontend/app/(main)/plans/[planId]/briefing/page.tsx` (`HydrationBoundary`)
- Test: `frontend/src/features/plan/plan-briefing-section.test.ts` · `frontend/src/features/plan/plan-briefing-wiring.test.ts`(새 소스 단언)

**Interfaces:**

- Consumes: `BriefingDayTimeline` · `BriefingDayPlan` · `BriefingScheduleEmpty` (Task 3), `usePlanDetail(planId)`, `groupItemsByDay(items, totalDays)`, `lodgingBasisFor(day, days)`
- Produces: `PlanBriefingSection` 의 새 prop `dayPlan: BriefingDayPlan | null` (없으면 예전 `ScheduleCard`)

**Step 1: 섹션 테스트 추가** — 기존 테스트는 `dayPlan` 을 주지 않으므로 예전 요약 카드 갈래(`사이 N곳` · 대표 지도)를 그대로 잠근다(폴백 갈래, D15-6). 새 갈래 둘을 더한다.

```ts
// plan-briefing-section.test.ts — 렌더 헬퍼에 dayPlan 을 넘길 수 있게 하고 아래를 더한다
it("dayPlan 이 있으면 그날 전부 타임라인 — 사이 N곳이 없다 (#1415)", () => {
  const markup = renderSection({
    dayPlan: {
      items: [
        planItem({ planItemId: "x", day: 1, sequence: 0 }),
        planItem({ planItemId: "y", day: 1, sequence: 1 }),
        planItem({ planItemId: "z", day: 1, sequence: 2 }),
      ],
      lodgingBasis: null,
    },
  });
  expect(markup).not.toContain("사이 ");
  expect(markup.match(/data-route-order=/g)?.length).toBe(3);
});
it("dayPlan 이 null 이면 예전 요약 카드다 — 폴백 (#1415 D15-6)", () => {
  expect(renderSection({ dayPlan: null })).toContain("사이 ");
});
```

(`renderSection` 은 이 파일의 기존 렌더 헬퍼 이름을 쓴다 — 없으면 기존 `PlanBriefingSection` 렌더 호출에 `dayPlan` 을 더하는 같은 모양의 헬퍼를 만든다. `planItem` 은 `@/test/fixtures/plan` 에서 가져온다. 픽스처 브리핑의 `schedule.itemCount` 가 3 이상이어야 폴백 단언이 `사이` 를 낸다 — 기존 `사이 2곳` 테스트의 픽스처를 쓴다.)

**Step 2: 실패 확인** — `npx vitest run src/features/plan/plan-briefing-section.test.ts` → FAIL

**Step 3: 섹션** — props 에 `dayPlan: BriefingDayPlan | null` 를 더하고(문서 주석: "#1415 — 뷰가 상세에서 고른 그날. 없으면 예전 요약 카드(D15-6)"), 일정 `Surface` 안을 갈라 넣는다.

```tsx
{
  dayPlan === null ? (
    <ScheduleCard
      planId={briefing.planId}
      day={briefing.day}
      schedule={briefing.schedule}
    />
  ) : (
    <BriefingDayTimeline
      planId={briefing.planId}
      day={briefing.day}
      kind={kind}
      plan={dayPlan}
      representativePlaceId={briefing.schedule.representativePlaceId}
      representativePlaceTitle={briefing.schedule.representativePlaceTitle}
    />
  );
}
```

`ScheduleCard` 의 빈 날 `EmptyState` 블록을 `<BriefingScheduleEmpty planId={planId} day={day} />` 로 바꾸고 쓰지 않게 된 import 를 걷는다. `ScheduleCard` 머리주석에 "#1415 부터 폴백 갈래 — 상세 캐시가 없을 때만 선다" 를 더한다.

**Step 4: 뷰** — `PlanBriefingView` 에서

```tsx
const detail = usePlanDetail(planId);
// …정상 갈래에서 data(브리핑)가 있을 때
const dayPlan = useMemo<BriefingDayPlan | null>(() => {
  if (detail.data === undefined || briefing.data === undefined) return null;
  const { days } = groupItemsByDay(detail.data.items, detail.data.totalDays);
  const group = days.find((candidate) => candidate.day === briefing.data.day);
  return {
    items: group?.items ?? [],
    lodgingBasis: lodgingBasisFor(briefing.data.day, days),
  };
}, [detail.data, briefing.data]);
```

훅은 조건부 return 보다 **앞**에 둔다(훅 규칙). `PlanBriefingSection` 에 `dayPlan={dayPlan}` 을 넘긴다. 머리주석에 "상세는 page 가 하이드레이트한다 — 새 요청이 나가지 않는다(#1415 D15-2)" 를 적는다.

**Step 5: page** — 이미 있는 `queryClient` 를 넘긴다.

```tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
// …
<Canvas as="main" id="main-content">
  {target === null ? (
    <PlanBriefingOutOfRange planId={planId} />
  ) : (
    /* 상세를 넘긴다 (#1415 D15-2) — 404 판정용으로 이미 받은 것을 버리고 있었다. 브리핑 응답은 여전히 프리페치하지 않는다 */
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PlanBriefingView planId={planId} target={target} />
    </HydrationBoundary>
  )}
</Canvas>;
```

**Step 6: 연결 소스 단언**

```ts
// frontend/src/features/plan/plan-briefing-wiring.test.ts
import { describe, expect, it } from "vitest";

import { readSourceWithoutComments as code } from "@/test/source";

describe("브리핑 ↔ 상세 연결 (#1415 D15-2)", () => {
  const page = code("app/(main)/plans/[planId]/briefing/page.tsx");
  const view = code("src/features/plan/plan-briefing-view.tsx");

  it("page 가 상세를 HydrationBoundary 로 넘긴다 — 브리핑 응답은 프리페치하지 않는다", () => {
    expect(page).toContain(
      "<HydrationBoundary state={dehydrate(queryClient)}>",
    );
    expect(page).not.toContain("planKeys.briefing");
  });
  it("뷰가 상세 캐시로 그날을 골라 섹션에 넘긴다", () => {
    expect(view).toContain("usePlanDetail(planId)");
    expect(view).toContain("lodgingBasisFor(");
    expect(view).toContain("dayPlan={dayPlan}");
  });
});
```

**Step 7: 전체 확인** — `cd frontend && npx vitest run && npx tsc --noEmit && npx eslint . && pnpm -s format:check` → 전부 통과(`h2` 개수 단언 포함)

**Step 8: 커밋**

```bash
git add frontend/src/features/plan/plan-briefing-section.tsx frontend/src/features/plan/plan-briefing-section.test.ts frontend/src/features/plan/plan-briefing-view.tsx "frontend/app/(main)/plans/[planId]/briefing/page.tsx" frontend/src/features/plan/plan-briefing-wiring.test.ts
git commit -m "[FE] feat: 브리핑이 하이드레이트된 일정 상세로 그날 일정 전체 카드를 그린다 (#1415)"
```

---

### Task 5: 실측 · 명세 상태 · PR

**Files:**

- Modify: `frontend/docs/features/plan/여행브리핑-세부명세.md` (D15 끝에 실측 · 머리 상태 줄)

**Step 1: 실측** — 목 서버(5175, `MOCK_API=true NEXT_DIST_DIR=.next-e2e next dev --webpack`) + `E2E_PORT=5175 E2E_REUSE_SERVER=1 playwright test --project=setup` 로 로그인 상태를 만들고, Playwright 를 **`http://127.0.0.1:5175`** 로 연다(쿠키 도메인). 목 일정의 기간이 브리핑 범위(오늘 · 내일)에 들어오도록 일정 만들기(`POST /api/bff/plans`)로 내일 시작 일정을 하나 만들고 항목을 담은 뒤 `/plans/{id}/briefing` 을 연다. 390 · 1440 에서 확인할 것: 행 수 = 항목 수, 번호 = 지도 핀, 지도 핀 수, `사이` 문구 없음, 길찾기 문구, 문서 가로 스크롤 없음. 오늘 갈래는 `page.clock` 으로 시작일에 맞춘다. 실측이 끝나면 5175 서버를 끈다.

**Step 2: 명세** — D15 끝에 `### D15-9. 실측` 표(폭 · 갈래 · 행 수 · 핀 수 · 길찾기 대상)를 더하고, 머리 상태 줄에 "**구현 완료** (#1415 PR 번호, 날짜)" 를 적는다.

**Step 3: 커밋 · push · PR** — `[DOCS]` 커밋 하나, push(pre-push 훅이 `pnpm verify` 를 돈다 — 출력은 로그 파일로 남긴다), PR 본문은 `.github/PULL_REQUEST_TEMPLATE.md`, `Issue Number: #1415`, 라벨 `frontend-web`.
