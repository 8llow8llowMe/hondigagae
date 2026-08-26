# Tour Service

## 책임

- 장소(관광지/음식점/숙박/카페) 검색·상세 조회 — 반려견 동반 조건 필터 포함
- 관광지별 연관 관광지 조회 (코스 생성 기반 데이터)
- 두루누비 산책·레저 코스 조회
- 여행 적합도 분석 — 날씨 + 혼잡도 + 반려견 동반 조건 결합, score + XAI reasons
- 위치 기준 동물병원·동물약국 반경 조회 (긴급 상황 도우미)
- 좌표 반경 장소 검색 (식당·카페 포함)

## 컨텍스트

- `place` — 장소 마스터, 반려견 동반 조건, 연관 관광지
- `walkcourse` — 두루누비 코스
- `insight` — 여행 적합도, 혼잡도, 날씨
- `emergency` — 동물병원·동물약국 등 긴급 시설

## 주요 API (계획)

- `GET /api/v1/places` — 검색 (지역, 유형, 반려견 동반 조건, 커서 기반 `SliceResponse`)
- `GET /api/v1/places/{placeId}` — 상세 (출입 조건: 실내/실외, 크기 제한, 목줄/케이지 조건)
- `GET /api/v1/places/{placeId}/related` — 연관 관광지
- `GET /api/v1/places/{placeId}/suitability` — 여행 적합도 (`score` + `reasons`, `api-design-guide.md` §9)
- `GET /api/v1/walk-courses` — 산책 코스 검색
- `GET /api/v1/places/nearby?lat=&lng=&radius=&contentType=` — 좌표 반경 장소 검색
- `GET /api/v1/emergencies/facilities?lat=&lng=&radius=&type=&open24Only=` — 긴급 시설 반경 검색

## 데이터 흐름

- 장소/코스/연관 관광지/혼잡도 예측: batch-service가 적재한 DB를 조회한다.
- 날씨: 기상청 실시간 호출(`WeatherObservationPort`) + Redis 캐시 (TTL 약 10분).
- 적합도 산출: `insight` 컨텍스트의 Processor가 날씨·혼잡도·동반 조건을 조합해 점수화한다.
  LLM 해설이 필요한 부분은 ai-service 책임이고, 이 서비스는 규칙 기반 점수와 근거 데이터만 제공한다.

## 구현 주의점

- 조회 중심 서비스 — `QueryResult` / `Info` / Presenter 구조를 사용한다.
- 기상청 응답 등 외부 원본 스키마는 adapter 밖으로 새지 않는다 (`external-api-guide.md` §3).
- 적합도 등급은 `SuitabilityLevel`, 동반 구분은 `PetAllowanceType` enum 사용 (`coding-conventions.md` §8-3).
- 좌표 기반 조회는 DB 사각 범위 필터 + 애플리케이션 하버사인 정렬 조합을 쓴다 (`place-data-integration.md` §9-2). 데이터가 커지면 공간 인덱스로 옮긴다.
- 동물병원 운영시간은 원천의 절반이 비어 있다(약국은 98% 채워짐). null 을 "휴무"로 표현하지 말고 `operatingHoursKnown=false` 로 "정보 없음"임을 드러낸다.
- 서버는 카카오 API 를 호출하지 않는다. 지도는 클라이언트 JS SDK 담당이다.
