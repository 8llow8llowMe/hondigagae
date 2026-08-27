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
- `insight` — 여행 적합도, 산책 위험도, 혼잡도, 날씨 (구현 완료, `weather-insight-integration.md`)
- `emergency` — 동물병원·동물약국 등 긴급 시설

## 주요 API (계획)

- `GET /api/v1/places` — 검색 (지역, 유형, 반려견 동반 조건, 커서 기반 `SliceResponse`)
- `GET /api/v1/places/{placeId}` — 상세 (출입 조건: 실내/실외, 크기 제한, 목줄/케이지 조건)
- `GET /api/v1/places/{placeId}/related` — 연관 관광지
- `GET /api/v1/places/{placeId}/suitability` — 여행 적합도 (`score` + `reasons`, `api-design-guide.md` §9)
- `GET /api/v1/places/{placeId}/walk-safety` — 산책 위험도 (추정 노면온도 + 열지수 + 안전 시간대)
- `GET /api/v1/walk-courses` — 산책 코스 검색
- `GET /api/v1/places/nearby?lat=&lng=&radius=&contentType=&petSizeType=&petWeightKg=` — 좌표 반경 장소 검색
- `GET /api/v1/emergencies/facilities?lat=&lng=&radius=&type=&open24Only=&openNowOnly=` — 긴급 시설 반경 검색
- `GET /internal/v1/places/visible-ids?placeIds=` — (내부 전용) 일정 항목 검증용 벌크 존재 확인.
  게이트웨이가 라우팅하지 않으며, delisted 를 제외해 새 일정 항목이 사라진 장소를 참조하지 못하게 한다

## 데이터 흐름

- 장소/코스/연관 관광지/혼잡도 예측: batch-service가 적재한 DB를 조회한다.
- 날씨: 기상청 실시간 호출(`WeatherObservationPort`) + Redis **격자별** 캐시.
  TTL 은 고정값이 아니라 다음 발표 시각에 맞춘다 — 캐시는 성능 최적화가 아니라
  일 1,000건 제한을 방어하는 쿼터 정책이다.
- 적합도 산출: `insight` 컨텍스트의 Processor가 날씨·혼잡도·동반 조건을 조합해 점수화한다.
  LLM 해설이 필요한 부분은 ai-service 책임이고, 이 서비스는 규칙 기반 점수와 근거 데이터만 제공한다.

## 구현 주의점

- 조회 중심 서비스 — `QueryResult` / `Info` / Presenter 구조를 사용한다.
- 기상청 응답 등 외부 원본 스키마는 adapter 밖으로 새지 않는다 (`external-api-guide.md` §3).
- 적합도 등급은 `SuitabilityLevel`, 동반 구분은 `PetAllowanceType` enum 사용 (`coding-conventions.md` §8-3).
- 좌표 기반 조회는 DB 사각 범위 필터 + 애플리케이션 하버사인 정렬 조합을 쓴다 (`place-data-integration.md` §9-2). 데이터가 커지면 공간 인덱스로 옮긴다.
- 동물병원 운영시간은 원천의 절반이 비어 있다(약국은 98% 채워짐). null 을 "휴무"로 표현하지 말고 `operatingHoursKnown=false` 로 "정보 없음"임을 드러낸다.
- 서버는 카카오 API 를 호출하지 않는다. 지도는 클라이언트 JS SDK 담당이다.
- `petSizeType` 필터는 "받아 주지 않는 것으로 확인된 곳만 뺀다"이다. 크기 정보가 없는 곳(UNKNOWN)은
  남기고 응답의 `allowedPetSize` metadata 로 정보 없음임을 드러낸다. `petWeightKg` 는 상한이 kg 로
  명시된 곳(`maxPetWeightKg`)만 정확히 거른다 — enum 은 10kg 경계로 뭉개져 "12kg 미만"을 표현 못한다.
- 긴급 시설 `openNow` 는 3상이다: true/false/null(영업시간을 몰라 판정 불가). null 을 "닫힘"으로
  표시하면 실제로는 열려 있는 병원이 급한 사람의 화면에서 사라진다. `openNowOnly=true` 는 반대로
  확실히 열린 곳만 남긴다.
- delisted 장소는 목록·주변·긴급 검색에서 빠지지만 **상세는 계속 응답**한다(기존 일정 보호,
  응답에 `delisted` 플래그). 새 참조는 내부 검증 API 가 막는다 — `data-refresh-guide.md` 2절.
- 동적 검색은 `repository/custom`(QueryDSL) 이 담당한다. 병합·delisted 제외는
  `PlaceCustomRepositoryImpl.visible()` 한곳에 있다 — 새 검색을 추가하면 반드시 이것을 거친다.

## 적합도/위험도 구현 주의점

- 점수와 근거는 **규칙**에서 나온다. 같은 입력에 같은 점수가 나와야 하고, LLM 은 문장만 다듬는다.
- **근거가 없으면 점수를 만들지 않는다.** `score` 는 Wrapper 이고 날씨를 못 쓰면 null 이며
  등급은 `INSUFFICIENT` 다. 근거 없는 0점을 주면 사용자는 "여기는 별로다"로 읽는다 —
  동물병원 운영시간에 `operatingHoursKnown` 을 둔 것과 같은 판단이다.
- 예보를 못 쓴 이유를 둘로 나눈다 — `FORECAST_OUT_OF_RANGE`(정상, 기다릴 일)와
  `FORECAST_UNAVAILABLE`(장애, 다시 시도할 일). 사용자에게 할 말이 다르다.
- **적합도와 산책 위험도를 합치지 않는다.** 전자는 "여기 갈 만한가"(하루 단위),
  후자는 "지금 걸어도 되는가"(시각 단위)를 묻는다. 합치면 둘 중 하나가 반드시 희석된다.
- 노면온도는 **추정치**다. 응답 필드명(`estimatedPavementCelsius`)과 문구 모두 단정을 피한다.
- 반려견 조건은 사본을 두지 않고 요청 파라미터로 받는다. 이유는
  `weather-insight-integration.md` §7 참고.
- 임계값은 `InsightProperties`(`insight.*`)로 빼 둔다. 확정된 수의학 기준이 아니라
  현재의 판단이므로 배포 없이 조정할 수 있어야 한다.
