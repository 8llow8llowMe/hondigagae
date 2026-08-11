# Backend Service Playbook

## 1. 목적

- 새 서비스 추가, 기존 컨텍스트 확장, 구조 리팩토링 시 따라야 할 기본 순서를 정리한다.
- 구현 전에 문서, 구조, 검증 기준을 함께 맞추기 위한 문서다.

## 2. 기본 진행 순서

1. 서비스 책임과 범위를 정리한다.
2. API 경로와 보안 방식을 먼저 정리한다.
3. Hexagonal 구조에 맞게 컨텍스트 패키지를 설계한다.
4. Port / Adapter / Processor / Presenter 경계를 잡는다.
5. 필요한 엔티티, QueryResult, Criteria, DTO를 추가한다.
6. Swagger, 예외, 문서를 함께 보강한다.
7. compile / test / check로 검증한다.

## 3. 새 서비스 추가 시 체크

- `service/<service-name>` 생성
- `domainlayer/<context>` 패키지 구조 생성
- Security / Resource Server 설정 추가
- Swagger / springdoc 설정 확인
- SQL / 엔티티 / 문서 정리
- `docs/service-inventory.md` 및 `docs/services/*.md` 갱신

## 4. 리팩토링 시 체크

- 기존 동작을 유지해야 하는 범위를 먼저 정리한다.
- API 스펙 변경이 있으면 사전에 명시한다.
- 문서와 코드 변경을 분리하지 않는다.
- 대형 변경은 `docs/team-playbook.md` 기준으로 역할을 나눠 검토할 수 있다.

## 5. 완료 전 검증

- `docs/done-checklist.md` 기준 확인
- 서비스 책임 변경 시 `docs/service-inventory.md` 갱신
- 규칙이 바뀌면 `docs/architecture-guide.md`, `docs/coding-conventions.md`, `docs/api-design-guide.md` 갱신

## 6. 내부 서비스 연동 기준

- Spring 서비스 간 동기 HTTP 호출이 필요하면 `WebClient`보다 `FeignClient`를 기본 선택으로 검토한다.
- Feign 인터페이스는 HTTP 계약만 표현하고, 응답 언래핑 / 예외 변환 / `QueryResult` 변환은 adapter에서 처리한다.
- 특정 adapter 하나만 다른 방식으로 두기보다, 같은 컨텍스트의 내부 client는 한 번에 같은 패턴으로 정리한다.

## 7. 외부 데이터 연동 기준

- 외부 공공/민간 API 연동은 `docs/external-api-guide.md` 기준을 따른다.
- 새 외부 API를 추가하면 해당 문서의 연동 대상 표와 서킷 인스턴스 목록을 갱신한다.
