# External API Guide

혼디가개가 사용하는 외부 데이터 API의 연동 기준 문서.

## 1. 연동 대상

| API | 제공처 | 용도 | 연동 방식 |
|-----|--------|------|-----------|
| 국문 관광정보 서비스 GW API (TourAPI) | 한국관광공사 | 관광지·음식점·숙박 기본 데이터 | 배치 적재 |
| 반려동물 동반여행 API | 한국관광공사 | 반려견 출입 가능 여부·이용 조건 | 배치 적재 (장소 데이터와 결합) |
| 관광지별 연관 관광지 API | 한국관광공사 | 관광지 간 연결성 (코스 생성) | 배치 적재 |
| 두루누비 API | 한국관광공사 | 산책·레저 코스 | 배치 적재 |
| 관광지 집중률 방문자 추이 예측 API | 한국관광공사 | 혼잡도 예측 | 주기 배치 + 캐시 |
| 관광빅데이터 정보 서비스 API | 한국관광공사 | 방문자 수 분석 | 주기 배치 |
| 지상 관측자료 조회 API | 기상청 | 기온·강수·바람 실시간 | 실시간 호출 + Redis 캐시 |
| 카카오 로그인 | 카카오 | 사용자 인증 | 실시간 (auth-service) |
| 카카오 지도 | 카카오 | 지도 시각화·경로 안내 | 프론트 중심, 필요 시 서버 경로 API |
| 카카오 메시지 (향후) | 카카오 | 일정 공유 | 실시간 |
| LLM API | (선정 예정) | AI 플래너·비서·분석 | 실시간 (ai-service) |

## 2. 배치 적재 vs 실시간 호출 기준

- 공공 API는 일일 호출량 제한(쿼터)이 있으므로, **변경 빈도가 낮은 데이터는 batch-service로 DB 적재 후 서비스는 DB만 조회**한다.
  - 관광지/음식점/숙박, 반려동물 동반 조건, 연관 관광지, 두루누비 코스
- **시간에 따라 변하는 데이터만 실시간 계열**로 처리하되 캐시를 앞에 둔다.
  - 날씨: 기상청 실시간 호출 + Redis 캐시 (TTL은 관측 주기 기준, 예: 10분)
  - 혼잡도 예측: 주기 배치 적재 + 조회 시 DB/캐시
- 실시간 호출 실패 시 대응을 명시한다: 캐시 스테일 허용 → 폴백 값(등급 `UNKNOWN`) → 도메인 예외(503) 순으로 검토한다.

## 3. 어댑터 규칙

- 외부 API 호출은 반드시 `adapter/out/client` 아래에 둔다. `application` 계층은 외부 API의 존재를 모른다.
- out-port는 데이터 책임으로 명명한다. 전송 기술·제공처 이름을 포트에 쓰지 않는다.
  - `WeatherObservationPort` (O) / `KmaApiPort` (X)
  - `PlaceCatalogPort`, `CongestionForecastPort`, `WalkCourseCatalogPort`
- 원본 응답 DTO(`*ClientResponse`)는 `adapter/out/client/**/dto`에 두고, adapter에서 `QueryResult` 또는 domain model로 변환해 넘긴다.
- 공공 API의 XML 응답, 페이징 래퍼(`response.body.items.item` 구조 등)는 adapter 밖으로 절대 새지 않는다.

## 4. 인증키 / 설정 관리

- 서비스 키는 코드·yml에 평문으로 커밋하지 않는다. 환경변수 또는 Jasypt 암호화로 관리한다.
- API별 base-url, 서비스 키, 타임아웃은 `@ConfigurationProperties`로 바인딩한다.
  - 예: `TourApiProperties`, `KmaApiProperties`, `KakaoOauthProperties`
- 모든 외부 호출은 connect/read timeout을 반드시 명시한다 (`coding-conventions.md` §10).
- 서킷브레이커 인스턴스는 제공처 단위로 분리한다: `tourapi`, `durunubi`, `kma`, `kakao`, `llm`.

## 5. 데이터 결합 기준 (batch)

- 장소 마스터는 TourAPI `contentId`를 원천 식별자로 유지하되, 내부 PK는 별도 발급한다.
- 반려동물 동반여행 API 데이터는 `contentId` 기준으로 장소 마스터에 결합하고,
  결합 실패(동반 정보 없음)는 `PetAllowanceType.UNKNOWN`으로 명시한다.
- 적재 배치는 재실행 가능(idempotent)해야 한다. upsert 기준 키와 갱신 시각(`syncedAt`)을 기록한다.
- 원천 API 스키마 변경으로 인한 실패는 배치 잡 단위로 격리하고, 부분 실패가 전체 적재를 막지 않게 한다.
