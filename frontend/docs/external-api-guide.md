# Frontend External API Guide

> 현재 FE가 직접 붙는 외부 SDK는 **카카오 지도** 뿐이다.
> 관광·날씨·혼잡도 등 공공 데이터는 **전부 백엔드가 수집·가공한다.** FE가 공공 API를 직접 호출하지 않는다 (`backend/docs/external-api-guide.md`).

## 1. 카카오 지도

### 키 관리

| 키                     | 노출                     | 위치                              |
| ---------------------- | ------------------------ | --------------------------------- |
| JavaScript 앱 키       | 클라이언트 노출 불가피   | `NEXT_PUBLIC_KAKAO_MAP_KEY`       |
| REST API 키 / Admin 키 | **절대 클라이언트 금지** | 서버 전용. 필요하면 백엔드가 쓴다 |

- **키를 하드코딩하지 않는다.** 환경변수로만.
- JS 키는 도메인 제한으로 보호한다 → **카카오 개발자 콘솔에 허용 도메인 등록이 전제**다.
  - 로컬: `http://localhost:3000`
  - 배포: 확정 시 등록 (미결)
- `NEXT_PUBLIC_` 접두사는 **클라이언트 번들에 박힌다**는 뜻이다. 이 접두사를 다른 시크릿에 붙이지 않는다.

### 로딩 방식 (고정)

```tsx
// src/features/place/map-view.tsx
'use client'
```

```tsx
// 사용처
const MapView = dynamic(() => import('@/features/place/map-view'), { ssr: false })
```

- **`ssr: false` 없이 임포트하면 빌드/런타임이 깨진다.**
- `window.kakao` 를 **module scope나 컴포넌트 body 최상단에서 읽지 않는다.** SSR에서 `undefined` 다.
- SDK는 `autoload=false` + `kakao.maps.load(cb)` 패턴으로 초기화한다. 콜백 없이 바로 `new kakao.maps.Map(...)` 하면 간헐 실패한다.
- **스크립트 중복 로드를 막는다.** 라우트 이동마다 `<script>` 가 추가되는 패턴을 쓰지 않고, 로드 여부를 전역 1회 플래그(또는 `next/script` 의 `strategy`)로 가드한다.
- **로드 실패 폴백**을 반드시 둔다. 네트워크·키 오류로 지도가 빈 회색 박스로 끝나면 안 된다. 목록으로 대체 도달 가능해야 한다.

### 좌표 (틀리기 쉬움)

**백엔드가 이미 정규화해서 내려준다.** TourAPI 원본의 `mapx`/`mapy` 문자열이 그대로 오지 않는다.

| 필드  | 의미                 | 타입               | 근거  |
| ----- | -------------------- | ------------------ | ----- |
| `lat` | **위도** (latitude)  | `Double` → `number | null` | backend `PlaceItem` |
| `lng` | **경도** (longitude) | `Double` → `number | null` | backend `PlaceItem` |

> TourAPI 원본은 `mapx`(경도) / `mapy`(위도) 문자열이고, 백엔드가 적재 시 `lat`/`lng` 로 변환한다
> (`backend/docs/entity-design.md`). **FE는 원본 필드명을 쓰지 않는다.**

```ts
// 카카오는 LatLng(위도, 경도) 순서다 — lat 이 먼저다
new kakao.maps.LatLng(coord.lat, coord.lng)
```

- **순서를 뒤집으면 지도가 기니 만 앞바다로 튄다.** 제주는 위도 33 / 경도 126 이므로 뒤집으면 위도가 126이 되어 범위를 벗어난다.
- 좌표가 `null` 이거나 `0` 인 장소는 **마커를 그리지 않는다.**
- 변환·검증은 `src/lib/geo/coord.ts` 의 `toLatLng()` 을 쓴다. 유효하지 않으면 `null` 을 반환하므로 호출부가 마커를 건너뛴다. 폴백 중심은 `JEJU_CENTER` 다.
- 이 함수에는 테스트가 있다 (`src/lib/geo/coord.test.ts`). 새 좌표 규칙을 추가하면 테스트도 추가한다.

### 생명주기 (메모리 누수)

```tsx
useEffect(() => {
  const map = new kakao.maps.Map(ref.current, options)
  const markers = places.map((p) => new kakao.maps.Marker({ position: toLatLng(p) }))
  markers.forEach((m) => m.setMap(map))

  const onClick = () => {
    /* ... */
  }
  kakao.maps.event.addListener(map, 'click', onClick)

  return () => {
    markers.forEach((m) => m.setMap(null)) // 필수
    kakao.maps.event.removeListener(map, 'click', onClick)
  }
}, [places])
```

- **마커를 다시 그릴 때 이전 마커를 `setMap(null)` 로 제거한다.** 필터가 바뀔 때마다 마커가 누적되는 것이 이 SDK의 대표 누수다.
- 인포윈도우·커스텀 오버레이도 동일하게 정리한다.
- 컨테이너가 숨겨진 상태(탭 전환, `display:none`)에서 생성하면 크기가 0이 된다 → 노출 시 `map.relayout()`.
- 마커가 많으면(장소 목록 무한 스크롤) **클러스터링 또는 상한**을 둔다.

### 현재 위치

```ts
navigator.geolocation.getCurrentPosition(onOk, onFail, { timeout: 8000 })
```

- **권한 거부·타임아웃 분기를 반드시 처리한다.** 실패 시 제주 중심 기본 좌표로 폴백하고, 그 사실을 화면에 알린다.
- `navigator` 는 브라우저 전용이다. helper 안에서 `typeof navigator === 'undefined'` 가드.

### 검토

지도 코드는 전용 서브에이전트 `fe-map-reviewer` 로 검토한다 (`team-playbook.md`).

## 2. 카카오 로그인

지도 SDK와 별개다. **FE가 카카오 SDK로 로그인하지 않는다.**
백엔드 `auth-service` 가 OAuth를 처리하고, FE는 2-step API 흐름만 쓴다. 세부는 `auth-guide.md`.

## 3. 향후 (미결)

- 카카오 메시지 API 연계 (루트 `README.md` 언급) — 주체·범위 미정
- 카카오 내비/길찾기 연동 여부 미정
