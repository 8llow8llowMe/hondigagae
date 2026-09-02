# Frontend Screen Inventory

> 화면별 담당 API, 상태, 착수 가능 여부. **백엔드 구현 상태와 동기화한다.**
> 근거: `backend/docs/service-inventory.md` (백엔드 구현 현황), 루트 `README.md` (AI 기능 선정 상태)
> 최종 확인: 2026-09-01 (백엔드 = origin/develop `9cd6711` 기준, 컨트롤러 전수 실측)
> 갱신 방법: `find backend/service -name "*WebController.java"` 로 엔드포인트를 전수 확인한다.
> **`backend/docs/service-inventory.md` 를 그대로 믿지 않는다** — 그 문서도 낡을 수 있다.

## 착수 가능 여부 요약

| 영역          | 백엔드            | FE 착수                        |
| ------------- | ----------------- | ------------------------------ |
| 홈 · 전역 nav | 구현              | **구현 완료** (#51)            |
| 인증 / 회원   | 구현              | **가능**                       |
| 반려견 프로필 | 구현              | **가능**                       |
| 장소 탐색     | 구현              | **구현 완료** (목록·상세·지도) |
| 여행 일정     | 구현              | **목록·생성 완료** (#75)       |
| AI 일정 생성  | 구현 (LLM 플래그) | **가능** (기본값은 Stub — §5)  |
| 장소 인사이트 | 구현              | **가능** (신규 — §3-1)         |
| 긴급 시설     | 구현              | **가능** (§5-2)                |
| 그 외 전부    | 미착수            | **대기** (§6)                  |

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

**FE 미연동 (백엔드는 구현됨)** — [#126](https://github.com/8llow8llowMe/hondigagae/issues/126)

| 기능        | API                                                    | 비고                                                                                 |
| ----------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 반려견 사진 | `POST`·`DELETE /members/me/pets/{petId}/profile-image` | multipart. 회원 프로필 사진(#79)과 같은 통과 경로                                    |
| 체중        | `PetSaveRequest.weightKg`                              | `0.1~99.9`, 소수점 1자리. **`GET /places` 의 `petWeightKg` 필터가 이것에 딸려 있다** |
| 대표견      | `PUT /members/me/pets/{petId}/representative`          | **AI 일정이 대표 반려견을 기본으로 쓴다** — 지정 UI 가 없다                          |

주의: 등록 상한이 있다 (`PET_002 PET_LIMIT_EXCEEDED`, HTTP 400). 타인 반려견 조회는 **404** 다.

## 3. 장소 탐색 — 착수 가능

| 화면              | 경로                   | API                                                                                                     | 상태                                                                                      |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 장소 목록         | `/places`              | `GET /places` (지역·타입·반려견 동반 필터, `SliceResponse` 커서)                                        | 구현                                                                                      |
| 장소 상세         | `/places/[placeId]`    | `GET /places/{placeId}` + `GET /places/{placeId}/suitability` (intro/petInfo/images 결합, **nullable**) | 구현                                                                                      |
| 장소 상세 하단 바 | `/places/[placeId]` 내 | `GET`·`POST`·`DELETE /favorites/places` + `POST /plans` + `PUT /plans/{planId}/days/{day}/items`        | 구현 — 저장 + 일정에 담기 ([#118](https://github.com/8llow8llowMe/hondigagae/issues/118)) |
| 지도 뷰           | `/places?view=map`     | 목록 캐시 재사용 + `GET /places/nearby`(지도 이동 시) + 카카오 지도 SDK                                 | **구현** ([#14](https://github.com/8llow8llowMe/hondigagae/issues/14))                    |

주의:

- **즐겨찾기 여부는 단건 API 로 확인할 수 있다** — `GET /favorites/places/{placeId}` → `{placeId, favorited}`.
  화면은 아직 목록(`GET /favorites/places`) 전량을 받아 판정한다. 100곳 상한이라 당장 문제는
  아니지만 단건 쪽이 의도에 맞다 ([#127](https://github.com/8llow8llowMe/hondigagae/issues/127) 에서 함께 정리).
- **공개 API다.** tour-service는 security 의존이 없다 → 보호 경로 아님.
  **단, 하단 바의 즐겨찾기·담기는 보호 리소스다** — 미로그인에는 조회조차 보내지 않는다
  (401 이 전역 재발급을 헛돌린다).
- 무한 스크롤(`hasNext`) 기본.
- 데이터가 비어 있으면 batch 적재가 안 된 것이다 (`local-run-guide.md` §4).
- **목록 필터 파라미터 (백엔드 `PlaceWebController` 실측)**: `areaCode`(제주=39), `sigunguCode`,
  `contentType`(enum name — `TOURIST_SPOT` `CULTURE` `FESTIVAL` `COURSE` `LEPORTS` `LODGING` `SHOPPING` `RESTAURANT`),
  `petAllowanceType`(`ALLOWED` `PARTIALLY_ALLOWED` `NOT_ALLOWED` `UNKNOWN`),
  `indoor`(true 면 실내만), `allowedPetSize`(`ALL`/`SMALL_ONLY`/`SMALL_MEDIUM`/`UNKNOWN`),
  `petWeightKg`(내 반려견 체중, **`Integer`**),
  `sourceCategory`(원본 분류 자유 문자열, 예: 카페), `lastPlaceId`(커서), `size`(1~50, 기본 20).
  **모두 단일값이며 배열이 아니다.**
- **`petWeightKg` 는 `petSizeType` 과 한 컨트롤이 함께 켠다** (#126). 아트보드의
  "몽실이가 들어갈 수 있는 곳만" 체크 하나가 두 파라미터를 같이 보낸다 — 같은 축이라
  따로 켜면 판정이 반쪽이 된다. 체중을 모르는 아이는 크기만 보낸다.
- **체중은 올려서 보낸다.** 파라미터가 `Integer` 인데 조건이
  `maxPetWeightKg >= petWeightKg` 라, 3.5kg 를 내림해 `3` 으로 보내면 **상한 3kg 인 곳이
  통과한다.** 계산은 `lib/pet/weight.ts` 의 `toPlaceFilterWeight` 한 곳이다.
- **`indoor` 주의**: 원천에 정보가 없는 장소(`indoor: null`)는 true/false **어느 쪽 필터에도 잡히지 않는다.**
- `PlaceItem` 에 `indoor` / `sourceCategory` / `sourceName`(출처 표시명) 필드가 있다.
- `contentType` / `petAllowanceType` 은 **응답에서 metadata 객체**(`{code, name, description}`)로 온다 → 서버 문구를 그대로 렌더한다.
- `placeId` 는 응답에서 **문자열**이다 (백엔드 내부는 long).
- **상세 컨트롤러는 `@PathVariable long` 이다** → 숫자가 아닌 `placeId` 는 404 가 아니라 **400(`PLACE_113`)** 이다.
- **상세 응답(`PlaceDetailResponse`)에 `indoor` / `sourceCategory` / `sourceName` 이 들어왔다**
  ([#16](https://github.com/8llow8llowMe/hondigagae/issues/16) 반영) **그리고 화면에 붙였다**
  ([#112](https://github.com/8llow8llowMe/hondigagae/issues/112)). 목록(`PlaceItem`)과 **같은 매핑**이고
  `sourceName` 은 표시명(`문화정보원`)이다. `indoor` 의 `null` 은 "원천에 정보 없음" 이라
  `false`(야외)와 다르게 다룬다 — 메타 줄에서 낱말을 빼고, 실내 필터를 가진 화면(목록 행·장소 상세)만
  "실내 여부 미확인" 배지로 드러낸다. 조립은 `lib/place/meta.ts` 한 곳이다.
- **`sigunguCode` 는 여전히 상세 응답에 없다.** 목록 항목에만 있다 — #16 범위가 아니었다.
- **`delisted` 를 404 로 대신 읽지 않는다** ([#146](https://github.com/8llow8llowMe/hondigagae/issues/146)).
  원천에서 사라진 장소의 상세는 **200 + `delisted: true`** 로 온다 — 기존 일정(`plan_item`)이
  참조하는 장소라 백엔드가 일부러 계속 응답한다. `GET /places/{placeId}` 가 **404** 를 내는 것은
  _병합된_(`mergedIntoId`) 장소뿐이다. 판정은 `lib/place/availability.ts` 하나가 갖고,
  장소 상세와 AI 초안 미리보기가 함께 쓴다.
- 상세의 `contentId` 는 원천이 TourAPI 가 아니면 **`null`** 이다
  ([#17](https://github.com/8llow8llowMe/hondigagae/issues/17) 반영 — 그전에는 문자열 `"null"` 이었다).
  타입은 `string | null` 이 맞다.
- 상세의 `homepage` / `overview` 는 **HTML 태그가 섞인 원문**이다. `dangerouslySetInnerHTML` 을 쓰지 않는다.
- 지도 좌표는 백엔드가 `lat`/`lng` (Double) 로 정규화해 내려준다. 카카오는 `LatLng(위도, 경도)` 순서이므로 `lat` 이 먼저다 (`external-api-guide.md`).
- **지도 뷰(`?view=map`)의 데이터 출처는 둘이고 갈리는 조건이 명확하다** (#14).
  들어온 직후에는 **목록 캐시를 재사용**하고(`architecture-guide.md` §9 "지도 뷰: 별도 조회 금지"),
  사용자가 지도를 의미 있게 옮긴 뒤에만 `GET /places/nearby` 로 갈아탄다. 첫 `idle` 을
  이동으로 세면 들어오자마자 프리페치를 버리고 반경 밖을 조회해 **첫 화면이 빈다** — 실제로 그랬다.
- **`view` 는 백엔드 파라미터가 아니다.** 화면 표현 상태이고 `lib/url/view-mode.ts` 가 소유한다.
  장소 찾기와 긴급 시설이 같은 키를 쓴다.

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
| 항목 방문 체크              | `/plans/[planId]` 내 항목 행                 | `PUT /plans/{planId}/items/{planItemId}/visited`            | **구현** (#124) — 해제도 같은 API                                    |

**FE 미연동 (백엔드는 구현됨 — PR #105)**

| 화면             | API                             | 이슈                                                          |
| ---------------- | ------------------------------- | ------------------------------------------------------------- |
| 일정 응급 브리핑 | `GET /plans/{planId}/emergency` | [#125](https://github.com/8llow8llowMe/hondigagae/issues/125) |

주의: **#124 는 아트보드 정본 없이 구현됐다.** 브랜드 자산 아트보드가 들어온 뒤에도
`다녀옴` 아트보드는 없다 — 토글 자리·체크된 행의 표현·경고 위치는 아트보드가 그려지면
재검토한다 (`docs/features/brand/브랜드에셋-세부명세.md` B12).

주의: **일차 항목을 교체하면 그 날의 방문 체크는 초기화된다** (백엔드 스키마 설명). 일괄 교체
모델과 부딪히는 지점이라 화면 문구가 이 사실을 말해야 한다 — #124 는 그 일자에 체크된 항목이
있을 때만 경고 한 줄을 낸다 (`docs/features/plan/일정상세-세부명세.md` D9-2).

| 저장한 장소 목록 | 경로         | API                                                                   | 상태                                                                          |
| ---------------- | ------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 저장한 장소      | `/favorites` | `GET /favorites/places` · `POST`·`DELETE /favorites/places/{placeId}` | **구현 완료** ([#127](https://github.com/8llow8llowMe/hondigagae/issues/127)) |

주의:

- **`/mypage` 하위가 아니다.** 아트보드 03 이 1200 이상 전폭 2열 그리드를 요구하는데
  마이페이지 레이아웃은 `max-w-screen-md` 설정 목록이다. 진입점만 둘로 둔다 — 모바일은
  마이페이지의 행(`MyFavoritesRow`), 데스크톱은 아바타 팝오버(`ACCOUNT_MENU_ITEMS`).
  탭바는 4개 고정이라 늘리지 않는다.
- **커서가 없다.** 상한 100곳이라 전량이 온다 → 무한 스크롤이 아니다. **정렬 컨트롤도 없다** —
  응답이 최근 저장순 하나뿐이라 클라이언트 정렬은 틀린 순서가 된다.
- **저장일(`savedAt`)이 응답에 없다.** `FavoriteEntity` 는 `BaseEntity` 를 상속해 DB 에는
  있지만 `FavoritePlaceItem` 에 노출되지 않는다 → 아트보드 03 의 `2026-08-30 저장` 은
  **구현 불가**이고 BE 후속 요청으로 남겼다 (`features/favorite/저장한장소-세부명세.md` D9-1).
- **`GET /favorites/places/{placeId}`(단건 여부)가 생겼다** (`4a4f2cd`). 아직 쓰지 않는다 —
  상세용 키를 따로 만들면 목록에서 해제했을 때 캐시가 갈린다 (`features/favorite/queries.ts` 주석).
- **해제해도 행이 즉시 사라지지 않는다.** 무효화가 서버 목록에서 빼 오므로 화면이 항목을
  원래 자리에 붙잡아 둔다 (`lib/favorite/retain.ts`) — 그 자리에서 되살릴 수 있어야 한다.
- **아트보드 03 의 선택 → AI 일정 넘기기는 구현하지 않았다.** `pinnedPlaceIds` 를 FE 가
  아직 보내지 않아 선택 상태가 쓰일 곳이 없다 → [#128](https://github.com/8llow8llowMe/hondigagae/issues/128).

- **목록에 좁히기 파라미터가 없다.** `GET /plans` 는 `lastPlanId` · `size` 뿐이고 `status`·`petId` 도, `totalCount` 도 없다. 상태·반려견 좁히기는 화면에서 하고, `hasNext` 인 동안에는 개수를 말하지 않는다 (`docs/features/plan/공통명세.md` S3).
- **`COMPLETED` 로 가는 경로가 없다.** enum 에는 있으나 서버에 자동 전이가 없어, 여행이 끝나도 상태가 바뀌지 않는다. 다가오는/지난은 **날짜**로 나눈다 (S4).
- **목록 정렬은 `id DESC`(만든 역순)** 이고 날짜순이 아니다 (`findByMemberIdAndDeletedFalseAndIdLessThanOrderByIdDesc`).
- 일자 항목은 **부분 수정이 아니라 일괄 교체**다. 화면도 그 모델로 설계한다.
- **`PlanItemDetail.place` 가 주소·실내 여부·대표 이미지·좌표를 함께 준다** ([#86](https://github.com/8llow8llowMe/hondigagae/issues/86) 반영). 장소를 가리키지 않는 항목(`WALK`·`MOVE`)이거나
  원천에서 사라진 장소면 **객체 통째로 null** 이고, 그때도 항목은 남는다.
  **화면은 아직 항목당 `GET /places/{placeId}` 로 보강한다** — 걷어내는 것은 FE 후속 작업이다.
- 장소 항목은 백엔드가 tour-service Feign으로 존재를 검증한다 → 없는 `placeId` 는 실패한다.
- **일정의 소유권은 plan-service에 있다.** AI는 제안만 하고 확정은 여기서만 일어난다.
- **기간을 줄여도 백엔드가 항목을 정리하지 않는다.** `PlanCommandProcessor.updatePlan` 은 `startDate`/`endDate` 만 바꾸고 `day > totalDays` 가 된 항목을 그대로 둔다 → 상세 응답에 기간 밖 항목이 섞여 온다. **그래서 화면은 기간 수정을 열지 않는다** (BE 후속 요청). 다른 경로로 생긴 기간 밖 항목은 상세 화면이 별도 섹션으로 드러낸다.
- **날씨 브리핑(`PlanWeatherResponse`)의 `days` 는 일정 일수만큼 항상 채워진다.** (명세의 `dailyBriefings` 는 실제 필드명이 아니다 — `features/_index.md` 드리프트 표) 빈 배열을 방어할 필요가 없다. 대신 각 일자의 예보 필드가 null 일 수 있다 (§3-1 `DailyWeatherItem` 과 같은 타입).

## 5. AI 일정 생성 — **구현 완료**

| 화면           | 경로                     | API                                      | 상태                                 |
| -------------- | ------------------------ | ---------------------------------------- | ------------------------------------ |
| 조건 입력      | `/ai-plans/new`          | `POST /ai-plans` → 202 + jobId           | **구현 완료** (#84 · 옵션 확장 #128) |
| 생성 대기·결과 | `/ai-plans/jobs/[jobId]` | `GET /ai-plans/jobs/{jobId}` **폴링 2s** | **구현 완료** (이슈 #84)             |
| 결과 → 담기    | 위 화면 내               | `POST /plans` 로 확정                    | **구현 완료** — 매핑은 명세 S5       |

주의:

- **실패가 HTTP 200 + `status=FAILED`** 다 (`api-integration-guide.md` §5).
- **생성 옵션 두 개가 붙었다** ([#128](https://github.com/8llow8llowMe/hondigagae/issues/128), 아트보드 05): `preferFavorites`(저장한 곳 먼저 — 우선순위)와 `pinnedPlaceIds`(꼭 넣을 장소 — **배치 보장**, 최대 10). **두 문구를 섞지 않는다** — "먼저" 와 "꼭" 은 다른 약속이다.
  - **필드명은 `preferFavorites` 다.** #128 이슈 본문의 `includeFavorites` 는 틀린 이름이고, 그대로 보내면 옵션이 조용히 무시된다.
  - 꼭 넣을 장소는 **저장한 장소에서 고른다** (`/favorites` 와 같은 캐시). 아트보드의 `검색` 탭은 **`GET /places` 에 이름 검색 파라미터가 없어** 만들지 못했다 (명세 S8-9).
- **다중 반려견(`petIds`)은 아직 못 붙인다.** 계약과 아트보드 05 모두 준비돼 있지만 **`PlanCreateRequest` 가 `petId` 단일**이라, 두 마리로 만든 초안을 담으면 한 마리만 기록되어 이후 판정 기준이 조용히 바뀐다. 막고 있는 것은 디자인이 아니라 **담기 계약**이다 (명세 S8-8).
- **아트보드 06 절이 02 절의 진행 5단계를 정정했다.** "진행률 바를 그리지 않는다 … 점 3개(대기·짜는 중·완성)만 쓴다 — 02 아트보드의 5단계는 이 규칙으로 대체한다." 현재 화면은 서버 `description` 만 쓰고 있어 방향은 맞지만, **SSE 배선([#91](https://github.com/8llow8llowMe/hondigagae/issues/91))에서 이 절을 정본으로 봐야 한다.**
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
  좌표를 모르는 항목은 거리 줄이 없다. **실내 여부도 붙였다** ([#112](https://github.com/8llow8llowMe/hondigagae/issues/112)).
- **`AiPlanCreateRequest` 가 `petIds`·`pinnedPlaceIds`·`includeFavorites`·`planId`+`regenerateDay`
  를 받는다** (PR #78). 전부 선택이고 **#84 는 단일 `petId` 만 보낸다** — 다중 반려견 UI ·
  필수 포함 장소 · 즐겨찾기 우선 · 하루 재생성은 아트보드 정본이 없어 별도 이슈로 뗐다
  ([#128](https://github.com/8llow8llowMe/hondigagae/issues/128), 명세 S1).
- `petId` 와 `petIds` 가 함께 오면 **`petIds` 가 이기고 `petId` 는 무시된다.** 둘 다 없으면
  **대표 반려견**을 쓴다 — 그런데 대표견 지정 UI 가 없다 (#126).

## 5-1. 주변 장소 검색 — 착수 가능

| 화면      | 경로               | API                  | 상태                                          |
| --------- | ------------------ | -------------------- | --------------------------------------------- |
| 주변 장소 | `/places?view=map` | `GET /places/nearby` | **구현** (#14) — 독립 화면이 아니라 지도 뷰다 |

파라미터: `lat` `lng`(필수), `radius`(기본 5000, 최대 50000), `contentType` `petAllowanceType` `indoor` `allowedPetSize` `sourceCategory`, `size`(1~50, 기본 15)

응답 `NearbyPlaceResponse`: `{ places: [{ place, distanceMeters }], totalCount, radius }`

주의: 목록(`/places`)과 달리 **커서가 아니라 `totalCount`** 를 준다 → 건수 표기가 가능하다.

## 5-2. 긴급 시설 (동물병원·약국) — 착수 가능

| 화면           | 경로         | API                           | 상태                                 |
| -------------- | ------------ | ----------------------------- | ------------------------------------ |
| 주변 긴급 시설 | `/emergency` | `GET /emergencies/facilities` | **구현** (#13) · **지도 구현** (#14) |

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
**2026-09-01 재확인**: `find backend/service -type d -name <pkg>` 로 네 패키지 모두 여전히 없다.

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
