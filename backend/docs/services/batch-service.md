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
