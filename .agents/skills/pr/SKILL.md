---
name: pr
description: "혼디가개(hondigagae) GitHub Pull Request 본문을 한국어 템플릿으로 작성할 때 사용한다. /pr 또는 $pr 요청, PR body, pull request template, PR description, [BE]/[FE] feat: ... 제목 생성이 트리거다."
---

# PR Draft

혼디가개 Pull Request 본문과 제목을 한국어 템플릿으로 작성한다.

## Read First

- [docs/git-workflow.md](../../../docs/git-workflow.md) — PR 규칙과 머지 방식

핵심:
- **`Issue Number: #N` 을 반드시 채운다.** 비워 두지 않는다.
- **PR 생성 시 assignee 와 라벨을 함께 지정한다.** 나중에 붙이려고 미루지 않는다 (`git-workflow.md` §6).
- 머지는 **`Rebase and merge`** 만 쓴다 (`gh pr merge <번호> --rebase --delete-branch`).
- **30파일 / 1,000줄을 넘으면** 쪼갤 수 있는지 검토하고, 넘겨야 하면 **이유를 본문에 적는다.**
- CI 통과가 머지 조건이다.

## 생성 명령

```bash
gh pr create --base develop \
  --title "[FE] feat: 장소 상세 화면 구현" \
  --body-file <본문> \
  --assignee @me \
  --label frontend-web
```

| 변경 범위 | 라벨 |
|-----------|------|
| `frontend/` | `frontend-web` |
| `backend/service/<name>-service` | `backend-<name>-service` (`tour` / `auth` / `plan` / `ai` / `batch`) |
| `backend/core/**` | `backend-core` |
| 게이트웨이 / 유레카 | `backend-api-gateway` / `backend-service-discovery` |
| 백엔드 문서 | `backend-docs` |

여러 영역에 걸치면 `--label` 을 반복해 **모두** 붙인다.
이미 만든 PR 은 `gh pr edit <번호> --add-assignee @me --add-label <라벨>` 로 보정한다.

## Workflow

1. 변경 범위를 확인한다. 가능하면 `git status`, `git diff --stat`, `git log --oneline`을 참고한다.
2. 제목은 `[영역] type: 요약` 형식으로 만든다. 예: `[BE] feat: AI 여행 플래너 일정 생성 API 구현`, `[FE] feat: 장소 목록 무한 스크롤 구현`
3. 본문은 바로 복사 가능한 Markdown만 출력한다.
4. 실제 확인하지 않은 체크박스는 체크하지 않는다.
5. 이슈 번호가 없으면 `Issue Number: #`로 둔다.
6. **assignee(`@me`)와 라벨을 빠뜨리지 않는다.** 라벨은 변경 범위로 정한다 — `git status` 로 어느 워크스페이스가 바뀌었는지 확인한다.

## Template

```markdown
## 📝 작업 내용

[작업 내용을 2~4문장으로 요약]

### 주요 변경 사항

1. [주요 변경 1]
2. [주요 변경 2]
3. [주요 변경 3]

## 타입

- [ ] feat: 새로운 기능 추가
- [ ] fix: 버그 수정
- [ ] chore: 빌드 업무 수정, 패키지 매니저 수정
- [ ] refactor: 코드 리펙토링
- [ ] style: 코드 포맷팅, 세미콜론 누락, 코드 변경이 없는 경우
- [ ] docs: 문서 수정
- [ ] test: 테스트 코드, 리펙토링 테스트 코드 추가

## PR 하기 전에 확인해주세요

- [ ] 코딩 컨벤션을 지켰나요?
- [ ] local ci test를 진행하셨나요?
- [ ] 팀원들에게 공지하셨나요?

## 검증 내역

- [검증 명령 또는 확인 내용]

## 참고 사항

- [리뷰어가 알아야 할 점]

## 연관된 이슈

Issue Number: #
```

## Rules

- 한국어로 쓴다.
- 제목 prefix는 `[BE]` / `[FE]` / `[DOCS]` / `[INFRA]` 중 변경 범위에 맞는 것을 쓴다 (루트 `CLAUDE.md` 기준).
  - `backend/` 런타임 코드 → `[BE]`
  - `frontend/` 런타임 코드 → `[FE]`
  - 문서만 → `[DOCS]` / 빌드·CI·Claude 설정 → `[INFRA]`
- 기능 단위로 묶고 파일 나열식 changelog를 피한다.
- 검증 내역은 실제로 돌린 명령을 적는다.
  - 백엔드: `./gradlew compileJava` / `test` / `check`
  - 프론트엔드: `pnpm lint` / `pnpm typecheck` / `pnpm test`
- 검증 실패나 미실행은 숨기지 않는다.
- secret, token, private key, password는 포함하지 않는다.
