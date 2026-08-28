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
- AI가 생성한 일정을 저장할 때도 일반 생성과 같은 검증(장소 존재 여부, 날짜 정합성)을 거친다.
  장소 검증은 tour-service 내부 벌크 API(`GET /internal/v1/places/visible-ids`)를 **한 번** 불러
  수행한다 — 항목마다 따로 부르면 저장 한 번에 원격 왕복이 항목 수만큼 생긴다 (coding-conventions §9-7).
  delisted 장소는 존재하지 않는 것으로 오므로, 원천에서 사라진 장소를 새 항목이 참조하는 것도 여기서 막힌다.
- `PlanItem`의 다중 대상 FK는 `@Comment`에 분기 기준을 명시한다 (`coding-conventions.md` §9-4).
- 후기 사진 업로드가 필요해지면 `storage-core` 모듈 추가를 검토한다 (`modules.md`).
- 후기 데이터는 반려견 성향 분석(ai-service)의 입력이 되므로, 방문 장소·활동 유형·만족도가 구조화되어 저장되어야 한다.

## 일정 날씨 브리핑 (`GET /api/v1/plans/{planId}/weather`)

- 적합도를 **다시 계산하지 않는다.** 판정 규칙의 소유자는 tour-service 고, 같은 규칙을
  두 곳에서 구현하면 일정 화면과 장소 화면이 같은 날 같은 곳을 다르게 말하게 된다.
- 반려견 특성은 auth-service 내부 API(`GET /internal/v1/pets/{petId}/condition`)에서 받아
  tour-service 에 파라미터로 넘긴다. 사본을 두면 사용자가 프로필을 고쳐도 옛 값으로 판정한다.
- **일자마다 대표 장소 한 곳만 조회한다.** 항목마다 부르면 3박 4일 일정에 열 번 넘는 원격
  호출이 생긴다. 하루 안의 항목들은 대개 같은 격자에 들어가 날씨가 거의 같으므로,
  "그날 우산 필요한가"에는 대표 한 곳이면 답이 된다. 대표는 그날 가장 이른 장소성 항목이다.
- 일자별로 `unavailableReason` 을 따로 둔다. 어떤 날은 예보가 닿고 어떤 날은 닿지 않는 것이
  **정상**이라(예보는 약 11일), 전체를 성공/실패로 나누면 그 차이를 표현할 수 없다.
- 날씨 때문에 항목을 바꾸는 것은 이 API 가 아니라 일자별 항목 교체 API 로 명시적으로 한다
  (`api-design-guide.md` §8 의 부수효과 분리 원칙).
- Feign 조회 실패는 예외로 올리지 않고 빈 값으로 바꾼다. 날씨는 부가 정보이고,
  tour-service 가 흔들렸다고 사용자가 자기 일정을 못 보게 되면 안 된다.
- 항목 단위 판정이 필요해지는 순간은 **산책 위험도**다. 그것은 시각에 따라 갈리므로 같은
  방식으로 접을 수 없고, 별도 조회 설계가 필요하다.

## 여행 동행 기능

- `PUT /api/v1/plans/{planId}/items/{planItemId}/visited` — 항목 방문 체크. 일차 항목을
  교체(delete+insert)하면 새 항목이라 그 날의 체크는 초기화된다.
- `GET /api/v1/plans/{planId}/emergency` — 일자별 방문 장소마다 가까운 동물병원·동물약국
  (반경 10km, 최대 3곳). 같은 장소는 한 번만 검색하고, 좌표가 없는(delisted) 장소는 건너뛴다.
  시설 검색 실패는 삼키지 않는다 — 시설 없는 브리핑은 안전하다는 착각만 준다.
- `GET /api/v1/plans?petId=` — 반려견별 여행 히스토리. or-null 조건 대신 메서드를 나눠 조회한다.

## 장소 즐겨찾기 (favorite 컨텍스트)

- `GET|POST|DELETE /api/v1/favorites/places[/{placeId}]` — 찜 목록/저장/해제. 저장·해제 모두
  멱등이고 회원당 최대 100곳이다. 저장 시 tour-service 조회로 장소 존재를 검증한다.
- 목록의 장소 요약(제목·주소·동반조건·대표 이미지)은 tour-service 내부 후보 API 로 붙인다.
  조회 실패 시 placeId 만으로 응답한다 — tour 장애가 찜 목록 조회 실패로 번지지 않는다.

## 서비스 간 내부 API

`GET /internal/v1/plans/{planId}/outline?memberId=` — ai-service 의 하루 재생성용 일정 개요.
`GET /internal/v1/favorites/place-ids?memberId=` — ai-service 의 즐겨찾기 우선 반영용 아이디 목록.

- 일차별 항목의 제목·유형·placeId 만 내보낸다. 메모·시간대 같은 개인 기록은 경계를 넘기지 않는다.
- 내부 호출이라도 memberId 로 소유권을 다시 확인한다 — 남의 planId 로는 404.
