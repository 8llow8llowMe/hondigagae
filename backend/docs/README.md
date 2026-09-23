# Backend Docs

## 목적

- 이 디렉터리는 `hondigagae/backend` 작업의 기준 문서 모음이다.
- 백엔드 공통 규칙, 서비스별 책임, 완료 기준, 운영 체크리스트를 문서로 관리한다.
- `backend/AGENTS.md`, `backend/CLAUDE.md`는 이 문서들의 엔트리 역할만 수행한다.

## 문서 구성

- `architecture-guide.md`
  - Hexagonal 구조, 계층 책임, 패키지 템플릿, Port/Adapter 경계
- `coding-conventions.md`
  - 메서드 파라미터 줄바꿈, primitive/wrapper, MapStruct, 네이밍, Swagger, 예외/검증/로그 규칙
- `api-design-guide.md`
  - RESTful 경로, 응답 모델, Controller -> WebUseCase -> WebFacade -> Processor -> Presenter 흐름, 비동기 작업 패턴
- `bootstrap-conventions.md`
  - 서비스 Application 클래스, Global Config 구성 템플릿
- `modules.md`
  - core / cloud / service 모듈 구조와 역할, 공유 모듈 추가 기준
- `external-api-guide.md`
  - TourAPI, 반려동물 동반여행, 두루누비, 혼잡도, 기상청, 카카오 등 외부 API 연동 기준
- `entity-design.md`
  - 실호출로 검증한 공공 API 응답 기준의 DB 엔티티 설계 (컬럼·인덱스·적재 전략)
- `data-api-analysis.md`
  - 공공데이터 API 7종의 실제 응답 구조와 연동 시 함정
- `place-data-integration.md`
  - 장소 데이터를 어느 소스로 어떻게 합치는지 (소스별 저장 가능 여부, 중복 판정, 배치 잡)
- `weather-insight-integration.md`
  - 기상청 예보 연동과 여행 적합도/산책 위험도 판정 규칙 (격자 변환, 캐시 정책, 원천 함정)
- `auth-account-frontend-guide.md`
  - FE 계정 UX 연동 — 비밀번호 재설정, 일반↔소셜 연결/전환, hasPassword 분기, 에러 표
- `data-refresh-guide.md`
  - 장소 데이터 최신화 — 소스별 갱신 주기, 사라진 장소 처리, 급감 가드
- `batch-dev-runbook.md`
  - dev 서버 batch-service 운영 — 컨테이너 띄우기, 스케줄 확인, `docker exec` 수동 잡 실행, 결과 확인
- `local-run-guide.md`
  - 로컬 기동 절차, 포트 맵, Swagger 접근, 자주 겪는 문제
- `deploy-guide.md`
  - 배포 규약 — 명명 규칙, 포트 대역, 환경 변수, 배포 순서와 점검
- `jenkins-cicd-dev-deploy-guide.md`
  - Jenkins 파이프라인 구성, Vault secret 구조, 모노레포 빌드 범위
- `observability-guide.md`
  - actuator/Prometheus 설정, 데이터 신선도 지표, Grafana 1차 대시보드
- `feature-status.md`
  - 무엇이 되고 무엇이 안 되는지의 단일 기준
- `service-playbook.md`
  - 새 서비스, 컨텍스트 추가, 리팩토링, 문서/검증 절차
- `done-checklist.md`
  - 기능 단위 완료 기준과 QA 체크리스트
- `team-playbook.md`
  - 큰 작업에서 멀티 에이전트 역할 분리와 검증 흐름 기준
- `service-inventory.md`
  - 현재 서비스 책임, 상태, 주의점 요약
- `services/*.md`
  - 서비스별 책임과 구현 주의점

## 권장 읽기 순서

1. `../AGENTS.md` 또는 `../CLAUDE.md`
2. `README.md`
3. `local-run-guide.md` (처음 띄워볼 때)
4. `architecture-guide.md`
5. `coding-conventions.md`
6. `api-design-guide.md`
7. `external-api-guide.md`, `data-api-analysis.md`, `entity-design.md` (외부 데이터 연동 작업 시)
8. `service-playbook.md`
9. `done-checklist.md`
10. `team-playbook.md`
11. `feature-status.md`, `service-inventory.md`
12. 배포·운영 작업 시 `deploy-guide.md`, `jenkins-cicd-dev-deploy-guide.md`, `observability-guide.md`
13. 배치·데이터 갱신 작업 시 `data-refresh-guide.md`
14. 필요 시 `services/*.md`

## 현재 작업 원칙

- 백엔드는 공통 규칙과 서비스별 책임이 함께 유지되어야 하므로 규칙은 `docs/`에 모으고 구현 차이는 서비스 문서로 보강한다.
- 새 기능 구현 전에 API 경로, 계층 책임, 보안 방식부터 정리한다.
- 코드 변경과 문서 변경은 같이 움직여야 한다.
- 문서는 추상 지침만 적지 않고, 현재 구현 중인 서비스의 패턴을 예시로 포함한다.
- 서비스 추가나 대형 리팩토링처럼 범위가 큰 작업은 `team-playbook.md` 기준으로 역할을 나눠 검토할 수 있다.

## 스킬 사용 예시

Claude Code는 `/스킬명`(`.claude/skills/*`)으로 호출한다.

- `/backend-api-check`: REST 경로, Swagger, Presenter 흐름 점검
- `/hexagonal-guard`: Hexagonal 계층 경계 점검
- `/backend-feature-bootstrap`: 새 서비스/컨텍스트 시작 가이드
- `/backend-multi-agent`: 큰 작업을 역할별로 나눠 설계/구현/검증
- `/issue`, `/pr`, `/mr`: 이슈/PR/MR 초안 작성
- 자연어 요청도 가능하지만 스킬 호출 형식이 가장 확실하다.
