# Frontend Styling Guide

> **토큰 정본은 `../DESIGN.md` 다.** 이 문서는 그 토큰을 코드에 적용하는 규칙과 공통 컴포넌트 목록이다.

## 1. Tailwind + 토큰 연결

- `DESIGN.md` 의 토큰을 `src/styles/tokens.css` 의 CSS 변수로 선언하고, Tailwind 테마에서 그 변수를 참조한다.
- **컴포넌트에서 raw 색상값(`#2E9B6B`)을 쓰지 않는다.** 토큰 클래스만 쓴다.
- **arbitrary value 금지**: `p-[13px]`, `text-[#333]`, `rounded-[7px]`. 스케일 밖 값이 필요하면 먼저 `DESIGN.md` 갱신을 논의한다.
- 조건부 클래스는 `clsx`/`cn` 헬퍼로 조립한다. 문자열 템플릿 연결로 클래스를 만들지 않는다 (Tailwind가 감지하지 못한다).

```tsx
// 금지 — 감지 불가 + 임의 값
<div className={`p-[13px] text-[${color}]`} />

// 좋음
<div className={cn('p-4 text-fg', isActive && 'text-brand-600')} />
```

## 2. 공통 컴포넌트 (먼저 검토한다)

새 UI를 만들기 전에 아래를 확인한다. **없으면 만들고, 있으면 확장한다.** 화면마다 비슷한 버튼을 새로 만들지 않는다.

| 컴포넌트 | 위치 | 비고 |
|----------|------|------|
| `Button` | `src/components/button.tsx` | variant: primary / secondary / ghost / danger, size: sm / md / lg |
| `Card` | `src/components/card.tsx` | radius-lg + shadow-sm |
| `Input`, `Textarea`, `Select` | `src/components/` | 라벨·에러 메시지·helper text 슬롯 포함 |
| `Tab` | `src/components/tab.tsx` | `aria-selected` 필수 |
| `Badge` | `src/components/badge.tsx` | 반려견 동반 가능, AI 생성, 적합도 등급 |
| `Chip` | `src/components/chip.tsx` | 필터. radius-full, 터치 44px |
| `Modal`, `BottomSheet` | `src/components/` | 모바일은 BottomSheet 우선 |
| `EmptyState` | `src/components/empty-state.tsx` | **404/데이터 부재 전용. 재시도 버튼 슬롯 없음** |
| `ErrorState` | `src/components/error-state.tsx` | **5xx/일시 장애 전용. 재시도 버튼 필수** |
| `Skeleton` | `src/components/skeleton.tsx` | 실제 콘텐츠와 크기 유사 |

**`EmptyState` 와 `ErrorState` 를 분리한 이유**: 404(데이터 부재)와 5xx(일시 장애)의 시각 언어를 다르게 강제하기 위해서다. 한 컴포넌트에 `hasRetry` 플래그를 두면 반드시 잘못 쓰인다. (`api-integration-guide.md` §3)

**확장 규칙**: 기존 컴포넌트에 prop을 추가할 때 **기본값을 보수적으로** 둬서 기존 사용처의 동작이 바뀌지 않게 한다.

> **prop 네이밍, variant/size 표준 집합, `className` 정책, 합성 판단 기준, 컴포넌트별 접근성 계약은 `component-guide.md` 가 정본이다.** 이 문서는 "무엇을 쓸 수 있는가", `component-guide.md` 는 "어떻게 만들고 부르는가"를 담당한다.

## 3. 상태별 렌더 규칙

| 상태 | 컴포넌트 | 색 톤 | 재시도 버튼 |
|------|----------|-------|-------------|
| loading | `Skeleton` | `--bg-subtle` | — |
| 데이터 부재 / 404 | `EmptyState` | 중립 (`--fg-muted`) | **없음** |
| 일시 장애 / 5xx | `ErrorState` | `--danger-*` | **있음** |
| nullable 섹션 | 렌더하지 않음 (숨김) | — | — |

## 4. 반응형

- **모바일 우선.** 기준 뷰포트 375px.
- 375px에서 **가로 스크롤이 생기면 버그**다.
- 넓은 콘텐츠는 자체 `overflow-x-auto` 컨테이너로 감싼다. `body` 가 가로로 스크롤되게 두지 않는다.
- **한국어 실데이터는 길다.** 아래로 반드시 확인한다.
  - 제주 장소명: `제주특별자치도립김창열미술관`
  - 반려견 품종명: `웨스트하이랜드화이트테리어`
  - AI 추천 이유 문장 (서버 `description`)
- 긴 텍스트는 `word-break: keep-all` + 필요 시 `line-clamp`. **`overflow: hidden` 으로 잘라 정보를 숨기지 않는다** — 상세에서는 전문이 보여야 한다.

## 5. 지도가 있는 화면

- 모바일에서 **지도가 화면을 다 먹지 않게** 한다. 지도 + 목록의 높이 배분을 명시적으로 준다.
- 지도 안 스크롤이 페이지 스크롤을 가로채지 않게 한다 (모바일 스크롤 갇힘).
- 지도 위 카드/컨트롤은 `--shadow-md`.
- **지도는 유일한 정보 전달 수단이 될 수 없다.** 목록으로도 같은 정보에 도달 가능해야 한다.

## 6. 접근성 (필수)

- **icon-only 버튼에 `aria-label`.**
- **focus style을 제거하지 않는다.** 커스텀할 때는 `:focus-visible` 로 명확한 링을 준다.
- 키보드로 모든 조작이 가능해야 한다. 모달은 focus trap + `Esc` 닫기.
- **색만으로 정보를 전달하지 않는다.** 적합도 등급·반려견 동반 여부는 색 + 텍스트 + 아이콘.
- 터치 영역 44×44px 이상. 지도 마커·필터 칩이 특히 위험하다.
- 이미지에 의미가 있으면 `alt`, 장식이면 `alt=""`.
- `prefers-reduced-motion` 을 존중한다.

## 7. 카피 규칙

- 존댓말, 짧은 문장.
- **기준·단위를 화면에 드러낸다**: `24℃`, `도보 12분`, `1.2km`, `2024년 기준`.
- **다음 행동을 알려준다**: 데이터 없음 → "다른 지역을 선택해 주세요".
- 서버가 내려준 문구(`resultMessage`, enum `name`/`description`, XAI `reasons[].description`)는 **그대로 노출한다.** FE에서 다시 쓰지 않는다.
- 용어는 `DESIGN.md` §1 용어 표를 따른다.
