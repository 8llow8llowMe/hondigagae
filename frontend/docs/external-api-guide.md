# Frontend External API Guide

> 현재 FE가 직접 붙는 외부 SDK는 **카카오 지도** 뿐이다.
> 관광·날씨·혼잡도 등 공공 데이터는 **전부 백엔드가 수집·가공한다.** FE가 공공 API를 직접 호출하지 않는다 (`backend/docs/external-api-guide.md`).

## 1. 카카오 지도

### 키 관리

| 키 | 노출 | 위치 |
|----|------|------|
| JavaScript 앱 키 | 클라이언트 노출 불가피 | `NEXT_PUBLIC_KAKAO_MAP_KEY` |
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

백엔드가 내려주는 좌표는 TourAPI 원본 기준이다.

| 필드 | 의미 | 타입 |
|------|------|------|
| `mapx` | **경도** (longitude) | 문자열로 올 수 있음 |
| `mapy` | **위도** (latitude) | 문자열로 올 수 있음 |

```ts
// 카카오는 (위도, 경도) 순서다 — mapy 가 먼저다
new kakao.maps.LatLng(Number(place.mapy), Number(place.mapx))
```

- **순서를 뒤집으면 지도가 아프리카 앞바다로 튄다.** 이 프로젝트에서 가장 흔한 실수다.
- 좌표가 `null` / `0` / 빈 문자열인 장소는 **마커를 그리지 않는다.** 파싱 결과를 `Number.isFinite` 로 검증한다.
- 좌표 변환·검증은 `src/lib/format/` 또는 `src/lib/geo/` 순수 함수로 뽑아 테스트한다.

### 생명주기 (메모리 누수)

```tsx
useEffect(() => {
  const map = new kakao.maps.Map(ref.current, options)
  const markers = places.map((p) => new kakao.maps.Marker({ position: toLatLng(p) }))
  markers.forEach((m) => m.setMap(map))

  const onClick = () => { /* ... */ }
  kakao.maps.event.addListener(map, 'click', onClick)

  return () => {
    markers.forEach((m) => m.setMap(null))            // 필수
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
