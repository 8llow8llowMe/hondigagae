# [BE] 컨벤션 리팩토링에서 미뤄 둔 것 — 별도 이슈 후보

> `refactor/be/tour-batch-core-conventions` 작업에서 **의도적으로 제외한 항목**의 기록이다.
> 각 항목은 그대로 이슈 본문으로 쓸 수 있다.
>
> 제외한 이유가 "안 중요해서"가 아니라 **범위가 다르거나 계약을 건드려서**라는 점이 요점이다.
> 그 판단이 남아 있지 않으면 다음 감사에서 같은 항목이 "왜 안 고쳤나"로 다시 올라온다.

---

## 1. `[BE] feat: 두루누비 산책 코스(walkcourse) 구현`

### 어떤 기능인가요? ✏

- `GET /api/v1/walk-courses` — 두루누비 코스 검색. `feature-status.md` 기준 **미착수**다
- tour-service 에 `walkcourse` 컨텍스트 자체가 없다

### 왜 이번에 안 했나

컨벤션 리팩토링이 아니라 **신규 기능**이다. 컨텍스트 하나를 새로 만드는 작업이라
어댑터·포트·프로세서·프레젠터가 통째로 필요하고, 감사 항목과 섞으면 PR 이 읽히지 않는다.

### 작업 상세 내용 📝

- [ ] 두루누비 API 연동 방식 결정 (배치 적재 vs 실시간) — `external-api-guide.md` §2 기준
- [ ] `walkcourse` 컨텍스트 스켈레톤
- [ ] 코스 검색 API + 응답 DTO
- [ ] 반려견 동반 관점의 필터(난이도·거리·노면) 정의

---

## 2. `[FE 계약] SuitabilityReasonItem 응답 스키마 변경`

### 어떤 기능인가요? ✏

- 적합도 응답의 판정 근거 항목 스키마를 손보는 건

### 왜 이번에 안 했나

**프론트엔드 계약이 바뀐다.** 백엔드만 고치면 화면이 깨지므로 FE 작업과 같은 시점에
움직여야 한다. 이번 PR 은 백엔드 세 모듈에 갇혀 있어 짝이 되는 FE 변경을 넣을 수 없다.

### 작업 상세 내용 📝

- [ ] 바뀌는 필드와 그 이유를 FE 와 먼저 합의
- [ ] 백엔드 응답 변경 + FE 소비부를 같은 PR 또는 연속 PR 로 처리
- [ ] `feature-status.md` 의 API 표 갱신

---

## 3. `[BE] refactor: PlaceErrorCode 번호를 001 부터로 맞춘다`

### 어떤 기능인가요? ✏

- `PlaceErrorCode` 의 비즈니스 코드가 `PLACE_002` 부터 시작한다. 다른 도메인은 전부 `001` 부터다

### 왜 이번에 안 했나

**프론트엔드가 이미 `PLACE_002` 로 분기한다.** (`frontend/src/lib/api/mock/index.ts`,
`error.test.ts`, `mock.test.ts`) 번호를 당기면 일관성을 얻는 대신 클라이언트를 깨뜨린다.

지금은 코드에 그 이유를 주석으로 적어 두었다. 다음 사람이 "고쳐야 할 것"으로 보고
무심코 손대지 않게 하기 위해서다.

### 작업 상세 내용 📝

- [ ] FE 와 동시에 움직일 수 있는 시점인지 확인
- [ ] 백엔드 코드 재번호 + FE 참조 갱신을 한 번에
- [ ] 비어 있던 `PLACE_001` 자리를 채울지 결정 (그대로 비워 두는 것도 답이다)

---

## 4. `[BE] refactor: emergency 컨텍스트 컴포넌트 이름을 컨텍스트 기준으로 맞춘다`

### 어떤 기능인가요? ✏

- `NearbyFacilityWebUseCase` / `NearbyFacilityWebFacade` / `NearbyFacilityQueryProcessor` /
  `NearbyFacilityPresenter` / `NearbyFacilityWebController` 가 **엔드포인트**를 가리킨다
- place 컨텍스트는 `PlaceWebUseCase` 처럼 **컨텍스트**를 가리킨다. 이쪽이 어긋난 쪽이다

### 왜 이번에 안 했나

감사 목록에 없던 항목이다. 긴급 시설 상세 API 를 붙여 엔드포인트가 둘이 되면서 이름이
더 어색해졌지만, 컴포넌트 이름을 바꾸는 것은 판단이 필요한 일이라 감사 범위 밖에서
단독으로 결정하지 않았다.

### 작업 상세 내용 📝

- [ ] `EmergencyFacility*` 로 리네임 (UseCase / Facade / Processor / Presenter / Controller)
- [ ] 엔드포인트 전용 DTO(`NearbyFacilityResponse`, `NearbyFacilityItem`)는 그대로 둔다 —
      그쪽은 실제로 "주변 검색"의 응답이다
