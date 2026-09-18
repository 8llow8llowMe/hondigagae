# Plan Service

## 책임

- 여행 일정(plan) CRUD — 일자별 항목(장소/식사/숙박/산책/이동) 관리
- 여행 후기 관리 (AI 자동 작성 초안은 ai-service, 저장·공개는 이 서비스)
- 일정 공유 (향후 카카오 메시지 API 연계)

## 컨텍스트

- `plan` — 일정, 일정 항목
- `review` — 여행 후기(v1 저장은 `plan` 패키지). 사진은 미착수

## 도메인 모델 (기획)

- `Plan` — 회원, 대표 반려견(petId), 지역, 기간, 예산, 상태(초안/확정/완료)
- `PlanPet` — 일정에 동행하는 반려견 한 마리 (plan ↔ pet 다대다, `plan_pet`). 첫 행이 `Plan.petId` 와 같다
- `PlanItem` — 일자(day), 순서(sequence), 항목 유형(`PlanItemType`: PLACE/MEAL/LODGING/WALK/MOVE), 대상 참조(placeId 또는 walkCourseId), 메모
- `Review` — 대상 plan, 만족도, 본문, 사진, 방문 장소별 평가(성향 분석 입력)

## 주요 API (계획)

- `GET|POST /api/v1/plans`
- `GET|PUT|DELETE /api/v1/plans/{planId}`
- `POST /api/v1/plans/{planId}/copy` — 지난 일정을 새 DRAFT 로 복제
- `PUT /api/v1/plans/{planId}/days/{day}/items` — 일자 단위 항목 일괄 편집
- `GET|POST|PUT /api/v1/plans/{planId}/reviews` — 일정당 후기 하나. 작성·수정은 완료된 일정만, 조회는 상태와 무관. 사진은 없음
- `GET|POST|DELETE /api/v1/plans/{planId}/share-link` — 읽기 전용 공유 링크 발급·조회·폐기 (인증)
- `GET /api/v1/shared-plans/{token}` — 공유 링크로 일정 열기 (**비인증**)

## 구현 주의점

- **일정의 소유권은 이 서비스에 있다.** ai-service는 일정안을 생성·제안만 하고, 저장·확정은 이 서비스 API를 통해서만 일어난다.
- AI가 생성한 일정을 저장할 때도 일반 생성과 같은 검증(장소 존재 여부, 날짜 정합성)을 거친다.
  장소 검증은 tour-service 내부 벌크 API(`GET /internal/v1/places/visible-ids`)를 **한 번** 불러
  수행한다 — 항목마다 따로 부르면 저장 한 번에 원격 왕복이 항목 수만큼 생긴다 (coding-conventions §9-7).
  delisted 장소는 존재하지 않는 것으로 오므로, 원천에서 사라진 장소를 새 항목이 참조하는 것도 여기서 막힌다.
- **일정 상세 항목에 장소 요약이 붙는다** (`addr1` · `indoor` · `firstImage` · `lat` · `lng`).
  tour-service 내부 후보 API(`GET /internal/v1/places/candidates`)를 **한 번** 부르고 중복
  아이디는 제거한다 — 프론트가 항목마다 `GET /places/{placeId}` 를 부르던 것을 없애기 위한
  것이라, 같은 문제를 백엔드로 옮기면 의미가 없다.
  - `PlanDetailResponse` 를 내려주는 경로는 **전부** 요약을 붙인다(생성·조회·수정·일자 교체).
    조회에만 붙이면 같은 DTO 가 진입 경로에 따라 주소를 갖거나 안 갖게 되고, 화면은 항목을
    편집한 직후에만 주소가 사라진다.
  - 내부 outline 조회와 응급 브리핑은 요약 없는 `getPlanInfo` 를 쓴다 — 쓰지 않는 원격 호출을
    그 두 경로에 만들지 않는다.
  - **tour-service 장애를 상세 조회 실패로 번지게 하지 않는다.** 요약을 못 받으면 비운 채
    응답한다(즐겨찾기 목록과 같은 판단). 응급 브리핑은 반대로 삼키지 않는다 — 그쪽은 시설
    없는 브리핑이 "가까운 병원이 없다" 는 착각을 준다.
  - **원천에서 사라진(delisted) 장소는 요약만 null 이고 항목은 남는다.** 사용자가 담아 둔 자료다.
  - `indoor` 의 null 은 "실외" 가 아니라 "원천에 정보 없음" 이다. `false` 로 바꾸지 않는다.
- **일정 상세의 `WALK` 항목에 산책 코스 요약이 붙는다** (#619, `courseLabel` · `distanceKm` ·
  `durationText` · `durationMaxMinutes` · `firstImage` · `lat` · `lng` · `fitsActivityLevels`).
  `WALK` 의 `targetId` 는 `walk_course.id` 라 장소 요약 경로에서 빠지고, 그래서 산책 항목만
  이름 말고는 아무것도 없는 줄로 내려가고 있었다. tour-service 내부 코스 API
  (`GET /internal/v1/walk-courses/candidates`)를 **한 번** 부르고 중복 아이디는 제거한다.
  - **장소 요약과 같은 자리의 같은 판단이다 — tour-service 장애를 상세 조회 실패로 번지게 하지
    않는다.** 코스 요약은 장식이라, 못 받으면 `walkCourse` 만 비운 채 항목은 그대로 응답한다.
    두 요약은 서로 독립이다: 코스 조회가 실패해도 장소 요약은 붙고 그 반대도 같다.
  - **코스를 찾지 못하면 요약만 null 이고 항목은 남는다.** 사용자가 담아 둔 자료다.
  - 활동량 적합 판정(`fitsActivityLevels`)은 **tour-service 가 한다.** 여기서 상한을 다시
    계산하면 두 서비스가 같은 코스를 다르게 읽는다 — 그리고 남의 반려견 활동량을 tour-service 로
    넘기지 않아도 된다.
  - 공개 응답에서는 **`{code, name, description}` metadata 객체**로 내린다 (coding-conventions §11).
    같은 `PlanItemDetailItem` 안의 `itemType` 이 이미 metadata 라, 한쪽만 raw 문자열이면 화면이
    두 가지 해석 코드를 갖게 된다. 내부 경계(Feign·QueryResult·Info)에서는 세 값을 편 채 나르고
    metadata 는 Presenter 가 씌운다 — 기상특보가 같은 방식이다.
  - `durationMaxMinutes` 의 null 은 "제한 없음" 이 아니라 "원천 문구를 파싱하지 못했다" 이다.
    그래서 `durationText` 원문을 함께 내린다.
  - **남은 위험 / 후속** (#619 검토에서 드러남, 이 변경에서 고치지 않았다)
    - **[DB MEDIUM] `WALK` 의 `targetId` 는 저장 시 검증되지 않는다.** `PlanCommandProcessor.verifyPlaceTargets`
      는 `isPlaceTarget()` 인 항목만 확인하고 walk_course 대응물이 없다. `PlanItemType` javadoc 이
      "AI 초안이 `WALK` 항목에 `place.id` 를 실어 보냈고 아무도 막지 않았다" 를 이미 적고 있다.
      **선행 결함이고 #619 가 만든 것이 아니다.** 검증을 켜면 지금 성공하는 저장이 거부되기 시작하므로
      별도 판단이 필요하다 → 후속 이슈.
    - **[DB MEDIUM] 일정 항목 수 상한이 없어 `IN` 절·질의문자열이 무한정 길어질 수 있다.**
      walk_course id 가 19자리라 파라미터 1개당 약 34바이트, Tomcat 기본 8KB 헤더 한도 기준
      **약 240개**에서 깨진다. 깨져도 장애 삼킴이 먹어 **요약만 비는 조용한 품질 저하**다.
      준비물 50·반려견 5·후기 항목 50 은 전부 `@Size` 가 있는데 일정 항목만 없다.
      **장소 경로도 같은 구조**라 한쪽만 고치면 비대칭이 된다 → 후속 이슈에서 양쪽을 함께 본다.
    - **[검증 공백] 서비스 간 계약을 고정하는 테스트가 없다.** tour 의 `WalkCourseCandidateInternalResponse` 와
      plan 의 `PlanWalkCourseClientResponse` 필드 일치는 사람이 눈으로 맞춘 것이라, 한쪽 필드명을 바꿔도
      컴파일·테스트가 전부 통과한 채 **런타임에 조용히 null** 이 된다. 저장소에 내부 컨트롤러 슬라이스·
      client-adapter 테스트 선례가 한 건도 없어 이 변경만의 이탈은 아니다.
    - **[참고] `durationMaxMinutes == null` 은 "제한 없음" 이 아니라 "원문 파싱 실패" 다.**
      FE 가 무제한으로 읽으면 활동량 판정이 뒤집힌다.
- **기간을 줄일 때 범위 밖 항목이 남으면 `PLAN_008` 로 거부한다 (필수).** 자동 삭제하지 않는다 —
  사용자가 담아 둔 기록을 말없이 지우는 일이고, 되돌릴 수단도 없다. 항목을 먼저 정리하게 한다.
  - 검사는 **저장 앞**에 있어야 한다. 뒤에 두면 기간만 줄어든 채 고아가 남아 결함이 그대로 재현된다.
  - 일수가 **줄어들 때만** 본다. 늘리거나 그대로면 기존 항목은 모두 범위 안이라 헛된 쿼리다.
  - 끝나는 날을 당기는 것뿐 아니라 **시작일을 미뤄도 일수는 줄어든다.** 한쪽만 보면 프론트가
    시작일 편집을 여는 순간 다시 고아가 생긴다.
  - 고아가 생기면 지울 수단이 없다는 것이 이 규칙의 근거다 — 일자별 교체(`PUT .../days/{day}/items`)는
    범위 밖 일차를 `PLAN_002` 로 막는다.
- **지난 일정 복제 (`POST /plans/{planId}/copy`).** 항목만 새 `DRAFT` 로 옮긴다 — 준비물·후기·방문
  체크는 가져오지 않는다. 본인 소유만(남의 일정은 `PLAN_001` 404). 제목은 요청 값 또는 원본 뒤
  `" (복사)"`. 새 `startDate`/`endDate` 의 **일수는 원본과 같아야** 한다 — 일차 항목을 그대로
  옮기므로 다르면 `PLAN_021` 400. **`PLAN_021` 문구에는 원본 일수가 들어간다** (#721) —
  프론트는 서버 `resultMessage` 를 그대로 띄우므로 "같아야 한다" 만 말하면 사용자가 며칠로
  맞춰야 하는지 모른 채 시행착오를 하게 된다. 값을 끼우는 것은 `PlanException(errorCode, args)`
  오버로드이고, auth-service `MemberException` 의 같은 오버로드(`MEMBER_001`)와 같은 모양이다.
  **판정 순서는 기간 자체 → 일수 비교다.** `validateDateRange` 가 역전(`PLAN_003`)과 30일
  상한(`PLAN_009`)을 먼저 거른다 — 일수 비교를 앞에 두면 "3일이어야 합니다" 를 받은 사용자가
  그대로 맞춰도 다시 거절당한다. 프론트가 클라이언트에서 역전·상한을 먼저 막는 것도 이 순서다.
  동행 반려견은 원본 `petIds` 를 따르되 더 이상 소유하지 않은
  아이는 빼고, 남은 아이가 없으면 `PLAN_010` 400(대표 반려견 폴백 없음). 복제 항목은
  `visited=false`, 새 `planItemId`. **장소 검증은 부르지 않는다** — delisted 장소도 항목은
  남기고 상세 요약만 null 인 기존 규칙을 따른다. 생성 경로의 `verifyPlaceTargets` 를 그대로 쓰면
  delisted 참조가 있는 일정을 복제할 수 없게 된다.
- **`PlanItemType` 은 이 서비스가 아니라 `core/shared-travel` 에 있다 (필수).** ai-service 초안의
  `itemType` 이 여기 저장 규칙을 그대로 따라야 하기 때문이다 — 문자열과 주석으로만 맞추던 때
  실제로 어긋났다 (#89).
- **`targetId` 가 `place.id` 인지의 판정은 `PlanItemType.isPlaceTarget()` 이 갖는다.** 저장 시
  존재 검증과 상세 요약 조회가 같은 집합을 써야 해서 도메인으로 올렸다 — `WALK` 의 `targetId`
  는 `walk_course.id` 라 장소로 조회하면 남의 아이디로 없는 장소를 찾는다.
- `PlanItem`의 다중 대상 FK는 `@Comment`에 분기 기준을 명시한다 (`coding-conventions.md` §9-4).
- 후기 사진 업로드가 필요해지면 `storage-core` 모듈 추가를 검토한다 (`modules.md`). v1 은 만족도·본문·장소별 한 줄만 저장한다.

## 여행 후기 v1 (`plan_review`)

다녀옴 다음에 남는 평가가 없었다. 성향 분석은 후기 데이터가 없으면 입력이 없다. 이번은 **구조화된 최소 후기**만 둔다.

- **`plan` 컨텍스트 안에 둔다.** 후기는 `/api/v1/plans/{planId}/reviews` 하위 리소스라 소유권 검사가 일정의 것과 같아야 한다. 새 컨텍스트로 빼면 `getOwnedPlan` 을 복제하게 된다 — 준비물과 같은 판단이다. 컨트롤러만 `PlanReviewWebController` 로 나눴다.
- **일정당 후기 하나.** `uk_plan_review_plan_id`. POST 는 생성만, 이미 있으면 `PLAN_017` 409. 수정은 PUT. GET 에 후기가 없으면 `PLAN_015` 404.
- **쓰기는 완료(`COMPLETED`)된 본인 일정만.** 남의 일정은 `PLAN_001` 404. 초안·확정·재오픈에 POST/PUT 하면 `PLAN_016` 400. 존재 여부를 초안 단계에서 가르지 않는다.
- **조회는 상태를 보지 않는다.** 본인 소유이기만 하면 초안·확정·완료 어디서든 읽힌다. 완료를 확정으로 되돌릴 수 있는데(재오픈) GET 까지 `COMPLETED` 로 막으면 되돌리는 순간 이미 쓴 후기가 API 에서 사라져 화면은 쓴 적 없는 것처럼 보인다. 되돌리기는 상태를 바꾸는 것이지 기록을 지우는 것이 아니다.
- 본문은 선택(2000자). 장소별 평가는 다녀온 **장소 항목**(`PlanItemType.isPlaceTarget()` + `visited`)만. WALK 의 `targetId` 는 `walk_course.id` 라 장소 평가가 아니다. 제목·placeId 는 요청에 받지 않고 그때의 일정 항목에서 스냅샷한다.
- **일차 교체로 항목이 사라져도 후기는 빼지 않는다.** PUT 은 `items` 전량 교체다. 이미 기억한 `planItemId` 는 제목·placeId 를 유지한 채 평점·한 줄만 고친다. 살아 있는 항목이면 제목·placeId 를 현재 값으로 갱신한다.
- 장소 평가 행 삭제는 벌크 DML 로 즉시 내보낸다 — `plan_item`·준비물이 겪은 함정과 같다. 파생 delete 는 INSERT 가 먼저 나가 유니크 인덱스 위반으로 죽는다.
- Facade 에 트랜잭션을 그대로 건다 — 이 유스케이스에는 원격 호출이 없다.
- 범위 밖: 사진, 공개/비공개, 피드, AI 초안(`POST /reviews/drafts`), 성향 분석 조회.

**마이그레이션**

- local/dev(`ddl-auto: update`) — 기동 시 테이블이 만들어진다.
- prod(`ddl-auto: none`) — 배포 전에 테이블을 만든다.

```sql
CREATE TABLE plan_review (
    id              BIGINT       NOT NULL COMMENT '후기 아이디',
    plan_id         BIGINT       NOT NULL COMMENT '여행 일정 아이디 (FK: plan.id)',
    overall_rating  INT          NOT NULL COMMENT '전체 만족도 (1~5)',
    body            VARCHAR(2000) NULL COMMENT '후기 본문',
    created_at      TIMESTAMP    NOT NULL COMMENT '생성 날짜',
    updated_at      TIMESTAMP    NOT NULL COMMENT '수정 날짜',
    PRIMARY KEY (id),
    UNIQUE KEY uk_plan_review_plan_id (plan_id)
) COMMENT = '여행 일정 후기';

CREATE TABLE plan_review_item (
    id            BIGINT       NOT NULL COMMENT '후기 장소 평가 아이디',
    review_id     BIGINT       NOT NULL COMMENT '여행 후기 아이디 (FK: plan_review.id)',
    plan_item_id  BIGINT       NOT NULL COMMENT '일정 항목 아이디 (FK: plan_item.id, 항목 삭제 후에도 스냅샷 유지)',
    place_id      BIGINT       NULL COMMENT '장소 아이디 (FK: place.id)',
    title         VARCHAR(100) NOT NULL COMMENT '작성 시점의 일정 항목 이름',
    rating        INT          NOT NULL COMMENT '장소 만족도 (1~5)',
    comment       VARCHAR(200) NULL COMMENT '장소 한 줄 후기',
    sort_order    INT          NOT NULL COMMENT '표시 순서 (0부터)',
    created_at    TIMESTAMP    NOT NULL COMMENT '생성 날짜',
    updated_at    TIMESTAMP    NOT NULL COMMENT '수정 날짜',
    PRIMARY KEY (id),
    UNIQUE KEY uk_plan_review_item_review_id_plan_item_id (review_id, plan_item_id),
    KEY idx_plan_review_item_review_id_sort_order (review_id, sort_order)
) COMMENT = '여행 후기 방문 장소 평가';
```

## 일정 공유 링크 (`plan_share_link`)

짠 일정을 동행자·가족에게 보여 줄 수단이 없었다. 계정을 만들게 하지 않고 **주소만으로 읽히는 링크**를 연다.

- **소유권.** 발급·조회·폐기는 전부 본인 일정만이다 — 남의 일정은 기존 `getOwnedPlan` 이 던지는 `PLAN_001` 404 로
  존재 자체를 노출하지 않는다. 공개 조회만 인증 없이 열린다.
- **확정·완료만 공유한다.** `PlanStatus.isShareable()`(`!= DRAFT`)이 판정하고, **발급 시점과 공개 조회 시점
  양쪽에서** 본다. 발급 때만 보면 확정 후 초안으로 되돌린 일정이 이미 나간 링크로 계속 열린다 —
  사용자는 "되돌렸으니 안 보이겠지" 로 읽는다. 발급 거부는 `PLAN_022` 400, 되돌린 뒤 공개 조회는 `PLAN_023` 404 다.
- **만료는 발급 시각 + 30일 고정.** 요청 바디가 없다 — 무기한 링크를 만들 수단을 아예 두지 않는다.
  시각은 **주입받은 `Clock` 빈**(`PlanServiceBeansConfig`, `Asia/Seoul`)으로만 읽는다. `LocalDateTime.now()` 를
  직접 부르면 JVM 기본 시간대(`TIME_ZONE` 환경변수)에 따라 "30일" 이 29일이나 31일이 된다. `createdAt` 과 산술하지 않는다.
- **발급은 멱등.** 유효한(미폐기·미만료) 링크가 있으면 새로 만들지 않고 그 토큰을 돌려준다. 여러 개를 흩뿌리면
  어느 것이 도는지 알 수 없고 폐기가 그중 하나만 닫는 착각이 생긴다. **링크 회전은 DELETE 후 POST** 뿐이다.
- **폐기는 행 삭제가 아니라 `revoked_at` 타임스탬프.** 지우면 "폐기된 링크" 와 "없던 토큰" 이 구분되지 않아
  유출 경로를 추적할 근거가 사라진다. DELETE 는 해당 일정의 **미폐기 행을 전부** 닫고 0건이어도 200 이다 —
  동시 INSERT 로 남은 형제 행이 살아남으면 "껐다" 고 믿는 동안 옛 링크가 열린다. 이미 폐기된 행의 시각은 덮어쓰지 않는다.
- **토큰**은 `SecureRandom` 32바이트를 URL-safe Base64(패딩 없음)로 옮긴 43자다. 평문 저장 + `uk_plan_share_link_token`.
  토큰 자체가 열람 권한이라 **게이트웨이 로그에서 마스킹한다** (`LoggingGlobalApiGatewayFilter`, `/api/v1/shared-plans/***`).
  마스킹이 없으면 Loki 를 볼 수 있는 사람이 곧 그 일정을 볼 수 있는 사람이 된다.
- **실패 코드는 둘로만 갈린다.** 없음·폐기·일정 소프트삭제·비공유 상태는 전부 `PLAN_023` 404 로 **같게** 답한다 —
  구분해 주면 토큰을 찍어 보는 쪽에 "이 토큰은 있었다" 를 흘린다. 만료만 `PLAN_024` 410 이다. 받은 사람이
  "새 링크를 달라" 고 말할 수 있어야 하기 때문이다.
- **공개 응답에서 뺀 것**(`SharedPlanResponse`·`SharedPlanItemItem`): `planId`(소유자 API 를 찍어 볼 실마리),
  `petId`·`petIds`, `budget`, `planItemId`, `memo`, `visited`. 준비물·후기·응급 브리핑은 애초에 상세 응답에 없고
  각자 별도 API 다. 이 감춤은 코드로 증명되지 않아 `PlanShareLinkPresenterTest` 가 **record component 이름 집합을
  정확히 고정**한다 — 필드를 더하면 테스트가 깨져 "남에게 보여도 되는가" 를 다시 묻게 된다.
- **접두어를 따로 둔 이유** (`/api/v1/shared-plans`). `/api/v1/plans/**` 아래 두면 "인증이 필요한 일정 API" 와
  "토큰만으로 열리는 API" 가 한 경로 트리에 섞인다. 나중에 게이트웨이·보안을 경로 기준으로 조일 때 공개
  엔드포인트 하나 때문에 트리 전체를 열어 두게 된다. 접두어가 나뉘면 "이 접두어는 공개" 가 경로만 보고 읽힌다.
  대신 **게이트웨이 라우트를 세 프로파일 모두에 추가해야 한다** — `GatewayRouteCoverageTest` 가 그것을 고정한다 (#202).
- **`permitAll` 은 어노테이션을 안 쓰는 것으로 걸린다.** `ResourceServerSecurityConfigurer` 가 이미
  `anyRequest().permitAll()` 이고 인증은 `@PreAuthorize` 로만 건다. `SharedPlanWebController` 에는
  `@PreAuthorize`·`@AuthenticationPrincipal`·`@SecurityRequirement` 가 없고, `MemberLoginActive` import 도 없어야 한다.
- **조회 흐름은 복제하지 않는다.** 소유자 경로와 갈라지는 지점은 `getOwnedPlan`(memberId 필터) ↔
  `resolveSharedPlan`(token 필터) **하나뿐**이고, 그 뒤 `PlanQueryProcessor.getPlanDetailInfo` 로 합류한다.
  항목 조회와 장소 요약(tour-service 1회 호출)이 두 벌이 되면 한쪽만 고쳐질 자리가 생긴다.
- **공개 조회 Facade 메서드에는 트랜잭션을 걸지 않는다.** `getPlanDetailInfo` 가 tour-service 원격 호출을 하기
  때문이다 (architecture-guide §3 의 문서화된 예외). 공유 링크는 주소만 알면 누구나 두드릴 수 있어 이 경로가
  DB 커넥션을 오래 잡으면 영향이 특히 크다. 소유자 3종은 원격 호출이 없어 Facade 에 그대로 건다.

**마이그레이션**

- local/dev(`ddl-auto: update`) — 기동 시 테이블이 만들어진다.
- prod(`ddl-auto: none`) — 배포 전에 테이블을 만든다.

`expires_at`·`revoked_at` 은 **`DATETIME(6)`** 이다. 엔티티에 `columnDefinition` 이 없어 Hibernate 는
`datetime(6)` 을 만드는데 문서 DDL 만 `TIMESTAMP` 면 **dev(`ddl-auto: update`)와 prod(수기 DDL)의 스키마가
갈린다.** 게다가 `TIMESTAMP` 는 2038 천장이 있고, `expires_at` 이 이 테이블의 첫 TIMESTAMP 컬럼이라 서버
설정에 따라 `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` 가 암묵적으로 붙을 수 있다.
`entity-design.md` 의 다른 `LocalDateTime` 컬럼도 전부 `DATETIME` 이다.
`created_at`/`updated_at` 의 `TIMESTAMP` 는 `BaseEntity` 의 `columnDefinition` 과 일치하므로 그대로 둔다 —
엔티티에 `columnDefinition = "TIMESTAMP"` 를 다는 반대 방향은 택하지 않는다.

```sql
CREATE TABLE plan_share_link (
    id          BIGINT      NOT NULL COMMENT '공유 링크 아이디',
    plan_id     BIGINT      NOT NULL COMMENT '여행 일정 아이디 (FK: plan.id)',
    token       VARCHAR(64) COLLATE utf8mb4_bin NOT NULL COMMENT '공유 토큰 (SecureRandom 32바이트의 URL-safe Base64, 43자). 대소문자를 구분해야 하므로 utf8mb4_bin',
    expires_at  DATETIME(6) NOT NULL COMMENT '만료 시각 (발급 시각 + 30일)',
    revoked_at  DATETIME(6) NULL COMMENT '폐기 시각. null 이면 유효한 링크다 (행을 지우지 않고 닫는다)',
    created_at  TIMESTAMP   NOT NULL COMMENT '생성 날짜',
    updated_at  TIMESTAMP   NOT NULL COMMENT '수정 날짜',
    PRIMARY KEY (id),
    UNIQUE KEY uk_plan_share_link_token (token),
    KEY idx_plan_share_link_plan_id_revoked_at (plan_id, revoked_at)
) COMMENT = '여행 일정 읽기 전용 공유 링크';
```

### 남은 위험 (이 이슈로 닫히지 않는 것)

게이트웨이 로그 마스킹은 **완결된 방어가 아니다.** 아래는 알고 남긴 것들이다.

- **[보안 MEDIUM] 앞단 nginx access log 는 여전히 평문이다.** 가려지는 것은 게이트웨이 애플리케이션 로그뿐이다.
  nginx 가 TLS 를 종료하고 `combined` 포맷의 `$request` 가 전체 경로를 남기므로 **로그 열람권만 있는 사람이
  토큰을 그대로 얻을 수 있다.** 링크 수명 30일이 그 잔여 위험의 상한이다. nginx `log_format` 치환은 인프라
  레포 몫이라 이 PR 밖이다.
- **[보안 MEDIUM] 공개 경로가 인증 경로와 `tour-service` 서킷 인스턴스를 공유한다.** 공유 링크가 공개적으로
  퍼지면(이 기능이 기대하는 정상 사용) 크롤러·미리보기 봇의 반복 요청이 tour-service 호출로 증폭되고, 서킷이
  열리면 **로그인 사용자의 일정 상세에서도 장소 요약이 빈다**(500 은 아니다 — 요약 실패는 삼키는 규칙이다).
  레이트 리밋이 저장소 전체에 없다. 후속 이슈에서 게이트웨이 `RequestRateLimiter` 를 이 라우트에만 거는 것을
  먼저 본다 — 짧은 TTL 캐시는 폐기 즉시성을 해치므로 리밋이 먼저다.
- **[DB LOW] 보존/정리 정책이 없다.** 행을 지우지 않으므로 만료·미폐기 행이 쌓인다. 현실 규모에서는 무시할
  수준이지만(한 일정당 재발급 주기마다 1행) 정리 배치는 아직 없다. 정리 배치가 생기면 그때 `(expires_at)`
  인덱스가 필요해진다 — **지금 미리 만들지 않는다.**
- **[DB LOW] 만료가 항상 410 으로 보이지는 않는다.** 만료된 옛 토큰이라도 그 사이 주인이 새 링크를 발급했다가
  폐기하면 410 이 아니라 404 가 된다 — 폐기를 만료보다 먼저 판정하기 때문이다.
- **검증 공백**: `idx_plan_share_link_plan_id_revoked_at` 의 역방향 인덱스 스캔(filesort 없음)과 콜레이션 동작은
  **MySQL 전용 의미론이라 H2 슬라이스로 증명되지 않는다.** dev 반영 뒤
  `EXPLAIN SELECT * FROM plan_share_link WHERE plan_id=? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1` 로
  `Backward index scan` 과 `Using filesort` 부재를 확인할 것.

## 동행 반려견 — 여러 마리 (`plan_pet`)

AI 일정 생성(`POST /ai-plans`)은 `petIds` 로 여러 마리를 받는데 담기(`POST /plans`)가 `petId` 단일이면
"두 마리 기준으로 짠 일정" 이 저장되는 순간 한 마리 일정이 된다. 그래서 담기 계약·저장 구조·판정을 함께 다견화했다.

### 계약 — ai-service 와 같은 규칙

- `PlanCreateRequest.petIds` — `@Size(max = 5)`, 원소 `@Positive`. **첫 번째가 대표 반려견**이다.
- `petIds` 가 있으면 `petId` 는 무시한다. 둘 다 없으면 **대표 반려견**(auth-service `GET /internal/v1/pets/representative/condition`)을
  쓰고, 그것도 없으면 `PLAN_010 PET_REQUIRED` 400 이다 — `plan.pet_id` 가 NOT NULL 이고 날씨 판정의 기준이라 반려견 없는 일정은 만들지 않는다.
- 우선순위를 `AiPlanCreateRequest` 와 똑같이 둔 이유: 두 서비스가 다르게 굴면 프론트가 생성과 담기에서 반려견을 서로 다른 모양으로 실어야 한다.
- 대표 반려견 조회는 **지정이 없을 때만** 부른다. 담기마다 auth-service 를 왕복하지 않는다.
- 응답(`PlanSummaryItem`·`PlanDetailResponse`·내부 `PlanOutlineResponse`)은 `petId`(대표)를 그대로 두고 `petIds`(전체)를 덧붙였다.
  기존 필드를 지우지 않았으므로 프론트는 자기 속도로 옮겨 탄다.

### 저장 구조 — `plan.pet_id` 유지 + `plan_pet` 조인 테이블

두 안 중 **대표 컬럼을 남기는 쪽**을 택했다.

| 안 | 장점 | 문제 |
| --- | --- | --- |
| `plan.pet_id` 제거 + `plan_pet` 만 | 정규화가 깨끗하다 | NOT NULL 컬럼을 지우는 수동 SQL 이 dev/prod 모두 필요하고, 배포 순서를 맞춰야 하며, 응답 `petId` 가 사라져 프론트 동시 수정이 필요하다 |
| **`plan.pet_id` 유지(대표) + `plan_pet`** | 옛 행을 옮기는 SQL 없이 배포된다. 응답 `petId` 가 남아 프론트가 깨지지 않는다 | 두 곳에 같은 사실이 있다 — 규칙(`pet_id` = `plan_pet` 첫 행)을 코드가 지켜야 한다 |

- `plan_pet(id, plan_id, pet_id)` — `uk_plan_pet_plan_id_pet_id`, `idx_plan_pet_pet_id_plan_id`(반려견별 히스토리용). PK 는 Snowflake, 연관관계 어노테이션 없음(§9-1).
- **옛 일정 읽기 규칙은 `Plan.resolvePetIds()` 한 곳에 있다.** `plan_pet` 에 행이 없으면 `[petId]` 로 읽는다. 상세·목록·날씨 판정이 전부 이 메서드를 거치므로 옛 일정을 서로 다르게 읽지 않는다.
- 목록은 페이지의 `planId` 를 모아 **`in` 절 한 번**으로 `plan_pet` 을 읽는다 (§9-7).
- **`PUT /plans/{planId}` 의 `petIds` 로 동행 반려견을 바꾼다.** 생성과 같은 규칙(최대 5마리, 첫 번째가 대표, 소유하지 않은 아이가 있으면 `PLAN_011`)을 쓰되 **폴백이 없다** — 생성은 빈 목록을 대표 반려견으로 대신하지만 수정에서 빈 목록은 "동행견을 모두 빼겠다" 는 뜻이라 되살리면 사용자가 지우려던 아이가 말없이 돌아온다. `PLAN_010` 으로 거절한다.
  - 생략(`null`)은 **유지**다. 보내면 `plan.pet_id`(대표)와 `plan_pet`(전체)을 **함께** 맞춘다. 한쪽만 고치면 대표와 목록이 어긋난다.
  - `plan_pet` 교체는 **벌크 DML 로 먼저 지운다.** 파생 delete 는 INSERT 가 먼저 나가 `uk_plan_pet_plan_id_pet_id` 위반으로 죽는다 — `plan_item` 일자 교체와 같은 함정이다.
  - **완료(`COMPLETED`)된 일정의 동행견은 바꾸지 않는다 (`PLAN_019`).** 다녀온 기록의 판정 근거가 뒤늦게 흔들린다. 같은 요청으로 완료하면서 바꾸는 것은 막지 않는다 — 아직 기록이 확정되기 전이다.
  - **이 API 는 판정을 다시 계산하거나 준비물을 지우지 않는다.** 날씨 브리핑·준비물은 다음 조회가 새 `petIds` 를 읽는다. 사용자가 손으로 고친 준비물을 동행견 교체가 말없이 날리지 않는다.
  - 소유하지 않은 임시 동행견(친구 개)은 범위 밖이다. 지금은 내 프로필 아이만 담는다.

### 반려견 지정 규칙은 ai-service 와 함께 고친다 (필수)

`PlanCreateRequest.petIds` 와 `AiPlanCreateRequest.petIds` 는 **같은 규칙을 쓴다** — 최대 5마리,
첫 번째가 대표, `petId` 는 `petIds` 가 있으면 무시, 둘 다 없으면 대표 반려견 폴백.
`effectivePetIds()` 구현이 두 파일에 같은 모양으로 들어 있다.

**한쪽만 고치면 프론트가 생성과 담기에서 반려견을 서로 다른 모양으로 실어야 한다.**
실제로 그런 일이 있었다 — 원소 `@NotNull` 이 빠져 `[null]` 이 통과했고, plan-service 는
저장에서 500, ai-service 는 조용히 폴백으로 갈렸다. 어느 쪽도 문서화된 정책이 아니었다.

지정 규칙을 손댈 때는 **두 DTO 와 두 검증 테스트**
(`PlanCreateRequestValidationTest`, `AiPlanCreateRequestValidationTest`)를 함께 본다.

**마이그레이션**

- local/dev(`ddl-auto: update`) — 기동 시 `plan_pet` 이 만들어진다. 옛 행은 그대로 두면 된다.
- prod(`ddl-auto: none`) — 배포 전에 테이블을 만든다. 옛 행 이관 SQL 은 **필요 없다** (읽기 규칙이 대신한다). 원하면 아래로 채울 수 있지만 선택이다.

```sql
CREATE TABLE plan_pet (
    id          BIGINT       NOT NULL COMMENT '일정 동행 반려견 아이디',
    plan_id     BIGINT       NOT NULL COMMENT '여행 일정 아이디 (FK: plan.id)',
    pet_id      BIGINT       NOT NULL COMMENT '반려견 아이디 (FK: pet.id)',
    created_at  TIMESTAMP    NOT NULL COMMENT '생성 날짜',
    updated_at  TIMESTAMP    NOT NULL COMMENT '수정 날짜',
    PRIMARY KEY (id),
    UNIQUE KEY uk_plan_pet_plan_id_pet_id (plan_id, pet_id),
    KEY idx_plan_pet_pet_id_plan_id (pet_id, plan_id)
) COMMENT = '여행 일정 동행 반려견';

-- 선택: 옛 일정을 조인 테이블에도 남기고 싶을 때. 한 일정에 한 행이라 plan.id 를 PK 로 재사용해도 겹치지 않는다.
INSERT INTO plan_pet (id, plan_id, pet_id, created_at, updated_at)
SELECT p.id, p.id, p.pet_id, p.created_at, p.updated_at
FROM plan p
WHERE NOT EXISTS (SELECT 1 FROM plan_pet pp WHERE pp.plan_id = p.id);
```

### 완료 시점 반려견 특성 스냅샷 (`plan_pet_condition`)

**진행 중인 일정은 auth-service 를 매번 다시 읽고, 완료된 일정은 완료 시점 스냅샷을 읽는다.**

이 서비스는 반려견 특성의 사본을 두지 않는 것이 원칙이었다. 진행 중 판정이 낡은 값을 쓰지
않게 하려는 규칙이고, 그건 지금도 맞다 — 체중·민감도를 고치면 다음 판정에 곧바로 반영되어야
한다. **완료된 여행은 반대다.** 다녀온 뒤 프로필을 고쳤다고 "그때 몽실이 기준" 이 뒤늦게
달라지면 그 기록은 거짓이 된다. 그래서 사본을 두는 자리를 **완료 시점 하나로 좁혔다.**

- **찍는 시점은 `COMPLETED` 로 넘어가는 전이 한 번뿐이다.** 이미 완료된 일정에 다시
  `COMPLETED` 를 보내는 것은 전이가 아니라 다시 찍지 않는다 — 그때 찍으면 다녀온 뒤 고친
  프로필이 "그때 기준" 으로 둔갑한다 (`PlanCommandProcessor.completesNow`).
- **되돌린 뒤 다시 완료하면 그 시점으로 다시 찍는다.** 되돌린 동안 동행견을 바꿀 수 있어서
  (`petIds` 수정), 옛 스냅샷을 그대로 두면 이번 여행에 가지도 않은 아이의 특성이 기록으로
  남는다. 교체는 `plan_pet` 과 같은 이유로 **벌크 DML 로 먼저 지운다.**
- **보관 범위는 `PetConditionQueryResult` 와 같다** — 견종·크기·더위/추위/소음 민감·활동량.
  이 서비스가 실제로 tour-service 판정에 넘기는 축뿐이다. 이름·생년월 원문은 애초에 내부
  계약(`PetConditionResponse`)이 내보내지 않는다. `ageMonths`·체중·사회성은 이 서비스가 아직
  받지도 읽지도 않아 넣지 않았다 — 읽지 않는 값을 "기록" 이라는 이유로 더 쌓지 않는다.
  판정이 그 축을 쓰게 되면 포트를 넓히면서 같이 넣는다.
- **스냅샷이 없는 완료 일정은 예전처럼 원천을 읽는다.** 이 기능 이전에 완료된 일정이다.
  없는 기록을 지어내지 않는다.
- 조회 경로는 하나다 — `PlanWeatherProcessor.loadConditions(memberId, plan, petIds)` 가 상태를
  보고 고른다. 원천을 직접 읽는 `loadConditions(memberId, petIds)` 는 **스냅샷을 찍는 쪽**이
  쓴다. 사본을 두 곳에서 만들면 "완료면 스냅샷" 규칙이 갈라진다.
- 원격 조회라 Facade 가 **트랜잭션 밖에서** 특성을 먼저 읽고, 상태 변경과 스냅샷 저장은 한
  트랜잭션에 묶는다 (`createPlan` 의 반려견 확인과 같은 순서).

**마이그레이션**

- local/dev(`ddl-auto: update`) — 기동 시 만들어진다.
- prod(`ddl-auto: none`) — 배포 전에 테이블을 만든다. 옛 행 이관은 **없다** (읽기 폴백이 대신한다).

```sql
CREATE TABLE plan_pet_condition (
    id              BIGINT      NOT NULL COMMENT '일정 반려견 특성 스냅샷 아이디',
    plan_id         BIGINT      NOT NULL COMMENT '여행 일정 아이디 (FK: plan.id)',
    pet_id          BIGINT      NOT NULL COMMENT '반려견 아이디 (FK: pet.id, 프로필 삭제 후에도 스냅샷 유지)',
    breed           VARCHAR(50)  NULL COMMENT '완료 시점의 견종',
    size_type       VARCHAR(20)  NULL COMMENT '완료 시점의 크기 구분',
    heat_sensitive  BIT(1)      NOT NULL COMMENT '완료 시점의 더위 민감 여부',
    cold_sensitive  BIT(1)      NOT NULL COMMENT '완료 시점의 추위 민감 여부',
    noise_sensitive BIT(1)      NOT NULL COMMENT '완료 시점의 소음 민감 여부',
    activity_level  VARCHAR(20)  NULL COMMENT '완료 시점의 활동량',
    created_at      TIMESTAMP   NOT NULL COMMENT '생성 날짜',
    updated_at      TIMESTAMP   NOT NULL COMMENT '수정 날짜',
    PRIMARY KEY (id),
    UNIQUE KEY uk_plan_pet_condition_plan_id_pet_id (plan_id, pet_id)
) COMMENT = '일정 완료 시점의 동행 반려견 특성 스냅샷';
```

### 반려견별 히스토리 (`GET /plans?petId=`)

**한 마리라도 동행이면 히트**다. `plan.pet_id = :petId OR plan.id IN (select plan_id from plan_pet where pet_id = :petId)` —
조인 테이블만 보면 옛 일정이, 대표 컬럼만 보면 두 번째 이후 반려견이 히스토리에서 빠진다. 정적 JPQL 이라 H2 슬라이스 테스트(`PlanRepositoryTest`)로 고정했다.

### 판정 축 — 아이별로 따로 판정하고, 점수가 가장 낮은 아이가 기준

여러 마리를 어떻게 합칠지는 두 갈래였다.

| 안 | 호출 | 문제 |
| --- | --- | --- |
| 조건을 보수적으로 합쳐 한 번 판정 (더위·추위·소음 민감 OR, 크기 최대) | 일수 × 1 | **존재하지 않는 가상의 개** 기준이 된다. 가장 큰 아이가 더위에 가장 약한 아이라는 보장이 없고, 견종(단두종) 축은 합칠 방법이 없다 |
| **아이별로 따로 판정 → 점수가 가장 낮은 아이를 그날의 기준** | 일수 × 서로 다른 조건 수(≤5) | 호출이 늘지만 "몽실이 기준" 이라고 말할 수 있다. 실제 아이 기준이라 근거가 정직하다 |

- 조건이 같은 아이들은 **한 번만 묻는다** — 특성 조회에 실패해 전부 일반 조건이 됐을 때 마리 수만큼 같은 질문을 반복하지 않는다.
- 응답은 일자마다 `basisPetId`(기준 아이)와 `petSuitabilities[]`(아이별 점수·등급)를 내린다. `score`·`reasons`·`indoorAlternatives` 는 기준 아이 것이다 — 날씨는 아이마다 같고, 근거를 마리 수만큼 반복하면 응답이 읽기 어려워진다.
- 점수를 못 낸 날은 첫 아이(대표)를 기준으로 두어 날씨·이유는 보여 준다. 모든 조회가 실패하면 `unavailableReasonCode = LOOKUP_FAILED` 이고 아이별 목록은 빈 배열이다 (사유 구분은 아래 "일자 판정 불가 사유").
- 반려견 특성은 auth-service 벌크 내부 API(`GET /internal/v1/pets/conditions?memberId=&petIds=`) 한 번으로 받는다. 빠진 아이(소유 아님·조회 실패)는 일반 조건으로 그 아이 몫의 판정에 남는다.
- 후기 데이터는 반려견 성향 분석(ai-service)의 입력이 되므로, 방문 장소·활동 유형·만족도가 구조화되어 저장되어야 한다.

## 일정 날씨 브리핑 (`GET /api/v1/plans/{planId}/weather`)

- 적합도를 **다시 계산하지 않는다.** 판정 규칙의 소유자는 tour-service 고, 같은 규칙을
  두 곳에서 구현하면 일정 화면과 장소 화면이 같은 날 같은 곳을 다르게 말하게 된다.
- 반려견 특성은 auth-service 내부 벌크 API(`GET /internal/v1/pets/conditions`)에서 받아
  tour-service 에 파라미터로 넘긴다. 사본을 두면 사용자가 프로필을 고쳐도 옛 값으로 판정한다.
- **여러 마리면 아이별로 따로 판정하고 점수가 가장 낮은 아이가 그날의 기준이다** — 위 "동행 반려견" 절의 판정 축 참고.
- **일자마다 대표 장소 한 곳만 조회한다.** 항목마다 부르면 3박 4일 일정에 열 번 넘는 원격
  호출이 생긴다. 하루 안의 항목들은 대개 같은 격자에 들어가 날씨가 거의 같으므로,
  "그날 우산 필요한가"에는 대표 한 곳이면 답이 된다. 대표는 그날 가장 이른 장소성 항목이다.
- 일자별로 불가 사유를 따로 둔다. 어떤 날은 예보가 닿고 어떤 날은 닿지 않는 것이
  **정상**이라(예보는 약 11일), 전체를 성공/실패로 나누면 그 차이를 표현할 수 없다.
- 날씨 때문에 항목을 바꾸는 것은 이 API 가 아니라 일자별 항목 교체 API 로 명시적으로 한다
  (`api-design-guide.md` §8 의 부수효과 분리 원칙).
- Feign 조회 실패는 예외로 올리지 않고 빈 값으로 바꾼다. 날씨는 부가 정보이고,
  tour-service 가 흔들렸다고 사용자가 자기 일정을 못 보게 되면 안 된다.
- 항목 단위 판정이 필요해지는 순간은 **산책 위험도**다. 그것은 시각에 따라 갈리므로 같은
  방식으로 접을 수 없어 별도 조회로 뺐다 — 아래 "항목 단위 산책 위험도" 절.

### 항목 단위 산책 위험도 (`GET /plans/{planId}/walk-safety`)

일자 날씨는 "둘째 날 괜찮아?" 에 답하고, 이 API 는 **"두 시에 그 해수욕장 걸어도 돼?"** 에
답한다. 같은 해수욕장도 오후 2시와 저녁 7시가 다르므로 일자로 접을 수 없다.

- **일정 상세에 얹지 않고 별도 경로로 뺐다.** 상세는 이미 장소 요약 때문에 원격 호출을 하나
  들고 있고, 거기에 항목 수만큼의 위험도 조회를 더하면 "일정을 연다" 가 그 전부를 기다리는
  일이 된다. 위험도는 화면이 필요할 때 따로 부른다.
- **항목마다 엔드포인트를 두지 않은 이유**는 반대다 — 그러면 화면이 항목 수만큼 왕복한다.
  일정 하나를 한 번에 받고, 서버가 접을 수 있는 호출을 접는다.
- **판정 규칙을 복사하지 않는다.** 노면온도 추정·체감온도 산식·등급 임계는 tour-service 가
  갖고, 여기서는 `GET /places/{placeId}/walk-safety` 를 **항목의 시각으로** 부를 뿐이다.
  규칙을 옮기면 장소 화면과 일정 화면이 같은 시각 같은 곳을 다르게 말하게 된다.
- **기준 반려견은 그날 날씨 판정의 `basisPetId` 와 같다.** 여기서 따로 고르면 한 화면이
  "몽실이 기준" 이라고 말하는 옆에서 다른 화면이 보리 기준을 말한다. **그날 적합도 조회가
  실패한 경우에만** 대표(첫 번째) 반려견으로 대신한다 — 여기까지 온 항목은 장소를 가진
  항목이라 "그날 장소가 없어 기준을 못 냈다" 는 경우는 도달하지 않는다.
- **그 기준은 하루치씩(`PlanWeatherProcessor.briefDay`) 구하고, 판정할 항목이 실제로 나온
  날에만 구한다.** 브리핑 전체(`brief`)를 부르면 특성·항목 조회가 한 번 더 일어나고, 시각이
  하나도 없어 위험도 호출이 0건인 일정에서도 `일수 × 조건 수` 만큼 적합도 원격 호출이 나간다.
- **같은 (장소, 시각, 기준 반려견) 은 한 번만 묻는다.** 같은 장소에 시각이 같은 항목이 둘이면
  답도 같다. **날이 다르면 접지 않는다** — 날짜는 판정의 입력이다(노면온도 추정이 태양 고도를
  쓰고 예보 자체도 날짜별이다).
- 응답은 항목 줄에 붙일 만큼만 든다 — 등급·노면온도·체감온도·기온·안전 시간대. 근거 목록·
  시간대별 판정·특보 상세는 넣지 않는다. 항목마다 실어 나르면 응답이 항목 수만큼 부푼다.
  필요하면 화면이 장소 위험도 API 를 직접 부른다.
- 게이트웨이는 손대지 않았다 — `/api/v1/plans/**` 가 이미 덮는다.

**항목 판정 불가 사유** (`PlanItemWalkSafetyUnavailableReason`) 는 일자 날씨와 **같은 축**이고,
코드와 문장을 짝으로 내린다. 가르는 **순서에 이유가 있다.**

| 순서 | 코드 | 왜 이 자리인가 |
|------|------|----------------|
| 1 | `PAST_DATE` | 무엇을 고쳐도 풀리지 않는다. 뒤로 미루면 지난 날짜에 "시각을 넣어 보세요" 라는 지켜지지 않을 안내가 나간다 |
| 2 | `NOT_PLACE_TARGET` | 사용자가 일정에서 고칠 수 있다. `WALK` 의 `targetId` 는 `walk_course.id` 라 장소로 조회하면 남의 아이디다 |
| 3 | `NO_START_TIME` | 사용자가 일정에서 고칠 수 있다. **정오를 넣어 판정하지 않는다** — 없는 시각을 지어내면 사용자가 정하지 않은 시간의 답이 된다 |
| 4 | `BEYOND_FORECAST_RANGE` | 기다리면 풀린다. 사용자가 먼저 고칠 것이 있으면 그것을 먼저 말한다 |
| 5 | `LOOKUP_FAILED` | 다섯 중 이것만 일시적 장애다 |

**시각별 예보 지평은 일자 예보와 다르다 — `[오늘, 오늘+4]` 로 5일이다.** 일자 날씨의 11일과
헷갈리기 가장 쉬운 지점이다. 산책 위험도는 노면온도를 `기온 + 일사(날짜·시각·위도)` 로
추정하므로 **시각별 데이터가 있는 단기예보만** 쓴다 — 중기예보(오늘+4\~오늘+10)에는 오전/오후뿐이라
오후 두 시 아스팔트를 계산할 수 없다 (`weather-insight-integration.md` §2-1 · §6-2). 그래서
tour-service 는 시각별 예보 목록이 덮는 날짜 밖이면 `OUT_OF_RANGE` → 등급 `UNKNOWN` 을 낸다.

- 상수는 `PlanItemWalkSafetyUnavailableReason.HOURLY_FORECAST_HORIZON_DAYS = 4` 한 곳이고,
  단기예보 실측 커버리지(`오늘 ~ 오늘+4`)에서 나온 값이다. **원천 커버리지가 바뀌면 그 상수와
  이 문단이 같이 움직인다.**
- 일자 지평(10)을 여기에 그대로 쓰면 **조용히 틀린다.** `오늘+5`\~`오늘+10` 항목이 컷에 걸리지
  않아 전부 tour-service 로 나가고, 돌아오는 것은 등급 `UNKNOWN` 에 온도가 전부 null 인 200 이다.
  `levelCode` 가 null 이 아니라 `unavailableReasonCode` 는 **null 로 나가고**, 화면은 사유 없는
  빈 배지만 받는다. 일주일 뒤 여행이 전부 이 꼴이 된다.
- 같은 일정에서 `/weather` 에는 판정이 있는데 `/walk-safety` 는 비어 있는 날이 **정상**이다.
  Swagger 설명에도 그렇게 적어 둔다 — 화면이 이것을 장애로 읽지 않게 해야 한다.

**판정을 못 낸 줄도 `placeId` 는 그대로 내린다** (`NOT_PLACE_TARGET` 만 예외). 지난 날짜라
예보가 없는 것과 장소를 모르는 것은 다른 사실이고, 무엇보다 `LOOKUP_FAILED` 줄에서 화면이
장소 위험도 API 를 직접 불러 다시 시도하려면 그 값이 있어야 한다 — 비우면 "필요하면 직접
부르세요" 라는 안내가 정작 가장 필요한 줄에서 지켜지지 않는다. `NOT_PLACE_TARGET` 만 비우는
이유는 `WALK` 의 `targetId` 가 `walk_course.id` 라, 장소로 내보내면 화면이 남의 아이디를 열기
때문이다. 반대로 `placeTitle` 은 **못 낸 줄에서 항상 비운다** — 그것은 tour-service 가 확인해 준
이름이고, 일정에 적힌 이름은 `title` 로 이미 내려간다.

**카카오 특보 알림은 이 절의 범위 밖이다.** 화면이 물을 때 답하는 것과 서버가 먼저 밀어 주는
것은 다른 기능이라 별도 이슈로 뗀다.

### 일자 판정 불가 사유 (이슈 [#492](https://github.com/8llow8llowMe/hondigagae/issues/492))

**"못 냈다" 에는 성질이 다른 넷이 섞여 있고, 뭉뚱그리면 사용자에게 하는 말이 틀린다.** 지난
날짜에 "잠시 후 다시 시도해 주세요" 가 나가면 화면은 그 문장을 그대로 보여 주고 사용자는
영원히 바뀌지 않을 것을 새로고침한다. 여행 중 일정에서는 지난 일차마다 그 문장이 뜨는
흔한 경로다. 일시적 장애와 구분되지 않으니 실제 예보 API 장애도 알아채기 어렵다.

정본은 `PlanDayWeatherUnavailableReason` 이고, 문장도 그 enum 이 갖는다 — Processor 에 문자열
상수를 두면 같은 사실을 말하는 문구가 갈린다.

| 코드 | 뜻 | 재시도 | 판정 시점 |
| --- | --- | --- | --- |
| `PAST_DATE` | 이미 지난 날짜 | **권하지 않는다** — 예보는 소급되지 않는다 | 날짜만으로 (호출 전) |
| `NO_PLACE_ITEM` | 그날 일정에 장소 항목이 없다 | 해당 없음 — 장소를 담으면 풀린다 | 일정 항목으로 (호출 전) |
| `BEYOND_FORECAST_RANGE` | 예보가 아직 닿지 않는 미래 | 해당 없음 — 기다리면 풀린다 | 날짜만으로 (호출 전) |
| `LOOKUP_FAILED` | 조회 자체가 실패 | **권한다** — 넷 중 이것만 장애다 | 조회 결과로 |

- **예보가 닿는 범위는 `[오늘, 오늘+10]` — 11일이다.** 기상청 단기예보(오늘\~오늘+4)와
  중기예보(오늘+4\~오늘+10)를 이어 만든 값이라 임의의 숫자가 아니다
  (`weather-insight-integration.md` §2). 상수는 `PlanDayWeatherUnavailableReason.FORECAST_HORIZON_DAYS`
  한 곳이고, 원천 커버리지가 바뀌면 그 상수와 이 표가 같이 움직인다.
- **날짜만으로 답이 정해지는 둘은 원격 호출 전에 가른다.** 지난 날짜·예보 범위 밖은 물어도
  결과가 정해져 있다. 3박 4일 중 사흘이 지난 일정이면 나가는 호출이 하루치로 준다.
- **사유 코드를 응답에 함께 내린다** — `unavailableReasonCode`(코드)와 `unavailableReason`(문장)이
  짝이다. 문장만 내리면 프론트가 사유별로 다르게 그리려고 문장을 파싱하게 되고, 코드만 내리면
  같은 사실을 서버와 화면이 각자의 문구로 말한다 (FE [#497](https://github.com/8llow8llowMe/hondigagae/issues/497)).
  기존 `unavailableReason` 필드는 타입도 문구도 그대로 두고 코드를 **더한다** — 배포된 화면이
  이미 그 문장을 그리고 있어 타입을 바꾸면 그 화면이 깨진다.
- **"오늘" 은 `Clock` 빈에서 얻는다** (`PlanServiceBeansConfig`, `Asia/Seoul` 고정). `-Duser.timezone`
  은 배포 환경변수(`TIME_ZONE`)라 그 값 하나로 자정 경계가 다른 나라 기준이 될 수 있고, 그러면
  일자 판정이 "지난 날짜" 를 하루 어긋나게 말한다. 여행 브리핑의 `today` 도 같은 시계를 쓴다 —
  갈리면 한 응답 안의 두 값이 자정 경계에서 어긋난다. 시스템 시각을 직접 읽으면 이 분기는
  실행 날짜에 따라 결과가 달라져 테스트로 고정되지 않는다.
- tour-service 의 `ForecastCoverage`(AVAILABLE / DAY_ENDED / OUT_OF_RANGE / UNAVAILABLE)와
  같은 구분을 일정 쪽 말로 옮긴 것이다. 그쪽은 예보 목록을 손에 들고 판정하고, 이쪽은
  물어보기 전에 날짜로 판정한다.

## 여행 브리핑 (`GET /api/v1/plans/{planId}/briefing?date=`)

출발 전날·당일에 **하루치**를 한 번에 주는 조합 API 다 — 그날 일정 요약(항목 수·방문 체크 수·첫/마지막 항목·대표 장소),
날씨·적합도(위 날씨 브리핑의 하루치), 발효 중인 기상특보, 산책 골든타임. FE 가 화면 하나로 "내일 여행 준비" 를 보여 주기 위한
것이라 **결정적 조합만 하고 LLM 을 부르지 않는다.** 준비물은 ai-service 의 준비물 API 가 따로 있어 넣지 않는다.

- **재계산하지 않는다.** 날씨는 `PlanWeatherProcessor.briefDay` 를 그대로 부른다(복사가 아니라 하루치 메서드를 공개했다) —
  대표 장소 선정·아이별 판정·기준 반려견 선택이 같은 경로를 타야 일정 화면과 브리핑 화면이 같은 날을 같게 말한다.
  특보·골든타임은 tour-service 가 낸 값을 옮기기만 한다. 경보 판정(`recommendationSuppressed`)도 tour 가 준 값이다 —
  `level == WARNING` 을 이쪽에서 다시 세우면 규칙이 두 서비스로 갈라진다 (#357).
- **특보·골든타임은 요청 날짜가 오늘일 때만 붙인다** (`today`). 골든타임은 tour 의 `GET /api/v1/insights/walk-times` 가
  "오늘 남은 시간" 전용이라 내일 이후를 물을 수단이 없고, 특보는 tour 의 적합도 판정과 같은 규칙
  (`targetDate == today` 일 때만)을 따른다 — 내일 날짜에 오늘 특보를 붙이면 "내일 태풍" 이라는 없는 예보가 화면에 선다.
  오늘이 아니면 두 필드는 null 이고 각 `*UnavailableReason` 에 이유가 담긴다.
- **특보 "확인 못 함" 과 "없음" 을 나눈다 (필수).** 이 브리핑의 가장 나쁜 실패는 특보가 떠 있는데 화면이 조용한 것이다.
  그래서 `WeatherWarningQueryPort` 만 조회 실패를 `PlanException` 으로 올리고, Processor 가 잡아
  `weatherWarningUnavailableReason` 에 "가져오지 못했다" 를 담는다. `weatherWarning` 과 이유가 **둘 다 null 일 때만**
  "발효 중인 특보 없음" 이다. 골든타임·날씨는 부가 정보라 기존처럼 빈 값으로 접는다.
  - 한계: tour-service 자체가 KMA 특보 조회 실패를 "없음" 으로 접는다(`WeatherWarningProcessor`). 이 경계에서 가를 수 있는 것은
    plan→tour 호출의 실패까지다.
- 특보는 걸음 좌표와 무관하게 오늘이면 확인한다 — 그래서 walk-times 응답에 실린 특보를 재활용하지 않고 tour 내부 API
  `GET /internal/v1/weather/warnings`(가장 무거운 한 건) 를 따로 부른다. 장소 항목이 없는 날에도 특보는 나가야 한다.
- 골든타임은 그날 대표 장소(날씨와 같은 `pickRepresentative`) 좌표로 묻고, 반려견 조건은 **기준 아이**(`basisPetId` —
  날씨 판정이 고른 점수 최저 아이, 없으면 대표) 것을 넘긴다. 좌표는 tour 내부 후보 API 한 번으로 받는다. 붙이지 못한 이유는
  셋으로 가른다 — 장소 항목 없음 / 좌표 없음(delisted·원천 좌표 없음) / 조회 실패.
- **시간대별 곡선(`hourly`)은 싣지 않는다.** 브리핑은 요약이고 곡선을 실으면 응답이 몇 배로 커진다. 응답에 판정 좌표를 함께 내리니
  곡선이 필요한 화면은 그 좌표로 tour 의 walk-times 를 직접 부른다.
- 날짜가 일정 기간 밖이면 `PLAN_002`. `date` 는 필수다 — "출발 전날" 인지 "당일" 인지는 FE 가 안다.
- 원격 호출 수(하루치라 상한이 낮다): auth 특성 1 + tour 적합도(서로 다른 조건 수, 최대 5) + tour 장소 요약 1 + tour 특보 1 +
  tour 골든타임 1. 오늘이 아니면 뒤의 둘은 나가지 않는다. Facade 에 트랜잭션을 걸지 않는 이유는 날씨 브리핑과 같다.

## 여행 동행 기능

- `PUT /api/v1/plans/{planId}/items/{planItemId}/visited` — 항목 방문 체크. 일차 항목을
  교체(delete+insert)하면 새 항목이라 그 날의 체크는 초기화된다.
- `GET /api/v1/plans/{planId}/emergency` — 일자별 방문 장소마다 가까운 동물병원·동물약국
  (반경 10km, 최대 3곳). 같은 장소는 한 번만 검색하고, 좌표가 없는 장소는 건너뛴다 — 원천에서
  사라진(delisted) 장소는 요약 자체가 오지 않고, 남아 있어도 원천이 좌표를 주지 않은 장소가 있다.
  시설 검색 실패는 삼키지 않는다 — 시설 없는 브리핑은 안전하다는 착각만 준다.
- `GET /api/v1/plans?petId=` — 반려견별 여행 히스토리. 여러 마리 일정은 그중 한 마리로 들어 있어도 히트다.
  or-null 조건 대신 메서드를 나눠 조회한다.

## 여행 준비물 (`plan_packing_item`)

`GET|PUT|POST /api/v1/plans/{planId}/packing-items`,
`PUT .../{packingItemId}/checked`, `DELETE .../{packingItemId}` (이슈 #398).
세부는 [`docs/features/398-plan-packing-items.md`](../features/398-plan-packing-items.md).

- **저장은 plan-service 가 한다.** ai-service 는 준비물을 생성만 하고 저장하지 않는다 — JPA 가
  없는 서비스에 저장소를 붙이면 "제안만 한다" 는 성격이 바뀌고, 생성은 됐는데 저장이 실패한 상태를
  ai-service 가 떠안게 된다. FE 가 생성과 저장을 따로 부르면 실패 지점이 화면에서 구분된다.
- `plan` 컨텍스트 안에 둔다. 준비물은 일정의 하위 리소스라 소유권 검사가 일정의 것과 같아야 하고,
  새 컨텍스트로 빼면 `getOwnedPlan` 을 복제하게 된다 — `plan_item`·`plan_pet` 과 같은 부류다.
  컨트롤러만 `PlanPackingWebController` 로 나눴다(`PlanWebController` 가 이미 10개다).
- **`PUT` 은 `source = AI` 인 행만 교체한다.** 사용자가 직접 적어 둔 항목은 남는다. 기간 축소 때
  범위 밖 항목을 자동 삭제하지 않고 `PLAN_008` 로 거부한 것과 같은 판단이다 — 사용자의 기록을
  말없이 지우지 않는다.
- **체크 상태는 이름으로 승계한다.** `plan_item` 의 `visited` 는 일차 교체 때 초기화되는데,
  그쪽은 항목이 통째로 다른 것이 되므로 맞다. 준비물은 "리드줄" 이 다시 나오면 같은 리드줄이다 —
  승계가 없으면 짐을 반쯤 싼 상태에서 다시 뽑기 한 번에 체크가 전부 날아간다.
- 이름이 겹치면 사용자 것이 이기고, AI 목록 안의 중복은 첫 것만 남긴다(LLM 이 같은 것을 두 번 낸다).
  유니크 인덱스 `uk_plan_packing_item_plan_id_name` 이 마지막 방어선이다.
- **AI 항목 삭제는 벌크 DML 로 즉시 내보낸다.** `plan_item` 이 겪은 함정과 같다 — 파생 delete 는
  `em.remove` 큐잉이라 flush 때 INSERT 가 먼저 나가고, 교체가 같은 `(planId, name)` 을 재사용하므로
  유니크 인덱스 위반으로 죽는다.
- `category` 는 enum 이 아니라 VARCHAR(30) 이다. 값의 원천이 LLM 이라 프롬프트를 고치면 늘어나고,
  enum 이면 모델이 새 분류를 낸 날 저장이 통째로 실패한다.
- Facade 에 트랜잭션을 그대로 건다 — 이 유스케이스에는 원격 호출이 하나도 없다. 일정 CRUD·브리핑이
  트랜잭션을 좁힌 이유(tour·auth 왕복)가 여기에는 해당하지 않는다.
- 상한은 일정당 50개(`PLAN_013`). 이름 중복은 409 `PLAN_012`, 남의 일정 항목은 404 `PLAN_014`.
- 남은 것: 다견 준비물(ai-service 가 아직 대표 `petId` 만 읽는다), FE 연동(`useMutation` → `useQuery` + 저장).

## 장소 즐겨찾기 (favorite 컨텍스트)

- `GET|POST|DELETE /api/v1/favorites/places[/{placeId}]` — 찜 목록/저장/해제. 저장·해제 모두
  멱등이고 회원당 최대 100곳이다. 저장 시 tour-service 조회로 장소 존재를 검증한다.
- 목록의 장소 요약(제목·주소·동반조건·대표 이미지)은 tour-service 내부 후보 API 로 붙인다.
  조회 실패 시 placeId 만으로 응답한다 — tour 장애가 찜 목록 조회 실패로 번지지 않는다.

## 서비스 간 내부 API

`GET /internal/v1/plans/{planId}/outline?memberId=` — ai-service 의 하루 재생성용 일정 개요.
`GET /internal/v1/favorites/place-ids?memberId=` — ai-service 의 즐겨찾기 우선 반영용 아이디 목록.

- 일차별 항목의 제목·유형·placeId 만 내보낸다. 메모·시간대 같은 개인 기록은 경계를 넘기지 않는다.
- `petId`(대표)와 `petIds`(동행 전체)를 함께 내보낸다. ai-service 의 준비물 생성은 아직 `petId` 만 읽는다 — 다견 준비물은 ai 쪽 후속이다.
- 내부 호출이라도 memberId 로 소유권을 다시 확인한다 — 남의 planId 로는 404.

이 서비스가 **부르는** 내부 API (tour-service, 전부 벌크 1회 호출이다):

- `GET /internal/v1/places/visible-ids?placeIds=` — 저장 시 장소 존재 검증.
- `GET /internal/v1/places/candidates?placeIds=` — 일정 상세 항목의 장소 요약, 즐겨찾기 목록의 장소 요약,
  응급 브리핑의 검색 중심점.
- `GET /internal/v1/walk-courses/candidates?walkCourseIds=` — 일정 상세 `WALK` 항목의 산책 코스 요약 (#619).
  **tour 장애 시 요약만 비우고 항목은 남긴다** — 장소 요약과 같은 판단이고, 두 요약은 서로 독립이다.
