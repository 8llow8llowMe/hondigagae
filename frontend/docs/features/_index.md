# Feature 명세 인덱스

> 기능별 명세 정본은 `docs/features/<feature>/*.md` 다.
> 작성은 `fe-spec-writer` 서브에이전트로, 템플릿은 `frontend/_DocumentTemplates/` 를 쓴다.
> 화면 착수 가능 여부는 `docs/screen-inventory.md` 를 먼저 확인한다.

## 작성 규칙

- 공통명세: `_template-공통명세.md` 구조(S0~S5)를 그대로 지킨다
- 세부명세: `_template-세부명세.md` 구조(D0~D8)를 그대로 지킨다
- **API 스펙을 창작하지 않는다.** Swagger 실측 근거를 남긴다
- 미결은 `D8. 미결 사항` 에 **선택지 + 추천안** 으로 남긴다
- 화면 문구(카피)는 명세에서 확정한다
- **`brand` 는 D0~D9 를 쓰지 않는다.** 라우트가 없어 레이아웃·데이터 흐름·상태별 화면이
  없다 — 같은 정신으로 절(B0~B12)을 나눴다

## 상태

| feature     | 문서                                                                                                            | 상태                                                                          | 백엔드               | 비고                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| home        | `공통명세.md`, `홈-세부명세.md`, `전역nav-세부명세.md`                                                          | 구현 완료                                                                     | 구현                 | 전역 nav 포함 (#51). 명세와 계약 차이는 아래                                                                                                                                   |
| home        | `홈-첫방문-판정-세부명세.md`, `골든타임-문구-세부명세.md`, `권역-점수-라벨-세부명세.md`                         | **명세 완료** (UX 진단 Sprint A)                                              | 구현                 | 진단 정본 `docs/superpowers/specs/2026-09-15-ui-ux-audit-design.md` H-1·H-2·H-3·H-4. 세 문서는 각각 한 레인(이슈)이다                                                          |
| auth        | `공통명세.md`, `로그인-세부명세.md`, `회원가입-세부명세.md`, `비밀번호찾기-세부명세.md`, `소셜콜백-세부명세.md` | 로그인·가입 구현 완료 / 재설정·소셜 명세 완료                                 | 구현                 | 소셜 2-step · 재설정은 열거 방지가 핵심                                                                                                                                        |
| member      | `공통명세.md`, `마이페이지-세부명세.md`                                                                         | 명세 완료                                                                     | 구현                 | 계정 상태 3종(provider × hasPassword) · multipart 업로드 첫 등장                                                                                                               |
| pet         | `공통명세.md`, `목록/등록/수정-세부명세.md`                                                                     | 구현 완료                                                                     | 구현                 | 등록 상한 5마리 / 사진·체중·대표견 구현 (#126)                                                                                                                                 |
| emergency   | `긴급시설-목록우선-세부명세.md`                                                                                 | **명세 완료** (UX 진단 Sprint A)                                              | 구현                 | 진단 E-1·E-2. 기본 보기 목록 + 위치 primary 버튼 + 권역 세그먼트                                                                                                               |
| place       | `공통명세.md`, `장소상세-세부명세.md`                                                                           | 작성 중                                                                       | 구현                 | 목록·상세·**지도(#14) 구현 완료**                                                                                                                                              |
| walk-course | `공통명세.md`, `코스목록-세부명세.md`, `코스상세-세부명세.md`                                                   | **명세 완료** ([#618](https://github.com/8llow8llowMe/hondigagae/issues/618)) | 구현                 | 제주올레 29코스. **공개 API** · 계약은 dev 게이트웨이 실호출로 실측(2026-09-18). **좌표가 있는 코스가 4/29 뿐이라 골든타임 동선은 예외가 아니라 소수다** (공통명세 S3-1)       |
| plan        | `공통명세.md`, `일정상세-세부명세.md`, `일자편집-세부명세.md`, `담기지도-세부명세.md`, `올레담기-세부명세.md`   | 작성 중                                                                       | 구현                 | 목록·생성(#75) · 상세(#80) · 일자편집(#81) · 방문 체크(#124) · 담기(#82) 완료 · 담기 지도 보기(#370) 구현 완료 · **올레 코스 담기(#620) 명세 완료 — 행 렌더는 일정상세 `D12`** |
| plan        | `일정공유-세부명세.md`                                                                                          | 구현 완료                                                                     | 구현                 | 발급·폐기(관리 메뉴 모달) + 공개 열람 `/shared-plans/[token]` (#627 BE · #628 FE). **404 와 410 을 가르는 것이 핵심이다**                                                      |
| ai-plan     | `공통명세.md`, `초안거리-세부명세.md`                                                                           | 생성 구현 완료 / 초안 거리(#100) 명세 완료                                    | 구현 (Stub LLM 기본) | 폴링 2s. **SSE 는 BFF 버퍼링 때문에 별도 이슈**                                                                                                                                |
| favorite    | `저장한장소-세부명세.md`                                                                                        | 구현 완료                                                                     | 구현                 | `/favorites`. 커서·정렬 없음(상한 100곳) · 저장일은 BE 응답에 없어 미구현 (#127)                                                                                               |
| brand       | `브랜드에셋-세부명세.md`                                                                                        | 구현 완료                                                                     | 무관                 | 파비콘·앱 아이콘·공유 카드·PWA·헤더 워드마크. 화면이 아니라 브라우저·OS 로 내보내는 아이덴티티                                                                                 |
| about       | `소개페이지-세부명세.md`                                                                                        | 구현 완료                                                                     | 무관                 | `/about` 공개 소개 페이지 (#635). 정본 설계는 루트 `docs/superpowers/specs/2026-09-15-about-landing-design.md`. 백엔드 호출 없음                                               |
| 공통        | `등급배지-축라벨-세부명세.md`                                                                                   | 구현 완료                                                                     | 무관                 | 진단 G-1 · D-2 (#652). `MetricBadge` 축 라벨 — 화면이 아니라 전 화면이 쓰는 컴포넌트 하나의 어휘 규칙이다                                                                      |
| plan        | `여행브리핑-세부명세.md`                                                                                        | **구현 완료** (#626)                                                          | 구현                 | `GET /plans/{planId}/briefing?date=`. 진입점은 `일정상세-세부명세.md` **D16**. 특보·골든타임은 `today=true` 에서만 온다                                                        |

상태 값: `미작성` / `작성 중` / `확정` / `구현 완료` / `보류`

## 명세와 실제 계약이 갈린 곳 (구현 시 발견)

명세는 게이트웨이가 안 떠 있어 **Swagger 를 부르지 못한 상태**로 작성됐다. 구현하며 백엔드
소스를 실측한 결과 아래가 달랐다. **실측이 정본이고, 명세 문서는 기록으로 남긴다.**

| feature  | 명세                                                 | 실제                                                                                                                                                                                                                                                                                                                                      |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| home     | 실내 대안 `alternativePlaces`                        | **`indoorAlternatives`**                                                                                                                                                                                                                                                                                                                  |
| home     | 적합도 등급 `HIGH/MEDIUM/LOW/UNKNOWN`                | **`HIGH/MEDIUM/LOW/INSUFFICIENT`**                                                                                                                                                                                                                                                                                                        |
| home     | 산책 위험도도 같은 4단                               | **`SAFE/CAUTION/DANGER/UNKNOWN`** — 코드 체계가 다르다                                                                                                                                                                                                                                                                                    |
| home     | 혼잡도도 같은 톤 매핑                                | **의미가 반대다** — `LOW` 가 "한산"(좋음), `HIGH` 가 "혼잡"                                                                                                                                                                                                                                                                               |
| home     | 일정 날씨 `title` · `dailyBriefings[]`               | **`planTitle`** · **`days[]`**                                                                                                                                                                                                                                                                                                            |
| home     | 인사이트 조회에 `petId`                              | **반려견 속성을 개별 쿼리 파라미터로** 보낸다 (공개 API 다)                                                                                                                                                                                                                                                                               |
| place    | 목록 항목에 크기 정보 없음                           | **`allowedPetSize`(metadata) · `maxPetWeightKg`** 가 있다                                                                                                                                                                                                                                                                                 |
| place    | 목록 필터에 반려견 기준 축 없음                      | **`petSizeType` · `petWeightKg`** 파라미터가 있다                                                                                                                                                                                                                                                                                         |
| plan     | 날씨 `skyState`·`precipitationType` 이 metadata 객체 | **`skyStateName`·`precipitationTypeName` 문자열** (#80 에서 타입 수정)                                                                                                                                                                                                                                                                    |
| plan     | 날씨에 예보 출처·풍속·습도 없음                      | **`forecastSourceCode`/`Name` · `maxWindSpeed` · `maxHumidity`** 가 있다                                                                                                                                                                                                                                                                  |
| plan     | 항목 행에 주소 · **실내 여부**                       | **해소됨** — #16 으로 상세 응답에 `indoor` 가 들어왔고 #112 에서 붙였다                                                                                                                                                                                                                                                                   |
| plan     | 항목당 `GET /places/{id}` 보강                       | **걷었다** — #86 으로 `PlanItemDetail.place` 가 주소·실내·이미지·좌표를 함께 주고, FE #115 에서 항목 보강을 뗐다. 남은 보강은 실내 대안뿐이다                                                                                                                                                                                             |
| plan     | 항목 응답에 산책 코스 요약 없음                      | **생겼다** — `PlanItemDetailItem.walkCourse`(BE `efef555e` 2026-09-17 · #619). `PlanItemWalkCourseItem` = `name`·`courseLabel`·`distanceKm`·`durationText`·`durationMaxMinutes`·`lat`/`lng`·`firstImage`·`fitsActivityLevels`. **스냅샷(2026-09-14)보다 뒤라 스냅샷에 없다** — dev 실측 2026-09-18. `types/plan.ts` 는 #620 에서 따라간다 |
| favorite | 목록 항목에 저장일 있음(아트보드 03)                 | **없다** — `FavoritePlaceItem` 에 날짜 필드가 없다. `FavoriteEntity` 는 `BaseEntity` 상속이라 DB 에는 있다 (BE 요청 #127 D9-1)                                                                                                                                                                                                            |
| favorite | 단건 저장 여부 조회 없음                             | **생겼다** — `GET /favorites/places/{placeId}` → `{placeId, favorited}` (`4a4f2cd`). 아직 쓰지 않는다                                                                                                                                                                                                                                     |
| home     | 골든타임 응답에 곡선이 빈 이유가 없음                | **생겼다** — `WalkTimesResponse.forecastCoverage`(`AVAILABLE`/`DAY_ENDED`/`UNAVAILABLE`). **아직 쓰지 않는다** — [#262](https://github.com/8llow8llowMe/hondigagae/issues/262)                                                                                                                                                            |
| home     | 권역 비교 행에 체감온도 없음                         | **생겼다** — `RegionWeatherItem.maxFeelsLikeTemperature`(2026-09-10 재수집, #409). **FE 타입에 아직 없다** — 표시 여부가 [#407](https://github.com/8llow8llowMe/hondigagae/issues/407) 의 답에 걸려 있다                                                                                                                                  |
| place    | 기간 혼잡도에 추천일 없음                            | **생겼다** — `PlaceCongestionResponse.leastCrowded`(2026-09-13 재수집, #534). **해소됨** — [#430](https://github.com/8llow8llowMe/hondigagae/issues/430) 이 `PlaceCongestionResponse` 타입과 장소 상세의 기간 혼잡도 카드를 붙였다. 추천일은 **서버가 고른 값을 그대로 쓴다**                                                             |

> 위 표는 **2026-09-13 스냅샷 재수집**까지 반영했다 (`docs/api/openapi/`, #534).
>
> **이번에 새로 갈린 것은 `PlaceCongestionResponse.leastCrowded` 하나다.** 함께 들어온
> 필드 셋(`DataHeader.fieldErrors` · `PlanDayWeatherItem.unavailableReasonCode` ·
> `AiPlanJobStatusResponse.conditions`)은 **FE 가 이미 쓰고 있다** — 스냅샷만 뒤늦게
> 따라왔다. 위 `goldenWindowStatus` 전례와 같은 모양이라, 스냅샷을 정본으로 믿고
> "없는 필드" 로 판단하면 틀린다는 근거가 하나 더 늘었다.
>
> **새 operation 8개가 들어왔다** — `/walk-courses` 2종(tour) · 여행 브리핑 1 · 준비물
> 5종(plan). 셋 다 FE 가 **존재 자체를 모르던 표면**이라 "안 붙였다" 가 아니라 "판단한 적이
> 없다" 다. 연동 여부는 화면 이슈로 따로 본다 — 목록과 사유는 `screen-inventory.md` 와
> 루트 `docs/api/README.md` 에 있다.
>
> FE 호출 경로를 서버 operation **65개**와 전수 대조해 **없는 엔드포인트를 부르는 곳이
> 없음**을 확인했다. FE 가 안 붙인 서버 경로는 **13개**(기존 5 + 신규 8)다.
>
> 앞선 **2026-09-06 재수집**에서 갈린 것은 `forecastCoverage` 하나였고, 그때 함께 들어온
> 신규 필드(`sigunguCode` · `step`/`stepOrder`/`totalSteps` ·
> `DailyWeatherItem.maxFeelsLikeTemperature` · `POST /ai-plans/jobs/{jobId}/cancel`)는 FE 가
> 이미 쓰고 있었다. **`maxFeelsLikeTemperature` 가 그때 "쓰고 있다" 로 적힌 것은
> `DailyWeatherItem`·일정 날씨 쪽 이야기다** — `RegionWeatherItem` 의 같은 이름 필드는
> 이번(2026-09-10)에 처음 들어왔고 아직 안 쓴다.
>
> 재수집 절차와 **구조 diff 스크립트**는 루트 `docs/api/README.md` 에 있다 — `git diff` 만
> 보면 키 순서와 description 이 함께 흔들려 수백 줄이 잡힌다.

**`petSizeType` 은 `allowedPetSize` 와 다른 축이다.** 저쪽은 *장소의 속성*을 직접 고르고,
이쪽은 *내 반려견*을 기준으로 거른다. 그리고 **`UNKNOWN` 인 장소는 걸러내지 않는다** —
정보 없음을 "불가" 로 단정하면 실제로는 갈 수 있는 장소가 검색에서 사라진다
(backend `AllowedPetSize#allows`). mock 도 같은 규칙을 이식해 뒀다.

**`petWeightKg` 를 쓴다** (#126). 프로필에 체중이 생기면서 이 축이 열렸고, `petSizeType` 과
**한 컨트롤이 함께 켠다** — 같은 "내 반려견 기준" 축이다. 체중을 모르는 아이는 크기만 보낸다.
**올림해서 보내는 이유**는 `lib/pet/weight.ts` 주석에 있다 (파라미터가 `Integer` 다).

**톤 매핑이 가장 위험했다.** 공용 매퍼 하나를 쓰면 "혼잡" 이 초록으로, "안전" 이 회색으로
나간다. 축별 매퍼를 `src/lib/insight/tone.ts` 에 두고 테스트로 고정했다.
