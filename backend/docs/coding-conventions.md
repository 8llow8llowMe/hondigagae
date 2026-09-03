# Backend Coding Conventions

## 1. 메서드 시그니처

- 한 줄 길이는 **180자**를 하드랩 기준으로 관리합니다.
- 메서드 선언이나 `record` 파라미터가 180자 이하면 한 줄로 유지합니다.
- 180자를 초과하거나 가독성이 떨어지면 줄바꿈합니다.
- 줄바꿈 시에는 **의미 단위로 파라미터를 묶어** 같은 줄에 배치합니다.
  - 예: `contentTypeId, areaCode` / `status, sortType, orderType` / `lastPlaceId, lastScore, size` / `visitedSince`
  - 파라미터 하나씩 한 줄씩 나열하는 방식은 지양합니다.
- Swagger `@Parameter(...) @RequestParam ...` 조합은 180자 이내면 **한 줄**로 작성합니다.
  - 예: `@Parameter(description = "남서쪽 경도", required = true, example = "126.16") @RequestParam double lngSW`

## 2. Primitive / Wrapper 기준

- `long`, `int`, `boolean` 같은 기본 타입은 기본적으로 primitive를 사용합니다.
- 아래 경우에만 wrapper를 사용합니다.
  - `null` 자체가 의미를 가지는 경우
  - 선택적 검색 조건이나 필터 값인 경우
  - 미설정 상태와 기본값 상태를 구분해야 하는 경우

## 3. Port / Adapter 파라미터 기준

- 단순 조회, 수정, 삭제 정도는 DTO를 만들지 않고 개별 파라미터를 우선 사용합니다.
- 조회 조건이 4개 이상이거나 `filter + sort + cursor + size`처럼 함께 움직이면 `*Criteria` 또는 `*Query` 객체로 묶습니다.
- out-port 계약은 adapter 구현 세부사항을 노출하지 않습니다.

## 4. Mapper 기준

- Entity <-> Domain 매핑은 MapStruct를 우선 사용합니다.
- 외부 API나 내부 서비스 응답은 adapter에서 `QueryResult` 또는 domain/model로 변환합니다.
- `Info -> Response` 변환은 Presenter 책임입니다.

## 5. 네이밍 기준

- Controller: `*WebController`
- UseCase: `*WebUseCase`, `*InternalUseCase`, 배치 진입점은 `*UseCase`
- Facade: `*WebFacade`, `*InternalFacade`, 배치 진입점은 `*Facade`
- Processor: `*Processor`
- Presenter: `*Presenter`
- Out client interface: `*Client`
- Query result: `*QueryResult`
- Criteria: `*Criteria`
- Query object: `*Query`

## 6. Swagger / API 문서

- `@Tag`, `@Operation`, `@Parameter`, `@Schema`를 기본으로 작성합니다.
- 설명 문구는 한국어를 기본으로 합니다.
- 인증이 필요한 API는 `@SecurityRequirement`를 명시합니다.
- 내부 API는 `@Hidden` 적용을 검토합니다.

## 7. Record DTO Swagger 정렬

- `record` 기반 request / response / item DTO에서는 각 component의 `@Schema`를 component 바로 위 줄에 둡니다.
- component 사이에는 한 줄을 비워서 설명 블록이 눈에 잘 들어오도록 맞춥니다.
- validation annotation이 있으면 `@Schema` 다음 줄에 이어서 배치합니다.
- Lombok `@Builder`와 record 선언 사이에는 빈 줄을 두지 않습니다.

권장 형태:

```java
@Builder
@Schema(description = "예시 응답 DTO")
public record ExampleResponse(

    @Schema(description = "필드 1 설명")
    String field1,

    @Schema(description = "필드 2 설명")
    @NotBlank
    String field2
) {
}
```

### 7-1. 응답 DTO 의 식별자는 String 이다 (필수)

**클라이언트로 내보내는 모든 식별자는 `String` 으로 직렬화합니다.** `long` / `Long` 을 그대로
내보내지 않습니다.

내부 PK 는 Snowflake 라 19자리에 이르는데, 자바스크립트의 `Number` 는 정수를 안전하게 다룰 수
있는 상한이 `Number.MAX_SAFE_INTEGER`(9,007,199,254,740,991 — 16자리)입니다. 그 위의 값은
**예외 없이 조용히 반올림됩니다.**

```
서버가 보낸 값      4611686018427387904
JS 가 읽은 값       4611686018427388000   ← 예외도 경고도 없다
```

이 고장의 성질이 규칙을 필수로 만듭니다. 목록 조회는 멀쩡히 되고 화면도 잘 그려지는데,
그 아이디로 상세를 부르는 순간에만 404 가 납니다. 원인이 직렬화라는 것이 드러나기까지
오래 걸립니다.

**적용 범위**

| 위치 | 타입 | 이유 |
| --- | --- | --- |
| `dto/response`, `dto/item` 의 모든 `*Id` | `String` | 클라이언트가 읽는 값 |
| `@PathVariable`, `@RequestParam` | `long` / `Long` | 문자열로 와도 Spring 이 변환한다 |
| `dto/request` 의 `*Id` | `Long` | JSON 문자열도 Jackson 이 변환한다 |
| `application/info`, `domain/model` | `long` / `Long` | 서버 안에서는 수치가 맞다 |

경계는 **Presenter** 입니다. `Info` 까지는 `long` 으로 두고, `Info -> Response` 변환에서
`String.valueOf(...)` 로 바꿉니다. nullable 식별자는 null 을 유지합니다.

```java
// Presenter
.planId(String.valueOf(info.planId()))
// 대상이 없는 항목(이동 등)은 null 을 유지한다
.targetId(info.targetId() == null ? null : String.valueOf(info.targetId()))
```

**Snowflake 가 아닌 식별자도 String 으로 통일합니다.** TourAPI `contentId` 처럼 지금은 짧은
값이라도 마찬가지입니다. 타입이 필드마다 갈리면 프론트가 "이건 숫자, 저건 문자열"을 외워야
하고, 외우는 규칙은 반드시 틀립니다.

`@Schema` 의 `example` 도 따옴표 안의 문자열로 적어 Swagger 문서에서 타입이 드러나게 합니다.

## 8. 로그 / 예외

- 로그는 검색 가능한 영어 키 + 값 조합을 우선합니다.
- 사용자 노출 예외 메시지와 내부 로그 메시지는 분리해서 봅니다.
- 에러 코드는 서비스 컨텍스트 안에서 일관되게 관리합니다.

### 8-1. 예외 패턴 (필수)

모든 서비스는 동일한 Level 2 패턴을 따릅니다. `BadRequestException` 같은 공통 예외는 사용하지 않습니다.

- `{Domain}ErrorCode` enum — `code`, `message`, `HttpStatus` 3 필드 고정
- `{Domain}Exception extends RuntimeException` — ErrorCode 를 주입받고 `super(errorCode.getMessage())`
- `{Domain}ExceptionHandler` (`@RestControllerAdvice`) — ErrorCode 의 HttpStatus 와 code 를 `Response.fail()` 로 변환
- 위치: `application/exception/{Domain}ErrorCode.java`, `application/exception/{Domain}Exception.java`, `adapter/in/web/exception/{Domain}ExceptionHandler.java`

생성자는 이 조합만 씁니다. 임의 문자열을 잇는 `(errorCode, String detail)` 형태는 만들지 않습니다 —
상세가 필요하면 메시지에 `(%s)` 자리 표시자를 두고 `Object... args` 로 채웁니다.

- 웹 서비스: `(errorCode)` 필수. 필요 시 `(errorCode, Object... args)`(BossPickSeoul 캐논), `(errorCode, Throwable cause)`
- 배치 서비스: `(errorCode, Object... args)` + `(errorCode, Throwable cause, Object... args)`.
  웹 응답이 없으므로 ErrorCode 는 `code`, `message` 2 필드이고 메시지에 `[코드]` 접두어를 붙여 로그에서 바로 찾는다

```java
// 1. ErrorCode 정의
@Getter @RequiredArgsConstructor
public enum PlanErrorCode {

    PLAN_DATE_RANGE_INVALID("PLAN_003", "여행 시작일은 종료일보다 늦을 수 없습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

// 2. Exception 정의
@Getter
public class PlanException extends RuntimeException {

    private final PlanErrorCode errorCode;

    public PlanException(PlanErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}

// 3. 처리
throw new PlanException(PlanErrorCode.PLAN_DATE_RANGE_INVALID);
```

### 8-2. 검증 에러코드 규약 (필수)

공통 검증 예외 (`MethodArgumentNotValidException`, `MethodArgumentTypeMismatchException`, `ConstraintViolationException`, `HandlerMethodValidationException`) 는 **`{DOMAIN}_400` 같은 뭉뚱그린 코드를 쓰지 않습니다.** 필드별로 개별 에러코드를 부여해 클라이언트가 코드 단위로 분기할 수 있게 합니다.

**1) 코드 대역** — 검증 전용 코드는 `1xx` 대역을 사용합니다. 비즈니스 코드(`001~`)와 번호가 섞이지 않아 확장이 쉽습니다. 대역 안에서 역할을 나눕니다.

| 코드 | 정의 위치 | 용도 |
| --- | --- | --- |
| `{DOMAIN}_100` | ErrorCode enum (`INVALID_REQUEST`) | 접두어가 없는 메시지의 폴백 |
| `{DOMAIN}_101~` | `*ValidationMessage` 상수 클래스 | 필드별 개별 코드 |
| `{DOMAIN}_1xx` 끝 | ErrorCode enum (`PARAMETER_TYPE_INVALID`, `PARAMETER_REQUIRED`) | 프레임워크 공통 2종 — 타입 불일치(`MethodArgumentTypeMismatchException`), 필수 파라미터 누락(`MissingServletRequestParameterException`). 이 순서로 대역 끝에 둔다 |

필드별 코드는 ErrorCode enum에 **중복 정의하지 않습니다.** 상수 클래스가 단일 기준점입니다.

```java
// PetErrorCode — 비즈니스 코드 + 핸들러가 참조하는 기본 코드만 둔다
NOT_FOUND_PET("PET_002", "존재하지 않는 반려견입니다", HttpStatus.NOT_FOUND),
INVALID_REQUEST("PET_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
PARAMETER_TYPE_INVALID("PET_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);
```

**2) 필드별 코드는 상수 클래스에 모은다** — 도메인의 `application/exception/{Domain}ValidationMessage` 에 `"CODE:사용자 메시지"` 형식으로 정의하고, DTO는 그 상수를 참조합니다. Bean Validation `message` 는 컴파일 상수만 받으므로 enum을 직접 넘길 수 없고, 문자열을 DTO에 그대로 적으면 오타가 조용히 폴백 코드로 새기 때문입니다. 상수를 참조하면 오타·삭제가 컴파일 에러로 잡힙니다.

```java
public final class PetValidationMessage {

    public static final String NAME_REQUIRED = "PET_101:반려견 이름은 필수입니다.";
    public static final String NAME_LENGTH_INVALID = "PET_102:반려견 이름은 20자 이하만 가능합니다.";

    private PetValidationMessage() {
    }
}
```

```java
@Schema(description = "반려견 이름", example = "몽실이")
@NotBlank(message = PetValidationMessage.NAME_REQUIRED)
@Size(max = 20, message = PetValidationMessage.NAME_LENGTH_INVALID)
String name,
```

**3) 핸들러는 공통 유틸에 위임** — `common-core` 의 `ValidationErrorSupport` 가 접두어를 파싱해 응답을 만듭니다. 접두어가 없으면 인자로 넘긴 기본 코드를 사용합니다.

```java
@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<Response<Void>> handleValidation(MethodArgumentNotValidException exception) {
    return ValidationErrorSupport.toResponse(exception, PetErrorCode.INVALID_REQUEST.getCode());
}
```

**4) 응답 형태** — `resultCode` 는 대표 오류 코드이고, `resultMessage` 에 대표 메시지와 필드별 오류 목록이 담깁니다.

한 필드에 제약이 여러 개 걸리면 오류도 여러 개 나옵니다. 오류를 버리지 않고 모두 담되(사용자가 한 번에 모두 고칠 수 있도록) **순서를 고정**합니다. Bean Validation 스펙은 제약 평가 순서를 보장하지 않으므로, 정렬하지 않으면 같은 요청에 `resultCode` 가 달라집니다.

정렬 기준은 `ValidationErrorSupport` 가 아래 순서로 적용합니다.

1. **필드 순서** — record DTO면 컴포넌트 선언 순서. 알 수 없으면(파라미터 검증 등) 등장 순서
2. **제약 우선순위** — 필수(`NotNull`/`NotBlank`/`NotEmpty`) → 길이(`Size`/`Length`) → 범위(`Min`/`Max`/`Positive` 등) → 형식(`Email`/`Pattern`/`URL`) → 그 외
3. **메시지** — 위 두 기준이 같을 때 순서를 고정하기 위한 마지막 기준

`resultCode` 와 대표 메시지는 정렬된 첫 오류를 씁니다. 클라이언트는 입력 항목별로 해당 `field` 의 **첫 오류만 표시**하면 됩니다.

**같은 의미를 두 제약으로 중복 검사하지 않습니다.** 메시지가 겹치면 같은 필드에 사실상 동일한 안내가 두 번 나갑니다. 예를 들어 비밀번호는 `@Size` 가 길이만, `@Pattern` 이 문자 구성만 담당하도록 나눕니다.

```java
// 지양 — @Pattern 의 \S{8,20} 이 @Size 와 길이를 중복 검사
@Size(min = 8, max = 20, message = MemberValidationMessage.PASSWORD_LENGTH_INVALID)
@Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[특수문자])\\S{8,20}$", ...)

// 권장 — 길이는 @Size, 문자 구성은 @Pattern
@Size(min = 8, max = 20, message = MemberValidationMessage.PASSWORD_LENGTH_INVALID)
@Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[특수문자])\\S+$", ...)
```

**5) 컬렉션 원소는 `@NotNull` 과 값 제약을 쌍으로 겁니다 (필수)** — `List<@Positive Long>` 처럼
값 제약만 걸면 **null 원소가 검증을 통과합니다.** Bean Validation 스펙상 `@Positive`·`@Size`·
`@Email` 같은 값 제약은 null 을 유효로 보기 때문입니다.

```java
// 지양 — [null] 이 통과한다. 통과한 뒤의 결과는 서비스마다 다르다
List<@Positive(message = PlanValidationMessage.PET_ID_POSITIVE) Long> petIds

// 권장 — 존재와 값을 나눠 건다
List<@NotNull(message = PlanValidationMessage.PET_ID_POSITIVE)
     @Positive(message = PlanValidationMessage.PET_ID_POSITIVE) Long> petIds
```

위 **2) 제약 우선순위**가 `필수 → 길이 → 범위 → 형식` 인 것이 이미 이 쌍을 전제한 정렬입니다.
"같은 의미를 두 제약으로 중복 검사하지 않는다"에도 걸리지 않습니다 — **존재와 값은 다른
의미**라, 비밀번호를 `@Size`(길이) + `@Pattern`(구성)으로 나누라는 아래 권장과 같은 모양입니다.

**`.filter(Objects::nonNull)` 로 접지 않습니다.** 코드는 짧아지지만 "안 보낸 것"과 "잘못 보낸
것"이 같은 결과가 됩니다. 이 저장소는 그 둘을 구분하는 쪽으로 계속 결정해 왔습니다 —
`score: null` 을 0 으로 접지 않고, 예보 없음과 좋은 날씨를 구분하고, 특성 조회 실패를
`petConditionApplied: false` 로 드러냅니다. 조용히 무시하면 **클라이언트가 자기 버그를 영영
못 봅니다.**

**6) advice 범위** — `@RestControllerAdvice(basePackages = "...domainlayer")` 를 명시합니다. 한 서비스에 advice 가 둘 이상이면 좁은 범위 advice 에 `@Order` 를 부여해 우선순위를 확정합니다 (예: auth-service 의 `AuthExceptionHandler` 가 `MemberExceptionHandler` 보다 앞).

### 8-3. 하드코딩된 문자열 금지

반복 사용되는 상태 코드 / 구분 값은 반드시 enum 으로 정의합니다.

- 여행 적합도 등급 (`HIGH/MEDIUM/LOW/INSUFFICIENT`) → `SuitabilityLevel`
- 반려견 동반 가능 구분 (`ALLOWED/PARTIALLY_ALLOWED/NOT_ALLOWED/UNKNOWN`) → `PetAllowanceType`
- 일정 항목 종류 (`PLACE/MEAL/LODGING/WALK/MOVE`) → `PlanItemType`

API 응답에서 enum 을 문자열로 내보낼 때는 `enum.name()` 을 사용하여 기존 계약을 유지합니다.

## 9. 엔티티 / 영속성

### 9-1. 기본 규칙

- 필드 설명이 필요한 엔티티는 `@Comment` 를 사용합니다.
- 단일 PK 를 우선하고, N:N 관계는 중간 테이블을 분리합니다.
- 삭제 전략과 복구 요구사항에 맞춰 명시적으로 선택합니다.
- **JPA 연관관계 어노테이션 (`@ManyToOne` / `@OneToMany` / `@OneToOne` / `@ManyToMany` / `@JoinColumn` / `@JoinTable`) 은 사용하지 않습니다.** 서비스 간 / 서비스 내 모든 관계는 raw FK 컬럼만으로 표현하고, 객체 그래프 탐색이 필요하면 application 계층에서 별도 조회로 처리합니다. 이는 서비스 경계를 흐리지 않고 DB 결합도를 낮추기 위함입니다.

### 9-2. 엔티티 필드 타입

| 필드 종류 | 타입 | 비고 |
|----------|------|------|
| PK `id` | `Long` (Wrapper) | JPA 권장, 미저장 상태 명시 가능 |
| FK 컬럼 | `Long` / `Integer` (Wrapper) | `null` 명시 + Builder 호환성 |
| nullable 의미가 있는 ID / 수치 | Wrapper | 미설정 / 부재 표현 필요 |
| 카운트 / NOT NULL DEFAULT 0 인 수치 | **primitive** `long` / `int` | 응답 항상 동일 모양, `0` 과 `null` 구분 의미 없음 |
| boolean | primitive | 기본값 `false` 가 자연스러움 |

> 카운트 필드 (`likeCount`, `viewCount`, `visitCount` 등) 는 항상 0 부터 시작하므로 primitive 가 안전합니다. 프론트는 `count > 0` 조건으로 0 미표시 UI 를 깔끔하게 구현할 수 있습니다.

### 9-3. 도메인 모델 필드 타입

- PK / FK: **primitive `long`** — 도메인 객체는 식별된 시점에만 존재 (생성 직후 ID 가 없는 상태가 도메인에 노출되지 않음)
- nullable 의미가 있는 ID (예: `parentCommentId`): Wrapper `Long`
- 카운트 / 수치: primitive

→ **레이어별 분리**: 엔티티는 Wrapper, 도메인은 primitive. Mapper (MapStruct) 가 `long ↔ Long` 자동 변환을 처리합니다.

### 9-4. FK 컬럼 주석 표기

외래키 컬럼은 `@Comment` 에 `(FK: target_table.id)` 형식으로 참조 대상을 명시합니다. DB 만 봐도 어떤 테이블의 어떤 컬럼을 참조하는지 파악할 수 있어야 합니다.

```java
@Column(nullable = false)
@Comment("회원 아이디 (FK: member.id)")
private Long memberId;

@Column(nullable = false)
@Comment("여행 일정 아이디 (FK: plan.id)")
private Long planId;
```

다중 대상 FK (`targetKind` 같은 enum 으로 분기) 는 가능한 후보를 모두 명시합니다.

```java
@Comment("일정 항목 대상 아이디 (FK: place.id 또는 walk_course.id, itemType 에 따라 분기)")
private Long targetId;
```

### 9-5. 인덱스 명명

- 일반 인덱스: `idx_{table}_{col1}_{col2}_{col3}_...`
- 유니크 인덱스: `uk_{table}_{col1}_{col2}_{col3}_...`
- 컬럼명은 snake_case (DB 컬럼명 기준)
- **모든 컬럼명을 풀 네임으로 포함** — `_member_id_created_at` 같이 `(memberId, createdAt)` 둘 다 표현
- 컬럼명이 길어 인덱스 이름이 64자 (MySQL 제한) 를 초과하면 의미를 해치지 않는 범위에서 축약 허용
- 한 컬럼만 있는 인덱스는 `idx_{table}_{col}` 형식 그대로

권장:

```java
@Table(
    name = "plan_item",
    indexes = {
        @Index(name = "idx_plan_item_plan_id_day_sequence",
            columnList = "planId,day,sequence"),
        @Index(name = "uk_plan_item_plan_id_day_sequence",
            columnList = "planId,day,sequence", unique = true)
    }
)
```

지양:

```java
// 컬럼이 어떤 게 들어있는지 이름만 봐서는 알 수 없음
@Index(name = "idx_plan_item_plan_id", columnList = "planId,day,sequence")
```

### 9-6. 쿼리 작성 규칙 (필수)

수단을 이 순서로 고른다. 아래 단계로 내려갈수록 비용이 커지므로 위에서 해결되면 내려가지 않는다.

| 상황 | 수단 | 위치 |
|------|------|------|
| 조건이 고정된 단순 조회 | 파생 쿼리 (`findByIdAndMergedIntoIdIsNull` 등) | `repository/` |
| 조건이 고정된 복합 조회 | 정적 JPQL `@Query` | `repository/` |
| **조건이 동적으로 켜지고 꺼지는 조회, 조인** | **QueryDSL** (`BooleanBuilder`, 엔티티 조인) | `repository/custom/{X}CustomRepository` + `Impl` |
| DB 방언이 필요한 대량 쓰기 (`ON DUPLICATE KEY UPDATE` 등) | JDBC (`JdbcTemplate.batchUpdate`) | batch-service `adapter/out/persistence/Jdbc*Adapter` |
| 네이티브 `@Query(nativeQuery = true)` | **쓰지 않는다** | 위 수단으로 안 되면 설계를 다시 본다 |

- 동적 조건을 JPQL 로 쓰면 `(:param is null or ...)` 가 조건 수만큼 늘어 쿼리가 조건 대장이 된다.
  QueryDSL 은 null 인 조건이 where 에 아예 들어가지 않는다. 본보기: `PlaceCustomRepositoryImpl`.
- 연관관계 어노테이션을 쓰지 않으므로(§9-1) 조인은 QueryDSL **엔티티 조인**(`.join(entity).on(...)`)으로
  잇는다. 두 엔티티를 나열하고 where 로 묶는 세타 조인은 조인 의도가 문장에 드러나지 않아 피한다.
  본보기: `CongestionForecastCustomRepositoryImpl`.
- `JPAQueryFactory` 는 `persistence-core` 의 `QuerydslConfigurer` 를 서비스 BeansConfig 에서
  `@Import` 해 얻는다. `@DataJpaTest` 슬라이스에는 이 빈이 없으므로 테스트에도 `@Import` 한다.
- **`@Param` 은 쓰지 않는다.** Spring Boot 플러그인이 `-parameters` 를 켜 주므로 메서드 파라미터명이
  쿼리의 이름과 같으면 그대로 바인딩된다 (BossPickSeoul 동일). 바인딩 실패는 리포지터리 생성
  시점에 터지므로 H2 슬라이스 테스트가 잡는다.
- **커스텀 구현은 컴파일로 검증되지 않는다.** 동적 조건 조립과 조인은 반드시 H2 슬라이스 테스트로
  실제 스키마에 질의해 본다.

### 9-7. N+1 금지 (필수)

루프나 스트림 안에서 단건 조회를 부르지 않는다. 항목 수만큼 왕복이 생긴다.

- **DB 단건 조회 반복** → `in` 절 벌크 조회로 바꾼다 (`findVisibleIds(Collection<Long>)`).
- **원격(Feign) 단건 호출 반복** → 대상 서비스에 벌크 내부 엔드포인트를 연다. 가장 비싼 종류의
  N+1 이다 — 일정 항목 8개를 저장하며 HTTP 를 8번 왕복하던 자리를
  `GET /internal/v1/places/visible-ids` 하나로 바꾼 것이 본보기다.
- 연관관계 어노테이션을 쓰지 않으므로(§9-1) 지연로딩 N+1 은 구조적으로 없다. 남는 것은
  손으로 쓴 루프뿐이니 리뷰에서 `for`/`stream` 안의 `Port.`/`Repository.` 호출을 본다.
- 성격상 반복이 맞는 것은 그대로 둔다 — 주소별 지오코딩, 날짜별 날씨 조회처럼 호출 단위가
  원천의 단위인 경우다. 그 이유를 주석으로 남긴다.

## 10. Internal / External Client 규칙

- Spring 백엔드 서비스 간 조회 / 연동은 기본적으로 `FeignClient`를 사용합니다.
- Feign 인터페이스는 전용 패키지 안에서 `*Client` 이름을 사용합니다.
  - 예: `PlaceSearchClient`, `SuitabilityClient`
- `name`은 서비스명을 하드코딩하지 않고 프로퍼티 참조 + local 기본값 폴백으로 선언합니다.
  - 형식: `name = "${feign-client.target-services.<논리명>:<논리명>}"`
  - 예: `name = "${feign-client.target-services.tour-service:tour-service}"`
  - 이유: Eureka 등록명은 환경별 접미사(`-dev`/`-prod`)가 붙은 `*_APP_NAME` 값이므로,
    하드코딩하면 dev/prod에서 `Load balancer does not contain an instance` 503이 발생합니다.
  - dev 프로파일 yml에 `feign-client.target-services.<논리명>: ${<대상>_APP_NAME}` 매핑을 두고,
    호출하는 쪽 서비스의 compose environment에 해당 `*_APP_NAME`을 주입합니다.
    local은 매핑 없이 기본값 폴백으로 동작합니다.
- 같은 대상 서비스를 여러 인터페이스가 호출하면 `contextId`를 반드시 지정합니다 (빈 이름 충돌 방지).
- `adapter/out/client`의 adapter는 Feign 응답을 바로 사용하지 않고 `QueryResult` 또는 domain/model로 변환합니다.
- `url`, per-client `configuration`은 꼭 필요한 사유가 없으면 기본값으로 추가하지 않습니다.
- timeout, 공통 헤더 정책은 가능한 한 `spring.cloud.openfeign.client.config` 같은 공통 설정으로 관리합니다.
  - 기본 read timeout 60초는 장애 전파에 취약하므로, Feign을 쓰는 서비스는 dev/local 프로파일에
    `INTERNAL_CLIENT_CONNECT_TIMEOUT_MS` / `INTERNAL_CLIENT_READ_TIMEOUT_MS` 기반 공통 타임아웃을 선언합니다.
- Feign을 쓰는 서비스는 Resilience4j CircuitBreaker를 함께 적용합니다.
  - 설정은 per-client `configuration` 클래스가 아니라 `application.yml`의
    `resilience4j.circuitbreaker.configs.default` + `instances.<논리 서비스명>`으로 관리합니다.
  - 서킷 인스턴스명은 대상 서비스의 논리명(`tour-service` 등)으로 하고, 상수는
    각 서비스의 `adapter/out/client/support/InternalResponseSupport`에 둡니다.
  - 서킷 적용과 예외 변환은 `InternalResponseSupport.requestAndUnwrap(대상, Supplier)`에서 수행합니다.
    서킷은 Feign 호출만 감싸 전송 실패(5xx·타임아웃)만 집계하고, 4xx(`FeignClientException`)는
    호출한 쪽의 요청 문제이므로 `ignore-exceptions`로 제외합니다.
  - `CallNotPermittedException`(서킷 오픈)과 `FeignException`은 support 안에서 각 도메인 예외
    (`{DOMAIN}_xxx INTERNAL_SERVICE_UNAVAILABLE`, 503)로 변환합니다. Feign 관련 예외가
    application 계층이나 web advice까지 새어나가지 않게 합니다 (`architecture-guide.md` §7).
- LLM·OAuth·공공데이터 같은 외부 API 호출도 동일한 서킷 패턴을 적용합니다.
  - 인스턴스명 예: `llm`(ai-service, provider 무관 단일 인스턴스), `kakao`(auth-service),
    `tourapi`/`durunubi`/`kma`(tour-service·batch-service의 공공 API별 분리).
  - LLM처럼 정상 응답이 수십 초인 의존은 인스턴스 설정에서 `slow-call-duration-threshold`를 완화합니다.
  - 사용자 조작으로 발생하는 4xx(예: OAuth 인가코드 만료)는 서킷 안에서 도메인 예외로 변환하고
    `ignore-exceptions`로 제외해, 사용자 실수가 서킷을 열지 않게 합니다.
  - 모든 외부 호출은 connect/read(response) timeout을 반드시 명시합니다. 타임아웃 없는 블로킹 호출 금지.

## 11. Enum Metadata 규칙

- enum metadata는 기본 설명 필드명을 `description`으로 통일합니다.
- enum이 UI 표시용 이름을 별도로 가져야 하면 `name`보다 `displayName`을 우선합니다.
  - 이유: Java enum은 이미 `name()`을 제공하므로 `displayName`이 더 명확합니다.
- 점수 해석용 설명이 필요하면 `scoreDescription`을 사용합니다.
- `code` 필드는 `enum.name()`만으로 충분하지 않을 때만 추가합니다.

권장 enum 필드:

- `displayName`
- `description`
- `scoreDescription`
- `sortOrder`

응답 DTO에서는 enum metadata를 가능한 한 별도 metadata 객체로 묶습니다.

권장 형태:

```json
{
  "suitabilityLevel": {
    "code": "HIGH",
    "name": "여행 적합",
    "description": "기온, 혼잡도, 반려견 동반 조건을 종합한 여행 적합 등급입니다.",
    "scoreDescription": "점수가 높을수록 오늘 반려견과 방문하기 좋습니다."
  }
}
```

세부 규칙:

- metadata 객체 안에서는 `code`, `name`, `description`을 기본으로 사용합니다.
- 점수 해석 문구가 필요할 때만 `scoreDescription`을 추가합니다.
- flat 구조가 불가피하면 `suitabilityLevelCode`, `suitabilityLevelName`처럼 도메인 접두어를 붙입니다.
- 이미 `suitabilityLevel` 객체 안에 들어 있다면 `suitabilityLevelDescription`보다 `description`을 우선합니다.

## 12. Client / Port Naming

이 절은 **카테고리별로** 아웃바운드 포트 이름을 정리한다. 각 카테고리는 전송/구현 디테일이 아니라 **책임**으로 구분한다.

### 12-1. 크로스 서비스 Feign 포트 (inter-service)

서비스 간 HTTP 호출에 해당한다.

- Feign interface: `*Client`
  - 위치: `adapter/out/client/feign/`
  - 예: `PlaceSearchClient`
- Out port: 책임으로 명명 (전송 기술 금지)
  - Read-only: `*QueryPort`
  - State-changing: `*CommandPort`
- Adapter: `*ClientAdapter`
  - 위치: `adapter/out/client/`
  - 하나의 adapter 가 여러 port 를 구현해도 응집도가 유지되면 분리하지 않는다.
- 어댑터에서 application 으로 넘기는 타입: `*QueryResult`
- Feign-only raw DTO 가 필요할 때만 `adapter/out/client/feign/dto` 에 두고 `*FeignResponse` 또는 `*ClientResponse` 사용.

권장 구조:

```text
application/port/out/PlaceSearchQueryPort
adapter/out/client/PlaceSearchClientAdapter
adapter/out/client/feign/PlaceSearchClient
application/port/out/query/PlaceSearchQueryResult
```

### 12-2. JPA 저장소 포트 (persistence)

데이터베이스 영속성 포트.

- Port: `*RepositoryPort`
  - 위치: `application/port/out/`
  - 예: `PlanRepositoryPort`, `PetRepositoryPort`
- Adapter: `*RepositoryAdapter` 또는 `*PersistenceAdapter`
  - 위치: `adapter/out/persistence/`
- 어댑터에서 넘기는 타입: domain/model (MapStruct 매퍼 거침)

### 12-3. 인프라 특화 포트 (Redis / LLM / 외부 API / JDBC 배치 등)

도메인 의미를 그대로 표현한 이름을 사용한다. 전송 기술을 접두사로 붙여도 그 기술이 도메인 성격을 드러낼 때만 허용.

- 예: `AiLlmPort`, `AiPlanCachePort`, `JwtTokenStorePort`, `WeatherObservationPort`, `CongestionForecastPort`
- JDBC 배치 전용 포트는 `*BulkPort` 또는 `*CommandPort` 사용. (예: batch-service 의 `PlaceBulkPort`)

## 13. Method Signature Wrapping

- Method declarations and invocations follow a hard wrap of `180` characters.
- If the full signature fits within `180` characters, keep it on one line.
- Do not force one-parameter-per-line wrapping when the signature still fits comfortably on one line.
- When wrapping is required, group closely related parameters on the same line when possible instead of splitting every parameter onto its own line.

Preferred:

```java
public RecommendedPlacesResponse getRecommendedPlaces(
    String areaCode, String contentTypeId, List<Long> excludedPlaceIds, PetProfileCommand petProfile,
    SuitabilityMetricType priorityMetric, Integer topN
) {
}
```

Also preferred when it fits:

```java
public PlaceProfileQueryResult getPlaceProfile(long placeId, String contentTypeId, String baseDate) {
}
```
