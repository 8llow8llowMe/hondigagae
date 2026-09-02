# 혼디가개 백엔드 기능 현황

> 무엇이 되고 무엇이 안 되는지의 단일 기준. 기능을 추가·제거하면 여기부터 고친다.
> 기준일: 2026-08-27 / 브랜치 `develop`

## 한눈에

| 서비스 | 컨텍스트 | 상태 |
| --- | --- | --- |
| auth-service | `auth`, `member`, `pet` | 구현 |
| tour-service | `place`, `emergency`, `insight` | 구현 |
| tour-service | `walkcourse` | **미착수** |
| plan-service | `plan` | 구현 (날씨 브리핑 포함) |
| ai-service | `planner` | 구현 (Spring AI + 로컬 LLM(Ollama), 기본값은 스텁) |
| batch-service | `placeimport`, `congestionimport` | 구현 |
| api-gateway / service-discovery | — | 구현 |

## 구현된 API

### auth-service

| 메서드 | 경로 | 비고 |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | 일반 로그인 |
| POST | `/api/v1/auth/logout` | 현재 기기만. 다른 기기 로그인 유지 |
| GET | `/api/v1/auth/{provider}/authorize` | 소셜 인가 URL |
| GET | `/api/v1/auth/{provider}/login` | `code`, `state` 쿼리 파라미터 |
| POST | `/api/v1/auth/email/send-code` · `/verify-code` | 이메일 인증 |
| POST | `/api/v1/auth/password/reset/send-code` · `/password/reset` | 재설정 (계정 열거 방지, 5회 오입력 무효화) |
| POST | `/api/v1/auth/token/reissue` | 세션별 회전, 이전 refresh 즉시 무효 |
| GET·DELETE | `/api/v1/auth/sessions[/{sessionId}]` | 로그인 기기 목록·특정 기기 로그아웃 |
| POST | `/api/v1/members/signup` | |
| GET·PATCH | `/api/v1/members/me` | |
| POST·DELETE | `/api/v1/members/me/profile-image` | |
| POST | `/api/v1/members/me/password` · `/password/setup` · DELETE `/password` · `/me/withdraw` | 변경/최초 설정/소셜 전용 전환/탈퇴 |
| GET·POST·PUT·DELETE | `/api/v1/members/me/pets[/{petId}]` | 반려견 프로필 |
| POST·DELETE | `/api/v1/members/me/pets/{petId}/profile-image` | 반려견 프로필 사진 (MinIO) |
| PUT | `/api/v1/members/me/pets/{petId}/representative` | 대표 반려견 지정 (회원당 하나) |

소셜 로그인은 provider 를 경로 변수로 받아 kakao·naver 를 같은 흐름으로 처리한다.

### tour-service

| 메서드 | 경로 | 비고 |
| --- | --- | --- |
| GET | `/api/v1/places` | 지역·타입·동반조건·실내·크기·원본분류·반려견 크기/체중 필터, 커서 기반 |
| GET | `/api/v1/places/nearby` | 좌표 반경 검색 (식당·카페 포함) |
| GET | `/api/v1/places/{placeId}` | intro·petInfo·images 결합 상세. `indoor`·`sourceCategory`·`sourceName` 포함(목록과 같은 매핑), `contentId` 는 원천이 TourAPI 가 아니면 **null** |
| GET | `/api/v1/emergencies/facilities` | 동물병원·동물약국 반경 검색, `openNowOnly` 지금 영업 중 필터 |
| GET | `/api/v1/emergencies/facilities/{facilityId}` | 긴급 시설 상세. delisted 시설은 404 |
| GET | `/api/v1/places/{placeId}/congestions` | 기간 혼잡도(기본 7일, 최대 30일). 데이터 없는 날짜도 UNKNOWN 으로 남긴다 |
| GET | `/api/v1/places/{placeId}/suitability` | 날씨+동반조건+혼잡도 적합도. 단기+중기 합쳐 약 11일. `score` 가 null 이면 판단 근거 없음 |
| GET | `/api/v1/places/{placeId}/walk-safety` | 추정 노면온도·열지수 기반 산책 위험도 + 안전 시간대 |

### plan-service

| 메서드 | 경로 |
| --- | --- |
| POST·GET | `/api/v1/plans` (`petId` 필터 = 반려견별 히스토리) |
| GET·PUT·DELETE | `/api/v1/plans/{planId}` | 항목마다 장소 요약(주소·실내·대표 이미지·좌표) 포함 |
| PUT | `/api/v1/plans/{planId}/days/{day}/items` |
| GET | `/api/v1/plans/{planId}/weather` | 일자별 날씨 브리핑 + 비 오는 날 실내 대안 |
| GET·POST·DELETE | `/api/v1/favorites/places[/{placeId}]` | 장소 즐겨찾기 (멱등, 회원당 100곳, GET {placeId} = 여부 확인) |
| PUT | `/api/v1/plans/{planId}/items/{planItemId}/visited` | 항목 방문 체크 (다녀옴) |
| GET | `/api/v1/plans/{planId}/emergency` | 일자별 방문 장소 주변 동물병원·약국 브리핑 |

일정의 소유권은 이 서비스에 있다. ai-service 는 제안만 하고 저장·확정은 여기서만 일어난다.

### ai-service

| 메서드 | 경로 | 상태 |
| --- | --- | --- |
| POST | `/api/v1/ai-plans` | 일정 생성 제출 (202 + jobId, 멱등). 다중 반려견·대표견 기본값·필수 포함 장소·하루 재생성(planId+regenerateDay) 지원 |
| GET | `/api/v1/ai-plans/jobs/{jobId}` | 폴링 (SSE 폴백) |
| GET | `/api/v1/ai-plans/jobs/{jobId}/stream` | SSE — 상태 변경 시에만 이벤트, 종결 시 서버가 닫음 |
| POST | `/api/v1/ai-plans/packing-list/{planId}` | 반려견 여행 준비물 AI 생성 (동기, 예보·특성·일정 근거) |

LLM 연동 완료(**Spring AI + Ollama**, 공유 인프라 로컬 LLM, 구조화 출력).
모델 교체는 `AI_LLM_MODEL` 값 하나, provider 교체는 어댑터·모델 빈 추가로 끝난다.
`ai-llm.enabled=false` 가 기본이라 LLM 없이도 기동되며 그때는 `StubLlmAdapter` 가
포트를 채운다 — 프론트 개발과 CI 가 로컬 LLM 기동 여부에 묶이지 않게 하기 위해서다.

환각 방지는 **후보 장소 목록을 먼저 주는 방식**이다. tour-service 에서 동반 가능으로
확인된 장소를 받아 프롬프트에 싫고, 돌아온 `placeId` 를 다시 후보 집합과 대조해
밖에 있는 것은 장소 연결을 끊는다 (항목 자체는 일정 흐름으로 남긴다).

### batch-service (웹 API 없음)

| 잡 | 대상 | 상태 |
| --- | --- | --- |
| `placeImportJob` | TourAPI 관광 장소 | 구현 |
| `cultureFacilityImportJob` | 문화정보원 문화시설 + 긴급 시설 | 구현 |
| `petRestaurantImportJob` | 식약처 음식점 + VWorld 지오코딩 | 구현 |
| `congestionImportJob` | 관광지 집중률 예측 + 명칭 매칭 | 구현 |

`congestionImportJob` 은 **`placeImportJob` 이후에 돌려야 한다.** 장소가 비어 있으면
전부 UNMATCHED 로 적재되고 적합도 응답에서 혼잡도가 계속 빠진다. 30일 rolling 원천이라
일 1회 주기 실행이 전제다.

## 데이터 현황 (제주)

| 대상 | 규모 | 원천 |
| --- | --- | --- |
| 장소 마스터 | 약 315곳 | 관광 29 + 문화정보원 228 + 식약처 102 − 중복 |
| ├ 식음료 | 125곳 | 문화정보원 카페 24 + 식약처 102 (중복 1) |
| └ 동반 가능 | 문화정보원분 169 / 228 | 나머지 59곳은 "동반 불가"로 표시 |
| 긴급 시설 | 214곳 | 동물병원 86 + 동물약국 128 |

### 날씨·혼잡도

| 대상 | 방식 | 커버리지 |
| --- | --- | --- |
| 기상청 단기예보 | 실시간 호출 + Redis 격자별 캐시 | 오늘 포함 **약 5일** (실측) |
| 기상청 중기예보 | 실시간 호출 + Redis 지역별 캐시 | **~ D+10** (실측) |
| 합계 | 두 예보를 이어 붙임 | **약 11일, 빈 날짜 없음** |
| 관광지 집중률 | 배치 적재 + DB 조회 | **30일 rolling** |

둘의 커버리지가 다르다. 날씨는 없고 혼잡도만 있는 날짜가 흔하며, 적합도 응답은
`weatherApplied` / `congestionApplied` 플래그로 그 차이를 감추지 않는다.

**적재는 아직 한 번도 실행되지 않았다.** 코드와 파서는 실제 원천 데이터로 검증했으나
MySQL 에 넣어본 적이 없다. 첫 배포 시 `jenkins-cicd-dev-deploy-guide.md` 7절 참고.

## 미착수 / 보류

| 기능 | 상태 | 막는 것 |
| --- | --- | --- |
| `walkcourse` (두루누비 산책 코스) | 미착수 | 데이터 확인 필요 |
| 기상특보 연동 | 미착수 | 제주는 태풍 경로. 카카오 메시지 연계와 맞물린다 |
| 항목 단위 산책 위험도 | 미착수 | 일정 브리핑은 일자별 대표 장소 한 곳만 조회한다 |
| 반려견 프로필 매칭 | **구현** | `petSizeType`/`petWeightKg` 필터. 프로필 체중 입력은 FE 몫 |
| 영업시간 구조화 | **구현 (긴급 시설)** | `openNowOnly` + 항목별 `openNow`. 여행 장소(place_intro.use_time)는 후속 |
| 데이터 delisting | **구현** | `delisted_at` 표시 + 급감 가드. `data-refresh-guide.md` 2절 |
| 배포 파이프라인 | 미착수 | Dockerfile·Jenkinsfile 없음 |
| 배치 메트릭 | 미착수 | 로그만 있고 Micrometer 미노출 |

### 데이터가 없어 못 하는 것

- **리뷰·평점** — 공공데이터에 없다. 자체 축적은 공모전 기간에 쌓이지 않는다
- **실시간 예약·빈자리** — 소스 없음
- **비 오는 날 실내 식당 추천** — 식약처 원천이 실내 여부를 주지 않아 `indoor` 가 NULL.
  문화정보원 장소에서만 동작한다
- **제주 전체 식당 커버리지** — 7,704곳 중 동반 가능이 확인된 곳은 102곳뿐이다.
  카카오 로컬을 걷어내면서 택한 교환이다 (`place-data-integration.md` §6-5)

## 알려진 제약

| 항목 | 내용 |
| --- | --- |
| 식약처 다운로드 경로 | 공개 오픈API 가 아니라 화면이 쓰는 경로. 규격 변경 시 끊긴다 |
| 문화정보원 갱신 | 파일 수동 다운로드. 자동 수집 불가 |
| 동물병원 운영시간 | 51% 만 제공. `operatingHoursKnown=false` 로 구분해 내려보낸다 |
| 좌표 반경 검색 | 사각 범위 + 애플리케이션 정렬. 수백 곳 규모 전제. 전국 확대 시 공간 인덱스 필요 |
| 중복 병합 | 각 적재 파사드가 개별 호출. 잡이 늘면 독립 잡으로 분리해야 한다 |
