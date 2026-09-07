# Claude Code 역할별 에이전트 운영 가이드

## 목적

작업의 난이도와 위험도에 맞춰 하위 에이전트(subagent)의 모델을 고른다. 단순 작업에 고비용 추론을 반복하지 않으면서, 버그·리팩토링·아키텍처 작업에는 충분한 검토 깊이를 확보하는 것이 목적이다.

이 문서는 [Codex 역할별 에이전트 운영 가이드](codex-agents.md)의 Claude Code 대응본이다. **역할 분류와 라우팅 판단은 두 호스트가 같고, 실행 수단만 다르다.** 공용 진입점은 `dev-orchestrator` 스킬이다.

정의 파일은 `.claude/agents/*.md`이므로 이 저장소를 여는 다른 PC와 세션에도 동일하게 적용된다. 개인 인증·권한 설정은 저장소에 넣지 않는다.

## 운영 결론

**모든 대화에서 에이전트를 자동으로 병렬 실행하지 않는다.** 역할 파일은 항상 발견 가능하게 두고, `dev-orchestrator`가 개발 작업을 분류해 필요한 역할만 호출한다.

- 명시 호출: `/dev-orchestrator 작업 내용`
- 암시 선택: 비단순 개발 요청이 스킬 설명과 일치할 때
- 직접 요청: 특정 역할이 필요하면 `explorer 로 호출 흐름을 조사해줘`처럼 요청

## Codex 설정과의 대응

| Codex | Claude Code |
|-------|-------------|
| `.codex/agents/<name>.toml` | `.claude/agents/<name>.md` |
| `name` / `description` | YAML frontmatter `name` / `description` |
| `developer_instructions` | frontmatter 아래 본문 (Markdown) |
| `model` | frontmatter `model` |
| `model_reasoning_effort` | **대응 필드 없음** — 모델 선택과 본문 지시로 흡수한다 |
| `sandbox_mode = "read-only"` | frontmatter `tools: Read, Grep, Glob, Bash` (Write/Edit 미부여) |
| `sandbox_mode = "workspace-write"` | `tools` 생략 (전체 도구 상속) |
| `[agents] max_concurrent_threads_per_session = 4` | **설정 키 없음** — 아래 병렬화 규칙으로 규율한다 |

- 이름은 각 호스트 관례를 따른다. Codex 는 snake_case(`crud_implementer`), Claude Code 는 kebab-case(`crud-implementer`)다. 역할과 모델 등급은 동일하다.
- 읽기 전용 강제는 Claude Code 에서 **도구 목록**으로 표현한다. `tools` 에 `Write`/`Edit` 를 넣지 않으면 그 역할은 파일을 고칠 수 없다. `Bash` 는 검사·테스트 실행용으로 부여하며, 본문에서 편집 금지를 명시한다.

## 역할과 모델

### 공용 역할 (Codex 7종 대응)

| 역할 | 모델 | 권한 | 사용 시점 |
|------|------|------|-----------|
| `explorer` | Sonnet | 읽기 전용 | 파일 탐색, 호출 흐름, 의존성·영향 범위 파악 |
| `crud-implementer` | Sonnet | 쓰기 | DTO·매핑·단순 검증·Swagger·설정·작은 테스트 |
| `implementer` | Opus | 쓰기 | 일반 기능과 **원인이 확정된** 버그 구현 |
| `bug-investigator` | Opus | 읽기 전용 | 어려운 버그·트랜잭션·동시성·데이터 정합성 원인 분석 |
| `reviewer` | Opus | 읽기 전용 | 최종 diff 의 정확성·회귀·보안·테스트 검토 |
| `refactorer` | Opus | 쓰기 | 동작 보존 리팩토링 구현 |
| `architect` | Fable | 읽기 전용 | 교차 모듈·MSA·보안·트랜잭션 설계 |

### 백엔드 전용 역할

`backend/docs/team-playbook.md` 가 정의한 역할의 실행 파일이다. Leader 는 메인 실행자가 맡으므로 파일이 없다.

| 역할 | 모델 | 권한 | 사용 시점 |
|------|------|------|-----------|
| `be-executor` | Opus | 쓰기 | Hexagonal 계층·Port/Adapter 실구현 |
| `be-hexagonal-reviewer` | Opus | 읽기 전용 | 계층 흐름과 Port/Adapter 경계 검토 |
| `be-db-reviewer` | Opus | 읽기 전용 | 엔티티·쿼리·인덱스·Redis 키 검토 (N+1 우선) |
| `be-security-reviewer` | Opus | 읽기 전용 | JWT·인가·게이트웨이·비밀정보 검토 (보안 변경 시에만) |

### 프론트엔드 전용 역할

`.claude/agents/fe-*.md` 7종 — `fe-spec-writer`, `fe-implementer`, `fe-reviewer`, `fe-api-contract`, `fe-design-reviewer`, `fe-test-author`, `fe-map-reviewer`. 세부는 `frontend/docs/team-playbook.md`.

**FE 역할의 모델 배정은 아직 하지 않았다.** 모델을 명시하지 않은 에이전트는 세션 기본 모델을 쓴다. 프론트 담당이 별도 이슈로 정한다.

### 모델 가용성

`fable` 을 쓸 수 없는 계정에서는 `architect` 가 세션 기본 모델로 떨어지거나 호출이 거절될 수 있다. 아키텍처 작업을 시작하기 전에 `.claude/agents/architect.md` 의 `model` 을 팀이 합의한 대체 모델(`opus`)로 조정하거나, 제한을 메인 실행자에게 보고한다.

## 작업별 라우팅

| 작업 | 기본 흐름 | 병렬화 |
|------|-----------|--------|
| 단순 CRUD | `crud-implementer` → 대상 테스트 | 없음 |
| 일반 기능 (BE) | 필요 시 `explorer` → `be-executor` → 위험할 때 `be-hexagonal-reviewer` | 보통 없음 |
| 일반 기능 (FE) | 필요 시 `explorer` → `fe-implementer` → `fe-reviewer` | 보통 없음 |
| 일반 기능 (공통) | 필요 시 `explorer` → `implementer` → 위험할 때 `reviewer` | 보통 없음 |
| 어려운 버그 | `bug-investigator` + `explorer` → 원인 확정 → `implementer` → `reviewer` | 앞의 읽기 역할만 |
| 리팩토링 | `explorer` + `reviewer` → 범위 확정 → `refactorer` → `reviewer` | 최초 읽기 역할만 |
| 아키텍처 | `architect` + `explorer` → 설계 확정 → 단일 구현자 → `reviewer` | 설계·탐색만 |
| DB/쿼리 구조 변경 | `be-executor` → `be-db-reviewer` + `be-hexagonal-reviewer` | 검토 역할만 |
| 보안/인증 변경 | `be-executor` → `be-security-reviewer` + `be-hexagonal-reviewer` | 검토 역할만 |
| 대형 기능 | 워크스페이스 멀티 에이전트 스킬로 발견 작업 분리 → 통합 계획 → 순차 구현 | 독립적인 읽기 역할만 |

## 병렬화 규칙

Claude Code 에서 병렬 실행은 **한 메시지 안에 여러 Agent 호출을 넣는 것**이다. 메시지를 나눠 보내면 순차 실행된다.

병렬화해도 되는 작업:

- 저장소 탐색과 의존성 분석
- API·테스트 공백·로그 조사
- 아키텍처·보안·DB 검토
- 서로 파일과 외부 상태를 바꾸지 않는 읽기 전용 검토

병렬화하지 않는 작업:

- 같은 파일이나 같은 공개 계약 편집
- DB 스키마와 공유 도메인 객체 변경
- 여러 구현자가 하나의 기능을 동시에 수정하는 작업
- 커밋·푸시·이슈·PR 생성 같은 저장소 통합 작업

동시 실행은 **읽기 전용 역할 2~3개**를 상한으로 본다. 상한을 채우는 것이 목표가 아니며, 보통 1~2개면 충분하다.

**하위 에이전트는 다시 하위 에이전트를 생성하지 않는다.** 모든 역할 파일에 이 금지가 들어 있다. 추가 위임이 필요하면 메인 실행자가 작업 경계를 다시 나눈다.

## 결과를 다루는 방법

- **검토 보고를 그대로 믿지 않는다.** 근거(파일·행·증거)가 없는 지적은 메인 실행자가 확인한 뒤 반영한다.
- 하위 에이전트가 "검증을 통과했다" 고 보고해도, 최종 완료 보고 전에 메인 실행자가 검증 명령을 한 번 더 돌린다.
- 역할 간 지적이 충돌하면 해당 워크스페이스 `docs/*.md` 를 정본으로 판정한다.

## 완료 조건

1. 요청한 동작이 구현되었다.
2. 영향 범위가 컴파일되고 관련 테스트가 통과했다.
3. 필요한 수준의 최종 검토가 끝났다.
4. CRITICAL/HIGH 지적이 해결되었다.
5. 불필요한 변경과 겹치는 동시 편집이 없다.
6. 실제 실행한 검증과 남은 위험을 메인 실행자가 보고한다.

## 프로젝트 스킬과의 관계

- `dev-orchestrator` — 전체 작업 분류와 역할·모델 선택 (공용 진입점)
- `backend-multi-agent` — 백엔드 대형 작업의 역할 구성
- `fe-multi-agent` — 프론트엔드 대형 작업의 역할 구성
- `backend-api-check`, `hexagonal-guard`, `fe-api-check`, `fe-boundary-guard` — 구현 후 특정 계약·경계 검증

`dev-orchestrator` 가 기존 스킬을 대체하지 않는다. 먼저 비용과 실행 순서를 정하고, 필요한 프로젝트 전문 스킬을 결합한다.

## 검증

에이전트 정의를 바꾸면 다음을 확인한다.

```bash
sh scripts/check-claude-agents.sh    # frontmatter, name↔파일명, model, 읽기 전용 권한, BOM
python scripts/sync-agent-skills.py --check
git diff --check
```

`check-claude-agents.sh` 는 Python 이 아니라 sh 로 쓰여 있다. Windows 개발 PC 에 Python 이 설치되지 않은 경우(Microsoft Store 스텁만 있으면 `python` 이 exit 49 로 죽는다)가 있어서, `.githooks/pre-push` 와 같은 런타임을 쓴다.

**읽기 전용 역할을 추가하면 스크립트의 `read_only_roles` 목록에도 이름을 넣는다.** `tools` 를 생략한 에이전트는 전체 도구를 상속해 조용히 쓰기 권한을 갖게 되는데, 목록에 없으면 그것을 아무도 잡지 못한다.

새 역할을 추가하면 이 문서의 표와 `dev-orchestrator` 스킬의 역할 표를 함께 갱신한다.

## 주의: 사용자 전역 에이전트와의 충돌

사용자 전역(`~/.claude/agents/`)에 같은 이름의 다른 프로젝트용 에이전트가 있을 수 있다. **이 저장소의 프로젝트 스코프 정의가 우선한다.** BossPickSeoul 경로·Swagger URL 이 등장하면 잘못된 에이전트를 읽고 있는 것이다.

## 공식 문서

- [Claude Code Subagents](https://docs.claude.com/en/docs/claude-code/sub-agents)
- [Claude Code Settings](https://docs.claude.com/en/docs/claude-code/settings)
