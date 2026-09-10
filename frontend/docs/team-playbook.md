# Frontend Team Playbook

## 목적

- 이 문서는 `hondigagae/frontend` 작업을 멀티 에이전트 방식으로 나눠 진행할 때의 기준 문서다.
- 목표는 속도보다 품질을 높이는 것이며, **최종 통합 책임은 항상 메인 실행자에게 있다.**
- 백엔드 대응 문서: `backend/docs/team-playbook.md`

## 언제 사용하는가

- 새 화면 영역을 추가할 때 (장소 탐색, 일정 편집 등)
- 새 API 연동이 포함될 때
- 디자인 시스템·공통 컴포넌트가 함께 바뀔 때
- 인증 흐름이나 지도 연동처럼 실수 비용이 큰 영역을 만질 때

다음 작업에는 보통 사용하지 않는다.

- 단일 파일 수정
- 명확한 버그 수정 1건
- 문구·스타일 미세 조정

## 에이전트 정의

`.claude/agents/fe-*.md` 에 정의돼 있다.

| 에이전트             | 모델   | 책임                                            | 코드 수정    |
| -------------------- | ------ | ----------------------------------------------- | ------------ |
| `fe-spec-writer`     | Opus   | 기능 명세 작성·갱신. Swagger 실측으로 계약 확정 | ✕ (문서만)   |
| `fe-implementer`     | Opus   | 구현 워크호스. 검증 명령까지 통과시킨다         | ○            |
| `fe-test-author`     | Sonnet | vitest 테스트 작성·보강                         | ○ (테스트만) |
| `fe-reviewer`        | Opus   | 변경 diff를 저장소 규약 기준으로 검토           | ✕            |
| `fe-api-contract`    | Sonnet | FE 호출부 ↔ Swagger 계약 대조                   | ✕            |
| `fe-design-reviewer` | Opus   | 실제 화면을 띄워 `DESIGN.md` 기준 검토          | ✕            |
| `fe-map-reviewer`    | Opus   | 카카오 지도 연동 전용 검토                      | ✕            |

모델 등급의 기준과 세션 모델(Fable)과의 관계는 [docs/claude-agents.md](../../docs/claude-agents.md) 「프론트엔드 전용 역할」이 정본이다 — 계획·설계·최종 판단은 메인 실행자, 하위 에이전트는 역할 파일의 모델로 돈다.

> **주의**: 사용자 전역(`~/.claude/agents/`)에 같은 이름의 다른 프로젝트용(BossPickSeoul) 정의가 있다. 프로젝트 스코프가 우선하지만, **에이전트 출력에 `bosspickseoul` 이나 `commercial-service` 가 등장하면 잘못된 정의를 읽고 있는 것이다.** 즉시 중단하고 보고한다.

## 역할 조합 가이드

### 단일 화면 추가

- Leader (메인 실행자)
- `fe-implementer`
- `fe-reviewer`

예: 반려견 목록 화면, 내 정보 수정 화면

### 새 API 연동 포함

- 위 + `fe-api-contract`

예: 장소 목록 필터 연동, 일정 일자 항목 교체

### 신규 디자인 섹션 / 공통 컴포넌트

- 위 + `fe-design-reviewer`

예: 일정 타임라인, AI 추천 이유(XAI) 카드

### 지도 / 외부 SDK

- Leader + `fe-implementer` + `fe-reviewer` + `fe-map-reviewer`

예: 장소 지도 뷰, 경로 표시, 현재 위치

### 인증 흐름 변경

- Leader + `fe-implementer` + `fe-reviewer` + `fe-api-contract`

예: 소셜 로그인 2-step, 재발급 흐름, 보호 경로 추가

### 신규 화면 영역 (대형)

- Leader + `fe-spec-writer` + `fe-implementer` + `fe-test-author` + `fe-reviewer` + `fe-api-contract` + `fe-design-reviewer`

예: AI 일정 생성 전체 플로우

## 실행 절차

1. **Leader가 범위를 고정한다.**
   - 이번 턴에 끝낼 것 / 제외할 것
   - 기준 문서 (`docs/*.md`, `DESIGN.md`, 해당 feature 명세)
   - **백엔드 구현 여부 확인** (`screen-inventory.md`) — 미착수 API면 여기서 중단한다

2. **명세가 없으면 먼저 만든다.** `fe-spec-writer` → 사람 확인 → 구현 착수.

3. **구현과 검토를 나눈다.** Reviewer가 구현하지 않고, Implementer가 검토를 생략하지 않는다.

4. **Leader가 결과를 취합한다.** 검토 의견 중 반영할 항목을 확정하고 경계·네이밍·구조를 다시 맞춘다.

5. **최종 검증.** `pnpm lint && pnpm typecheck && pnpm test` 를 실제로 돌린다.

6. **`done-checklist.md` 로 최종 점검** 후 커밋 단위를 정리한다.

## 요청 템플릿

### 범용

```text
이번 작업은 멀티 에이전트로 진행해줘.
fe-implementer 로 구현하고 fe-reviewer 로 검토한 뒤 마지막에 통합 반영해줘.
작업 내용: [여기에 작업 내용]
```

### API 연동 포함

```text
이번 작업은 멀티 에이전트로 진행해줘.
fe-api-contract 로 계약을 먼저 확인하고, fe-implementer 로 구현, fe-reviewer 로 검토해줘.
작업 내용: [여기에 작업 내용]
```

### 신규 화면 (명세부터)

```text
이번 작업은 명세부터 진행해줘.
fe-spec-writer 로 명세를 쓰고 내 확인을 받은 뒤,
fe-implementer 구현 → fe-test-author 테스트 → fe-reviewer / fe-design-reviewer 검토 순으로 진행해줘.
작업 내용: [여기에 작업 내용]
```

### 지도 작업

```text
이번 작업은 지도 연동이니 fe-map-reviewer 검토를 반드시 포함해줘.
작업 내용: [여기에 작업 내용]
```

## 운영 원칙

- 작은 작업에 멀티 에이전트를 남용하지 않는다.
- 멀티 에이전트라도 **최종 책임은 메인 실행자에게 있다.**
- 기준 문서는 항상 `frontend/docs/*.md` 와 `frontend/DESIGN.md` 다.
- **Reviewer 보고를 그대로 믿지 않는다.** 근거(파일·행·증거)가 없는 지적은 확인 후 반영한다.
- **없는 백엔드 API를 만들어 채우지 않는다.** 막히면 "BE 후속 요청"으로 분리해 보고한다.
- 커밋 전에는 반드시 `done-checklist.md` 기준으로 최종 점검한다.
