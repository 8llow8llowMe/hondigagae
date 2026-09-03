import type { CodeNameMetadata } from '@/types/api'
import type { ScoreMetricMetadata } from '@/types/insight'

/**
 * 여행 일정 — **홈이 쓰는 범위만** 담는다.
 * 일정 상세 화면을 만들 때 이 파일을 확장한다.
 *
 * 근거: backend plan-service `PlanWebController` / `PlanSummaryItem` /
 * `PlanWeatherResponse` **소스 실측**.
 *
 * **명세(공통명세 S3)와 다른 점**: 날씨 응답의 제목은 `title` 이 아니라 **`planTitle`**,
 * 일자별 배열은 `dailyBriefings` 가 아니라 **`days`** 다.
 */

/**
 * **#152 가 더한 필드는 전부 선택(`?`)이다** — 계약상으로는 항상 오지만, BE 브랜치
 * `feature/be/152-plan-multi-pet` 이 아직 `develop` 에 없어 **지금 서버는 보내지 않는다.**
 * 필수로 적으면 타입은 통과하고 런타임에서 `undefined` 를 만난다.
 *
 * **머지 뒤에 `?` 를 떼는 것이 이 전환의 마지막 단계다.** 그때까지 읽는 쪽은
 * `petIds ?? [petId]` 로 접는다 — 서버가 옛 일정을 `Plan.resolvePetIds()` 로 읽는 규칙과
 * 같은 폴백이라 화면이 두 시기를 구분할 필요가 없다.
 */

/** `GET /plans` — `SliceResponse<PlanSummaryItem>` 로 온다 */
export type PlanSummaryItem = {
  planId: string
  /** 대표 반려견. **`petIds[0]` 과 같다** (#152) */
  petId: string
  /**
   * 동행 반려견 (#152). **한 마리 일정이어도 원소 하나로 온다** — 빈 배열이 아니다.
   * `plan_pet` 조인 행이 없는 옛 일정도 서버가 `Plan.resolvePetIds()` 로 `[petId]` 를
   * 채워 준다. 그래서 화면은 `petId` 대신 이 배열을 기준으로 읽으면 된다.
   *
   * **`?` 인 이유는 위 절 참조** — 머지 전까지 오지 않는다.
   */
  petIds?: string[]
  areaCode: string
  title: string
  startDate: string
  endDate: string
  /** `DRAFT`(초안) / `CONFIRMED`(확정) 등. **등급 색을 쓰지 않는다** (DESIGN.md §2-3) */
  status: CodeNameMetadata
}

/**
 * 일자 판정 근거 (`PlanWeatherReasonItem`).
 *
 * **장소 적합도의 `SuitabilityReasonItem` 과 필드가 같다** — `scoreDelta` 까지 포함해서다.
 * `WalkSafetyReasonItem` 만 `scoreDelta` 가 없다 (`types/insight.ts`).
 */
export type PlanWeatherReasonItem = {
  code: string
  name: string
  description: string
  /**
   * 점수 영향. **음수면 감점, `0` 이면 정보성이다** (백엔드 `@Schema`).
   *
   * 화면은 **숫자를 노출하지 않고** 정보성만 한 단계 흐리게 내린다 — 적합도 패널과 같은
   * 처리다. 예전에는 이 필드를 타입에서 잘라, 같은 `ReasonList` 를 쓰는 두 화면 중
   * 일정 일자 판정만 그 구분을 못 했다 (#148).
   */
  scoreDelta: number
}

export type PlanAlternativePlaceItem = {
  placeId: string
  title: string
  lat: number
  lng: number
  /**
   * **그날 기준 장소로부터의 직선거리(m).** 서버가 이미 계산해 준다 — 화면이 재지 않는다.
   *
   * 기준점은 그 일자의 `representativePlaceId` 이고(`PlanWeatherPresenter`), 계산은
   * `GeoDistance.meters()` 하버사인이라 **직선거리다**. 그래서 표기에 `직선` 을 반드시
   * 붙인다 — 제주는 산간·해안도로가 많아 주행거리와 크게 다르다 (일정상세-세부명세 D3).
   */
  distanceMeters: number
}

/**
 * 한 마리의 그날 적합도 (#152).
 *
 * **점수·등급만 있다.** 판정 근거(`reasons`)·날씨·실내 대안은 기준 반려견 것만 일자에 한 번
 * 붙는다 — 날씨는 아이마다 같고, 근거 목록을 마리 수만큼 반복하면 응답이 읽기 어려워진다
 * (`PlanDayPetSuitabilityItem` javadoc).
 */
export type PlanDayPetSuitabilityItem = {
  petId: string
  /** 판단 근거가 없으면 null */
  score: number | null
  suitabilityLevel: ScoreMetricMetadata | null
}

/**
 * 일자별 브리핑. **일정 일수만큼 항상 채워진다** — 배열 길이로 성공/실패를 판단하지 않는다.
 * 그날 브리핑을 못 낸 이유는 `unavailableReason` 에 문장으로 온다.
 */
export type PlanDayWeatherItem = {
  /** 1부터 */
  day: number
  date: string
  representativePlaceId: string | null
  representativePlaceTitle: string | null
  /**
   * 그날 판정의 기준이 된 반려견 (#152). **아이별 판정 중 점수가 가장 낮은 아이다** —
   * 한 마리라도 힘든 날이면 그날은 힘든 날이라는 규칙이다 (`PlanWeatherProcessor.pickBasisPet`).
   *
   * **대표 반려견(`petIds[0]`)과 다를 수 있다.** 아래 `score`·`suitabilityLevel`·`reasons`·
   * `indoorAlternatives` 는 전부 **이 아이 기준**이므로, 화면이 대표 이름을 붙이면 거짓말이
   * 된다. 판정을 못 낸 날은 null 이다.
   */
  basisPetId?: string | null
  /** `basisPetId` 기준. 판단 근거가 없으면 null */
  score: number | null
  /** `basisPetId` 기준 */
  suitabilityLevel: ScoreMetricMetadata | null
  /** `basisPetId` 기준 */
  reasons: PlanWeatherReasonItem[]
  weather: PlanDailyWeatherItem | null
  /** `basisPetId` 기준 */
  indoorAlternatives: PlanAlternativePlaceItem[]
  /**
   * 아이별 점수·등급 (#152). **한 마리 일정이면 원소 하나고, 판정을 못 낸 날은 빈 배열이다** —
   * `petIds` 와 길이가 다를 수 있다(그 아이만 조회에 실패하면 빠진다). 순서는 `petIds` 순이다.
   */
  petSuitabilities?: PlanDayPetSuitabilityItem[]
  /** null 이면 정상. 값이 있으면 **화면에 그대로 안내한다** */
  unavailableReason: string | null
}

/**
 * 일자별 날씨 요약. 일정 브리핑 전용이라 인사이트의 `DailyWeatherItem` 과 다르다.
 *
 * **하늘상태·강수형태는 metadata 객체가 아니라 문자열이다.** 명세는 `skyState`
 * (`CodeNameMetadata`)로 적었지만 실제 DTO 는 `skyStateName: String` 이다 —
 * 서버가 이미 표시용 이름으로 낮춰서 준다. `fc7d8af`(중기예보를 이어 붙여 예보 범위를
 * 11일로 확장) 에서 출처·풍속·습도가 함께 들어왔다. 근거: `PlanDailyWeatherItem` 실측.
 */
export type PlanDailyWeatherItem = {
  date: string
  /**
   * `SHORT_TERM` / `MID_TERM`. **`MID_TERM` 이면 대략적인 값이다** (스키마 설명 명시) —
   * 정밀도 차이를 감추지 않고 화면에 출처를 밝힌다.
   */
  forecastSourceCode: string | null
  forecastSourceName: string | null
  minTemperature: number | null
  maxTemperature: number | null
  maxPrecipitationProbability: number | null
  /** 그날 가장 나쁜 강수형태 — 이름 문자열 (예: `'비'`) */
  precipitationTypeName: string | null
  /** 대표 하늘상태 — 이름 문자열 (예: `'흐림'`) */
  skyStateName: string | null
  maxWindSpeed: number | null
  maxHumidity: number | null
}

/** 중기예보 구간. 이 값이면 판정 옆에 출처를 밝힌다 */
export const MID_TERM_FORECAST_CODE = 'MID_TERM'

/** `GET /plans/{planId}/weather` */
export type PlanWeatherResponse = {
  planId: string
  planTitle: string
  startDate: string
  endDate: string
  /** 판정에 들어간 동행 반려견 (#152). 일자별 `basisPetId` 는 이 안의 하나다. `?` 는 위 절 참조 */
  petIds?: string[]
  /**
   * false 면 특성 조회에 실패해 일반 조건으로 판정한 결과다.
   * **여러 마리면 "한 마리라도 반영됐는가" 다** — 마리별 플래그가 아니다 (#152).
   */
  petConditionApplied: boolean
  days: PlanDayWeatherItem[]
}

// ─── 목록 · 생성 (#75) ────────────────────────────────────────────────────────

/**
 * 일정 상태. 근거: backend `PlanStatus` (plan-service `domain/enums`).
 *
 * **서버가 이 셋 밖의 코드를 내려도 화면이 깨지지 않아야 한다** — 배지는 `status.name`
 * 을 그대로 쓰고 톤만 초안과 같이 그린다 (공통명세 S7).
 */
export const PLAN_STATUS_CODES = ['DRAFT', 'CONFIRMED', 'COMPLETED'] as const
export type PlanStatusCode = (typeof PLAN_STATUS_CODES)[number]

/** 상태 필터 축. `ALL` 은 서버 코드가 아니라 화면이 만든 값이다 */
export const PLAN_STATUS_FILTERS = ['ALL', ...PLAN_STATUS_CODES] as const
export type PlanStatusFilter = (typeof PLAN_STATUS_FILTERS)[number]

/**
 * 목록 좁히기. **URL `searchParams` 에 싣는다** (architecture-guide.md §10 — URL 이 기본).
 *
 * 장소 필터와 성격이 다르다는 점이 중요하다. 저쪽은 **서버 조회 파라미터**라 필터가
 * 바뀌면 query key 가 갈리고 재조회가 일어난다. 이쪽은 서버 파라미터가 아예 없어
 * **같은 조회 결과를 화면에서 거를 뿐이라 query key 에 넣지 않는다** (공통명세 S3).
 * 필터를 바꿔도 재조회가 없다.
 *
 * 그래도 URL 에 두는 이유는 새로고침·뒤로가기·만들기 후 복귀에서 보고 있던 조건이
 * 살아 있어야 하기 때문이다.
 */
export type PlanFilters = {
  status: PlanStatusFilter
  /** 비어 있으면 전체. 다중 축이다 */
  petIds: string[]
}

export const DEFAULT_PLAN_FILTERS: PlanFilters = { status: 'ALL', petIds: [] }

/**
 * `POST /plans` 요청 본문.
 *
 * **`petId` 만 서버가 `Long` 으로 읽는다.** 응답의 `petId`/`planId` 는 문자열인데
 * 생성 요청의 `petId` 는 `Long` 이다 — Snowflake 라 `Number()` 로 바꾸면 정밀도를
 * 잃는다. 문자열 그대로 실어 보내고 Jackson 이 `Long` 으로 읽게 한다 (공통명세 S1).
 *
 * `items` 는 보내지 않는다 — 빈 일정을 만들고 장소는 일자 편집 화면에서 담는다.
 */
export type PlanCreatePayload = {
  /**
   * **선택이다** (#152). 예전에는 `@NotNull` 이었지만 `petIds` 가 생기면서 `@Positive` 만
   * 남았다. `petIds` 가 함께 오면 **무시된다.**
   */
  petId?: string
  /**
   * 동행 반려견 (#152). **최대 5마리**(`@Size(max = 5)`, 넘으면 `PLAN_115`)이고
   * **첫 번째가 대표 반려견**이 된다. 중복은 서버가 순서를 지켜 한 마리로 접는다.
   *
   * 우선순위가 `AiPlanCreateRequest` 와 **똑같다** — `petIds` 승 → `petId` → 대표 반려견,
   * 셋 다 없으면 `PLAN_010`. 그래서 생성과 담기에서 반려견을 다른 모양으로 실을 이유가 없다.
   */
  petIds?: string[]
  areaCode: string
  title: string
  startDate: string
  endDate: string
  /** 생략 가능. 0 이상 */
  budget?: number
  /**
   * 생략 가능. **직접 만들기는 보내지 않고**(빈 일정) AI 초안 담기만 채운다
   * (`src/lib/ai-plan/draft-to-plan.ts`).
   */
  items?: PlanItemRequest[]
}

/** 백엔드 `PlanItemType` — 요청의 `itemType` 은 **이 다섯 중 하나여야 한다** */
export const PLAN_ITEM_TYPES = ['PLACE', 'MEAL', 'LODGING', 'WALK', 'MOVE'] as const
export type PlanItemTypeCode = (typeof PLAN_ITEM_TYPES)[number]

/**
 * 일정 항목 요청. 근거: backend plan-service `PlanItemRequest` **소스 실측**.
 *
 * **응답(`PlanItemDetail`)과 모양이 다르다.** `planItemId` 가 없고 `itemType` 이 metadata
 * 객체가 아니라 **enum 값 문자열**이다 — 서버가 `PlanItemType` 으로 역직렬화하므로
 * 목록에 없는 값을 보내면 항목 하나 때문에 요청 전체가 400 이 된다.
 */
export type PlanItemRequest = {
  /** 1부터. `@Min(1)` */
  day: number
  /** 0부터 */
  sequence: number
  itemType: PlanItemTypeCode
  /**
   * `PLACE`/`MEAL`/`LODGING` = `place.id`, `WALK` = **`walk_course.id`**.
   * **문자열로 보낸다** — Snowflake 라 `Number()` 를 거치면 정밀도를 잃는다.
   */
  targetId?: string
  /** `@NotBlank` · 100자 이하 */
  title: string
  /** 500자 이하 */
  memo?: string
  /** `HH:mm:ss` */
  startTime?: string
}

/**
 * `PUT /plans/{planId}` 요청 본문. **부분 수정이다** — 보내지 않은 필드는 기존 값을
 * 유지한다 (`PlanCommandProcessor.updatePlan`).
 *
 * **예산을 비우는 방법이 없다.** `budget: null` 은 "지운다" 가 아니라 "유지" 로 읽힌다.
 * 폼에서 예산을 지우면 `0` 을 보낸다 — `@PositiveOrZero` 라 0 은 유효하다 (D4).
 *
 * **기간(`startDate`/`endDate`)은 이 화면에서 보내지 않는다.** 서버가 기간을 줄여도
 * 범위 밖 항목을 정리하지 않아 고아 항목이 생긴다 — 프론트가 그 경로를 열지 않는다 (D4).
 */
export type PlanUpdatePayload = {
  title?: string
  budget?: number
  status?: PlanStatusCode
}

/** `POST /plans` · `GET /plans/{planId}` 응답. 목록보다 필드가 많다 */
export type PlanDetail = {
  planId: string
  /** 대표 반려견. **`petIds[0]` 과 같다** (#152) */
  petId: string
  /** 동행 반려견 (#152). 한 마리 일정이어도 원소 하나로 온다. `?` 는 위 절 참조 */
  petIds?: string[]
  areaCode: string
  sigunguCode: string | null
  title: string
  startDate: string
  endDate: string
  budget: number | null
  status: CodeNameMetadata
  totalDays: number
  items: PlanItemDetail[]
}

/**
 * 일정 항목이 가리키는 장소 요약 (#86).
 *
 * **필드명이 tour-service 의 장소와 같다** — 백엔드가 일부러 맞췄다
 * (`PlanItemPlaceItem` javadoc). 같은 값을 두 API 에서 다른 이름으로 받으면 FE 가
 * 변환 계층을 하나 더 만들게 되므로 **여기서도 이름을 바꾸지 않는다.**
 */
export type PlanItemPlace = {
  addr1: string | null
  /**
   * **`null` 은 "실외" 가 아니라 "원천에 정보가 없다" 는 뜻이다** — `false` 와 다르게
   * 다뤄야 한다. 판정은 `lib/place/indoor.ts` 에 있다 (#112).
   */
  indoor: boolean | null
  firstImage: string | null
  /** 항목 간 이동 거리 계산에 쓴다 */
  lat: number | null
  lng: number | null
}

/** 일정 항목. `targetId` 는 이동 항목처럼 대상이 없으면 null 이다 */
export type PlanItemDetail = {
  planItemId: string
  /** 1부터 */
  day: number
  sequence: number
  itemType: CodeNameMetadata
  targetId: string | null
  title: string
  memo: string | null
  /** `HH:mm:ss` */
  startTime: string | null
  /**
   * 방문 체크 — '다녀옴' (#124).
   *
   * **백엔드가 primitive `boolean` 이라 항상 온다** (`PlanItemDetailItem.visited`).
   * nullable 이 아니므로 `?? false` 로 덮지 않는다 — 필드가 비어 오면 계약이 깨진 것이고
   * 그것을 조용히 `false` 로 삼키면 드리프트를 놓친다.
   *
   * **일자 항목을 일괄 교체하면 초기화된다.** 교체는 새 `planItemId` 를 발급하므로
   * 그 날의 체크가 전부 `false` 로 돌아간다 (컨트롤러 설명 · screen-inventory §4).
   */
  visited: boolean
  /**
   * 항목이 가리키는 장소 요약 (#86). **객체 통째로 `null` 이 될 수 있다.**
   *
   * ① `WALK`·`MOVE` 처럼 장소를 가리키지 않는 항목, ② 원천에서 사라진(delisted) 장소,
   * ③ **tour-service 장애로 백엔드가 비운 경우** — 셋 다 `null` 이다. 즉 `null` 이
   * "장소가 없다" 를 뜻하지 않는다. **그때도 항목은 응답에 남고, 화면도 행을 지우지
   * 않는다** (공통명세 S8).
   */
  place: PlanItemPlace | null
}

/**
 * `PUT /plans/{planId}/days/{day}/items` 요청 본문의 항목 하나.
 *
 * **`targetId` 가 문자열이다.** 서버는 `Long` 으로 읽지만 `placeId` 는 Snowflake 라
 * `Number()` 를 거치면 정밀도를 잃는다(`212481712381923328` 은 `MAX_SAFE_INTEGER` 밖).
 * 문자열 그대로 실어 보내면 Jackson 이 `Long` 으로 읽는다 — 생성 요청의 `petId` 와 같다.
 *
 * **`planItemId` 는 요청에 없다.** 서버가 그 일자를 삭제 후 재삽입하므로
 * (`PlanCommandProcessor.replaceDayItems`) 저장하면 id 가 전부 새로 발급된다.
 */
export type PlanItemPayload = {
  /** **1 이상이어야 한다.** 서버가 경로값으로 덮어쓰지만 `@Min(1)` 이 그보다 먼저 돈다 */
  day: number
  /** 0부터. 저장 직전에 다시 매긴다 */
  sequence: number
  itemType: string
  /** 대상이 없으면 키 자체를 넣지 않는다 */
  targetId?: string
  /** NotBlank, 100자 이하 */
  title: string
  /** 500자 이하 */
  memo?: string
  /** `HH:mm:ss` */
  startTime?: string
}

/**
 * 일자별 항목 **일괄 교체** 요청 본문. 부분 수정이 아니다 —
 * **빈 목록을 보내면 그 일차 항목이 모두 삭제된다.**
 */
export type PlanDayItemsReplacePayload = {
  items: PlanItemPayload[]
}

/**
 * 만들기 폼 값. **요청 본문이 아니다** — `budget` 이 폼에서는 문자열(`''` 허용)이고
 * 전송 직전에 숫자 또는 생략으로 바뀐다 (`src/lib/plan/form.ts`).
 *
 * `areaCode` 는 폼에 없다. 제주 전용이라 선택지가 하나뿐인 필드를 두지 않는다
 * (공통명세 S9).
 */
export type PlanFormValues = {
  petId: string
  title: string
  startDate: string
  endDate: string
  budget: string
}

export const EMPTY_PLAN_FORM_VALUES: PlanFormValues = {
  petId: '',
  title: '',
  startDate: '',
  endDate: '',
  budget: '',
}
