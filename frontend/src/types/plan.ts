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
 * **#152 가 더한 필드는 이제 전부 필수다** (`84ea259` 로 develop 에 들어왔다).
 *
 * 전환 기간에는 선택(`?`)이었다 — 서버가 보내지 않는데 필수로 적으면 타입은 통과하고
 * 런타임에서 `undefined` 를 만나기 때문이다. 서버가 `Plan.resolvePetIds()` 로 `plan_pet`
 * 행이 없는 옛 일정까지 `[petId]` 로 채워 주므로, **빈 배열이나 누락이 오지 않는다** —
 * 읽는 쪽이 폴백을 둘 이유가 없다.
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
   */
  petIds: string[]
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
  basisPetId: string | null
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
  petSuitabilities: PlanDayPetSuitabilityItem[]
  /**
   * 판정을 못 낸 이유의 **문장**. null 이면 정상이다.
   *
   * **그대로 그리지 않는다** — 사유마다 화면이 할 일이 다르다 (#497).
   * 무엇을 그릴지는 아래 `unavailableReasonCode` 가 정한다.
   */
  unavailableReason: string | null
  /**
   * 판정을 못 낸 이유의 **코드** (#492 · [PR #503](https://github.com/8llow8llowMe/hondigagae/pull/503)).
   * 문장과 **짝으로** 온다 — 정상인 날은 둘 다 null 이고, 값이 있으면 둘 다 있다.
   *
   * **문장을 파싱하지 않으려고 있는 필드다.** 사유마다 다르게 그려야 하는데 문장만 오면
   * 화면이 문자열을 뜯어보게 된다 (`backend/docs/services/plan-service.md` 의
   * "일자 판정 불가 사유"). 네 가지는 성질이 달라 뭉뚱그리면 사용자에게 하는 말이 틀린다.
   *
   * **union 이 아니라 `string` 이다** — `forecastSourceCode` 와 같은 이유다. 서버가 사유를
   * 늘렸을 때 모르는 코드가 타입 오류가 되는 것이 아니라, 화면이 서버 문장으로 물러설 수
   * 있어야 한다.
   */
  unavailableReasonCode: string | null
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
  /**
   * 하루 최고 체감온도(℃) — #253 · [PR #235](https://github.com/8llow8llowMe/hondigagae/pull/235).
   *
   * **`maxTemperature` 와 다른 시각에서 나온다.** 시각별 기온·습도로 낸 열지수(Rothfusz
   * 회귀식 섭씨판)의 하루 **최대**라, 기온이 내려가는 저녁에 습도가 올라 체감이 더 높은
   * 시각이 따로 있다. **화면이 기온·습도로 다시 계산하지 않는다** — 계산은 tour-service
   * 한 곳이다.
   *
   * **중기예보(`MID_TERM`)는 시각별 데이터가 없어 언제나 null 이다.** 그때 서버는
   * `maxTemperature` 를 대신 채우지 않으므로 **화면도 이 자리에 최고기온을 넣지 않는다**
   * — 최고기온을 보여 주더라도 `최고기온` 이라고 말한다 (`lib/plan/verdict-temperature.ts`).
   */
  maxFeelsLikeTemperature: number | null
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

/**
 * 그날 일정에 장소 항목이 없다. **항목이 하나도 없는 날이면 빈 일차 안내가 같은 말을 이미
 * 한다** — 그때만 서버 문장을 감춘다 (#497).
 */
export const NO_PLACE_ITEM_REASON_CODE = 'NO_PLACE_ITEM'

/**
 * 이미 지난 날짜. **예보는 소급되지 않으므로 재시도를 권하지 않는다.** 코드가 사실을 다
 * 말해 주므로 화면이 자기 말투로 옮긴다 (#497).
 */
export const PAST_DATE_REASON_CODE = 'PAST_DATE'

/** `GET /plans/{planId}/weather` */
export type PlanWeatherResponse = {
  planId: string
  planTitle: string
  startDate: string
  endDate: string
  /** 판정에 들어간 동행 반려견 (#152). 일자별 `basisPetId` 는 이 안의 하나다 */
  petIds: string[]
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
  /**
   * 좁힌 시군구 (#251). 생략하면 서버가 비워 둔다.
   *
   * **AI 초안 담기만 채운다.** 조건 입력에서 고른 지역을 저장까지 옮기지 않으면 사용자가
   * 고른 조건이 담는 순간 사라진다 — 계약(`PlanCreateRequest.sigunguCode`)에는 처음부터
   * 있었는데 화면이 싣지 않고 있었다. 직접 만들기(`/plans/new`)에는 지역 컨트롤이 없어
   * 보낼 값이 없다.
   */
  sigunguCode?: string
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
 * **기간(`startDate`/`endDate`)도 보낸다** (#585). 예전에는 닫아 뒀고 그 근거가
 * *"서버가 기간을 줄여도 범위 밖 항목을 정리하지 않아 고아 항목이 생긴다"* (D4) 였는데,
 * **그 근거는 더 이상 사실이 아니다** — 서버가 `PLAN_008`(줄어든 기간 밖에 항목이 남아
 * 있습니다)로 거부한다(`backend/docs/services/plan-service.md`, dev Swagger 실측
 * 2026-09-14). 고아가 생기지 않으므로 화면이 경로를 닫아 둘 이유가 없어졌다.
 *
 * 그 대신 화면이 지는 것: 기간을 줄이는 저장은 **실패할 수 있다.** FE 가 그 판정을
 * 복제하지 않고(어느 일차에 항목이 있는지는 상세 응답에 있지만, 복제하면 서버 규칙이
 * 바뀔 때 두 곳이 갈린다) 서버 문구를 폼 배너로 그대로 띄운다.
 */
export type PlanUpdatePayload = {
  title?: string
  /**
   * `yyyy-MM-dd`. **한쪽만 보내지 않는다** — 생략은 "유지" 라, 시작일만 보내면 서버는
   * 새 시작일과 **옛 종료일**로 기간을 다시 계산한다. 폼은 둘을 한 값으로 다룬다.
   */
  startDate?: string
  /** `yyyy-MM-dd`. 시작일과 같거나 이후여야 하고(`PLAN_003`) 기간은 최대 30일(`PLAN_009`) */
  endDate?: string
  budget?: number
  /**
   * 동행 반려견 (#622). **보내지 않으면 유지다** — `null` 도 같은 뜻이고, 보내면 목록을
   * **통째로 교체**하며 `petIds[0]` 이 대표가 된다 (`PlanUpdateRequest.java:63-65`).
   *
   * **빈 배열을 보내지 않는다.** 생성(`PlanCreateRequest.effectivePetIds()`)과 달리
   * 대표견 폴백이 없어 400 `PLAN_010` 이다 — 지우려던 아이가 말없이 돌아오는 것보다
   * 거절이 낫다는 서버 결정이다. "동행견 없음" 은 표현할 수 없다.
   *
   * **`string` 이다.** 스키마는 `int64` 지만 Snowflake 라 숫자로 바꾸면 정밀도를 잃는다.
   * 최대 5개(`PLAN_115`)이고, 이미 완료된 일정이면 `PLAN_019` 로 거절된다.
   */
  petIds?: string[]
  status?: PlanStatusCode
}

/**
 * `POST /plans/{planId}/copy` 요청 (#617). `PlanCopyRequest` 는 `title` 도 받지만
 * **이 화면은 보내지 않는다** — 서버가 원본 제목 뒤에 ` (복사)` 를 붙인다
 * (`일정복사-세부명세.md` D3-1 · D8 #2).
 */
export type PlanCopyPayload = {
  /** `yyyy-MM-dd`. 필수(`PLAN_105`) */
  startDate: string
  /** `yyyy-MM-dd`. 필수(`PLAN_106`). 일수가 원본과 다르면 서버가 `PLAN_021` 로 거절한다 */
  endDate: string
}

/** `POST /plans` · `GET /plans/{planId}` 응답. 목록보다 필드가 많다 */
export type PlanDetail = {
  planId: string
  /** 대표 반려견. **`petIds[0]` 과 같다** (#152) */
  petId: string
  /** 동행 반려견 (#152). 한 마리 일정이어도 원소 하나로 온다 */
  petIds: string[]
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

// ─── 여행 준비물 저장 (#398 BE · #586 FE) ─────────────────────────────────────

/**
 * 저장된 준비물 한 항목 — `PlanPackingDetailItem`.
 *
 * **AI 생성 결과(`types/ai-plan.ts` 의 `PackingListItem`)와 다른 타입이다.** 저쪽은
 * ai-service 가 그 자리에서 만들어 주는 제안이고(식별자·상태가 없다), 이쪽은
 * plan-service 에 **저장된** 항목이다. 둘을 한 타입으로 합치면 "아이디가 있을 때도
 * 없을 때도 있는" 타입이 되고, 체크·삭제를 할 수 있는지 없는지가 타입에서 사라진다.
 */
export type PlanPackingDetailItem = {
  packingItemId: string
  /**
   * 분류. **enum 이 아니라 문자열이다** — 값의 원천이 AI 라 고정 목록이 아니고, 화면은
   * 받은 문자열을 그대로 묶어 보여 준다 (서버 스키마 설명).
   */
  category: string
  name: string
  /**
   * 이 여행 데이터를 근거로 한 준비 이유. **사용자가 직접 추가한 항목은 null 이다** —
   * 서버가 `POST` 에서 `reason` 을 아예 받지 않는다. *"이 여행의 일정·날씨를 읽은 AI 만
   * 붙일 수 있는 값"* 이라는 것이 그 이유다.
   */
  reason: string | null
  /**
   * 출처 metadata (`AI` / `USER`). **`name` 을 그대로 렌더한다** — 한국어 매핑 테이블을
   * 만들지 않는다. 코드로 가르는 것은 재생성 때 교체되는지 여부 하나뿐이다.
   */
  source: CodeNameMetadata
  /** 챙김 체크. **재생성해도 같은 이름의 항목에 승계된다** */
  checked: boolean
  /** 표시 순서 (0부터). 서버가 이 순서로 정렬해 준다 — 화면이 다시 정렬하지 않는다 */
  sortOrder: number
}

/**
 * `GET` · `PUT` · `POST /plans/{planId}/packing-items` 응답.
 *
 * **세 오퍼레이션이 같은 모양을 돌려준다** — 저장·추가 뒤에 다시 조회하지 않고
 * `setQueryData` 로 갈아끼운다 (`updatePlan` 과 같은 처리).
 */
export type PlanPackingListResponse = {
  planId: string
  /** 표시 순서 오름차순. 자를 일이 없는 **전량** 조회다 */
  items: PlanPackingDetailItem[]
  /** `items.length` 와 같다 (서버 설명). 화면은 배열을 세면 되고 이 값은 대조용이다 */
  totalCount: number
  checkedCount: number
  /**
   * AI 항목이 마지막으로 저장된 시각. **AI 항목이 하나도 없으면 null 이다.**
   *
   * **`items` 가 비었다는 것만으로 "아직 만든 적 없다" 로 읽지 않는다** — 만든 뒤 전부
   * 지웠을 수 있고, 그때 화면이 또 LLM 을 돌리면 사용자가 지운 것을 되살린다.
   * 생성을 권하는 갈래는 `items` 가 비고 **이 값이 null 일 때** 하나뿐이다.
   */
  generatedAt: string | null
}

/**
 * AI 결과 저장 요청 (`PUT`). **AI 항목만 교체하고 사용자 항목은 남는다.**
 *
 * 빈 목록을 보내면 AI 항목이 모두 삭제된다 — 화면은 그 경로를 쓰지 않는다.
 * 서버가 같은 이름의 챙김 체크를 승계하므로, 재생성해도 반쯤 싸 둔 체크가 날아가지 않는다.
 */
export type PlanPackingItemsSavePayload = {
  /** 최대 50개. 사용자 항목과 이름이 겹치는 AI 항목은 서버가 버린다 */
  items: PlanPackingItemPayload[]
}

/** 저장 항목 하나. `reason` 은 생략 가능하다 (AI 가 이유를 못 낸 항목) */
export type PlanPackingItemPayload = {
  /** 30자 이하 */
  category: string
  /** 100자 이하 */
  name: string
  /** 500자 이하 */
  reason?: string
}

/**
 * 직접 추가 요청 (`POST`). **`reason` 을 받지 않는다** — 서버가 아예 열어 두지 않았다.
 *
 * 중복 이름은 `PLAN_012`(409), 50개 초과는 `PLAN_013`(400) 이다.
 */
export type PlanPackingItemAddPayload = {
  category: string
  name: string
}

/** 챙김 체크 요청. **해제도 같은 경로다** — 본문의 `checked` 가 방향을 정한다 */
export type PlanPackingItemCheckedPayload = {
  checked: boolean
}

/**
 * 직접 추가 항목의 출처 코드. **이 코드만 가른다** — 나머지는 `source.name` 을 그대로 쓴다.
 *
 * 쓰임은 하나다: 사용자가 적어 둔 항목에는 `이유` 자리가 비는데, 그것이 *"AI 가 이유를
 * 못 냈다"* 가 아니라 *"직접 적은 것이라 이유가 없다"* 라는 것을 화면이 말할 수 있어야 한다.
 */
export const PACKING_SOURCE_USER_CODE = 'USER'

/** 이미 같은 이름의 준비물이 있다 (`PlanErrorCode.PACKING_ITEM_NAME_DUPLICATED`) */
export const PACKING_NAME_DUPLICATED_CODE = 'PLAN_012'

/** 일정당 50개 상한 (`PlanErrorCode.PACKING_ITEM_LIMIT_EXCEEDED`) */
export const PACKING_LIMIT_EXCEEDED_CODE = 'PLAN_013'

/** 일정당 준비물 상한. 서버 `PLAN_013` 복제본이다 */
export const PACKING_ITEM_MAX = 50

/**
 * `GET` · `POST` · `PUT /plans/{planId}/reviews` 응답 (#614 BE · #615 FE).
 *
 * **일정당 후기 하나**라 경로에 reviewId 가 없다. 작성 시점의 장소 제목·placeId 는
 * 스냅샷이라, 일차를 교체해 항목이 사라져도 후기 행은 남는다.
 *
 * `createdAt` / `updatedAt` 은 서버 `LocalDateTime` 이라 타임존 접미가 없다
 * (`2026-09-15T11:20:00`).
 */
export type PlanReviewResponse = {
  reviewId: string
  planId: string
  /** 1~5 */
  overallRating: number
  /** 없으면 null */
  body: string | null
  items: PlanReviewPlaceItem[]
  createdAt: string
  updatedAt: string
}

/** 후기 안의 방문 장소 평가. 클라이언트가 다시 보내는 키는 `reviewItemId` 가 아니라 `planItemId` 다 */
export type PlanReviewPlaceItem = {
  reviewItemId: string
  planItemId: string
  /** 작성 시점의 장소 아이디. 대상 없는 항목이면 null */
  placeId: string | null
  title: string
  /** 1~5 */
  rating: number
  /** 없으면 null */
  comment: string | null
}

/**
 * `POST` · `PUT /plans/{planId}/reviews` 요청.
 *
 * `items` 는 필수 배열이다. 빈 목록이면 전체 만족도만 남긴다. PUT 은 **전량 교체**다.
 * `planItemId` 는 Snowflake 라 **문자열로 보낸다** — `Number()` 를 거치면 정밀도를 잃는다.
 */
export type PlanReviewUpsertPayload = {
  overallRating: number
  body: string | null
  items: PlanReviewItemPayload[]
}

export type PlanReviewItemPayload = {
  planItemId: string
  rating: number
  comment: string | null
}

/** 후기가 없다 (`PlanErrorCode.REVIEW_NOT_FOUND`) */
export const REVIEW_NOT_FOUND_CODE = 'PLAN_015'

/** 완료가 아닌 일정에 후기를 읽거나 쓴다 (`PlanErrorCode.REVIEW_PLAN_NOT_COMPLETED`) */
export const REVIEW_PLAN_NOT_COMPLETED_CODE = 'PLAN_016'

/** 이미 후기가 있다 (`PlanErrorCode.REVIEW_ALREADY_EXISTS`) */
export const REVIEW_ALREADY_EXISTS_CODE = 'PLAN_017'

/** 다녀온 장소 항목이 아니다 (`PlanErrorCode.REVIEW_ITEM_NOT_ELIGIBLE`) */
export const REVIEW_ITEM_NOT_ELIGIBLE_CODE = 'PLAN_018'

/** 같은 planItemId 를 두 번 보냈다 (`PlanErrorCode.REVIEW_ITEM_DUPLICATED`) */
export const REVIEW_ITEM_DUPLICATED_CODE = 'PLAN_020'

/** 후기에 담을 수 있는 항목 유형. 백엔드 `PlanItemType.isPlaceTarget()` 과 같다 */
export const REVIEW_PLACE_ITEM_TYPES = ['PLACE', 'MEAL', 'LODGING'] as const

/** 전체 만족도·장소 만족도 범위. 서버 `@Min(1)` · `@Max(5)` 복제본이다 */
export const REVIEW_RATING_MIN = 1
export const REVIEW_RATING_MAX = 5

/** 후기 본문 상한. 서버 `PLAN_128` 복제본이다 */
export const REVIEW_BODY_MAX = 2000

/** 장소별 후기 상한. 서버 `PLAN_130` 복제본이다 */
export const REVIEW_ITEMS_MAX = 50

/** 장소 한 줄 후기 상한. 서버 `PLAN_134` 복제본이다 */
export const REVIEW_COMMENT_MAX = 200

// ─── 공유 링크 (#627 BE · #628 FE) ────────────────────────────────────────────

/**
 * 일정 주인이 받는 공유 링크 (`PlanShareLinkResponse`).
 *
 * **토큰 자체가 열람 권한이다.** 로그·분석 도구·쿼리스트링에 싣지 않는다 — 백엔드도
 * 게이트웨이 로그에서 이 값을 가린다.
 */
export type PlanShareLink = {
  planId: string
  /** URL-safe Base64 43자 */
  token: string
  /** `YYYY-MM-DDTHH:mm:ss` — 발급 시각 + 30일 */
  expiresAt: string
}

/**
 * 공유 링크로 열리는 일정 (`SharedPlanResponse`). **비인증 응답이다.**
 *
 * **`PlanDetail` 과 타입을 합치지 않는다.** 백엔드가 의도적으로 뺀 필드가 있다 —
 * `planId`(소유자 API 를 찍어 볼 실마리) · `petId`/`petIds`(남의 반려견 아이디) ·
 * `budget`(사적인 값). 합치면 그 셋이 optional 로 새어 들어가 **화면이 "있을 수도
 * 있는 값" 으로 다루게 되고, 자리를 만들게 된다.**
 *
 * 준비물·후기·응급 브리핑은 애초에 상세 응답에 없고 각자 별도 API 라 여기에도 없다.
 */
export type SharedPlan = {
  title: string
  areaCode: string
  sigunguCode: string | null
  startDate: string
  endDate: string
  totalDays: number
  /** 공유되는 것은 `CONFIRMED` · `COMPLETED` 뿐이다 */
  status: CodeNameMetadata
  /** 일차·순서 오름차순 */
  items: SharedPlanItem[]
}

/**
 * 공유 링크로 보이는 일정 항목 (`SharedPlanItemItem`).
 *
 * **`PlanItemDetail` 에서 빠진 것**: `planItemId`(편집용 식별자) · `memo`(주인의 사적인
 * 메모) · `visited`(여행 중 체크). 링크를 받은 사람은 "어디를 언제 가는지" 만 본다.
 *
 * `place` 는 `PlanItemPlace` 와 **같은 타입이다** — 백엔드가 두 응답에서 같은
 * `PlanItemPlaceItem` 을 쓴다.
 */
export type SharedPlanItem = {
  /** 1부터 */
  day: number
  sequence: number
  itemType: CodeNameMetadata
  targetId: string | null
  title: string
  /** `HH:mm:ss` */
  startTime: string | null
  place: PlanItemPlace | null
}

/** 공유할 수 없는 상태다 — 초안 (`PlanErrorCode.SHARE_PLAN_NOT_SHAREABLE`) */
export const SHARE_PLAN_NOT_SHAREABLE_CODE = 'PLAN_022'

/** 없거나 폐기된 링크 (`PlanErrorCode.SHARE_LINK_NOT_FOUND`) */
export const SHARE_LINK_NOT_FOUND_CODE = 'PLAN_023'

/** 만료된 링크 (`PlanErrorCode.SHARE_LINK_EXPIRED`) — 404 가 아니라 410 이다 */
export const SHARE_LINK_EXPIRED_CODE = 'PLAN_024'

/**
 * 공유할 수 있는 일정 상태. 백엔드 `PlanStatus.isShareable()` 복제본이다.
 *
 * **발급 시점과 조회 시점 양쪽에서 돈다** — 확정한 뒤 초안으로 되돌리면 이미 만든
 * 링크도 막힌다.
 */
export const SHAREABLE_PLAN_STATUSES = ['CONFIRMED', 'COMPLETED'] as const
