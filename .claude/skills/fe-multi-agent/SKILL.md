---
name: fe-multi-agent
description: 혼디가개 프론트엔드의 큰 작업(새 화면 영역, API 연동 포함 변경, 디자인 시스템 변경, 지도 연동)을 fe-spec-writer / fe-implementer / fe-test-author / fe-reviewer / fe-api-contract / fe-design-reviewer / fe-map-reviewer 역할로 나눠 설계·구현·검증한다. 단일 파일 수정 같은 작은 작업에는 사용하지 않는다.
---

# FE Multi-Agent Playbook

FE 작업이 구현과 검토를 역할로 나눌 만큼 클 때 사용하는 스킬.

## When to Use

- 새 화면 영역 추가 (장소 탐색, 일정 편집, AI 일정 생성 등)
- 새 API 연동이 포함된 작업
- 공통 컴포넌트·디자인 토큰이 함께 바뀌는 작업
- 인증 흐름 또는 지도 연동 변경

**사용하지 않는 경우**: 단일 파일 수정, 명확한 버그 1건, 문구·스타일 미세 조정.

## Read First

1. [frontend/docs/team-playbook.md](../../../frontend/docs/team-playbook.md) — 역할 조합 기준
2. [frontend/docs/screen-inventory.md](../../../frontend/docs/screen-inventory.md) — 착수 가능 여부
3. [frontend/docs/done-checklist.md](../../../frontend/docs/done-checklist.md)

## 역할 조합

| 작업 유형 | 조합 |
|-----------|------|
| 단일 화면 추가 | Leader + `fe-implementer` + `fe-reviewer` |
| 새 API 연동 포함 | + `fe-api-contract` |
| 신규 디자인 섹션 | + `fe-design-reviewer` |
| 지도 / 외부 SDK | + `fe-map-reviewer` |
| 인증 흐름 변경 | Leader + `fe-implementer` + `fe-reviewer` + `fe-api-contract` |
| 신규 화면 영역 (대형) | + `fe-spec-writer` + `fe-test-author` + 위 검토자 전원 |

## Procedure

1. **착수 게이트** — `screen-inventory.md` 로 백엔드 구현 여부를 확인한다. 미착수면 **여기서 중단**하고 BE 선행 항목으로 보고한다.

2. **Leader가 범위를 고정한다.**
   - 이번 턴에 끝낼 것 / 제외할 것
   - 기준 문서 (`frontend/docs/*.md`, `DESIGN.md`, 해당 feature 명세)

3. **명세가 없으면 먼저 만든다.** `fe-spec-writer` → 사람 확인 → 구현 착수. 명세 없이 구현하지 않는다.

4. **역할별 책임을 나눈다.**
   - `fe-implementer` 는 구현
   - Reviewer는 검토만 하고 구현하지 않는다
   - 책임 범위가 겹치지 않게 파일 단위로 나눈다

5. **구현과 검토를 진행한다.** 독립적인 검토는 병렬로 보낼 수 있다.

6. **Leader가 결과를 취합한다.**
   - **Reviewer 보고를 그대로 믿지 않는다.** 근거(파일·행·증거)가 없는 지적은 확인 후 반영한다
   - 반영할 항목을 확정하고 경계·네이밍·구조를 다시 맞춘다

7. **최종 검증** — 실제로 돌린다.
   ```bash
   cd frontend && pnpm verify && pnpm format:check   # verify = lint && typecheck && test
   ```

8. **`done-checklist.md` 로 최종 점검** 후 커밋 단위를 정리한다. prefix는 `[FE]`.

## 운영 원칙

- 작은 작업에 남용하지 않는다.
- **최종 통합 책임은 메인 실행자에게 있다.**
- 기준 문서는 항상 `frontend/docs/*.md` 와 `frontend/DESIGN.md` 다.
- **없는 백엔드 API를 만들어 채우지 않는다.**
- 에이전트 출력에 `bosspickseoul` / `commercial-service` 가 등장하면 **잘못된(사용자 전역) 정의를 읽고 있는 것**이다. 즉시 중단하고 보고한다.

## Output Format

```text
FE MULTI-AGENT
==============

Target: [작업]
착수 가능: [예 / 아니오 — 이유]

Scope:
- In:  ...
- Out: ...

Roles:
- Leader     : 범위·통합
- Implementer: ...
- Reviewers  : ... (각각 무엇을 볼지)

Findings (반영 여부와 함께):
- [Reviewer] ... → 반영 / 보류(이유)

Verification:
- lint / typecheck / test 결과
- done-checklist 미충족 항목

Commit Plan:
- [FE] type: ...
```
