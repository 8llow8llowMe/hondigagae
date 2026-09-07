# 혼디가개 Claude Guide

## 목적

- 이 문서는 저장소 **루트**에서 작업을 시작할 때 Claude Code가 먼저 확인하는 엔트리다.
- 실제 규칙의 정본은 각 워크스페이스의 `docs/`다. 이 문서는 지도 역할만 한다.

## 워크스페이스

| 경로 | 대상 | 엔트리 문서 | 규칙 정본 |
|------|------|-------------|-----------|
| `backend/` | Spring MSA + Hexagonal | `backend/CLAUDE.md` | `backend/docs/*.md` |
| `frontend/` | Next.js App Router | `frontend/CLAUDE.md` | `frontend/docs/*.md`, `frontend/DESIGN.md` |

**작업 시작 시 해당 워크스페이스의 엔트리 문서를 먼저 읽는다.** 두 워크스페이스에 걸친 작업이면 양쪽 다 읽는다.

## 서비스 개요

관광 데이터 기반 반려견 맞춤 여행 설계 서비스 (2026 관광데이터 활용 공모전). 서비스 소개와 AI 기능 후보 풀은 `README.md` 참고.

**AI 기능 10종은 후보 상태이며 선정 전이다.** 선정되지 않은 기능은 구현하지 않는다.

## 공통 규칙

### 파일 인코딩 (필수)

- **모든 소스 / 설정 / 문서 파일은 반드시 `UTF-8` (no BOM) 로 저장한다.**
- Windows는 기본이 CP949이므로 에디터/도구가 CP949로 저장하면 한글이 깨진다.
- 강제 설정이 적용되어 있으니 덮어쓰지 말 것:
  - `.editorconfig` — `charset = utf-8`
  - `.gitattributes` — `working-tree-encoding=UTF-8` (java/kt/md/yml/ts/tsx/json/css 등)
- `git status` 에서 수정한 적 없는데 diff가 잡히면 인코딩 문제를 의심한다.

### 커밋 / PR / 이슈 prefix

| prefix | 범위 |
|--------|------|
| `[BE]` | `backend/` 런타임 코드 |
| `[FE]` | `frontend/` 런타임 코드 |
| `[DOCS]` | 문서만 변경 |
| `[INFRA]` | 빌드·CI·Claude 설정·저장소 공통 설정 |

형식: `[FE] feat: 장소 목록 무한 스크롤 구현`

타입은 `feat` / `fix` / `chore` / `refactor` / `style` / `docs` / `test` (`.github/PULL_REQUEST_TEMPLATE.md` 기준).

### Git 협업 워크플로 (필수)

**정본: [docs/git-workflow.md](docs/git-workflow.md)**

```text
이슈 → 브랜치 → 작업 → PR → CI 통과 → Rebase and merge → 브랜치 삭제
```

- **이슈 없이 브랜치를 만들지 않는다.** 이슈는 **화면/기능 단위**로 쪼갠다.
- 브랜치명: `<type>/<영역>/<이슈번호>-<요약>` (예: `feature/fe/12-place-detail`)
  - `영역` = `fe` / `be` / `infra` / `common`
- **develop 동기화는 `merge` 가 아니라 `rebase`.** 머지 커밋이 섞이면 선형 히스토리가 깨진다.
- **`develop` 에 직접 커밋하지 않는다.** 셀프 머지는 허용하되 PR 은 생략하지 않는다.
- 머지는 **`Rebase and merge`** 만 쓴다. PR 본문의 `Issue Number` 를 반드시 채운다.
- PR 은 **30파일 이내**를 목표로 하고, 넘으면 이유를 본문에 적는다.

### 작업 워크플로우

전역 4단계(Specify → Plan → Tasks → Decisions)를 따르고, 각 단계의 실행 방법은 superpowers 스킬을 쓴다.

- 신규 기능 → `superpowers:brainstorming` → 명세 작성 → `superpowers:writing-plans`
- 버그 → `superpowers:systematic-debugging` (근본원인 없이 고치지 않는다)
- 완료 보고 직전 → `superpowers:verification-before-completion`

**내용 판단(무엇이 정본인가, 무엇을 지켜야 하는가)은 항상 프로젝트 문서가 우선한다.**

### 운영 원칙

- 엔트리 문서는 얇게 유지하고, 세부 규칙은 각 워크스페이스 `docs/`에 모은다.
- 구현 중 새 규칙이 생기면 엔트리 문서보다 해당 `docs/*.md`를 먼저 갱신한다.
- 코드 변경과 문서 변경은 같이 움직인다.
- 새 반복 패턴이 생기면 `.agents/skills/` 공용 스킬화를 검토하고 `.claude/skills/` 미러를 동기화한다.

## 스킬 / 에이전트

스킬 정본은 `.agents/skills/*`이고 Claude Code 호환 미러는 `.claude/skills/*`다. 관리 규칙은 [docs/agent-skills.md](docs/agent-skills.md)를 따른다. Claude Code에서는 `/스킬명`으로 호출한다.

| 구분 | 백엔드 | 프론트엔드 | 공통 |
|------|--------|------------|------|
| 착수 | `backend-feature-bootstrap` | `fe-feature-bootstrap` | |
| 계약 점검 | `backend-api-check` | `fe-api-check` | |
| 경계 점검 | `hexagonal-guard` | `fe-boundary-guard` | |
| 멀티 에이전트 | `backend-multi-agent` | `fe-multi-agent` | |
| 개발 오케스트레이션 | | | `dev-orchestrator` |
| 협업 문서 | | | `issue`, `pr`, `mr` |

작업 상태 동기화(`/sync` · `/sync out`)는 이 저장소 스킬이 아니라 **전역 스킬**이다 (`seonghoho/dev-dotfiles` → `~/.claude/skills/sync`). 이 저장소의 규칙은 `docs/git-workflow.md` 를 정본으로 읽어 적용한다.

### 역할별 subagent

정의는 `.claude/agents/*.md`이고 역할·모델·권한의 정본은 [docs/claude-agents.md](docs/claude-agents.md)다. Codex 쪽 대응본은 [docs/codex-agents.md](docs/codex-agents.md).

| 구분 | 역할 |
|------|------|
| 공용 | `explorer`, `crud-implementer`, `implementer`, `bug-investigator`, `reviewer`, `refactorer`, `architect` |
| 백엔드 | `be-executor`, `be-hexagonal-reviewer`, `be-db-reviewer`, `be-security-reviewer` |
| 프론트엔드 | `fe-spec-writer`, `fe-implementer`, `fe-reviewer`, `fe-api-contract`, `fe-design-reviewer`, `fe-test-author`, `fe-map-reviewer` |

- 모델 배정: 설계·아키텍처는 **Fable**, 어려운 구현·버그 분석·리팩토링·최종 검토는 **Opus**, 탐색·DTO·매핑 같은 저비용 반복은 **Sonnet**. (FE 역할 7종은 모델 미배정 — 세션 기본 모델을 쓴다)
- 검토 역할은 `tools` 로 읽기 전용을 강제한다. Write/Edit를 부여하지 않는다.
- **모든 작업을 병렬화하지 않는다.** 서로 독립적인 읽기 전용 조사·검토만 한 메시지 안에서 병렬 호출하고, 같은 파일을 고치는 쓰기 역할은 한 번에 하나만 실행한다.
- 작업 분류와 라우팅은 `dev-orchestrator` 스킬을 쓴다.
- 정의를 바꾸면 `sh scripts/check-claude-agents.sh` 로 검사한다.

세부 역할 조합은 `backend/docs/team-playbook.md`, `frontend/docs/team-playbook.md`.

> **주의**: 사용자 전역(`~/.claude/agents/`)에 같은 이름의 다른 프로젝트용 에이전트가 있을 수 있다. 이 저장소의 프로젝트 스코프 정의가 우선하며, **BossPickSeoul 경로·Swagger URL이 등장하면 잘못된 에이전트를 읽고 있는 것이다.**
>
> 공용 역할 이름(`explorer`, `implementer`, `reviewer` 등)은 일반적이라 전역 정의와 겹치기 쉽다. 역할이 이 저장소 규칙(Hexagonal 계층, `/api/bff`, `pnpm verify`)을 모르는 것처럼 굴면 전역 정의를 읽고 있는지 의심한다.
