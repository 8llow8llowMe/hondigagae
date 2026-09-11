# Batch Service

## 책임

외부 공공 데이터 수집·대량 적재. 서비스들이 조회하는 장소/코스/혼잡도 DB의 원천 파이프라인.

## 배치 잡

| 잡 | 원천 | 주기(안) | 비고 |
|-----|------|----------|------|
| `placeDataPipelineJob` | (자식 잡 5개) | 주 1회 + 수동 | 장소 적재 5단계를 순서대로 잇는 flow job (#377). 수동 실행은 이 한 줄이면 된다 |
| `placeImportJob` | 국문 관광정보 GW API (TourAPI) | 주 1회 + 수동 | 관광지/음식점/숙박 마스터 + 추가 이미지(detailImage2) + 운영시간(detailIntro2, 실행당 상한) |
| `cultureFacilityImportJob` | 문화정보원 문화시설 (CSV 파일데이터) | 월 1회 | 문화시설 + 긴급 시설. 포털에서 직접 내려받고 갱신됐을 때만 적재 (#379) |
| `petRestaurantImportJob` | 식약처 반려동물 동반출입 음식점 (xlsx) | 주 1회 | 좌표는 VWorld 지오코딩으로 채운다 |
| `placeMergeJob` | (DB) | 적재 뒤 1회 | 원천이 다른 같은 장소를 `merged_into_id` 로 묶는다 (#363) |
| `placeImageBackfillJob` | TourAPI 키워드 검색 | 적재 뒤 1회 | 이미지 없는 문화정보원·식약처 장소에 대표 이미지를 빌려 채운다 |
| `congestionImportJob` | 관광지 집중률 방문자 추이 예측 API | 일 1회 | 30일 rolling. **주기가 달라 파이프라인에 넣지 않는다** |
| `olleCourseImportJob` | 제주올레 공공 CSV + TourAPI 좌표 | 주 1회 + 수동 | 산책 코스 마스터 (#383). 포털에서 내려받고 갱신됐을 때만 적재 (#441). 장소 파이프라인과 별개다 |

## 스케줄 (#378)

주기 실행은 **batch-service 프로세스 안 Quartz** 가 맡는다
(`domainlayer/schedule/adapter/in/scheduler`). 배포 호스트 cron 을 쓰지 않은 이유는 컨테이너가
`restart: unless-stopped` 로 상시 떠 있어서다 — 스케줄이 저장소 밖 crontab 이 아니라 배포 단위와
함께 움직인다.

| 무엇 | 언제 |
| --- | --- |
| `placeDataPipelineJob` | 월 03:00 KST (`0 0 3 ? * MON`) |
| `olleCourseImportJob` | 월 05:00 KST (`0 0 5 ? * MON`) |
| `congestionImportJob` | 매일 06:00 KST (`0 0 6 * * ?`) |

- **스위치**: `batch.schedule.enabled` (`BATCH_SCHEDULE_ENABLED`). dev 기본 true, local·CI·prod 기본 false.
  조건은 `batch.schedule.enabled=true` **그리고** `spring.batch.job.enabled=false` 둘 다라,
  `docker exec` 로 잡 하나만 돌리려 띄운 **수동 JVM 에서는 트리거가 등록되지 않고 스케줄러도
  시작되지 않는다.** `auto-startup` 은 `application.yml` 에서 고정 false 이고, 조건을 통과한
  컨텍스트의 `SchedulerFactoryBeanCustomizer` 만 그것을 true 로 되돌린다.
- **조건은 SpEL 이 아니라 `@ConditionalOnProperty` 조합**(`ScheduleEnabledCondition`)이다.
  `@ConditionalOnExpression` 은 치환된 값을 문자열로 파싱하므로 값이 불리언 리터럴이 아니면
  (빈 문자열·`yes`·`1`) 컨텍스트 refresh 가 깨져 컨테이너가 crash-loop 에 빠진다. compose 의
  `${VAR:-}` 는 변수를 부재가 아니라 **빈 문자열**로 만들기 때문에 실제로 밟을 수 있는 길이었다.
  지금은 **`true` 가 아닌 값이 전부 꺼짐**으로 떨어진다.
- **잡 스토어는 메모리**다. 인스턴스가 하나고 트리거가 코드에 있어 영속할 상태가 없다 —
  tour 스키마에 `QRTZ_*` 테이블을 더하지 않는다. Quartz 스레드는 1개라 두 잡이 동시에 돌지 않는다
  (JobKey 가 달라 `@DisallowConcurrentExecution` 만으로는 안 막힌다). 그리고 **데몬 스레드**다 —
  `SchedulerFactoryBean` 은 auto-startup 과 무관하게 스레드를 만들므로, non-daemon 이면
  `--spring.main.web-application-type=none` 수동 실행 JVM 이 잡을 끝내고도 죽지 않는다.
- **실행 중 가드**: 겹치면 안 되는 잡이 돌고 있으면 이번 주기를 건너뛴다. 장소 파이프라인과 혼잡도는
  place 를 건드리는 잡 7개 전부(파이프라인·자식 다섯·혼잡도)를 본다 — 자식 잡 하나만 단독으로 수동
  실행 중이어도 장소가 반쯤 들어온 상태라 혼잡도가 UNMATCHED 를 대량으로 남기기 때문이다. 올레는
  `walk_course` 만 건드리므로 자기 자신만 본다. 판정 근거는 Quartz 가 아니라 **배치 메타데이터**다 —
  수동 JVM 의 실행은 Quartz 가 모른다. 단 6시간을 넘긴 STARTED 는 죽은 JVM 의 잔재로 보고 무시한다.
  방치된 행 하나에 스케줄이 영원히 막히는 쪽이 더 나쁘다.
- **수동 실행과의 관계**: 겹쳐도 스케줄 쪽이 양보한다(`schedule fire skipped ...` WARN). 반대는
  막지 않으므로 수동 실행은 스케줄 창을 피하는 편이 낫다. 수동 실행 명령은
  `jenkins-cicd-dev-deploy-guide.md` §8.
- `runAt` 은 발화 시각을 `Asia/Seoul` 초 단위로 자른 `2026-09-14T03:00:00` 꼴이다. 시간대를 트리거가
  직접 못박는다 — `-Duser.timezone` 은 배포 환경변수(`TIME_ZONE`)라 그 값으로 03:00 이 흔들린다.
- 발화는 `batch_schedule_fire_total{job,result}` / `batch_schedule_last_fire_timestamp{job}` 로
  드러난다 (`observability-guide.md`).

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
  나눈다 — `tourapi` / `tats` / `vworld` / `mfds` / `datagokr`.
  배치라 사용자 응답이 없는데도 거는 이유는 호출량이다. 원천이 죽으면 수천 건을 타임아웃까지
  기다리며 두드려 쿼터만 태우고 잡 시간이 몇 시간씩 늘어진다. 빨리 포기하는 것이 값어치다.
  서킷은 **전송 호출만** 감싼다 — 응답 해석 실패나 키 누락은 그 밖에서 도메인 예외로 변환된다.
- **문화정보원은 포털에서 내려받고 갱신 감지 후에만 적재한다** (#379). 상세 페이지의 JSON-LD 에서
  파일 주소를 찾아 임시 디렉터리로 스트리밍하고, `atchFileId` 와 바이트 수를
  `import_source_snapshot` 의 직전 행과 비교해 같으면 적재를 통째로 건너뛴다. 건너뛴 실행도
  `last_success` 를 갱신한다 — 원천을 확인해 최신임을 안 것이라 성공이다.
  **`/app/data` 는 이제 우회용이다.** 읽기 전용 볼륨이라 내려받은 파일을 거기에 쓸 수 없고,
  포털이 막혔을 때만 그 파일로 물러난다(그때는 스냅샷을 남기지 않는다).
  스냅샷 DDL 은 `resources/db/import-source-snapshot-mysql.sql` 하나가 정본이고 prod 는 런북 적용이다.
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

- **기본은 포털에서 직접 내려받는다** (#441). `atchFileId` 와 바이트 수가 직전과 같으면
  받지도 적재하지도 않는다. `forceImport=true` 면 같은 파일도 다시 적재한다
- 포털이 막히면 `OLLE_COURSE_CSV_PATH`(기본 `data/olle_course.csv`) 우회 파일로 물러난다.
  **원본이 CP949 라도 어댑터가 판별해 읽는다** — UTF-8 엄격 디코딩 실패 시 MS949 로 되읽는다
- 우회 적재는 스냅샷을 남기지 않는다. 남기면 다음 실행이 포털을 보지 않고 건너뛴다
- `walk_course` 스키마 원천은 tour-service 의 `WalkCourseEntity` 다 — 로컬에서는 tour-service 를
  먼저 한 번 기동해 테이블을 만든다 (place 와 같은 소유 구조)
- id 는 코스키에서 결정적으로 나와(`OlleCourseParser.walkCourseId`) 재실행이 멱등하다.
  TourAPI 호출은 **잡 전체에서 1건**(searchKeyword2 한 페이지)이라 쿼터 부담이 없다

## placeImportJob (TourAPI 장소 적재)

```bash
./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=placeImportJob areaCode=39 runAt=<ISO 시각>"
```

목록 적재(`placeImportStep`) 뒤에 **장소당 1회 상세 호출**을 도는 단계 둘이 이어진다. 둘 다
`place` 테이블의 TourAPI 원천 행이 대상 목록이라 목록 적재 뒤에 와야 한다. **둘의 순서는 곧
예산 우선순위다** — 하루 한도가 하나뿐이라 먼저 도는 쪽이 예산을 갖는다.

1. **운영시간(`placeIntroImportStep`, #361)** — detailIntro2 를 불러 place_intro 를 upsert 하고
   `weekly_hours_spec`·`open24` 를 함께 구조화한다. 장소 상세의 `intro.openNow` 가 이 값으로
   판정된다. 운영시간 필드가 없는 숙박(32)·여행코스(25)·축제(15)는 호출하지 않는다.
   커버리지는 적재 로그의 `withWeeklyHoursSpec`·`open24` 로 본다
   (`place-data-integration.md` §10-3). **아직 없는 데이터라 예산을 먼저 쓴다**
2. **추가 이미지(`placeImageImportStep`)** — detailImage2 를 장소당 1회 불러 place_image 를
   교체(멱등)한다. 문화정보원·식약처 원천은 추가 이미지 API 가 없어 대상에서 빠지며, 그 장소들의
   상세 갤러리는 tour-service 의 대표 이미지 폴백이 담당한다. 이미 적재돼 있고 매 실행 전량을
   다시 받는 쓰임이라, **한도에 닿으면 남은 장소를 건너뛰고 조용히 끝낸다** — 기존 행이 그대로
   남으므로 잃는 것은 이번 주 갱신뿐이다

**쿼터가 이 잡의 제약이다.** 개발계정은 일 1,000건인데 목록(약 17콜) + 이미지 전량(제주 964콜)만
으로 이미 한도다. 운영시간 단계는 그래서 실행당 상한(`place-intro-import.max-calls-per-run`,
기본 300)을 두고 **intro 가 없는 곳 먼저 → `place_intro.synced_at` 오래된 순 → id** 로 고르며,
순서상 예산을 먼저 받는다. 남은 몫(약 680)으로 이미지 단계가 돌다가 한도에 닿는다 — 매 실행
이미지 전량까지 갱신해야 하면 이미지 대상 쿼리에도 같은 증분 규칙이 필요하다
(`place-data-integration.md` §5).

서킷 오픈·키 누락·**일일 한도 초과**는 한 곳 실패로 넘기지 않고 단계를 즉시 끝낸다. 한도 초과는
포털이 HTTP 200 + 오류 본문으로 답해 서킷이 세지 못하므로 응답 코드로 따로 구분한다
(`TOUR_API_QUOTA_EXCEEDED`) — 구분하지 않으면 남은 대상 전부가 "실패"로 기록되며 순환에서
뒤로 밀려 다음 실행에서도 비어 있다.

`placeImageBackfillJob` (독립 실행) — 문화정보원·식약처 원천에는 이미지 필드 자체가 없어,
같은 장소가 TourAPI 에 있으면 키워드 검색으로 대표 이미지를 빌려 채운다. **정규화 제목 일치 +
좌표 500m** 이중 검증을 통과한 곳만 채우며(틀린 이미지 > 없는 이미지), 못 채운 곳은 화면
placeholder 가 담당한다. culture/petRestaurant 적재 이후에 돌려야 하고 재실행은 멱등이다.

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
