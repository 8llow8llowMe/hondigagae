# Codex 어댑터

Codex에서 `dev-orchestrator`를 실행할 때의 모델 선택이다. 작업 유형과 `T0`–`T3` 판정은 [SKILL.md](../SKILL.md)를 따른다. 역할 파일과 권한의 정본은 [docs/codex-agents.md](../../../../docs/codex-agents.md)다.

## 호출

- 명시 호출: `$dev-orchestrator 작업 내용`
- 역할 파일을 고르기 전에 `TYPE`과 `COMPLEXITY`를 정한다.
- 하위 에이전트를 만들 때 `model`과 `model_reasoning_effort`를 이 표의 칸으로 지정한다.
- `fork_turns`로 부모 기록을 통째로 넘기지 않는다. 부모 모델과 추론 강도가 그대로 따라오고, spawn 시 지정이 적용되지 않는다.

## 역할 파일과 추론 강도

`.codex/agents/*.toml`은 **모델만** 고정한다. `model_reasoning_effort`는 파일에 두지 않는다. Codex는 커스텀 에이전트 파일에 적힌 모델·추론 강도를 spawn 요청보다 우선하므로, 파일에 강도를 고정하면 `T3` 승격이 막힌다.

강도를 지정하지 않은 직접 호출은 [`.codex/config.toml`](../../../../.codex/config.toml)의 `default_subagent_reasoning_effort`(`medium`)로 떨어진다. 오케스트레이터 경유 호출은 항상 아래 표를 지정한다.

계정에 해당 모델이나 `xhigh`가 없으면 같은 역할의 바로 아래 칸(`xhigh` → `high`, `high` → `medium`)으로 내리고, 보고에 그 사실을 적는다. `max`와 `ultra`는 이 표의 승격 단계가 아니다.

## 복잡도별 모델

| 역할 | T0 | T1 | T2 | T3 |
|------|----|----|----|----|
| `explorer` | `gpt-6-luna` / `low` | `gpt-6-luna` / `low` | `gpt-6-luna` / `medium` | `gpt-6-luna` / `medium` |
| `crud_implementer` | `gpt-6-luna` / `medium` | `gpt-6-luna` / `medium` | 구현을 `implementer`로 재분류 | 구현을 `implementer`로 재분류 |
| `implementer` | `gpt-6.1-sol` / `medium` | `gpt-6.1-sol` / `medium` | `gpt-6.1-sol` / `high` | `gpt-6.1-sol` / `xhigh` |
| `bug_investigator` | 호출하지 않음 | `gpt-6.1-sol` / `high` | `gpt-6.1-sol` / `high` | `gpt-6.1-sol` / `xhigh` |
| `reviewer` | 생략 가능 | `gpt-6.1-sol` / `medium` | `gpt-6.1-sol` / `high` | `gpt-6.1-sol` / `xhigh` |
| `refactorer` | 호출하지 않음 | `gpt-6.1-sol` / `medium` | `gpt-6.1-sol` / `high` | `gpt-6.1-sol` / `xhigh` |
| `architect` | 호출하지 않음 | 호출하지 않음. 설계가 필요하면 `T2`로 올린다 | `gpt-6-astra` / `high` | `gpt-6-astra` / `xhigh` |

`explorer`는 `T3`에서도 Luna `medium`이다. 관련 파일, 호출 관계, Port·Adapter 위치를 찾는 일이라 추론 깊이보다 읽기 속도가 중요하다.

`crud_implementer`의 역할 파일은 `gpt-6-luna`라서 spawn으로 Sol을 덮어쓸 수 없다. `T2` 이상이면 단순 구현으로 끝낼 수 없는 작업이므로 `implementer` 칸을 쓴다.

`architect`의 역할 파일은 `gpt-6-astra`다. `T1` 설계를 Sol로 바꾸려고 이 역할을 부르지 않는다. 서비스 전역이 아닌 설계는 `implementer`가 맡고, Astra는 `T2`부터 쓴다.

## 역할 파일의 기본 모델

| 역할 | 파일에 고정된 모델 | 파일의 의미 |
|------|-------------------|-------------|
| `explorer` | `gpt-6-luna` | 탐색 |
| `crud_implementer` | `gpt-6-luna` | 범위가 닫힌 단순 구현 |
| `implementer` | `gpt-6.1-sol` | 일반 구현과 원인이 확정된 수정 |
| `bug_investigator` | `gpt-6.1-sol` | 원인 분석 |
| `reviewer` | `gpt-6.1-sol` | 최종 검토 |
| `refactorer` | `gpt-6.1-sol` | 동작 보존 리팩토링 |
| `architect` | `gpt-6-astra` | 교차 모듈·서비스 경계 설계 |

메인 세션의 기본 모델은 `gpt-6.1-sol` / `medium`으로 둔다. `high`와 `xhigh`는 이 표의 칸에 해당하는 하위 역할에만 지정한다.

## 예시

회원 닉네임 수정 API, 위치와 계약이 분명할 때:

- `TYPE: FEATURE`
- `COMPLEXITY: T0`
- `explorer` 생략
- `crud_implementer` → Luna `medium`
- `reviewer` 생략. 대상 테스트만 실행

운영 멀티 인스턴스에서만 RabbitMQ 소비 이벤트가 간헐적으로 두 번 처리되고, Redis 분산락과 DB 트랜잭션이 함께 있을 때:

- `TYPE: BUG`
- `COMPLEXITY: T3` (재처리, 분산락, 멀티 인스턴스 race, 원인 미상)
- `explorer` → Luna `medium`
- `bug_investigator` → Sol `xhigh`
- 원인 확정 후 `implementer` → Sol `high`
- `reviewer` → Sol `xhigh`
