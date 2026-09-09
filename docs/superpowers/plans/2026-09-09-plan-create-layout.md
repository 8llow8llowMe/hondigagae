# 일정 만들기 입력 밀도 · 달력 팝오버 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 달력이 열릴 때 화면이 밀리지 않게 하고, `/ai-plans/new` 의 기본값 있는 선택 항목을 접어 rest 상태를 가볍게 한다.

**Architecture:** 두 갈래다. (1) `DateField` 의 달력 패널을 `createPortal(document.body)` + `position: fixed` 로 띄워 담기 시트의 `overflow` clip 을 빠져나간다 — 위치 계산은 **순수 함수로 뽑아 node 에서 테스트**하고 컴포넌트는 배선만 한다. (2) `/ai-plans/new` 의 지역·예산·생성옵션을 「더 자세히 정할게요」 하나로 접고, 자유요청을 필수 뒤로 옮긴다. 펼침 여부는 **마운트 시 1회** 판정한다. 폼 스키마·제출·`useForm` 은 건드리지 않는다.

**Tech Stack:** Next.js App Router (16, Turbopack) · React 19 · TanStack Query · Tailwind v4 · vitest (node 환경 + `renderToStaticMarkup` 문자열 assertion, jsdom 없음)

**Spec:** `docs/superpowers/specs/2026-09-09-plan-create-layout-design.md`

## Global Constraints

모든 작업의 요구사항에 아래가 암묵적으로 포함된다.

- **모든 파일은 UTF-8 (no BOM).** `.editorconfig` · `.gitattributes` 를 덮어쓰지 않는다.
- **작업 디렉터리는 `frontend/` 다.** 아래 모든 경로와 명령은 `frontend/` 기준이다.
- **컴포넌트 `className` 으로 외형(색·radius·shadow·padding)을 덮지 않는다.** 레이아웃 유틸리티만 (`docs/component-guide.md` §3).
- 문구 어미는 **해요체** (`DESIGN.md` §1). `src/lib/messages/message-tone.test.ts` 가 검사한다.
- **스케일 밖 값을 쓰지 않는다** (`DESIGN.md` §4). 8px 배수 스케일.
- 커밋 제목은 `[FE] <type>: <요약>` (`feat`/`fix`/`chore`/`refactor`/`style`/`docs`/`test`).
- 검증 명령은 `pnpm verify` (= `lint && typecheck && test`) 와 `pnpm format:check`.
- **`git add -A` / `git add .` / `git stash` 금지.** 작업 트리를 다른 세션과 공유한다 — 경로를 하나씩 적어 스테이징한다 (`docs/git-workflow.md` §4-1).
- **FE dev 서버는 Bash 에서 `pnpm dev --port 5174` 로 띄운다.** 3000 은 카카오 지도 키 도메인 미등록이다.

## Task 0 — 선행 조건 (블로킹)

> **이 저장소는 이슈 없이 브랜치를 만들지 않는다** (`docs/git-workflow.md`).
> 계획 작성 시점에 워크트리가 **다른 세션의 `refactor/fe/348-home-heading-scale`** 에 올라가 있어
> 브랜치를 딸 수 없었다.

- [ ] 이슈 생성 — `[FE] refactor: 일정 만들기 두 화면 입력 밀도 · 달력 팝오버`
- [ ] 워크트리가 비었는지 확인 (`git status` · `git branch --show-current` 가 `develop`)
- [ ] `git switch -c refactor/fe/<이슈번호>-plan-create-layout develop`

**워크트리가 아직 다른 세션 것이면 Task 1~5 를 먼저 구현하고 커밋만 미룬다.**
그 경우 각 Task 의 커밋 스텝은 브랜치가 생긴 뒤 **순서대로 몰아서** 실행한다.

---

## File Structure

**새로 만드는 것**

| 파일 | 책임 |
| --- | --- |
| `src/lib/ui/anchored-position.ts` | 트리거 사각형 + 패널 크기 + 뷰포트 → 팝오버 좌표. **순수** |
| `src/lib/ui/anchored-position.test.ts` | 위 함수의 뒤집기·clamp 테스트 |
| `src/lib/ai-plan/details.ts` | 접기 섹션의 요약 문자열 · 펼침 판정. **순수** |
| `src/lib/ai-plan/details.test.ts` | 위 둘의 테스트 |
| `src/features/ai-plan/ai-plan-details-disclosure.tsx` | 「더 자세히 정할게요」 접기 껍데기 (표시 전용) |
| `src/features/ai-plan/ai-plan-details-disclosure.test.ts` | 접힘/펼침 렌더 분기 |

**고치는 것**

| 파일 | 무엇 |
| --- | --- |
| `src/components/date-field.tsx` | 흐름 내 확장 → 포털 + fixed. `scrollIntoView` 보정 삭제 |
| `src/features/ai-plan/ai-plan-create-form.tsx` | 필드 재배치 + 접기 섹션 배선 |
| `src/features/ai-plan/ai-plan-create-form.test.ts` | 재배치·접기 반영 |
| `src/lib/messages/ai-plan.ts` | 중복 헤딩 제거 + 접기 문구 추가 |
| `DESIGN.md` | §7 에 z 스케일 3단 |
| `docs/features/ai-plan/공통명세.md` | 접기 구조 · 자유요청 위치 |

**건드리지 않는 것 (명시)**

- `src/lib/form/use-form.ts` · `src/features/ai-plan/schemas.ts` — 스키마도 제출도 그대로다
- `src/lib/ui/overlay.ts` — ref 기반이라 포털 노드에서도 그대로 성립한다
- `src/components/calendar.tsx` — 날짜 버튼이 이미 `type="button"` 이다 (`calendar.tsx:178`)
- `src/features/plan/plan-create-form.tsx` — `/plans/new` 는 구조 변경 없음. Task 2 의 효과만 받는다

## 명세에서 **걷어낸 것** — InfoTip 전환

명세 §4-4 는 `fieldRegionHint` · `fieldBudgetHint` · `preferFavoritesHint` 셋을 `InfoTip` 으로
옮기라고 적었다. **구현 계획에서 뺀다.**

- 세 힌트가 **전부 접기 섹션 안에 들어간다.** 접고 나면 rest 상태에 아예 없다 — 밀도 문제가
  이미 해결된다.
- 남는 것은 **펼친 상태**뿐인데, 펼친 사람은 그 항목을 **일부러 열어본 사람**이다. 그때 설명이
  보이는 것은 결함이 아니다.
- 전환 비용이 작지 않다: `Field.label` 이 `string` 이라(`field.tsx:16`) 예산 힌트를 옮기려면
  **공용 `Field` 에 `labelTrailing` 을 새로 뚫어야 한다.** 접기가 이미 해결한 문제를 위해
  광범위하게 쓰이는 컴포넌트의 API 를 늘리는 것은 YAGNI 위반이다.

**중복 헤딩 제거(명세 §4-4 의 나머지)는 그대로 한다** — 그것은 rest 상태에 있다.

---

## Task 1: 팝오버 좌표 순수 함수

**Files:**
- Create: `src/lib/ui/anchored-position.ts`
- Test: `src/lib/ui/anchored-position.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `anchoredPosition(anchor: AnchorRect, panel: PanelSize, viewport: ViewportSize): AnchoredPosition`
  - `AnchorRect = { top: number; bottom: number; left: number; width: number }`
  - `PanelSize = { width: number; height: number }`
  - `ViewportSize = { width: number; height: number }`
  - `AnchoredPosition = { top: number; left: number; minWidth: number; placement: 'below' | 'above' }`
  - Task 2 가 `getBoundingClientRect()` 결과를 이 모양으로 넘긴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/ui/anchored-position.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { anchoredPosition } from '@/lib/ui/anchored-position'

const VIEWPORT = { width: 1440, height: 900 }
const PANEL = { width: 320, height: 360 }

/** 화면 위쪽에 있는 입력 — 아래에 360 이 충분히 들어간다 */
const TOP_ANCHOR = { top: 100, bottom: 144, left: 200, width: 280 }

describe('anchoredPosition — 기본은 아래다', () => {
  it('아래 공간이 충분하면 입력 바로 아래 8px 에 붙인다', () => {
    const result = anchoredPosition(TOP_ANCHOR, PANEL, VIEWPORT)

    expect(result.placement).toBe('below')
    expect(result.top).toBe(152)
    expect(result.left).toBe(200)
  })

  it('패널이 입력보다 좁아도 입력 폭까지는 넓힌다', () => {
    const result = anchoredPosition(TOP_ANCHOR, PANEL, VIEWPORT)

    expect(result.minWidth).toBe(280)
  })
})

describe('anchoredPosition — 아래가 부족하면 뒤집는다', () => {
  it('아래가 모자라고 위가 넉넉하면 위로 붙인다', () => {
    // bottom 800, 뷰포트 900 → 아래 여유 92. 위는 756
    const anchor = { top: 756, bottom: 800, left: 200, width: 280 }

    const result = anchoredPosition(anchor, PANEL, VIEWPORT)

    expect(result.placement).toBe('above')
    // 756 - 8 - 360
    expect(result.top).toBe(388)
  })

  it('양쪽 다 모자라면 더 넓은 쪽을 쓴다', () => {
    // 위 200, 아래 656 → 둘 다 360 미만은 아니지만 아래가 넓다
    const anchor = { top: 208, bottom: 252, left: 200, width: 280 }
    const tall = { width: 320, height: 800 }

    const result = anchoredPosition(anchor, tall, VIEWPORT)

    expect(result.placement).toBe('below')
  })
})

describe('anchoredPosition — 좌우는 뷰포트 안으로 접는다', () => {
  it('왼쪽으로 넘치면 여백 8px 에 세운다', () => {
    const anchor = { top: 100, bottom: 144, left: -40, width: 280 }

    expect(anchoredPosition(anchor, PANEL, VIEWPORT).left).toBe(8)
  })

  it('오른쪽으로 넘치면 오른쪽 여백 8px 을 남기고 당긴다', () => {
    // 375px 모바일에서 입력이 오른쪽에 붙어 있는 경우
    const mobile = { width: 375, height: 812 }
    const anchor = { top: 100, bottom: 144, left: 180, width: 180 }

    // 375 - 320 - 8 = 47
    expect(anchoredPosition(anchor, PANEL, mobile).left).toBe(47)
  })

  it('패널이 뷰포트보다 넓으면 왼쪽 여백에 붙인다 (음수로 밀지 않는다)', () => {
    const narrow = { width: 300, height: 812 }
    const anchor = { top: 100, bottom: 144, left: 10, width: 280 }

    expect(anchoredPosition(anchor, PANEL, narrow).left).toBe(8)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/lib/ui/anchored-position.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ui/anchored-position"`

- [ ] **Step 3: 최소 구현**

`src/lib/ui/anchored-position.ts`:

```ts
/**
 * 트리거에 붙는 팝오버의 뷰포트 좌표.
 *
 * **순수 함수다.** DOM 을 읽지 않고 사각형만 받는다 — 그래야 node 환경에서 테스트된다
 * (`docs/testing-guide.md` §1). `getBoundingClientRect()` 를 부르는 것은 호출부의 몫이다.
 *
 * 좌표는 `position: fixed` 기준(뷰포트 원점)이다. 스크롤 오프셋을 더하지 않는다.
 */

/** `getBoundingClientRect()` 에서 필요한 만큼만 */
export type AnchorRect = { top: number; bottom: number; left: number; width: number }
export type PanelSize = { width: number; height: number }
export type ViewportSize = { width: number; height: number }

export type AnchoredPosition = {
  top: number
  left: number
  /** 패널이 트리거보다 좁아 보이지 않게 하는 하한 */
  minWidth: number
  placement: 'below' | 'above'
}

/** 트리거와 패널 사이 */
const GAP = 8
/** 뷰포트 가장자리에 남길 여백 */
const GUTTER = 8

export function anchoredPosition(
  anchor: AnchorRect,
  panel: PanelSize,
  viewport: ViewportSize,
): AnchoredPosition {
  const roomBelow = viewport.height - anchor.bottom - GAP
  const roomAbove = anchor.top - GAP

  /*
    **기본은 아래다.** 위로 뒤집는 것은 아래가 실제로 안 들어가고 위가 더 넓을 때뿐이다 —
    "아래가 조금 모자라니 위로" 로 두면 스크롤에 따라 패널이 위아래로 튄다.
  */
  const placement: 'below' | 'above' =
    roomBelow >= panel.height || roomBelow >= roomAbove ? 'below' : 'above'

  const top = placement === 'below' ? anchor.bottom + GAP : anchor.top - GAP - panel.height

  /*
    좌우 clamp. **하한을 상한보다 먼저 적용하지 않는다** — 패널이 뷰포트보다 넓으면
    `viewport.width - panel.width - GUTTER` 가 `GUTTER` 보다 작아져, 순서를 뒤집으면
    left 가 음수가 되어 왼쪽이 잘린다.
  */
  const maxLeft = viewport.width - panel.width - GUTTER
  const left = Math.max(GUTTER, Math.min(anchor.left, maxLeft))

  return { top, left, minWidth: anchor.width, placement }
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm vitest run src/lib/ui/anchored-position.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: 커밋** (Task 0 완료 후)

```bash
git add src/lib/ui/anchored-position.ts src/lib/ui/anchored-position.test.ts
git commit -m "[FE] feat: 팝오버 좌표 계산을 순수 함수로 뽑는다"
```

---

## Task 2: `DateField` 를 포털 팝오버로

**Files:**
- Modify: `src/components/date-field.tsx`
- Modify: `DESIGN.md` (§7 끝에 z 스케일 표)

**Interfaces:**
- Consumes: `anchoredPosition` (Task 1)
- Produces: 없음 — `DateField` 의 props 는 **바뀌지 않는다.** 세 사용처가 그대로 돈다.

- [ ] **Step 1: 위치 상태와 측정 effect 를 넣는다**

`src/components/date-field.tsx` 의 import 에 추가:

```ts
import { createPortal } from 'react-dom'

import { anchoredPosition, type AnchoredPosition } from '@/lib/ui/anchored-position'
```

`const panelId = useId()` 아래에 추가:

```tsx
const [position, setPosition] = useState<AnchoredPosition | null>(null)

/*
  **열린 뒤에 잰다.** 패널이 마운트돼야 크기를 알 수 있어 `useLayoutEffect` 로 그린 직후
  측정한다 — `useEffect` 로 두면 좌상단(0,0)에 한 프레임 그려졌다가 제자리로 튄다.
*/
useLayoutEffect(() => {
  if (!open) {
    setPosition(null)
    return
  }
  const anchor = inputRef.current?.getBoundingClientRect()
  const panel = panelRef.current?.getBoundingClientRect()
  if (anchor === undefined || panel === undefined) return

  setPosition(
    anchoredPosition(
      { top: anchor.top, bottom: anchor.bottom, left: anchor.left, width: anchor.width },
      { width: panel.width, height: panel.height },
      { width: window.innerWidth, height: window.innerHeight },
    ),
  )
}, [open])
```

`useLayoutEffect` 를 `react` import 에 더한다.

- [ ] **Step 2: 스크롤·리사이즈로 닫는다**

바깥 클릭 effect 아래에 추가:

```tsx
/*
  **스크롤하면 닫는다.** `fixed` 라 페이지가 움직여도 패널은 제자리에 남아 입력에서
  떨어진다. 재배치보다 닫는 쪽이 단순하고 날짜 피커에서 흔한 처리다.

  **중첩 스크롤러를 잡으려면 `capture: true` 여야 한다** — 담기 시트 본문이
  `overflow-y-auto` 라(`bottom-sheet.tsx:92`) 그 스크롤은 window 까지 버블링되지 않는다.

  **다음 프레임에 붙인다.** `useOverlay` 가 패널로 초기 포커스를 옮기는데, 그 포커스가
  스크롤을 유발하면 방금 건 리스너가 열리자마자 닫아 버린다.
*/
useEffect(() => {
  if (!open) return

  let dispose = () => undefined as void
  const raf = requestAnimationFrame(() => {
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    dispose = () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  })

  return () => {
    cancelAnimationFrame(raf)
    dispose()
  }
}, [open])
```

- [ ] **Step 3: `scrollIntoView` 보정을 지운다**

`useEffect(() => { ... panelRef.current?.scrollIntoView({ block: 'nearest' }) ... }, [open])` 블록과
그 위 주석 전체를 삭제한다. **밀리지 않으므로 보정할 대상이 없다.**

- [ ] **Step 4: 패널을 포털로 옮긴다**

`{open && (...)}` 블록을 아래로 교체한다:

```tsx
{open &&
  createPortal(
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        minWidth: position?.minWidth ?? 0,
        // 재는 동안에는 감춘다 — 좌상단에 한 프레임 스치는 것을 막는다
        visibility: position === null ? 'hidden' : 'visible',
      }}
      className="border-border bg-bg fixed z-[60] rounded-md border p-3 shadow-md outline-none"
    >
      <Calendar
        focusRef={dayRef}
        value={value}
        min={min}
        max={max}
        today={today}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onSelect={(date) => {
          onValueChange(date)
          setOpen(false)
          inputRef.current?.focus()
        }}
      />
    </div>,
    document.body,
  )}
```

바깥 `<div>` 의 `relative` 는 **유지한다** — 아이콘이 여전히 그 기준으로 붙는다.

- [ ] **Step 5: docstring 을 갱신한다**

`date-field.tsx` 의 *"달력은 오버레이가 아니라 문서 흐름 안에서 펼쳐진다"* 문단을 아래로 교체한다.
**기존 기각 기록은 지우지 않는다.**

```
 * **달력은 `document.body` 로 포털된 `fixed` 팝오버다.**
 *
 * 처음에는 `BottomSheet`(모바일 시트 / 데스크톱 중앙 패널)로 만들었다. 그런데 이 필드를
 * 쓰는 `PlanCreateForm` 이 **장소 상세의 `담기` 시트 안에서도** 렌더된다 — 시트 위에 시트가
 * 겹치는 것이고, `bottom-sheet.tsx` 가 "오버레이 위에 오버레이를 쌓지 않는다" 로 못박은
 * 바로 그 경우다. 그 다음에는 흐름 안에서 펼쳤다 — 세 사용처가 한 코드로 성립했지만
 * **열 때마다 아래 내용이 300px 밀렸다.**
 *
 * **포털 + `fixed` 가 세 번째 답이다.** body 에 붙은 `fixed` 는 조상 `overflow` 가 없어
 * 담기 시트의 `overflow-hidden`(패널) · `overflow-y-auto`(본문) 를 모두 빠져나간다.
 * `absolute` 팝오버가 잘렸던 이유가 사라지고, 세 사용처가 여전히 한 코드다.
 *
 * 좌표는 `lib/ui/anchored-position.ts` 가 정한다 — 순수 함수라 뒤집기·clamp 가 node 에서
 * 테스트된다. 스크롤하면 닫는다(재배치보다 단순하다). `z-[60]` 은 담기 시트(`z-50`) 위다.
 *
 * 이제 **진짜로 떠 있으므로 그림자가 있다** (DESIGN.md §6). 흐름 안이던 때 그림자가
 * 없었던 것은 떠 있지 않았기 때문이다.
 *
 * `Esc`·바깥 클릭·포커스 복귀는 `useOverlay` 가 그대로 소유한다 — ref 기반이라 포털
 * 노드에서도 성립한다 (이슈 #70).
```

- [ ] **Step 6: z 스케일을 `DESIGN.md` §7 에 적는다**

`DESIGN.md` §7 의 레이아웃 토큰 표 아래에 추가:

```markdown
**z 스케일 — 3단.** 값을 임의로 만들지 않는다.

| 층 | 값 | 예 |
| --- | --- | --- |
| 흐름 내 컨트롤에 붙은 팝오버 | `z-40` | `Menu` · `InfoTip` · 모바일 탭바 |
| 오버레이 | `z-50` | `Modal` · `BottomSheet` · `Toast` |
| **오버레이 위의 팝오버** | `z-[60]` | `DateField` 의 달력 (담기 시트 안에서 열린다) |

`InfoTip` 은 `z-40` 이라 **오버레이 안에 들어가면 같은 문제를 갖는다.** 지금 사용처에는
증상이 없지만, 모달·시트 안에 넣을 때 이 표를 다시 본다.
```

- [ ] **Step 7: 검증**

Run: `pnpm verify`
Expected: PASS (기존 테스트 무손상 — `DateField` 의 props 가 안 바뀌었다)

- [ ] **Step 8: 브라우저 실측** — `pnpm dev --port 5174`

**세 사용처를 모두 본다. 담기 시트가 핵심 회귀 지점이다.**

- [ ] `/plans/new` 375px — 달력을 열어도 **아래 필드가 밀리지 않는다**
- [ ] `/ai-plans/new` 375px — 종료일이 화면 하단에 있을 때 **위로 뒤집힌다**
- [ ] 장소 상세 → 담기 시트 → 일정 만들기 → 날짜 — **달력이 잘리지 않는다**
- [ ] 담기 시트 **본문을 스크롤**하면 달력이 닫힌다
- [ ] 페이지를 스크롤하면 달력이 닫힌다
- [ ] `Esc` · 바깥 클릭으로 닫히고 포커스가 입력으로 돌아온다
- [ ] 날짜를 눌러도 **폼이 제출되지 않는다** (포털 이벤트는 React 트리로 버블링한다)
- [ ] 1440px 에서 좌표가 정상

- [ ] **Step 9: 커밋** (Task 0 완료 후)

```bash
git add src/components/date-field.tsx DESIGN.md
git commit -m "[FE] fix: 달력을 포털 팝오버로 띄워 아래 내용이 밀리지 않게 한다"
```

---

## Task 3: 접기 섹션의 요약·판정 순수 함수

**Files:**
- Create: `src/lib/ai-plan/details.ts`
- Test: `src/lib/ai-plan/details.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `detailsSummary(input: DetailsInput): string`
  - `hasAnyDetail(input: DetailsInput): boolean`
  - `DetailsInput = { regionLabel: string; budgetManwon: string; preferFavorites: boolean; pinnedCount: number; regionNarrowed: boolean }`
  - Task 5 가 `SIGUNGU_LABEL` 을 풀어서 `regionLabel` 로 넘긴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/ai-plan/details.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { type DetailsInput, detailsSummary, hasAnyDetail } from '@/lib/ai-plan/details'

const EMPTY: DetailsInput = {
  regionLabel: '제주 전체',
  regionNarrowed: false,
  budgetManwon: '',
  preferFavorites: false,
  pinnedCount: 0,
}

describe('detailsSummary — 접힌 줄이 무엇이 정해졌는지 말한다', () => {
  it('아무것도 안 정했으면 기본값을 그대로 읽어 준다', () => {
    expect(detailsSummary(EMPTY)).toBe('제주 전체 · 예산 상관없음')
  })

  it('좁힌 지역과 예산을 값으로 바꿔 넣는다', () => {
    const summary = detailsSummary({
      ...EMPTY,
      regionLabel: '서귀포시',
      regionNarrowed: true,
      budgetManwon: '30',
    })

    expect(summary).toBe('서귀포시 · 30만원')
  })

  it('켠 옵션만 뒤에 덧붙인다', () => {
    const summary = detailsSummary({
      ...EMPTY,
      preferFavorites: true,
      pinnedCount: 2,
    })

    expect(summary).toBe('제주 전체 · 예산 상관없음 · 저장한 곳 우선 · 꼭 넣을 곳 2')
  })

  it('고정 장소가 없으면 그 조각을 넣지 않는다', () => {
    expect(detailsSummary({ ...EMPTY, preferFavorites: true })).toBe(
      '제주 전체 · 예산 상관없음 · 저장한 곳 우선',
    )
  })
})

describe('hasAnyDetail — 하나라도 정했으면 펼친 채로 연다', () => {
  it('전부 기본값이면 접는다', () => {
    expect(hasAnyDetail(EMPTY)).toBe(false)
  })

  it('지역을 좁혔으면 펼친다', () => {
    expect(hasAnyDetail({ ...EMPTY, regionNarrowed: true, regionLabel: '제주시' })).toBe(true)
  })

  it('예산을 적었으면 펼친다', () => {
    expect(hasAnyDetail({ ...EMPTY, budgetManwon: '30' })).toBe(true)
  })

  it('저장한 곳 우선을 켰으면 펼친다', () => {
    expect(hasAnyDetail({ ...EMPTY, preferFavorites: true })).toBe(true)
  })

  it('고정 장소가 있으면 펼친다', () => {
    expect(hasAnyDetail({ ...EMPTY, pinnedCount: 1 })).toBe(true)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/lib/ai-plan/details.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ai-plan/details"`

- [ ] **Step 3: 최소 구현**

`src/lib/ai-plan/details.ts`:

```ts
import { messages } from '@/lib/messages'

/**
 * 「더 자세히 정할게요」 접기 섹션의 요약과 펼침 판정.
 *
 * **순수 함수다.** `sigunguCode` 가 아니라 이미 풀린 `regionLabel` 을 받는다 —
 * 코드→라벨 표는 `features/place/filter-labels` 가 갖고 있고, `lib/` 이 `features/` 를
 * 가져오면 계층이 역참조된다.
 */
export type DetailsInput = {
  /** 표시용 지역 이름. 좁히지 않았으면 `제주 전체` */
  regionLabel: string
  /** 지역을 실제로 좁혔는가. 라벨만으로는 기본값과 구분할 수 없다 */
  regionNarrowed: boolean
  /** 만원 단위 문자열. 빈 값이 "상관없음" 이다 */
  budgetManwon: string
  preferFavorites: boolean
  pinnedCount: number
}

/** 접힌 줄에 붙는 한 줄 — `제주 전체 · 예산 상관없음 · 꼭 넣을 곳 2` */
export function detailsSummary({
  regionLabel,
  budgetManwon,
  preferFavorites,
  pinnedCount,
}: DetailsInput): string {
  /*
    **지역과 예산은 항상 쓴다.** 접힌 줄이 "무엇이 비어 있는지" 가 아니라 "무엇으로
    만들어지는지" 를 말해야 한다 — 기본값도 값이다.
  */
  const parts = [
    regionLabel,
    budgetManwon === ''
      ? messages.aiPlan.detailsBudgetAny
      : `${budgetManwon}${messages.aiPlan.fieldBudgetUnit}`,
  ]

  // 옵션은 **켠 것만** 붙인다. 끈 것까지 쓰면 줄이 길어지고 기본 상태가 시끄러워진다
  if (preferFavorites) parts.push(messages.aiPlan.detailsPreferFavorites)
  if (pinnedCount > 0) {
    parts.push(messages.aiPlan.detailsPinned.replace('{count}', String(pinnedCount)))
  }

  return parts.join(' · ')
}

/**
 * 펼친 채로 열 것인가.
 *
 * **호출부는 이것을 마운트 시 1회만 읽는다** (`ai-plan-create-form.tsx` 주석).
 * 반응형으로 두면 마지막 값을 지우는 순간 입력 중인 섹션이 접힌다.
 */
export function hasAnyDetail({
  regionNarrowed,
  budgetManwon,
  preferFavorites,
  pinnedCount,
}: DetailsInput): boolean {
  return regionNarrowed || budgetManwon !== '' || preferFavorites || pinnedCount > 0
}
```

- [ ] **Step 4: 메시지를 추가한다**

`src/lib/messages/ai-plan.ts` 에 추가 (기존 `budgetAny` 는 칩 라벨이라 그대로 둔다):

```ts
  detailsToggle: '더 자세히 정할게요',
  detailsBudgetAny: '예산 상관없음',
  detailsPreferFavorites: '저장한 곳 우선',
  detailsPinned: '꼭 넣을 곳 {count}',
```

- [ ] **Step 5: 통과를 확인한다**

Run: `pnpm vitest run src/lib/ai-plan/details.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 6: 커밋** (Task 0 완료 후)

```bash
git add src/lib/ai-plan/details.ts src/lib/ai-plan/details.test.ts src/lib/messages/ai-plan.ts
git commit -m "[FE] feat: 접기 섹션 요약·펼침 판정을 순수 함수로 뽑는다"
```

---

## Task 4: 접기 섹션 껍데기 컴포넌트

**Files:**
- Create: `src/features/ai-plan/ai-plan-details-disclosure.tsx`
- Test: `src/features/ai-plan/ai-plan-details-disclosure.test.ts`

**Interfaces:**
- Consumes: `messages.aiPlan.detailsToggle` (Task 3)
- Produces: `AiPlanDetailsDisclosure({ open, summary, onToggle, children })` — Task 5 가 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/ai-plan/ai-plan-details-disclosure.test.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AiPlanDetailsDisclosure } from '@/features/ai-plan/ai-plan-details-disclosure'
import { messages } from '@/lib/messages'

function render(open: boolean) {
  return renderToStaticMarkup(
    createElement(
      AiPlanDetailsDisclosure,
      { open, summary: '제주 전체 · 예산 상관없음', onToggle: () => undefined },
      createElement('p', null, '안쪽 내용'),
    ),
  )
}

describe('AiPlanDetailsDisclosure — 접힘/펼침', () => {
  it('접혀 있으면 안쪽 내용을 렌더하지 않는다', () => {
    const html = render(false)

    expect(html).not.toContain('안쪽 내용')
  })

  it('접혀 있으면 요약을 보여 준다', () => {
    expect(render(false)).toContain('제주 전체 · 예산 상관없음')
  })

  it('펼치면 안쪽 내용이 나온다', () => {
    expect(render(true)).toContain('안쪽 내용')
  })

  it('펼치면 요약을 감춘다 — 아래에 실제 값이 있으므로 두 번 말하지 않는다', () => {
    expect(render(true)).not.toContain('제주 전체 · 예산 상관없음')
  })

  it('상태를 보조기술에 알린다', () => {
    expect(render(false)).toContain('aria-expanded="false"')
    expect(render(true)).toContain('aria-expanded="true"')
  })

  it('여는 단추에 라벨이 있다', () => {
    expect(render(false)).toContain(messages.aiPlan.detailsToggle)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/features/ai-plan/ai-plan-details-disclosure.test.ts`
Expected: FAIL — 모듈 해석 실패

- [ ] **Step 3: 최소 구현**

`src/features/ai-plan/ai-plan-details-disclosure.tsx`:

```tsx
'use client'

import { type ReactNode, useId } from 'react'

import { ChevronDownIcon } from '@/components/icons'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 「더 자세히 정할게요」 — 기본값이 있는 선택 항목을 접는다.
 *
 * **`<details>` 를 쓰지 않는다.** 열림 상태를 React 가 소유해야 `hasAnyDetail` 판정으로
 * 초기값을 정할 수 있는데, `<details open>` 은 uncontrolled 라 사용자가 접은 뒤에도
 * prop 이 다시 열어 버린다.
 *
 * **접혔을 때만 요약을 보인다.** 펼치면 아래에 실제 컨트롤이 있으므로 같은 말을 두 번
 * 하지 않는다.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다 (`testing-guide.md` §1).
 */
export function AiPlanDetailsDisclosure({
  open,
  /** 접혔을 때 보여 줄 한 줄 (`lib/ai-plan/details.ts` 의 `detailsSummary`) */
  summary,
  onToggle,
  children,
}: {
  open: boolean
  summary: string
  onToggle: () => void
  children: ReactNode
}) {
  const panelId = useId()

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
        className="focus-visible:ring-brand-500 -mx-2 flex min-h-11 items-center gap-2 rounded-md px-2 text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChevronDownIcon
          size={20}
          className={cn('text-fg-subtle shrink-0 transition-transform', open && 'rotate-180')}
        />
        <span className="text-body-1 text-fg font-semibold">{messages.aiPlan.detailsToggle}</span>
        {/*
          접혔을 때만 요약을 낸다. `truncate` 로 한 줄을 지킨다 — 375px 에서 옵션까지
          켜면 줄이 넘치는데, 접힌 줄이 두 줄이 되면 "접었다" 는 인상이 깨진다
        */}
        {!open && <span className="text-body-2 text-fg-muted ms-auto truncate">{summary}</span>}
      </button>

      {open && (
        <div id={panelId} className="flex flex-col gap-5">
          {children}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 아이콘이 있는지 확인한다**

Run: `grep -n "ChevronDownIcon" src/components/icons/index.ts`
Expected: export 가 있다. **없으면** `ChevronRightIcon` 을 `rotate-90`/`rotate-270` 으로 쓰고
위 코드를 그에 맞게 고친다 (새 아이콘을 만들지 않는다).

- [ ] **Step 5: 통과를 확인한다**

Run: `pnpm vitest run src/features/ai-plan/ai-plan-details-disclosure.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 6: 커밋** (Task 0 완료 후)

```bash
git add src/features/ai-plan/ai-plan-details-disclosure.tsx src/features/ai-plan/ai-plan-details-disclosure.test.ts
git commit -m "[FE] feat: AI 조건 입력에 더 자세히 정하기 접기 껍데기를 만든다"
```

---

## Task 5: 폼 재배치 + 접기 배선

**Files:**
- Modify: `src/features/ai-plan/ai-plan-create-form.tsx`
- Modify: `src/features/ai-plan/ai-plan-create-form.test.ts`
- Modify: `src/lib/messages/ai-plan.ts` (중복 헤딩 제거)

**Interfaces:**
- Consumes: `detailsSummary` · `hasAnyDetail` · `DetailsInput` (Task 3), `AiPlanDetailsDisclosure` (Task 4)
- Produces: 없음 — `AiPlanCreateFormProps` 는 **바뀌지 않는다.** `ai-plan-create-view.tsx` 무손상.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/ai-plan/ai-plan-create-form.test.ts` 끝에 추가:

```ts
describe('AiPlanCreateForm — 선택 항목을 접는다', () => {
  it('아무것도 안 정했으면 지역 칩을 접어 둔다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.detailsToggle)
    // SIGUNGU_LABEL 의 키는 '3'(서귀포시) · '4'(제주시) 다 — 지역코드가 아니다
    expect(html).not.toContain(SIGUNGU_LABEL['4'])
  })

  it('접힌 줄이 기본값을 읽어 준다', () => {
    expect(render()).toContain('제주 전체 · 예산 상관없음')
  })

  it('예산이 이미 있으면 펼친 채로 연다 — 조건 바꾸기로 돌아온 경우다', () => {
    const html = render({
      values: { ...EMPTY_AI_PLAN_FORM_VALUES, budgetManwon: '30' },
    })

    expect(html).toContain(SIGUNGU_LABEL['4'])
  })

  it('필수 항목은 접지 않는다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.fieldStartDate)
    expect(html).toContain(messages.aiPlan.fieldPet)
  })

  it('자유 요청은 접기 밖에 남는다 — AI 품질에 가장 크게 기여하는 입력이다', () => {
    expect(render()).toContain(messages.aiPlan.fieldNote)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/features/ai-plan/ai-plan-create-form.test.ts`
Expected: FAIL — `detailsToggle` 이 마크업에 없다

- [ ] **Step 3: 중복 헤딩을 지운다**

`ai-plan-create-form.tsx` 에서 아래 블록을 **통째로 삭제**한다:

```tsx
<div className="flex flex-col gap-1">
  <h2 className="text-title-2 text-fg font-semibold">{messages.aiPlan.createHeading}</h2>
  <p className="text-body-2 text-fg-muted">{messages.aiPlan.createDescription}</p>
</div>
```

`src/lib/messages/ai-plan.ts` 에서 **`createHeading` 만** 지운다.

> **`createDescription` 은 남긴다.** `app/(main)/ai-plans/new/page.tsx:8` 의
> `metadata.description` 이 쓰고 있다 (실측 확인). 폼에서만 쓰지 않는다.
>
> 다만 지금 문구 `'자유롭게 적어도 되고, 아래 3가지만 채워도 만들 수 있어요.'` 는
> **재배치 후 사실과 다르다** — 화면에는 이제 기간·반려견 둘만 필수로 서 있다.
> `metadata.description` 용으로 `'반려견과 기간만 정하면 AI 가 제주 여행 일정을 짜 드려요.'`
> 로 바꾼다.

- [ ] **Step 4: 남은 사용처를 확인한다**

Run: `grep -rn "aiPlan.createHeading\|aiPlan.createDescription" src app`
Expected: `app/(main)/ai-plans/new/page.tsx:8` 의 `metadata.description` **한 곳만** 남는다.
`createHeading` 은 결과가 없어야 한다.

- [ ] **Step 5: 순서를 바꾸고 접기를 배선한다**

import 에 추가:

```ts
import { AiPlanDetailsDisclosure } from '@/features/ai-plan/ai-plan-details-disclosure'
import { type DetailsInput, detailsSummary, hasAnyDetail } from '@/lib/ai-plan/details'
```

`const budgetSelected = ...` 위에 추가:

```tsx
const details: DetailsInput = {
  /*
    **`?? fieldRegionAll` 을 뺄 수 없다.** `tsconfig` 가 `noUncheckedIndexedAccess: true`
    이고 `SIGUNGU_LABEL` 이 `Record<string, string>` 이라, 인덱스 접근의 타입은
    `string | undefined` 다. 빼면 typecheck 가 깨진다.
  */
  regionLabel:
    values.sigunguCode === null
      ? messages.aiPlan.fieldRegionAll
      : (SIGUNGU_LABEL[values.sigunguCode] ?? messages.aiPlan.fieldRegionAll),
  regionNarrowed: values.sigunguCode !== null,
  budgetManwon: values.budgetManwon,
  preferFavorites: values.preferFavorites,
  pinnedCount: values.pinnedPlaces.length,
}

/*
  **마운트 시 1회만 판정한다.** 지연 초기화로 첫 값을 정하고 그 뒤로는 사용자의 토글만
  듣는다. `hasAnyDetail(details)` 를 매 렌더 읽으면 **마지막 값을 지우는 순간 입력 중인
  섹션이 접힌다** — `restoreValues` 가 `sessionStorage` 를 지연 초기화로 읽는 것과 같은
  이유다 (`ai-plan-create-view.tsx`).

  `?from={jobId}` 로 돌아온 사람에게 자기가 넣었던 예산이 접혀 있으면 사라진 것처럼 보인다.
*/
const [detailsOpen, setDetailsOpen] = useState(() => hasAnyDetail(details))
```

`useState` 를 `react` import 에 더한다.

폼 본문의 순서를 아래로 바꾼다:

1. `<FormAlert message={errors.form} />` — 그대로 맨 위
2. **기간** — 두 `DateField` + `totalDays` 요약 (기존 `필수 조건` `<h3>` 은 지운다. 접기가
   생기면서 "필수 vs 선택" 이 구조로 드러나므로 라벨이 중복이다)
3. **반려견** — `PetCheckboxGroup` + `fieldPetHint`
4. **자유 요청** — `requestNote` `Field` (기존 맨 위에서 여기로 이동)
5. `<AiPlanDetailsDisclosure open={detailsOpen} summary={detailsSummary(details)} onToggle={() => setDetailsOpen((v) => !v)}>` 안에:
   - 지역 `<fieldset>`
   - 예산 블록 (칩 + `Field`)
   - `<AiPlanOptionsSection ... />` (기존 `생성 옵션` `<h3>` 은 `AiPlanOptionsSection` 이
     자체적으로 갖고 있으므로 그대로 둔다)
6. `<FormAlert message={errors.fields.pinnedPlaces ?? null} />`
7. 제출 버튼 + `createSubmitHint`

- [ ] **Step 6: 오류가 접힌 섹션 안에 숨지 않게 한다**

`firstErrorField` 가 접힌 섹션 안의 필드(`budgetManwon` · `pinnedPlaces`)를 가리키면
**포커스 이동이 아무 일도 하지 않는다** (요소가 마운트돼 있지 않다).

포커스 effect **위에** 추가:

```tsx
/*
  **접힌 섹션 안의 필드에서 오류가 나면 먼저 펼친다.** 안 그러면 제출이 조용히 실패한다 —
  포커스를 옮길 요소가 마운트돼 있지 않고, 오류 메시지도 화면에 없다.

  `submitCount` 를 트리거로 쓴다 (`errors` 를 쓰면 입력 중에 다시 돈다 —
  `use-form.ts` 의 `submitCount` JSDoc).
*/
useEffect(() => {
  if (submitCount === 0 || firstErrorField === null) return
  if (firstErrorField === 'budgetManwon' || firstErrorField === 'pinnedPlaces') {
    setDetailsOpen(true)
  }
}, [submitCount, firstErrorField])
```

**이 effect 는 기존 포커스 effect 보다 앞에 선언한다** — 펼쳐진 뒤에 포커스를 찾아야 한다.

- [ ] **Step 7: 테스트를 갱신한다**

기존 테스트 중 **`requiredGroupLabel` · `createHeading` · `createDescription` 을 기대하거나,
지역/예산 칩이 rest 에 있다고 보는 것**을 고친다.

Run: `pnpm vitest run src/features/ai-plan/ai-plan-create-form.test.ts`
Expected: PASS — 기존 + 신규 5개

- [ ] **Step 8: 전체 검증**

Run: `pnpm verify && pnpm format:check`
Expected: PASS

- [ ] **Step 9: 브라우저 실측** — `pnpm dev --port 5174`

- [ ] `/ai-plans/new` 375px — rest 상태가 **기간 · 반려견 · 자유요청 · 접힌 줄 · 제출**
- [ ] 제출 버튼이 **첫 화면에서 보이거나 한 번의 짧은 스크롤 안**에 있다
- [ ] 접기를 펼쳤다 접어도 값이 유지된다
- [ ] 접기 안에서 예산을 적었다가 **지워도 섹션이 접히지 않는다**
- [ ] 예산에 잘못된 값(`3.5`)을 넣고 제출 → **섹션이 펼쳐지고** 오류가 보인다
- [ ] `?from={jobId}` 로 진입(실패 화면 → 조건 바꾸기) → 접기가 **펼쳐진 채**로 뜬다
- [ ] 1440px 에서 접힌 줄의 요약이 잘리지 않는다

- [ ] **Step 10: 커밋** (Task 0 완료 후)

```bash
git add src/features/ai-plan/ai-plan-create-form.tsx src/features/ai-plan/ai-plan-create-form.test.ts src/lib/messages/ai-plan.ts
git commit -m "[FE] refactor: AI 조건 입력의 선택 항목을 접고 자유요청을 필수 뒤로 옮긴다"
```

---

## Task 6: 문서 갱신

**Files:**
- Modify: `docs/features/ai-plan/공통명세.md`

- [ ] **Step 1: 조건 입력 절을 갱신한다**

`docs/features/ai-plan/공통명세.md` 의 조건 입력(S0) 절에 아래를 반영한다.

```markdown
**입력 화면은 접힌다.** 필수(기간 · 반려견)와 자유 요청만 펼친 채로 두고, 기본값이 있는
선택 항목(지역 · 예산 · 생성 옵션)은 「더 자세히 정할게요」 하나로 접는다.

- 펼침 여부는 **마운트 시 1회** 판정한다 (`lib/ai-plan/details.ts` 의 `hasAnyDetail`).
  반응형으로 두면 마지막 값을 지울 때 입력 중인 섹션이 접힌다.
- `?from={jobId}` 로 조건을 되살려 들어오면 **펼쳐진 채**로 뜬다.
- 접힌 섹션 안의 필드에서 검증 오류가 나면 **먼저 펼치고** 포커스를 옮긴다.
- **자유 요청은 접기 밖이다.** 선택이지만 AI 품질에 가장 크게 기여하는 입력이라 묻지 않는다.
  다만 **맨 위가 아니라 필수 뒤**다 — 첫 요소가 빈 텍스트박스면 "뭘 써야 하지" 에서 막힌다.
- **단계별 위저드로 쪼개지 않는다.** 기각 근거는
  `docs/superpowers/specs/2026-09-09-plan-create-layout-design.md` §2.
```

- [ ] **Step 2: 커밋** (Task 0 완료 후)

```bash
git add docs/features/ai-plan/공통명세.md
git commit -m "[DOCS] docs: AI 조건 입력의 접기 구조를 명세에 반영한다"
```

---

## 마무리

- [ ] `pnpm verify && pnpm format:check` 최종 통과
- [ ] `git log --oneline develop..HEAD` 로 커밋이 6개 이하인지 확인
- [ ] PR 본문은 `/pr` 스킬로 작성하고 `Issue Number` 를 채운다
- [ ] 머지는 **Rebase and merge**
