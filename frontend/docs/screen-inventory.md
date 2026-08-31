# Frontend Screen Inventory

> 화면별 담당 API, 상태, 착수 가능 여부. **백엔드 구현 상태와 동기화한다.**
> 근거: `backend/docs/service-inventory.md` (백엔드 구현 현황), 루트 `README.md` (AI 기능 선정 상태)
> 최종 확인: 2026-08-27 (백엔드 = origin/develop `a360b79` 기준, 컨트롤러 전수 실측)
> 갱신 방법: `find backend/service -name "*WebController.java"` 로 엔드포인트를 전수 확인한다.
> **`backend/docs/service-inventory.md` 를 그대로 믿지 않는다** — 그 문서도 낡을 수 있다.

## 착수 가능 여부 요약

| 영역          | 백엔드            | FE 착수                       |
| ------------- | ----------------- | ----------------------------- |
| 홈 · 전역 nav | 구현              | **구현 완료** (#51)           |
| 인증 / 회원   | 구현              | **가능**                      |
| 반려견 프로필 | 구현              | **가능**                      |
| 장소 탐색     | 구현              | **가능** (batch 적재 필요)    |
| 여행 일정     | 구현              | **목록·생성 완료** (#75)      |
| AI 일정 생성  | 구현 (LLM 플래그) | **가능** (기본값은 Stub — §5) |
| 장소 인사이트 | 구현              | **가능** (신규 — §3-1)        |
| 긴급 시설     | 구현              | **가능** (§5-2)               |
| 그 외 전부    | 미착수            | **대기** (§6)                 |

## 1. 인증 / 회원 — 착수 가능

| 화면          | 경로                                | API                                                                          | 상태                                                |
| ------------- | ----------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| 로그인        | `/(auth)/login`                     | `POST /auth/login`                                                           | **구현 완료** — 소셜 버튼·비밀번호 찾기 진입점 포함 |
| 소셜 콜백     | `/(auth)/oauth/[provider]/callback` | `GET /auth/{provider}/authorize` → `GET /auth/{provider}/login?code=&state=` | **구현 완료** — kakao·naver, 중복 실행 가드         |
| 회원가입      | `/(auth)/signup`                    | `POST /auth/email/send-code`, `/verify-code`, `POST /members/signup`         | **구현**                                            |
| 내 정보       | `/mypage`                           | `GET`·`PATCH /members/me`, `POST`·`DELETE /members/me/profile-image`         | **구현 완료**                                       |
| 비밀번호 관리 | `/mypage/password`                  | `POST`·`DELETE /members/me/password`, `POST /members/me/password/setup`      | **구현 완료** — 계정 상태 3종 분기                  |
| 회원 탈퇴     | `/mypage/withdraw`                  | `POST /members/me/withdraw`                                                  | **구현 완료**                                       |
| 비밀번호 찾기 | `/(auth)/password/reset`            | `POST /auth/password/reset/send-code`, `/auth/password/reset`                | **구현 완료** — 한 라우트 2단계 + 완료 안내         |

주의: 소셜 로그인은 **2-step API 흐름** (`auth-guide.md` §1). 서버 리다이렉트가 아니다.

주의: `state` 는 서버가 조회와 동시에 지운다 (Redis `GETDEL`). **콜백에서 교환을 두 번
부르면 두 번째는 무조건 `AUTH_010`** 이므로 `use-oauth-exchange.ts` 의 ref 가드를 지운 채
리팩터링하면 개발 모드(StrictMode)에서 성공 직후 오류 화면이 덮인다.

## 2. 반려견 프로필 — 착수 가능

| 화면             | 경로            | API                     | 상태 |
| ---------------- | --------------- | ----------------------- | ---- |
| 반려견 목록      | `/pets`         | `GET /members/me/pets`  | 구현 |
| 반려견 등록      | `/pets/new`     | `POST /members/me/pets` | 구현 |
| 반려견 수정·삭제 | `/pets/[petId]` | `GET                    | PUT  | DELETE /members/me/pets/{petId}` | 구현 (읽기 전용 상세는 두지 않는다 — 공통명세 S5-1) |

주의: 등록 상한이 있다 (`PET_002 PET_LIMIT_EXCEEDED`, HTTP 400). 타인 반려견 조회는 **404** 다.

## 3. 장소 탐색 — 착수 가능

| 화면      | 경로                | API                                                                                                     | 상태 |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------------- | ---- |
| 장소 목록 | `/places`           | `GET /places` (지역·타입·반려견 동반 필터, `SliceResponse` 커서)                                        | 구현 |
| 장소 상세 | `/places/[placeId]` | `GET /places/{placeId}` + `GET /places/{placeId}/suitability` (intro/petInfo/images 결합, **nullable**) | 구현 |
| 지도 뷰   | `/places` 내        | 위와 동일 + 카카오 지도 SDK                                                                             | 기획 |

주의:

- **공개 API다.** tour-service는 security 의존이 없다 → 보호 경로 아님.
- 무한 스크롤(`hasNext`) 기본.
- 데이터가 비어 있으면 batch 적재가 안 된 것이다 (`local-run-guide.md` §4).
- **목록 필터 파라미터 (백엔드 `PlaceWebController` 실측)**: `areaCode`(제주=39), `sigunguCode`,
  `contentType`(enum name — `TOURIST_SPOT` `CULTURE` `FESTIVAL` `COURSE` `LEPORTS` `LODGING` `SHOPPING` `RESTAURANT`),
  `petAllowanceType`(`ALLOWED` `PARTIALLY_ALLOWED` `NOT_ALLOWED` `UNKNOWN`),
  `indoor`(true 면 실내만), `allowedPetSize`(`ALL`/`SMALL_ONLY`/`SMALL_MEDIUM`/`UNKNOWN`),
  `sourceCategory`(원본 분류 자유 문자열, 예: 카페), `lastPlaceId`(커서), `size`(1~50, 기본 20).
  **모두 단일값이며 배열이 아니다.**
- **`indoor` 주의**: 원천에 정보가 없는 장소(`indoor: null`)는 true/false **어느 쪽 필터에도 잡히지 않는다.**
- `PlaceItem` 에 `indoor` / `sourceCategory` / `sourceName`(출처 표시명) 필드가 있다.
- `contentType` / `petAllowanceType` 은 **응답에서 metadata 객체**(`{code, name, description}`)로 온다 → 서버 문구를 그대로 렌더한다.
- `placeId` 는 응답에서 **문자열**이다 (백엔드 내부는 long).
- **상세 컨트롤러는 `@PathVariable long` 이다** → 숫자가 아닌 `placeId` 는 404 가 아니라 **400(`PLACE_113`)** 이다.
- **상세 응답(`PlaceDetailResponse`)에는 `sigunguCode` / `indoor` / `sourceCategory` / `sourceName` 이 없다.**
  목록 항목(`PlaceItem`)에만 있다 → [#16](https://github.com/8llow8llowMe/hondigagae/issues/16) 반영 전까지 상세 화면에서 실내 여부·출처명을 표시하지 않는다.
- 상세의 `contentId` 는 원천이 TourAPI 가 아니면 **문자열 `"null"`** 로 온다 → [#17](https://github.com/8llow8llowMe/hondigagae/issues/17).
- 상세의 `homepage` / `overview` 는 **HTML 태그가 섞인 원문**이다. `dangerouslySetInnerHTML` 을 쓰지 않는다.
- 지도 좌표는 백엔드가 `lat`/`lng` (Double) 로 정규화해 내려준다. 카카오는 `LatLng(위도, 경도)` 순서이므로 `lat` 이 먼저다 (`external-api-guide.md`).

## 3-1. 장소 인사이트 (적합도 · 산책 위험도) — 착수 가능 (신규)

| 화면        | 경로                            | API                                 | 상태                                |
| ----------- | ------------------------------- | ----------------------------------- | ----------------------------------- |
| 여행 적합도 | `/` 홈 · `/places/[placeId]` 내 | `GET /places/{placeId}/suitability` | **구현** — 홈(#51) · 장소 상세(#64) |
| 산책 위험도 | `/` 홈 · `/places/[placeId]` 내 | `GET /places/{placeId}/walk-safety` | **홈 구현** (#51) / 장소 상세 기획  |

근거: tour-service `insight` 컨텍스트 / `PlaceInsightWebController` **실측**.
이 서비스의 차별점이 담긴 응답이라 계약을 자세히 적어 둔다.

**`GET /places/{placeId}/suitability` — `PlaceSuitabilityResponse`**

| 필드                | 타입                       | 화면 지침                                                         |
| ------------------- | -------------------------- | ----------------------------------------------------------------- |
| `score`             | `Integer`                  | 0~100 추정. **단위 없는 숫자를 그대로 두지 않는다** — 등급과 함께 |
| `suitabilityLevel`  | `ScoreMetricMetadata`      | 등급 metadata. `name` 을 그대로 렌더한다                          |
| `reasons[]`         | `SuitabilityReasonItem[]`  | **XAI.** `scoreDelta` 가 음수면 감점, `0` 이면 정보성             |
| `weather`           | `DailyWeatherItem \| null` | **예보 범위 밖이면 null** → 섹션을 숨긴다                         |
| `congestion`        | `CongestionItem`           | `level` 이 `UNKNOWN` 일 수 있다 (연결 데이터 없음)                |
| `alternativePlaces` | `AlternativePlaceItem[]`   | **비 예보일 때만 채워진다.** 안 오면 빈 배열 → 숨긴다             |

- `reasons` 는 **점수 영향이 큰 순서**로 온다. 재정렬하지 않는다.
- `description` 이 데이터 근거를 담은 완성 문장이다 ("최고기온 31도 로, 더위에 약한 아이에게는 부담이 큽니다."). **FE 가 문장을 조립하지 않는다.**
- `scoreDelta` 부호로 감점/정보성을 시각 구분한다. 숫자를 그대로 노출할지는 디자인 판단.

**`GET /places/{placeId}/walk-safety` — `WalkSafetyResponse`**

| 필드                       | 타입                     | 화면 지침                                      |
| -------------------------- | ------------------------ | ---------------------------------------------- |
| `walkSafetyLevel`          | `ScoreMetricMetadata`    | 등급 metadata                                  |
| `reasons[]`                | `WalkSafetyReasonItem[]` | `scoreDelta` 가 **없다** (적합도와 다르다)     |
| `estimatedPavementCelsius` | `Double`                 | **단위 ℃ 를 표기한다** (노면 온도)             |
| `heatIndexCelsius`         | `Double`                 | **단위 ℃ 를 표기한다** (체감 열지수)           |
| `saferWindowStart/End`     | `LocalTime \| null`      | **없으면 null** → "더 안전한 시간대" 를 숨긴다 |

- 적합도는 **일자 기준**(`targetDate`), 산책 위험도는 **시각 기준**(`targetDateTime`)이다. 같은 화면에 두 값을 나란히 두면 기준이 다른 것을 명시해야 한다.
- `saferWindowStart/End` 는 **같은 날 안에서만** 제안된다.

## 4. 여행 일정 — 착수 가능

| 화면                        | 경로                                         | API                                                         | 상태                                                                 |
| --------------------------- | -------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| 일정 목록                   | `/plans`                                     | `GET /plans` (커서)                                         | **구현** (#75)                                                       |
| 일정 생성                   | `/plans/new`                                 | `POST /plans`                                               | **구현** (#75)                                                       |
| 일정 상세 (타임라인 + 판정) | `/plans/[planId]`                            | `GET /plans/{planId}` + `GET /plans/{planId}/weather`       | **구현** (#80)                                                       |
| 일정 수정·삭제              | `/plans/[planId]` 내                         | `PUT` · `DELETE /plans/{planId}`                            | **구현** (#80) — 이름·예산·상태만. **기간 수정은 열지 않는다**(아래) |
| 일자 항목 편집              | `/plans/[planId]` 내 모드                    | `PUT /plans/{planId}/days/{day}/items` (**일괄 교체**)      | **구현** (#81)                                                       |
| 일정에 장소 담기            | `/plans/[planId]/days/[day]/add` + 실내 대안 | `PUT /plans/{planId}/days/{day}/items` (**같은 일괄 교체**) | **구현** (#82) — 새 API 없음                                         |
| 일정 날씨 브리핑            | `/plans/[planId]` 내                         | `GET /plans/{planId}/weather`                               | **구현** (#80) — 일자 판정으로 통합                                  |

주의:

- **목록에 좁히기 파라미터가 없다.** `GET /plans` 는 `lastPlanId` · `size` 뿐이고 `status`·`petId` 도, `totalCount` 도 없다. 상태·반려견 좁히기는 화면에서 하고, `hasNext` 인 동안에는 개수를 말하지 않는다 (`docs/features/plan/공통명세.md` S3).
- **`COMPLETED` 로 가는 경로가 없다.** enum 에는 있으나 서버에 자동 전이가 없어, 여행이 끝나도 상태가 바뀌지 않는다. 다가오는/지난은 **날짜**로 나눈다 (S4).
- **목록 정렬은 `id DESC`(만든 역순)** 이고 날짜순이 아니다 (`findByMemberIdAndDeletedFalseAndIdLessThanOrderByIdDesc`).
- 일자 항목은 **부분 수정이 아니라 일괄 교체**다. 화면도 그 모델로 설계한다.
- 장소 항목은 백엔드가 tour-service Feign으로 존재를 검증한다 → 없는 `placeId` 는 실패한다.
- **일정의 소유권은 plan-service에 있다.** AI는 제안만 하고 확정은 여기서만 일어난다.
- **기간을 줄여도 백엔드가 항목을 정리하지 않는다.** `PlanCommandProcessor.updatePlan` 은 `startDate`/`endDate` 만 바꾸고 `day > totalDays` 가 된 항목을 그대로 둔다 → 상세 응답에 기간 밖 항목이 섞여 온다. **그래서 화면은 기간 수정을 열지 않는다** (BE 후속 요청). 다른 경로로 생긴 기간 밖 항목은 상세 화면이 별도 섹션으로 드러낸다.
- **날씨 브리핑(`PlanWeatherResponse`)의 `days` 는 일정 일수만큼 항상 채워진다.** (명세의 `dailyBriefings` 는 실제 필드명이 아니다 — `features/_index.md` 드리프트 표) 빈 배열을 방어할 필요가 없다. 대신 각 일자의 예보 필드가 null 일 수 있다 (§3-1 `DailyWeatherItem` 과 같은 타입).

## 5. AI 일정 생성 — **구현 완료**

| 화면           | 경로                     | API                                      | 상태                           |
| -------------- | ------------------------ | ---------------------------------------- | ------------------------------ |
| 조건 입력      | `/ai-plans/new`          | `POST /ai-plans` → 202 + jobId           | **구현 완료** (이슈 #84)       |
| 생성 대기·결과 | `/ai-plans/jobs/[jobId]` | `GET /ai-plans/jobs/{jobId}` **폴링 2s** | **구현 완료** (이슈 #84)       |
| 결과 → 담기    | 위 화면 내               | `POST /plans` 로 확정                    | **구현 완료** — 매핑은 명세 S5 |

주의:

- **실패가 HTTP 200 + `status=FAILED`** 다 (`api-integration-guide.md` §5).
- **SSE 는 이번 범위가 아니다.** 백엔드에 `GET /ai-plans/jobs/{jobId}/stream` 이 있지만(`b7daa3a`) **BFF 가 응답을 통째로 버퍼링해 스트림을 통과시키지 못한다** — 지금 붙이면 폴링만도 못하다. 이슈 [#91](https://github.com/8llow8llowMe/hondigagae/issues/91) 로 뗐다 (명세 S3).
- **LLM 어댑터가 두 개고 플래그로 갈린다** (`ai-llm.enabled`, 기본값 `false`).
  - `false`(기본) → `StubLlmAdapter` 고정 샘플. **결과가 매번 같은 것이 정상**이다.
  - `true` → `OllamaLlmAdapter` (로컬 LLM). **`AnthropicClaudeLlmAdapter` 는 없다** — 이 줄이 오래 잘못 적혀 있었다 (실측: `adapter/out/llm/` 에 `OllamaLlmAdapter`·`StubLlmAdapter` 둘뿐).
  - **로컬에서 Stub 결과를 보고 "AI가 고장났다" 고 판단하지 않는다.** `AI_LLM_ENABLED` 를 먼저 확인한다.
- XAI `reasons` 가 포함된다 → 서버 `description` 을 그대로 노출한다.
- 저장·확정은 plan-service 몫이다. ai-service에 저장 API가 없다.
- **항목 행에 직선거리가 붙는다** (#100). 계산·30km 임계값·문구를 일정 상세와 **같은 모듈**
  (`lib/geo/distance.ts`)에서 가져온다 — 두 화면이 같은 초안을 두 말로 말하지 않게 하려는 것이
  요점이다. 기준은 직전 항목 하나뿐이고(초안 `itemType` 이 LLM raw string 이라 숙소를 못 믿는다)
  좌표를 모르는 항목은 거리 줄이 없다. **실내 여부는 여전히 없다** ([#16](https://github.com/8llow8llowMe/hondigagae/issues/16) 대기).
- **`AiPlanCreateRequest` 가 `petIds`·`pinnedPlaceIds`·`planId`+`regenerateDay` 를 받는다**
  (PR #78). 전부 선택이고 **#84 는 단일 `petId` 만 보낸다** — 다중 반려견 UI 와 필수 포함
  장소 플로우는 아트보드 정본이 없어 별도 FE 이슈다 (명세 S1).

## 5-1. 주변 장소 검색 — 착수 가능

| 화면      | 경로   | API                  | 상태 |
| --------- | ------ | -------------------- | ---- |
| 주변 장소 | (미정) | `GET /places/nearby` | 기획 |

파라미터: `lat` `lng`(필수), `radius`(기본 5000, 최대 50000), `contentType` `petAllowanceType` `indoor` `allowedPetSize` `sourceCategory`, `size`(1~50, 기본 15)

응답 `NearbyPlaceResponse`: `{ places: [{ place, distanceMeters }], totalCount, radius }`

주의: 목록(`/places`)과 달리 **커서가 아니라 `totalCount`** 를 준다 → 건수 표기가 가능하다.

## 5-2. 긴급 시설 (동물병원·약국) — 착수 가능

| 화면           | 경로         | API                           | 상태                       |
| -------------- | ------------ | ----------------------------- | -------------------------- |
| 주변 긴급 시설 | `/emergency` | `GET /emergencies/facilities` | **구현** (#13). 지도는 #14 |

파라미터: `lat` `lng`(필수), `radius`(기본 10000, 최대 50000), `type`(`ANIMAL_HOSPITAL`/`ANIMAL_PHARMACY`, 비우면 둘 다), `open24Only`(기본 false), `size`(1~50, 기본 10)

**화면 설계에 직결되는 백엔드 지침** (스키마 설명에 명시돼 있다)

- `operatingHoursKnown: false` → **"영업시간 정보 없음"으로 안내한다.** `operatingHours: null` 은 "휴무"가 아니라 "확인 필요"다
- `open24Only=true` → **제주 동물병원 중 24시간은 3곳뿐**이라 결과가 매우 적다. 필터 UI에 이 사실을 알려야 한다
- 응답에 `totalCount` 와 `providerName`(출처)이 있다

> **BE 후속 요청** ([#8](https://github.com/8llow8llowMe/hondigagae/issues/8)): `facilityId` 가 `long` 이고 예시값 `4611686018427387904` 는
> `Number.MAX_SAFE_INTEGER` 를 초과한다. `placeId` 처럼 **String 직렬화가 필요**하다.
> 그 전까지 이 값을 키·경로에 쓰지 않는다.

## 6. 대기 — 백엔드 미착수

**아래 화면은 만들지 않는다.** 호출부·mock도 만들지 않는다.

| 화면                      | 필요한 백엔드                        | 비고                  |
| ------------------------- | ------------------------------------ | --------------------- |
| 산책 코스                 | tour-service `walkcourse` (두루누비) | 미착수                |
| 여행 후기 작성·공유       | plan-service `review`                | 미착수                |
| 일정 공유                 | plan-service                         | 미착수                |
| AI 여행 상담사 / 비서     | ai-service `assistant`               | 미착수                |
| 반려견 성향 분석 리포트   | ai-service `analysis`                | 미착수                |
| 여행 스타일 학습 / 개인화 | —                                    | AI 기능 후보, 선정 전 |

**이 절에서 빠진 것 (백엔드가 구현했다)**

| 화면                          | 어디로 갔나                       |
| ----------------------------- | --------------------------------- |
| 여행 적합도 분석 (점수 + XAI) | **§3-1 로 이동** — 구현됐다       |
| 긴급 동물병원                 | **§5-2 와 중복이었다** — 구현됐다 |

확인 방법: `tour-service/domainlayer/` 에 `insight` · `emergency` 컨텍스트가 있고 각각 컨트롤러가 있다.
`walkcourse` · `review` · `assistant` · `analysis` 는 **패키지 자체가 없다** — 그것이 미착수의 근거다.

## 7. AI 기능 선정 게이트

루트 `README.md` 의 AI 기능 10종은 **후보 상태**다. 선정 전에는 §6 화면을 만들지 않는다.

선정이 확정되면:

1. 루트 `README.md` 표의 상태 열 갱신
2. 이 문서의 §6 항목을 §1~5 형식으로 이동
3. `docs/features/_index.md` 에 명세 항목 추가
4. 백엔드 API 구현 여부를 `backend/docs/service-inventory.md` 로 재확인

## 8. 갱신 규칙

- 화면을 구현하면 상태를 `기획` → `구현` 으로 바꾼다.
- 백엔드 동기화 후 `backend/docs/service-inventory.md` 와 이 문서를 대조한다.
- `TODO(BE)` 로 임시 처리한 항목은 이 문서에도 남긴다.
