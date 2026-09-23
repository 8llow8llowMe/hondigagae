# batch-service dev 운영 런북

> dev 서버(main-server)에서 batch-service 를 **띄우고, 스케줄이 도는지 확인하고, 잡을 손으로 돌리는**
> 절차를 한곳에 모은 문서다. 설계 근거는 여기서 반복하지 않고 정본으로 링크한다.
>
> - 잡·스케줄 설계의 정본: `services/batch-service.md`
> - 원천별 갱신 성격·실패 대응: `data-refresh-guide.md`
> - 배포 파이프라인: `jenkins-cicd-dev-deploy-guide.md`
> - 지표·경보: `observability-guide.md`

## 1. 컨테이너만 떠 있으면 스케줄은 스스로 돈다

**그렇다.** 주기 실행은 서버 crontab 이 아니라 **batch-service 프로세스 안 Quartz** 가 맡는다 (#378).
컨테이너가 떠 있으면 아래 시각에 스스로 잡을 부른다. 따로 켤 것은 없다.

| 잡 | 언제 (KST) | 하는 일 |
| --- | --- | --- |
| `placeDataPipelineJob` | 월 03:00 | 장소 적재 자식 잡을 순서대로 (목록·운영시간·이미지 → 문화정보원 → 식약처 → 병합 → 이미지 백필) |
| `olleCourseImportJob` | 월 05:00 | 제주올레 코스 |
| `congestionImportJob` | 매일 06:00 | 혼잡도 30일 rolling 예측 |

스케줄이 켜지는 조건은 셋이고, dev 배포는 셋 다 기본으로 만족한다.

| 조건 | dev 기본값 | 어디서 |
| --- | --- | --- |
| 프로파일 `dev` | `SPRING_PROFILES_ACTIVE=dev` | Vault → Dockerfile ENTRYPOINT |
| `BATCH_SCHEDULE_ENABLED=true` | compose dev 가 `:-true` | `docker-compose-batch-service.yml` |
| `spring.batch.job.enabled` 가 false 또는 미지정 | `application.yml` 에서 false | 컨테이너 기본 커맨드는 이 값을 켜지 않는다 |

알아 둘 성질 셋:

- **잡 스토어가 메모리다.** 컨테이너가 내려가 있던 동안 지나간 발화는 **되살리지 않는다.** 재기동하면
  트리거가 새로 등록되고 다음 주기부터 돈다. 놓친 적재는 §4 로 손으로 돌린다.
- **겹치면 스케줄이 양보한다.** 장소를 건드리는 잡(파이프라인·자식 다섯·혼잡도)이 돌고 있으면
  이번 발화를 건너뛴다(`schedule fire skipped` WARN). 6시간 넘은 STARTED 는 죽은 JVM 잔재로 보고 무시한다.
- **prod 는 기본 꺼짐**(`:-false`)이다. 이 문서는 dev 기준이다.

> 2026-09-23 기준 dev 에서 스케줄은 **한 번도 돌지 않았다** — 컨테이너가 떠 있지 않았다 (#878).
> 아래 §3 확인 절차가 초록이 된 뒤부터 이 절의 설명이 사실이 된다.

## 2. 컨테이너 띄우기

### 2-1. 정석 — Jenkins

1. `backend-batch-service` 라벨이 붙은 PR 을 develop 에 머지하면 `hondigagae-batch-service` 잡이 배포한다.
2. 코드 변경 없이 다시 띄우려면 Jenkins `hondigagae-batch-service` » `develop` 을 **`FORCE_DEPLOY=true`** 로 수동 실행한다.

배포 전제 — dev Vault `kv/hondigagae/backend/dev/env` 에 값이 **비지 않은 채로** 있어야 한다.

| 키 | 예 | 없으면 |
| --- | --- | --- |
| `BATCH_DATA_DIR` | `/home/<계정>/deploy/hondigagae/backend/data` (호스트 경로, `mkdir -p` 필요) | compose 가 `BATCH_DATA_DIR is empty` 로 멈춘다 |
| `BATCH_SERVICE_APP_NAME` · `BATCH_SERVICE_PORT` · `BATCH_SERVICE_PORT_DEV` | `batch-service-dev` · `8080` · `7080` | `Runtime env key check` 에서 멈춘다 |
| `BATCH_DB_URL` | tour 스키마(`hondigagae_tour_dev`) | 떴다가 죽는다 → 배포가 `기동 직후 안정되지 않았습니다` 로 실패 |
| `TOUR_API_SERVICE_KEY` · `VWORLD_API_KEY` | — | 기동은 되고 해당 잡만 실패 |

`BATCH_DATA_DIR` 안의 CSV(`pet_culture.csv`, `olle_course.csv`)는 **포털이 막혔을 때의 우회용**이다.
디렉터리만 있으면 기동·적재가 된다.

### 2-2. 서버에서 직접 (Jenkins 를 못 쓸 때)

Jenkins 가 한 번이라도 배포에 성공했다면 배포 디렉터리에 `app.jar` · `.env.runtime` · compose 파일이 남아 있다.

```bash
cd ~/deploy/hondigagae/backend/service/batch-service

# 떠 있는 컨테이너 재시작만
docker restart hondigagae-batch-service-dev

# compose 로 다시 올리기 (Jenkins 와 같은 프로젝트명을 써야 다른 프로젝트 컨테이너를 건드리지 않는다)
docker compose -p hondigagae-batch-service --env-file .env.runtime \
  -f docker-compose-batch-service.yml up -d --build batch-service-dev
```

**`-p hondigagae-batch-service` 를 빼지 않는다.** 디렉터리 basename 으로 묶이면 같은 호스트의
BossPickSeoul 컨테이너를 orphan 으로 지울 수 있다 (`Jenkinsfile.backend-common.groovy` 주석).

## 3. 스케줄이 실제로 도는지 확인

위에서부터 차례로 본다. 하나라도 아니면 거기서 멈추고 원인을 본다.

```bash
# 1) 떠 있고, 재시작 루프가 아닌가 — "running 0" 이어야 한다
docker inspect -f '{{.State.Status}} {{.RestartCount}}' hondigagae-batch-service-dev

# 2) 스케줄 스위치가 켜진 채로 들어갔나 — dev / true
docker exec hondigagae-batch-service-dev env | grep -E '^(SPRING_PROFILES_ACTIVE|BATCH_SCHEDULE_ENABLED)='

# 3) 애플리케이션이 살아 있나
curl -s localhost:7080/actuator/health

# 4) 발화 기록 — 첫 발화 전에는 아무것도 없다
docker logs hondigagae-batch-service-dev 2>&1 | grep -E 'schedule fire (launched|skipped|failed)' | tail
curl -s localhost:7080/actuator/prometheus | grep '^batch_schedule_'
```

발화 로그 세 가지:

| 로그 | 뜻 |
| --- | --- |
| `schedule fire launched jobName=… runAt=… executionId=…` | 정상 발화 |
| `schedule fire skipped jobName=… blockedBy=…` | 겹치는 잡이 돌고 있어 양보 |
| `schedule fire failed jobName=… errorCode=…` | 발화 자체가 실패 |

DB 로 확인 (tour 스키마). **스케줄이 부른 실행에는 `trigger=quartz` 파라미터가 붙는다** — 수동 실행과 구분된다.

```sql
-- 스케줄이 부른 실행만
SELECT i.JOB_NAME, e.START_TIME, e.STATUS, e.EXIT_CODE
  FROM BATCH_JOB_EXECUTION e
  JOIN BATCH_JOB_INSTANCE i ON i.JOB_INSTANCE_ID = e.JOB_INSTANCE_ID
  JOIN BATCH_JOB_EXECUTION_PARAMS p ON p.JOB_EXECUTION_ID = e.JOB_EXECUTION_ID
 WHERE p.PARAMETER_NAME = 'trigger' AND p.PARAMETER_VALUE = 'quartz'
 ORDER BY e.JOB_EXECUTION_ID DESC
 LIMIT 20;
```

**완료 판정**: 컨테이너를 띄운 다음 날 06:00 뒤에 위 쿼리에 `congestionImportJob` 이 한 줄 생긴다.

## 4. 잡을 손으로 돌리기

첫 배포 직후, 놓친 주기 따라잡기, 원천 복구 뒤처럼 **지금 당장** 한 번 돌려야 할 때 쓴다.

### 4-1. 명령 틀

떠 있는 컨테이너 안에 **두 번째 JVM** 을 띄운다. 플래그 하나하나의 이유는
`jenkins-cicd-dev-deploy-guide.md` §8 표에 있다 — 빼면 상시 컨테이너까지 죽거나 잡이 안 돈다.

```bash
JOB=placeImportJob                       # 아래 4-2 표에서 고른다
PARAMS="areaCode=39"                     # 잡마다 다르다. 없으면 빈 문자열
RUN_AT=$(date +%Y-%m-%dT%H:%M:%S)        # 매번 새 값 — 같은 값이면 같은 실행으로 보고 거부한다

docker exec -d hondigagae-batch-service-dev sh -c "java \
  -XX:MaxRAMPercentage=25 -XX:InitialRAMPercentage=5 \
  -jar /app/batch-service.jar \
  --spring.main.web-application-type=none \
  --eureka.client.enabled=false \
  --spring.batch.job.enabled=true \
  --spring.batch.job.name=${JOB} \
  ${PARAMS} runAt=${RUN_AT} > /tmp/manual-${JOB}.log 2>&1"

# 진행 보기 (Ctrl+C 로 빠져도 잡은 계속 돈다)
docker exec hondigagae-batch-service-dev tail -f /tmp/manual-${JOB}.log
```

`-d` 와 로그 파일로 돌리는 이유: 장소 적재는 수 분 걸린다. `-d` 없이 붙어 있다가 SSH 가 끊기면
잡이 중간에 죽을 수 있다. 중간에 죽어도 데이터는 깨지지 않지만(잡이 멱등이다) 쿼터는 쓴 만큼 사라진다.

### 4-2. 잡별 파라미터

| 잡 | 파라미터 (전부 선택, 기본값) | 언제 |
| --- | --- | --- |
| `placeDataPipelineJob` | `areaCode=39` `sido=제주특별자치도` `region=제주` `contentTypeIds` `forceImport` | 장소 전체를 한 번에. 세 지역값은 서로 같은 지역이어야 한다(검증기가 막는다) |
| `placeImportJob` | `areaCode=39` `contentTypeIds=12,39` (없으면 7종 전량) | 목록 + 운영시간 + 이미지. **상세 커버리지 따라잡기는 이 잡을 하루 한 번씩** |
| `cultureFacilityImportJob` | `sido=제주특별자치도` `forceImport=true` | 문화시설·긴급 시설. 포털 파일이 같으면 건너뛴다 — 강제하려면 `forceImport=true` |
| `petRestaurantImportJob` | `region=제주` | 식약처 반려동물 동반 음식점 |
| `placeMergeJob` | `areaCode=39` | 원천이 다른 같은 장소 묶기. 적재 뒤에 |
| `placeImageBackfillJob` | `areaCode=39` | 이미지 없는 장소에 대표 이미지 빌려 오기. 병합 뒤에 |
| `congestionImportJob` | `numOfRows=1000` | 혼잡도. 장소 적재 뒤에 돌아야 연결된다 |
| `olleCourseImportJob` | `forceImport=true` | 올레. 포털 파일이 같으면 건너뛴다 |

잡 이름·파라미터·기본값의 정본은 각 `*JobConfig` 다. 잡이 늘면 이 표보다 `services/batch-service.md` 잡 표를 먼저 고친다.

### 4-3. 자주 쓰는 경우

```bash
# 상세 커버리지 따라잡기 (하루 1회, 5~6일 반복)
JOB=placeImportJob PARAMS="areaCode=39"

# 혼잡도가 낡았을 때
JOB=congestionImportJob PARAMS=""

# 올레를 포털 파일과 상관없이 다시 적재
JOB=olleCourseImportJob PARAMS="forceImport=true"

# 장소 전체 (쿼터를 한 번에 크게 쓴다 — 따라잡기 목적이면 placeImportJob 단독이 낫다)
JOB=placeDataPipelineJob PARAMS="areaCode=39"
```

### 4-4. 돌리기 전에 지킬 것

- **쿼터.** 공공데이터 개발계정은 **API 상품마다 하루 1,000콜**이다. `placeImportJob` 한 번이
  약 700콜(목록 24 + 운영시간 300 + 이미지 380)을 쓴다. **같은 날 두 번 돌리지 않는다.**
  실행당 상한은 `PLACE_INTRO_MAX_CALLS_PER_RUN`(300) · `PLACE_IMAGE_MAX_CALLS_PER_RUN`(380)으로
  조절하되, 운영계정 키를 받기 전에는 올리지 않는다.
- **스케줄 창(03:00 ~ 06:30)을 피한다.** 겹치면 스케줄 쪽이 양보하지만, 수동 실행은 스케줄을 기다려 주지 않는다.
- **메모리.** dev 컨테이너 상한이 512m 다. 수동 JVM 은 한 번에 하나만 돌린다.

## 5. 결과 확인

잡별 완료 로그 (`/tmp/manual-<잡>.log` 또는 `docker logs`):

| 잡 | 완료 로그 |
| --- | --- |
| `placeImportJob` | `placeImportJob done. areaCode=…, upserted=…` · `place intro import step finished. intros=…` · `place image import step finished. images=…` |
| `cultureFacilityImportJob` | `cultureFacilityImportJob done. … imported=… skippedUnchanged=… fallback=…` |
| `petRestaurantImportJob` | `petRestaurantImportJob done. region=…, imported=…` |
| `placeMergeJob` | `place merge step finished. areaCode=…, merged=…` |
| `placeImageBackfillJob` | `place image backfill step finished. areaCode=…, backfilled=…` |
| `congestionImportJob` | `congestionImportJob done. fetched=…, upserted=…, linked=…, unmatched=…` |
| `olleCourseImportJob` | `olleCourseImportJob done. imported=… skippedUnchanged=… fallback=…` |

`fallback=true` 는 포털이 막혀 우회 CSV 로 적재했다는 뜻이다 (`data-refresh-guide.md` §5).
`PLACE_IMPORT_023` 은 장소 총량이 기대 범위(1,680 ~ 4,200)를 벗어나 멈춘 것이다 (`services/batch-service.md`).

```sql
-- 최근 실행 전체 (수동 + 스케줄)
SELECT i.JOB_NAME, e.START_TIME, e.END_TIME, e.STATUS, LEFT(e.EXIT_MESSAGE, 120) AS exit_message
  FROM BATCH_JOB_EXECUTION e
  JOIN BATCH_JOB_INSTANCE i ON i.JOB_INSTANCE_ID = e.JOB_INSTANCE_ID
 ORDER BY e.JOB_EXECUTION_ID DESC
 LIMIT 20;

-- 장소 상세 커버리지 (따라잡기 진척)
SELECT COUNT(*) AS total, SUM(image_synced_at IS NOT NULL) AS img_done
  FROM place WHERE source = 'TOUR_API' AND delisted_at IS NULL;

SELECT COUNT(DISTINCT i.place_id) AS intro_done
  FROM place p JOIN place_intro i ON i.place_id = p.id
 WHERE p.source = 'TOUR_API' AND p.delisted_at IS NULL;

-- 혼잡도 예측 창
SELECT MIN(base_ymd), MAX(base_ymd), COUNT(*) FROM congestion_forecast;
```

## 6. 개인 PC 에서 dev DB 로 직접 돌리기 (컨테이너가 없을 때만)

dev 컨테이너가 없던 동안 쓰던 임시 방식이다. 컨테이너가 뜨면 §4 를 쓴다 — 이 방식은 개인 PC 의
네트워크 상태에 좌우되고(2026-09-23 공공 API 연결 1/6 로 실행 불가), 비밀값을 개인 셸에 둔다.

```powershell
# 비밀값은 Vault kv/hondigagae/backend/dev/env 에서. 파일로 저장하거나 커밋하지 않는다
$env:SPRING_DATASOURCE_URL      = "jdbc:mysql://<dev-db-host>:3306/hondigagae_tour_dev?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Seoul&zeroDateTimeBehavior=convertToNull&rewriteBatchedStatements=true"
$env:SPRING_DATASOURCE_USERNAME = "<db-user>"
$env:SPRING_DATASOURCE_PASSWORD = "<db-password>"
$env:TOUR_API_SERVICE_KEY       = "<tour-api-key>"
$env:VWORLD_API_KEY             = "<vworld-key>"
$env:EUREKA_CLIENT_ENABLED      = "false"
$env:SPRING_CLOUD_CONFIG_ENABLED = "false"
# CULTURE_FACILITY_CSV_PATH / OLLE_COURSE_CSV_PATH 는 주지 않는다 — 파일 경로여야 하고,
# backend/ 에서 실행하면 기본값(data/pet_culture.csv, data/olle_course.csv)이 맞는다

cd backend
.\gradlew.bat --no-daemon :service:batch-service:bootJar
$jar = (Get-ChildItem service\batch-service\build\libs\*.jar | Where-Object Name -notlike "*plain*" | Select-Object -First 1).FullName
java -jar $jar --spring.main.web-application-type=none --spring.batch.job.enabled=true `
  --spring.batch.job.name=placeImportJob areaCode=39 runAt=$(Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
```

`local` 프로파일이라 기동 때 `BATCH_*` · `import_source_snapshot` DDL 을 시도한다. dev 에 이미 있어 무해하다.

## 7. 막혔을 때

| 증상 | 볼 곳 |
| --- | --- |
| 배포 로그 `BATCH_DATA_DIR is empty` | §2-1 표 — Vault 에 호스트 경로를 넣는다 |
| 배포 로그 `컨테이너가 기동 직후 안정되지 않았습니다` | 뒤따르는 `docker logs` — 보통 `BATCH_DB_URL`·DB 접속·메모리 |
| `docker inspect` 가 `restarting` 이거나 RestartCount 가 늘어난다 | `docker logs --tail 200 hondigagae-batch-service-dev` |
| 컨테이너는 떠 있는데 §3 쿼리가 비어 있다 | §3 의 2) env — `BATCH_SCHEDULE_ENABLED` 가 `true` 가 아니거나 프로파일이 `dev` 가 아니다 |
| `schedule fire skipped` 가 매번 뜬다 | `blockedBy` 의 잡이 STARTED 로 남아 있다. 6시간 뒤면 무시되지만, 죽은 실행이면 수동으로 정리한다 |
| 수동 실행이 `JobInstanceAlreadyCompleteException` | `runAt` 을 새 값으로 |
| 수동 실행 뒤 상시 컨테이너가 죽었다 | `-XX:MaxRAMPercentage=25` 를 뺐거나 수동 JVM 을 둘 이상 띄웠다 |
| `TOUR_API_QUOTA_EXCEEDED` | 그날 쿼터 소진. 다음 날 다시 |
