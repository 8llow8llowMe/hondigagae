# 에이전트 공용 스킬 관리

## 목적

혼디가개 프로젝트 스킬을 Claude Code, Codex, Cursor에서 같은 내용으로 사용한다. 프로젝트 고유 규칙의 정본은 기존처럼 각 워크스페이스의 `docs/`이며, 스킬은 해당 규칙을 작업별로 불러오는 진입점이다.

## 디렉터리와 호출 방식

| 대상 | 발견 경로 | 호출 방식 |
|------|-----------|-----------|
| Codex | `.agents/skills/<name>/SKILL.md` | `$name` |
| Cursor | `.agents/skills/<name>/SKILL.md` | `/name` |
| Claude Code | `.claude/skills/<name>/SKILL.md` | `/name` |

- `.agents/skills/`를 공용 정본으로 사용한다.
- `.claude/skills/`는 Claude Code가 발견할 수 있도록 같은 파일을 유지하는 호환 미러다.
- 두 디렉터리의 스킬 이름, 파일 집합, 파일 내용은 byte 단위로 같아야 한다.
- Cursor가 호환 경로도 발견하더라도 동일한 이름과 내용이므로 어느 항목을 사용해도 동작은 같다.

## 변경 절차

1. `.agents/skills/<name>/`의 스킬을 수정하거나 추가한다.
2. 아래 명령으로 Claude Code 미러를 갱신한다.

   ```bash
   python scripts/sync-agent-skills.py --write
   ```

3. 아래 명령으로 파일 집합, 내용, frontmatter, UTF-8 no BOM을 검사한다.

   ```bash
   python scripts/sync-agent-skills.py --check
   ```

4. 새 스킬이면 이름과 설명이 실제 사용 시점을 구분하는지 확인한다. 상세 규칙은 `docs/`에 두고 `SKILL.md`에는 작업 흐름과 필요한 문서 링크만 둔다.

## 호스트 독립성

- 스킬 본문에 특정 호스트의 도구 이름을 필수 전제로 두지 않는다.
- 병렬 역할 분리가 필요하면 현재 호스트가 제공하는 subagent/agent 기능을 사용한다.
- agent 기능이 없으면 메인 실행자가 같은 역할을 순서대로 수행한다.
- 구현 파일은 한 실행자만 수정하고 Reviewer 역할은 읽기 전용으로 유지한다.
- 외부 상태를 변경하거나 위험한 명령을 실행할 권한은 스킬 호출만으로 확대되지 않는다.

## 개발 오케스트레이션

`dev-orchestrator`는 CRUD, 일반 기능, 버그, 리팩토링, 아키텍처, 대형 기능을 분류해 필요한 역할만 선택하는 공용 진입점이다. 항상 여러 에이전트를 호출하지 않고 독립적인 읽기 전용 작업만 선택적으로 병렬화한다.

Codex의 프로젝트 범위 역할 파일, 모델 배정, 동시 실행 제한은 [Codex 역할별 에이전트 운영 가이드](codex-agents.md)를 따른다. Claude Code와 Cursor에서는 같은 스킬의 작업 분류를 사용하되 현재 호스트가 제공하는 역할 위임 기능에 맞춰 실행한다.

## 인코딩

- 모든 `SKILL.md`, 참고 문서, 스크립트는 UTF-8 no BOM으로 저장한다.
- Windows PowerShell 5는 UTF-8 no BOM 스크립트의 한글 리터럴을 CP949로 오해할 수 있다. 외부 API에 한글을 보낼 때는 Python 또는 UTF-8 처리가 명시된 런타임을 사용하고, 저장 후 다시 조회해 왕복 검증한다.
