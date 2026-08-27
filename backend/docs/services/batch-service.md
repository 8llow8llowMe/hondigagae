# Batch Service

## 책임

외부 공공 데이터 수집·대량 적재. 서비스들이 조회하는 장소/코스/혼잡도 DB의 원천 파이프라인.

## 배치 잡 (계획)

| Job | 원천 API | 주기 | 비고 |
|-----|----------|------|------|
| `PlaceImportJob` | 국문 관광정보 GW API | 주 1회 + 수동 | 관광지/음식점/숙박 마스터 |
| `PetTourImportJob` | 반려동물 동반여행 API | 주 1회 + 수동 | `contentId` 기준 장소 마스터에 결합 |
| `RelatedPlaceImportJob` | 관광지별 연관 관광지 API | 주 1회 | 코스 생성용 연결성 |
| `WalkCourseImportJob` | 두루누비 API | 주 1회 | 산책·레저 코스 |
| `CongestionForecastJob` | 관광지 집중률 방문자 추이 예측 API | 일 1회 | 혼잡도 예측 |
| `VisitorStatsJob` | 관광빅데이터 정보 서비스 API | 일 1회 | 방문자 수 분석 |

## 구현 주의점

- Spring Batch 기반, 실행 파라미터 중심 운영 (지역 코드, 기준일 등).
- 모든 잡은 재실행 가능(idempotent)해야 한다. upsert 키와 `syncedAt`을 기록한다 (`external-api-guide.md` §5).
- 대량 적재는 JPA 대신 JDBC 배치(`*BulkPort`)를 우선 검토한다.
- 공공 API 쿼터를 고려해 페이지 단위 호출 간격과 실패 재시도 정책을 명시한다.
- 부분 실패가 전체 적재를 막지 않게 잡 단위로 격리한다.
- 반려동물 동반 정보가 없는 장소는 삭제하지 않고 `PetAllowanceType.UNKNOWN`으로 적재한다.

## congestionImportJob (관광지 집중률)

```bash
./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=congestionImportJob"
```

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
