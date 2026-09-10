# 장소 데이터 최신화 가이드

> 장소 데이터가 낡으면 서비스가 거짓말을 한다. 없어진 식당으로 안내하고, 문 닫은 병원을
> 응급 상황에 추천한다. 무엇을 얼마나 자주, 어떻게 갱신할지 정한 문서다.
> 소스별 성격은 `place-data-integration.md`, 배치 실행은 `deploy-guide.md` 참고.

## 1. 소스별 갱신 성격

| 소스 | 변경 속도 | 자동 수집 | 폐업·해제 발생 | 주기 |
| --- | --- | --- | --- | --- |
| 식약처 동반출입 음식점 | **빠름** — 제도 시행 5개월에 전국 2,610곳 | 가능 (POST) | **있음** (등록 철회) | **주 1회** |
| 관광정보 GW (TourAPI) | 느림 | 가능 (API) | 있음 | 주 1회 |
| 문화정보원 문화시설 | 느림 (파일 부정기 갱신) | **불가 — 수동 다운로드** | 있음 | 월 1회 점검 |
| VWorld 지오코더 | — | 배치 중 호출 | — | — |

갱신 설계를 가르는 것은 **변경 속도가 아니라 자동화 가능 여부**다. 식약처는 가장 빨리 변하는데
자동 수집이 되고, 문화정보원은 천천히 변하는데 사람이 파일을 받아야 한다.

### 문화정보원 파일이 갱신됐는지 아는 법

포털 상세 페이지를 긁지 않는다. CSV 안에 `최종작성일` 컬럼이 있으므로 **적재 시 그 최대값을
기록해 두고, 다음 파일의 최대값과 비교**하면 새 파일인지 알 수 있다. 같으면 적재를 건너뛴다.

## 2. 사라진 것을 지우지 못하던 결함 — 해소됨

**(구현 완료)** 아래 설계대로 들어갔다. `DelistProcessor` + `DelistGuard`, 파사드 세 곳 연결.

한때 모든 적재가 upsert 뿐이라 DELETE 가 없었다.

식약처에서 등록을 철회한 식당, 문화정보원 파일에서 빠진 시설은 한 번 들어오면 **영원히 남는다.**
`place`에 `synced_at`은 있지만 그 값을 읽어 판단하는 코드가 없다. 조회에서 제외하는 장치도
`merged_into_id`(중복 병합) 하나뿐이라 이 경우를 덮지 못한다.

등록 철회가 실제로 일어나는 원천이라 방치할 수 없다. 폐업한 식당을 "동반 가능 확인됨"으로
안내하는 것은 검증되지 않은 후보를 보여주는 것보다 나쁘다.

### 해법: `synced_at` 기반 delisting

```
1. 배치 시작 시각을 runStartedAt 으로 고정한다
2. 이번 원천에 있던 행만 synced_at = runStartedAt 으로 upsert 한다
3. 실행 후: source = ? AND synced_at < runStartedAt  →  이번 원천에서 사라진 행
4. 그 행에 delisted_at 을 찍는다. 조회는 delisted_at IS NULL 만 본다
```

**DELETE 하지 않고 표시만 하는 이유가 셋이다.**

- 사용자의 일정(`plan_item`)이 그 장소를 참조하고 있다. 지우면 남의 여행 계획이 깨진다
- 원천의 일시적 오류로 대량 소실될 수 있다. 되돌릴 수 있어야 한다
- 다시 등록되는 경우가 있다. `delisted_at`을 NULL 로 되돌리면 그만이다

### 안전장치: 급감 가드 (필수)

**delisting 은 잘못 돌면 데이터를 통째로 날린다.** 식약처 다운로드 경로는 비공식이라
빈 파일이나 오류 페이지가 올 수 있고, 그대로 delisting 을 돌리면 102곳이 전부 사라진다.

```
이번 실행 건수 < 직전 성공 실행 건수 × 0.7  →  delisting 을 건너뛰고 경고 로그
```

임계치 30%는 원천 특성에 맞춘 값이다. 식약처는 등록이 늘기만 하는 국면이라 감소 자체가
이상 신호고, 문화정보원은 파일이 통째로 바뀌므로 소폭 감소는 정상이다. 원천별로 따로 둔다.

또 하나 — **원천을 못 읽으면 delisting 을 아예 시작하지 않는다.** 적재 0건과 "원천이 빈 목록"은
구분해야 한다. 전자는 실패이고 후자만 delisting 대상이다.

## 3. 지오코딩 재호출 최소화

지금은 실행할 때마다 102건을 전부 다시 지오코딩한다. VWorld 한도가 하루 40,000건이라
지금은 문제가 없지만, 전국 2,610곳으로 넓히면 매주 2,610번을 헛되이 부른다.

**주소가 바뀌지 않은 행은 건너뛴다.** `source_key`는 시설명+주소 해시이므로 주소가 바뀌면
`source_key`도 바뀐다. 즉 **이미 좌표를 가진 `source_key`가 DB 에 있으면 그 좌표를 재사용**하면
된다. 새 `source_key`만 지오코딩한다.

주소 변경 없이 이전한 업소는 옛 좌표를 유지하게 되는데, 그런 경우는 이름·주소 중 하나가
바뀌므로 새 행으로 들어온다. 실질적 문제가 되지 않는다.

## 4. 갱신 주기와 실행

**스케줄러가 직접 부르는 잡은 둘뿐이다.**

| 잡 | 주기 | 실행 시각 | 근거 |
| --- | --- | --- | --- |
| `placeDataPipelineJob` | 주 1회 | **월 03:00 KST** | 적재 3종 → 병합 → 이미지 백필을 순서대로 잇는다(#377). 새벽이라 공공 API 쿼터 경쟁이 적다 |
| `congestionImportJob` | 일 1회 | **매일 06:00 KST** | 30일 rolling 원천. 주기가 달라 파이프라인 밖에 있다. 파이프라인이 길어져도 겹치지 않게 떨어뜨렸다 |

파이프라인 안 자식 잡들의 주기는 부모를 따른다. 단독 실행할 때 참고할 성격만 적는다.

| 자식 잡 | 성격 |
| --- | --- |
| `placeImportJob` | TourAPI. 변경이 느리고 쿼터 여유가 있다 |
| `cultureFacilityImportJob` | 파일 갱신 확인 후 조건부 적재. 원천 파일 자체는 월 1회쯤 바뀐다 |
| `petRestaurantImportJob` | 등록이 계속 느는 원천이라 가장 자주 갱신할 값어치가 있다 |
| `placeMergeJob` | 모든 원천이 들어온 상태에서 한 번 판정 (#363) |
| `placeImageBackfillJob` | 흡수된 행은 대상에서 빠지므로 병합 뒤가 맞다 |

순서가 중요하다. **중복 병합은 모든 적재가 끝난 뒤 한 번만 돌아야 한다.** 병합은
`placeMergeJob` 으로 독립됐다(#363) — 예전처럼 각 적재 파사드가 자기 적재 뒤에 부르면
아직 다른 원천이 들어오지 않은 중간 상태를 기준으로 판정한다. **적재 잡을 단독으로 돌렸으면
이 잡을 이어 돌린다.** 그러지 않으면 중복이 목록에 그대로 남는다.

이 순서는 이제 `placeDataPipelineJob` 이 코드로 보장한다(#377) — 적재 3종 → 병합 → 이미지 백필을
한 flow job 으로 이어 붙였으므로 사람이 다섯 줄을 차례로 치다 한 줄을 빠뜨릴 여지가 없다.
주기가 다른 `congestionImportJob` 만 파이프라인 밖에 남아 따로 돈다.

`olleCourseImportJob`(#383)은 이 표에 없다. 적재 대상이 `place` 가 아니라 `walk_course` 테이블이라
장소 파이프라인·병합·delisting 어디에도 걸리지 않고, 아직 스케줄 없이 수동으로만 돈다.

### 스케줄러 — batch-service 프로세스 안 Quartz (#378)

주기 실행은 배포 호스트 cron 이 아니라 **batch-service 프로세스 안 Quartz** 가 맡는다
(`domainlayer/schedule/adapter/in/scheduler`). 컨테이너가 `restart: unless-stopped` 로 상시 떠
있으므로, 그 프로세스가 스스로 시각을 지키면 스케줄이 배포 단위와 함께 움직인다 — 어느 호스트의
crontab 에 무엇이 걸려 있는지가 저장소 밖에 흩어지지 않고, 컨테이너를 옮겨도 따라간다.

| 항목 | 값 |
| --- | --- |
| `placeDataPipelineJob` | `0 0 3 ? * MON` — 월 03:00 KST |
| `congestionImportJob` | `0 0 6 * * ?` — 매일 06:00 KST |
| 스위치 | `batch.schedule.enabled` (`BATCH_SCHEDULE_ENABLED`). **dev 기본 true, local·CI·prod 기본 false** |
| 잡 스토어 | 메모리. 인스턴스가 하나고 트리거가 코드에 있어 영속할 상태가 없다 — tour 스키마에 `QRTZ_*` 를 더하지 않는다 |
| 스레드 | 1개. 파이프라인과 혼잡도가 절대 동시에 돌지 않는다 (JobKey 가 달라 `@DisallowConcurrentExecution` 만으로는 안 막힌다). **전부 데몬**이다 — `SchedulerFactoryBean` 은 auto-startup 과 무관하게 스레드를 만들어서, non-daemon 이면 수동 실행 JVM 이 잡을 끝내고도 죽지 않는다 |
| misfire | `FireAndProceed`. 재기동으로 발화를 놓쳤으면 늦게라도 한 번 돌고 다음 주기로 간다 — 주 1회 잡을 건너뛰면 데이터가 한 주 더 낡는다 |

**수동 실행 JVM 에서는 트리거가 등록되지 않고 스케줄러도 시작되지 않는다.** 조건은
`batch.schedule.enabled=true` **그리고** `spring.batch.job.enabled=false` 둘 다이고, `docker exec` 로
잡 하나만 돌리려 띄운 두 번째 JVM 은 후자가 true 라 걸린다. 스케줄러 시작(`auto-startup`)도 같은
조건에 묶여 있다 — `application.yml` 은 고정 false 이고, 조건을 통과한 컨텍스트에서만
`SchedulerFactoryBeanCustomizer` 가 true 로 되돌린다.

판정은 SpEL(`@ConditionalOnExpression`)이 아니라 `@ConditionalOnProperty` 조합
(`ScheduleEnabledCondition`)이다. SpEL 조건식은 값을 치환한 **문자열을 파싱**하므로 값이 불리언
리터럴이 아니면(빈 문자열·`yes`·`1`) 기동 자체가 죽는다. compose 의 `${VAR:-}` 는 변수를 부재가
아니라 **빈 문자열**로 만들기 때문에 이것은 가상의 사고가 아니다. 그래서 compose 는 dev/prod
서비스별로 `BATCH_SCHEDULE_ENABLED` 에 실제 값(`true`/`false`)을 준다. **`true` 가 아닌 값은 전부
꺼짐**으로 본다 — 스위치 오타로 배치 컨테이너가 crash-loop 에 빠지는 것보다 낫다.

**실행 중 가드.** 발화 시각에 겹치면 안 되는 잡이 돌고 있으면 이번 주기를 건너뛰고
`schedule fire skipped ...` 를 WARN 으로 남긴다. 판정 근거는 Quartz 상태가 아니라 **배치 메타데이터**다
— 수동으로 띄운 두 번째 JVM 의 실행은 Quartz 가 모르기 때문이다. 두 스케줄 모두 **place 를 건드리는
잡 7개 전부**(파이프라인·자식 다섯·혼잡도)를 본다. 혼잡도까지 같은 목록인 이유는, 사람이 자식 잡
하나만 단독으로 돌리는 중에도 장소가 반쯤 들어온 상태가 되어 혼잡도가 UNMATCHED 를 대량으로
남기기 때문이다.
단 **6시간을 넘긴 STARTED 실행은 무시한다.** OOM 으로 죽은 JVM 이 남긴 행 하나에 스케줄이 영원히
막히는 쪽이 더 나쁘다 — 대신 `abandoned running execution ignored ...` 를 ERROR 로 남겨 사람이
그 행을 정리하게 한다.

**`runAt`.** 발화 시각을 `Asia/Seoul` 초 단위로 자른 `2026-09-14T03:00:00` 꼴을 잡의 증분
JobParameter 로 넘긴다. 시간대를 트리거가 직접 못박는 이유는 `-Duser.timezone` 이 배포 환경변수
(`TIME_ZONE`)라 그 값 하나로 03:00 이 다른 나라 새벽이 될 수 있기 때문이다.

발화 자체는 `batch_schedule_fire_total{job,result}` 와
`batch_schedule_last_fire_timestamp{job}` 로 드러난다 (`observability-guide.md`).

## 5. 실패했을 때

원천 하나가 실패해도 나머지는 계속 간다. 잡이 분리돼 있고 재실행이 멱등이라 가능하다.

| 실패 | 동작 | 사용자 영향 |
| --- | --- | --- |
| 식약처 경로 404 | 잡 실패, 기존 데이터 유지, delisting 없음 | 없음 (데이터가 낡을 뿐) |
| VWorld 키 만료 | 잡 실패 (`GEOCODING_KEY_MISSING`) | 없음 |
| 일부 주소 지오코딩 실패 | 그 행만 제외하고 계속. 건수·업소명 로그 | 몇 곳이 빠짐 |
| 문화정보원 파일 없음 | 잡 실패 (`CULTURE_CSV_NOT_FOUND`) | 없음 |

공통 원칙은 **낡은 데이터가 빈 데이터보다 낫다**는 것이다. 실패 시 기존 값을 지우지 않는다.

## 6. 갱신 상태를 드러내기

배치가 조용히 실패하면 아무도 모른 채 데이터가 몇 주씩 낡는다. 두 곳에서 드러낸다.

**로그·메트릭** (`observability-guide.md` 연계)

```
place_import_rows{source="MFDS", result="upserted|delisted|geocode_failed"}
place_import_last_success_timestamp{source="MFDS"}
```

`last_success_timestamp`가 기준 주기의 2배를 넘으면 경보. 실패 알림보다 이쪽이 중요하다 —
잡이 아예 안 돌기 시작한 경우는 실패 로그조차 남지 않는다.

**API 응답**

장소 상세 응답에 `syncedAt`을 실어 "이 정보는 언제 기준"인지 화면이 보여줄 수 있게 한다.
운영시간처럼 자주 바뀌는 값은 특히 필요하다.

## 7. 작업 순서

1. ~~`place` / `emergency_facility` 에 `delisted_at` 추가, 조회에서 제외~~ — 완료.
   상세 조회만 예외로 계속 응답한다(기존 일정 보호), 응답에 `delisted` 플래그
2. ~~적재 잡에 `runStartedAt` 기반 delisting 스텝 + 급감 가드~~ — 완료.
   TourAPI 는 부분 실행(contentType 지정) 시 delist 를 건너뛴다
3. 지오코딩 재사용 (`source_key`로 기존 좌표 조회)
4. ~~병합을 독립 잡으로 분리~~ — 완료(#363). `placeMergeJob` 을 적재 잡들 뒤에 이어 돌린다
5. ~~스케줄 등록 (cron 또는 scheduler 어댑터)~~ — 완료(#378, 프로세스 안 Quartz).
   dev 만 켜져 있다. prod 전환은 dev 관찰 뒤 결정
6. ~~배치 메트릭 노출~~ — 완료 (`observability-guide.md` 배치 지표 절).
   `last_success` 경보 등록은 Prometheus rule 작업으로 남아 있다

1~2 가 없으면 데이터가 한 방향으로만 늘어난다. 나머지보다 먼저 해야 한다.
