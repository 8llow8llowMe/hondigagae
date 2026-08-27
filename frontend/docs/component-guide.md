# Frontend Component Guide

> **컴포넌트의 계약(contract)을 고정하는 문서다.** `styling-guide.md` 가 "무엇을 쓸 수 있는가"(토큰·컴포넌트 목록)를 정하고, 이 문서는 "그 컴포넌트를 어떻게 만들고 어떻게 부르는가"를 정한다.
> 이 규약이 없으면 컴포넌트마다 prop 이름이 달라지고(`loading` vs `isLoading`), 리뷰에서 지적할 근거도 없다.

## 1. prop 네이밍 (고정)

| 종류                  | 규칙                    | 좋음                                                      | 금지                               |
| --------------------- | ----------------------- | --------------------------------------------------------- | ---------------------------------- |
| boolean               | 접두사 없이 형용사/명사 | `loading`, `disabled`, `selected`, `required`, `readOnly` | `isLoading`, `hasError`, `canEdit` |
| 이벤트                | `on<Event>`             | `onClick`, `onChange`, `onSelect`, `onRetry`              | `handleClick`, `clickHandler`      |
| 값 변경 콜백          | `onValueChange`         | `onValueChange(next: string)`                             | `onUpdate`, `setValue`             |
| 아이콘/부가 요소 슬롯 | `leading` / `trailing`  | `leading={<PawIcon />}`                                   | `icon`, `iconLeft`, `prefix`       |
| 본문                  | `children`              |                                                           | `content`, `body`                  |
| 외형 분기             | `variant`               |                                                           | `type`, `kind`, `theme`, `color`   |
| 크기                  | `size`                  |                                                           | `scale`, `dimension`               |

**boolean에 `is`/`has` 를 붙이지 않는 이유**: React DOM 속성(`disabled`, `required`, `checked`)과 일관되고, JSX에서 축약형이 자연스럽게 읽힌다 — `<Button loading>`.

**`type` 을 외형 prop으로 쓰지 않는 이유**: `<button type="submit">` 과 충돌한다.

## 2. variant / size 표준 집합

**새 값을 임의로 추가하지 않는다.** 추가는 `DESIGN.md` 갱신과 함께 한다.

| 컴포넌트                      | `variant`                                                        | `size`               | 기본값           |
| ----------------------------- | ---------------------------------------------------------------- | -------------------- | ---------------- |
| `Button`                      | `primary` \| `secondary` \| `ghost` \| `danger`                  | `sm` \| `md` \| `lg` | `primary` / `md` |
| `Badge`                       | `neutral` \| `brand` \| `accent` \| `warn` \| `danger` \| `info` | `sm` \| `md`         | `neutral` / `md` |
| `Chip`                        | `default` \| `selected`                                          | `sm` \| `md`         | `default` / `md` |
| `Input`, `Textarea`, `Select` | — (에러는 `error` prop)                                          | `md` \| `lg`         | `md`             |
| `Card`                        | `default` \| `interactive`                                       | —                    | `default`        |

- **같은 의미에 다른 이름을 쓰지 않는다.** 어떤 컴포넌트는 `danger`, 다른 건 `error` 가 되면 사용처에서 매번 확인해야 한다.
- `size` 값은 항상 `sm`/`md`/`lg` 에서 고른다. `xs`/`xl` 이 필요하면 정말 필요한지 먼저 검토한다.

### 구현 방식

`cva` 같은 라이브러리를 도입하지 않는다. **`Record` 맵 + `cn()`** 으로 충분하다.

```tsx
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-fg-inverse hover:bg-brand-600',
  secondary: 'border border-border-strong text-fg hover:bg-bg-subtle',
  ghost: 'text-fg-muted hover:bg-bg-subtle',
  danger: 'bg-danger-500 text-fg-inverse',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-body-2',
  md: 'h-11 px-4 text-button', // 44px — 모바일 터치 영역 (DESIGN.md §7)
  lg: 'h-12 px-5 text-button',
}
```

`Record<Union, string>` 으로 선언하면 **union에 값을 추가할 때 맵 누락을 타입체커가 잡는다.** `Partial` 이나 인덱스 시그니처를 쓰지 않는다.

## 3. `className` 정책 (중요)

**허용하되 레이아웃 유틸리티만.** `cn()` 으로 병합한다.

| 허용                                                                                          | 금지                                                                         |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `margin`(`mt-4`, `mb-2`), `width`/`flex`/`grid` 배치, `self-*`/`justify-self-*`, `col-span-*` | 색(`bg-*`, `text-*`), `rounded-*`, `shadow-*`, `padding`, `height`, `font-*` |

**근거**: 배치는 **사용처**가 알고, 외형은 **컴포넌트**가 소유한다. 외형까지 뚫어주면 `<Button className="bg-[#333] p-[13px]">` 로 `DESIGN.md` 토큰 규약 전체가 우회된다.

- arbitrary value(`p-[13px]`, `text-[#333]`)는 lint가 이미 막는다 (`tooling-guide.md` §5).
- **`cn()` 은 커스텀 타이포 스케일을 `extendTailwindMerge` 로 등록해 두었다.** 등록하지 않으면
  tailwind-merge 가 `text-caption` 을 글자 색으로 오인해 `text-fg-muted` 를 지운다.
  **`DESIGN.md` §3-2 에 타이포 토큰을 추가하면 `src/lib/utils/cn.ts` 의 목록도 함께 갱신한다.**
- **토큰 클래스로 외형을 덮는 것**(`className="bg-danger-500"`)은 lint가 못 잡는다 → `fe-reviewer` 체크 항목이다.
- 전면 금지하지 않는 이유: 금지하면 배치를 위해 wrapper `<div>` 를 남발하게 되고 DOM이 지저분해진다.

```tsx
// 좋음 — 배치만
<Button className="mt-4 w-full" variant="primary">저장</Button>

// 금지 — 외형 덮어쓰기. variant를 추가하거나 DESIGN.md를 갱신한다
<Button className="bg-accent-500 rounded-full">저장</Button>
```

## 4. 합성 vs prop 확장

**판단 기준을 숫자로 고정한다.** 감각으로 정하면 사람마다 갈린다.

> **"표시 여부를 제어하는 prop"이 3개를 넘으면 합성으로 전환한다.**

```tsx
// prop 폭발 — 전환 대상
<PlaceCard
  showImage showBadge showDistance showPetInfo showBookmark
  title={...} imageUrl={...} />

// 합성
<PlaceCard>
  <PlaceCard.Image src={...} />
  <PlaceCard.Title>{...}</PlaceCard.Title>
  <PlaceCard.Meta>
    <Badge>반려견 동반 가능</Badge>
    <PlaceCard.Distance meters={1200} />
  </PlaceCard.Meta>
</PlaceCard>
```

- 데이터 prop(`title`, `imageUrl`)은 개수에 포함하지 않는다. **표시 토글(`showX`, `hideX`, `withX`)만** 센다.
- 합성 컴포넌트는 같은 파일에 두고 `Parent.Child` 로 붙인다. 파일을 쪼개지 않는다.
- 반대로 **합성이 2단계를 넘으면 과설계**다. 그때는 feature 전용 컴포넌트로 만든다.

## 5. controlled 전용

**상호작용 컴포넌트는 controlled만 제공한다.** `value` + `onValueChange` 쌍.

- uncontrolled(내부 state) 모드를 함께 지원하지 않는다. 두 모드 지원은 "값이 안 바뀌는" 버그의 대표 원인이다.
- 폼 라이브러리와의 결합도 controlled가 전제다 (`form-guide.md`, 작성 예정).
- 예외: `Modal`/`BottomSheet` 의 열림 상태는 사용처가 항상 소유한다 (`open` + `onClose`).

## 6. ref

**React 19 기준으로 `ref` 를 일반 prop으로 받는다.** `forwardRef` 를 쓰지 않는다.

```tsx
type ButtonProps = { ref?: React.Ref<HTMLButtonElement> } & ...
```

- 상호작용 컴포넌트(`Button`, `Input`, `Textarea`, `Select`)는 `ref` 를 반드시 받는다. 포커스 이동·스크롤 대상이 된다.
- 순수 표시 컴포넌트(`Badge`, `Skeleton`)는 필요할 때만 추가한다.

## 7. 접근성 계약 (컴포넌트가 보장할 것)

프로젝트 전체 a11y 규칙은 `styling-guide.md` §6이다. 여기서는 **각 컴포넌트가 자체적으로 보장해야 하는 것**을 정한다.

| 컴포넌트                    | 보장                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Button`                    | `type` 기본값 `"button"` (form 안에서 의도치 않은 submit 방지). `loading` 이면 `disabled` + `aria-busy` |
| `Chip` / `Tab`              | `aria-pressed` / `aria-selected` 를 상태와 동기                                                         |
| `Input` 계열                | `label` 연결(`id`/`htmlFor`), `error` 시 `aria-invalid` + `aria-describedby`                            |
| `Modal` / `BottomSheet`     | focus trap, `Esc` 닫기, 열릴 때 body 스크롤 잠금, 닫힐 때 트리거로 포커스 복귀                          |
| `Skeleton`                  | `aria-hidden` (스크린리더에 의미 없는 반복 읽기 방지)                                                   |
| `EmptyState` / `ErrorState` | 제목이 heading 요소여야 한다                                                                            |

### icon-only 버튼은 타입으로 강제한다

주석으로 "aria-label 붙이세요"라고 쓰면 반드시 누락된다. **타입으로 막는다.**

```ts
type IconOnly = { iconOnly: true; 'aria-label': string; children?: never }
type WithLabel = { iconOnly?: false; children: React.ReactNode }

export type ButtonProps = (IconOnly | WithLabel) & BaseButtonProps
```

`iconOnly` 를 주고 `aria-label` 을 빼면 **컴파일이 실패한다.** 이런 식으로 리뷰 항목을 타입으로 내리는 것을 우선한다.

## 8. 파일 내부 순서

```tsx
'use client'                    // 필요할 때만, 최상단

// imports (coding-conventions.md §2 4그룹)

// 1. 타입
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonProps = ...

// 2. 상수 (variant/size 맵)
const VARIANT: Record<ButtonVariant, string> = { ... }

// 3. 컴포넌트 (파일당 1개가 기본)
export function Button({ ... }: ButtonProps) { ... }

// 4. 합성 하위 컴포넌트
Button.Group = function ButtonGroup() { ... }

// 5. 파일 내부 전용 helper
function resolveTone() { ... }
```

- 타입을 파일 하단에 두지 않는다. 계약이 먼저 읽혀야 한다.
- 재사용되는 helper는 `src/lib/` 로 뺀다. 파일 내부 helper는 그 파일에서만 쓰는 것만.

## 9. 승격 / 확장 규칙

### feature 전용 → 공통으로 승격

> **2곳 이상의 feature에서 쓰이면 `src/components/` 로 올린다.** 1곳이면 feature 안에 둔다.

- "나중에 쓸 것 같아서" 미리 공통으로 만들지 않는다. 사용처가 하나면 추상화가 틀릴 확률이 높다.
- 승격할 때 feature 고유 개념(장소·일정 같은 도메인 용어)을 prop 이름에서 제거한다.

### 기존 공통 컴포넌트 확장

- 새 prop은 **항상 optional + 기존 동작을 유지하는 기본값**으로 추가한다.
- 기본 동작을 바꾸는 변경은 **모든 사용처를 grep해 확인**하고 PR에 목록을 적는다.
- variant/size 값 추가는 `DESIGN.md` 갱신과 같은 PR에서 한다.

## 10. 상태 표현 컴포넌트 (재확인)

`styling-guide.md` §2에서 분리한 3종의 계약을 여기서 고정한다. **이 셋을 하나로 합치지 않는다.**

| 컴포넌트     | prop                                                  | 재시도 버튼   |
| ------------ | ----------------------------------------------------- | ------------- |
| `Skeleton`   | `count?`, `variant?: 'text' \| 'card' \| 'thumbnail'` | —             |
| `EmptyState` | `title`, `description?`, `action?`                    | **슬롯 없음** |
| `ErrorState` | `title`, `description?`, `onRetry` (**필수**)         | 필수          |

- `EmptyState` 에 `onRetry` prop을 추가하자는 요청은 거절한다. 404에 재시도 버튼을 붙이는 경로가 열린다 (`api-integration-guide.md` §3).
- `ErrorState` 의 `onRetry` 는 **필수 prop**이다. optional로 두면 빠진다.
- `EmptyState.action` 은 재시도가 아니라 **다음 행동**이다 (예: "다른 지역 선택하기").

## 11. 체크리스트

새 공통 컴포넌트를 만들거나 확장할 때:

- [ ] prop 이름이 §1 표를 따른다
- [ ] `variant`/`size` 값이 §2 표준 집합 안에 있다
- [ ] `Record<Union, string>` 으로 맵을 선언했다 (누락을 타입체커가 잡는다)
- [ ] `className` 을 받고 `cn()` 으로 병합한다 (레이아웃 유틸리티 용도)
- [ ] 표시 토글 prop이 3개 이하다 (넘으면 합성)
- [ ] controlled 전용이다
- [ ] 상호작용 컴포넌트면 `ref` 를 받는다
- [ ] §7 접근성 계약을 지킨다. icon-only는 타입으로 강제했다
- [ ] 파일 내부 순서가 §8을 따른다
- [ ] 확장이면 새 prop이 optional이고 기존 사용처가 깨지지 않는다
- [ ] `md` 사이즈의 터치 영역이 44px 이상이다
