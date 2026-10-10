# Frontend Done Checklist

> 커밋·PR 전에 이 문서 기준으로 점검한다. 근거 문서는 각 항목에 표시했다.

## 1. 기능 단위 완료 기준

- [ ] 명세(`docs/features/**`)와 구현이 일치한다
- [ ] **호출하는 모든 엔드포인트가 Swagger에 실제로 존재한다** (`/fe-api-check`)
- [ ] `dataHeader.success` 판별을 거친다 (`dataBody` 직접 사용 없음)
- [ ] loading / empty·404 / 5xx / success 4개 상태가 각각 있고 시각적으로 구분된다
- [ ] **404에 재시도 버튼이 없다**, `resultMessage` 를 그대로 노출한다
- [ ] 5xx·무응답에는 재시도 버튼이 있다
- [ ] **비동기 job의 `status=FAILED` 를 실패로 처리한다** (HTTP 200으로 온다)
- [ ] 폴링이 완료·실패 시 멈춘다
- [ ] 화면 문구가 명세에 확정된 대로다 (즉흥 작성 없음)

## 2. 타입 / 데이터

- [ ] **`memberId` 를 `string` 으로 타이핑했다.** 다른 ID는 Swagger로 확인했다
- [ ] `resultMessage`(항상 문자열)와 `fieldErrors`(검증 실패에만)를 자리 나눠 읽는다 — 렌더 직전 `toMessage()` 로 정규화한다
- [ ] nullable 응답을 non-null로 가정하지 않는다 (`.map`/`.length` 직접 호출 없음)
- [ ] nullable 섹션은 에러가 아니라 **숨김** 으로 처리한다
- [ ] `SliceResponse` 를 `{contents, hasNext}` 로 다룬다
- [ ] **서버 enum metadata(`name`/`description`)를 그대로 렌더한다.** 한국어 매핑 테이블 없음
- [ ] 모르는 enum `code` 에 대한 기본값 폴백이 있다
- [ ] 단위(℃/km/분/원)를 화면에 표기한다
- [ ] `any` 가 없다

## 2-1. 선택 규칙 (일관성)

- [ ] **초기 화면 데이터를 서버 프리페치했다.** 예외면 `architecture-guide.md` §9 결정 트리로 근거를 댈 수 있다
- [ ] `HydrationBoundary` 를 썼다 (`initialData` 를 쓰지 않았다)
- [ ] 서버·클라이언트가 **같은 query key** 를 쓴다 (key 팩토리 공유)
- [ ] `getServerQueryClient()` 가 요청마다 새 인스턴스를 만든다 (모듈 스코프 QueryClient 없음)
- [ ] 서버 컴포넌트가 `/api/bff` 를 부르지 않는다 (`server.ts` 로 게이트웨이 직접 호출)
- [ ] **필터·정렬·탭이 URL `searchParams` 에 있다** (Zustand 아님)
- [ ] searchParams 배열이 콤마 구분 단일 키다, 기본값은 URL에서 생략된다
- [ ] 필터 파싱·직렬화가 `src/lib/url/` 순수 함수이고 **round-trip 테스트가 있다**
- [ ] 서버 데이터를 Zustand에 복사하지 않았다
- [ ] `staleTime`/`gcTime`/`retry` 가 `api-integration-guide.md` §7 표준값을 따른다 (벗어나면 근거 주석)
- [ ] mutation의 invalidate 대상이 §7 표와 일치한다
- [ ] `architecture-guide.md` §9 화면별 확정표에 이 화면이 등재됐다

## 2-2. 컴포넌트 계약

- [ ] prop 이름이 `component-guide.md` §1 표를 따른다 (`loading` — `isLoading` 금지)
- [ ] `variant`/`size` 값이 §2 표준 집합 안에 있다
- [ ] variant 맵이 `Record<Union, string>` 이다
- [ ] **`className` 으로 외형(색·radius·shadow·padding)을 덮지 않았다** — 레이아웃 유틸리티만
- [ ] 표시 토글 prop이 3개 이하다 (넘으면 합성으로 전환)
- [ ] 상호작용 컴포넌트가 controlled 전용이고 `ref` 를 받는다
- [ ] icon-only 버튼의 `aria-label` 이 **타입으로 강제**된다
- [ ] 파일 내부 순서가 §8을 따른다 (타입 → 상수 → 컴포넌트 → 하위 → helper)
- [ ] 2곳 이상에서 쓰이면 `src/components/` 로 승격했다
- [ ] 확장이면 새 prop이 optional이고 기존 사용처를 grep으로 확인했다

## 3. 클라이언트 경계

- [ ] module scope / 컴포넌트 body 최상단에서 `window`·`document`·storage에 접근하지 않는다
- [ ] effect에 cleanup이 있다 (listener·타이머·폴링·지도 마커)
- [ ] SSR에서 깨지는 SDK(카카오 지도)는 `dynamic(..., {ssr:false})` 로 로드한다
- [ ] 서버 전용 모듈에 `import 'server-only'` 가 있고 client component에서 임포트되지 않는다
- [ ] `react-router-dom` 을 쓰지 않는다

## 4. 인증 / 보안

- [ ] **토큰이 `localStorage`/`sessionStorage`/클라이언트 상태에 없다**
- [ ] `/api/bff` 를 우회해 게이트웨이를 직접 부르지 않는다
- [ ] 401 재발급이 1회로 제한되고 동시 요청에서 합쳐진다
- [ ] 보호 화면이 `proxy.ts` 의 `PROTECTED_PATHS` 에 등록됐다
- [ ] `NEXT_PUBLIC_` 접두사가 시크릿에 붙지 않았다 (JS 지도 키만 허용)
- [ ] 로그에 토큰·개인정보가 남지 않는다

## 5. 디자인 / 접근성

- [ ] `DESIGN.md` 밖의 임의 색상·radius·shadow·spacing이 없다 (arbitrary value `[13px]` 포함)
- [ ] **375 / 768 / desktop** 에서 가로 스크롤·텍스트 오버플로가 없다
- [ ] 긴 한국어 실데이터(장소명·품종명·XAI 문장)로 확인했다
- [ ] icon-only 버튼에 `aria-label` 이 있고 focus style이 살아 있다
- [ ] **지도 위 타깃**(마커·묶음 원)의 터치 영역이 44px 이상이다 — 그 밖의 모바일 컨트롤에는
      44 하한이 없다 (`DESIGN.md` §7, #883). 지도 화면의 칩은 모바일 36 이다
- [ ] 색만으로 정보를 전달하지 않는다
- [ ] 404는 중립 톤, 5xx는 danger 톤이다
- [ ] 용어가 `DESIGN.md` §1 표와 일치한다 ("반려견" 고정)

## 6. 지도 (해당 시)

- [ ] `LatLng(위도, 경도)` — `lat` 이 먼저다. 변환은 `src/lib/geo/coord.ts` 의 `toLatLng()` 을 쓴다
- [ ] 좌표 `null`/`0`/범위 밖 장소는 마커를 그리지 않는다 (`toLatLng()` 이 `null` 을 반환한다)
- [ ] 마커 재생성 시 이전 마커를 `setMap(null)` 로 제거한다
- [ ] SDK 중복 로드가 없고, 로드 실패 폴백이 있다
- [ ] 목록으로도 같은 정보에 도달 가능하다
- [ ] `navigator.geolocation` 권한 거부·타임아웃을 처리한다

## 7. 테스트

- [ ] 에러 분기 판정 함수에 테스트가 있다
- [ ] 비동기 job 실패 판정에 테스트가 있다
- [ ] 새 포맷 함수에 테스트가 있다
- [ ] 새 화면의 404 / 5xx 분기에 테스트가 있다
- [ ] fixture가 Swagger 실물 응답 기준이다

## 8. 위생

- [ ] mock/임시 데이터, `console.log`, 주석 처리된 코드가 없다
- [ ] 작업과 무관한 광범위 리팩터가 섞이지 않았다
- [ ] 새 dependency가 있으면 근거를 PR에 적었다
- [ ] 파일이 UTF-8 (no BOM) 이다

## 9. 검증 / 문서

- [ ] `pnpm verify` (= `lint && typecheck && test`) 통과 (**실제로 돌렸다**)
- [ ] `pnpm format:check` 통과
- [ ] **표면 · 레이아웃 · DOM 순서를 건드렸다면 `pnpm e2e` 도 돌렸다.** `pnpm verify` 에
      **e2e 는 들어 있지 않은데 CI 는 돌린다** — `surface.spec.ts` 가 세로 기준선과 블록
      순서를 계산된 값으로 잠그고 있어, vitest 가 전부 통과해도 여기서 깨진다
      (#536 에서 실제로 났다: 칩을 카드 안으로 옮기자 "칩이 카드보다 앞" 을 전제한
      `#457` 검사가 스트립을 못 찾았다).
  - **포트를 비켜 준다 — `E2E_PORT=<빈 포트> pnpm e2e`.** 기본값 **5175** 는
    `pnpm dev:alt2` 와 같은 포트라 병렬 세션에서 부딪힌다. 포트가 이미 쓰이면 **시끄럽게
    실패한다**(`... is already used`) — #773 이후 `reuseExistingServer` 가 기본 꺼짐이라
    남의 세션 서버를 조용히 주워 **그 코드를 검사하고 통과하는** 일은 없다. 재사용이
    필요하면 `E2E_REUSE_SERVER=1` 로 직접 켜고, 그 포트의 서버가 내 코드인지 본인이 본다.
- [ ] **검증을 우회해서 돌렸으면 우회했다고 적었다.** `pnpm` 이 PATH 에 없어
      `corepack pnpm` 을 썼거나, `verify` 를 한 덩어리로 못 돌려 `lint`·`typecheck`·`test`
      를 각각 돌렸으면 **그대로 적는다** (`local-run-guide.md` §3-1). "verify 통과" 라고만
      적으면 **한 단계도 안 돈 것과 구분되지 않는다** — 막혔을 때 건너뛰고 통과라고 적는
      것이 #773 이 막으려는 것이다.
- [ ] `docs/screen-inventory.md` 상태를 갱신했다
- [ ] 공통 규칙이 바뀌었다면 `frontend/docs/*.md` 를 갱신했다
- [ ] 디자인 토큰이 바뀌었다면 `DESIGN.md` 를 갱신했다
- [ ] 백엔드 미구현으로 막힌 항목을 "BE 후속 요청"으로 분리해 적었다
- [ ] 커밋·PR prefix가 `[FE]` 다
