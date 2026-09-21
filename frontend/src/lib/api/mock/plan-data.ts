import type { MockResult } from '@/lib/api/mock/auth-data'
import { mockPlanEmergency } from '@/lib/api/mock/emergency-data'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import {
  memberIdOf,
  type MockPackingItem,
  type MockPlan,
  type MockPlanItem,
  type MockPlanReviewItem,
  mockStore,
  nextPackingItemId,
  nextPlanId,
  nextPlanItemId,
  nextReviewId,
  nextReviewItemId,
} from '@/lib/api/mock/store'
import { MOCK_WALK_COURSES } from '@/lib/api/mock/walk-course-data'
import { todayDay } from '@/lib/date/day'
import type { ApiResponse, CodeNameMetadata, SliceResponse, ValidationErrorItem } from '@/types/api'
import type { ScoreMetricMetadata } from '@/types/insight'
import type {
  PlanAlternativePlaceItem,
  PlanBriefingItemSummary,
  PlanBriefingResponse,
  PlanDayWeatherItem,
  PlanDetail,
  PlanItemDetail,
  PlanItemPlace,
  PlanItemWalkCourse,
  PlanItemWalkSafetyItem,
  PlanPackingListResponse,
  PlanReviewPlaceItem,
  PlanReviewResponse,
  PlanSummaryItem,
  PlanWalkSafetyResponse,
  PlanWeatherResponse,
} from '@/types/plan'
import { NO_PLACE_ITEM_REASON_CODE } from '@/types/plan'

/**
 * 여행 일정 mock.
 *
 * **백엔드보다 느슨하거나 엄격해서는 안 된다.** mock 이 스키마보다 엄격하면 FE 는
 * 통과하는 입력이 mock 에서만 400 이 되어, 같은 브랜치가 자기 판정을 부정한다
 * (`pet-data.ts` 와 같은 규칙).
 *
 * 근거: `PlanWebController` · `PlanCreateRequest` · `PlanSummaryItem` ·
 * `PlanDetailResponse` · `PlanStatus` · `PlanErrorCode` · `PlanValidationMessage` ·
 * `PlanRepository` 소스 실측. 계약 상세는 docs/features/plan/공통명세.md.
 */

function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

function fail(
  status: number,
  resultCode: string,
  resultMessage: string,
  fieldErrors: ValidationErrorItem[] | null = null,
): MockResult {
  return {
    status,
    payload: {
      dataHeader: { success: false, resultCode, resultMessage, fieldErrors },
      dataBody: null,
    },
  }
}

/** 검증 실패는 문자열 `resultMessage` + `fieldErrors` 로 온다 — ValidationErrorSupport (#491) */
function failValidation(errors: ValidationErrorItem[]): MockResult {
  return fail(400, 'PLAN_100', errors[0]?.message ?? '요청 값이 올바르지 않습니다.', errors)
}

/** `@PathVariable` 의 자바 타입. `day` 만 `int` 고 나머지 id 는 전부 `long` 이다 */
type JavaIntegral = 'long' | 'int'

const INTEGRAL_RANGE: Record<JavaIntegral, { min: bigint; max: bigint }> = {
  long: { min: -(2n ** 63n), max: 2n ** 63n - 1n },
  int: { min: -(2n ** 31n), max: 2n ** 31n - 1n },
}

/**
 * 스프링이 경로 문자열을 정수로 푸는 문법 — `NumberUtils.parseNumber` 를 그대로 옮긴다.
 * 통과하면 **정규화된 10진 문자열**, 아니면 `null`(바인딩 실패)이다.
 *
 * ```java
 * String trimmed = StringUtils.trimAllWhitespace(text);            // 안쪽 공백까지 지운다
 * return (isHexNumber(trimmed) ? Long.decode(trimmed) : Long.valueOf(trimmed));
 *
 * private static boolean isHexNumber(String value) {
 *     int index = (value.startsWith("-") ? 1 : 0);                 // + 는 보지 않는다
 *     return (value.startsWith("0x", index) || value.startsWith("0X", index)
 *          || value.startsWith("#", index));
 * }
 * ```
 *
 * **8진수가 아니다.** `Long.decode` 라면 `08`·`09` 가 무효여야 하는데 dev 는 둘 다
 * 통과시킨다 — 16진수 접두사가 없어 `Long.valueOf` 로 가기 때문이다. 이 한 가지가
 * 문법을 확정한 증거다 (dev 실측 28종, 2026-09-21 · #809).
 *
 * **정규화한 값을 돌려주는 이유**: 서버는 `' 1'` 을 `1` 로 풀어 **1번 일정을 찾는다**.
 * 목이 원문으로 조회하면 같은 주소가 404 로 갈린다.
 *
 * 남는 차이 하나: 여기 `\s` 는 자바 `Character.isWhitespace` 와 유니코드 경계가 조금
 * 다르다(예: ` `). 경로에 그 문자가 오는 일이 없어 쫓지 않는다.
 */
function decodeIntegral(rawValue: string, type: JavaIntegral): string | null {
  // trimAllWhitespace — 앞뒤가 아니라 **전부** 지운다. `'1 2'` 는 `12` 다
  const compact = rawValue.replace(/\s/g, '')
  const negative = compact.startsWith('-')
  const unsigned = negative ? compact.slice(1) : compact

  let parsed: bigint
  if (/^(?:0[xX]|#)/.test(unsigned)) {
    // 16진수 접두사가 붙었으면 `Long.decode` 로 간다 — 뒤가 16진수가 아니면 실패다
    const hex = /^(?:0[xX]|#)([0-9a-fA-F]+)$/.exec(unsigned)
    if (hex === null) return null
    parsed = BigInt(`0x${hex[1]}`)
    if (negative) parsed = -parsed
  } else {
    // `Long.valueOf` — 부호 하나에 10진 숫자만. 앞자리 0 은 허용이고 8진수가 아니다
    if (!/^[+-]?\d+$/.test(compact)) return null
    parsed = BigInt(compact)
  }

  const { min, max } = INTEGRAL_RANGE[type]
  if (parsed < min || parsed > max) return null

  return parsed.toString()
}

/**
 * `@PathVariable` 바인딩. 통과하면 **정규화된 값**, 실패하면 400 이다.
 *
 * **한 곳에 모은 이유**: 경로변수가 네 종류(`planId` · `day` · `planItemId` ·
 * `packingItemId`)인데 서버는 넷을 한 자리에서 만든다. 자리마다 따로 쓰면 갈린다.
 * 브리핑은 이 판정을 `withPlan` 밖에서도 쓴다 (`resolvePlanMock` 의 인증 앞 관문, #795).
 *
 * **오류 모양은 dev 게이트웨이 실측이다** (2026-09-21 · 토큰 없는 GET, #803):
 *
 * ```text
 * GET /api/v1/plans/abc/briefing → 400
 * {"resultCode":"PLAN_124","resultMessage":"planId 파라미터 형식이 올바르지 않습니다.",
 *  "fieldErrors":[{"code":"PLAN_124","field":"planId","message":"planId 파라미터 형식이 …"}]}
 * ```
 *
 * 근거는 `ValidationErrorSupport.toResponse(MethodArgumentTypeMismatchException, defaultCode)`
 * 한 줄이다 — `"%s 파라미터 형식이 올바르지 않습니다.".formatted(exception.getName())` 로
 * **필드명을 끼워 문구를 다시 만들고**, 같은 코드·필드·문구를 `fieldErrors` 한 건에 싣는다.
 * `defaultCode` 는 `PlanErrorCode.PARAMETER_TYPE_INVALID` = `PLAN_124` (`PlanExceptionHandler:47`).
 *
 * **`PLAN_114` 가 아니다.** 예전 목이 쓰던 그 코드는 백엔드에서
 * `PlanValidationMessage.VISITED_REQUIRED`(`방문 여부는 필수입니다.`) — 방문 체크 **본문**
 * 검증 코드라, 경로 오류에 쓰면 서버가 내지 않는 조합이 된다 (#803).
 *
 * **`failValidation` 을 쓰지 않는다** — 그쪽은 헤더를 `PLAN_100` 으로 고정하는데 서버는
 * 헤더와 항목에 같은 `PLAN_124` 를 싣는다.
 */
function bindPathVariable(
  field: string,
  rawValue: string,
  type: JavaIntegral = 'long',
): string | MockResult {
  const bound = decodeIntegral(rawValue, type)
  if (bound !== null) return bound

  const message = `${field} 파라미터 형식이 올바르지 않습니다.`
  return fail(400, 'PLAN_124', message, [{ code: 'PLAN_124', field, message }])
}

// 토큰이 없거나 유효하지 않은 요청은 도메인에 닿기 전에 security-core 가 막는다 —
// `SecurityErrorCode.UNAUTHORIZED`. **`AUTH_011` 이 아니다**: 그것은
// `OAUTH_PROFILE_REQUIRED` 이고 400 이라, 401 과 짝지으면 서버가 내지 않는 조합이 된다 (#83)
const UNAUTHORIZED = () => fail(401, 'SECURITY_001', '인증이 필요합니다.')

/** 백엔드 `PlanStatus` 의 displayName/description 복제본 */
const STATUS: Record<string, CodeNameMetadata> = {
  DRAFT: { code: 'DRAFT', name: '초안', description: 'AI 또는 사용자가 작성 중인 일정입니다.' },
  CONFIRMED: { code: 'CONFIRMED', name: '확정', description: '여행이 확정된 일정입니다.' },
  COMPLETED: { code: 'COMPLETED', name: '완료', description: '여행을 마친 일정입니다.' },
}

/** 백엔드 size 허용 범위 (1~50). 벗어나면 `PLAN_113` 400 이다 */
const MIN_SIZE = 1
const MAX_SIZE = 50
const DEFAULT_SIZE = 10

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** `@Size(max = 5)` — 넘으면 `PLAN_115` (#152) */
const MAX_PLAN_PETS = 5

/** `@Positive` — 0 과 음수를 거른다. 앞자리 0 도 Snowflake 가 아니다 */
const POSITIVE_ID_PATTERN = /^[1-9]\d*$/

/**
 * 반려견 아이디는 서버가 `Long` 으로 읽는다. FE 는 정밀도 때문에 문자열로 실어 보내므로
 * **둘 다 받는다** — 숫자로 와도 문자열로 접어 두면 이후 비교가 한 갈래다.
 */
function toPetIdString(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number') return String(raw)
  return ''
}

/**
 * 대표 반려견. 요청이 반려견을 지정하지 않았을 때의 기본값이다
 * (`PetConditionQueryPort.findRepresentativePetId`).
 *
 * **없으면 빈 배열이다** — 부른 쪽이 `PLAN_010` 으로 접는다. auth-service 는 회원당 대표를
 * 하나만 유지하므로 여기서도 첫 하나만 본다.
 */
function representativePetIdsOf(store: ReturnType<typeof mockStore>, memberId: string): string[] {
  const representative = store.pets.find(
    (pet) => pet.memberId === memberId && pet.representative && !pet.deleted,
  )
  return representative === undefined ? [] : [representative.petId]
}

const ITEM_TITLE_MAX = 100
const ITEM_MEMO_MAX = 500

/**
 * `verifyPlaceTargets` 의 대상. **`WALK` 은 빠진다** — 그 `targetId` 는 `walk_course.id`
 * 라 tour-service 에 물어볼 값이 아니다 (`PlanCommandProcessor.PLACE_TARGET_TYPES`).
 */
const PLACE_TARGET_TYPES = new Set(['PLACE', 'MEAL', 'LODGING'])

/** mock 이 아는 장소. 여기 없는 `targetId` 는 백엔드처럼 `PLAN_004` 로 막는다 */
const KNOWN_PLACE_IDS = new Set(MOCK_PLACES.map((place) => place.placeId))

/** placeId → 장소. 항목의 `place` 요약을 채울 때 쓴다 (#86) */
const PLACE_BY_ID = new Map(MOCK_PLACES.map((place) => [place.placeId, place]))

/**
 * walkCourseId → 코스. 항목의 `walkCourse` 요약을 채울 때 쓴다 (#620).
 *
 * **`walk-course-data.ts`(#618) fixture 를 재사용한다.** 값이 갈리면 코스 화면과 일정
 * 화면이 같은 코스를 다르게 말한다 (`올레담기-세부명세.md` D7 mock 절).
 */
const WALK_COURSE_BY_ID = new Map(MOCK_WALK_COURSES.map((course) => [course.walkCourseId, course]))

/** 총 일수(양끝 포함). `Plan.containsDay()` 와 같은 셈이어야 한다 */
function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 1

  return Math.max(1, Math.round((end - start) / 86_400_000) + 1)
}

/**
 * 동행 반려견 (#152).
 *
 * **`plan_pet` 행이 없는 옛 일정을 `[petId]` 로 읽는 서버 규칙을 그대로 둔다**
 * (`Plan.resolvePetIds()`). fixture 에 `petIds` 를 심어 뒀지만 이 폴백이 없으면
 * 계약이 "가끔 빈 배열" 로 읽히고, 화면이 `petIds[0]` 을 못 믿게 된다.
 */
function petIdsOf(plan: MockPlan): string[] {
  return plan.petIds.length > 0 ? plan.petIds : [plan.petId]
}

function toSummary(plan: MockPlan): PlanSummaryItem {
  return {
    planId: plan.planId,
    petId: plan.petId,
    petIds: petIdsOf(plan),
    areaCode: plan.areaCode,
    title: plan.title,
    startDate: plan.startDate,
    endDate: plan.endDate,
    status: STATUS[plan.status] ?? { code: plan.status, name: plan.status, description: null },
  }
}

/** 백엔드 `PlanItemType` 의 displayName/description 복제본 */
const ITEM_TYPE: Record<string, CodeNameMetadata> = {
  PLACE: { code: 'PLACE', name: '장소', description: '관광지·카페 등 방문 장소 항목입니다.' },
  MEAL: { code: 'MEAL', name: '식사', description: '식당 방문 항목입니다.' },
  LODGING: { code: 'LODGING', name: '숙박', description: '숙소 체크인/숙박 항목입니다.' },
  WALK: { code: 'WALK', name: '산책', description: '산책 코스 항목입니다.' },
  MOVE: { code: 'MOVE', name: '이동', description: '이동 구간 항목입니다.' },
}

/**
 * 모르는 코드도 `{code,name,description}` 모양은 지킨다 — 화면이 `name` 을 그대로 그리므로
 * 표에 없는 코드가 와도 빈 칸이 아니라 코드가 보인다.
 *
 * **상세와 브리핑이 같은 함수를 쓴다** (#716 으로 브리핑도 metadata 가 됐다). 둘이 따로
 * 조립하면 같은 항목의 유형이 두 화면에서 갈린다.
 */
function itemTypeMetadata(code: string): CodeNameMetadata {
  return ITEM_TYPE[code] ?? { code, name: code, description: null }
}

function totalDaysOf(plan: MockPlan): number {
  const start = Date.parse(`${plan.startDate}T00:00:00Z`)
  const end = Date.parse(`${plan.endDate}T00:00:00Z`)
  return Math.round((end - start) / 86_400_000) + 1
}

/**
 * 항목의 장소 요약 (#86). **백엔드가 tour-service 에 물어본 결과를 재현한다.**
 *
 * `null` 이 세 갈래다 — 화면이 셋을 구분하지 못한다는 사실 자체가 계약이라 mock 도
 * 세 갈래를 다 낸다:
 *  - 장소를 가리키지 않는 항목 (`WALK`·`MOVE`) → 물어볼 대상이 없다
 *  - 원천에서 사라진(delisted) 장소 → `MOCK_PLACES` 에 없는 `targetId`
 *  - tour-service 장애 → mock 에는 없지만 같은 모양(`place: null`)으로 온다
 */
function toItemPlace(item: MockPlanItem): PlanItemPlace | null {
  if (item.targetId === null || !PLACE_TARGET_TYPES.has(item.itemType)) return null

  const place = PLACE_BY_ID.get(item.targetId)
  if (place === undefined) return null

  return {
    addr1: place.addr1,
    indoor: place.indoor,
    firstImage: place.firstImage,
    lat: place.lat,
    lng: place.lng,
  }
}

/**
 * 항목의 산책 코스 요약 (#620). **저장 시 `targetId` 를 검증하지 않으므로**
 * (`올레담기-세부명세.md` D3-3) 모르는 id 가 조용히 저장될 수 있다 — 그때는 `place` 와
 * 같은 모양으로 `null` 을 낸다. `fitsActivityLevels` 는 이번 범위에서 행에 그리지 않아
 * 빈 배열로 둔다 (일정상세-세부명세 D12-6).
 */
function toItemWalkCourse(item: MockPlanItem): PlanItemWalkCourse | null {
  if (item.targetId === null || item.itemType !== 'WALK') return null

  const course = WALK_COURSE_BY_ID.get(item.targetId)
  if (course === undefined) return null

  return {
    name: course.name,
    courseLabel: course.courseLabel,
    distanceKm: course.distanceKm,
    durationText: course.durationText,
    durationMaxMinutes: course.durationMaxMinutes,
    lat: course.lat,
    lng: course.lng,
    firstImage: course.firstImage,
    fitsActivityLevels: [],
  }
}

function toItem(item: MockPlanItem): PlanItemDetail {
  return {
    planItemId: item.planItemId,
    day: item.day,
    sequence: item.sequence,
    itemType: itemTypeMetadata(item.itemType),
    targetId: item.targetId,
    title: item.title,
    memo: item.memo,
    startTime: item.startTime,
    visited: item.visited,
    place: toItemPlace(item),
    walkCourse: toItemWalkCourse(item),
  }
}

function toDetail(plan: MockPlan): PlanDetail {
  return {
    ...toSummary(plan),
    sigunguCode: plan.sigunguCode,
    budget: plan.budget,
    totalDays: totalDaysOf(plan),
    /*
      저장 순서를 그대로 주지 않는다 — 백엔드가 day·sequence 로 정렬해 내려준다.

      **직접 만들기는 빈 배열이지만 AI 초안 담기는 항목을 함께 보낸다**
      (`PlanCreateRequest.items`, ai-plan 명세 S5). 보낸 것을 그대로 되돌려 주지 않으면
      담은 직후 화면이 빈 일정을 보여 준다.
    */
    items: [...plan.items]
      .sort((a, b) => (a.day === b.day ? a.sequence - b.sequence : a.day - b.day))
      .map(toItem),
  }
}

/**
 * 요청 항목 검증 + 저장 형태로 변환.
 *
 * **백엔드와 같은 경계여야 한다.** `itemType` 은 `PlanItemType` enum 으로 역직렬화되고
 * `title` 에 `@NotBlank`, `day` 에 `@Min(1)` 이 걸려 있어 **항목 하나가 어긋나면 요청
 * 전체가 400** 이다. mock 이 느슨하면 FE 가 "걸러서 보낸다" 는 판단을 검증하지 못한다.
 */
function toItems(
  raw: unknown,
  store: ReturnType<typeof mockStore>,
  errors: { code: string; field: string; message: string }[],
): MockPlanItem[] {
  if (raw === undefined || raw === null) return []

  if (!Array.isArray(raw)) {
    errors.push({ code: 'PLAN_100', field: 'items', message: '요청 값이 올바르지 않습니다.' })
    return []
  }

  return raw.map((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>
    const field = `items[${index}]`

    const day = Number(item.day)
    if (!Number.isInteger(day) || day < 1) {
      errors.push({
        code: 'PLAN_108',
        field: `${field}.day`,
        message: '일차는 1 이상이어야 합니다.',
      })
    }

    const itemType = typeof item.itemType === 'string' ? item.itemType : ''
    if (ITEM_TYPE[itemType] === undefined) {
      errors.push({
        code: 'PLAN_109',
        field: `${field}.itemType`,
        message: '항목 유형은 필수입니다.',
      })
    }

    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (title === '') {
      errors.push({
        code: 'PLAN_110',
        field: `${field}.title`,
        message: '항목 이름은 필수입니다.',
      })
    } else if (title.length > ITEM_TITLE_MAX) {
      errors.push({
        code: 'PLAN_111',
        field: `${field}.title`,
        message: '항목 이름은 100자 이하만 가능합니다.',
      })
    }

    const memo = typeof item.memo === 'string' ? item.memo : null
    if (memo !== null && memo.length > ITEM_MEMO_MAX) {
      errors.push({
        code: 'PLAN_112',
        field: `${field}.memo`,
        message: '메모는 500자 이하만 가능합니다.',
      })
    }

    // targetId 는 Long 이지만 FE 가 정밀도 때문에 문자열로 보낸다 — 양쪽을 받는다
    const rawTarget = item.targetId
    const targetId =
      typeof rawTarget === 'string' && rawTarget !== ''
        ? rawTarget
        : typeof rawTarget === 'number'
          ? String(rawTarget)
          : null

    return {
      planItemId: nextPlanItemId(store),
      day,
      sequence: Number.isInteger(Number(item.sequence)) ? Number(item.sequence) : index,
      itemType,
      targetId,
      title: title.slice(0, ITEM_TITLE_MAX),
      memo: memo === null || memo.trim() === '' ? null : memo,
      startTime: typeof item.startTime === 'string' ? item.startTime : null,
      // 새 항목은 방문 체크가 꺼진 상태로 태어난다 (`PlanItemEntity.visited` 기본값, #124)
      visited: false,
    }
  })
}

export function resolvePlanMock(
  path: string,
  method: string,
  search: string,
  body: string | null,
  accessToken: string | null,
): MockResult | null {
  if (!path.startsWith('/plans')) return null

  /*
    **브리핑의 `date` 바인딩이 인증보다 먼저다.** 스프링은 `@RequestParam` 을 핸들러 인자로
    푸는 단계에서 400 을 내고 `@PreAuthorize` 는 그 뒤 메서드 호출에 걸린다 — dev 실측
    (2026-09-21 · 토큰 없는 GET): `date` 누락은 400 `PLAN_125`, `date=2026-09-21` 은
    401 `SECURITY_001` 이다. 401 을 먼저 내면 목이 서버보다 엄격해져(파일 머리 규칙) 계약
    테스트가 서버에 없는 순서를 잠근다.

    **`planId` 형식은 그보다 더 앞이다** — `/plans/abc/briefing` 은 `date` 가 없어도
    planId 오류로 떨어진다 (같은 실측). 첫 인자를 먼저 풀기 때문이다.

    이 관문은 400 만 낸다 — 데이터는 아래 `withPlan` 을 지난 뒤에만 나간다.
  */
  const briefing = /^\/plans\/([^/]+)\/briefing$/.exec(path)
  let briefingDate = ''
  if (briefing !== null && method === 'GET') {
    const boundId = bindPathVariable('planId', briefing[1] ?? '')
    if (typeof boundId !== 'string') return boundId

    const bound = bindBriefingDate(search)
    if (typeof bound !== 'string') return bound
    briefingDate = bound
  }

  // 모든 일정 엔드포인트가 @PreAuthorize("isAuthenticated()") 다
  const memberId = memberIdOf(accessToken)
  if (memberId === null) return UNAUTHORIZED()

  if (path === '/plans') {
    if (method === 'GET') return list(memberId, search)
    if (method === 'POST') return create(memberId, body)
    return null
  }

  const dayItems = /^\/plans\/([^/]+)\/days\/([^/]+)\/items$/.exec(path)
  if (dayItems !== null && method === 'PUT') {
    return withPlan(memberId, dayItems[1] ?? '', (plan) =>
      replaceDayItems(plan, dayItems[2] ?? '', body),
    )
  }

  /*
    항목 방문 체크 (#124). **`/days/{day}/items` 보다 뒤, 상세(`/plans/{id}`) 보다 앞이다** —
    상세 정규식 `^/plans/([^/]+)$` 는 하위 경로를 잡지 않지만, 순서를 명시해 두면 그
    규칙을 넓힐 때 실수하지 않는다 (index.ts 의 인사이트 주석과 같은 판단).
  */
  const itemVisited = /^\/plans\/([^/]+)\/items\/([^/]+)\/visited$/.exec(path)
  if (itemVisited !== null && method === 'PUT') {
    return withPlan(memberId, itemVisited[1] ?? '', (plan) =>
      markVisited(plan, itemVisited[2] ?? '', body),
    )
  }

  const weather = /^\/plans\/([^/]+)\/weather$/.exec(path)
  if (weather !== null && method === 'GET') {
    return withPlan(memberId, weather[1] ?? '', (plan) => ({
      status: 200,
      payload: ok(toWeather(plan)),
    }))
  }

  /*
    항목 산책 위험도 (#625). **`withPlan` 을 거쳐 같은 소유권 판정을 쓴다** — 남의
    일정·없는 일정은 404, 숫자가 아닌 planId 는 400 이다 (D15-1).
  */
  const walkSafety = /^\/plans\/([^/]+)\/walk-safety$/.exec(path)
  if (walkSafety !== null && method === 'GET') {
    return withPlan(memberId, walkSafety[1] ?? '', (plan) => ({
      status: 200,
      payload: ok(mockPlanWalkSafety(plan)),
    }))
  }

  /*
    출발 전 여행 브리핑 (#626). **`date` 는 위쪽 인증 앞 관문이 이미 바인딩했다** — 여기
    남은 판정은 소유권과 기간이다. 기간 밖은 `PLAN_002` 400 이다
    (`PlanBriefingProcessor.resolveDay`).
  */
  if (briefing !== null && method === 'GET') {
    return withPlan(memberId, briefing[1] ?? '', (plan) => toBriefing(plan, briefingDate))
  }

  /*
    응급 브리핑 (#125). **`withPlan` 을 거친다** — 남의 일정·없는 일정은 404 여야 하고,
    그 판정을 여기서 다시 쓰면 상세와 어긋날 수 있다.
  */
  const emergency = /^\/plans\/([^/]+)\/emergency$/.exec(path)
  if (emergency !== null && method === 'GET') {
    return withPlan(memberId, emergency[1] ?? '', (plan) => ({
      status: 200,
      payload: ok(mockPlanEmergency(plan.planId)),
    }))
  }

  /*
    저장된 여행 준비물 (#586). **체크 경로가 목록 경로보다 앞이다** — 뒤에 두면
    `/packing-items/{id}/checked` 를 `/packing-items/{id}` 정규식이 먼저 잡는다.
  */
  const packingChecked = /^\/plans\/([^/]+)\/packing-items\/([^/]+)\/checked$/.exec(path)
  if (packingChecked !== null && method === 'PUT') {
    return withPlan(memberId, packingChecked[1] ?? '', (plan) =>
      setPackingChecked(plan, packingChecked[2] ?? '', body),
    )
  }

  const packingItem = /^\/plans\/([^/]+)\/packing-items\/([^/]+)$/.exec(path)
  if (packingItem !== null && method === 'DELETE') {
    return withPlan(memberId, packingItem[1] ?? '', (plan) =>
      removePackingItem(plan, packingItem[2] ?? ''),
    )
  }

  const packingItems = /^\/plans\/([^/]+)\/packing-items$/.exec(path)
  if (packingItems !== null) {
    const rawId = packingItems[1] ?? ''

    if (method === 'GET') {
      return withPlan(memberId, rawId, (plan) => ({ status: 200, payload: ok(toPacking(plan)) }))
    }
    if (method === 'PUT') return withPlan(memberId, rawId, (plan) => savePacking(plan, body))
    if (method === 'POST') return withPlan(memberId, rawId, (plan) => addPacking(plan, body))
  }

  /*
    여행 후기 (#614). **상세 catch-all 보다 앞이다** — 뒤에 두면
    `/plans/{id}/reviews` 를 `/plans/{id}` 가 먼저 잡는다.
  */
  const reviews = /^\/plans\/([^/]+)\/reviews$/.exec(path)
  if (reviews !== null) {
    const rawId = reviews[1] ?? ''
    if (method === 'GET') return withPlan(memberId, rawId, (plan) => getReview(plan))
    if (method === 'POST') return withPlan(memberId, rawId, (plan) => createReview(plan, body))
    if (method === 'PUT') return withPlan(memberId, rawId, (plan) => updateReview(plan, body))
  }

  /**
   * 일정 복사 (#617). **상세 catch-all 보다 앞이다** — `/plans/{id}` 정규식은 슬래시를
   * 포함한 경로를 잡지 않아 실제로 겹치지는 않지만, 다른 하위 경로들과 같은 자리에 모아 둔다.
   */
  const copy = /^\/plans\/([^/]+)\/copy$/.exec(path)
  if (copy !== null && method === 'POST') {
    return withPlan(memberId, copy[1] ?? '', (plan) => copyPlanRequest(plan, memberId, body))
  }

  const detail = /^\/plans\/([^/]+)$/.exec(path)
  if (detail !== null) {
    const rawId = detail[1] ?? ''

    if (method === 'GET') {
      return withPlan(memberId, rawId, (plan) => ({ status: 200, payload: ok(toDetail(plan)) }))
    }
    if (method === 'PUT') return withPlan(memberId, rawId, (plan) => update(plan, body))
    if (method === 'DELETE') {
      return withPlan(memberId, rawId, (plan) => {
        // 백엔드는 소프트 삭제다 — 행이 남고 조회에서만 빠진다
        plan.deleted = true
        return { status: 200, payload: ok(null) }
      })
    }
  }

  return null
}

/**
 * `planId` 를 판정하고 소유한 일정을 넘긴다.
 *
 * **숫자가 아닌 id 는 404 가 아니라 400 이다** — 컨트롤러가 `@PathVariable long` 이라
 * 바인딩 단계에서 걸린다 (장소 상세의 `PLACE_113` 과 같은 상황).
 * **남의 일정도 404 다** — 컨트롤러 설명이 존재 여부를 흘리지 않겠다고 명시했다.
 */
function withPlan(
  memberId: string,
  rawId: string,
  handle: (plan: MockPlan) => MockResult,
): MockResult {
  const planId = bindPathVariable('planId', rawId)
  if (typeof planId !== 'string') return planId

  const plan = mockStore().plans.find(
    (candidate) =>
      candidate.planId === planId && candidate.memberId === memberId && !candidate.deleted,
  )
  if (plan === undefined) return fail(404, 'PLAN_001', '존재하지 않는 여행 일정입니다.')

  return handle(plan)
}

/**
 * 항목 방문 체크 — `PUT /plans/{planId}/items/{planItemId}/visited` (#124).
 *
 * 근거: `PlanWebController.markItemVisited` · `PlanItemVisitedRequest` ·
 * `PlanCommandProcessor.markItemVisited` **소스 실측**.
 *
 * **소유권은 일정 기준으로 보고, 항목이 그 일정의 것인지 다시 확인한다** — 백엔드가
 * `findById(planItemId).filter(found -> found.planId() == plan.id())` 로 그렇게 한다.
 * `planItemId` 만 믿으면 남의 일정 항목을 내 `planId` 로 체크할 수 있다.
 *
 * **응답이 `Response<Void>` 다** — `dataBody` 가 `null` 이라, 호출부가 `clientFetch` 로
 * 부르면 "서버는 저장했는데 화면만 실패" 가 된다. mock 도 같은 모양을 내야 그 함정이
 * 로컬에서 드러난다.
 */
function markVisited(plan: MockPlan, rawItemId: string, body: string | null): MockResult {
  // 컨트롤러가 `@PathVariable long` 이라 숫자가 아닌 id 는 404 가 아니라 400 이다
  const planItemId = bindPathVariable('planItemId', rawItemId)
  if (typeof planItemId !== 'string') return planItemId

  let parsed: Record<string, unknown>
  try {
    parsed = body === null ? {} : (JSON.parse(body) as Record<string, unknown>)
  } catch {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }

  // `@NotNull Boolean visited` — 빠지면 Bean Validation 이 잡는다
  if (typeof parsed.visited !== 'boolean') {
    return failValidation([
      { code: 'PLAN_100', field: 'visited', message: '방문 여부는 필수입니다.' },
    ])
  }

  const item = plan.items.find((candidate) => candidate.planItemId === planItemId)
  // 없는 항목, 또는 **다른 일정의** 항목이면 404 다 (`PLAN_005`)
  if (item === undefined) return fail(404, 'PLAN_005', '존재하지 않는 일정 항목입니다.')

  item.visited = parsed.visited
  return { status: 200, payload: ok(null) }
}

/**
 * 부분 수정. **보내지 않은 필드는 유지된다** (`PlanCommandProcessor.updatePlan`).
 *
 * `budget: null` 은 "지운다" 가 아니라 "유지" 다 — 백엔드와 같아야 화면이 0 을 보내는
 * 이유(D4)가 mock 에서도 성립한다.
 */
function update(plan: MockPlan, body: string | null): MockResult {
  let parsed: Record<string, unknown>
  try {
    parsed = body === null ? {} : (JSON.parse(body) as Record<string, unknown>)
  } catch {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }

  const errors: { code: string; field: string; message: string }[] = []

  // 문자열이 아닌 title 은 Jackson 이 400 으로 거른다. mock 도 문자열만 본다
  if (parsed.title !== undefined && parsed.title !== null) {
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
    if (title.length === 0) {
      errors.push({ code: 'PLAN_103', field: 'title', message: '일정 제목은 필수입니다.' })
    } else if (title.length > 60) {
      errors.push({
        code: 'PLAN_104',
        field: 'title',
        message: '일정 제목은 60자 이하만 가능합니다.',
      })
    }
  }

  if (parsed.budget !== undefined && parsed.budget !== null) {
    const budget = Number(parsed.budget)
    if (!Number.isFinite(budget) || budget < 0) {
      errors.push({ code: 'PLAN_107', field: 'budget', message: '예산은 0 이상이어야 합니다.' })
    }
  }

  if (errors.length > 0) return failValidation(errors)

  if (typeof parsed.title === 'string') plan.title = parsed.title.trim()
  if (typeof parsed.budget === 'number') plan.budget = parsed.budget
  if (typeof parsed.status === 'string') plan.status = parsed.status

  return { status: 200, payload: ok(toDetail(plan)) }
}

/** ` (복사)` 접미. `PlanCommandProcessor.java:376-384` 복제본 (#617) */
const COPY_TITLE_SUFFIX = ' (복사)'

/** 접미를 붙이고 60자를 넘으면 **원본 쪽을** 잘라 맞춘다 — 접미는 항상 남는다 */
function withCopyTitleSuffix(title: string): string {
  const combined = `${title}${COPY_TITLE_SUFFIX}`
  if (combined.length <= 60) return combined
  return `${title.slice(0, 60 - COPY_TITLE_SUFFIX.length)}${COPY_TITLE_SUFFIX}`
}

/**
 * 일정 복사 — `POST /plans/{planId}/copy` (#617, `일정복사-세부명세.md` D3).
 *
 * **백엔드보다 느슨하거나 엄격해서는 안 된다** (D7). 검사 순서도 서버와 같다 — 서식
 * (`PLAN_105`/`106`/`104`) → 역전(`PLAN_003`) → 상한(`PLAN_009`) → 일수 일치(`PLAN_021`,
 * 원본과 비교) → 반려견 소유(`PLAN_010`, 지금 소유한 아이만 남기고 없으면 거절).
 *
 * **`title` 은 받아도 무시한다** (D0-1 · D3-1) — 이 화면은 애초에 보내지 않지만, mock 이
 * 실수로 보낸 값을 저장하면 서버와 다른 결과를 낸다.
 */
function copyPlanRequest(plan: MockPlan, memberId: string, body: string | null): MockResult {
  let parsed: Record<string, unknown>
  try {
    parsed = body === null ? {} : (JSON.parse(body) as Record<string, unknown>)
  } catch {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }

  const errors: { code: string; field: string; message: string }[] = []

  if (typeof parsed.title === 'string' && parsed.title.trim().length > 60) {
    errors.push({
      code: 'PLAN_104',
      field: 'title',
      message: '일정 제목은 60자 이하만 가능합니다.',
    })
  }

  const startDate = typeof parsed.startDate === 'string' ? parsed.startDate : ''
  if (!DATE_PATTERN.test(startDate)) {
    errors.push({ code: 'PLAN_105', field: 'startDate', message: '여행 시작일은 필수입니다.' })
  }

  const endDate = typeof parsed.endDate === 'string' ? parsed.endDate : ''
  if (!DATE_PATTERN.test(endDate)) {
    errors.push({ code: 'PLAN_106', field: 'endDate', message: '여행 종료일은 필수입니다.' })
  }

  if (errors.length > 0) return failValidation(errors)

  // 역전 → 상한 순서로 본다 — `create()` 의 `validateDateRange` 와 같은 순서
  if (startDate > endDate) {
    return fail(400, 'PLAN_003', '여행 시작일은 종료일보다 늦을 수 없습니다.')
  }
  if (daysBetween(startDate, endDate) > 30) {
    return fail(400, 'PLAN_009', '여행 기간은 최대 30일까지 만들 수 있습니다.')
  }

  /*
    **그다음 일수 비교다** (D3-2) — 역전·상한 통과 뒤에만 의미가 있다. 여기가 이 API
    고유의 규칙이라 `create()` 에는 없다.
  */
  if (daysBetween(startDate, endDate) !== daysBetween(plan.startDate, plan.endDate)) {
    return fail(400, 'PLAN_021', '복사할 여행 기간의 일수는 원본과 같아야 합니다.')
  }

  /*
    **원본 동행견 중 지금 소유한 아이만 남긴다** (D3-3). 대표 반려견 폴백이 없다 —
    남는 아이가 없으면 그대로 거절한다(`PLAN_010`).
  */
  const store = mockStore()
  const ownedPetIds = new Set(
    store.pets.filter((pet) => pet.memberId === memberId && !pet.deleted).map((pet) => pet.petId),
  )
  const effectivePetIds = plan.petIds.filter((petId) => ownedPetIds.has(petId))
  if (effectivePetIds.length === 0) {
    return fail(400, 'PLAN_010', '동행할 반려견을 지정하거나 대표 반려견을 등록해 주세요.')
  }

  /*
    **일자·순서·종류·대상·제목·메모·시작시간은 승계, 방문 체크는 승계되지 않는다**
    (D3-3) — 새 항목은 서버가 새로 발급하므로 전부 미방문이다.
  */
  const items: MockPlanItem[] = plan.items.map((item) => ({
    planItemId: nextPlanItemId(store),
    day: item.day,
    sequence: item.sequence,
    itemType: item.itemType,
    targetId: item.targetId,
    title: item.title,
    memo: item.memo,
    startTime: item.startTime,
    visited: false,
  }))

  const copied: MockPlan = {
    planId: nextPlanId(store),
    memberId,
    petId: effectivePetIds[0] as string,
    petIds: effectivePetIds,
    areaCode: plan.areaCode,
    sigunguCode: plan.sigunguCode,
    title: withCopyTitleSuffix(plan.title),
    startDate,
    endDate,
    budget: plan.budget,
    // 복사본은 항상 초안이다 (D3-1)
    status: 'DRAFT',
    items,
    // 준비물 · 후기는 승계되지 않는다 (D3-3)
    packingItems: [],
    packingGeneratedAt: null,
    review: null,
    deleted: false,
  }
  store.plans.push(copied)

  return { status: 200, payload: ok(toDetail(copied)) }
}

/**
 * 커서 기반 목록. **`id DESC` 로 정렬한다** — 백엔드
 * `findByMemberIdAndDeletedFalseAndIdLessThanOrderByIdDesc` 와 같은 순서여야
 * 화면의 재정렬 로직이 실제와 같은 입력을 받는다 (공통명세 S5).
 */
function list(memberId: string, search: string): MockResult {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  const rawSize = params.get('size')
  const size = rawSize === null ? DEFAULT_SIZE : Number(rawSize)
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    return failValidation([
      { code: 'PLAN_113', field: 'size', message: '조회 개수는 1 이상 50 이하만 가능합니다.' },
    ])
  }

  const mine = mockStore()
    .plans.filter((plan) => plan.memberId === memberId && !plan.deleted)
    .sort((a, b) => (a.planId < b.planId ? 1 : a.planId > b.planId ? -1 : 0))

  // 커서는 "직전 응답의 마지막 planId" 이고 서버는 `id < cursor` 로 자른다
  const cursor = params.get('lastPlanId')
  const remaining = cursor === null ? mine : mine.filter((plan) => plan.planId < cursor)

  const contents = remaining.slice(0, size).map(toSummary)
  const body: SliceResponse<PlanSummaryItem> = { contents, hasNext: remaining.length > size }

  return { status: 200, payload: ok(body) }
}

function create(memberId: string, body: string | null): MockResult {
  let parsed: Record<string, unknown>
  try {
    parsed = body === null ? {} : (JSON.parse(body) as Record<string, unknown>)
  } catch {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }

  const errors: { code: string; field: string; message: string }[] = []

  /*
    **`petId` 는 더 이상 필수가 아니다** (#152). `@NotNull` 이 빠지고 `@Positive` 만 남아
    `PLAN_101` 의 뜻이 "필수" 에서 "양수여야 한다" 로 바뀌었다 — 필드는 같고 위반 종류만
    바뀐 자리다 (`PlanValidationMessage.PET_ID_POSITIVE`).
  */
  const petId = toPetIdString(parsed.petId)
  if (parsed.petId !== undefined && parsed.petId !== null && !POSITIVE_ID_PATTERN.test(petId)) {
    errors.push({ code: 'PLAN_101', field: 'petId', message: '반려견 아이디는 양수여야 합니다.' })
  }

  /*
    동행 반려견 (#152). 배열이 아니면 Jackson 역직렬화가 먼저 깨지므로 필드 오류가 아니라
    `PLAN_100` 이다 — 본문 파싱 실패와 같은 자리다.
  */
  if (parsed.petIds !== undefined && parsed.petIds !== null && !Array.isArray(parsed.petIds)) {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }
  const petIds = Array.isArray(parsed.petIds) ? parsed.petIds.map(toPetIdString) : []
  if (petIds.length > MAX_PLAN_PETS) {
    errors.push({
      code: 'PLAN_115',
      field: 'petIds',
      message: '동행 반려견은 최대 5마리까지 지정할 수 있습니다.',
    })
  }
  // 원소마다 `@Positive` 가 걸려 있다 — 필드 코드는 petId 와 같은 PLAN_101 이다
  if (petIds.some((candidate) => !POSITIVE_ID_PATTERN.test(candidate))) {
    errors.push({ code: 'PLAN_101', field: 'petIds', message: '반려견 아이디는 양수여야 합니다.' })
  }

  const areaCode = typeof parsed.areaCode === 'string' ? parsed.areaCode.trim() : ''
  if (areaCode === '') {
    errors.push({ code: 'PLAN_102', field: 'areaCode', message: '지역 코드는 필수입니다.' })
  }

  const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
  if (title === '') {
    errors.push({ code: 'PLAN_103', field: 'title', message: '일정 제목은 필수입니다.' })
  } else if (title.length > 60) {
    errors.push({
      code: 'PLAN_104',
      field: 'title',
      message: '일정 제목은 60자 이하만 가능합니다.',
    })
  }

  const startDate = typeof parsed.startDate === 'string' ? parsed.startDate : ''
  if (!DATE_PATTERN.test(startDate)) {
    errors.push({ code: 'PLAN_105', field: 'startDate', message: '여행 시작일은 필수입니다.' })
  }

  const endDate = typeof parsed.endDate === 'string' ? parsed.endDate : ''
  if (!DATE_PATTERN.test(endDate)) {
    errors.push({ code: 'PLAN_106', field: 'endDate', message: '여행 종료일은 필수입니다.' })
  }

  const budget =
    parsed.budget === undefined || parsed.budget === null ? null : Number(parsed.budget)
  if (budget !== null && (!Number.isInteger(budget) || budget < 0)) {
    errors.push({ code: 'PLAN_107', field: 'budget', message: '예산은 0 이상이어야 합니다.' })
  }

  if (errors.length > 0) return failValidation(errors)

  /*
    **날짜 역전은 필드 오류가 아니라 도메인 예외다** — `PLAN_003` 400 이고 Bean
    Validation 응답 형태가 아니다. 필드 오류로 흉내 내면 FE 의 폼 오류 매핑이
    실제로는 안 걸리는 경로를 통과시킨다.
  */
  if (startDate > endDate) {
    return fail(400, 'PLAN_003', '여행 시작일은 종료일보다 늦을 수 없습니다.')
  }

  const store = mockStore()

  /*
    **반려견 확정이 항목 검증보다 먼저다** (#152). 서버는 저장 *전에* `resolvePetIds` 를
    부르고 항목 검증(`PLAN_002`·`PLAN_004`)은 저장 *뒤에* 돈다
    (`PlanCommandProcessor.createPlan`). 순서를 뒤집으면 FE 가 실제로는 못 보는 오류를 본다.

    **`petIds` 가 `petId` 를 이긴다.** 중복은 순서를 지켜 한 마리로 접는다 —
    첫 번째가 대표 반려견이 된다 (`PlanCreateRequest.effectivePetIds`).
  */
  const requestedPetIds = petIds.length > 0 ? [...new Set(petIds)] : petId === '' ? [] : [petId]

  /*
    지정이 없으면 **대표 반려견**으로 대신한다 — 한 마리만 키우는 사용자가 담기마다
    반려견을 고르게 하지 않기 위한 기본값이다. 대표도 없으면 일정을 만들 수 없다
    (`PLAN_010`) — `plan.pet_id` 가 NOT NULL 이고 날씨 판정의 기준이기 때문이다.

    **필드 오류가 아니라 도메인 예외다** — Bean Validation 응답 형태로 흉내 내면
    FE 의 폼 오류 매핑이 실제로는 안 걸리는 경로를 통과시킨다.
  */
  const effectivePetIds =
    requestedPetIds.length > 0 ? requestedPetIds : representativePetIdsOf(store, memberId)
  if (effectivePetIds.length === 0) {
    return fail(400, 'PLAN_010', '동행할 반려견을 지정하거나 대표 반려견을 등록해 주세요.')
  }

  const itemErrors: { code: string; field: string; message: string }[] = []
  const items = toItems(parsed.items, store, itemErrors)
  if (itemErrors.length > 0) return failValidation(itemErrors)

  /*
    **일차 범위와 장소 존재를 함께 본다** — `PlanCommandProcessor.createPlan` 이
    `validateItemDays` → `verifyPlaceTargets` 를 순서대로 부른다. 둘 다 도메인 예외라
    Bean Validation 응답 형태가 아니다.

    이 둘이 없으면 이 저장소의 `PLAN_004` 복구 UI("빼고 담기")가 로컬에서 한 번도
    열리지 않는다.
  */
  const totalDays = daysBetween(startDate, endDate)
  if (items.some((item) => item.day > totalDays)) {
    return fail(400, 'PLAN_002', '여행 일차가 여행 기간을 벗어났습니다.')
  }

  const missing = items.find(
    (item) =>
      PLACE_TARGET_TYPES.has(item.itemType) &&
      item.targetId !== null &&
      !KNOWN_PLACE_IDS.has(item.targetId),
  )
  if (missing !== undefined) {
    return fail(400, 'PLAN_004', '일정에 포함된 장소를 찾을 수 없습니다.')
  }

  /*
    **남의 반려견을 거절하지 않는다.** 예전 mock 은 여기서 `PLAN_101` 400 을 냈지만
    plan-service 는 `petId` 소유권을 검사하지 않는다 — `createPlan` 이 값을 그대로 저장하고,
    auth-service 는 **나중에 날씨 판정의 특성 조회에서만** 소유권을 본다(소유가 아니면 특성이
    빠질 뿐 일정은 만들어진다). mock 이 더 엄격하면 FE 가 프로덕션에 없는 오류 분기를 만든다.
  */
  const plan: MockPlan = {
    planId: nextPlanId(store),
    memberId,
    // 대표 = 첫 번째. 목록 전체는 petIds 에 둔다 (#152 설계 판단 1)
    petId: effectivePetIds[0] as string,
    petIds: effectivePetIds,
    areaCode,
    sigunguCode: typeof parsed.sigunguCode === 'string' ? parsed.sigunguCode : null,
    title,
    startDate,
    endDate,
    budget,
    // 새 일정은 항상 초안이다 — `PlanCreateRequest` 에 status 가 없다
    status: 'DRAFT',
    /*
      **`items` 를 버리지 않는다.** 직접 만들기는 빈 배열을 보내지만(공통명세 S9 — 장소는
      일자 편집에서 담는다), **AI 초안 담기는 항목을 함께 보낸다** (ai-plan 명세 S5).
      `[]` 로 고정하면 담은 직후 빈 일정이 보이고 항목 검증도 확인할 수 없다.
    */
    items,
    packingItems: [],
    packingGeneratedAt: null,
    review: null,
    deleted: false,
  }
  store.plans.push(plan)

  return { status: 200, payload: ok(toDetail(plan)) }
}

// ─── 일자별 판정 (#80) ────────────────────────────────────────────────────────

/** 백엔드 `SuitabilityLevel` 복제본. `insight-data.ts` 와 같은 값이어야 한다 */
const SUITABILITY: Record<string, ScoreMetricMetadata> = {
  HIGH: {
    code: 'HIGH',
    name: '여행 적합',
    description: '반려견과 방문하기 좋은 조건입니다.',
    scoreDescription: '점수가 높을수록 날씨/동반 조건이 반려견에게 유리합니다.',
  },
  MEDIUM: {
    code: 'MEDIUM',
    name: '보통',
    description: '일부 조건을 확인하고 가면 무난합니다.',
    scoreDescription: '점수가 중간이면 주의할 조건이 한둘 있다는 뜻입니다.',
  },
  LOW: {
    code: 'LOW',
    name: '주의 필요',
    description: '반려견과 방문하기에 불리한 조건이 있습니다.',
    scoreDescription: '점수가 낮을수록 피하거나 시간대를 옮기는 편이 좋습니다.',
  },
}

/**
 * 점수 → 등급. 백엔드 `SuitabilityLevel.from` 의 경계와 같아야 한다 — **80 / 60** 이다.
 * `null` 은 `INSUFFICIENT` 지만 이 mock 은 점수를 못 낸 날에 등급도 `null` 로 두므로
 * (`PlanDayWeatherItem.suitabilityLevel` 이 nullable 이다) 여기서는 다루지 않는다.
 */
function levelOf(score: number): ScoreMetricMetadata {
  if (score >= 80) return SUITABILITY.HIGH as ScoreMetricMetadata
  if (score >= 60) return SUITABILITY.MEDIUM as ScoreMetricMetadata
  return SUITABILITY.LOW as ScoreMetricMetadata
}

/**
 * 두 번째 이후 반려견의 점수 낙폭 (#152).
 *
 * mock 에는 아이별 특성 차이가 없어 그대로 두면 모든 아이가 같은 점수를 받고,
 * **기준 반려견(`basisPetId`)이 언제나 대표와 같아진다** — 화면이 "대표 이름을 붙이면
 * 거짓말이 되는" 경로를 로컬에서 한 번도 못 본다. 11 은 84 → 73(보통), 62 → 51(주의 필요)로
 * **등급까지 갈리게** 고른 값이다.
 */
const PET_SCORE_STEP = 11

/**
 * 예보가 닿는 일수. 백엔드가 단기+중기를 이어 붙여 **약 11일**까지 준다
 * (`PlanWebController.getPlanWeather` 설명). mock 은 fixture 안에서 두 경우를 모두
 * 드러내야 하므로 2일로 줄여 잡는다 — 3일차부터 `score: null` 이다.
 */
const MOCK_FORECAST_DAYS = 2

function addDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`)
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * 일자별 판정.
 *
 * **`days` 는 항상 `totalDays` 길이다.** 배열 길이로 성공/실패를 판단하지 않는다 —
 * 판정을 못 낸 날은 `score: null` + `unavailableReason` 으로 온다.
 */
function toWeather(plan: MockPlan): PlanWeatherResponse {
  const totalDays = totalDaysOf(plan)
  const petIds = petIdsOf(plan)

  const days: PlanDayWeatherItem[] = Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1
    const date = addDays(plan.startDate, index)

    // 그날 첫 장소 항목이 판정 기준이다 (컨트롤러 설명). 없으면 기준이 없다
    const basis = [...plan.items]
      .filter((item) => item.day === day && item.targetId !== null && item.itemType !== 'WALK')
      .sort((a, b) => a.sequence - b.sequence)[0]

    const representativePlaceId = basis?.targetId ?? null
    const representativePlaceTitle = basis?.title ?? null

    // 예보 밖 — **점수가 낮은 것이 아니라 판단 근거가 없는 것이다**
    if (day > MOCK_FORECAST_DAYS || representativePlaceId === null) {
      return {
        day,
        date,
        representativePlaceId,
        representativePlaceTitle,
        // 판정을 못 냈으면 기준 반려견도 없고 아이별 목록도 빈 배열이다 (`briefDay`)
        basisPetId: null,
        score: null,
        suitabilityLevel: null,
        reasons: [],
        weather: null,
        indoorAlternatives: [],
        petSuitabilities: [],
        /*
          **코드와 문장은 짝이다** (#492 · #497). 화면이 사유마다 다르게 그리므로 mock 이
          코드를 빼면 계약의 모양이 달라진다 — `NO_PLACE_ITEM` 은 화면이 서버 문장을
          감추는 유일한 갈래라, 코드가 없으면 mock 에서만 문구가 두 번 나온다.

          **문장은 서버 enum(`PlanDayWeatherUnavailableReason`)의 것을 그대로 쓴다.**
          여기서 바꿔 적으면 화면이 실제로 받는 문장과 다른 것으로 검증하게 된다.

          `PAST_DATE` 는 mock 이 "오늘" 을 모르므로 나지 않는다 — 지난 날짜 갈래는
          `plan-day-verdict.test.ts` 가 직접 덮는다.
        */
        ...(representativePlaceId === null
          ? {
              unavailableReasonCode: NO_PLACE_ITEM_REASON_CODE,
              unavailableReason:
                '이 날짜에는 장소가 지정된 일정 항목이 없어 날씨를 붙이지 못했습니다.',
            }
          : {
              unavailableReasonCode: 'BEYOND_FORECAST_RANGE',
              unavailableReason:
                '예보는 오늘부터 11일까지만 제공되어 이 날짜는 아직 판정할 수 없습니다.',
            }),
      }
    }

    // 2일차는 비 예보 + 중기예보 구간이다 — 실내 대안과 출처 문구를 함께 드러낸다
    const rainy = day === 2

    /*
      **아이별로 따로 판정한다** (#152). 서버는 아이마다 조건이 달라 tour-service 를 따로
      부르지만, mock 에는 그 차이가 없으므로 순서대로 낙폭을 준다 — 값이 아니라 **모양**이
      계약이다. 순서는 `petIds` 순서를 지킨다 (서버가 `LinkedHashMap` 으로 보존한다).
    */
    const petSuitabilities = petIds.map((petId, order) => {
      const petScore = (rainy ? 62 : 84) - order * PET_SCORE_STEP
      return { petId, score: petScore, suitabilityLevel: levelOf(petScore) }
    })

    /*
      **그날의 기준은 점수가 가장 낮은 아이다** — 한 마리라도 힘든 날이면 그날은 힘든
      날이라는 규칙이다 (`PlanWeatherProcessor.pickBasisPet`). 동점이면 순서상 앞선 아이가
      이기므로 `reduce` 의 비교를 `<` 로 둔다 (`Comparator.min` 과 같은 결과다).

      아래 `score`·`suitabilityLevel`·`reasons`·`indoorAlternatives` 가 전부 이 아이 기준이라,
      **여러 마리면 대표(petIds[0]) 점수와 다르다.**
    */
    const basisPet = petSuitabilities.reduce((lowest, candidate) =>
      candidate.score < lowest.score ? candidate : lowest,
    )

    return {
      day,
      date,
      representativePlaceId,
      representativePlaceTitle,
      basisPetId: basisPet.petId,
      score: basisPet.score,
      suitabilityLevel: basisPet.suitabilityLevel,
      reasons: rainy
        ? [
            {
              code: 'RAIN_EXPECTED',
              name: '비 예보',
              description: '강수확률이 80%라 야외 활동이 어려울 수 있습니다.',
              scoreDelta: -25,
            },
            {
              code: 'TEMPERATURE_OK',
              name: '기온 적정',
              description: '최고기온 24도로 반려견에게 무리가 없습니다.',
              scoreDelta: 0,
            },
          ]
        : [
            {
              code: 'PET_ALLOWED',
              name: '반려견 동반 가능',
              description: '반려견과 함께 입장할 수 있는 장소입니다.',
              scoreDelta: 0,
            },
            {
              code: 'TEMPERATURE_OK',
              name: '기온 적정',
              description: '최고기온 26도로 반려견에게 무리가 없습니다.',
              scoreDelta: 0,
            },
            {
              code: 'CONGESTION_UNKNOWN',
              name: '혼잡도 정보 없음',
              description: '이 장소의 혼잡도 자료가 아직 없습니다.',
              // 정보성 — 감점이 아니다. 화면이 한 단계 흐리게 내리는 분기를 로컬에서 볼 수 있게 둔다
              scoreDelta: 0,
            },
          ],
      weather: {
        date,
        // MID_TERM 이면 대략적인 값이다 — 화면이 출처를 밝힌다
        forecastSourceCode: rainy ? 'MID_TERM' : 'SHORT_TERM',
        forecastSourceName: rainy ? '중기예보' : '단기예보',
        minTemperature: rainy ? 19.0 : 21.0,
        maxTemperature: rainy ? 24.0 : 26.0,
        /*
          **중기예보(`rainy`)는 언제나 null 이다** (#253) — 시각별 데이터가 없어 열지수를
          낼 수 없고, 서버가 최고기온으로 대신 채우지도 않는다. 두 갈래를 다 내야 화면의
          `최고기온` 폴백 경로를 로컬에서 볼 수 있다.

          단기예보 쪽 값이 최고기온(26.0)보다 높은 것은 습도가 60% 라서다 — 두 값이 같으면
          체감온도를 쓰는 이유가 화면에서 드러나지 않는다.
        */
        maxFeelsLikeTemperature: rainy ? null : 27.5,
        maxPrecipitationProbability: rainy ? 80 : 10,
        precipitationTypeName: rainy ? '비' : '없음',
        skyStateName: rainy ? '흐림' : '맑음',
        maxWindSpeed: rainy ? 7.2 : 3.1,
        maxHumidity: rainy ? 88 : 60,
      },
      // 비 예보가 있고 그날 장소가 실내가 아닐 때만 채워진다 (컨트롤러 설명)
      indoorAlternatives: rainy ? indoorAlternatives(representativePlaceId) : [],
      petSuitabilities,
      unavailableReason: null,
      unavailableReasonCode: null,
    }
  })

  return {
    planId: plan.planId,
    planTitle: plan.title,
    startDate: plan.startDate,
    endDate: plan.endDate,
    petIds,
    // 여러 마리면 "한 마리라도 특성이 반영됐는가" 다 — 마리별 플래그가 아니다 (#152)
    petConditionApplied: true,
    days,
  }
}

// ─── 출발 전 여행 브리핑 (#626) ──────────────────────────────────────────────

/**
 * 특보를 확인하지 못한 이유 — **서버 상수 문장 그대로다** (`PlanBriefingProcessor:69~71`).
 *
 * 여기서 바꿔 적으면 화면이 실제로 받는 문장과 다른 것으로 검증하게 된다.
 */
const WARNING_REASON_NOT_TODAY = '기상특보는 출발 당일에만 확인합니다.'
const WARNING_REASON_LOOKUP_FAILED =
  '기상특보 정보를 가져오지 못했습니다. 기상청 발표를 직접 확인해 주세요.'

/**
 * 브리핑의 `LOOKUP_FAILED` 를 결정적으로 재현하는 마커 (#751).
 *
 * **넷 중 이 사유만 데이터로 만들 수 없다.** `NOT_TODAY` 는 날짜로, `NO_PLACE_ITEM` 은
 * 장소 항목을 빼서, `NO_PLACE_POINT` 는 좌표 없는 장소로 각각 재현되는데, `LOOKUP_FAILED`
 * 는 **원격 조회의 시간차 장애**라 일정 데이터에 그 상태가 없다. 그래서 그날 항목의
 * `memo` 에 마커를 실어 고른다 — `WALK_SAFETY_LOOKUP_FAILED_MARKER` 와 같은 방식이다.
 *
 * **이 갈래를 로컬에서 못 보던 대가가 실제로 있었다** — #751 검토에서 이 사유에 걸린 버그
 * 둘(`toLatLng` 우회 · 곡선 실패 미처리)이 나왔고 둘 다 화면으로는 확인할 수 없었다.
 *
 * **둘을 따로 둔다.** 게이트웨이 장애는 특보·골든타임을 함께 때리기 쉬워 두 재시도 버튼이
 * 한 화면에 서는 갈래도 봐야 하는데, 마커가 하나면 그 조합만 볼 수 있고 각각은 못 본다.
 * 두 항목에 하나씩 실으면 셋 다 재현된다.
 *
 * 화면 코드는 이 값을 모른다 — mock 시나리오 구성용이다.
 */
export const BRIEFING_WALK_LOOKUP_FAILED_MARKER = '__BRIEFING_WALK_LOOKUP_FAILED__'
export const BRIEFING_WARNING_LOOKUP_FAILED_MARKER = '__BRIEFING_WARNING_LOOKUP_FAILED__'

/**
 * 골든타임을 못 낸 이유 — **서버 enum 의 `description` 그대로다**
 * (`PlanBriefingWalkTimesUnavailableReason`, #716 소스 실측 2026-09-21).
 *
 * 당일이 아닌 갈래의 문장이 `확인합니다` 로 적혀 있었는데 서버는 `제공됩니다` 다. 화면이
 * 문장을 파싱하지는 않지만, 목이 서버와 다르면 **로컬에서 본 것이 실제와 다르다.**
 */
const WALK_REASON_NOT_TODAY = '산책 골든타임은 출발 당일에만 제공됩니다.'
const WALK_REASON_LOOKUP_FAILED =
  '산책 골든타임 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.'
const WALK_REASON_NO_PLACE_ITEM =
  '이 날짜에는 장소가 지정된 일정 항목이 없어 골든타임을 붙이지 못했습니다.'
const WALK_REASON_NO_PLACE_POINT = '대표 장소의 좌표가 없어 골든타임을 붙이지 못했습니다.'

/**
 * 브리핑 `date` 바인딩 — 성공하면 날짜 문자열, 실패하면 400 이다.
 *
 * `@RequestParam LocalDate date` 는 필수라 없으면 스프링이 도메인에 닿기 전에 400 을 낸다.
 * **서버는 누락과 형식 오류를 가른다** (#716 BE 소스 실측, 명세 D9-4):
 * `MissingServletRequestParameterException` → `PARAMETER_REQUIRED`(`PLAN_125`),
 * `MethodArgumentTypeMismatchException` → `PARAMETER_TYPE_INVALID`(`PLAN_124`).
 * 예전에는 둘을 `PLAN_100` 하나로 묶고 있었다.
 *
 * **문구와 `fieldErrors` 는 dev 게이트웨이 실측이다** (2026-09-21 · 토큰 없는 GET, #795).
 * #716 때는 게이트웨이가 안 떠 BE 소스로만 읽었고, 그 문구가 실제와 달랐다:
 *
 * - `?` 없음 · `?date=` → 400 `PLAN_125` `필수 요청 파라미터가 누락되었습니다. (date)`
 *   / `fieldErrors: null`
 * - `?date=2026-9-21` → 400 `PLAN_124` `date 파라미터 형식이 올바르지 않습니다.`
 *   / `fieldErrors` 한 건 (`field: "date"`)
 *
 * **`failValidation` 을 쓰지 않는다.** 그쪽은 헤더 코드를 `PLAN_100` 으로 고정하고 개별
 * 코드를 항목에만 싣는 모양인데, 서버는 여기서 헤더와 항목에 같은 `PLAN_124` 를 싣는다.
 * `fail()` 의 4번째 인자를 직접 쓰는 이유다.
 */
function bindBriefingDate(search: string): string | MockResult {
  const date = new URLSearchParams(search).get('date')

  // 빈 값도 누락으로 접는다 — dev 는 `?date=` 에도 `PLAN_125` 를 낸다
  if (date === null || date === '') {
    return fail(400, 'PLAN_125', '필수 요청 파라미터가 누락되었습니다. (date)')
  }

  if (!DATE_PATTERN.test(date)) {
    const message = 'date 파라미터 형식이 올바르지 않습니다.'
    return fail(400, 'PLAN_124', message, [{ code: 'PLAN_124', field: 'date', message }])
  }

  return date
}

/**
 * 하루치 합본 — `GET /plans/{planId}/briefing?date=`.
 *
 * **`date` 는 이미 바인딩을 통과한 값이다** (`bindBriefingDate`) — 누락·형식 오류는 인증
 * 앞 관문에서 걸러져 여기 닿지 않는다.
 *
 * **새 판정이 아니라 기존 판정의 묶음이다.** 날씨는 `toWeather` 가 만든 그 일자를 그대로
 * 쓴다 — 서버도 같은 변환(`PlanWeatherPresenter.toDayItem`)을 쓰므로 여기서 다른 값을
 * 만들면 두 화면이 갈린다.
 *
 * **특보·골든타임은 `today=true` 일 때만 채워지고, 아니면 이유 문장이 온다.** 이유가 차
 * 있는 것과 "없음" 은 다른 사실이다 — mock 이 이유를 비우면 화면의 핵심 갈래를 로컬에서
 * 한 번도 못 본다.
 */
function toBriefing(plan: MockPlan, date: string): MockResult {
  const startTime = Date.parse(`${plan.startDate}T00:00:00Z`)
  const day = Math.round((Date.parse(`${date}T00:00:00Z`) - startTime) / 86_400_000) + 1

  // 기간 밖은 404 가 아니라 **400 `PLAN_002`** 다 (`resolveDay`)
  if (day < 1 || day > totalDaysOf(plan)) {
    return fail(400, 'PLAN_002', '여행 일차가 여행 기간을 벗어났습니다.')
  }

  /*
    **서버는 자기 `Clock` 으로 오늘을 본다** (`date.equals(LocalDate.now(clock))`).
    mock 도 요청 시각의 오늘과 비교한다 — FE 가 고른 날짜를 그대로 "오늘" 로 삼으면
    자정 갈래를 로컬에서 볼 수 없다.
  */
  const today = date === todayDay(new Date())

  const weather = toWeather(plan).days[day - 1] ?? null
  const items = [...plan.items]
    .filter((item) => item.day === day)
    .sort((a, b) => a.sequence - b.sequence)
  const first = items[0] ?? null
  const last = items.at(-1) ?? null

  // 그날 첫 장소 항목이 판정 기준이다 — `toWeather` 와 같은 규칙이어야 한다
  const basis = items.find((item) => item.targetId !== null && item.itemType !== 'WALK') ?? null
  const basisPlace = basis === null ? null : (PLACE_BY_ID.get(basis.targetId ?? '') ?? null)

  /*
    **장애 마커는 `today` 일 때만 이긴다.** 오늘이 아닌 날은 서버가 조회 자체를 하지 않아
    `NOT_TODAY` 가 나오므로, 마커가 그것을 덮으면 있을 수 없는 응답이 된다.

    **마커가 좌표를 지우지 않는다** — `LOOKUP_FAILED` 는 대표 장소가 멀쩡한데 조회만 실패한
    상태다. `schedule.representativeLat/Lng` 가 그대로 남아야 화면의 곡선 폴백(명세 D9-3)이
    로컬에서 실제로 돈다.
  */
  const walkLookupFailed =
    today && items.some((item) => item.memo === BRIEFING_WALK_LOOKUP_FAILED_MARKER)
  const warningLookupFailed =
    today && items.some((item) => item.memo === BRIEFING_WARNING_LOOKUP_FAILED_MARKER)

  return {
    status: 200,
    payload: ok({
      planId: plan.planId,
      planTitle: plan.title,
      day,
      date,
      today,
      petIds: petIdsOf(plan),
      basisPetId: weather?.basisPetId ?? null,
      petConditionApplied: true,
      schedule: {
        itemCount: items.length,
        visitedCount: items.filter((item) => item.visited).length,
        firstItem: first === null ? null : toBriefingItem(first),
        lastItem: last === null ? null : toBriefingItem(last),
        representativePlaceId: basis?.targetId ?? null,
        representativePlaceTitle: basis?.title ?? null,
        /*
          **`walkTimes` 와 무관하게 싣는다** (#716). 프레젠터가 골든타임을 못 붙인 날에도
          이 좌표를 채우므로, 목이 비워 두면 화면이 좌표 폴백 갈래를 로컬에서 못 본다.
        */
        representativeLat: basisPlace?.lat ?? null,
        representativeLng: basisPlace?.lng ?? null,
      },
      weather,
      weatherWarning:
        today && !warningLookupFailed
          ? {
              type: { code: 'HEAT_WAVE', name: '폭염', description: '폭염 특보입니다.' },
              level: {
                code: 'ADVISORY',
                name: '주의보',
                description: '한낮 야외 활동을 줄이는 것이 좋습니다.',
              },
              // 주의보라 보류가 아니다 — 화면이 `level.code` 로 다시 판정하지 않는지 본다
              recommendationSuppressed: false,
              effectiveAt: `${date}T11:00:00`,
            }
          : null,
      weatherWarningUnavailableReasonCode: !today
        ? 'NOT_TODAY'
        : warningLookupFailed
          ? 'LOOKUP_FAILED'
          : null,
      weatherWarningUnavailableReason: !today
        ? WARNING_REASON_NOT_TODAY
        : warningLookupFailed
          ? WARNING_REASON_LOOKUP_FAILED
          : null,
      walkTimes:
        today && !walkLookupFailed && basisPlace?.lat != null && basisPlace.lng != null
          ? {
              lat: basisPlace.lat,
              lng: basisPlace.lng,
              from: `${date}T09:00:00`,
              forecastCoverage: { code: 'AVAILABLE', name: '예보 있음', description: null },
              goldenStart: `${date}T18:00:00`,
              goldenEnd: `${date}T21:00:00`,
              goldenLevel: {
                code: 'SAFE',
                name: '안전',
                description: '산책하기 좋은 조건입니다.',
                scoreDescription: '등급이 높을수록 산책에 무리가 없습니다.',
              },
              goldenWindowStatus: {
                code: 'AVAILABLE',
                name: '추천 구간 있음',
                description: '이 시간대에 산책하기 좋습니다.',
              },
              petConditionApplied: true,
            }
          : null,
      /*
        **사유가 넷이라 갈래도 넷이다** (#716). `basis` 자체가 없으면 그날 장소성 항목이
        없는 것(`NO_PLACE_ITEM`)이고, 항목은 있는데 좌표가 없으면 `NO_PLACE_POINT` 다 —
        예전에는 둘을 좌표 하나로 뭉쳐 `NO_PLACE_ITEM` 을 로컬에서 볼 수 없었다.
      */
      walkTimesUnavailableReasonCode: !today
        ? 'NOT_TODAY'
        : basis === null
          ? 'NO_PLACE_ITEM'
          : basisPlace?.lat == null || basisPlace.lng == null
            ? 'NO_PLACE_POINT'
            : walkLookupFailed
              ? 'LOOKUP_FAILED'
              : null,
      walkTimesUnavailableReason: !today
        ? WALK_REASON_NOT_TODAY
        : basis === null
          ? WALK_REASON_NO_PLACE_ITEM
          : basisPlace?.lat == null || basisPlace.lng == null
            ? WALK_REASON_NO_PLACE_POINT
            : walkLookupFailed
              ? WALK_REASON_LOOKUP_FAILED
              : null,
    } satisfies PlanBriefingResponse),
  }
}

function toBriefingItem(item: MockPlanItem): PlanBriefingItemSummary {
  return {
    planItemId: item.planItemId,
    sequence: item.sequence,
    /*
      **metadata 다** (#716 · 명세 D9-1) — 같은 도메인의 `PlanItemDetail.itemType` 과 모양이
      같아졌다. 한국어는 서버가 채우므로 목도 같은 표를 쓴다 (FE 매핑 테이블이 아니라
      서버 enum 의 복제본이다 — `PlanItemType`).
    */
    itemType: itemTypeMetadata(item.itemType),
    title: item.title,
    startTime: item.startTime,
    visited: item.visited,
  }
}

/**
 * 항목 산책 위험도 (#625). **판정 순서를 백엔드와 같게 지킨다** —
 * `PAST_DATE` → `NOT_PLACE_TARGET` → `NO_START_TIME` → `BEYOND_FORECAST_RANGE` →
 * `LOOKUP_FAILED` → `NO_FORECAST_AT_TIME`. 순서가 틀리면 "지난 날짜 + 시각 없음" 항목이
 * `NO_START_TIME` 으로 잘못 판정된다(D15-3) — mock 이 화면보다 느슨해지는 자리다.
 *
 * **여섯째가 맨 뒤인 것은 우연이 아니다** (#717): 앞 다섯과 달리 tour 에 실제로 물어본
 * **뒤에** 갈리는 답이라 날짜·항목 유형만으로는 결정되지 않는다.
 *
 * **"오늘" 은 실제 시계를 흉내 낸다** (`ai-plan-data.ts` 의 `LocalDate.now()` 흉내와 같은
 * 판단). 지평 판정이 상대적이라 실행 시점의 진짜 오늘을 기준으로 잡아야 한다.
 */
const WALK_SAFETY_HORIZON_DAYS = 4

/**
 * `LOOKUP_FAILED` 를 결정적으로 재현하는 마커.
 *
 * **실제 실패는 tour-service 장애라 `targetId` 존재 여부와 무관하다** — 이미
 * `KNOWN_PLACE_IDS` 검증을 통과한 장소도 그때그때 조회에 실패할 수 있다. mock 에는
 * 그런 시간차 장애를 낼 수단이 없으므로, 항목의 `memo` 에 이 마커를 실어 결정적으로
 * 재현한다 — 화면 코드는 이 값을 모르고, 오직 mock 시나리오 구성용이다.
 */
export const WALK_SAFETY_LOOKUP_FAILED_MARKER = '__WALK_SAFETY_LOOKUP_FAILED__'

/**
 * 등급 metadata.
 *
 * **`scoreDescription` 을 채운다** (#717). 예전 mock 은 전부 `null` 이었는데, 그것은 값이
 * 없어서가 아니라 BE 가 Feign DTO 에 칸이 없어 경계에서 버리고 있었기 때문이다 — #717 이
 * 배선을 이어 이제 실제로 내려온다. 항목 행은 이 문장을 쓰지 않지만(D15-5 — 행은 얇게
 * 둔다) mock 이 계약보다 가난하면 쓸 자리가 생겼을 때 로컬에서 빈 값만 보게 된다.
 *
 * **`UNKNOWN` 이 여기 있다** — `NO_FORECAST_AT_TIME` 항목이 사유 코드와 **함께** 들고 오는
 * 등급이다 (아래 순서 6).
 */
const WALK_SAFETY_LEVEL: Record<'SAFE' | 'CAUTION' | 'DANGER' | 'UNKNOWN', ScoreMetricMetadata> = {
  SAFE: {
    code: 'SAFE',
    name: '안전',
    description: '지금 산책하기 좋은 조건이에요.',
    scoreDescription: '체감온도와 노면 온도가 모두 안전 범위예요.',
  },
  CAUTION: {
    code: 'CAUTION',
    name: '주의',
    description: '무리한 산책은 피해 주세요.',
    scoreDescription: '체감온도나 노면 온도가 주의 범위에 들어왔어요.',
  },
  DANGER: {
    code: 'DANGER',
    name: '위험',
    description: '산책을 피하고 실내에서 쉬게 해 주세요.',
    scoreDescription: '체감온도나 노면 온도가 위험 범위예요.',
  },
  UNKNOWN: {
    code: 'UNKNOWN',
    name: '판단 근거 부족',
    description: '이 시각의 예보 자료가 부족해 등급을 매기지 못했어요.',
    scoreDescription: '판정에 필요한 값이 모이지 않았어요.',
  },
}

function mockPlanWalkSafety(plan: MockPlan): PlanWalkSafetyResponse {
  const today = todayDay(new Date())
  const horizon = addDays(today, WALK_SAFETY_HORIZON_DAYS)
  const petIds = petIdsOf(plan)

  const items: PlanItemWalkSafetyItem[] = plan.items.map((item, order) => {
    const date = addDays(plan.startDate, item.day - 1)
    const isPlaceTarget = PLACE_TARGET_TYPES.has(item.itemType) && item.targetId !== null
    const placeId = isPlaceTarget ? item.targetId : null
    const placeTitle = isPlaceTarget ? (PLACE_BY_ID.get(item.targetId ?? '')?.title ?? null) : null

    const shared = {
      planItemId: item.planItemId,
      day: item.day,
      sequence: item.sequence,
      date,
      startTime: item.startTime,
      title: item.title,
      placeId,
      placeTitle,
      targetDateTime: `${date}T${item.startTime ?? '00:00:00'}`,
      basisPetId: petIds[0] ?? null,
      estimatedPavementCelsius: null,
      feelsLikeCelsius: null,
      temperature: null,
      saferWindowStart: null,
      saferWindowEnd: null,
      /*
        **판정을 못 낸 줄은 `null` 이다** (#717) — "묻지 않았다" 이지 "반영하지 않았다" 가
        아니다. 실제로 물어본 갈래(순서 6·정상 판정)만 아래에서 `boolean` 으로 덮어쓴다.
      */
      petConditionApplied: null,
    }

    /*
      **반려견 특성을 반영하지 못한 항목을 결정적으로 만든다** (#717 · `order % 4 === 2`).

      기준견의 조건만 tour 쪽에서 `unknown()` 이면 **일자는 `true` · 항목은 `false`** 가
      난다(출처가 auth / tour 로 갈린다). mock 의 일자 판정(`toWeather`)은 언제나
      `petConditionApplied: true` 라 이 항목이 그 어긋남을 그대로 재현한다 — 그래야
      항목 행의 새 캡션(`walkSafetyPetConditionMissing`)을 로컬에서 볼 수 있다.
      **`order % 5 === 3`(아래 순서 6)과 주기를 어긋나게 둔 것도 의도다**: 네 항목짜리
      일정 하나에서 `NO_FORECAST_AT_TIME` 과 `배지 + 특성 미반영` 두 갈래가 같이 나온다.
    */
    const petConditionApplied = order % 4 !== 2

    // 순서 1 — 지난 날짜가 가장 먼저다. 무엇을 고쳐도 풀리지 않는 사유라 다른 사유보다 앞선다
    if (date < today) {
      return {
        ...shared,
        walkSafetyLevel: null,
        unavailableReasonCode: 'PAST_DATE',
        unavailableReason: '이미 지난 날짜라 산책 위험도를 판정할 수 없습니다.',
      }
    }

    // 순서 2 — 장소를 가리키지 않는 항목 (WALK·MOVE)
    if (!isPlaceTarget) {
      return {
        ...shared,
        walkSafetyLevel: null,
        unavailableReasonCode: 'NOT_PLACE_TARGET',
        unavailableReason: '장소를 가리키는 항목이 아니라 산책 위험도를 판정할 수 없습니다.',
      }
    }

    // 순서 3 — 시작 시각이 없다
    if (item.startTime === null) {
      return {
        ...shared,
        walkSafetyLevel: null,
        unavailableReasonCode: 'NO_START_TIME',
        unavailableReason: '시작 시각이 없어 산책 위험도를 판정할 수 없습니다.',
      }
    }

    // 순서 4 — 시각별 예보 지평(오늘~오늘+4) 밖. 일자 날씨의 11일과 다르다
    if (date > horizon) {
      return {
        ...shared,
        walkSafetyLevel: null,
        unavailableReasonCode: 'BEYOND_FORECAST_RANGE',
        unavailableReason: `예보는 오늘부터 ${WALK_SAFETY_HORIZON_DAYS + 1}일까지만 제공되어 이 날짜는 아직 판정할 수 없습니다.`,
      }
    }

    // 물어봤는데 실패 — tour-service 장애를 결정적으로 재현하는 마커
    if (item.memo === WALK_SAFETY_LOOKUP_FAILED_MARKER) {
      return {
        ...shared,
        walkSafetyLevel: null,
        unavailableReasonCode: 'LOOKUP_FAILED',
        unavailableReason: '산책 위험도를 조회하지 못했습니다.',
      }
    }

    /*
      순서 6 — 지평 **안인데** 그 시각 예보를 쓸 수 없다 (#717 `NO_FORECAST_AT_TIME`).

      **사유 코드와 `walkSafetyLevel` 이 함께 온다.** 서버가 tour 에 실제로 물어 `UNKNOWN`
      등급을 받은 줄이라 `placeTitle`·`targetDateTime`·`basisPetId`·`petConditionApplied`
      도 그대로 남는다 — "사유가 있으면 판정은 통째로 null" 이라는 옛 불변식의 예외이고,
      **mock 이 그 예외를 재현해야** 화면이 사유 문장을 이기는지 로컬에서 확인할 수 있다.

      **일자 단위로 접히지 않는다** — `order` 로 갈리므로 같은 날 안에서 이 항목과 정상
      판정 항목이 섞인다. 그것이 `BEYOND_FORECAST_RANGE` 와의 차이 그 자체다.
    */
    if (order % 5 === 3) {
      return {
        ...shared,
        petConditionApplied,
        walkSafetyLevel: WALK_SAFETY_LEVEL.UNKNOWN,
        unavailableReasonCode: 'NO_FORECAST_AT_TIME',
        unavailableReason: '이 시각의 예보를 가져오지 못해 산책 위험도를 판정할 수 없습니다.',
      }
    }

    const grade = (['SAFE', 'CAUTION', 'DANGER'] as const)[order % 3] as
      'SAFE' | 'CAUTION' | 'DANGER'

    return {
      ...shared,
      petConditionApplied,
      walkSafetyLevel: WALK_SAFETY_LEVEL[grade],
      estimatedPavementCelsius: 30 + (order % 5),
      feelsLikeCelsius: 27 + (order % 5),
      temperature: 25 + (order % 5),
      unavailableReasonCode: null,
      unavailableReason: null,
    }
  })

  return { planId: plan.planId, planTitle: plan.title, petIds, items }
}

/**
 * 실내 대안.
 *
 * **좌표와 거리를 서버가 준다** (`PlanAlternativePlaceItem` 5필드). 거리는 그날 기준
 * 장소로부터의 하버사인 직선거리라 mock 도 같은 방식으로 잰다 — 주소·실내 여부는
 * 계약에 없어 화면이 `GET /places/{id}` 로 보강한다.
 */
function indoorAlternatives(representativePlaceId: string | null): PlanAlternativePlaceItem[] {
  const basis = MOCK_PLACES.find((place) => place.placeId === representativePlaceId) ?? null
  const basisLat = basis?.lat ?? null
  const basisLng = basis?.lng ?? null

  return (
    MOCK_PLACES
      // 좌표 없는 장소는 애초에 반경 검색에 걸리지 않는다 — 서버가 lat/lng 로 조회한다
      .filter((place) => place.indoor === true && place.lat !== null && place.lng !== null)
      .slice(0, 2)
      .map((place) => ({
        placeId: place.placeId,
        title: place.title,
        lat: place.lat as number,
        lng: place.lng as number,
        distanceMeters:
          basisLat === null || basisLng === null
            ? 0
            : Math.round(geoMeters(basisLat, basisLng, place.lat as number, place.lng as number)),
      }))
  )
}

/**
 * 백엔드 `GeoDistance.meters()` 의 복제본 — 하버사인.
 *
 * **FE 의 `haversineMeters`(`src/lib/geo/distance.ts`)를 부르지 않는다.** mock 은 서버
 * 역할이라 화면 코드에 기대면 안 되고, 지구 반지름도 서버 값(6_371_000)을 따른다
 * (FE 는 WGS84 평균 6_371_008.8 이라 미세하게 다르다).
 */
function geoMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const EARTH_RADIUS_M = 6_371_000
  const rad = (degrees: number) => (degrees * Math.PI) / 180

  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

// ─── 일자별 항목 일괄 교체 (#81) ──────────────────────────────────────────────

// `ITEM_TITLE_MAX` · `ITEM_MEMO_MAX` · `PLACE_TARGET_TYPES` · `KNOWN_PLACE_IDS` 는
// `POST /plans`(항목 동반 생성)가 이미 쓰고 있다. 같은 계약이므로 재사용한다

/** 백엔드 `PlanItemType` 에 있는 코드만 받는다 */
const ITEM_TYPE_CODES = new Set(Object.keys(ITEM_TYPE))

/**
 * 해당 일차의 항목을 통째로 교체한다. **부분 수정이 아니다** —
 * 빈 목록을 보내면 그 일차 항목이 모두 삭제된다.
 *
 * 백엔드 `PlanCommandProcessor.replaceDayItems` 의 순서를 그대로 따른다:
 * `containsDay` → `verifyPlaceTargets` → 삭제 → 재삽입. **순서가 중요하다** —
 * 장소 검증이 삭제보다 먼저라 `PLAN_004` 로 막히면 기존 항목이 그대로 남는다.
 */
function replaceDayItems(plan: MockPlan, rawDay: string, body: string | null): MockResult {
  // 경로의 day 도 @PathVariable 이다. **`long` 이 아니라 `int` 라 경계가 다르다** —
  // `2147483648` 은 planId 에서는 통과하고 day 에서는 400 이다 (dev 실측, #809)
  const boundDay = bindPathVariable('day', rawDay, 'int')
  if (typeof boundDay !== 'string') return boundDay

  const day = Number(boundDay)

  let parsed: { items?: unknown }
  try {
    parsed = body === null ? {} : (JSON.parse(body) as { items?: unknown })
  } catch {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }

  // `items` 가 없으면 서버는 List.of() 로 읽는다 (toCommands 의 null 처리)
  const raw = Array.isArray(parsed.items) ? (parsed.items as Record<string, unknown>[]) : []

  // Bean Validation 이 먼저 돈다 — 본문 각 항목의 @Min(1)/@NotBlank/@Size
  const errors = validateItems(raw)
  if (errors.length > 0) return failValidation(errors)

  // containsDay — 여행 기간 밖이면 PLAN_002
  if (day < 1 || day > totalDaysOf(plan)) {
    return fail(400, 'PLAN_002', '여행 기간을 벗어난 일자입니다.')
  }

  // verifyPlaceTargets — delisting 된 장소도 걸러낸다. **삭제보다 먼저다**
  const unknown = raw.some((item) => {
    const targetId = item.targetId
    if (typeof targetId !== 'string' || !PLACE_TARGET_TYPES.has(String(item.itemType))) return false
    return !KNOWN_PLACE_IDS.has(targetId)
  })
  if (unknown) {
    return fail(400, 'PLAN_004', '존재하지 않는 장소가 포함되어 있습니다.')
  }

  // 삭제 후 재삽입 — **planItemId 가 전부 새로 발급된다.** 서버와 같아야
  // "저장 성공 시 편집 상태를 통째로 버린다" 규칙을 화면이 실제로 검증할 수 있다
  const store = mockStore()
  plan.items = [
    ...plan.items.filter((item) => item.day !== day),
    ...raw.map((item, index) => toStoredItem(item, day, index, store)),
  ]

  return { status: 200, payload: ok(toDetail(plan)) }
}

function validateItems(raw: Record<string, unknown>[]): {
  code: string
  field: string
  message: string
}[] {
  const errors: { code: string; field: string; message: string }[] = []

  raw.forEach((item, index) => {
    const field = `items[${index}]`

    // @Min(1) — 서버가 경로값으로 덮어쓰지만 검증이 먼저 돈다
    if (typeof item.day !== 'number' || item.day < 1) {
      errors.push({
        code: 'PLAN_110',
        field: `${field}.day`,
        message: '일차는 1 이상이어야 합니다.',
      })
    }
    // @NotNull + enum 바인딩
    if (typeof item.itemType !== 'string' || !ITEM_TYPE_CODES.has(item.itemType)) {
      errors.push({
        code: 'PLAN_111',
        field: `${field}.itemType`,
        message: '항목 유형은 필수입니다.',
      })
    }
    // @NotBlank + @Size(max = 100)
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (title.length === 0) {
      errors.push({ code: 'PLAN_105', field: `${field}.title`, message: '항목 이름은 필수입니다.' })
    } else if (title.length > ITEM_TITLE_MAX) {
      errors.push({
        code: 'PLAN_106',
        field: `${field}.title`,
        message: '항목 이름은 100자 이하만 가능합니다.',
      })
    }
    // @Size(max = 500)
    if (typeof item.memo === 'string' && item.memo.length > ITEM_MEMO_MAX) {
      errors.push({
        code: 'PLAN_108',
        field: `${field}.memo`,
        message: '메모는 500자 이하만 가능합니다.',
      })
    }
  })

  return errors
}

function toStoredItem(
  item: Record<string, unknown>,
  day: number,
  sequence: number,
  store: ReturnType<typeof mockStore>,
): MockPlanItem {
  return {
    // 새로 발급한다 — 서버가 삭제 후 재삽입하기 때문이다
    planItemId: nextPlanItemId(store),
    day,
    // 서버는 본문의 sequence 를 그대로 쓴다. 화면이 0부터 다시 매겨 보낸다
    sequence: typeof item.sequence === 'number' ? item.sequence : sequence,
    itemType: String(item.itemType),
    targetId: typeof item.targetId === 'string' ? item.targetId : null,
    title: String(item.title),
    memo: typeof item.memo === 'string' ? item.memo : null,
    startTime: typeof item.startTime === 'string' ? item.startTime : null,
    /*
      **항상 `false` 다 — 이것이 계약의 핵심이다** (#124). 백엔드는 일괄 교체 때 항목을
      삭제 후 재삽입하므로 그 날의 방문 체크가 통째로 초기화된다. mock 이 체크를
      이어받으면 화면이 경고 문구로 말하는 사실을 로컬에서 검증할 수 없다.
    */
    visited: false,
  }
}

// ─── 여행 준비물 (#398 BE · #586 FE) ─────────────────────────────────────────

/** 본문 파싱. 깨진 JSON 은 `null` 이고 호출부가 `PLAN_100` 으로 돌려준다 */
function parseBody(body: string | null): Record<string, unknown> | null {
  try {
    return body === null ? {} : (JSON.parse(body) as Record<string, unknown>)
  } catch {
    return null
  }
}

/** 일정당 상한. 서버 `PLAN_013` 과 같은 값이어야 mock 이 더 느슨해지지 않는다 */
const PACKING_MAX = 50

const PACKING_SOURCE: Record<'AI' | 'USER', CodeNameMetadata> = {
  AI: { code: 'AI', name: 'AI', description: 'AI가 이 일정을 읽고 고른 항목입니다.' },
  USER: { code: 'USER', name: '직접 추가', description: '사용자가 직접 더한 항목입니다.' },
}

function toPacking(plan: MockPlan): PlanPackingListResponse {
  const items = plan.packingItems.map((item, index) => ({
    packingItemId: item.packingItemId,
    category: item.category,
    name: item.name,
    reason: item.reason,
    source: PACKING_SOURCE[item.source],
    checked: item.checked,
    // **저장 순서가 곧 표시 순서다** — 서버가 `sortOrder` 오름차순으로 내려 준다
    sortOrder: index,
  }))

  return {
    planId: plan.planId,
    items,
    totalCount: items.length,
    checkedCount: items.filter((item) => item.checked).length,
    // AI 항목이 하나도 없으면 null 이다 — 화면의 두 갈래가 이 값으로 갈린다
    generatedAt: plan.packingItems.some((item) => item.source === 'AI')
      ? plan.packingGeneratedAt
      : null,
  }
}

/** 이름 비교. **대소문자·앞뒤 공백을 무시한다** — 서버가 그렇게 판정한다 */
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * AI 결과 저장. **AI 항목만 교체하고 사용자 항목은 남긴다.**
 *
 * 같은 이름의 챙김 체크를 승계하고, 사용자 항목과 이름이 겹치는 AI 항목과 보낸 목록 안의
 * 중복은 버린다(첫 것만 남는다) — 전부 서버가 적어 둔 규칙이다.
 */
function savePacking(plan: MockPlan, body: string | null): MockResult {
  const parsed = parseBody(body)
  if (parsed === null) return fail(400, 'PLAN_100', '요청 본문을 읽을 수 없습니다.')

  const incoming = Array.isArray(parsed.items) ? (parsed.items as Record<string, unknown>[]) : null
  if (incoming === null) {
    return failValidation([
      { code: 'PLAN_116', field: 'items', message: '저장할 준비물 목록은 필수입니다.' },
    ])
  }

  const kept = plan.packingItems.filter((item) => item.source === 'USER')
  const checkedBefore = new Map(
    plan.packingItems.map((item) => [item.name.trim().toLowerCase(), item.checked]),
  )

  const next: MockPackingItem[] = []
  for (const raw of incoming) {
    const category = typeof raw.category === 'string' ? raw.category : ''
    const name = typeof raw.name === 'string' ? raw.name : ''
    if (category.trim() === '' || name.trim() === '') {
      return failValidation([
        { code: 'PLAN_117', field: 'items', message: '준비물 분류와 이름은 필수입니다.' },
      ])
    }
    // 사용자 항목·보낸 목록 안의 중복은 버린다
    if (kept.some((item) => sameName(item.name, name))) continue
    if (next.some((item) => sameName(item.name, name))) continue

    next.push({
      packingItemId: nextPackingItemId(mockStore()),
      category,
      name,
      reason: typeof raw.reason === 'string' && raw.reason.trim() !== '' ? raw.reason : null,
      source: 'AI',
      checked: checkedBefore.get(name.trim().toLowerCase()) ?? false,
    })
  }

  if (next.length + kept.length > PACKING_MAX) {
    return fail(400, 'PLAN_013', '준비물은 일정당 최대 50개까지 저장할 수 있습니다.')
  }

  plan.packingItems = [...next, ...kept]
  plan.packingGeneratedAt = next.length === 0 ? null : new Date().toISOString().slice(0, 19)

  return { status: 200, payload: ok(toPacking(plan)) }
}

/** 직접 추가. 중복 이름은 409 `PLAN_012`, 상한 초과는 400 `PLAN_013` 이다 */
function addPacking(plan: MockPlan, body: string | null): MockResult {
  const parsed = parseBody(body)
  if (parsed === null) return fail(400, 'PLAN_100', '요청 본문을 읽을 수 없습니다.')

  const category = typeof parsed.category === 'string' ? parsed.category.trim() : ''
  const name = typeof parsed.name === 'string' ? parsed.name.trim() : ''

  const errors: ValidationErrorItem[] = []
  if (category === '')
    errors.push({ code: 'PLAN_118', field: 'category', message: '준비물 분류는 필수입니다.' })
  if (name === '')
    errors.push({ code: 'PLAN_119', field: 'name', message: '준비물 이름은 필수입니다.' })
  if (errors.length > 0) return failValidation(errors)

  if (plan.packingItems.some((item) => sameName(item.name, name))) {
    return fail(409, 'PLAN_012', '이미 같은 이름의 준비물이 있습니다.')
  }
  if (plan.packingItems.length >= PACKING_MAX) {
    return fail(400, 'PLAN_013', '준비물은 일정당 최대 50개까지 저장할 수 있습니다.')
  }

  // 표시 순서는 기존 항목 맨 뒤로 붙는다 (서버 설명)
  plan.packingItems.push({
    packingItemId: nextPackingItemId(mockStore()),
    category,
    name,
    // **사용자 항목에는 이유가 없다** — 서버가 `reason` 을 받지 않는다
    reason: null,
    source: 'USER',
    checked: false,
  })

  return { status: 200, payload: ok(toPacking(plan)) }
}

/** 삭제. **AI 항목과 사용자 항목을 구분하지 않는다** — 둘 다 지울 수 있다 */
function removePackingItem(plan: MockPlan, rawItemId: string): MockResult {
  const packingItemId = bindPathVariable('packingItemId', rawItemId)
  if (typeof packingItemId !== 'string') return packingItemId

  const index = plan.packingItems.findIndex((item) => item.packingItemId === packingItemId)
  if (index === -1) return fail(404, 'PLAN_014', '존재하지 않는 준비물 항목입니다.')

  plan.packingItems.splice(index, 1)
  return { status: 200, payload: ok(null) }
}

/**
 * 챙김 체크. 응답이 `Response<Void>` 다 — 갱신된 목록을 돌려주지 않는다.
 *
 * **경로변수 판정이 본문 검증보다 앞이다** — 스프링은 인자를 푸는 단계에서 400 을 내고
 * 본문 검증은 그 뒤다. dev 실측(#803): 본문 없는 `PUT /plans/1/packing-items/xyz/checked`
 * 는 `PLAN_100` 이 아니라 `PLAN_124` 다.
 */
function setPackingChecked(plan: MockPlan, rawItemId: string, body: string | null): MockResult {
  const packingItemId = bindPathVariable('packingItemId', rawItemId)
  if (typeof packingItemId !== 'string') return packingItemId

  const parsed = parseBody(body)
  if (parsed === null || typeof parsed.checked !== 'boolean') {
    return failValidation([
      { code: 'PLAN_120', field: 'checked', message: '챙김 여부는 필수입니다.' },
    ])
  }

  const item = plan.packingItems.find((entry) => entry.packingItemId === packingItemId)
  if (item === undefined) return fail(404, 'PLAN_014', '존재하지 않는 준비물 항목입니다.')

  item.checked = parsed.checked
  return { status: 200, payload: ok(null) }
}

// ─── 여행 후기 (#614) ────────────────────────────────────────────────────────

const REVIEW_BODY_MAX = 2000
const REVIEW_COMMENT_MAX = 200
const REVIEW_ITEMS_MAX = 50

type ParsedReviewItem = {
  planItemId: string
  rating: number
  comment: string | null
}

type ParsedReview =
  MockResult | { ok: true; overallRating: number; body: string | null; items: ParsedReviewItem[] }

function requireCompleted(plan: MockPlan): MockResult | null {
  if (plan.status !== 'COMPLETED') {
    return fail(400, 'PLAN_016', '완료된 일정만 후기를 쓰거나 볼 수 있습니다.')
  }
  return null
}

function getReview(plan: MockPlan): MockResult {
  const blocked = requireCompleted(plan)
  if (blocked !== null) return blocked
  if (plan.review === null) return fail(404, 'PLAN_015', '작성한 여행 후기가 없습니다.')
  return { status: 200, payload: ok(toReview(plan.planId, plan.review)) }
}

function createReview(plan: MockPlan, body: string | null): MockResult {
  const blocked = requireCompleted(plan)
  if (blocked !== null) return blocked
  if (plan.review !== null) return fail(409, 'PLAN_017', '이미 이 일정의 후기를 작성했습니다.')

  const parsed = parseReviewUpsert(body)
  if (!('ok' in parsed)) return parsed

  const snapshots = resolveReviewItemsForCreate(plan, parsed.items)
  if (!('ok' in snapshots)) return snapshots

  const now = new Date().toISOString().slice(0, 19)
  const store = mockStore()
  plan.review = {
    reviewId: nextReviewId(store),
    overallRating: parsed.overallRating,
    body: parsed.body,
    items: snapshots.items,
    createdAt: now,
    updatedAt: now,
  }
  return { status: 200, payload: ok(toReview(plan.planId, plan.review)) }
}

function updateReview(plan: MockPlan, body: string | null): MockResult {
  const blocked = requireCompleted(plan)
  if (blocked !== null) return blocked
  if (plan.review === null) return fail(404, 'PLAN_015', '작성한 여행 후기가 없습니다.')

  const parsed = parseReviewUpsert(body)
  if (!('ok' in parsed)) return parsed

  const snapshots = resolveReviewItemsForUpdate(plan, plan.review.items, parsed.items)
  if (!('ok' in snapshots)) return snapshots

  plan.review = {
    ...plan.review,
    overallRating: parsed.overallRating,
    body: parsed.body,
    items: snapshots.items,
    updatedAt: new Date().toISOString().slice(0, 19),
  }
  return { status: 200, payload: ok(toReview(plan.planId, plan.review)) }
}

function parseReviewUpsert(body: string | null): ParsedReview {
  let parsed: Record<string, unknown>
  try {
    parsed = body === null ? {} : (JSON.parse(body) as Record<string, unknown>)
  } catch {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }

  const errors: ValidationErrorItem[] = []

  if (parsed.overallRating === undefined || parsed.overallRating === null) {
    errors.push({ code: 'PLAN_126', field: 'overallRating', message: '전체 만족도는 필수입니다.' })
  } else if (
    typeof parsed.overallRating !== 'number' ||
    !Number.isInteger(parsed.overallRating) ||
    parsed.overallRating < 1 ||
    parsed.overallRating > 5
  ) {
    errors.push({
      code: 'PLAN_127',
      field: 'overallRating',
      message: '전체 만족도는 1 이상 5 이하여야 합니다.',
    })
  }

  if (parsed.body !== undefined && parsed.body !== null) {
    if (typeof parsed.body !== 'string') {
      return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
    }
    if (parsed.body.length > REVIEW_BODY_MAX) {
      errors.push({
        code: 'PLAN_128',
        field: 'body',
        message: '후기 본문은 2000자 이하만 가능합니다.',
      })
    }
  }

  if (parsed.items === undefined || parsed.items === null) {
    errors.push({
      code: 'PLAN_129',
      field: 'items',
      message: '장소별 후기 목록은 필수입니다.',
    })
  } else if (!Array.isArray(parsed.items)) {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  } else if (parsed.items.length > REVIEW_ITEMS_MAX) {
    errors.push({
      code: 'PLAN_130',
      field: 'items',
      message: '장소별 후기는 한 번에 최대 50개까지 보낼 수 있습니다.',
    })
  }

  const items: ParsedReviewItem[] = []
  if (Array.isArray(parsed.items)) {
    parsed.items.forEach((raw, index) => {
      if (typeof raw !== 'object' || raw === null) return
      const entry = raw as Record<string, unknown>
      const planItemId = toPetIdString(entry.planItemId)
      if (!POSITIVE_ID_PATTERN.test(planItemId)) {
        errors.push({
          code: 'PLAN_131',
          field: `items[${index}].planItemId`,
          message: '일정 항목 아이디는 양수여야 합니다.',
        })
      }
      if (entry.rating === undefined || entry.rating === null) {
        errors.push({
          code: 'PLAN_132',
          field: `items[${index}].rating`,
          message: '장소 만족도는 필수입니다.',
        })
      } else if (
        typeof entry.rating !== 'number' ||
        !Number.isInteger(entry.rating) ||
        entry.rating < 1 ||
        entry.rating > 5
      ) {
        errors.push({
          code: 'PLAN_133',
          field: `items[${index}].rating`,
          message: '장소 만족도는 1 이상 5 이하여야 합니다.',
        })
      }
      if (entry.comment !== undefined && entry.comment !== null) {
        if (typeof entry.comment !== 'string') return
        if (entry.comment.length > REVIEW_COMMENT_MAX) {
          errors.push({
            code: 'PLAN_134',
            field: `items[${index}].comment`,
            message: '장소 한 줄 후기는 200자 이하만 가능합니다.',
          })
        }
      }
      items.push({
        planItemId,
        rating: typeof entry.rating === 'number' ? entry.rating : 0,
        comment:
          typeof entry.comment === 'string' && entry.comment.trim() !== '' ? entry.comment : null,
      })
    })
  }

  if (errors.length > 0) return failValidation(errors)

  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.planItemId)) {
      return fail(400, 'PLAN_020', '같은 일정 항목을 후기에 두 번 넣을 수 없습니다.')
    }
    seen.add(item.planItemId)
  }

  const text = typeof parsed.body === 'string' && parsed.body.trim() !== '' ? parsed.body : null

  return { ok: true, overallRating: parsed.overallRating as number, body: text, items }
}

function isEligiblePlaceVisit(item: MockPlanItem | undefined): item is MockPlanItem {
  return item !== undefined && PLACE_TARGET_TYPES.has(item.itemType) && item.visited
}

function resolveReviewItemsForCreate(
  plan: MockPlan,
  commands: ParsedReviewItem[],
): MockResult | { ok: true; items: MockPlanReviewItem[] } {
  const store = mockStore()
  const items: MockPlanReviewItem[] = []
  for (const command of commands) {
    const current = plan.items.find((item) => item.planItemId === command.planItemId)
    if (!isEligiblePlaceVisit(current)) {
      return fail(400, 'PLAN_018', '다녀온 장소 항목만 후기에 담을 수 있습니다.')
    }
    items.push({
      reviewItemId: nextReviewItemId(store),
      planItemId: current.planItemId,
      placeId: current.targetId,
      title: current.title,
      rating: command.rating,
      comment: command.comment,
    })
  }
  return { ok: true, items }
}

function resolveReviewItemsForUpdate(
  plan: MockPlan,
  previous: MockPlanReviewItem[],
  commands: ParsedReviewItem[],
): MockResult | { ok: true; items: MockPlanReviewItem[] } {
  const store = mockStore()
  const previousById = new Map(previous.map((item) => [item.planItemId, item]))
  const items: MockPlanReviewItem[] = []
  for (const command of commands) {
    const current = plan.items.find((item) => item.planItemId === command.planItemId)
    if (isEligiblePlaceVisit(current)) {
      items.push({
        reviewItemId: nextReviewItemId(store),
        planItemId: current.planItemId,
        placeId: current.targetId,
        title: current.title,
        rating: command.rating,
        comment: command.comment,
      })
      continue
    }
    const snapshot = previousById.get(command.planItemId)
    if (snapshot === undefined) {
      return fail(400, 'PLAN_018', '다녀온 장소 항목만 후기에 담을 수 있습니다.')
    }
    items.push({
      reviewItemId: nextReviewItemId(store),
      planItemId: snapshot.planItemId,
      placeId: snapshot.placeId,
      title: snapshot.title,
      rating: command.rating,
      comment: command.comment,
    })
  }
  return { ok: true, items }
}

function toReview(planId: string, review: NonNullable<MockPlan['review']>): PlanReviewResponse {
  const items: PlanReviewPlaceItem[] = review.items.map((item) => ({
    reviewItemId: item.reviewItemId,
    planItemId: item.planItemId,
    placeId: item.placeId,
    title: item.title,
    rating: item.rating,
    comment: item.comment,
  }))
  return {
    reviewId: review.reviewId,
    planId,
    overallRating: review.overallRating,
    body: review.body,
    items,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  }
}
