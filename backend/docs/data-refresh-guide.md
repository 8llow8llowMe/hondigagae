# 장소 데이터 최신화 가이드

> 장소 데이터가 낡으면 서비스가 거짓말을 한다. 없어진 식당으로 안내하고, 문 닫은 병원을
> 응급 상황에 추천한다. 무엇을 얼마나 자주, 어떻게 갱신할지 정한 문서다.
> 소스별 성격은 `place-data-integration.md`, 배치 실행은 `deploy-guide.md` 참고.

## 1. 소스별 갱신 성격

| 소스 | 변경 속도 | 자동 수집 | 폐업·해제 발생 | 주기 |
| --- | --- | --- | --- | --- |
| 식약처 동반출입 음식점 | **빠름** — 제도 시행 5개월에 전국 2,610곳 | 가능 (POST) | **있음** (등록 철회) | **주 1회** |
| 관광정보 GW (TourAPI) | 느림 | 가능 (API) | 있음 | 주 1회 |
| 문화정보원 문화시설 | 느림 (파일 부정기 갱신) | 가능 (포털 파일 URL, 키 불필요) | 있음 | 월 1회 점검 |
| 제주올레 코스현황 | 느림 (파일 부정기 갱신) | 가능 (포털 파일 URL, 키 불필요) | 거의 없음 | 주 1회 점검, 같으면 건너뜀 |
| VWorld 지오코더 | — | 배치 중 호출 | — | — |

장소 원천과 올레 CSV 모두 자동 수집이 된다. 갈리는 것은 **무엇을 키로 갱신을 감지하느냐**다 —
식약처와 TourAPI 는 매번 전량을 다시 받아 upsert 로 덮지만, 문화정보원·올레는 파일 하나라
"바뀌었는지"를 먼저 판정하는 편이 훨씬 싸다.

### 문화정보원 파일이 갱신됐는지 아는 법 (#379)

**포털 상세 페이지를 긁는다.** `https://www.data.go.kr/data/15111389/fileData.do` 는 서버
렌더링이고, 그 안 `<script type="application/ld+json">` 블록의 schema.org `DataDownload` 에
파일 주소가 그대로 들어 있다. 로그인도 인증키도 없이 200 으로 CSV 를 준다.

```
contentUrl = .../cmm/cmm/fileDownload.do?atchFileId=FILE_000000003214426&fileDetailSn=1&insertDataPrcus=N
```

화면 DOM 이 아니라 **구조화 메타데이터**를 읽으므로 개편에 비교적 덜 흔들린다. 그래도 공개된
오픈 API 는 아니다 — 끊길 수 있다는 전제로 실패 처리를 아래 5절에 적어 둔다.

갱신 판정 키는 `import_source_snapshot` 테이블에 남긴다.

| 키 | 쓰임 |
| --- | --- |
| `file_id` (`atchFileId`) | **주 키.** 제공기관이 새 파일을 올리면 바뀐다. 상세 페이지만 보고 알 수 있어 30MB 를 받기 전에 판정한다 |
| `content_length` | **보조 키.** 실제로 받은 바이트 수. `atchFileId` 규칙이 장기적으로 유지된다는 보장이 없어 함께 남긴다 |
| `source_modified_max` | 교차 확인용. CSV `최종작성일` 컬럼의 최대값. 사람이 "언제 판본인가"를 되짚을 때 본다 |

판정은 두 단계다. 상세 페이지에서 `atchFileId` 만 확인해 직전과 같으면 **내려받지 않고** 끝내고,
받은 뒤에는 바이트 수까지 맞춰 한 번 더 본다. 다르면 적재하고 새 스냅샷을 남긴다.

**건너뛴 실행도 `place_import_last_success_timestamp` 를 갱신한다.** 원천을 실제로 확인해
최신임을 안 것이므로 성공이다. 갱신하지 않으면 파일이 몇 달 안 바뀌는 정상 상황에서 14일 경보가
울리고, 아무 문제 없이 울리는 경보는 곧 무시당한다 (`observability-guide.md`).

파서를 고쳐 같은 파일을 다시 적재해야 하면 `forceImport=true` 를 준다.

```bash
--spring.batch.job.name=cultureFacilityImportJob sido=제주특별자치도 forceImport=true runAt=<ISO 시각>
```

스냅샷 테이블 DDL 은 `service/batch-service/src/main/resources/db/import-source-snapshot-mysql.sql`
하나가 정본이다. local·dev·test 는 `spring.sql.init` 이 기동 시 적용하고, prod 는 런북으로 사람이
적용한다 (`deploy-guide.md`).

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

**스케줄러가 직접 부르는 잡은 셋이다.**

| 잡 | 주기 | 실행 시각 | 근거 |
| --- | --- | --- | --- |
| `placeDataPipelineJob` | 주 1회 | **월 03:00 KST** | 적재 3종 → 병합 → 이미지 백필을 순서대로 잇는다(#377). 새벽이라 공공 API 쿼터 경쟁이 적다 |
| `olleCourseImportJob` | 주 1회 | **월 05:00 KST** | 제주올레 CSV 를 포털에서 받고 갱신됐을 때만 적재한다(#441). `walk_course` 테이블이라 장소 파이프라인 밖에 있다 |
| `congestionImportJob` | 일 1회 | **매일 06:00 KST** | 30일 rolling 원천. 주기가 달라 파이프라인 밖에 있다. 파이프라인이 길어져도 겹치지 않게 떨어뜨렸다 |

파이프라인 안 자식 잡들의 주기는 부모를 따른다. 단독 실행할 때 참고할 성격만 적는다.

| 자식 잡 | 성격 |
| --- | --- |
| `placeImportJob` | TourAPI. 목록은 변경이 느리지만 **장소당 상세 호출이 붙어 쿼터가 빠듯하다** — 운영시간 상한 300콜이 먼저, 남은 예산으로 이미지가 돌다 한도에서 멈춘다 (#361) |
| `cultureFacilityImportJob` | 포털에서 내려받고 갱신됐을 때만 적재(#379). 원천 파일 자체는 월 1회쯤 바뀐다 |
| `petRestaurantImportJob` | 등록이 계속 느는 원천이라 가장 자주 갱신할 값어치가 있다 |
| `placeMergeJob` | 모든 원천이 들어온 상태에서 한 번 판정 (#363) |
| `placeImageBackfillJob` | 흡수된 행은 대상에서 빠지므로 병합 뒤가 맞다 |
| `petTourImportJob` | 반려동물 동반 조건(`place_pet_info`). 쿼터가 KorService2 와 따로라 앞 단계와 다투지 않는다. 절차·확인은 §10 (#877) |

순서가 중요하다. **중복 병합은 모든 적재가 끝난 뒤 한 번만 돌아야 한다.** 병합은
`placeMergeJob` 으로 독립됐다(#363) — 예전처럼 각 적재 파사드가 자기 적재 뒤에 부르면
아직 다른 원천이 들어오지 않은 중간 상태를 기준으로 판정한다. **적재 잡을 단독으로 돌렸으면
이 잡을 이어 돌린다.** 그러지 않으면 중복이 목록에 그대로 남는다.

이 순서는 이제 `placeDataPipelineJob` 이 코드로 보장한다(#377) — 적재 3종 → 병합 → 이미지 백필을
한 flow job 으로 이어 붙였으므로 사람이 다섯 줄을 차례로 치다 한 줄을 빠뜨릴 여지가 없다.
주기가 다른 `congestionImportJob` 만 파이프라인 밖에 남아 따로 돈다.

`olleCourseImportJob`(#383, #441)은 장소 파이프라인에 넣지 않는다. 적재 대상이 `place` 가 아니라
`walk_course` 테이블이라 병합·delisting 어디에도 걸리지 않는다. 문화정보원과 같이 포털에서
CSV 를 받고 `atchFileId`+바이트 수로 갱신을 감지한다 — 다만 주소는 JSON-LD 가 아니라 다운로드 버튼
경로로 얻는다(5절 "올레 포털", #876). 스케줄만 따로 월 05:00 에 둔다.

### 스케줄러 — batch-service 프로세스 안 Quartz (#378)

주기 실행은 배포 호스트 cron 이 아니라 **batch-service 프로세스 안 Quartz** 가 맡는다
(`domainlayer/schedule/adapter/in/scheduler`). 컨테이너가 `restart: unless-stopped` 로 상시 떠
있으므로, 그 프로세스가 스스로 시각을 지키면 스케줄이 배포 단위와 함께 움직인다 — 어느 호스트의
crontab 에 무엇이 걸려 있는지가 저장소 밖에 흩어지지 않고, 컨테이너를 옮겨도 따라간다.

| 항목 | 값 |
| --- | --- |
| `placeDataPipelineJob` | `0 0 3 ? * MON` — 월 03:00 KST |
| `olleCourseImportJob` | `0 0 5 ? * MON` — 월 05:00 KST |
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
— 수동으로 띄운 두 번째 JVM 의 실행은 Quartz 가 모르기 때문이다. 장소 파이프라인과 혼잡도는
둘 다 **place 를 건드리는 잡 7개 전부**(파이프라인·자식 다섯·혼잡도)를 본다. 혼잡도까지 같은
목록인 이유는, 사람이 자식 잡 하나만 단독으로 돌리는 중에도 장소가 반쯤 들어온 상태가 되어
혼잡도가 UNMATCHED 를 대량으로 남기기 때문이다. 올레는 `walk_course` 만 건드리므로 자기 자신만
본다.
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
| 문화정보원 포털 페이지/다운로드 실패 | **로컬 우회 파일로 적재**하고 계속. `culture facility source fallback=local` WARN. 스냅샷은 남기지 않는다. 지표 `result=fallback` 으로 드러난다 | 없음 |
| 받은 파일이 CSV 가 아님 (점검 안내 HTML 등) | 위와 같음 (`CULTURE_DOWNLOAD_INVALID` → 우회) | 없음 |
| 전송이 끊겨 파일이 잘림 | `Content-Length` 와 실제 바이트 수를 대조해 거부. 위와 같이 우회 | 없음 |
| 스냅샷 테이블 조회 실패 (미생성 등) | "모른다"로 접고 그냥 내려받아 적재. `culture facility snapshot unavailable` WARN | 없음 (30MB 를 한 번 더 받을 뿐) |
| 포털도 막히고 로컬 우회 파일도 없음 | 잡 실패 (`CULTURE_CSV_NOT_FOUND`) | 없음 |
| 올레 포털 페이지·다운로드 티켓·CSV 어느 단계든 실패 (`SOURCE_PAGE_FAILED` 받기 실패 · `SOURCE_PAGE_INVALID` 버튼/티켓 이상 · `SOURCE_CIRCUIT_OPEN` · `DOWNLOAD_*`) | **로컬 우회 파일로 적재**하고 계속. `olle course source fallback=local` WARN + 완료 로그 `fallback=true`. 스냅샷은 남기지 않는다. 지표 `walk_course_import_rows{result="fallback"}` 으로 드러난다 (#876) | 없음 (데이터가 낡을 뿐) |
| 올레 포털도 막히고 로컬 우회 파일도 없음 | 잡 실패 (`CSV_NOT_FOUND`) | 없음 |

공통 원칙은 **낡은 데이터가 빈 데이터보다 낫다**는 것이다. 실패 시 기존 값을 지우지 않는다.

문화정보원 우회 적재가 **스냅샷을 남기지 않는 이유**도 같은 결이다. 우회 파일이 포털에 지금
올라와 있는 것과 같다는 보장이 없으므로, 남기면 다음 실행이 포털을 보지 않고 건너뛴다 —
포털이 되살아나도 낡은 파일에 머무는 것이 가장 나쁜 결말이다.

**다만 우회가 오래 이어지는 것은 조용한 고장이다.** 우회 적재도 행이 들어오니
`last_success` 는 갱신되고, 그러면 스크레이핑이 몇 주째 끊겨 있어도 신선도 경보가 침묵한다.
그래서 파사드가 매 실행 `place_import_rows{source="CULTURE_PORTAL",result="fallback"}` 에
1/0 을 쓴다 — 1 이면 경고다 (`observability-guide.md`).

**전송이 끊긴 파일을 걸러 내는 이유**는 스냅샷 때문이다. 30MB 중 5MB 만 받아도 스트리밍은
정상 종료로 보이고, 잘린 본문은 1MB 하한도 첫 줄 `시설명` 검사도 통과한다. 그대로 적재하면
잘린 판본이 스냅샷으로 굳고 **다음 실행부터 같은 `atchFileId` 로 영구 SKIP** 된다. 그래서
헤더 `Content-Length` 가 있으면 디스크에 쓰인 바이트 수와 정확히 같을 때만 통과시킨다.

### 올레 포털 — JSON-LD 를 버리고 다운로드 버튼 경로로 갈아탔다 (#876)

2026-09-21 dev 재적재에서 `olleCourseImportJob` 이 포털 파싱에 실패해 **로컬 우회 파일로 돌았다.**

```text
olle course source fallback=local reason=DataDownload contentUrl 없음 (jsonLdBlocks=0)
```

일시적 장애가 아니었다. 옛 어댑터는 상세 페이지의 JSON-LD `DataDownload.contentUrl` 을 읽었는데,
그 경로가 두 번 연달아 다른 이유로 막혔다.

| 실측일 | JSON-LD | 옛 어댑터 |
| --- | --- | --- |
| 2026-09-21 | 블록 **0개** (`fn_fileDataDown(...)` 버튼만 있음) | `DataDownload` 0개 → 우회 |
| 2026-09-23 | 블록 1개, `contentUrl` 도 있음. 그런데 **JSON 으로 읽히지 않는다** — 제공기관이 쓴 `description` 에 이스케이프 안 된 따옴표(`""…""`)가 들어 있다 | 블록을 통째로 건너뜀 → `DataDownload` 0개 → 우회 |

제공기관 설명 문구 한 줄에 원천이 끊기는 경로라 **버튼이 하는 요청을 그대로 따라 하도록** 바꿨다.
경로는 브라우저 스크립트(`script_fileDetail.js` · `script_cmmFunction.js`)를 읽고 실제로 불러 확정했다
(`data-api-analysis.md` 10절).

```text
GET  /data/15043496/fileData.do                  → onclick="fn_fileDataDown('15043496','uddi:…','','1','1')"
POST /tcs/dss/selectFileDataDownload.do          → {"status":true,"atchFileId":"FILE_…","fileDetailSn":"1",…}
GET  /cmm/cmm/fileDownload.do?atchFileId=…&fileDetailSn=1 → CSV (CP949)
```

**스냅샷 키는 바꾸지 않았다 — 여전히 `atchFileId` + 바이트 수다.** 티켓이 돌려주는 `atchFileId`
(`FILE_000000007665534`)가 09-23 JSON-LD `contentUrl` 에 박힌 값과 같다 — 옛 경로가 뽑던 바로 그
식별자다. `uddi:` 상세 PK 는 파일 단위가 아니라 데이터셋 상세 단위라 파일이 바뀌어도 같을 수 있어
비교 키로 부적합하다. 키가 이어지므로 기존 스냅샷(우회 적재는 스냅샷을 남기지 않으므로 **마지막 포털
적재분**)이 그대로 비교 기준으로 쓰인다.

**그래서 배포 직후 한 번은 `forceImport=true` 로 돌린다 (운영 절차).** 우회로 돌던 동안 DB 에 들어간
것은 우회 CSV 인데, 스냅샷은 그 전 포털 적재분을 가리킨다. 포털 파일이 그때와 같으면 배포 뒤 첫
실행은 `sameFileAs` 로 **곧바로 건너뛰고**(완료 로그 `skipped=true`), 우회 CSV 가 포털 판본보다
낡았다면 DB 는 포털이 살아난 뒤에도 낡은 값에 머문다 — 조용히.

```bash
--spring.batch.job.enabled=true --spring.batch.job.name=olleCourseImportJob forceImport=true runAt=<ISO 시각>
```

같은 틈은 앞으로도 생긴다 — 포털 → 우회 → 포털로 돌아온 날, 파일이 안 바뀌었으면 우회 데이터가
남는다. 근본 해결(우회 적재 뒤 스냅샷을 무효화하는 표시)은 후속 과제다. 그때까지는 우회 게이지가
1 에서 0 으로 돌아온 뒤 한 번 `forceImport=true` 로 돌리는 것을 절차로 둔다.

**우회는 이제 지표로 드러난다.** 파사드가 매 실행 `walk_course_import_rows{source="OLLE",result="fallback"}`
에 1/0 을 쓴다 (`observability-guide.md`). 문화정보원의 `place_import_rows{result="fallback"}` 과 같은
모양이지만 따로 둔다 — `place_import_rows` 는 장소 마스터 기준이다.

남는 것.

- 우회 파일(`OLLE_COURSE_CSV_PATH`, 기본 `data/olle_course.csv`)은 **저장소에 없다.** 배포 호스트의
  `BATCH_DATA_DIR` 에 사람이 둔 파일이라, 그것이 언제 판본인지 저장소만 봐서는 알 수 없다. 포털
  경로가 되살아났으니 평소에는 읽히지 않지만, 우회 게이지가 1 이 되면 그 파일이 낡았을 수 있음을 함께 의심한다.
- `check-limit.json`(다운로드 횟수 제한 → 캡차) 은 부르지 않는다. 주 1회 한 파일이라 제한에 걸릴 일이 없고,
  걸리면 `fileDownload.do` 가 CSV 가 아닌 것을 줄 텐데 그것은 첫 줄 `코스별` 검사가 거른다(→ 우회).
- 문화정보원 어댑터(`DataGoKrCultureFacilitySourceAdapter`)는 **아직 JSON-LD 경로다.** 같은 포털이라 같은
  방식으로 끊길 수 있다. 끊기면 `place_import_rows{source="CULTURE_PORTAL",result="fallback"}` 이 먼저 알려 준다.

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

## 8. 잘못 적재된 값을 되돌릴 때 — `indoor` / `outdoor` (#753)

관광 API 적재가 `indoor` / `outdoor` 에 리터럴 `false` 를 박고 있었다. 원천이 실내외를 말해 주지
않는데 "실외다"로 단정한 것이다. 코드는 고쳤지만(**모르는 값은 INSERT 컬럼에서 뺀다**)
**이미 적재된 행은 그대로 `false` 로 남아 있다.** 적재 잡이 UPDATE 절에서 이 컬럼을 건드리지
않으므로(병합이 채운 값을 지우지 않기 위해서다) **재적재해도 저절로 고쳐지지 않는다.**

### 왜 되돌려야 하나

- `place.indoor = false` 인 행은 비 오는 날 실내 대안 조회(`indoor=true` 필터)에서 **근거 없이
  배제**된다. 실제로 실내인 문화시설·쇼핑도 마찬가지다.
- 병합의 `COALESCE(survivor.indoor, absorbed.indoor)` 가 survivor 값이 NULL 이 아니라
  **영구 no-op** 이었다. 되돌려 NULL 로 두어야 문화정보원이 아는 실내외가 비로소 옮겨 온다.
- AI 일정 생성의 LLM 프롬프트가 이 값을 문장으로 싣는다 — `PlaceCandidate.indoorText()` 는
  null 을 `"실내외 정보없음"` 으로 내는데, `false` 가 박혀 있어 **모델에게 "실외"라고 말하고**
  있었다. 되돌리면 모르는 것을 모른다고 말하게 된다.

**소비처는 전부 NULL 의미로 이미 맞춰져 있었다 — 깨진 것은 쓰는 쪽 하나였다.**
tour-service 조회(`PlaceCustomRepositoryImpl.commonFilters`: *"indoor 가 null 인 장소는 어느 쪽으로도
잡히지 않는다 — 정보 없음과 실외는 다르다"*), ai-service 프롬프트(위), FE(`lib/place/indoor.ts` —
*"`false`(야외)로 단정하지도 않는다"*, #112) 가 모두 3항 논리로 쓰고 있다. **그래서 이 수정에
따라붙는 FE 변경은 없다.** 화면은 지금까지 잘못된 입력을 정직하게 렌더하고 있었을 뿐이다.

### 되돌린 뒤 달라지는 것

| 조회 | 전 | 후 |
|------|----|----|
| `indoor=true` (비 오는 날 실내 대안) | TOUR_API 장소 **전부 배제** | 병합이 실내로 채운 장소가 **들어온다** |
| `indoor=false` | TOUR_API 장소 **전부 포함**(근거 없음) | 실외로 **확인된** 장소만 |
| 필터 없음 | 변화 없음 | 변화 없음 |

`indoor=false` 결과가 줄어드는 것은 회귀가 아니라 **근거 없는 포함이 빠지는 것**이다.

### 절차

```sql
-- 1) 영향 범위를 먼저 센다 (읽기 전용)
SELECT COUNT(*) FROM place
 WHERE source = 'TOUR_API' AND (indoor IS NOT NULL OR outdoor IS NOT NULL);

-- 1-1) 이미 병합된 쌍이 있는지도 센다 — 3) 이 필요한지를 가른다 (읽기 전용)
SELECT COUNT(*) FROM place WHERE merged_into_id IS NOT NULL;

-- 2) 되돌린다
UPDATE place
   SET indoor = NULL, outdoor = NULL
 WHERE source = 'TOUR_API';

-- 3) 이미 병합된 쌍의 값을 옮긴다 ★ placeMergeJob 재실행으로는 안 된다 (아래 설명)
UPDATE place survivor
  JOIN place absorbed ON absorbed.merged_into_id = survivor.id
   SET survivor.indoor  = COALESCE(survivor.indoor,  absorbed.indoor),
       survivor.outdoor = COALESCE(survivor.outdoor, absorbed.outdoor),
       survivor.updated_at = NOW()
 WHERE survivor.source = 'TOUR_API';

-- 4) 아직 병합되지 않은 쌍은 placeMergeJob 이 처리한다 (§7-4). 3) 과 함께 돌린다
```

> ⚠ **3) 을 `placeMergeJob` 재실행으로 대신할 수 없다.** 병합 후보 조회가
> `merged_into_id IS NULL` 로 거르기 때문에(`JdbcPlaceMergeAdapter.SELECT_CANDIDATES_SQL`)
> **이미 병합된 문화정보원 행은 다시 후보가 되지 않는다.** 2) 로 survivor 를 NULL 로 되돌려도
> 잡을 다시 돌리는 것만으로는 값이 옮겨 오지 않는다. 1-1) 이 0이면 3) 은 건너뛰어도 된다.
>
> 같은 이유로 **병합은 1회성 복사다** — 나중에 문화정보원 CSV 가 실내외를 정정해도 survivor
> 에는 반영되지 않는다. 별도 이슈로 다룬다.

- **`source = 'TOUR_API'` 로 반드시 한정한다.** 문화정보원(`CULTURE_PORTAL`) 행은 이 컬럼을
  원천에서 실제로 받아 오므로 같이 지우면 아는 값을 잃는다.
- **`#726` 재적재보다 먼저 한다.** 재적재는 약 1,200행을 새로 넣는데, 코드 수정이 먼저 배포돼
  있으면 새 행은 처음부터 NULL 로 들어온다. 순서가 뒤집히면 잘못된 값이 2배로 늘고 사후
  UPDATE 범위만 커진다.
- prod 는 §1 과 같이 **런북으로 사람이 적용**한다. dev 에서 1)·2)·3) 을 돌려 건수와 병합 결과를
  확인한 뒤 옮긴다.

### 확인 — **단계마다 기대값이 다르다**

`indoor = false` 는 이 절차 안에서 **두 가지를 뜻한다.** 적재가 박아 둔 **근거 없는 `false`** 와,
문화정보원이 실제로 "실외" 라고 말해 3) 이 옮겨 온 **근거 있는 `false`** 는 값이 같고 의미가 다르다.
그래서 같은 쿼리가 2) 직후에는 0 이어야 하고 3) 뒤에는 0 이 아니어도 정상이다 — **단계를 적지 않은
확인 쿼리는 성공을 실패로 읽게 만든다** (2026-09-21 dev 재적재에서 실제로 겪었다).

**2) 직후** — 근거 없는 `false` 는 하나도 남으면 안 된다.

```sql
SELECT COUNT(*) FROM place WHERE source = 'TOUR_API' AND indoor = false;   -- 0 이어야 한다
```

**3) 뒤** — 문화정보원이 "실외" 라고 말한 만큼은 `false` 로 돌아온다. **0 이 정답이 아니다.**

```sql
-- 얼마나 돌아왔는지 (dev 2026-09-21 실측: 86)
SELECT COUNT(*) FROM place WHERE source = 'TOUR_API' AND indoor = false;

-- 돌아온 false 가 전부 '근거 있는' 것인지 — 이 쿼리가 0 이어야 한다.
-- 흡수된 행에 false 가 없는데 survivor 만 false 면 2) 가 덜 돌았거나 그 뒤에 다시 박힌 것이다
SELECT COUNT(*)
  FROM place survivor
 WHERE survivor.source = 'TOUR_API'
   AND survivor.indoor = false
   AND NOT EXISTS (SELECT 1 FROM place absorbed
                    WHERE absorbed.merged_into_id = survivor.id AND absorbed.indoor = false);

-- 병합이 옮겨 온 값이 생겼는지 (실내·실외를 합쳐서 본다)
SELECT COUNT(*) FROM place WHERE source = 'TOUR_API' AND indoor IS NOT NULL;  -- 0 보다 커야 한다
```

마지막 쿼리가 계속 0 이면 **먼저 3) 을 돌렸는지 확인한다.** 잡 재실행만으로는 이미 병합된 쌍의
값이 옮겨 오지 않는다(위 경고). 3) 까지 돌렸는데도 0 이면 그때 병합 후보가 안 잡히는지를 본다
(`place-data-integration.md` §4).

> **확인은 SQL 로 한다.** 장소 검색은 Redis 캐시를 TTL 로 갈아타고(기본 300초,
> `place.search-cache-seconds`) 캐시 키에 `indoor` 가 들어간다. 백필 직후 API 로 보면 최대 5분간
> 옛 결과가 온다 — 그걸 실패로 오진하지 않는다.

## 9. 병합이 옮긴 값을 재적재가 지울 때 — `tel` (#763)

§8 의 `indoor` 와 **같은 구조인데 증상이 다르다.** 병합은 survivor(관광 API 행)의 `tel` 이 비었을
때만 흡수되는 문화정보원 행의 번호를 옮기는데(`COALESCE(survivor.tel, absorbed.tel)`), 관광 API
재적재가 `tel = VALUES(tel)` 로 무조건 덮고 있었다. **원천이 번호를 안 주는 장소는 그 값이 NULL 이라,
옮겨 온 번호가 다음 `placeImportJob` 에서 사라진다.**

- `indoor` 는 **영구 no-op** 이었다 — 병합이 한 번도 성공하지 못했다.
- `tel` 은 **적재 주기마다 깜빡인다** — 병합 직후에는 값이 있으니 그때 확인하면 정상으로 보인다.
  그래서 더 잡기 어렵다.

**코드는 `tel = COALESCE(VALUES(tel), tel)` 로 고쳤다** — 원천이 줄 때만 덮는다. `indoor` 처럼
컬럼을 빼지 않은 이유는 **관광 API 가 이 값을 실제로 소유하기 때문**이다. 대신 원천이 번호를
**지운** 것은 따라가지 못하고 옛 번호가 남는다. 병합이 옮긴 번호와 구분할 수 없어서다.

### 이미 사라진 값은 코드 수정으로 돌아오지 않는다

§8 과 같은 이유다 — 병합 후보 조회가 `merged_into_id IS NULL` 로 걸러 **이미 병합된 쌍은 다시
후보가 되지 않는다.** `placeMergeJob` 을 다시 돌려도 그 쌍의 `tel` 은 채워지지 않는다.

```sql
-- 1) 영향 범위를 먼저 센다 (읽기 전용)
SELECT COUNT(*) AS lost
  FROM place survivor
  JOIN place absorbed ON absorbed.merged_into_id = survivor.id
 WHERE survivor.source = 'TOUR_API'
   AND survivor.tel IS NULL
   AND absorbed.tel IS NOT NULL;

-- 2) 옮겨 온 번호를 되살린다 ★ placeMergeJob 재실행으로는 안 된다
UPDATE place survivor
  JOIN place absorbed ON absorbed.merged_into_id = survivor.id
   SET survivor.tel = COALESCE(survivor.tel, absorbed.tel),
       survivor.updated_at = NOW()
 WHERE survivor.source = 'TOUR_API';
```

> **dev 실측 (2026-09-21)**: 병합 쌍 54건 **전부**가 이 상태였다 — 흡수된 행에는 번호가 있고
> survivor 는 NULL 이다. 즉 이 결함은 가정이 아니라 이미 일어난 일이고, 한 번도 남아 있지 못했다.

**순서는 §8 과 같다** — 코드 수정이 먼저 배포돼 있어야 한다. 아니면 다음 적재가 2) 의 결과를
다시 지운다.

### 병합은 1회성 스냅샷이다 — 그대로 둔다

`MERGE_FIELDS_SQL` 은 `markMerged` 직전 **1회만** 돌고, 그 뒤로는 후보에서 빠진다. 그래서
문화정보원 CSV 가 나중에 실내외를 정정해도 **survivor 는 옛 값을 계속 들고 있다.**

주기적 재동기화도, 조회 시 survivor+absorbed 합성도 하지 않기로 했다 — 전자는 "원천 정정" 과
"사람이 고친 값" 을 구분할 수단이 없어 사람 손을 덮을 수 있고, 후자는 tour-service 의 모든 조회
경로에 조인을 하나 더 얹는다. **정정이 필요해지면 위와 같은 일회성 `UPDATE JOIN` 이 그 자리를
메운다.** 이 성질은 `JdbcPlaceMergeAdapter.MERGE_FIELDS_SQL` javadoc 에도 적어 두었다.

### 다음에 같은 결함이 생기지 않게

병합이 채우는 컬럼과 각 원천 UPSERT 의 UPDATE 절이 겹치는지는 **더 이상 사람이 기억하지 않는다** —
`JdbcPlaceBulkAdapterSqlTest` 가 두 SQL 을 실제로 파싱해 대조한다. 병합에 컬럼을 하나 더하면서
적재 쪽을 안 보면 그 테스트가 먼저 빨개진다.

## 10. 반려동물 동반 조건 — `petTourImportJob` (#877)

`place_pet_info` 를 채운다. 장소 상세의 `petInfo` 가 이 테이블에서 온다. 파이프라인의 마지막 자식이라
주 1회 자동으로 돌고, 단독 실행도 된다.

### 무엇을 얼마나 부르나 (2026-09-23 실측)

| 단계 | 호출 | 제주 실측 |
| --- | --- | --- |
| `petTourSyncList2` (`lDongRegnCd=50`) | 1콜 (1,000행 한 페이지) | **336건** — 노출(`showflag=1`) 330 · 내림(`0`) 6 |
| `detailPetTour2` | 노출 ∩ place 마스터, 장소당 1콜 | ≤ 330 (상한 `PET_TOUR_MAX_CALLS_PER_RUN`, 기본 350) |

- **쿼터는 KorService2 와 따로다.** 공공데이터포털은 활용신청한 API 마다 일 1,000건을 센다.
  `placeImportJob` 의 704 와 겹치지 않으므로 한 실행 `1 + 330 = 331` 콜로 **매 실행 전량을 돈다.**
  상한 350 은 원천이 갑자기 불어났을 때(전국 10,152건이 오는 경우 등)의 천장이다.
- **지역은 `lDongRegnCd` 로 묻는다.** `areaCode=39` 로 물으면 목록 23건 · 동기화 31건뿐이다 (#726 과 같은 함정).
- 2,099곳 전부에 상세를 부르지 않는다. 동반 정보가 없는 곳은 `items=""` 로 오므로(실측 1839477) 부르는 만큼 버린다.

### 무엇을 쓰고 무엇을 지우나

- **원문 아홉 칸은 그대로** 적재한다. NOT NULL 가공 세 칸(`allowance_scope` · `allowed_pet_size` ·
  `leash_required`)은 `PetFieldParser` 의 기존 규칙으로만 채운다 — 모르면 `UNKNOWN` / `false`.
- **`place` 행의 `pet_allowance_type` · `allowed_pet_size`(필터·적합도 입력)는 건드리지 않는다.**
  그쪽 반영은 별도 이슈다.
- **지우는 것은 원천이 `showflag=0` 으로 내렸다고 말한 contentId 뿐이다.** 목록에 없다는 이유로는
  지우지 않는다 — 부재는 지역 키 오류나 부분 응답에서도 생긴다. 그래서 건수 가드(`ImportVolumeGuard`)가
  필요 없다: 목록이 줄면 부르는 수가 줄 뿐 지워지는 행은 없고, 불어나도 place 마스터와의 교집합과 상한이
  호출 수를 묶는다.
- 상세가 비어 오거나 실패한 곳은 **이미 행이 있으면** `synced_at` 만 민다. 행이 없으면 만들지 않는다 —
  빈 행은 장소 상세에 "동반 정보 있음" 으로 읽힌다.

### 단독 실행

```powershell
java -jar $jar `
  --spring.main.web-application-type=none `
  --spring.batch.job.enabled=true `
  --spring.batch.job.name=petTourImportJob `
  areaCode=39 runAt=$runAt
```

완료 로그 한 줄에 전부 있다:
`pet tour import finished. areaCode=39, syncPages=1, shown=330, withdrawn=6, removed=…, targets=…, upserted=…, emptyInfo=…, failedPlaces=…`.
`shown - targets` 는 원천에는 있는데 place 마스터에 없는(또는 병합·delisted) contentId 수다.

### 확인 SQL

```sql
-- 채워진 장소 수 (노출 중인 TourAPI 장소 기준)
SELECT COUNT(*) pet_info_rows
  FROM place p JOIN place_pet_info ppi ON ppi.place_id = p.id
 WHERE p.source = 'TOUR_API' AND p.delisted_at IS NULL AND p.merged_into_id IS NULL;

-- 가공 세 칸의 분포 — UNKNOWN 이 대부분이면 원문 분포가 바뀐 것이다
SELECT allowance_scope, allowed_pet_size, leash_required, COUNT(*)
  FROM place_pet_info GROUP BY allowance_scope, allowed_pet_size, leash_required ORDER BY 4 DESC;

-- 마지막 적재 시각
SELECT MIN(synced_at), MAX(synced_at) FROM place_pet_info;
```
