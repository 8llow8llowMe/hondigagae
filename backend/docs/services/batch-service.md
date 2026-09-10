# Batch Service

## 책임

외부 공공 데이터 수집·대량 적재. 서비스들이 조회하는 장소/코스/혼잡도 DB의 원천 파이프라인.

## 배치 잡

| 잡 | 원천 | 주기(안) | 비고 |
|-----|------|----------|------|
| `placeDataPipelineJob` | (자식 잡 5개) | 주 1회 + 수동 | 장소 적재 5단계를 순서대로 잇는 flow job (#377). 수동 실행은 이 한 줄이면 된다 |
| `placeImportJob` | 국문 관광정보 GW API (TourAPI) | 주 1회 + 수동 | 관광지/음식점/숙박 마스터 + 추가 이미지(detailImage2) |
| `cultureFacilityImportJob` | 문화정보원 문화시설 (CSV 파일데이터) | 월 1회 | 문화시설 + 긴급 시설. 파일은 사람이 받아 둔다 |
| `petRestaurantImportJob` | 식약처 반려동물 동반출입 음식점 (xlsx) | 주 1회 | 좌표는 VWorld 지오코딩으로 채운다 |
| `placeMergeJob` | (DB) | 적재 뒤 1회 | 원천이 다른 같은 장소를 `merged_into_id` 로 묶는다 (#363) |
| `placeImageBackfillJob` | TourAPI 키워드 검색 | 적재 뒤 1회 | 이미지 없는 문화정보원·식약처 장소에 대표 이미지를 빌려 채운다 |
| `congestionImportJob` | 관광지 집중률 방문자 추이 예측 API | 일 1회 | 30일 rolling. **주기가 달라 파이프라인에 넣지 않는다** |
| `olleCourseImportJob` | 제주올레 공공 CSV + TourAPI 좌표 | 수동 | 산책 코스 마스터 (#383). 장소 파이프라인과 별개다 |

### 계획 (미착수)

| 잡 | 원천 API | 비고 |
|-----|----------|------|
| `PetTourImportJob` | 반려동물 동반여행 API | `contentId` 기준으로 장소 마스터에 결합 |
| `RelatedPlaceImportJob` | 관광지별 연관 관광지 API | 코스 생성용 연결성 |
| `WalkCourseImportJob` | 두루누비 API | 산책·레저 코스 |
| `VisitorStatsJob` | 관광빅데이터 정보 서비스 API | 방문자 수 분석 |

## 구현 주의점

- Spring Batch 기반, 실행 파라미터 중심 운영 (지역 코드, 기준일 등).
- 모든 잡은 재실행 가능(idempotent)해야 한다. upsert 키와 `syncedAt`을 기록한다 (`external-api-guide.md` §5).
- 대량 적재는 JPA 대신 JDBC 배치(`*BulkPort`)를 우선 검토한다.
  상태 전이(delist·병합 표시)는 `*CommandPort` 를 쓴다 (`coding-conventions.md` §12-3) —
  `*BulkPort` 와 이름이 겹치면 "어느 bulk 인가"를 되묻게 된다.
- 공공 API 쿼터를 고려해 페이지 단위 호출 간격과 실패 재시도 정책을 명시한다.
- **공공 API 호출은 서킷으로 감싼다** (`coding-conventions.md` §10). 제공처 단위로 인스턴스를
  나눈다 — `tourapi` / `tats` / `vworld` / `mfds`.
  배치라 사용자 응답이 없는데도 거는 이유는 호출량이다. 원천이 죽으면 수천 건을 타임아웃까지
  기다리며 두드려 쿼터만 태우고 잡 시간이 몇 시간씩 늘어진다. 빨리 포기하는 것이 값어치다.
  서킷은 **전송 호출만** 감싼다 — 응답 해석 실패나 키 누락은 그 밖에서 도메인 예외로 변환된다.
- **적재 범위와 병합 범위는 한 값에서 나와야 한다.** 지역 코드를 상수로 박으면 다른 시도로
  잡을 돌렸을 때 그 지역을 적재해 놓고 제주만 병합하는 조용한 어긋남이 난다.
  시도 명칭 → 관광 지역코드 변환은 `RegionCodeMapping` 한곳에 있고, 매핑에 없는 지역이면
  적재를 시작하기 전에 실패시킨다.
- **병합은 독립 잡 `placeMergeJob`** 이다(#363). 적재 파사드는 병합을 부르지 않으므로 적재 잡 뒤에
  이어 돌린다. 판정 상수의 정본은 `PlaceIdentityPolicy`.
- **`placeDataPipelineJob` 은 자식이 실패해도 다음 단계로 계속 가고, 실패한 자식이 있으면 부모를
  FAILED 로 내린다**(#377). 계속 가는 쪽이 나은 이유는 다섯 잡이 모두 멱등이고 실패해도 기존 데이터를
  지우지 않기 때문이다 — 원천 하나가 죽었다고 병합·이미지 백필까지 멈추면 지난 주 데이터마저 손대지
  않은 채 남는다. 대신 실패를 숨기지 않으려고 `PipelineExitStatusListener` 가 부모 상태를 내린다.
  지역 파라미터는 이름이 잡마다 다르므로(`areaCode`/`sido`/`region`) 실행 전에
  `PipelineRegionParametersValidator` 가 세 값을 같은 areaCode 로 환산해 비교한다.
- 부분 실패가 전체 적재를 막지 않게 잡 단위로 격리한다.
- 반려동물 동반 정보가 없는 장소는 삭제하지 않고 `PetAllowanceType.UNKNOWN`으로 적재한다.

## olleCourseImportJob (제주올레 산책 코스)

```bash
./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=olleCourseImportJob"
```

공식 수치(거리·소요시간·시종점)는 공공데이터포털 [올레코스현황 CSV](https://www.data.go.kr/data/15043496/fileData.do)가,
시작점 좌표·대표이미지는 TourAPI 레포츠(28)의 올레 항목이 낸다. **CSV 가 기준 목록**이다 —
TourAPI 에만 있는 항목(하영올레 등)은 코스가 되지 않고, TourAPI 에 없는 코스(20·18-2)는
좌표 null 로 적재된다. 매칭 키(코스번호+A/B 변형)의 단일 출처는 `OlleCourseParser` 다.

- CSV 를 받아 `OLLE_COURSE_CSV_PATH`(기본 `data/olle_course.csv`)에 둔다. **원본이 CP949 라도
  어댑터가 판별해 읽는다** — UTF-8 엄격 디코딩 실패 시 MS949 로 되읽는다
- `walk_course` 스키마 원천은 tour-service 의 `WalkCourseEntity` 다 — 로컬에서는 tour-service 를
  먼저 한 번 기동해 테이블을 만든다 (place 와 같은 소유 구조)
- id 는 코스키에서 결정적으로 나와(`OlleCourseParser.walkCourseId`) 재실행이 멱등하다.
  TourAPI 호출은 **잡 전체에서 1건**(searchKeyword2 한 페이지)이라 쿼터 부담이 없다

## congestionImportJob (관광지 집중률)

```bash
./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=congestionImportJob"
```

`placeImportJob` 은 장소 적재 뒤 **추가 이미지 단계(placeImageImportStep)** 를 이어 돈다 —
TourAPI 원천 행만 대상으로 detailImage2 를 장소당 1회 불러 place_image 를 교체(멱등)한다.
문화정보원·식약처 원천은 추가 이미지 API 가 없어 대상에서 빠지며, 그 장소들의 상세 갤러리는
tour-service 의 대표 이미지 폴백이 담당한다.

`placeImageBackfillJob` (독립 실행) — 문화정보원·식약처 원천에는 이미지 필드 자체가 없어,
같은 장소가 TourAPI 에 있으면 키워드 검색으로 대표 이미지를 빌려 채운다. **정규화 제목 일치 +
좌표 500m** 이중 검증을 통과한 곳만 채우며(틀린 이미지 > 없는 이미지), 못 채운 곳은 화면
placeholder 가 담당한다. culture/petRestaurant 적재 이후에 돌려야 하고 재실행은 멱등이다.

- **`placeImportJob` 이후에 돌려야 한다.** 장소가 비어 있으면 전부 UNMATCHED 로 적재되고
  적합도 응답에서 혼잡도가 계속 빠진다.
- 30일 rolling 원천이라 **일 1회 주기 실행**이 전제다. 같은 날짜가 다시 오면 예측이 갱신된
  것이므로 upsert 로 덮어쓴다 — 의도한 동작이다.
- 이 API 는 관광 areaCode(39)가 아니라 **법정동 코드**(제주=50, 제주시=50110, 서귀포시=50130)를
  쓴다. 두 체계를 섞으면 조용히 0건이 온다 (`JejuLegalRegion` 으로 못박았다).
- **지역 단위로 실패를 격리한다.** 제주시가 실패해도 서귀포시 적재는 진행한다.
- 명칭 매칭은 `PlaceNameMatcher`(장소 병합에 쓰던 것)를 **재사용**한다. 같은 문제에 다른
  정규화 규칙을 쓰면 "같은 곳"의 뜻이 두 곳에서 갈라진다.
- 좌표로 보정할 수 없다 — **이 원천에 좌표가 없다.** 그래서 완전일치를 우선하고, 부분일치는
  후보가 정확히 하나일 때만 받는다. 여럿이면 매칭하지 않는다 — 찍어서 맞히면 이득이 작고
  틀리면 엉뚱한 장소에 혼잡도가 붙는다. 잘못 이은 혼잡도는 없는 혼잡도보다 나쁘다.
- **매칭 실패도 저장한다**(`match_type=UNMATCHED`, `place_id=NULL`). 실패를 행 없이 버리면
  커버리지가 얼마인지 아무도 모르게 되고, 수동 보정 대상 목록도 사라진다.
- 매칭률은 배치 로그로 남긴다. 커버리지가 조용히 떨어지는 것이 이 방식의 가장 큰 위험이다.
