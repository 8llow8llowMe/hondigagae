import type { PlaceSuitabilityResponse, SuitabilityReasonItem } from '@/types/insight'

/**
 * 근거를 감점과 정보성으로 나눈다 — 홈-세부명세 D4-1.
 *
 * `scoreDelta` 가 음수면 감점, `0` 이면 정보성이다.
 * **서버 순서를 유지한다.** `reasons` 는 점수 영향이 큰 순서로 오고, 그 순서가 곧 중요도다.
 *
 * **숫자를 화면에 노출하지 않는다** (D8-2). 산식이 공개되지 않아 "-27" 을 설명할 수 없다.
 * 이 함수는 부호만 읽고 값은 버린다.
 */
export function splitReasons(reasons: SuitabilityReasonItem[]): {
  penalties: SuitabilityReasonItem[]
  informational: SuitabilityReasonItem[]
} {
  const penalties: SuitabilityReasonItem[] = []
  const informational: SuitabilityReasonItem[] = []

  for (const reason of reasons) {
    // 양수는 계약상 오지 않지만, 오더라도 감점이 아니므로 정보성으로 둔다
    if (reason.scoreDelta < 0) penalties.push(reason)
    else informational.push(reason)
  }

  return { penalties, informational }
}

/**
 * 판정 기준이 될 장소를 고른다 — 공통명세 S5-1 (선택지 A 채택).
 *
 * 최근 본 장소 → 다가오는 일정의 첫 장소 → **대표 지점** → `null`.
 *
 * **셋째 단이 첫 방문자를 받는다** (홈-첫방문-판정-세부명세 D3-1). 예전에는 앞의 둘이
 * 없으면 `null` 이었고 호출부가 판정 섹션을 통째로 빼 버렸다 — 첫 방문 · 새 기기 ·
 * 시크릿 모드에서 서비스의 첫 문장("지금 가도 되나")이 홈에 없었다는 뜻이다. 이제
 * `DEFAULT_BASIS_PLACE_ID` 로 떨어지고, 화면은 그것이 대표 지점임을 캡션으로 밝힌다.
 *
 * **`null` 이 여전히 나온다.** 셋째 인자를 생략한 호출부(기존 시그니처)와, 대표 지점
 * 자체가 404 라 호출부가 `null` 을 넘기는 경우다 (D5-3). 그때는 예전처럼 미렌더다.
 *
 * BE 가 홈 요약 API 를 주면(S6-1) 이 함수와 호출부만 바뀐다.
 */
export function resolveBasisPlaceId(
  recentPlaceId: string | null,
  planFirstPlaceId: string | null,
  defaultPlaceId: string | null = null,
): string | null {
  if (recentPlaceId !== null && recentPlaceId !== '') return recentPlaceId
  if (planFirstPlaceId !== null && planFirstPlaceId !== '') return planFirstPlaceId
  if (defaultPlaceId !== null && defaultPlaceId !== '') return defaultPlaceId

  return null
}

/**
 * 적합도를 조회할 장소를 상위 N개만 고른다 — 공통명세 S5-2 (선택지 A, N=3).
 *
 * 목록 전체에 `GET /places/{id}/suitability` 를 부르면 N+1 이 된다.
 *
 * **그래서 "적합도 순" 이라고 쓸 수 없다** (D8-1). 3장을 뽑은 뒤 그 3장만 정렬한 것이라
 * 전체 정렬이 아니다. 이 함수는 목록 순서를 바꾸지 않는다.
 */
export function pickTopPlaces<T>(places: T[], limit: number): T[] {
  if (limit <= 0) return []

  return places.slice(0, limit)
}

/** 목록 캡션이 말할 수 있는 축의 조합 — `messages.home.sortNote` 의 키다 */
export type AppliedFactors = 'weatherCongestion' | 'weather' | 'congestion' | 'none'

/**
 * 적합도 목록 캡션이 무엇을 "반영" 이라고 말해도 되는지 (홈-세부명세 D8-1).
 *
 * **화면이 짐작하지 않는다.** 응답의 `weatherApplied` · `congestionApplied` 가
 * *"그 장소에 연결된 예측 데이터가 있었는가"* 를 이미 답한다. 골든타임이
 * `forecastCoverage` 를 그대로 말하는 것과 같은 축이다.
 *
 * 예전에는 `'오늘 날씨와 혼잡도 반영'` 이 **고정 문구**였다. 그 결과 캡션 바로 아래에
 * 장소 세 장이 전부 `혼잡도 정보 없음` 배지를 달고 서 있는 화면이 나갔다 — 같은 눈높이에서
 * 캡션과 배지가 서로를 부정하면 사용자는 둘 다 믿지 않는다.
 *
 * **`some` 이다, `every` 가 아니다.** 세 장 중 하나에만 혼잡도가 붙어도 그 한 장의 점수에는
 * 실제로 반영됐다. 전부에 붙어야 말할 수 있다고 하면 이번에는 **반영된 것을 안 반영했다고**
 * 말하게 된다 — 모르는 것을 나쁘게 말하지 않는 규칙의 반대 방향 실수다.
 *
 * 조회 전(빈 배열)에는 `'none'` 이다. 캡션을 그리지 않으므로 로딩 중에 문구가 바뀌었다가
 * 되돌아가는 깜빡임이 없다.
 */
export function appliedFactorsOf(loaded: PlaceSuitabilityResponse[]): AppliedFactors {
  const weather = loaded.some((data) => data.weatherApplied)
  const congestion = loaded.some((data) => data.congestionApplied)

  if (weather && congestion) return 'weatherCongestion'
  if (weather) return 'weather'
  if (congestion) return 'congestion'
  return 'none'
}

/**
 * 로드된 카드 **전부**에 있는 근거 문장을 화면의 전제로 떼어낸다 — #304.
 *
 * 날씨는 장소별 근거가 아니다. 같은 날 같은 시군구면 세 장소에 똑같은 문장이 붙는데,
 * 장소별 근거인 척 반복되면서 세 장소의 실제 차이(동반 가능 여부 · 실내/야외)가 같은
 * 문장 아래 묻힌다. 실측(1265×900)에서 `풍랑 주의보 발효 중입니다…` 한 문장이 좌측
 * 판정 1번 + 카드 3장 = **4번** 서 있었다.
 *
 * **근거 코드를 나열하지 않는다.** `WEATHER_WARNING_ACTIVE` 같은 코드로 걸러 두면 서버가
 * 코드를 하나 더 낼 때 조용히 새어 나온다 (`frontend/CLAUDE.md` — 한국어 매핑 테이블 금지와
 * 같은 이유다). 판단 기준은 **화면에 실제로 보이는 것**, 즉 `description` 이 겹치는가다.
 *
 * **`code` 가 아니라 `description` 으로 견준다.** 같은 코드라도 장소 이름이 섞이면 문장이
 * 갈리고, 그때는 장소별 근거가 맞다. 반대로 코드가 달라도 문장이 같으면 사용자에게는
 * 같은 말이 두 번 보이는 것이다.
 *
 * **한 장뿐이면 전제가 없다.** "전부에 있다" 가 "그 한 장에 있다" 와 같아져, 유일한 카드의
 * 근거를 통째로 걷어내게 된다.
 *
 * 순서는 첫 카드의 순서를 따른다 — `reasons` 는 영향이 큰 순서로 오고 그 순서가 곧 중요도다.
 */
export function splitSharedReasons(reasonsByPlace: readonly SuitabilityReasonItem[][]): {
  /** 전 카드 공통 문장. 호출부가 목록 위에 **한 번만** 적는다 */
  shared: SuitabilityReasonItem[]
  /** 공통 문장을 뺀 카드별 근거. 입력과 같은 순서·같은 길이다 */
  perPlace: SuitabilityReasonItem[][]
} {
  const first = reasonsByPlace[0]

  if (reasonsByPlace.length < 2 || first === undefined) {
    return { shared: [], perPlace: reasonsByPlace.map((reasons) => [...reasons]) }
  }

  const others = reasonsByPlace
    .slice(1)
    .map((reasons) => new Set(reasons.map((r) => r.description)))

  const sharedDescriptions = new Set<string>()
  const shared: SuitabilityReasonItem[] = []

  for (const reason of first) {
    // 한 카드 안에 같은 문장이 두 번 와도 전제는 한 줄이다
    if (sharedDescriptions.has(reason.description)) continue
    if (!others.every((set) => set.has(reason.description))) continue

    sharedDescriptions.add(reason.description)
    shared.push(reason)
  }

  return {
    shared,
    perPlace: reasonsByPlace.map((reasons) =>
      reasons.filter((reason) => !sharedDescriptions.has(reason.description)),
    ),
  }
}
