# Backend Done Checklist

## 1. 기능 단위 완료 기준

- [ ] API 경로가 도메인 의미와 REST 규칙에 맞다
- [ ] Controller -> WebUseCase -> WebFacade -> Processor -> Presenter 흐름이 맞다
- [ ] 응답이 `ResponseEntity<Response<T>>` 규칙을 지킨다
- [ ] Swagger 어노테이션과 한국어 설명이 정리됐다
- [ ] 예외/로그 문구가 서비스 기준과 일관된다
- [ ] compile/test/check를 통과했다

## 2. 계층 체크리스트

- [ ] Controller가 하위 레이어를 직접 호출하지 않는다
- [ ] Processor가 Response DTO를 직접 만들지 않는다
- [ ] Presenter가 Info -> Response 변환만 담당한다
- [ ] Port 경계에 adapter 타입 의존이 없다
- [ ] Entity <-> Domain 매핑이 MapStruct 규칙을 따른다
- [ ] 외부 API 원본 응답이 adapter 밖으로 새지 않는다

## 3. 데이터 / 영속성 체크리스트

- [ ] 엔티티와 DDL이 요구사항에 맞다
- [ ] PK / FK / 인덱스 전략이 정리됐다
- [ ] soft delete 여부와 후속 정리 전략이 명확하다
- [ ] `@Comment` 등 컬럼 설명이 필요한 곳에 반영됐다

## 4. 보안 / 운영 체크리스트

- [ ] 인증이 필요한 API에 `@PreAuthorize` 또는 Security 정책이 반영됐다
- [ ] JWT claim 사용 방식이 서비스 정책과 맞다
- [ ] 설정값이 하드코딩 대신 프로퍼티로 관리된다
- [ ] 외부 API 서비스 키가 평문으로 커밋되지 않았다
- [ ] 외부 호출에 timeout / 서킷브레이커가 적용됐다
- [ ] 로그에 민감 정보가 남지 않는다

## 5. 문서 / 협업 체크리스트

- [ ] 공통 규칙이 바뀌었다면 `backend/docs/*.md`를 갱신했다
- [ ] 서비스 책임이 바뀌었다면 `service-inventory.md` 또는 `services/*.md`를 갱신했다
- [ ] 새 외부 API를 붙였다면 `external-api-guide.md`를 갱신했다
- [ ] 이슈 / PR 템플릿에 구현 범위와 검증 내용을 반영했다
- [ ] 새 반복 패턴이 생겼다면 스킬화할 가치가 있는지 검토했다
