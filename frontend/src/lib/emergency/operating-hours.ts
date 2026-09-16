import { messages } from '@/lib/messages'
import type { NearbyFacilityItem } from '@/types/emergency'

/**
 * 운영시간 원문을 **오늘 한 줄**로 줄인다 (#654 E-4).
 *
 * ── 두 번 기각된 파싱을 다시 여는 근거
 *
 * `types/emergency.ts` 의 `operatingHours` 주석과 `facility-row.tsx` 의 `FacilityHours`
 * 머리주석이 *"파싱해서 «오늘 19:00까지» 로 요약하지 않는다"* 를 두 번 못박았다 (#537 ·
 * #598). 근거는 dev 실측 서식의 불규칙함이었다:
 *
 *     월~화, 목~금,토 09:30~20:00, 일 09:30~14:00   ← 시각 없는 앞 조각, 수요일 없음
 *     월~금 09:00~21:00, 토 09:00~21:00, 법정공휴일 09:00~21:00   ← 일요일 항목 없음
 *
 * 그 규칙이 지키려던 것은 "파싱하지 않는다" 가 아니라 **"틀린 시간을 말하지 않는다"** 다.
 * 이 모듈은 규칙을 바꾸지 않고 **불변식으로 바꿔 세운다**:
 *
 * 1. **상태(진료중 / 영업 종료)는 파싱하지 않는다.** 서버 `openNow` 가 유일한 근거이고,
 *    화면에서는 머리의 `OpenStatus` 배지가 그것을 말한다. 이 줄은 **시각**만 맡는다.
 * 2. **읽지 못하면 아무 말도 하지 않는다.** 조각 하나라도 모르는 말이면 `null` 을
 *    돌려주고, 호출부는 예전 그대로 원문 두 줄을 그린다. 기본값이 침묵이다.
 * 3. **서버와 어긋나면 우리 읽기를 버린다.** 원문에서 읽은 "지금 열려 있나" 가 서버
 *    `openNow` 와 다르면 `null` 이다 — 수요일이 빠진 원문을 첫 줄로 잘못 읽어 닫힌
 *    병원을 "19:00까지" 라고 말하는 실패가 여기서 막힌다. `openNow === null`(서버도
 *    판정 못 함)이면 FE 도 판정하지 않는다.
 *
 * 그래서 이 요약은 새 사실을 만들지 않는다 — **서버가 이미 단정한 사실의 표현**이고,
 * 표현이 사실과 갈리는 순간 표현을 버린다.
 *
 * ── 남는 위험 — **가드가 검증하는 것은 개/폐 한 비트뿐이다**
 *
 * 불변식 3 은 `openNow` 와 우리 읽기의 **불리언**만 맞춰 본다. 그래서 **두 읽기가 같은
 * 개/폐를 내놓으면서 시각만 다른 경우**는 통과한다. 알려진 잔여 위험 둘:
 *
 * 1. **닫혔을 때의 다음 영업 시각.** 서버가 검증해 주지 않는다. 휴무 문구(`restDate`)를
 *    읽지 못하거나 **달 단위·격주 주기**면 아예 말하지 않는다 (`parseRestDays` ·
 *    `IRREGULAR_CYCLE`).
 * 2. **물려받은 시각의 마감.** 기각 근거 원문(`월~화, 목~금,토 09:30~20:00, …`)은
 *    **월요일 마감을 명시한 적이 없고**, 뒤에서 앞으로 물려받는 규칙(`parseWeeklyHours`)이
 *    토요일 값을 빌려온다. 월요일 15:00 · `openNow=true` 면 양쪽 다 "열림" 이라 가드를
 *    통과해 `오늘 20:00까지` 가 선다. 통상 독법상 타당한 추론이지만 **검증된 사실은 아니다.**
 *
 * 2번은 **감수한다** — 물려받기를 막으면 그 서식이 통째로 요약을 못 받고, 폴백이 같은
 * 원문이라 사용자가 잃는 것도 없다. 적어 두는 것은 "가드가 전부를 막는다" 고 읽히지
 * 않게 하기 위해서다. 시각까지 검증하려면 서버가 `todayOpenTo` 를 줘야 한다 (BE 후속).
 */

/** `Date.getDay()` 색인 — 0=일 … 6=토 */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** 한국식 주 시작(월요일)으로 늘어놓은 요일. 범위(`월~금`)를 펴는 순서다 */
const WEEK_ORDER: readonly WeekdayIndex[] = [1, 2, 3, 4, 5, 6, 0]

/** `getDay()` 색인 → 한 글자 요일. `WEEK_ORDER` 와 달리 색인 순서다 */
const WEEKDAY_CHAR: Record<WeekdayIndex, string> = {
  0: '일',
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
}

/** 하루 한 구간. `to` 가 1440 을 넘으면 자정을 넘긴 것이다 */
export type DayRange = {
  /** 자정부터의 분 */
  from: number
  /** 자정부터의 분. 자정을 넘기면 1440 보다 크다 */
  to: number
  fromLabel: string
  toLabel: string
}

export type WeeklyHours = Partial<Record<WeekdayIndex, DayRange>>

/**
 * 오늘 한 줄이 말하는 것. **상태는 없다** — 그것은 서버 `openNow` 와 `OpenStatus` 의 몫이다.
 */
export type TodayHours =
  | { kind: 'open24' }
  | { kind: 'openUntil'; until: string }
  | {
      kind: 'opensAt'
      /** 오늘부터 며칠 뒤인가. 0=오늘 · 1=내일 */
      dayOffset: number
      weekday: WeekdayIndex
      at: string
    }
  | { kind: 'closedToday' }

/** `summarizeTodayHours` 가 읽는 필드만 */
export type FacilityHoursFields = Pick<
  NearbyFacilityItem,
  'operatingHours' | 'operatingHoursKnown' | 'open24' | 'openNow' | 'restDate'
>

/** `09:00` · `24:00` → 자정부터의 분. 읽지 못하면 `null` */
function toMinutes(label: string): number | null {
  const matched = /^(\d{1,2}):([0-5]\d)$/.exec(label)
  if (matched === null) return null

  const hour = Number(matched[1])
  const minute = Number(matched[2])
  // `24:00` 은 하루의 끝이라 받는다. `24:30` 은 받지 않는다
  if (hour > 24 || (hour === 24 && minute !== 0)) return null

  return hour * 60 + minute
}

/**
 * **매주 반복이 아님을 뜻하는 수식어.** 하나라도 섞이면 읽기를 포기한다.
 *
 * 이 모듈이 다루는 단위는 **요일**이다 — `weekly[3]` 은 "수요일" 이지 "몇 번째 수요일" 이
 * 아니다. `둘째·넷째 수요일` 같은 문구를 요일 하나로 눌러 담으면 **첫째 수요일(여는 날)이
 * 휴무로 승격**되어, 한 시간 뒤 여는 병원을 "내일 09:00부터" 로 하루 미룬다. 달을 모르는
 * 자료구조로 달 단위 주기를 표현할 수 없으므로 **표현하지 않는다**(`parseRestDays`).
 *
 * **`openNow` 가드(불변식 3)가 이것을 잡지 못한다.** 여는 날 아침 08:00 이면 "휴무다" 와
 * "아니다" 두 읽기가 **둘 다 «지금 닫힘»** 이라 불리언이 일치한다 — 가드는 개/폐 한
 * 비트만 검증하고 다음 영업 시각은 검증하지 않는다 (머리주석 "남는 위험").
 *
 * `매주` 는 여기 없다 — 그것은 매주 반복이라 요일 하나로 정확히 옮겨진다.
 */
const IRREGULAR_CYCLE = /격주|매월|마지막|홀수|짝수|주차|번째|[첫둘셋넷섯]째|\d+\s*주/

/**
 * 요일 조각 — `월` · `월~금` · `연중무휴` · `법정공휴일`.
 *
 * `'skip'` 은 **요일로 옮길 수 없지만 원문을 포기할 이유도 아닌** 조각이다
 * (`법정공휴일`). 오늘이 공휴일인지 FE 가 알 수 없으므로 그 조각만 버린다 —
 * 조각 하나 때문에 통째로 포기하면 dev 에서 가장 흔한 서식이 요약을 받지 못한다.
 */
function parseDayChunk(text: string): WeekdayIndex[] | 'skip' | null {
  const compact = text.replace(/\s+/g, '')
  if (compact === '') return null
  // 주기 수식어가 붙으면 요일로 펼 수 없다 — `격주 무휴` 를 주 7일로 펴지 않는다
  if (IRREGULAR_CYCLE.test(compact)) return null
  /*
    **부분 문자열이 아니라 전체 일치다.** `includes('무휴')` 는 `격주무휴` 까지 잡아
    **격주 휴무를 연중무휴로 뒤집었다.** 위 `IRREGULAR_CYCLE` 이 그 갈래를 먼저 막지만,
    여기서도 전체 일치로 좁혀 둔다 — 수식어 목록이 모든 표기를 알 수는 없고, 그때
    안전한 실패는 "모르겠다(`null`)" 이지 "주 7일 영업" 이 아니다.
  */
  if (compact === '연중무휴' || compact === '무휴' || compact === '매일' || compact === '365일') {
    return [...WEEK_ORDER]
  }
  if (compact === '법정공휴일' || compact === '공휴일' || compact === '국가공휴일') return 'skip'

  const day = '([월화수목금토일])(?:요일)?'

  const range = new RegExp(`^${day}~${day}$`).exec(compact)
  if (range !== null) return expandRange(range[1] ?? '', range[2] ?? '')

  const single = new RegExp(`^${day}$`).exec(compact)
  if (single !== null) {
    const index = weekdayOf(single[1] ?? '')
    return index === null ? null : [index]
  }

  return null
}

function weekdayOf(char: string): WeekdayIndex | null {
  const found = WEEK_ORDER.find((index) => WEEKDAY_CHAR[index] === char)
  return found ?? null
}

/** `월~금` 을 편다. 한국식 주 순서(월 시작)로 걸어가며 한 바퀴를 넘지 않는다 */
function expandRange(startChar: string, endChar: string): WeekdayIndex[] | null {
  const start = weekdayOf(startChar)
  const end = weekdayOf(endChar)
  if (start === null || end === null) return null

  const startAt = WEEK_ORDER.indexOf(start)
  const endAt = WEEK_ORDER.indexOf(end)
  const days: WeekdayIndex[] = []

  for (let step = 0; step < WEEK_ORDER.length; step += 1) {
    const day = WEEK_ORDER[(startAt + step) % WEEK_ORDER.length]
    if (day === undefined) return null
    days.push(day)
    if ((startAt + step) % WEEK_ORDER.length === endAt) return days
  }

  return null
}

/** `… 09:30~20:00` 으로 끝나는 조각. 앞부분이 요일이다 */
const TIMED_SEGMENT = /^(.*?)\s*(\d{1,2}:\d{2})\s*[~\-–]\s*(\d{1,2}:\d{2})$/

/**
 * 운영시간 원문 → 요일별 구간. **모르는 말이 하나라도 섞이면 `null`** 이다.
 *
 * 쉼표로 끊고, **시각이 없는 조각은 뒤에 오는 조각의 시각을 이어받는다** —
 * `월~화, 목~금,토 09:30~20:00` 에서 앞 두 조각이 토요일의 시각을 함께 쓴다.
 */
export function parseWeeklyHours(text: string): WeeklyHours | null {
  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  if (parts.length === 0) return null

  const segments: { days: WeekdayIndex[] | 'skip'; range: DayRange | null }[] = []

  for (const part of parts) {
    const timed = TIMED_SEGMENT.exec(part)

    if (timed === null) {
      const days = parseDayChunk(part)
      if (days === null) return null
      segments.push({ days, range: null })
      continue
    }

    const from = toMinutes(timed[2] ?? '')
    const to = toMinutes(timed[3] ?? '')
    if (from === null || to === null) return null
    // 시작과 끝이 같다 — 0분인지 24시간인지 고를 근거가 없다
    if (from === to) return null

    const days = parseDayChunk(timed[1] ?? '')
    if (days === null) return null

    segments.push({
      days,
      range: {
        from,
        // 자정을 넘기는 구간(`22:00~02:00`)은 다음 날로 이어 읽는다
        to: to > from ? to : to + 24 * 60,
        fromLabel: timed[2] ?? '',
        toLabel: timed[3] ?? '',
      },
    })
  }

  const weekly: WeeklyHours = {}
  let carried: DayRange | null = null

  // 뒤에서 앞으로 — 시각 없는 조각이 **뒤** 조각의 시각을 이어받기 때문이다
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]
    if (segment === undefined) return null

    const range: DayRange | null = segment.range ?? carried
    if (range === null) return null
    carried = range

    if (segment.days === 'skip') continue

    for (const day of segment.days) {
      const existing = weekly[day]
      // 같은 요일에 다른 시각이 둘 — 어느 쪽이 오늘인지 고를 근거가 없다
      if (existing !== undefined && (existing.from !== range.from || existing.to !== range.to)) {
        return null
      }
      weekly[day] = range
    }
  }

  return Object.keys(weekly).length === 0 ? null : weekly
}

/**
 * 휴무 문구 → **매주 반복되는** 요일 집합. **읽지 못하면 `null`** 이다.
 *
 * 서버 `openNow` 가 오늘의 개폐를 검증해 주지만 **다음 영업일은 검증해 주지 않는다.**
 * `둘째·넷째 수요일` 처럼 요일 하나로 옮길 수 없는 문구에서 "내일 10:00" 을 만들면
 * 닫힌 병원 앞에 서게 되므로, 그런 문구는 요약 자체를 포기한다.
 *
 * ── **서수·주기 수식어를 먼저 본다** (리뷰에서 잡힌 결함)
 *
 * 요일 글자만 훑으면 `둘째·넷째 수요일` 이 `{수}` 가 되어 **매주 수요일 휴무**로 승격된다.
 * 실측: `월~금 09:00~18:00` · `둘째·넷째 수요일` · **첫째 수요일 08:00**(여는 날) ·
 * 서버 `openNow=false` → `내일 09:00부터`. **한 시간 뒤 여는 병원을 하루 뒤로 민다.**
 * `매월 셋째 토요일` 은 이틀 뒤(`월요일 09:00부터`)까지 밀렸다.
 *
 * 위 머리주석이 이미 약속한 동작인데 코드만 어긋나 있었다. `IRREGULAR_CYCLE` 이 그 약속을
 * 실행한다 — 달을 모르는 자료구조로 달 단위 주기를 표현할 수 없으므로 표현하지 않는다.
 *
 * `무휴` 도 **전체 일치**로 좁혔다. `includes('무휴')` 는 `격주 무휴` 를 "휴무 없음" 으로
 * 읽어 같은 계열의 거짓말을 만든다.
 */
export function parseRestDays(restDate: string | null): Set<WeekdayIndex> | null {
  if (restDate === null) return new Set()

  const text = restDate.trim()
  if (text === '') return new Set()
  // 달 단위·격주 주기는 요일 집합으로 옮길 수 없다 — 요일 글자를 읽기 **전에** 막는다
  if (IRREGULAR_CYCLE.test(text)) return null

  const compact = text.replace(/\s+/g, '')
  if (compact === '연중무휴' || compact === '무휴' || compact === '없음') return new Set()

  const days = new Set<WeekdayIndex>()
  for (const matched of text.matchAll(/([월화수목금토일])요일/g)) {
    const day = weekdayOf(matched[1] ?? '')
    if (day === null) return null
    days.add(day)
  }

  // 무슨 말인지 모르겠는 휴무 문구 — 다음 영업일을 약속하지 않는다
  return days.size === 0 ? null : days
}

/**
 * 오늘 한 줄. **읽지 못하거나 서버와 어긋나면 `null`** — 호출부가 원문을 그대로 그린다.
 */
export function summarizeTodayHours(facility: FacilityHoursFields, now: Date): TodayHours | null {
  if (!facility.operatingHoursKnown || facility.operatingHours === null) return null
  // 서버가 판정하지 못한 것을 FE 가 판정하지 않는다 — 머리 배지도 점선 "확인 필요" 를 단다
  if (facility.openNow === null) return null

  /*
    **24시간은 마감 시각을 말하지 않는다.** `연중무휴 24시간` 같은 원문은 아래 문법으로
    읽히지 않기도 하고, 읽힌다 해도 "24:00까지" 는 거짓이다.

    **여기 오는 `open24` 는 `openNow === true` 하나뿐이다.** 위에서 `null` 을 이미
    걷어냈고, `open24 && openNow === false`(24시간이라면서 지금 닫힘)는 **자료가 스스로
    모순된 상태**라 우리가 고를 근거가 없다 — `null` 로 떨어뜨려 원문을 그대로 보인다.
    그래서 `TodayHours['open24']` 는 **"오늘 하루 종일 연다"** 는 뜻이 확정된 갈래이고,
    화면은 그 사실을 `[24시간]` 배지로 이미 말하고 있다 (`todayHoursLabel`).
  */
  if (facility.open24) return facility.openNow ? { kind: 'open24' } : null

  const weekly = parseWeeklyHours(facility.operatingHours)
  if (weekly === null) return null

  const rest = parseRestDays(facility.restDate)
  if (rest === null) return null

  const today = now.getDay() as WeekdayIndex
  const minutes = now.getHours() * 60 + now.getMinutes()
  const summary = readToday(weekly, rest, today, minutes)

  /*
    **서버 `openNow` 와 어긋나면 버린다.** 이 한 줄이 파싱 금지 규칙을 불변식으로
    바꿔 세우는 자리다 (머리주석 3).
  */
  if ((summary.kind === 'openUntil') !== facility.openNow) return null

  return summary
}

function readToday(
  weekly: WeeklyHours,
  rest: Set<WeekdayIndex>,
  today: WeekdayIndex,
  minutes: number,
): TodayHours {
  const todayRange = rest.has(today) ? undefined : weekly[today]

  if (todayRange !== undefined && minutes >= todayRange.from && minutes < todayRange.to) {
    return { kind: 'openUntil', until: todayRange.toLabel }
  }

  /*
    **어제 밤부터 이어진 구간이 아직 안 끝났을 수 있다** (`22:00~02:00` 의 새벽 1시).
    이것을 빼먹으면 서버가 "진료중" 이라고 한 곳에서 요약이 어긋나 매번 원문으로 떨어진다.
  */
  const yesterday = ((today + 6) % 7) as WeekdayIndex
  const spill = rest.has(yesterday) ? undefined : weekly[yesterday]
  if (spill !== undefined && spill.to > 24 * 60 && minutes + 24 * 60 < spill.to) {
    return { kind: 'openUntil', until: spill.toLabel }
  }

  if (todayRange !== undefined && minutes < todayRange.from) {
    return { kind: 'opensAt', dayOffset: 0, weekday: today, at: todayRange.fromLabel }
  }

  // 오늘이 휴무거나 원문에 오늘이 없으면 다음 영업일까지 건너뛴다 (#654)
  for (let offset = 1; offset <= 7; offset += 1) {
    const weekday = ((today + offset) % 7) as WeekdayIndex
    if (rest.has(weekday)) continue

    const range = weekly[weekday]
    if (range === undefined) continue

    return { kind: 'opensAt', dayOffset: offset, weekday, at: range.fromLabel }
  }

  return { kind: 'closedToday' }
}

/**
 * 오늘 한 줄의 문구. **그릴 줄이 없으면 `null`** 이다.
 *
 * ── `open24` 는 줄을 갖지 않는다 — 머리 배지가 이미 말한다
 *
 * `제주24시동물병원` 행은 26px 짜리 머리 한 줄 안에서 같은 사실을 **세 번** 말하고
 * 있었다: 이름(`제주**24시**동물병원`) · 배지(`[24시간]`) · 오늘 줄(`24시간 운영`).
 *
 * **이 저장소가 이미 두 번 쓴 논리다.** 상태 절(`진료중 ·`)을 배지에 넘긴 것(D12-2)과
 * 펼치기를 걷은 것(D12-4 — *"접기 전과 후의 정보량이 같으면 그것은 접기가 아니다"*)이
 * 같은 판단이고, 여기서만 적용되지 않았다. `open24` 갈래에서 이 줄이 더하는 정보는
 * **0비트**다 — 다른 갈래처럼 시각을 말하지도 않는다(24시간에는 마감이 없다).
 *
 * **`null` 은 "읽지 못했다" 가 아니다.** 그쪽은 `summarizeTodayHours` 가 돌려주는
 * `null` 이고 호출부가 원문을 그린다. 이 `null` 은 **읽었는데 새로 말할 것이 없다**는
 * 뜻이라 호출부는 아무것도 그리지 않는다 (`FacilityHours`).
 */
export function todayHoursLabel(today: TodayHours): string | null {
  switch (today.kind) {
    case 'open24':
      return null
    case 'openUntil':
      return messages.emergency.hoursOpenUntil.replace('{time}', today.until)
    case 'opensAt':
      return messages.emergency.hoursOpensAt
        .replace('{day}', openDayLabel(today.dayOffset, today.weekday))
        .replace('{time}', today.at)
    case 'closedToday':
      return messages.emergency.hoursClosedToday
  }
}

/**
 * `오늘` · `내일` · `{요일}요일`.
 *
 * **이틀 뒤부터는 요일로 말한다** — "모레" 는 세어 보게 만들고, 사흘 뒤부터는 쓸 말도 없다.
 */
function openDayLabel(dayOffset: number, weekday: WeekdayIndex): string {
  if (dayOffset === 0) return messages.emergency.hoursDayToday
  if (dayOffset === 1) return messages.emergency.hoursDayTomorrow

  return messages.emergency.hoursDayWeekday.replace('{day}', WEEKDAY_CHAR[weekday])
}
