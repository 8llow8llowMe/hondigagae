# Frontend Screen Inventory

> 화면별 담당 API, 상태, 착수 가능 여부. **백엔드 구현 상태와 동기화한다.**
> 근거: `backend/docs/service-inventory.md` (백엔드 구현 현황), 루트 `README.md` (AI 기능 선정 상태)
> 최종 확인: 2026-08-26 (백엔드 커밋 `6af13db` = origin/develop 기준)

## 착수 가능 여부 요약

| 영역          | 백엔드          | FE 착수                     |
| ------------- | --------------- | --------------------------- |
| 인증 / 회원   | 구현            | **가능**                    |
| 반려견 프로필 | 구현            | **가능**                    |
| 장소 탐색     | 구현            | **가능** (batch 적재 필요)  |
| 여행 일정     | 구현            | **가능**                    |
| AI 일정 생성  | 골격 (Stub LLM) | **가능** (결과 품질 미보장) |
| 그 외 전부    | 미착수          | **대기**                    |

## 1. 인증 / 회원 — 착수 가능

| 화면          | 경로                                | API                                                                  | 상태                      |
| ------------- | ----------------------------------- | -------------------------------------------------------------------- | ------------------------- |
| 로그인        | `/(auth)/login`                     | `POST /auth/login`, `GET /auth/{provider}/authorize`                 | 기획                      |
| 소셜 콜백     | `/(auth)/oauth/{provider}/callback` | `GET /auth/{provider}/login?code=&state=`                            | 기획                      |
| 회원가입      | `/(auth)/signup`                    | `POST /auth/email/send-code`, `/verify-code`, `POST /members/signup` | 기획                      |
| 내 정보       | `/mypage`                           | `GET                                                                 | PATCH /members/me`, `POST | DELETE /members/me/profile-image` | 기획 |
| 비밀번호 변경 | `/mypage/password`                  | `POST /members/me/password`                                          | 기획                      |
| 회원 탈퇴     | `/mypage/withdraw`                  | `POST /members/me/withdraw`                                          | 기획                      |

주의: 소셜 로그인은 **2-step API 흐름** (`auth-guide.md` §1). 서버 리다이렉트가 아니다.

## 2. 반려견 프로필 — 착수 가능

| 화면             | 경로            | API                     | 상태 |
| ---------------- | --------------- | ----------------------- | ---- |
| 반려견 목록      | `/pets`         | `GET /members/me/pets`  | 기획 |
| 반려견 등록      | `/pets/new`     | `POST /members/me/pets` | 기획 |
| 반려견 상세·수정 | `/pets/[petId]` | `GET                    | PUT  | DELETE /members/me/pets/{petId}` | 기획 |

주의: 등록 상한이 있다 (`PET_002 PET_LIMIT_EXCEEDED`, HTTP 400). 타인 반려견 조회는 **404** 다.

## 3. 장소 탐색 — 착수 가능

| 화면      | 경로                | API                                                               | 상태 |
| --------- | ------------------- | ----------------------------------------------------------------- | ---- |
| 장소 목록 | `/places`           | `GET /places` (지역·타입·반려견 동반 필터, `SliceResponse` 커서)  | 기획 |
| 장소 상세 | `/places/[placeId]` | `GET /places/{placeId}` (intro/petInfo/images 결합, **nullable**) | 기획 |
| 지도 뷰   | `/places` 내        | 위와 동일 + 카카오 지도 SDK                                       | 기획 |

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
- 지도 좌표는 백엔드가 `lat`/`lng` (Double) 로 정규화해 내려준다. 카카오는 `LatLng(위도, 경도)` 순서이므로 `lat` 이 먼저다 (`external-api-guide.md`).

## 4. 여행 일정 — 착수 가능

| 화면                        | 경로                         | API                                                    | 상태                    |
| --------------------------- | ---------------------------- | ------------------------------------------------------ | ----------------------- |
| 일정 목록                   | `/plans`                     | `GET /plans` (커서)                                    | 기획                    |
| 일정 생성                   | `/plans/new`                 | `POST /plans`                                          | 기획                    |
| 일정 상세 (타임라인 + 지도) | `/plans/[planId]`            | `GET /plans/{planId}`                                  | 기획                    |
| 일정 수정                   | `/plans/[planId]/edit`       | `PUT                                                   | DELETE /plans/{planId}` | 기획 |
| 일자 항목 편집              | `/plans/[planId]/days/[day]` | `PUT /plans/{planId}/days/{day}/items` (**일괄 교체**) | 기획                    |

주의:

- 일자 항목은 **부분 수정이 아니라 일괄 교체**다. 화면도 그 모델로 설계한다.
- 장소 항목은 백엔드가 tour-service Feign으로 존재를 검증한다 → 없는 `placeId` 는 실패한다.
- **일정의 소유권은 plan-service에 있다.** AI는 제안만 하고 확정은 여기서만 일어난다.

## 5. AI 일정 생성 — 착수 가능 (골격)

| 화면                  | 경로                     | API                                | 상태 |
| --------------------- | ------------------------ | ---------------------------------- | ---- |
| 조건 입력             | `/ai-plans/new`          | `POST /ai-plans` → 202 + jobId     | 기획 |
| 생성 대기             | `/ai-plans/jobs/[jobId]` | `GET /ai-plans/jobs/{jobId}` 폴링  | 기획 |
| 결과 확인 → 일정 저장 | 위 화면 내               | 결과 확인 후 `POST /plans` 로 확정 | 기획 |

주의:

- **실패가 HTTP 200 + `status=FAILED`** 다 (`api-integration-guide.md` §5).
- **SSE는 백엔드 미구현.** 폴링만 쓴다.
- 현재 LLM은 `StubLlmAdapter` 고정 샘플이다 → **결과가 매번 같은 것이 정상**이다.
- XAI `reasons` 가 포함된다 → 서버 `description` 을 그대로 노출한다.
- 저장·확정은 plan-service 몫이다. ai-service에 저장 API가 없다.

## 5-1. 주변 장소 검색 — 착수 가능

| 화면      | 경로   | API                  | 상태 |
| --------- | ------ | -------------------- | ---- |
| 주변 장소 | (미정) | `GET /places/nearby` | 기획 |

파라미터: `lat` `lng`(필수), `radius`(기본 5000, 최대 50000), `contentType` `petAllowanceType` `indoor` `allowedPetSize` `sourceCategory`, `size`(1~50, 기본 15)

응답 `NearbyPlaceResponse`: `{ places: [{ place, distanceMeters }], totalCount, radius }`

주의: 목록(`/places`)과 달리 **커서가 아니라 `totalCount`** 를 준다 → 건수 표기가 가능하다.

## 5-2. 긴급 시설 (동물병원·약국) — 착수 가능

| 화면           | 경로   | API                           | 상태 |
| -------------- | ------ | ----------------------------- | ---- |
| 주변 긴급 시설 | (미정) | `GET /emergencies/facilities` | 기획 |

파라미터: `lat` `lng`(필수), `radius`(기본 10000, 최대 50000), `type`(`ANIMAL_HOSPITAL`/`ANIMAL_PHARMACY`, 비우면 둘 다), `open24Only`(기본 false), `size`(1~50, 기본 10)

**화면 설계에 직결되는 백엔드 지침** (스키마 설명에 명시돼 있다)

- `operatingHoursKnown: false` → **"영업시간 정보 없음"으로 안내한다.** `operatingHours: null` 은 "휴무"가 아니라 "확인 필요"다
- `open24Only=true` → **제주 동물병원 중 24시간은 3곳뿐**이라 결과가 매우 적다. 필터 UI에 이 사실을 알려야 한다
- 응답에 `totalCount` 와 `providerName`(출처)이 있다

> **BE 후속 요청**: `facilityId` 가 `long` 이고 예시값 `4611686018427387904` 는
> `Number.MAX_SAFE_INTEGER` 를 초과한다. `placeId` 처럼 **String 직렬화가 필요**하다.
> 그 전까지 이 값을 키·경로에 쓰지 않는다.

## 6. 대기 — 백엔드 미착수

**아래 화면은 만들지 않는다.** 호출부·mock도 만들지 않는다.

| 화면                          | 필요한 백엔드                        | 비고                  |
| ----------------------------- | ------------------------------------ | --------------------- |
| 산책 코스                     | tour-service `walkcourse` (두루누비) | 미착수                |
| 여행 적합도 분석 (점수 + XAI) | tour-service `insight` (날씨·혼잡도) | 미착수                |
| 긴급 동물병원                 | tour-service `emergency`             | 미착수                |
| 여행 후기 작성·공유           | plan-service `review`                | 미착수                |
| 일정 공유                     | plan-service                         | 미착수                |
| AI 여행 상담사 / 비서         | ai-service `assistant`               | 미착수                |
| 반려견 성향 분석 리포트       | ai-service `analysis`                | 미착수                |
| 여행 스타일 학습 / 개인화     | —                                    | AI 기능 후보, 선정 전 |

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
