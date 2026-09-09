# 긴급 시설 화면을 장소 찾기 지도 문법으로 통일 — 설계

> **작성일**: 2026-09-09
> **이슈**: [#353](https://github.com/8llow8llowMe/hondigagae/issues/353) · 브랜치 `refactor/fe/353-emergency-map-unification`
> **대상**: `frontend/` — `/emergency`
> **화면 정본 관계**: 아트보드 `혼디가개 긴급 시설.dc.html` 02·04 절을 **이 문서가 대체한다** (§9)
> **기준 화면**: 아트보드 `혼디가개 장소 찾기.dc.html` 05(데스크톱) · 06(모바일), 구현체 `src/features/place/place-map-view.tsx`

## 0. 문제

`/emergency` 와 `/places` 가 같은 일(제주에서 갈 곳을 지도와 목록으로 찾기)을 하는데 화면
문법이 다르다. 그래서 사용자가 두 번 배우고, 기능 파악이 늦다.

| | `/places` | `/emergency` (현재) |
| --- | --- | --- |
| 기본 보기 | 지도 | 목록 |
| 지도 배치 | 지도가 바탕, 패널·시트가 그 위에 얹힘 | 목록과 나란한 2단의 우측 열 |
| 데스크톱 목록 | 지도 위 400 부동 패널 (접기 탭) | 좌측 480 고정 열 |
| 모바일 목록 | 3단 하단 시트 (`MapSheet`) | 보기 토글로 지도와 배타 |
| 첫 카메라 | 제주 해안선 anchor + level 9 + 상단 35% 바다 | 내 위치, 확대 단계 지정 없음 |
| 목록 → 지도 | 행 클릭 = 핀 선택 + level 5 확대 | **없음** (행에 선택 핸들러가 없다) |
| 핀 클릭 | 행 강조 + 확대 | 하단 부동 카드, **확대 없음** (`selectedLevel` 미전달) |
| 목록 범위 | 지도 영역 안 (`지도에 보이는 N곳`) | 반경 안 전량 |
| 필터 위치 | 패널 머리 · 시트 툴바 공용 (`PlaceMapFilterBar`) | 목록 본문 안 |

### 0-1. 탐색에서 드러난 사실 — 설계를 바꾼 세 가지

**① "4~12곳 화면" 이라는 전제가 이미 깨져 있다.** `emergency-map.tsx` 와
`facility-selected-card.tsx` 주석은 *"시설이 4~12곳 규모라 목록을 단계로 나눌 만큼 길지
않다"* 를 근거로 시트 대신 부동 카드를 골랐다. 그런데
`frontend/docs/features/emergency/공통명세.md` E2-1 의 dev 실측(2026-09-08)은 **제주시청
반경 10km = 136곳**, 제주 전역(`radius=50000`) = 214곳이다. 그래서 지금 지도는 이름 붙은
핀 136개가 얹힌 상태이고, 부동 카드 하나로는 그 목록에 닿을 방법이 없다. 클러스터 +
영역 필터 + 3단 시트(= `/places` 구성)가 이 데이터에 맞는 구성이다.

**② 목록에서 지도를 고를 수가 없다.** `FacilityRow` 는 `Row` + 전화 버튼이고 선택
핸들러가 없다. `EmergencyMap` 은 `MapCanvas` 에 `selectedLevel` 을 넘기지 않아 핀을 눌러도
확대가 일어나지 않는다. 즉 "카드/제목을 누르면 줌인" 은 개선이 아니라 **없는 기능**이다.
"위치 파악이 늦다" 의 직접 원인이 이것이다.

**③ 지도 중심이 렌더마다 되돌아가는 결함이 있다.** `EmergencyView` 가
`center={position === null ? null : { lat: position.lat, lng: position.lng }}` 를 렌더 중에
새 객체로 만들어 넘긴다. `MapCanvas` 의 중심 effect 는 `[center]` 의존이라 참조가 바뀌면
`map.setCenter` 를 호출한다 — 필터 칩을 누를 때마다 지도가 내 위치로 되돌아간다.
`/places` 는 `center` 를 state 에 두고 "내 위치" 버튼을 누를 때만 채워서 이 문제가 없다.
**통일하면 자연히 사라진다.** 구현 중 브라우저에서 재현을 확인하고 넘어간다.

## 1. 목표와 비목표

**목표**

- `/emergency` 의 지도 보기를 `/places` 지도 보기와 **같은 레이아웃·같은 상호작용**으로 만든다
- 첫 카메라의 틀잡기 규칙을 두 화면이 공유한다
- 시설 제목·행·핀 어디를 눌러도 **같은 한 가지**가 일어나고, 위치를 도로 단위로 확대해 보여준다
- 급할 때의 도달성(전화까지 한 번의 탭, 지도 실패 시 목록 보존)을 **깎지 않는다**

**비목표**

- 백엔드 계약 변경. `GET /emergencies/facilities` 를 그대로 쓴다
- 시설 상세 라우트 (`GET /emergencies/facilities/{facilityId}` · 이슈 #148). 목록 응답이 이미 상세와 같은 필드를 준다
- `/places` 쪽 동작 변경. 공유 코드를 꺼내 쓸 뿐 `/places` 의 화면 결과는 그대로다
- 경로 안내 자체 구현. 길찾기는 지금처럼 외부 지도 앱 딥링크다

## 2. 라우트와 레이아웃 구조

`view-mode.ts` 에 상수를 하나 더한다. `/places` 가 `PLACES_DEFAULT_VIEW` 로 하는 것과 같다.

```
EMERGENCY_DEFAULT_VIEW = 'map'

/emergency            → 지도 (전면)
/emergency?view=list  → 목록
```

`parseViewMode` 와 `viewModeHref` 에 **같은 기본값을 넘긴다.** 어긋나면 토글이 가리키는
보기와 페이지가 그리는 보기가 달라진다 (`/places` 가 같은 함정을 주석으로 남겨 뒀다).

### 2-1. 지도 갈래

`app/(main)/emergency/page.tsx` 의 지도 분기는 `PlacesPage` 의 `view === 'map'` 분기와 같은
모양이 된다 — `max-w-screen-md` 제거, 헤더 블록 제거, `<h1 className="sr-only">`,
`<main>` 에 패딩 없음.

```
EmergencyMapView
├── MapCanvas                 className="map-canvas-height w-full"
├── 우상단 세로 스택           absolute top-5 right-4 z-30 md:right-10 lg:top-6
│   ├── ViewToggle            variant="icon" · shadow-md
│   └── MapLocateButton       제주 안일 때만 렌더
├── 데스크톱 좌측 패널         absolute top-6 bottom-8 left-4 z-30 hidden lg:block
│   │                         map-panel-width(400) · rounded-tr-none · 접기 탭 (-right-6)
│   ├── EmergencyFilterBar    패널 머리 (border-b px-3 py-2)
│   ├── PositionNotice        위치 폴백일 때만
│   ├── 캡션 줄               개수 · 반경 · 기준
│   └── EmergencyMapPanel     목록
└── MapSheet                  모바일 3단 · label · toolbar · header · children
```

**여백·좌표·`z-index` 를 `/places` 에서 그대로 가져온다.** 두 화면을 번갈아 열 때 같은
컨트롤이 자리를 옮기면 같은 것으로 보이지 않는다. `top-6 bottom-8 left-4` 의 `bottom-8` 은
카카오 축척·로고 막대(바닥 0~19px)를 피한 값이므로 임의로 줄이지 않는다.

`emergency-map-height` (`app/globals.css`) 를 **삭제하고** `map-canvas-height` 를 쓴다.
전자는 목록과 나란히 서던 시절의 높이다.

`MapSheet` 에 `label` prop 을 더한다. 지금 `aria-label` 이
`messages.map.sheetLabel = '장소 목록'` 하드코딩이라 병원 목록이 "장소 목록" 으로 읽힌다.
`/places` 는 `'장소 목록'`, `/emergency` 는 `emergencyMessages.sheetLabel` 을 넘긴다.

### 2-2. 목록 갈래

**보이는 화면을 그대로 유지한다.** 한 컬럼, `max-w-screen-md`, 제목 + `ViewToggle` 헤더 —
레이아웃과 문구는 바뀌지 않는다. `?view=list` 와 **지도 SDK 실패 폴백이 같은 것을 쓴다.**
응급 화면에서 지도 없이 전화까지 도달하는 경로가 여기다.

`EmergencySection` 자체는 한 곳만 바뀐다: **개수·relief 가 셀 배열을 props 로 받는다**
(§5-3). 목록 갈래는 반경 전량을, 지도 갈래는 영역 안 배열을 넘긴다. 지금은 `result` 에서
스스로 꺼내 세고 있어 지도 갈래가 다른 범위를 넘길 방법이 없다.

`/places?view=list` 는 좌 280 필터 레일 2단이지만 `/emergency` 는 한 컬럼으로 남긴다 —
이 화면의 필터는 칩 5개라 280 레일을 채울 것이 없다.

## 3. 첫 카메라

`framedCenterLat` 과 `JEJU_MAP_SEA_RATIO`(0.35) 를 **같은 함수·같은 값으로** 쓴다. 다른 것은
anchor 와 level 둘뿐이다.

| 상태 | anchor | level |
| --- | --- | --- |
| 위치 허용 (`kind: 'granted'`) | 내 위치 | 반경에서 역산 |
| 위치 폴백 (`kind: 'fallback'`) | `JEJU_MAP_ANCHOR` | `JEJU_MAP_LEVEL`(9) — `/places` 와 동일 |

폴백일 때 `/places` 와 **픽셀 단위로 같은 첫 화면**이 된다. 위치를 알 때만 그 지점으로
옮기고, 옮길 때도 틀잡기 비율은 같아서 구도가 흔들리지 않는다.

### 3-1. `levelForSpanMeters` — 반경에서 확대 단계를 역산한다

`lib/map/viewport.ts` 에 더한다.

```ts
/** `meters` 가 `pixels` 안에 들어오는 가장 작은(= 가장 확대된) level */
export function levelForSpanMeters(meters: number, pixels: number): number
```

`metersPerPixel(level) = 0.25 × 2^(level-1)` 로 `metersPerPixel(level) × pixels >= meters` 를
만족하는 최소 level 을 찾고, 카카오 범위 `[1, 14]` 로 자른다. 컨테이너의 **짧은 변**을
넘긴다 (긴 변으로 맞추면 짧은 변에서 잘린다). 컨테이너 높이를 모를 때는
`framedCenterLat` 과 같은 `FALLBACK_HEIGHT_PX`(640) 규칙을 따른다.

반경 10km → 지름 20km 일 때 결과:

| 뷰포트 | 짧은 변 | level | 담기는 폭 |
| --- | --- | --- | --- |
| 모바일 375×~700 | 375 | 9 | 24.0km |
| 데스크톱 1280×~800 | 800 | 8 | 25.6km |

반경을 넓히면 단계가 따라간다 (20km → 9 / 10, 40km → 10 / 11). **"보는 범위 = 조회한
범위" 가 상수를 박는 것보다 정확하게 유지된다.**

### 3-2. 첫 프레임을 기다리지 않는다 — `MapCanvas` 에 `camera` prop 을 더한다

`MapCanvas` 는 지도를 **의존성이 빈 effect** 안에서 만들고, 그때 anchor·level·바다 비율을
모듈 상수에서 직접 읽는다. 그런데 좌표는 `getCurrentPosition()` 이 비동기로 주므로 마운트
시점에는 `position === null` 이다. 여기서 두 갈래가 갈린다.

- **지도를 늦게 만든다** (`position !== null` 까지 대기 — 지금 코드가 그렇다): 위치 타임아웃이 10초라 지도 기본 화면이 최악 10초간 비어 있다. 목록이 기본이던 시절에는 감당할 수 있었지만 지도가 기본이면 안 된다
- **먼저 만들고 한 번 옮긴다** ← **이쪽을 고른다**

첫 프레임은 지금의 모듈 상수 그대로 만든다 — 즉 **`/places` 의 첫 화면과 픽셀 단위로
동일하다.** 좌표가 도착하면 그때 한 번 카메라를 확정한다. 위치가 폴백으로 떨어지면
**옮기지 않는다** — 첫 프레임이 이미 정답이라 폴백 경로에 추가 작업이 없다.

```ts
// MapCanvas 에 더하는 prop. 객체 참조가 바뀔 때만 적용된다
camera?: { anchor: LatLng; spanMeters: number } | null
```

`MapCanvas` 가 자기 컨테이너 크기를 아는 유일한 곳이므로 환산도 여기서 한다:
`level = levelForSpanMeters(spanMeters, min(clientWidth, clientHeight))` →
`lat = framedCenterLat(anchor.lat, clientHeight, level, JEJU_MAP_SEA_RATIO)` →
`setLevel` + `setCenter`. 기존 `center` prop 은 그대로 남기고 `/places` 는 계속 그것을 쓴다
— **`/places` 호출부와 동작은 바뀌지 않는다.**

**호출부는 `camera` 를 `useMemo` 로 만든다.**

```ts
const camera = useMemo(
  () => (position === null ? null : { anchor: { lat: position.lat, lng: position.lng }, spanMeters: radius * 2 }),
  [position, radius],
)
```

렌더 중에 새 객체를 만들면 §0-1 ③ 의 결함이 그대로 재현된다 — 필터 칩을 누를 때마다
카메라가 되돌아간다. `[position, radius]` 에만 반응하므로 반경을 넓히면 구도가 따라오고,
필터를 만지면 지도는 가만히 있는다.

## 4. 선택 상호작용

핀 · 행 · 행의 제목, **세 경로가 모두 같은 한 가지**를 한다. 시설 상세 라우트가 없으므로
(§1 비목표) 제목은 링크가 아니라 선택 트리거다.

```
selectedId 설정
 → MapCanvas: level 4 까지 확대(핀 고정 anchor) → ZOOM_MS(300) 후 panTo
 → 패널·시트: 그 행에 bg-row-selected + scrollIntoView
 → 모바일: 시트가 'min' 이면 'mid' 로 올린다 (안 그러면 고른 행이 화면 밖이다)
 → 선택된 행이 펼쳐지며 길찾기 버튼이 나온다 (전화는 이미 행에 있다)
```

`SELECTED_FACILITY_MAP_LEVEL = 4` — `lib/geo/coord.ts` 에 `SELECTED_PLACE_MAP_LEVEL`(5) 옆에
둔다. **한 단계 더 깊은 값을 쓰는 근거를 남긴다:** `/places` 가 5에서 멈춘 이유는 주석에
적힌 대로 *"4로 내리면 카드 하나를 누른 순간 목록이 한두 건으로 남아 다음 카드를 이어
누를 수가 없다"* 인데, 이 화면은 반경 10km 에 136곳이라 그 문제가 생기지 않는다. 그리고
`cellSizeFor(4) === 0` 이라 **묶음이 전부 풀려 개별 핀이 된다** — 1280 폭에서 2.6km,
375 폭에서 750m. 도로와 골목이 읽히는 단계다.

> **정정 (2026-09-09, 브라우저 실측 후)**: 위 밀도 논거는 틀렸다. 반경 10km 에 136곳이
> 있어도, 레벨 4 로 확대하면 그 개별 핀들은 좁은 프레임(2.6km/750m) 밖으로 대부분
> 밀려난다 — 실측: 레벨 4 확대 후 136곳 중 4곳만 프레임 안에 남았다. `/places` 가
> 5에서 멈춘 문제(다음 카드를 이어 누를 수 없다)는 이 화면에서도 그대로 일어난다.
> **4 를 쓸 수 있는 진짜 이유는 밀도가 아니라 §4 위 "선택 상호작용" 흐름과
> `emergency-map-view.tsx` 의 `frozenBounds` 다** — 선택이 살아 있는 동안 목록·칩이
> 세는 영역을 선택 직전 값으로 얼려 두므로 지도가 확대돼도 목록이 줄지 않는다.
> `frozenBounds` 를 걷으면 이 값도 5로 되돌려야 한다. 근거는
> `src/lib/geo/coord.ts` 의 `SELECTED_FACILITY_MAP_LEVEL` doc-comment 로 옮겼다.

**`FacilitySelectedCard` 를 삭제한다.** 모바일에서 시트와 부동 카드가 같은 바닥 자리를
다투고, 지도를 가리는 표면이 둘이 된다. 카드에만 있던 길찾기는 선택된 행의 펼침 상태로
옮긴다 — 지도를 가리는 표면이 하나로 줄고, `/places` 와 같은 문법이 된다.

**선택 카드에서만 길찾기를 노출한다** 는 기존 규칙(*"급할 때 누를 것이 둘이면 고르는 데
시간이 든다"*)은 **유지된다.** 길찾기는 여전히 선택된 한 행에만 나오고, 선택되지 않은
행에는 전화 하나뿐이다. 노출 조건은 그대로이고 그것을 담는 표면만 바뀐다.

좌표가 없으면 길찾기 버튼을 두지 않는다 (`directionsUrl` 이 `null`). 눌러도 못 가는
버튼은 없는 것만 못하다 — 기존 규칙 그대로다.

### 4-1. 행 구조 — `/places` 의 패턴을 그대로 베끼지 않는다

`PlaceMapPanel` 은 **행 전체를 `<button>` 으로 감싸고** 그 안의 `PlaceRowContent` 가
`titleHref` 로 제목을 `<Link>` 로 만든다. 즉 `<a>` 가 `<button>` 안에 들어간다.
`place-row.tsx` 의 주석은 `<a>` 안의 `<button>` 만 경계하고 이쪽은 짚지 않았다.
**긴급 시설 행에는 `tel:` 링크와 길찾기 링크가 반드시 있으므로 이 구조를 그대로 쓰면
안 된다.**

지금 `FacilityRow` 의 구조가 이미 답이다 — 내용 블록과 전화 버튼이 **형제**다. 선택
버튼을 내용 블록에만 씌운다.

```
<li>                                     ← 선택 시 bg-row-selected
  <div class="flex">
    <button aria-pressed>                ← 이름·상태·시간·거리·주소 (선택 히트 영역)
      <FacilityRowContent />
    </button>
    <a href="tel:...">                   ← 형제. 52px
  </div>
  {selected && <a href={directionsUrl}>}  ← 형제. 44px 이상. 선택된 행에만
  {좌표 없음 && <p>}                       ← messages.map.noCoordinate
</li>
```

"펼침" 은 **길찾기 링크 한 줄이 추가되는 것**이다. 접힌 정보를 여는 것이 아니라 — 행이
보여주는 사실(이름·상태·시간·거리·주소)은 선택 여부와 무관하게 항상 전부 보인다. 급할
때 읽을 것을 선택 뒤로 숨기지 않는다.

선택 배경(`bg-row-selected`)은 `<li>` 에 걸어 길찾기 줄까지 함께 물든다. 판정
색(`metric-*`)을 쓰지 않는다 — 지도 마커의 검정 채움과 짝을 이뤄 "같은 것" 을 가리키는
용도다.

## 5. 데이터와 상태

**조회는 지금과 같다.** `useNearbyFacilities(position, radius)` 한 번, `size=250`,
`staleTime` 60초. **지도를 옮겨도 재조회하지 않는다.**

### 5-1. 재조회하지 않는 이유 — `/places` 와 일부러 다른 하나

`/places` 는 지도를 옮기면 `GET /places/nearby` 로 갈아탄다. `/emergency` 에서 같이 하면
`distanceMeters` 가 **지도 중심 기준**이 되어 목록의 "가까운 순 · 480m" 과 마커 라벨이
내 위치 기준이 아니게 된다. 이 화면은 거리를 **표시하고 정렬 근거로 쓰는** 화면이라 그
오차가 비싸다 (`positionFallback` 일 때 거리를 아예 감추는 기존 규칙과 같은 판단이다).

대신 **반경이 "더 넓게 찾기" 의 손잡이**다 (§5-4). 화면 문법(지도 바탕, 위에 얹힌 패널,
영역 기준 개수, 클러스터, 선택 → 확대)은 완전히 같고, 데이터 출처 규칙만 다르다. 두
화면이 사용자에게 하는 약속이 다르기 때문이다.

### 5-2. 파이프라인 — 순서가 개수의 정확성을 정한다

```
inRadius = query.data.facilities                  // 반경 안 전량 (최대 250)
inBounds = inRadius.filter(영역 안 | 좌표 없음)     // ← 칩 개수 · relief 가 세는 배열
visible  = applyFilters(inBounds, filters)        // ← 핀 · 목록 · 캡션 개수
```

**`inBounds` 를 세고 `visible` 을 세지 않는다.** `facilityCounts` 주석의 규칙이
*"각 칩은 그 칩만 눌렀을 때의 개수"* 이므로, 다른 조건이 이미 걸린 배열을 세면 칩이
화면에 보이는 목록과 같은 수가 되어 아무것도 알려주지 못한다. `facilityCounts` ·
`reliefs` 는 배열을 받는 함수라 **시그니처 변경 없이** 넘길 배열만 바꾸면 된다.

**좌표가 없는 시설은 영역 필터에서 살린다** (`coord === null || isWithinBounds(...)`).
지도가 판단할 수 없다는 이유로 병원을 숨기면 안 된다 — `/places` 와 같은 규칙이고, 그
행에는 `messages.map.noCoordinate` 한 줄을 붙인다.

`bounds` 는 `MapCanvas` 의 `idle` 에서만 갱신되므로 드래그 중에 개수가 떨리지 않는다.
`onBoundsChange` 의 `userMoved` 분기는 **쓰지 않는다** — 재조회가 없어서 첫 `idle` 과
사용자 이동을 가를 이유가 없다.

### 5-3. 개수의 범위를 영역으로 통일한다

캡션이 "지도에 보이는 12곳" 인데 칩이 "병원 120" 이면 두 숫자가 서로를 부정한다. 그래서
칩 개수와 relief 제안("24시간 끄면 N곳")도 영역 안 기준으로 계산한다 — 지도 화면에서는
"이 지역에서 끄면 몇 곳" 이 맞는 질문이다.

`countsAreComplete(result)` 는 **반경 기준 그대로**다. 250 으로 잘렸는지는 응답의
`totalCount` 로만 알 수 있고 영역과 무관하다. 잘렸으면 지금처럼 칩에서 숫자를 뺀다.

목록 갈래(`?view=list`)의 개수는 지금처럼 반경 전량 기준이다 — 거기에는 지도 영역이 없다.

### 5-4. 반경을 필터 바로 올린다

지도 이동 재조회가 없으니 반경이 유일한 "더 넓게" 손잡이인데, 지금은 0건 화면에만 있어
지도에서는 닿을 수 없다. `/places` 의 `지역 ▾` 칩과 **같은 자리·같은 방식**으로 둔다:
칩 → `BottomSheet` → 취소 / 적용 (`SheetFooter` 규칙 그대로, "적용" 문구는
`messages.place.filterApply` 와 동일 규칙).

선택지는 `widen()` 의 ×2 사다리와 상한을 그대로 따른다: **10km · 20km · 40km · 50km**
(`DEFAULT_RADIUS_METERS` = 10000, `MAX_RADIUS_METERS` = 50000). 0건 화면의
`반경 넓히기`(×2) 버튼은 그대로 남긴다 — 거기서는 고르는 것보다 한 번 누르는 것이 빠르다.

### 5-5. 필터 바 구성

```
EmergencyFilterBar
 1행  [전체 12] [병원 9] [약국 3]                      ← ChipGroup exclusive · ScrollRail
 2행  [반경 10km ▾] [24시간 1] [지금 진료중 5] [초기화]
```

1행을 `ScrollRail` 로 감싼다. 칩이 3개라 실제로 넘치지 않지만, `/places` 필터 바와 같은
컨테이너를 써서 400 패널과 375 시트에서 넘칠 때의 동작(fade 마스크 + 원형 화살표)이 같게
남는다. `open24Note`("24시간 운영으로 확인된 곳은 제주에 몇 곳뿐이에요") 는
`filters.open24Only` 일 때 지금처럼 붙인다 — 백엔드 스키마가 화면에 알리라고 명시한 사실이다.

`초기화` 는 `DEFAULT_FACILITY_FILTERS` 와 다를 때만 나온다 (`/places` 의 `dirty` 규칙). 반경은
필터가 아니라 조회 파라미터이므로 초기화 대상에 넣지 않는다.

### 5-6. 캡션 줄과 위치 폴백

```
지도에 보이는 12곳 · 반경 10km              현재 위치 기준
```

`/places` 의 캡션 줄과 같은 자리(`bg-bg-sunken border-b px-4 py-2`)를 쓰되, 이 화면이 말해야
하는 사실(반경, 기준점)을 담는다. 기준점 문구는 기존 `basisCurrent` / `basisJeju` 를 쓴다.

`PositionNotice` 는 **지도 위에 띄우지 않고 패널·시트 안, 캡션 줄 위**에 둔다. 거리가 왜
안 보이는지를 설명하는 줄이라 목록 옆에 있어야 하고, 지도를 가리면 안 된다. 다시 시도
버튼을 두지 않는 두 갈래(`unsupported` · `outside`) 규칙은 그대로다.

### 5-7. 내 위치 버튼

`MapLocateButton` 을 `/places` 와 같은 자리(`ViewToggle` 바로 아래 세로 스택)에 둔다.
제주 밖이면 렌더하지 않는다.

**`/places` 와 한 가지가 다르다:** 누르면 카메라만 옮기는 것이 아니라
`getCurrentPosition()` 결과로 `position` 을 갈아치우므로 **조회가 다시 돈다**
(`position` 이 query key 다). 거리와 정렬이 새 위치 기준으로 맞춰져야 하는 화면이라
그것이 맞다. 목록 갈래의 `retryPosition` 버튼과 같은 동작이고, 같은 함수를 부른다.

## 6. 실패와 접근성

**지도 SDK 실패** — `/places` 와 같다. `mapFailure !== null` 이면 목록 갈래(§2-2)를 그대로
그리고 위에 안내 한 줄(`role="status"`)을 둔다. 이 화면에서는 이 경로가 특히 중요하다.

**조회 실패** — 지금처럼 `ErrorState` + 다시 시도. 지도 보기에서는 패널·시트 안에 그린다.
지도는 남는다 (배경으로서 위치 맥락을 여전히 준다).

**좌표 대기** — `position === null || query.isPending` 이 로딩이다. 지금 규칙 그대로.
`EmergencySkeleton` 을 패널·시트 안에 그린다.

**영역 안 0건 두 갈래를 구분한다.**

| 상태 | 화면 |
| --- | --- |
| `inBounds` 가 비었다 (지도를 반경 밖으로 옮겼다) | `messages.map.emptyInView` + 새 문구 + `반경 넓히기`(`canWiden` 일 때) |
| `inBounds` 는 있는데 `visible` 이 비었다 (필터) | 기존 `EmptyResult` 의 relief 버튼 (`inBounds` 기준) |

`messages.map.emptyInViewDescription` 은 "지도를 움직이거나 조건을 풀어 보세요" 로
`/places` 전용이므로, 반경을 말하는 문구를 `emergencyMessages` 에 새로 둔다.

**접근성**

- 선택 히트 영역은 `<button aria-pressed>` 다. 지도 화면에서 행을 누르는 것은 이동이 아니라 선택이다
- **전화·길찾기 `<a>` 는 그 버튼의 형제다** — `<a>` 를 `<button>` 안에 넣지 않는다 (§4-1)
- 전화 버튼 52px · 길찾기 44px 이상을 지킨다 (`DESIGN.md` §7)
- `MapSheet` 는 모달이 아니다 — 포커스를 가두지 않고 배경 덮개가 없다. 지도와 시트를 오갈 수 있어야 한다
- `prefers-reduced-motion` 은 `MapCanvas` 가 이미 JS 로 판정해 즉시 이동한다. 새로 할 것이 없다

## 7. 컴포넌트 분해

**새로 만드는 것**

| 파일 | 책임 |
| --- | --- |
| `src/features/emergency/use-emergency-board.ts` | 위치 · 반경 · 필터 · 조회를 한곳에서 소유. 두 갈래가 같은 상태 모델을 쓴다 |
| `src/features/emergency/emergency-map-view.tsx` | 지도 갈래 조립 (`place-map-view.tsx` 골격) |
| `src/features/emergency/emergency-list-view.tsx` | 목록 갈래 + SDK 실패 폴백. `EmergencySection` 을 감싼 얇은 층 |
| `src/features/emergency/emergency-filter-bar.tsx` | 패널 머리 · 시트 툴바 공용 필터 줄 (§5-5) |
| `src/features/emergency/emergency-map-panel.tsx` | 패널·시트 안의 선택 가능한 목록 |

**고치는 것**

| 파일 | 변경 |
| --- | --- |
| `app/(main)/emergency/page.tsx` | `EMERGENCY_DEFAULT_VIEW` 로 두 갈래 분기. 지도 갈래는 폭 제한·헤더 제거 |
| `src/features/emergency/facility-row.tsx` | `FacilityRowContent` 추출. 선택 버튼은 내용 블록에만, 링크는 형제 (§4-1) |
| `src/features/emergency/emergency-section.tsx` | 개수·relief 가 받을 배열을 props 로 (목록 갈래는 반경, 지도 갈래는 영역) |
| `src/features/map/map-canvas.tsx` | `camera` prop 추가 (§3-2). 기존 `center` 는 그대로 남기므로 `/places` 호출부는 무변경 |
| `src/components/map-sheet.tsx` | `label` prop 추가. `messages.map.sheetLabel` 하드코딩 제거 |
| `src/lib/url/view-mode.ts` | `EMERGENCY_DEFAULT_VIEW` 추가 + **기본값 주석을 뒤집는다** (지금은 목록이 맞다고 적혀 있다) |
| `src/lib/geo/coord.ts` | `SELECTED_FACILITY_MAP_LEVEL = 4` 추가 (근거 주석 포함) |
| `src/lib/map/viewport.ts` | `levelForSpanMeters` 추가 |
| `src/lib/messages/emergency.ts` | `sheetLabel`, 영역 0건 문구, 반경 시트 라벨 |
| `src/lib/messages/map.ts` | `sheetLabel` 을 `/places` 전용으로 되돌리거나 호출부 인자로 이동 |
| `app/globals.css` | `emergency-map-height` 삭제 |

**지우는 것**

| 파일 | 이유 |
| --- | --- |
| `src/features/emergency/emergency-view.tsx` | 두 갈래 뷰 + 훅으로 갈라진다 |
| `src/features/emergency/emergency-map.tsx` | `EmergencyMapView` 가 `MapCanvas` 를 직접 조립한다 |
| `src/features/emergency/facility-selected-card.tsx` | 부동 카드를 없앤다 (§4) |
| `src/features/emergency/facility-selected-card.test.ts` | 위와 함께 |

**손대지 않는 것** — `facility-filters.ts`(배열을 받는 순수 함수라 그대로), `use-nearby-facilities.ts`,
`lib/api/emergency.ts`, `types/emergency.ts`, `cluster.ts`, `MapLocateButton`,
`ViewToggle`, `EmergencySkeleton`, `src/features/place/**`(전부).

## 8. 테스트

`docs/testing-guide.md` 규약(node 환경 + `renderToStaticMarkup` 문자열 assertion, jsdom 없음)을
따른다. presentational 컴포넌트로 갈라 두는 이유가 이것이다.

| 테스트 | 확인하는 것 |
| --- | --- |
| `viewport.test.ts` (기존에 더함) | `levelForSpanMeters` — 반경 10/20/40km × 375/800px 경계, `[1,14]` 절단 |
| `emergency-map-panel.test.ts` (신규) | 선택된 행에 `aria-pressed` · 선택 배경, 좌표 없는 행의 안내 줄, 선택 행에만 길찾기 |
| `emergency-filter-bar.test.ts` (신규) | 칩 개수가 넘긴 배열 기준, `open24Note` 노출 조건, `초기화` 노출 조건, 반경 라벨 |
| `facility-row.test.ts` (신규) | 좌표 없으면 길찾기 없음, `tel === null` 이어도 전화 자리가 남음, **`<button>` 안에 `<a>` 가 없음**(§4-1 — 문자열 assertion 으로 잡을 수 있다) |
| `emergency-section.test.ts` (기존 수정) | 개수 배열이 props 로 바뀐 것 반영 |
| `facility-filters.test.ts` | **변경 없음** — 시그니처를 안 바꾼다 |

`MapCanvas` 의 `camera` 자체는 테스트하지 않는다 — 카카오 SDK 가 있어야 돌고 이 저장소에
jsdom 이 없다. 그 안의 계산(`levelForSpanMeters` · `framedCenterLat`)은 순수 함수로 빼 두었고
`viewport.test.ts` 가 덮는다. 카메라 적용 자체는 §11 의 브라우저 실측으로 확인한다.

## 9. 아트보드 정본과의 관계 — 결정 기록

이 문서는 아트보드 `혼디가개 긴급 시설.dc.html` 의 **02 절(모바일 지도)과 04 절(데스크톱
2단)을 대체한다.** 01 절(목록)과 03 절(상태 4종)은 그대로 정본으로 남는다 — 목록
갈래(§2-2)가 그것을 계속 구현한다.

대체하는 이유:

1. **아트보드의 규모 전제가 실측과 다르다.** 02 절은 "4~12곳" 을 전제로 부동 카드를 골랐고, 실측은 반경 10km 에 136곳이다 (§0-1 ①)
2. **04 절의 좌 480 / 우 지도 2단은 지도가 없던 시절의 배치다.** `공통명세.md` E0 이 *"지도가 붙을 때 2단으로 간다"* 고 적었는데, 실제로 지도를 붙여 보니 같은 서비스의 다른 지도 화면(`/places` 05·06)과 문법이 갈렸다
3. **같은 컨트롤이 화면마다 다르게 생기면 사용자가 두 번 배운다** — `place-map-filter-bar.tsx` 와 `scroll-rail.tsx` 가 이미 이 원칙을 적어 두고 있다

`공통명세.md` E0 의 *"범위: 목록만. 지도는 #14"* 와 *"데스크톱도 한 컬럼이다"* 두 문단은
낡았다. 구현과 함께 갱신한다.

## 10. 함께 갱신할 문서

코드 변경과 문서 변경은 같이 움직인다.

| 문서 | 갱신할 내용 |
| --- | --- |
| `frontend/docs/features/emergency/공통명세.md` | E0 범위·컬럼 문단, 지도 절 추가(카메라·선택·영역 규칙), 아트보드 관계(§9) |
| `frontend/docs/screen-inventory.md` | §view mode 의 *"긴급 시설은 그대로 목록이다"* 를 뒤집는다. §5-2 표에 지도 기본을 반영 |
| `frontend/docs/architecture-guide.md` | §9 표의 긴급 시설 행에 "지도 이동 재조회 없음" 근거 추가. §10 의 `view` 기본값 설명 갱신 |

## 11. 검증

- `pnpm verify` (= `lint && typecheck && test`) · `pnpm format:check`
- dev 서버는 Bash 로 **포트 5174** 에 띄운다 (3000 은 카카오 지도 키 도메인 미등록이라 지도가 항상 폴백이다)
- 브라우저 실측 폭 **375 · 768 · 1280**
  - 375: 시트 'mid' 첫 화면에 행 2~3개와 52px 전화 버튼이 보이는지, 핀을 눌렀을 때 시트가 올라오며 그 행으로 스크롤되는지
  - 768: 시트 유지 + 탭바 없음(`map-sheet-above-tabbar` 가 `bottom: 0`)
  - 1280: 패널 400, `bottom-8` 이 카카오 축척 막대를 안 누르는지, 접기 탭이 제자리인지
  - 필터 칩을 눌러도 **지도가 내 위치로 되돌아가지 않는지** (§0-1 ③ 회귀 확인)
  - `?view=list` 와 SDK 실패 폴백이 같은 화면인지
- 위치 거부 · 제주 밖 좌표 두 경우에 거리가 감춰지고 폴백 카메라가 `/places` 와 같은지

## 12. 열린 항목

- 이슈 [#353](https://github.com/8llow8llowMe/hondigagae/issues/353) · 브랜치 `refactor/fe/353-emergency-map-unification` 으로 진행한다. PR 은 30파일 이내가 목표이고 (§7 기준 약 20파일), `Issue Number: #353` 을 반드시 채운다
- **작업 트리를 다른 세션과 공유한다.** 이 문서를 쓰는 동안 원래 트리의 브랜치가 `refactor/fe/348-home-heading-scale` → `refactor/fe/349-home-weather-dedup` 로 바뀌었다. 그래서 이 작업은 **별도 워크트리**(`../hondigagae-353`)에서 진행한다 — 원래 트리에서 `git switch` 하면 다른 세션의 체크아웃을 빼앗는다. `git add -A` / `git stash` 를 쓰지 않고 경로를 하나씩 스테이징한다 (`docs/git-workflow.md` §4-1)
- 반경 시트의 선택지를 4단(10/20/40/50)으로 고정했다. 사용 후 중간값(5km)이 필요해지면 그때 더한다 — 백엔드 하한은 1m 라 제약이 아니다
- **`/places` 에도 같은 중첩 문제가 있다** (§4-1): `PlaceMapPanel` 이 행 전체를 `<button>` 으로 감싸고 그 안의 제목이 `<Link>` 다. 이 작업의 범위가 아니다 — 별 이슈로 분리한다
