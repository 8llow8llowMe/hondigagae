# Plan Service

## 책임

- 여행 일정(plan) CRUD — 일자별 항목(장소/식사/숙박/산책/이동) 관리
- 여행 후기 관리 (AI 자동 작성 초안은 ai-service, 저장·공개는 이 서비스)
- 일정 공유 (향후 카카오 메시지 API 연계)

## 컨텍스트

- `plan` — 일정, 일정 항목
- `review` — 여행 후기, 사진

## 도메인 모델 (기획)

- `Plan` — 회원, 대상 반려견(petId), 지역, 기간, 예산, 상태(초안/확정/완료)
- `PlanItem` — 일자(day), 순서(sequence), 항목 유형(`PlanItemType`: PLACE/MEAL/LODGING/WALK/MOVE), 대상 참조(placeId 또는 walkCourseId), 메모
- `Review` — 대상 plan, 만족도, 본문, 사진, 방문 장소별 평가(성향 분석 입력)

## 주요 API (계획)

- `GET|POST /api/v1/plans`
- `GET|PUT|DELETE /api/v1/plans/{planId}`
- `PUT /api/v1/plans/{planId}/days/{day}/items` — 일자 단위 항목 일괄 편집
- `GET|POST /api/v1/plans/{planId}/reviews`

## 구현 주의점

- **일정의 소유권은 이 서비스에 있다.** ai-service는 일정안을 생성·제안만 하고, 저장·확정은 이 서비스 API를 통해서만 일어난다.
- AI가 생성한 일정을 저장할 때도 일반 생성과 같은 검증(장소 존재 여부, 날짜 정합성)을 거친다. 장소 검증은 tour-service Feign 조회(`FeignClient -> Adapter -> QueryResult`)로 수행한다.
- `PlanItem`의 다중 대상 FK는 `@Comment`에 분기 기준을 명시한다 (`coding-conventions.md` §9-4).
- 후기 사진 업로드가 필요해지면 `storage-core` 모듈 추가를 검토한다 (`modules.md`).
- 후기 데이터는 반려견 성향 분석(ai-service)의 입력이 되므로, 방문 장소·활동 유형·만족도가 구조화되어 저장되어야 한다.
