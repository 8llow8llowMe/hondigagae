/**
 * 달력의 칸 — `'YYYY-MM-DD'` 문자열 하나를 다루는 규칙의 **유일한 소유자**.
 *
 * 원래 이 규칙은 `lib/plan/date.ts` 안의 private `parseDay` 였다. 달력 UI 가 같은 규칙을
 * 필요로 하게 되면서 밖으로 꺼냈다 — 복사하면 **한쪽만 타임존 처리를 고치는 날**이 온다.
 */

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/**
 * `'YYYY-MM-DD'` 를 UTC 자정으로 읽는다. 못 읽으면 `null`.
 *
 * **로컬 타임존으로 읽지 않는다.** `new Date('2026-09-12')` 는 UTC 로 읽히고
 * `new Date('2026-09-12T00:00:00')` 는 로컬로 읽혀, 둘을 섞으면 KST 에서 요일이
 * 하루 밀린다. 여행 날짜는 시각이 아니라 달력의 칸이라 UTC 로 통일한다.
 */
export function parseDay(date: string): number | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (matched === null) return null

  const [, year, month, day] = matched as unknown as [string, string, string, string]
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day))

  // Date.UTC 는 2026-02-31 같은 값을 3월로 넘겨 버린다. 되돌려 비교해 걸러낸다
  const back = new Date(time)
  if (back.getUTCMonth() !== Number(month) - 1 || back.getUTCDate() !== Number(day)) return null

  return time
}

/** UTC 자정 epoch → `'YYYY-MM-DD'` */
export function toDayString(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

/** 같은 기준(UTC 자정)으로 오늘을 읽는다 */
export function todayUtc(today: Date): number {
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
}

/**
 * 그 시각이 **실행 환경의 시간대**에서 떨어지는 달력의 칸.
 *
 * 판정 함수가 이미 세운 `today: Date`(`todayFromDay` 의 로컬 정오)를 칸으로 되돌릴 때 쓴다.
 * **"지금" 의 오늘을 만들 때는 쓰지 않는다** — `todayDay(new Date())` 는 프로세스 · 브라우저
 * 시간대에 달린다. 서비스의 오늘은 `serviceTodayDay(new Date())` 다 (#1499 · #1507).
 */
export function todayDay(today: Date): string {
  return toDayString(todayUtc(today))
}

/**
 * 서비스의 시간대. 백엔드 "오늘" 의 기준(plan-service `Clock` 빈)과 같은 값이다.
 *
 * 백엔드는 `-Duser.timezone`(배포 환경변수 `TIME_ZONE`)에 기대지 않고 이 값을 직접 못박는다
 * (`backend/docs/services/plan-service.md`). 프런트도 같다 — 서버 페이지 · 클라이언트 모두
 * `serviceTodayDay` 로 이 시간대의 칸을 읽고, 운영 컨테이너 `TZ`(`${TIME_ZONE}`)에 기대지 않는다 (#1507).
 */
export const SERVICE_TIME_ZONE = 'Asia/Seoul'

const serviceDayFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: SERVICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * 서비스 시간대(서울)의 오늘을 달력의 칸으로 — **실행 환경의 시간대와 무관하다** (#1499).
 *
 * **"지금" 의 오늘은 언제나 이것으로 만든다** — 서버 페이지(#1507)와, 브라우저가 스스로 오늘을
 * 만들어야 할 때(`useToday`, #1499). `todayDay(new Date())` 는 실행 환경의 로컬 날짜라, 실행
 * 환경이 UTC 이고 KST 00–09시면 KST 기준 어제다 — 담기 시트가 그 값을 출발일 하한으로 써서 어제를
 * 고를 수 있었고, 서버 페이지는 컨테이너 `TZ` 가 서울이 아니면 같은 일이 났다. 다만 **서버가 렌더하는
 * 트리**는 하이드레이션 때문에 서버가 정한 칸을 내려받는 경로(`todayFromDay`)가 먼저다.
 *
 * 형식 문자열(`en-CA` 의 `YYYY-MM-DD`)에 기대지 않고 부분(`formatToParts`)을 읽는다 — 로케일
 * 데이터가 바뀌면 형식이 조용히 달라진다.
 */
export function serviceTodayDay(now: Date): string {
  const parts = serviceDayFormat.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

/**
 * 달력의 칸 → 그 날의 **로컬 정오** `Date`. 못 읽으면 `null`.
 *
 * `todayUtc()` 를 받는 함수들(`planPhaseOf` · `isPastPlan`)에 **서버가 정한 오늘**을 넘기기
 * 위한 것이다. 클라이언트 컴포넌트가 스스로 `new Date()` 를 부르면 SSR 과 하이드레이션이
 * 자정을 걸쳐 갈릴 수 있고, 그러면 같은 화면이 서버에서는 A 일정을, 브라우저에서는 B
 * 일정을 고른다 (`app/(main)/(home)/page.tsx` 의 `todayLabel` 이 서버에서 만들어지는 것과 같은 이유).
 *
 * **자정이 아니라 정오다.** `todayUtc()` 는 로컬 getter 로 날짜를 읽으므로, UTC 자정으로
 * 만든 Date 를 넘기면 UTC 보다 뒤진 타임존에서 하루 밀린다. 정오면 ±12시간 안에서 날짜가
 * 바뀌지 않는다.
 */
export function dayToLocalNoon(date: string): Date | null {
  if (parseDay(date) === null) return null

  const [year, month, day] = date.split('-') as [string, string, string]
  return new Date(Number(year), Number(month) - 1, Number(day), 12)
}

/**
 * 서버 페이지가 `serviceTodayDay(new Date())` 로 정해 내려보낸 오늘 → 판정 함수가 받는 `today: Date`.
 *
 * **오늘을 클라이언트로 넘길 때는 시각이 아니라 이 칸을 넘긴다** (#1490). 판정 함수는
 * `todayUtc()` 로 로컬 getter 를 읽으므로, 서버가 `new Date()` 를 시각 그대로 넘기면 **브라우저
 * 시간대가 날짜를 다시 정한다** — 브라우저가 UTC 이고 KST 00–09시면 홈은 `오늘 1일차`, 목록 ·
 * 상세는 `D-1` 로 갈렸다. 칸을 넘기고 로컬 정오로 세우면 어느 시간대에서 읽어도 서버의 칸이다.
 *
 * **형식이 깨진 값은 던진다.** 이 값은 서버가 `serviceTodayDay` 로 만든 것이라 깨질 수 없고, 깨졌다면
 * 호출부 계약이 바뀐 것이다. `new Date()` 로 메우면 이 이슈가 조용히 돌아오므로 경계(`error.tsx`)
 * 에 맡긴다. 형식이 불확실한 값은 `dayToLocalNoon` 으로 `null` 을 받아 처리한다.
 */
export function todayFromDay(todayIso: string): Date {
  const today = dayToLocalNoon(todayIso)
  if (today === null) throw new Error(`오늘은 'YYYY-MM-DD' 여야 한다: ${todayIso}`)
  return today
}

/** 요일 이름. 못 읽으면 `null` */
export function weekdayOf(date: string): string | null {
  const time = parseDay(date)
  if (time === null) return null
  return WEEKDAYS[new Date(time).getUTCDay()] ?? null
}

/**
 * 날짜 문자열 비교.
 *
 * **`'YYYY-MM-DD'` 는 사전순 = 시간순이라 문자열 비교로 충분하다.** 그래도 함수로 두는
 * 이유는 호출부가 그 사실을 모르고 `new Date()` 로 비교하기 시작하는 것을 막기 위해서다.
 * 형식이 아닌 값이 섞이면 조용히 틀리므로 여기서 형식을 확인한다.
 */
export function isDayBefore(a: string, b: string): boolean {
  if (parseDay(a) === null || parseDay(b) === null) return false
  return a < b
}

/**
 * `min`~`max` 안에 드는가. 경계는 포함이고, 빈 경계는 제한 없음이다.
 */
export function isDayWithin(date: string, min: string | null, max: string | null): boolean {
  if (parseDay(date) === null) return false
  if (min !== null && date < min) return false
  if (max !== null && date > max) return false
  return true
}
