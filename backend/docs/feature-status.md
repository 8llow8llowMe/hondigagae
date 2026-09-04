# 혼디가개 백엔드 기능 현황

> 무엇이 되고 무엇이 안 되는지의 단일 기준. 기능을 추가·제거하면 여기부터 고친다.
> 기준일: 2026-09-02 / 브랜치 `develop` (+ #152). 이슈 단위 대응은 맨 아래 "이슈 대응 현황".

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
| POST | `/api/v1/members/signup/dev` | **개발 전용** — 이메일 인증 생략. 운영 프로필에서는 404 |
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
| GET | `/api/v1/insights/regional-weather` | 제주 권역(5곳) 날씨 비교 + 나가기 좋은 권역 추천 |
| GET | `/api/v1/insights/walk-times` | 좌표 기준 오늘 산책 안전 곡선 + 골든타임 |
| GET | `/api/v1/places/{placeId}/suitability` | 날씨+동반조건+혼잡도 적합도. 단기+중기 합쳐 약 11일. `score` 가 null 이면 판단 근거 없음 |
| GET | `/api/v1/places/{placeId}/walk-safety` | 추정 노면온도·열지수 기반 산책 위험도 + 안전 시간대 |

### plan-service

| 메서드 | 경로 |
| --- | --- |
| POST·GET | `/api/v1/plans` | 생성은 `petIds`(최대 5, 첫 번째 = 대표) — ai-plans 와 같은 우선순위. `petId` 필터 = 반려견별 히스토리(한 마리라도 동행이면 히트) |
| GET·PUT·DELETE | `/api/v1/plans/{planId}` | 항목마다 장소 요약(주소·실내·대표 이미지·좌표) 포함. `petIds` 동행 목록 |
| PUT | `/api/v1/plans/{planId}/days/{day}/items` |
| GET | `/api/v1/plans/{planId}/weather` | 일자별 날씨 브리핑 + 비 오는 날 실내 대안. 여러 마리는 아이별 판정 → 가장 낮은 아이 기준(`basisPetId`·`petSuitabilities`) |
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
on/off 스위치와 스텁 어댑터는 두지 않는다(2026-09-03 제거). 프론트 개발자가 백엔드를 로컬에
띄우지 않고 dev 서버에 직접 붙기로 해서, LLM 없는 환경을 위한 분기가 필요 없어졌다.

환각 방지는 **후보 장소 목록을 먼저 주는 방식**이다. tour-service 에서 동반 가능으로
확인된 장소를 받아 프롬프트에 싫고, 돌아온 `placeId` 를 다시 후보 집합과 대조해
밖에 있는 것은 장소 연결을 끊는다 (항목 자체는 일정 흐름으로 남긴다).

### batch-service (웹 API 없음)

| 잡 | 대상 | 상태 |
| --- | --- | --- |
| `placeImportJob` | TourAPI 관광 장소 + 추가 이미지(detailImage2, place_image) | 구현 |
| `placeImageBackfillJob` | 문화정보원·식약처 장소의 대표 이미지 백필 (TourAPI 검색, 제목+좌표 검증) | 구현 |
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
| 기상특보 연동 | **구현 (조회)** | #156 — 적합도·권역 날씨·산책 안전 응답에 `weatherWarnings`. 카카오 메시지 알림 연계는 후속 |
| 항목 단위 산책 위험도 | 미착수 | 일정 브리핑은 일자별 대표 장소 한 곳만 조회한다 |
| 일정 브리핑 체감온도 | **구현** | #88. `weather.maxFeelsLikeTemperature` — tour `DailyWeather` 가 시각별 열지수의 하루 최대를 내고 plan 이 그대로 전달. 중기예보는 null |
| AI 초안 WALK 항목 `placeId` 불일치 | 해결됨 | #89. 초안에 `WALK` 를 내리지 않고 `PlanItemType` 을 `shared-travel` 로 올렸다. **FE 우회(WALK 의 `targetId` 미전송) 해제 가능** |
| AI 작업 세부 단계·취소·`sigunguCode` | 미착수 | #90. 일자 재생성은 #77 로 됨 |
| 다견 일정의 준비물 생성 | 구현 | 동행 반려견 전체 특성을 벌크 조회해 근거로 삼는다. 프롬프트는 합집합 규칙 |
| 반려견 프로필 매칭 | **구현** | `petSizeType`/`petWeightKg` 필터. 프로필 체중 입력은 FE 몫 |
| 영업시간 구조화 | **구현 (긴급 시설)** | `openNowOnly` + 항목별 `openNow`. 여행 장소(place_intro.use_time)는 후속 |
| 데이터 delisting | **구현** | `delisted_at` 표시 + 급감 가드. `data-refresh-guide.md` 2절 |
| 배포 파이프라인 | **구현** | #21 — 서비스별 `docker-compose-*.yml` + Jenkins. `deploy-guide.md`·`jenkins-cicd-dev-deploy-guide.md` |
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

## 이슈 대응 현황 (백엔드)

> GitHub 이슈는 클론한 저장소에서 보이지 않는다. 백엔드 라벨이 붙은 이슈 46개가 코드에 어떻게 대응됐는지 여기 남긴다.
> 갱신 기준: 2026-09-02. 이슈를 닫거나 새로 열면 이 표도 같이 고친다 (`docs/git-workflow.md` §7).
> "완료" 는 코드가 `develop` 에 있고 이슈가 닫혔다는 뜻이다. 닫혔는데 체크박스가 비어 있던 14개(#4 #5 #25 #28 #34 #35 #40 #41 #57 #77 #86 #104 #106 #108)는
> 코드로 대조해 전부 구현을 확인했다 — #40 의 "Swagger 400 응답 추가" 만 근거가 없다.

**열린 것 (7)**

| 이슈 | 영역 | 제목 | 상태 |
| --- | --- | --- | --- |
| #87 | plan | 여행 기간을 줄여도 범위 밖 일정 항목이 정리되지 않는다 | 해결됨 — `PLAN_008` 거부(99c6a41f) + 회귀 테스트·규칙 문서화. 이슈 닫기 대상 |
| #88 | plan | 일정 날씨 브리핑에 체감온도 추가 | 구현 — `PlanDailyWeatherItem.maxFeelsLikeTemperature` (tour 적합도 응답 `weather` 에도 같은 필드) |
| #89 | ai | AI 초안의 WALK 항목 placeId 가 walk_course.id 와 어긋난다 | 해결됨 — `PlanItemType` 공유 + 어댑터 교정. FE 후속: WALK `targetId` 우회 해제 |
| #90 | ai | AI 일정 작업 세부 단계·일자 재생성·취소·sigunguCode | 재생성만 완료(#77), 나머지 3건 미착수 |
| #152 | plan | 일정 저장·판정의 다중 반려견 지원 (PlanCreateRequest.petIds) | 머지됨 — 이슈 닫기 대상 (`features/152-plan-multi-pet.md`) |
| #202 | api-gateway·plan | 게이트웨이가 /api/v1/favorites 를 라우팅하지 않는다 | 구현 완료, PR 대기 — 세 프로파일 라우트 + `GatewayRouteCoverageTest`. FE 실기기 확인은 plan-service 배포 후 |
| #214 | auth·core | 디코딩 불가 서명 JWT 가 401 이 아니라 500 을 준다 (래퍼 없는 본문) | 머지됨 — 이슈 닫기 대상. 토큰 없음 403→401 `SECURITY_001`, `HttpMessageNotReadableException` 핸들러 4 서비스 |
| #231 | tour | 추가 요금 원문 "없음" 이 요금 있음으로 판정돼 적합도가 3점 깎인다 | 구현 완료, PR 대기 — `PetExtraFee` 가 원문 뜻(CHARGED/NONE/UNKNOWN)을 읽고 CHARGED 만 감점 |

**완료 (41)**

| 이슈 | 영역 | 제목 | 비고 |
| --- | --- | --- | --- |
| #1 | docs | 프로젝트 기반 문서 및 개발 컨벤션 세팅 | |
| #3 | service-discovery·api-gateway | 백엔드 MSA 기반 구축 (Gradle 멀티모듈 + core + 게이트웨이) | |
| #4 | auth·core·plan·tour | 도메인 서비스 5종 스캐폴딩 (auth/tour/plan/ai/batch) | |
| #5 | auth | 멀티 소셜 로그인 회원 도메인 적용 및 원본 구조 정합화 | |
| #8 | tour | 긴급 시설 facilityId 가 JS 안전 정수 범위를 초과해 정밀도가 손상됨 | |
| #16 | tour | 장소 상세 응답에 indoor·sourceName·sourceCategory 추가 | |
| #17 | tour | 장소 상세 응답의 contentId 가 문자열 "null" 로 직렬화됨 | |
| #21 | 전 서비스 | dev/prod 배포 파이프라인 구축 (컨테이너 정의·Jenkins) | |
| #22 | docs | 프로젝트 소개와 시스템 아키텍처 다이어그램 작성 | |
| #25 | core | 여행 도메인 enum 을 shared-travel 공유 모듈로 이관 | |
| #26 | core·tour | 기상청 단기예보 조회 기반 구축 | |
| #27 | plan·tour | 장소 여행 적합도 조회 | |
| #28 | plan·tour | 장소 산책 위험도 조회 | |
| #29 | plan·tour | 관광지 집중률 예측 적재 배치 | |
| #30 | ai·tour | AI 여행 플래너 Claude 어댑터 연동 | 이후 #57 로 Ollama 전환 |
| #31 | auth·plan·tour | 일정 날씨 브리핑 | |
| #32 | auth·api-gateway | CORS 허용 목록 정리와 FE 로컬 포트 5174 | |
| #34 | tour | 원천에서 사라진 장소를 조회에서 내리는 delisting | |
| #35 | plan·tour | 반려견 크기·체중으로 입장 가능한 장소 매칭 | |
| #37 | docs·tour | 영업시간 구조화와 긴급 시설 "지금 영업 중" 판정 | |
| #38 | ai·auth·plan·tour | 동적 검색 QueryDSL 전환과 @Param·예외 캐논 정리 | |
| #39 | plan·tour | 일정 항목 검증의 원격 N+1 제거 | |
| #40 | auth | POST /auth/login 에 @Valid 가 없어 서버 검증이 무효 | Swagger 400 명시는 미반영 |
| #41 | auth | 비밀번호 재설정(찾기) API 추가 | |
| #42 | auth | 인증코드 TTL·재전송 쿨다운을 응답과 Swagger 에 노출 | |
| #52 | 전 서비스 | Redis Sentinel 접속 배선과 설정 누락 기동 실패 | |
| #53 | core·tour | 예보 캐시 쿼터 방어 — 발표 유예·격자 묶기·갱신 락 | |
| #55 | auth | 인증/회원 보안 보완 — 다중 기기 세션, 비밀번호 재설정, 계정 연결/전환 | |
| #57 | ai | AI 플래너 로컬 LLM 전환과 SSE 상태 스트리밍 | |
| #77 | ai·docs·plan·tour | AI 일정 생성 제어 — 다중 반려견·필수 포함 장소·하루 재생성 | 저장 측 다견화는 #152 |
| #86 | plan | 일정 상세 항목에 장소 요약(주소·실내·이미지·좌표) 포함 | |
| #104 | plan | 여행 동행 기능 — 방문 체크·응급 브리핑·반려견별 히스토리 | |
| #106 | auth·docs | 반려견 프로필 보강 — 사진(MinIO)·체중·대표견·고아 이미지 청소 | |
| #108 | tour | numOfRows 가 단기예보를 잘라 최고기온(TMX)이 유실되던 문제 | |
| #121 | ai·auth·plan | 전 서비스 감사 반영 — 경계 위반·예외 응답 누수 수정과 보완 기능 5종 | |
| #134 | batch·tour | batch-service 공공 API 방어와 포트 명명을 컨벤션에 맞춘다 | |
| #135 | tour | tour-service 응답 봉투·인덱스·metadata 컨벤션 위반을 고친다 | |
| #136 | tour | 명칭 매칭 구분값을 shared enum 으로 올린다 | |
| #137 | plan·tour | 긴급 시설 상세와 기간 혼잡도 조회 API 를 추가한다 | |
| #155 | ai·tour | AI 일정 생성 날씨 접목과 반려견 준비물 목록 생성 | |
| #156 | docs·api-gateway·tour | 제주 특색 × 기상청 API 날씨 인사이트 3종 | |
