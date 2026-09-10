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
- `walkcourse` — 제주올레 코스 (조회 구현). **두루누비를 쓰지 않는다** — 걷기 코스 142개가
  코리아둘레길 축이라 제주가 0개다(실호출 검증). 원천은 공공데이터포털 올레코스현황 CSV(공식
  거리·소요시간·시종점) + TourAPI 레포츠(28) 올레 항목(시작점 좌표·대표이미지) 결합이다 (#382)
- `insight` — 여행 적합도, 산책 위험도, 혼잡도, 날씨 (구현 완료, `weather-insight-integration.md`)
- `emergency` — 동물병원·동물약국 등 긴급 시설

## 주요 API (계획)

- `GET /api/v1/places` — 검색 (지역, 유형, 반려견 동반 조건, 커서 기반 `SliceResponse`)
- `GET /api/v1/places/{placeId}` — 상세 (출입 조건: 실내/실외, 크기 제한, 목줄/케이지 조건)
- `GET /api/v1/places/{placeId}/related` — 연관 관광지
- `GET /api/v1/places/{placeId}/suitability` — 여행 적합도 (`score` + `reasons`, `api-design-guide.md` §9).
  고온 규칙은 **최고기온과 하루 최고 체감온도 중 큰 값**에 반려견 기준 28/31℃ 를 건다 — 같은 기온이라도 습한 날이 더 깎인다
  (산책 위험도의 33/35℃ 는 사람 폭염특보 척도로 등급을 말하는 값이라 여기 쓰지 않는다)
- `GET /api/v1/places/{placeId}/walk-safety` — 산책 위험도 (추정 노면온도 + 기상청 여름철 체감온도 + 안전 시간대).
  체감온도는 기상청 산식으로 계산하며 폭염특보 기준(33/35℃)이 판정 임계다. NOAA 열지수는 참고로 병기하고,
  두 값 모두 계산 근거 문구(feelsLikeBasis/heatIndexBasis)를 함께 내린다
- `GET /api/v1/walk-courses` — 산책 코스 목록. `petActivityLevel` 로 반려견 활동량 필터
  (LOW 4시간·MEDIUM 6시간 이하 — `WalkCourseActivityFit` 이 상한의 단일 출처), 거리 필터·정렬.
  **좌표가 있는 코스는 `/api/v1/insights/walk-times?lat=&lng=` 로 이어진다** — 골든타임을 코스
  시작점에서 그대로 재사용하므로 "오늘 이 코스 언제 걷기 좋은가"에 신규 API 없이 답한다.
  좌표가 null 인 코스(20·18-2)는 그 동선을 만들지 않는다
- `GET /api/v1/walk-courses/{walkCourseId}` — 산책 코스 상세
- `GET /api/v1/places/nearby?lat=&lng=&radius=&contentType=&petSizeType=&petWeightKg=` — 좌표 반경 장소 검색
- `GET /api/v1/emergencies/facilities?lat=&lng=&radius=&type=&open24Only=&openNowOnly=&size=` — 긴급 시설 반경 검색.
  `size` 상한은 **250** 이다 — 제주 전역 시설이 214곳이라 반경을 최대로 넓혀도 잘리지 않는다.
  화면이 유형·24시간을 클라이언트에서 좁히며 칩마다 개수를 보여주므로 한 번에 전량을 받아야 한다.
  두 조회 모두 **`totalCount` 는 `size` 로 자르기 전 총계**다 (`api-design-guide.md` §5-1, 이슈 #285)
- `GET /api/v1/emergencies/facilities/{facilityId}` — 긴급 시설 상세.
  내려간(delisted) 시설은 404 다 — 목록에 없는 곳을 상세로만 볼 수 있으면 폐업한 병원 주소를 들고 찾아가게 된다
- `GET /api/v1/insights/regional-weather?date=` — 제주 권역(5곳) 날씨 비교 + "나가기 좋은 권역" 추천.
  **특보 경보 중에는 추천하지 않는다**(비교표는 그대로) — 적합도는 0점, 산책은 위험이라고 하는
  같은 서비스가 여기서만 나가라고 하면 안 된다.
  한라산이 섬을 기후로 갈라 놓아 성립하는 비교다. 권역마다 **대표 격자 하나**만 봐서 기존 격자 캐시에 얹힌다.
  예보를 못 받은 권역도 `weatherScore = null` 로 목록에 남는다.
  권역 항목에는 최저·최고기온과 **`maxFeelsLikeTemperature`(하루 최고 체감온도)** 가 실린다 —
  장소 상세 `weather.maxFeelsLikeTemperature` 와 같은 규칙(기상청 여름철 체감온도)이라 두 화면의 숫자가 어긋나지 않는다.
  `weatherScore` 의 고온 규칙도 적합도와 같다 — 최고기온과 체감온도 중 큰 값에 28/31℃ 라, 습한 권역은 점수가 내려간다
- `GET /api/v1/insights/walk-times?lat=&lng=` — 오늘 남은 시간의 산책 안전 곡선 + 골든타임.
  `goldenStart` 가 null 이면 남은 시간이 전부 위험이거나 특보 경보 중이다 —
  아무 구간이나 주면 사용자가 허락으로 읽는다.
  **`hourly` 가 빈 배열이어도 200 이다** — 기상청 23시 회차부터 자정까지는 오늘의 시각별 예보가
  원천에 없다(정상). 빈 이유는 `forecastCoverage` 로 가른다
  (`weather-insight-integration.md` §5-2)
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
- `GET /internal/v1/weather/warnings` — (내부 전용) 제주에 발효 중인 특보 중 **가장 무거운 한 건**. 없으면 `dataBody` 가 null 인 200.
  plan-service 여행 브리핑이 당일 일정에 붙인다. 고르는 규칙은 웹 응답 4곳과 같고(`WeatherWarning.heaviest`), 경보 판정
  `recommendationSuppressed` 를 함께 내려 소비 측이 단계 문자열로 다시 판정하지 않게 한다 (#357)

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
- **장소 목록 정렬은 `id` 오름차순이고, 그것이 곧 원천 우선순위다 (필수).** `PlaceIdFactory` 가
  TourAPI 행에는 `contentId`(제주 실측 12만~344만)를, 문화정보원·식약처 행에는 SHA-256 해시를
  2^62 이상으로 접어 주므로 **오름차순 = TourAPI 먼저**다. 사진·개요·동반 조건을 가진 쪽이
  TourAPI 행이라(dev 실측 985건 중 917건에 사진) 첫 페이지가 내용 있는 장소로 채워진다.
  - 내림차순이던 것을 #321 에서 뒤집었다. 이미지가 아예 없는 문화정보원·식약처 행부터 내려보내
    관광지·문화시설·숙박·음식점의 첫 화면이 전부 회색 일러스트였다.
  - **"최신순" 의 뜻은 없다.** 같은 원천 안에서는 적재 순서이고 시간순이 아니다. 최신순이
    필요해지면 커서를 정렬 키와 함께 다시 설계한다 — `lastPlaceId` 하나로는 표현되지 않는다.
  - 커서 조건은 정렬 방향과 함께 움직인다(`id > lastPlaceId`). 한쪽만 바꾸면 같은 페이지를
    무한히 돌려준다.
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

발효 중인 특보는 `suitability` / `walk-safety` / `walk-times` / `regional-weather` 응답의
`weatherWarning` **옵셔널 필드**로 나간다. **네 곳이 같은 말을 해야 한다** — 한 화면만
특보를 모르면 사용자는 같은 서비스에서 상반된 안내를 받는다. 기존 클라이언트는 모르는 필드를 무시하므로 계약이 깨지지 않는다.

**경보는 감점이 아니라 0점이다.** 감점으로 다루면 다른 조건이 좋을 때 상쇄되어
태풍경보에 "여행 적합 82점"이 나간다. 경보는 기상청이 "나가지 말라"고 말하는 단계라 정도의
문제가 아니다. 다만 등급은 `INSUFFICIENT` 가 아니라 `LOW` 다 — 그것은 "판단 근거가 없다"는
뜻인데 지금은 근거가 있고, 나쁘다고 말하고 있다. 주의보는 큰 감점(45)이다.

산책 위험도에서는 **경보를 예보보다 먼저 본다.** 시각별 예보가 없어도 태풍경보에
"판단 근거 부족"을 돌려주면 안 된다. 주의보는 최소 `CAUTION` 이다.

### 원천 사용법 (2026-09-01 실호출로 확정)

기상특보 조회서비스(`WthrWrnInfoService`)는 단기·중기예보와 **따로 활용신청**해야 한다.
신청 전에는 같은 키로도 `SERVICE_KEY_IS_NOT_REGISTERED` 였고 신청 후 열렸다.
승인 상태와 쿼터가 따로 움직이므로 서킷도 `kma` 와 나눠 `kma-warning` 으로 둔다.

**오퍼레이션은 `getPwnStatus`(특보 현황)다. `getWthrWrnList` 가 아니다.**
이름만 보면 후자가 맞아 보이지만 그쪽은 **통보문 이력**이라 해제분까지 한 행으로 온다.

```
[특보] 제08-108호 : 2026.08.28.10:00 / 호우주의보 해제 (*)
```

이것을 발효 중으로 읽으면 **이미 풀린 경보로 사용자의 일정을 취소시킨다.**

**`stnId` 는 응답을 필터하지 않는다.** 제주(184)와 서울(108)에 같은 전국 문구가 왔다.
지역 필터는 파라미터가 아니라 문구 해석에서 한다(`WeatherWarningStatusText`) —
빠뜨리면 전라남도 폭염주의보를 제주 특보로 읽는다.

`t6` 형식은 이렇다. 특보가 없으면 `o 없음` 한 줄이다.

```
o 폭염주의보 : 전라남도(...), 제주도(제주시서부, 서귀포시남부, ...), 광주, 대구
o 열대야주의보 : 전라남도(...), 제주도(...), 광주
```

- 발효시각은 `tmEf` 다. `tmFc` 는 발표시각이라 다를 수 있다
- 현황 조회에는 날짜 파라미터를 보내지 않는다. 구간을 주면 6일 제한(`resultCode=99`)에 걸린다
- 실측에서 **열대야주의보**가 나왔다. 밤에도 안 식는 더위라 "저녁 산책"이라는 회피 수단
  자체가 막히는 특보다 — 반려견 기준으로 폭염 못지않게 중요해서 종류로 넣었다

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
- **원문 텍스트는 뜻을 읽고 판정한다** (#231). 추가 요금 원문은 원천이 요금 없음을 "없음" 이라는 낱말로 보내므로
  `!isBlank()` 로 보면 요금 없는 장소 대부분이 3점 깎이고 "요금이 있습니다 (없음)" 이 나간다. `PetExtraFee` 가
  원문을 CHARGED(금액·유료 표현) / NONE(없음·무료·0원) / UNKNOWN(별도 문의 등)으로 읽고, **CHARGED 일 때만** 감점과
  근거를 만든다. 해석은 배치 정규화가 아니라 판정 단계에서 한다 — 원문은 장소 상세에 그대로 보여 주는 값이고,
  규칙이 바뀔 때 재적재하지 않기 위해서다.
- 임계값은 `InsightProperties`(`insight.*`)로 빼 둔다. 확정된 수의학 기준이 아니라
  현재의 판단이므로 배포 없이 조정할 수 있어야 한다.
