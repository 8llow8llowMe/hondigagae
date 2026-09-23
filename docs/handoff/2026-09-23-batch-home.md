# batch 인계 노트 (2026-09-23 → 집)

> **정본이 아니라 인계 메모다.** 브랜치 `docs/common/handoff-2026-09-21-batch` — **머지 대상이 아니다.**
> 09-21 노트(`2026-09-21-batch-followups.md`)의 §B(PetTour)·§C(올레 포털)는 오늘 PR 로 올라갔다.
> §A(데이터 따라잡기)·§D(로컬 런북)는 PR #881 의 `backend/docs/batch-dev-runbook.md` 가 이어받는다.
> 이 노트의 항목이 다 끝나면 `docs/handoff/` 와 이 브랜치를 지운다.

## 0. 오늘 끝난 것 / 대기 중인 것

| PR | 이슈 | 내용 | 상태 |
| --- | --- | --- | --- |
| **#881** | #878 | batch 배포가 빈 `BATCH_DATA_DIR`·기동 직후 죽음을 초록으로 삼키지 않게 + **dev 운영 런북** | 첫 커밋 CI 초록(뒤 두 커밋은 문서, CI 미확인), 머지 대기 |
| #879 | #876 | 올레 원천 다운로드를 바뀐 포털 경로로 + 우회 지표 | 검토 반영, 머지 대기 |
| #880 | #877 | `petTourImportJob` — 반려동물 동반 조건 `place_pet_info` 적재 | 검토 반영, 320/320, 머지 대기 |
| #884 | #757 | dev 일반 로그인 읽기 전용 E2E 스모크 | CI 초록, 머지 대기 (secret 필요) |
| #889 | #885 | `feature-status.md` 데이터 현황을 dev 실측으로 정정 | 머지 대기 |

닫은 이슈: #816 · #828 · #830.
세 batch PR(#879·#880·#881)은 `git merge-tree` 로 서로 clean 이다. 먼저 머지된 쪽 기준으로 나머지가 rebase 한다.

## 1. 집에서 할 순서

### 1-1. 머지 전에 확인

- [ ] **공공데이터포털 마이페이지** — dev·prod TourAPI 키에 **KorPetTourService2(반려동물 동반여행)** 활용신청이 돼 있나.
  없으면 #880 머지 뒤 장소 파이프라인이 매주 FAILED 로 끝난다. 같은 화면에서 **API 별 일일 트래픽이 따로 잡히는지**도 본다
  (#880 은 "상품마다 1,000콜" 을 전제로 1회 331콜을 쓴다)
- [ ] **dev Vault `kv/hondigagae/backend/dev/env`** — `BATCH_DATA_DIR` · `BATCH_SERVICE_APP_NAME` · `BATCH_SERVICE_PORT` · `BATCH_SERVICE_PORT_DEV` · `BATCH_DB_URL` 이 **값과 함께** 있나. `BATCH_DATA_DIR` 경로는 main-server 에 `mkdir -p`
- [ ] **GitHub secret** — `DEV_SMOKE_EMAIL` · `DEV_SMOKE_PASSWORD` (스모크 전용 계정 권장), 선택 변수 `DEV_SMOKE_BASE_URL`

### 1-2. 머지 순서

1. **#881** → Jenkins `hondigagae-batch-service` develop 빌드를 본다
   - 빨간불 + `BATCH_DATA_DIR is empty` → Vault 에 넣고 `FORCE_DEPLOY=true` 재실행
   - 빨간불 + `컨테이너가 기동 직후 안정되지 않았습니다` → 뒤따르는 `docker logs` 가 원인
   - **빌드 자체가 안 생긴다** → Jenkins 에 멀티브랜치 잡이 없다 (§9-6)
   - 초록 → 런북 §3 확인 절차
2. **#879** (올레)
3. **#880** (PetTour) — 1-1 의 활용신청 확인 뒤
4. **#884** (스모크) — secret 등록 뒤. 머지 뒤 Actions 에서 `frontend-dev-smoke` 를 `workflow_dispatch` 로 한 번
5. **#889** (문서)

### 1-3. 배포 뒤 dev 에서 돌릴 잡 (런북 §4 명령 틀)

같은 날 `placeImportJob` 은 한 번만. 스케줄 창(03:00~06:30)은 피한다.

| 순서 | 잡 | 파라미터 | 왜 |
| --- | --- | --- | --- |
| 1 | `congestionImportJob` | — | 혼잡도가 09-10 적재분이라 13일+ 낡았다. 예측 창 끝이 20261009 |
| 2 | `olleCourseImportJob` | `forceImport=true` | **종점 좌표가 dev 에 0/29** — #816 코드 머지 뒤 재적재를 안 했다. 돌리면 24/29. #879 의 "우회 뒤 복귀" 절차도 겸한다 |
| 3 | `petTourImportJob` | — | #880 머지 뒤 첫 적재. 약 330곳. 끝나면 `SELECT COUNT(*) FROM place_pet_info;` 와 원문 분포를 뽑아 **#886 의 입력**으로 둔다 |
| 4 | `placeImportJob` | `areaCode=39` | 상세 커버리지 따라잡기. **하루 1회씩 5~6일** — 이미지 380/2,099 · 운영시간 300/2,099 |

2026-09-23 기준 dev 실측 (다시 잴 쿼리는 런북 §5):

| 항목 | 값 |
| --- | --- |
| 장소 노출 | 2,328 (TourAPI 2,099 · 문화정보원 127 · 식약처 102) |
| `pet_allowance_type` | UNKNOWN 2,099 · ALLOWED 194 · PARTIALLY 5 · NOT_ALLOWED 30 |
| 이미지 / 운영시간 | 380 / 2,099 · 300 / 2,099 |
| 올레 | 시작점 29/29 · 종점 0/29 · 이미지 29/29 |
| 혼잡도 | `base_ymd` 20260904~20261009, 09-10 적재 |
| `place_pet_info` | 0 |
| 배치 실행 | 27회, **전부 수동** (스케줄 0) |

### 1-4. #878 닫기

- [ ] 배포 다음 날 06:00 뒤 런북 §3 의 `trigger=quartz` 쿼리에 `congestionImportJob` 이 찍힌다 → 원인(무엇이 막았나)을 이슈에 적고 닫는다

## 2. 워크트리별로 이어서 할 것

| 워크트리 | 브랜치 | 이슈 / PR | 남은 일 |
| --- | --- | --- | --- |
| `hondigagae-wt-878` | `chore/infra/878-dev-batch-schedule` | #878 / #881 | 머지 → 배포 → §1-4 확인 → 이슈 닫기. 서버에서 원인이 저장소 쪽으로 밝혀지면 **이 브랜치가 아니라 새 이슈**로 고친다 (머지된 브랜치에 더 쌓지 않는다) |
| `hondigagae-wt-876` | `feature/be/876-olle-source-download` | #876 / #879 | 머지 → 워크트리·브랜치 정리. 후속은 #887 · #888 |
| `hondigagae-wt-877` | `feature/be/877-pet-tour-import` | #877 / #880 | 머지 → 첫 적재(§1-3 ③) → 워크트리 정리. 후속은 #886 |
| `hondigagae-wt-757` | `test/infra/757-dev-login-e2e-smoke` | #757 / #884 | secret → 머지 → `workflow_dispatch` 로 실제 dev 결과 확인 → 정리 |
| `hondigagae-wt-885` | `docs/common/885-feature-status-actuals` | #885 / #889 | 머지 → 정리 |
| `hondigagae-wt-handoff` | `docs/common/handoff-2026-09-21-batch` | — | 이 노트. 다 끝나면 삭제 |

머지 뒤 정리: `git worktree remove ../hondigagae-wt-<n>` → `git branch -D <branch>` (rebase merge 라 `-d` 가 거부한다 — 먼저 `git cherry develop <branch>` 가 전부 `-` 인지 본다).
`node_modules` 가 있는 워크트리는 `worktree remove` 가 중간에 멈출 수 있다 — 쓰는 프로세스가 없으면 `rmdir /s /q` 로 마저 지운다.

## 3. 다음 batch 작업 (새 워크트리로)

우선순위 순. 셋 다 이슈가 있다.

| # | 이슈 | 선행 | 요지 |
| --- | --- | --- | --- |
| 1 | **#886** `[BE] feat: 반려동물 동반 정보로 TourAPI 장소의 동반 가능 여부·크기 제한을 채운다` | #880 머지 + `petTourImportJob` 첫 적재 | TourAPI 2,099곳이 전부 UNKNOWN 이라 필터·적합도·AI 후보가 "모름" 으로 본다. **규칙은 첫 적재의 원문 분포를 보고 정한다** — 실측에 없는 문구는 UNKNOWN. 문화정보원 병합 행과 겹칠 때 우선순위도 정한다. 신규 규칙이라 brainstorming → 명세 → plan |
| 2 | **#887** `[BE] fix: 우회 적재 뒤 포털이 살아나면 같은 파일이어도 한 번은 다시 적재한다` | #879 머지 | 올레·문화정보원 공통. 사람이 기억해야 하는 `forceImport` 절차를 코드로 없앤다 |
| 3 | **#888** `[BE] fix: 문화정보원 CSV 다운로드도 바뀐 포털 경로로 옮기고 파일명 인코딩을 바로잡는다` | #879 머지 | **먼저 깨졌는지 확인**(완료 로그 `fallback=`). 깨졌으면 #879 경로를 공용으로 올린다. #887 과 같은 파일을 만질 수 있어 한 워크트리에서 순서대로 하는 편이 낫다 |

브랜치 이름 예: `feature/be/886-pet-allowance-from-pet-info` · `fix/be/887-snapshot-after-fallback` · `fix/be/888-culture-portal-download`.

### 이슈 없이 남긴 후보 (필요하면 `/issue`)

- `batch-service.md` "계획 (미착수)" 표의 **`WalkCourseImportJob`(두루누비) 행** — 제주 0건이라 올레로 대체됐다. #880 이 같은 표를 고쳐 충돌을 피하려고 미뤘다. #880 머지 뒤 한 줄
- Jenkins 공용 파이프라인 — 런타임 키 검사가 **빈 값도 통과**(`grep "^KEY="`)한다. 서비스별 필수 키 확장과 `^KEY=.` 로 조이는 것은 **다른 서비스 배포를 막을 수 있어** dev/prod Vault 대조가 먼저다
- Jenkins — 커밋에 연결된 PR 이 없을 때(`NO_PULL_REQUEST`)가 "라벨 미지정" 과 같은 설명으로 SUCCESS 가 된다. 구분만이라도
- `RelatedPlaceImportJob` · `VisitorStatsJob` — **소비처가 없고 AI 기능 선정 전**이라 착수하지 않는다 (루트 CLAUDE.md)

## 4. 오늘 겪은 함정

- **이 PC 의 외부 네트워크가 대상별로 끊겼다** — 공공 API 1/6 · dev DB 4/10 · GitHub 2/6 성공(google 은 정상). 로컬 JVM 으로 dev 적재를 못 돌린 이유다. 컨테이너가 뜨면 서버 안에서 돌리므로 사라지는 문제다
- **여러 세션이 동시에 돌면 JVM·node 가 죽는다** — Gradle 데몬 크래시(`--no-daemon` 으로 통과), pre-push 의 prettier/vitest 크래시(재실행하면 통과). 코드 문제가 아니다
- **이슈 API 로 없는 라벨을 붙이면 라벨이 새로 생긴다** — `frontend-docs` 를 한 번 만들었다가 지웠다. 라벨은 `.github/labeler.yml` 에 있는 것만 쓴다 (문서만 바꿔도 `frontend/**` 면 labeler 가 `frontend-web` 을 붙인다)
- **스케줄 표의 "월" 은 매주 월요일**이다 (`0 0 3 ? * MON`). "매월" 로 읽어 한 번 틀리게 말했다
- **dev 자격증명이 채팅 평문으로 두 번 오갔다** — dev DB 비밀번호·공공데이터 키 회전 검토
