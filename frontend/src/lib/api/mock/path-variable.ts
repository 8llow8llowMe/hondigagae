import type { MockResult } from '@/lib/api/mock/auth-data'

/**
 * `@PathVariable` 바인딩 — **도메인이 달라도 서버는 한 자리에서 만든다.**
 *
 * 각 서비스의 `ExceptionHandler` 가 전부 같은 줄을 부른다:
 * `ValidationErrorSupport.toResponse(MethodArgumentTypeMismatchException, <DOMAIN>_113)`.
 * 그래서 문구·`fieldErrors`·판정식이 도메인을 가리지 않고 같고, **코드만 다르다**.
 * 목도 한 곳에서 내야 도메인마다 갈리지 않는다 (#813).
 *
 * | 도메인      | 코드              | 목 호출부            |
 * | ----------- | ----------------- | -------------------- |
 * | 일정        | `PLAN_124`        | `plan-data.ts`       |
 * | 장소 상세   | `PLACE_113`       | `index.ts`           |
 * | 장소 인사이트 | `INSIGHT_113`   | `index.ts`           |
 * | 산책 코스   | `WALKCOURSE_113`  | `walk-course-data.ts` |
 * | 즐겨찾기    | `FAVORITE_113`    | `favorite-data.ts`   |
 * | 반려견      | `PET_113`         | `pet-data.ts`        |
 *
 * 일정만 `PLAN_124` 인 것은 `PLAN_1xx` 대역이 먼저 차서 프레임워크 공통 2종이 대역 끝으로
 * 밀렸기 때문이다 (`backend/docs/coding-conventions.md` §8-2).
 */

/** `@PathVariable` 의 자바 타입. 일정의 `day` 만 `int` 고 나머지 id 는 전부 `long` 이다 */
export type JavaIntegral = 'long' | 'int'

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
 * **정규화한 값을 돌려주는 이유**: 서버는 `' 1'` 을 `1` 로 풀어 **1번 자원을 찾는다**.
 * 목이 원문으로 조회하면 같은 주소가 404 로 갈린다.
 *
 * 남는 차이 하나: 여기 `\s` 는 자바 `Character.isWhitespace` 와 유니코드 경계가 조금
 * 다르다(예: ` `). 경로에 그 문자가 오는 일이 없어 쫓지 않는다.
 */
export function decodeIntegral(rawValue: string, type: JavaIntegral = 'long'): string | null {
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
 * 바인딩 실패 응답. **문구가 필드명을 끼워 다시 만들어진다** — 코드만 도메인 것으로
 * 바꾸고 문구를 고정해 두면 여전히 서버와 어긋난다.
 *
 * ```text
 * GET /api/v1/places/abc → 400
 * {"resultCode":"PLACE_113","resultMessage":"placeId 파라미터 형식이 올바르지 않습니다.",
 *  "fieldErrors":[{"code":"PLACE_113","field":"placeId","message":"placeId 파라미터 형식이 …"}]}
 * ```
 *
 * 헤더와 항목에 **같은 코드**를 싣는다 — 도메인 목의 `failValidation`(헤더는 `_100`,
 * 개별 코드는 항목에만) 모양이 아니다.
 */
export function pathVariableTypeError(code: string, field: string): MockResult {
  const message = `${field} 파라미터 형식이 올바르지 않습니다.`
  return {
    status: 400,
    payload: {
      dataHeader: {
        success: false,
        resultCode: code,
        resultMessage: message,
        fieldErrors: [{ code, field, message }],
      },
      dataBody: null,
    },
  }
}

/**
 * `@PathVariable` 바인딩. 통과하면 **정규화된 값**, 실패하면 400 이다.
 *
 * 호출부는 돌려받은 값으로 조회해야 한다 — 원문으로 찾으면 `' 1'` 이 서버에서는 찾히고
 * 목에서는 404 가 된다.
 */
export function bindPathVariable(
  code: string,
  field: string,
  rawValue: string,
  type: JavaIntegral = 'long',
): string | MockResult {
  const bound = decodeIntegral(rawValue, type)
  if (bound !== null) return bound

  return pathVariableTypeError(code, field)
}
