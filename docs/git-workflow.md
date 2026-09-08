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

> **클론 직후 한 번은 훅을 켠다** — `git config core.hooksPath .githooks` (§8-3).
> 저장소마다 한 번이면 되고, 켜 두면 프론트 검사를 빠뜨린 push 가 걸린다.

## 4. 커밋

- 형식: `[영역] type: 요약` — 루트 `CLAUDE.md` 기준
- **의미 단위로 나눈다.** `Rebase and merge` 라서 **커밋이 그대로 develop 에 남는다.**
  "wip", "fix typo" 같은 커밋을 남기지 않는다. 필요하면 `git rebase -i` 로 정리한다.

### 4-1. 작업 트리를 혼자 쓰지 않는다

**같은 작업 트리에서 다른 세션·사람이 동시에 파일을 고치고 있을 수 있다.** 2026-09-08 에
실제로 겪었다 — 세션 시작 때 `git status` 가 깨끗했는데, 작업 중 다른 쪽이 같은 트리에서
홈 화면 16파일을 건드리기 시작했고 하마터면 한 커밋에 섞일 뻔했다.

| 하지 않는다 | 대신 |
|-------------|------|
| `git add -A` · `git add .` | **경로를 하나씩 적는다.** 커밋 전에 `git diff --cached --name-only` 로 확인한다 |
| `git stash` | 남의 진행 중 작업을 통째로 치운다. 중간 상태를 검증해야 하면 **워크트리**를 쓴다 (아래) |
| `SKIP_HOOKS=1` 로 pre-push 훅 끄기 | 훅이 남의 미완성 파일에 걸린 것이다. **깨끗한 워크트리에서 push 한다** (아래) |
| 남의 파일에 `prettier --write` | 같은 이유. 내 변경이 아닌 파일을 고치지 않는다 |

**커밋 전에 항상 `git status --short` 로 내 것이 아닌 변경이 있는지 먼저 본다.**

`.githooks/pre-push` 는 **작업 트리 기준**으로 `pnpm format:check && pnpm verify` 를 돈다.
그래서 남의 미완성 파일 하나로 내 push 가 막힌다. 훅을 끄지 말고 푸시할 커밋만 담긴
워크트리에서 민다.

```bash
git worktree add --detach <scratch>/wt HEAD
ln -s "$(pwd)/frontend/node_modules" <scratch>/wt/frontend/node_modules
cd <scratch>/wt && git push -u origin HEAD:refs/heads/<branch>
```

`tsc` · `vitest` · `eslint` · `prettier` 는 심볼릭 링크한 `node_modules` 로 충분하다
(Turbopack 은 아니다 — `frontend/docs/local-run-guide.md`).

**훅을 끄는 쪽이 더 나쁜 이유**: 이 저장소는 free 플랜이라 required status check 가 없다
([#286](https://github.com/8llow8llowMe/hondigagae/issues/286)). 훅이 develop 빨간불을 막는
마지막 문턱이다.

> 리베이스 머지 뒤 `git branch -d` 가 거부하면 `git cherry -v develop <branch>` 로 전부
> `-` 인지(= 이미 develop 에 있음) 확인하고 `-D` 한다.

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

**이유**: 라벨은 **배포 대상을 정하는 값**이다. Jenkins 가 PR 라벨로 배포 스코프를 정하고
라벨이 없으면 배포하지 않는다(fail-closed). 라벨을 빠뜨린 PR 은 머지돼도 배포가 나가지
않는다 — [#217](https://github.com/8llow8llowMe/hondigagae/pull/217) ·
[#219](https://github.com/8llow8llowMe/hondigagae/pull/219) ·
[#223](https://github.com/8llow8llowMe/hondigagae/pull/223) 이 그랬다.
assignee 가 비어 있으면 "누가 들고 있는 작업인지" 를 PR 목록에서 알 수 없다.

#### 라벨은 자동으로도 붙는다 — 그래도 확인은 한다

`.github/workflows/label.yml` 이 **경로를 보고 라벨을 붙인다** (매핑은
`.github/labeler.yml`). 위 표를 그대로 자동화한 것이라, 보통은 손으로 붙일 필요가 없다.

**더하기만 한다** (`sync-labels: false`) — 사람이 넓혀 둔 스코프를 지우지 않는다.

**자동으로 다 되지 않는 경우가 하나 있다.** `backend/core/**` 는 공용 모듈이라 바뀌면 그것을
쓰는 서비스 전부의 런타임이 바뀌는데, Jenkins 배포 스코프는 `backend-{service}` 단위다.
그래서 `backend-core` 만 붙은 PR 은 **아무 서비스도 배포되지 않는다.** 자동으로 5개 서비스를
다 붙이지도 않는다 — "의도한 대상만 배포한다" 가 fail-closed 설계의 요점이라, 자동으로 전체
배포를 열면 그 설계가 무너진다. **core 를 건드렸다면 배포할 서비스 라벨을 직접 더한다.**

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

- `Create a merge commit` / `Squash and merge` 는 **저장소 설정에서 껐다** — UI 에 뜨지 않는다 (§8-1).
- `--delete-branch` 는 그대로 쓴다. 저장소 자동 삭제를 켜 뒀지만(§8-1) 명령에 남겨 두면
  **로컬에서 바로 결과를 확인할 수 있고**, 설정이 되돌려져도 브랜치가 남지 않는다.
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

## 8. 강제되는 것과 규칙으로만 지키는 것

이 저장소는 **비공개 무료 플랜이라 GitHub 브랜치 보호 규칙을 쓸 수 없다.**

```text
GET /repos/8llow8llowMe/hondigagae/branches/develop/protection
→ 403 "Upgrade to GitHub Pro or make this repository public to enable this feature."
```

**그래도 무료로 강제할 수 있는 것이 있고, 그것부터 걸어 뒀다** ([#286](https://github.com/8llow8llowMe/hondigagae/issues/286)).

### 8-1. 이미 강제된다

| 규약                    | 강제 수단                                            |
| ----------------------- | ---------------------------------------------------- |
| Rebase and merge 만 쓴다 | 저장소 설정에서 **Squash · Merge commit 을 껐다**     |
| 머지 후 브랜치 삭제      | 저장소 설정 **Automatically delete head branches** 켬 |
| PR 라벨 (배포 대상)      | `.github/workflows/label.yml` — **경로 기반 자동 부여** |
| CI 빨간불을 develop 에 올리지 않기 | `.githooks/pre-push` (§8-3) — push 단계에서 끊는다 |

머지 방식은 이제 GitHub UI 에도 `Rebase and merge` 하나만 뜬다. **머지 커밋이 섞여 선형
히스토리가 깨지는 일이 설정으로 막혀 있다.**

### 8-2. 아직 규칙으로만 지킨다

브랜치 보호가 필요한 것들이다. **공개 전환 또는 플랜 업그레이드가 정해지면** 건다.

- `develop` **직접 푸시 금지** (§1 이 금지하지만 기술적으로는 열려 있다)
- PR 머지 전 **`verify` 통과 필수** (required status check)
- Jenkins `pr-merge` 도 필수 — Jenkins 는 통과했는데 Actions 만 빨간 경우가 있었다

> **이게 왜 급한지** — [#282](https://github.com/8llow8llowMe/hondigagae/pull/282) 가
> `verify` **실패 상태로 머지**돼 develop 이 빨간불이 됐다. GitHub Actions 는 PR 을
> **현재 develop 에 머지한 트리**로 빌드하므로, 그동안 **뒤따르는 모든 PR 이 그 실패를
> 물려받는다** — [#283](https://github.com/8llow8llowMe/hondigagae/pull/283) 이 건드리지도
> 않은 파일 때문에 빨간불이 됐고 원인 추적에 시간이 들었다.

### 8-3. pre-push 훅 — **한 번 켜 두면 된다**

```bash
git config core.hooksPath .githooks
```

**`frontend/` 가 한 줄이라도 바뀐 push 에서 `format:check` + `verify` 를 돌린다.**
작업 영역과 무관하다 — #282 는 백엔드 PR 이었고 프론트 문서 하나를 함께 고쳤다.
"나는 백엔드 작업이니 프론트 검사는 필요 없다" 는 판단이 정확히 그 사고를 만들었다.

백엔드는 돌리지 않는다 — `./gradlew check` 가 분 단위라 push 훅에 맞지 않다.

일회성으로 건너뛰려면 `SKIP_HOOKS=1 git push`. **머지를 막는 장치가 아니라 실수를 줄이는
장치다** — 진짜 강제는 8-2 가 열려야 한다.

## 9. 요약 체크리스트

작업 시작 전:

- [ ] 이슈가 있다 (화면/기능 단위)
- [ ] `develop` 최신 상태에서 브랜치를 팠다
- [ ] 브랜치명이 `<type>/<영역>/<이슈번호>-<요약>` 이다
- [ ] **훅을 켰다** — `git config core.hooksPath .githooks` (클론당 한 번, §8-3)

PR 올리기 전:

- [ ] develop 동기화를 **rebase** 로 했다 (머지 커밋 없음)
- [ ] 커밋이 의미 단위이고 prefix 가 맞다
- [ ] 완료 체크리스트를 통과했다
- [ ] 30파일을 넘으면 이유를 본문에 적었다
- [ ] **assignee 를 본인으로 지정했다**
- [ ] **라벨을 확인했다** — 자동 부여되지만 `backend/core/**` 는 배포할 서비스 라벨을 직접 더한다 (§6)

머지할 때:

- [ ] CI 통과 — **`verify` 와 Jenkins 둘 다.** 빨간불로 머지하면 develop 이 오염되고
      뒤따르는 모든 PR 이 그 실패를 물려받는다 (§8-2)
- [ ] `Issue Number` 가 채워져 있다
- [ ] **Rebase and merge** 로 머지하고 브랜치를 삭제했다

머지한 뒤:

- [ ] **이슈 체크박스를 실제 완료 여부대로 갱신했다**
- [ ] 완료 조건에 없던 잔여 작업이 있으면 **체크박스로 추가했다**
- [ ] **전부 끝났으면 이슈를 닫았고, 남은 게 있으면 이유를 코멘트로 남기고 열어 뒀다**
