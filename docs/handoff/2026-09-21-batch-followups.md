# 배치 작업 인계 노트 (2026-09-21)

> **이 문서는 정본이 아니라 인계 메모다.** 다른 자리(집)에서 세션을 새로 열어 이어받기 위한 것이고,
> 작업이 끝나면 각 항목의 결론은 `backend/docs/*` 정본으로 옮기고 이 파일은 지운다.
> 브랜치 `docs/common/handoff-2026-09-21-batch` — **머지 대상이 아니다.**

## 0. 전제 — 지금 어디까지 와 있나

- **dev 서버에는 batch-service 컨테이너가 아직 안 떠 있다.** 그래서 적재는 전부 **로컬 JVM 이 dev DB 에 직접 붙어서** 돌린 것이다.
- develop 에 머지된 것: #726(지역코드 이관) · #722(올레 좌표) · #753(indoor 되돌리기) · #763(tel 보존) · #770(분산 락 판단) · #828(가드 조임 + §8 확인 절차).
- **아직 열려 있는 이슈**: #770, #828 (PR 은 머지됐지만 이슈가 `OPEN` 이다 — 템플릿이 `Issue Number:` 라 자동으로 안 닫힌다). #816(올레 좌표·경로)은 진행 중이고 담당이 따로 있다.

### dev DB 실측 (2026-09-21, 읽기 전용 SELECT)

| 항목 | 값 | 판정 |
| --- | --- | --- |
| TOUR_API 활성 / 전체 | **2,099** / 2,117 | #828 실측과 일치 |
| CULTURE_PORTAL / MFDS | 228 (병합 101) / 102 | 정상 |
| `indoor = false` (TOUR_API) | **86** | 근거 있는 false — §8 정리가 끝난 상태 |
| `indoor IS NOT NULL` | 100 | 병합이 옮겨 준 값 |
| §9 `tel` 유실 대상 | **0건** | **복구 SQL 돌릴 필요 없다** |
| `walk_course` 좌표 | **29 / 29** | #722 반영됨 |
| **이미지 상세(`image_synced_at`)** | **380 / 2,099** | 1회분만 돌았다 |
| **운영시간(`place_intro`, 활성 TOUR_API 기준)** | **300 / 2,099** | 1회분만 (숙박 32 는 0 — 원천에 필드가 없다) |
| **`place_pet_info`** | **0건** | 적재 잡 자체가 미착수 |
| 혼잡도 | 16,128행, `base_ymd` 20260904~20261009, 09-10 적재 | 11일 낡음 |
| 최근 잡 | placeImport/Merge/Olle 09-21 16:5x COMPLETED (olle 는 FAILED 1회 뒤 우회 성공) | — |

재볼 때 쓴 클라이언트: `C:\Program Files\MySQL\MySQL Workbench 8.0 CE\mysql.exe`
(Workbench 설치에 딸려 온다. PATH 에 없다.)

---

## A. dev 데이터 따라잡기 (잡 실행) — 코드 변경 없음

### A-1. 왜 필요한가

상세 두 스텝은 **실행당 상한**이 있어 한 번에 전량을 못 채운다. 지금 380/300 은 딱 1회분이다.
`placeImportJob` 을 하루 한 번씩 **5~6회** 더 돌리면 전량이 덮인다 (`ceil(2099/380) = 6`).

### A-2. 쿼터 — 이게 이 작업의 유일한 제약

개발계정 **일 1,000콜**. `placeImportJob` 한 번이 `목록 24 + intro 300 + image 380 = 704`.
같은 날 수동 이미지 백필(276)까지 돌리면 981 로 한도에 거의 붙는다. **하루에 한 번씩만 돌린다.**

### A-3. 실행 순서

1. `placeImportJob areaCode=39` — 목록 + intro + image. **이걸 5~6일 반복하는 것이 본 작업이다.**
2. `congestionImportJob` — 30일 rolling 이라 한 번 돌리면 창이 20261020 언저리까지 밀린다.
3. (선택) `cultureFacilityImportJob` / `petRestaurantImportJob` — 09-14 / 09-10 적재분. 원천이 자주 안 바뀌어 급하지 않다.
4. (선택) `placeMergeJob` — 1·3 뒤에 새로 들어온 쌍이 있으면.
5. `olleCourseImportJob` — **지금 돌려도 매번 우회 CSV 로 돈다** (C 항목 참고). 데이터는 이미 29/29 라 굳이 안 돌려도 된다.

> `placeDataPipelineJob` 은 위 자식 잡 다섯을 순서대로 도는 부모 잡이다. 쿼터를 한 번에 크게 쓰므로
> 따라잡기 목적이면 `placeImportJob` 단독 반복이 낫다.

### A-4. 확인 SQL (실행 후)

```sql
-- 상세 커버리지가 실제로 늘었는가
SELECT COUNT(*) total,
       SUM(image_synced_at IS NOT NULL) img_done
  FROM place WHERE source='TOUR_API' AND delisted_at IS NULL;

SELECT COUNT(DISTINCT i.place_id) intro_done
  FROM place p JOIN place_intro i ON i.place_id = p.id
 WHERE p.source='TOUR_API' AND p.delisted_at IS NULL;

-- 총량이 새 가드 범위(1,680 ~ 4,200) 안인가
SELECT COUNT(*) FROM place WHERE source='TOUR_API' AND delisted_at IS NULL;
```

`PLACE_IMPORT_023` 으로 끝나면 총량이 `1,680 ~ 4,200` 을 벗어난 것이다 (#828 에서 조였다).
**부분 실행(`contentTypeIds` 지정)은 이 가드를 타지 않는다** — 전량 실행에서만 검사한다.

---

## B. `PetTourImportJob` 신규 구현 (미착수) — 가장 큰 작업

### B-1. 무엇이 비어 있나

`place_pet_info` **0건**이다. 테이블과 엔티티(`PlacePetInfoEntity`), 응답 DTO(`PlacePetInfoItem`),
상세 응답 필드까지 **전부 있는데 채우는 잡이 없다.** `backend/docs/services/batch-service.md` 의
"계획 (미착수)" 표에 `PetTourImportJob` 으로 적혀 있는 그것이다.

반려견 동반 조건은 이 서비스의 핵심 데이터다. 지금은 장소 상세가 그 자리를 항상 비워 내려보낸다.

### B-2. 원천 (이미 실호출로 검증돼 있다)

`backend/docs/data-api-analysis.md` **§4** 에 실측 결과가 있다. 요지만:

- Base: `https://apis.data.go.kr/B551011/KorPetTourService2` — **`2` 없는 이름은 400 이다.**
- 오퍼레이션 셋: `areaBasedList2`(목록) · `detailPetTour2`(동반 정보 상세) · `petTourSyncList2`(동기화 목록, `showflag` 포함, 전국 10,152건)
- `contentid` 가 국문 관광정보와 **같은 체계** → `place` 마스터에 그대로 결합된다.
- 동반 정보가 없는 contentId 로 `detailPetTour2` 를 부르면 `items=""`(빈 문자열)로 온다 — **0건을 객체가 아니라 빈 문자열로 주는 함정**이 여기에도 있다.
- 필드 9개(`acmpyTypeCd`, `acmpyPsblCpam`, `acmpyNeedMtr`, `etcAcmpyInfo`, `rela*` 5종)는 **전부 자유 텍스트**다. 코드값이 아니다.

### B-3. 설계할 때 먼저 정할 것 (이게 이슈의 본체다)

1. **쿼터.** 장소당 1콜로 2,099곳을 돌면 **하루 예산을 통째로 먹는다**(현재 704 를 이미 쓰고 있다).
   그래서 `detailPetTour2` 를 전량에 부르면 안 된다. 대상을 먼저 좁히는 쪽이 맞다 —
   `areaBasedList2`(제주) 또는 `petTourSyncList2` 로 **동반 정보가 있는 contentId 집합**을 먼저 받고
   그 교집합에만 상세를 부른다. 실측에서 제주 관광지 타입이 29건이었으니 총량은 수백 규모일 것이다.
   → **이 판단을 수치로 먼저 적는다.** (#770·#828 과 같은 방식)
2. **#726 의 함정이 여기에도 있다.** 국문 관광정보에서 `areaCode=39` 로 물으면 절반만 왔고
   `lDongRegnCd=50` 으로 고쳐야 했다. 반려동물 API 의 `areaBasedList2` 도 **같은 필드 구성**이므로
   같은 검증을 먼저 해야 한다 — 두 키로 각각 `totalCount` 를 재서 비교한 뒤 정한다. 안 하면
   #726 을 그대로 재현한다.
3. **정규화 범위.** 자유 텍스트를 그대로 저장할지, `PetAllowanceType` 같은 가공 enum 을 둘지.
   `entity-design.md` §3 이 "원문 보존 + 가공 컬럼 분리" 를 권한다. 필터/추천에 쓰려면 가공이 필요한데,
   **가공 규칙을 정하는 것이 구현보다 어렵다** ("전구역 동반가능" / "일부 구역" / "소형견만" …).
   1차는 원문만 적재하고 가공은 별도 이슈로 쪼개는 쪽을 권한다.
4. **실행 주기.** 장소 파이프라인(월 1회) 안에 자식으로 넣을지, 밖에 둘지. 원천 변경이 드물면
   파이프라인 뒤에 붙이는 것이 자연스럽다.
5. **건수 가드.** #828 에서 만든 `ImportVolumeGuard` 와 같은 장치가 이 잡에도 필요한지.

### B-4. 착수 순서

1. 이슈부터 쓴다 (`/issue` 스킬). 제목 예: `[BE] feat: 반려동물 동반 조건을 적재한다 (place_pet_info)`.
   위 B-3 다섯 개를 체크박스로 넣는다.
2. `superpowers:brainstorming` → 명세 → `superpowers:writing-plans`.
3. 구현 위치는 `service/batch-service/.../domainlayer/placeimport/` 를 그대로 따른다.
   본뜰 대상은 `placeIntroImportStep` 계열이다 — 장소당 1콜 + 실행당 상한 + 증분 대상 선정이라는
   구조가 이 잡에 그대로 필요하다 (`PlaceImportJobConfig` javadoc 이 그 규칙을 설명한다).
4. 검증: `cd backend && ./gradlew :service:batch-service:cleanTest :service:batch-service:test --no-build-cache`
   (`cleanTest` 와 `--no-build-cache` 를 빼면 캐시로 한 건도 안 돌고 통과한다.)

---

## C. 올레 포털 파싱 교체 (#828 후속) — **충돌 주의**

### C-1. 확인된 사실 (2026-09-21 페이지 실측)

`https://www.data.go.kr/data/15043496/fileData.do` 를 직접 받아서 셌다.

| | 결과 |
| --- | --- |
| 응답 | `http_code=200`, 약 171KB, 데이터셋도 맞다 (`<title>제주특별자치도_올레코스현황_20260731`) |
| `application/ld+json` 블록 | **0개** |
| `@type: DataDownload` 노드 | **0개** |
| `contentUrl` / `atchFileId` / `fileDownload.do` | **전부 없다** |
| 내려받기 트리거 | `onclick="fileDetailObj.fn_fileDataDown('15043496', 'uddi:5e0b77df-…', '', '1', '1')"` |

즉 `DataGoKrOlleCourseSourceAdapter` 의 전략(JSON-LD → `DataDownload.contentUrl` → `atchFileId`)이
**통째로 낡았다.** 재시도로 낫지 않고 **매 실행 우회 CSV 로 돈다.** 식별자 체계도
`atchFileId` → `uddi:` 로 시작하는 상세 PK 로 바뀌었다.

### C-2. 지금 당장 아픈가

아니다. 우회 CSV(`backend/data/olle_course.csv`, 29행)가 정상 데이터를 넣고 있고 좌표도 29/29 다.
**다만 두 가지가 남는다.**

1. **지표가 없다.** 문화정보원은 `place_import_rows{result="fallback"}` 로 우회를 드러내는데
   올레는 WARN 한 줄과 완료 로그 `fallback=true` 뿐이다. 우회가 기본이 돼도 대시보드는 조용하다.
2. **우회 파일이 저장소 밖에도 있다.** 배포에서는 `BATCH_DATA_DIR` 에 사람이 둔 파일이라 언제 판본인지
   알 수 없다. 포털의 현재 파일명이 `_20260731` 이라 이미 더 낡았을 수 있다.

### C-3. 손대기 전에 확인할 것

**`walkcourseimport` 패키지는 #816(올레 좌표·경로 적재)과 같은 파일이다.** 담당이 따로 있으니
먼저 조율한다. 파싱 전략 교체를 #816 안에서 같이 할지, 별도 이슈로 뗄지가 첫 결정이다.

### C-4. 고칠 때의 후보안

- `fn_fileDataDown(publicDataPk, publicDataDetailPk, …)` 인자를 HTML 에서 뽑아 **다운로드 엔드포인트를
  직접 부른다.** 무엇이 정답 URL 인지는 브라우저 네트워크 탭을 한 번 보면 확정된다 (추측하지 말 것).
- 스냅샷 키(`atchFileId` + 바이트 수)도 함께 바뀐다 — `uddi` 기반으로 갈아탈지 정해야 한다.
- 우회 지표(`result="fallback"` 카운터)를 같이 넣는다. 안 넣으면 다음에 또 조용히 낡는다.

### C-5. 덤으로 발견한 것 (별도 수정)

`DataGoKrOlleCourseSourceAdapter` 의 진단 문구 `jsonLdBlocks=%d` 에 실제로 찍히는 값은
**JSON-LD 블록 수가 아니라 찾아낸 `DataDownload` 노드 수**(`downloads.size()`)다. 그래서
`jsonLdBlocks=0` 만 보고는 "JSON-LD 가 없다" 와 "JSON-LD 는 있는데 DataDownload 가 없다" 를
구분할 수 없다. 이번에도 페이지를 직접 받아서야 알았다. 한 줄 수정이지만 같은 파일이라 C-3 에 묶인다.

---

## D. 로컬에서 dev DB 에 붙여 잡 돌리기 (런북)

### D-1. 원래 스크립트에서 고칠 것 두 개

1. **`CULTURE_FACILITY_CSV_PATH` 는 디렉터리가 아니라 파일이다** (기본 `data/pet_culture.csv`).
   디렉터리를 주면 우회 경로가 깨진다. 그리고 `backend/` 에서 실행하면 기본값이 그대로 맞으므로
   **이 변수는 아예 안 주는 편이 낫다.** `backend/data/` 에 `pet_culture.csv`(30MB)와
   `olle_course.csv` 가 이미 있다.
2. **잡 실행 인자가 빠져 있었다.** 최소한 아래 넷이 필요하다.
   `--spring.main.web-application-type=none` / `--spring.batch.job.enabled=true` /
   `--spring.batch.job.name=<잡이름>` / `runAt=<ISO 시각>`.
   `runAt` 을 매번 바꾸지 않으면 같은 JobInstance 로 판정돼 `JobInstanceAlreadyCompleteException` 이다.

### D-2. 동작 원리 메모

- batch-service 는 기본 프로파일이 `local` 이고, `application-local.yml` 의 datasource 는
  `localhost` 로 **하드코딩**돼 있다. 그런데 **환경변수가 profile yml 보다 우선**하므로
  `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` 로 덮으면 dev DB 로 붙는다. (원래 방식이 맞다)
- `local` 프로파일은 `spring.batch.jdbc.initialize-schema: always` + `spring.sql.init.mode: always` 라
  **dev 스키마에 `BATCH_*` / `import_source_snapshot` DDL 을 시도한다.** dev 에는 이미 있어서 무해하다.
- Eureka 는 `EUREKA_CLIENT_ENABLED=false` 로 끈다 (안 꺼도 돌지만 로그가 쌓인다).

### D-3. PowerShell 런북

```powershell
# --- 1회만: 비밀값 (값은 Vault kv/hondigagae 또는 팀 채널에서 가져온다. 파일로 커밋 금지) ---
$env:SPRING_DATASOURCE_URL      = "jdbc:mysql://<dev-db-host>:3306/hondigagae_tour_dev?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Seoul&zeroDateTimeBehavior=convertToNull&rewriteBatchedStatements=true"
$env:SPRING_DATASOURCE_USERNAME = "<db-user>"
$env:SPRING_DATASOURCE_PASSWORD = "<db-password>"
$env:TOUR_API_SERVICE_KEY       = "<tour-api-key>"
$env:VWORLD_API_KEY             = "<vworld-key>"
$env:EUREKA_CLIENT_ENABLED      = "false"
$env:SPRING_CLOUD_CONFIG_ENABLED = "false"
# CULTURE_FACILITY_CSV_PATH / OLLE_COURSE_CSV_PATH 는 주지 않는다 (backend/ 기준 기본값이 맞다)

# --- 빌드 ---
cd D:\ProjectWorkSpace\hondigagae\backend
.\gradlew.bat :service:batch-service:bootJar
$jar = (Get-ChildItem service\batch-service\build\libs\*.jar | Where-Object Name -notlike "*plain*" | Select-Object -First 1).FullName

# --- 실행 (작업 디렉터리는 backend 여야 data/ 상대경로가 맞는다) ---
$runAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
java -jar $jar `
  --spring.main.web-application-type=none `
  --spring.batch.job.enabled=true `
  --spring.batch.job.name=placeImportJob `
  areaCode=39 runAt=$runAt
```

잡 이름만 바꿔 쓴다: `placeImportJob` / `congestionImportJob` / `cultureFacilityImportJob` /
`petRestaurantImportJob` / `placeMergeJob` / `placeImageBackfillJob` / `olleCourseImportJob` /
`placeDataPipelineJob`(부모).
`congestionImportJob` · `olleCourseImportJob` 은 `areaCode` 가 필요 없다 (`runAt` 만).

### D-4. 돌린 뒤 볼 것

- 회차 로그의 건수 — `imported=` / `fallback=` / `PLACE_IMPORT_023` 여부
- 위 A-4 확인 SQL
- `BATCH_JOB_EXECUTION` 최근 행의 `STATUS` / `EXIT_MESSAGE`

---

## E. 뒷정리 항목

- [ ] #770 · #828 이슈 닫기 (PR 은 각각 #820 · #829 로 머지됨)
- [ ] 이 인계 노트의 결론이 정본으로 옮겨지면 `docs/handoff/` 와 브랜치 삭제
- [ ] dev 자격증명이 채팅 평문으로 오갔다 — 필요하면 dev DB 비밀번호·공공데이터 키 회전 검토
