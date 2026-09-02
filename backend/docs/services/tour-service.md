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
- `GET /api/v1/emergencies/facilities/{facilityId}` — 긴급 시설 상세.
  내려간(delisted) 시설은 404 다 — 목록에 없는 곳을 상세로만 볼 수 있으면 폐업한 병원 주소를 들고 찾아가게 된다
- `GET /api/v1/insights/regional-weather?date=` — 제주 권역(5곳) 날씨 비교 + "나가기 좋은 권역" 추천.
  한라산이 섬을 기후로 갈라 놓아 성립하는 비교다. 권역마다 **대표 격자 하나**만 봐서 기존 격자 캐시에 얹힌다.
  예보를 못 받은 권역도 `weatherScore = null` 로 목록에 남는다
- `GET /api/v1/insights/walk-times?lat=&lng=` — 오늘 남은 시간의 산책 안전 곡선 + 골든타임.
  `goldenStart` 가 null 이면 남은 시간이 전부 위험이거나 특보 경보 중이다 —
  아무 구간이나 주면 사용자가 허락으로 읽는다
- `GET /api/v1/places/{placeId}/congestions?fromDate=&days=` — 기간 혼잡도.
  "이번 주 언제 덜 붐비나"에 답한다. 혼잡도 예측은 30일 rolling 이라 예보(약 11일)보다 멀리 간다 —
  적합도로는 근거가 없는 날짜도 붐빔 정도는 알 수 있다.
  **데이터가 없는 날짜도 UNKNOWN 으로 목록에 남긴다** — 빠뜨리면 날짜 축에 구멍이 생겨 사용자가 그 날을 한산한 날로 읽는다
- `GET /internal/v1/places/visible-ids?placeIds=` — (내부 전용) 일정 항목 검증용 벌크 존재 확인.
  게이트웨이가 라우팅하지 않으며, delisted 를 제외해 새 일정 항목이 사라진 장소를 참조하지 못하게 한다
- `GET /internal/v1/places/candidates?placeIds=` — (내부 전용) 아이디로 후보 요약 조회.
  ai-service 의 필수 포함 장소를 프롬프트 후보에 합칠 때 쓴다. enum 은 표시명으로 변환해 준다
- `GET /internal/v1/weather/daily?areaCode=` — (내부 전용) 제주 대표 지점의 일자별 예보(단기+중기, 약 11일).
  ai-service 가 일정 생성·준비물 프롬프트에 싣는다. 기존 격자 캐시를 타 KMA 호출이 늘지 않고, 제주(39) 외 코드는 빈 목록

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

## 필수 파라미터 누락 응답 (필수)

`@RequestParam` 필수 파라미터는 **Bean Validation 이 닿지 않는다.** 값이 아예 없을 때뿐
아니라 `?lat=` 처럼 비어 온 경우도 스프링이 변환 후 `MissingServletRequestParameterException`
을 던지므로, 파라미터에 `@NotNull` 을 붙여 둬도 실행되지 않는다.
`NearbyFacilityParameterValidationTest` 가 이 동작을 고정한다.

그래서 검증 애노테이션이 아니라 **advice 에서 받는다.** 핸들러가 없으면 스프링 기본 응답이
나가 `dataHeader` 봉투 밖 형태가 되고, 모든 오류를 같은 봉투로 받는다고 전제하는 클라이언트의
파싱이 깨진다. 코드는 각 도메인 1xx 대역 끝의 `{DOMAIN}_114` 다.

## 기상특보 (필수)

발효 중인 특보는 `suitability` / `walk-safety` / `walk-times` 응답의 `weatherWarning`
**옵셔널 필드**로 나간다. 기존 클라이언트는 모르는 필드를 무시하므로 계약이 깨지지 않는다.

**경보는 감점이 아니라 0점이다.** 감점으로 다루면 다른 조건이 좋을 때 상쇄되어
태풍경보에 "여행 적합 82점"이 나간다. 경보는 기상청이 "나가지 말라"고 말하는 단계라 정도의
문제가 아니다. 다만 등급은 `INSUFFICIENT` 가 아니라 `LOW` 다 — 그것은 "판단 근거가 없다"는
뜻인데 지금은 근거가 있고, 나쁘다고 말하고 있다. 주의보는 큰 감점(45)이다.

산책 위험도에서는 **경보를 예보보다 먼저 본다.** 시각별 예보가 없어도 태풍경보에
"판단 근거 부족"을 돌려주면 안 된다. 주의보는 최소 `CAUTION` 이다.

### 활용신청이 별개다 (2026-09-01 확인)

기상특보 조회서비스(`WthrWrnInfoService`)는 단기·중기예보와 **따로 신청**해야 한다.
같은 키로 단기예보는 정상인데 특보만 `SERVICE_KEY_IS_NOT_REGISTERED` 가 온다.

- 서킷을 `kma` 와 나눠 `kma-warning` 으로 둔다. 공유하면 승인 안 된 이 API 의 연속 실패가
  예보 서킷을 열어 이미 잘 도는 기능 둘을 끌어내린다
- 기본값은 `KMA_WARNING_ENABLED=false`. 켜 두면 10분마다 실패 로그만 쌓인다
- **응답 규격을 확인하지 못했다.** 필드명에 기대지 않고 문구에서 종류·단계를 뽑는다.
  승인 후 재확인할 항목은 `KmaWeatherWarningAdapter` 주석의 목록을 따른다

캐시는 예보와 다르다. 발효/해제가 예고 없이 일어나 발표 주기에 맞출 수 없으므로 **짧은 고정
TTL(10분)** 을 쓰고 **스테일 폴백을 두지 않는다** — 이미 해제된 태풍경보를 계속 보여 주면
사용자가 멀쩡한 날 일정을 취소한다.

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
