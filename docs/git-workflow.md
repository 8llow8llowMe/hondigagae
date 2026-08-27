# Git 협업 워크플로

> 저장소 전체(BE/FE 공통) 기준이다. 엔트리는 루트 `CLAUDE.md`.
> 이 문서가 브랜치·PR·머지 규칙의 정본이다.

## 1. 전체 흐름

```text
이슈 생성 → 브랜치 생성 → 작업·커밋 → PR 생성 → CI 통과 → Rebase and merge → 브랜치 삭제 → 이슈 갱신
```

| 단계 | 지킬 것 |
|------|---------|
| 이슈 생성 | 화면 / 기능 단위 |
| 브랜치 생성 | 이름에 이슈 번호 포함 |
| PR 생성 | `Issue Number` · assignee · 라벨 |
| Rebase and merge | develop 선형 유지 |
| **이슈 갱신** | **체크박스 갱신 → 전부 끝났으면 닫기** |

**이슈 없이 브랜치를 만들지 않는다.** 이슈가 작업 단위이자 추적 지점이다.

## 2. 이슈

### 단위

> **화면 / 기능 단위로 쪼갠다.**

| 좋음 | 나쁨 |
|------|------|
| `장소 상세 화면 구현` | `장소 상세 명세 작성` (너무 잘음 — 중간 상태가 develop 에 쌓인다) |
| `반려견 등록 화면 구현` | `장소 탐색 영역 구현` (너무 큼 — PR 이 100파일을 넘는다) |

명세·구현·테스트는 **한 이슈에 묶는다.** 하나의 이슈가 하나의 PR 이 되고, PR 은 **30파일 이내**를 목표로 한다.

### 템플릿·라벨

- 템플릿: `.github/ISSUE_TEMPLATE/` (기능 / 버그)
- 제목: 커밋과 같은 `[영역] type: 요약` 형식
- 라벨: 해당 서비스 라벨을 붙인다 (`frontend-web`, `backend-tour-service` 등)

## 3. 브랜치

### 네이밍 (필수)

```text
<type>/<영역>/<이슈번호>-<요약>
```

| 자리 | 값 |
|------|-----|
| `type` | `feature` \| `fix` \| `chore` \| `refactor` \| `docs` \| `test` \| `style` |
| `영역` | `fe` \| `be` \| `infra` \| `common` (양쪽에 걸치면 `common`) |
| `이슈번호` | GitHub 이슈 번호 |
| `요약` | 영문 kebab-case, 2~4단어 |

```bash
feature/fe/12-place-detail
fix/be/8-facility-id-type
docs/common/15-git-workflow
chore/infra/20-ci-cache
```

**이슈 번호를 넣는 이유**: `git log` 나 브랜치 목록만 봐도 어느 이슈인지 추적된다. PR 본문의 `Issue Number` 에만 의존하면 로컬에서는 알 수 없다.

### 시작

```bash
git checkout develop
git pull --ff-only origin develop
git checkout -b feature/fe/12-place-detail
```

## 4. 커밋

- 형식: `[영역] type: 요약` — 루트 `CLAUDE.md` 기준
- **의미 단위로 나눈다.** `Rebase and merge` 라서 **커밋이 그대로 develop 에 남는다.**
  "wip", "fix typo" 같은 커밋을 남기지 않는다. 필요하면 `git rebase -i` 로 정리한다.

## 5. develop 동기화는 rebase 로 한다

작업 중 develop 이 앞서 나갔으면 **merge 가 아니라 rebase** 를 쓴다.

```bash
git fetch origin
git rebase origin/develop
```

```bash
# 금지 — 머지 커밋이 생기면 Rebase and merge 가 깨진다
git merge origin/develop
```

**이유**: 이 저장소는 develop 히스토리에 머지 커밋이 하나도 없다. 브랜치에 머지 커밋이 섞이면
GitHub 의 `Rebase and merge` 가 히스토리를 예상과 다르게 평탄화한다.

## 6. PR

### 생성

```bash
git push -u origin feature/fe/12-place-detail
gh pr create --base develop \
  --title "[FE] feat: 장소 상세 화면 구현" \
  --body-file <본문> \
  --assignee @me \
  --label frontend-web
```

- 본문은 `.github/PULL_REQUEST_TEMPLATE.md` 를 채운다. `/pr` 스킬을 쓰면 된다.
- **`Issue Number: #12` 를 반드시 채운다.** 비워 두지 않는다.
- 제목은 이슈 제목과 같게 둔다.

### assignee / 라벨 (필수)

> **PR 을 만들 때 assignee 와 라벨을 함께 지정한다.** 나중에 붙이려고 미루지 않는다.

| 항목 | 값 |
|------|-----|
| assignee | **작성자 본인** (`--assignee @me`). 여럿이 작업했으면 전부 추가한다 |
| 라벨 | **이슈와 같은 서비스 라벨** (`--label frontend-web` 등) |

라벨은 이슈(§2)와 같은 목록을 쓴다.

| 변경 범위 | 라벨 |
|-----------|------|
| `frontend/` | `frontend-web` |
| `backend/service/tour-service` | `backend-tour-service` |
| `backend/service/auth-service` | `backend-auth-service` |
| `backend/service/plan-service` | `backend-plan-service` |
| `backend/service/ai-service` | `backend-ai-service` |
| `backend/service/batch-service` | `backend-batch-service` |
| `backend/core/**` | `backend-core` |
| 게이트웨이 / 유레카 | `backend-api-gateway` / `backend-service-discovery` |
| 백엔드 문서 | `backend-docs` |

여러 영역에 걸치면 해당 라벨을 **모두** 붙인다 (`--label frontend-web --label backend-tour-service`).

> **예외: 저장소 공통 변경(`[DOCS]` / `[INFRA]`)은 라벨을 붙이지 않는다.**
> 루트 `docs/`, `.github/`, `.claude/`, CI 설정처럼 어느 워크스페이스도 가리키지 않는 변경에는
> 해당하는 라벨이 없다. **라벨을 새로 만들지 않고 생략한다.** assignee 는 그대로 지정한다.

**이유**: 이 저장소는 브랜치 보호를 쓸 수 없어(§8) 자동화로 강제할 수단이 없다. assignee 가 비어
있으면 "누가 들고 있는 작업인지" 를 PR 목록에서 알 수 없고, 라벨이 없으면 영역별 필터가 무너진다.

이미 만든 PR 에 붙이려면:

```bash
gh pr edit <번호> --add-assignee @me --add-label frontend-web
```

### 크기

> **30파일 / 1,000줄을 넘으면 쪼갤 수 있는지 먼저 검토한다.**

넘겨야 한다면 PR 본문에 **왜 쪼갤 수 없는지** 적는다 (예: 초기 부트스트랩이라 중간 상태가 빌드되지 않음).

### 머지 조건

| 조건 | |
|------|---|
| **CI 통과** | 필수. `frontend-ci` 가 실패하면 머지하지 않는다 |
| **완료 체크리스트** | BE `backend/docs/done-checklist.md` / FE `frontend/docs/done-checklist.md` |
| 리뷰어 승인 | **현재는 선택.** 1인 개발 체제라 셀프 머지를 허용한다 |

> **셀프 머지를 허용하는 것이지 PR 을 생략하는 것이 아니다.** PR 은 변경 기록이자
> 되돌리기 단위다. develop 에 직접 커밋하지 않는다.
>
> 팀원이 늘면 이 표의 "리뷰어 승인"을 필수로 바꾼다.

## 7. 머지

**`Rebase and merge` 를 쓴다.** develop 을 선형으로 유지한다.

```bash
gh pr merge <번호> --rebase --delete-branch
```

- `Create a merge commit` / `Squash and merge` 를 쓰지 않는다.
- `--delete-branch` 로 원격 브랜치를 정리한다. 저장소 설정의 자동 삭제가 꺼져 있다.
- 로컬 정리:

```bash
git checkout develop && git pull --ff-only origin develop
git branch -d feature/fe/12-place-detail
```

### 머지 후 이슈 갱신 (필수)

> **머지로 작업이 끝나는 것이 아니다. 연결된 이슈의 체크박스를 갱신하고, 전부 끝났으면 닫는다.**

PR 템플릿의 `Issue Number: #N` 은 **GitHub 자동 닫기 키워드가 아니다.** 머지해도 이슈는 열려 있다.
(`Closes #N` 을 쓰면 자동으로 닫히지만, 이 저장소는 **판단해서 닫기 위해** 일부러 쓰지 않는다.)

| 상황 | 처리 |
|------|------|
| 완료 조건을 **전부** 만족 | 체크박스를 전부 체크하고 **이슈를 닫는다** |
| **남은 것이 있다** | **체크박스만 갱신하고 닫지 않는다.** 무엇이 왜 남았는지 코멘트로 남긴다 |

```bash
# 체크박스 갱신 — 본문을 받아 [ ] → [x] 로 고치고 되돌린다
gh issue view <번호> --json body -q .body > /tmp/issue.md
gh issue edit <번호> --body-file /tmp/issue.md

# 전부 끝났으면
gh issue close <번호> --comment "PR #<번호> 로 머지됐습니다."
```

**규칙**

- **실제로 끝낸 항목만 체크한다.** 안 한 것을 체크하면 이슈가 거짓 기록이 된다.
- 완료 조건에 없던 잔여 작업이 생겼으면 **체크박스를 추가한다.** 열린 상태가 스스로 설명되어야
  나중에 "이거 왜 안 닫혔지" 를 다시 조사하지 않는다.
- 닫지 않을 때는 **왜 못 했는지와 언제 할 수 있는지**를 코멘트에 적는다 (예: "백엔드 미기동이라
  Swagger 대조 불가 — 로컬 기동 후 `/fe-api-check`").
- 구현 도중 발견한 **다른 영역의 문제는 별도 이슈로 뗀다.** 원래 이슈에 매달아 두면 닫히지 않는다.

## 8. 브랜치 보호에 대해

이 저장소는 **비공개 무료 플랜이라 GitHub 브랜치 보호 규칙을 쓸 수 없다.**
develop 직접 푸시를 기술적으로 막을 방법이 없으므로 **규칙으로만 지킨다.**

공개 전환하거나 플랜을 올리면 아래를 설정한다.

- `develop` 직접 푸시 금지
- PR 머지 전 `frontend-ci` 통과 필수
- 머지 후 브랜치 자동 삭제

## 9. 요약 체크리스트

작업 시작 전:

- [ ] 이슈가 있다 (화면/기능 단위)
- [ ] `develop` 최신 상태에서 브랜치를 팠다
- [ ] 브랜치명이 `<type>/<영역>/<이슈번호>-<요약>` 이다

PR 올리기 전:

- [ ] develop 동기화를 **rebase** 로 했다 (머지 커밋 없음)
- [ ] 커밋이 의미 단위이고 prefix 가 맞다
- [ ] 완료 체크리스트를 통과했다
- [ ] 30파일을 넘으면 이유를 본문에 적었다
- [ ] **assignee 를 본인으로 지정했다**
- [ ] **라벨을 변경 범위에 맞게 붙였다** (이슈와 같은 라벨)

머지할 때:

- [ ] CI 통과
- [ ] `Issue Number` 가 채워져 있다
- [ ] **Rebase and merge** 로 머지하고 브랜치를 삭제했다

머지한 뒤:

- [ ] **이슈 체크박스를 실제 완료 여부대로 갱신했다**
- [ ] 완료 조건에 없던 잔여 작업이 있으면 **체크박스로 추가했다**
- [ ] **전부 끝났으면 이슈를 닫았고, 남은 게 있으면 이유를 코멘트로 남기고 열어 뒀다**
