/**
 * 일정 상세의 일괄 교체 잠금 — 이슈 #1460 · #1488 · `일정상세-세부명세.md` D30-4.
 *
 * 담기 · 이동 추가 · 시각 · 메모 저장은 모두 그 일자 항목을 되싣는 저장이다. 잠금은 둘로 갈린다.
 *
 * - **저장(`busy`)은 일정 전체에서 하나씩이다.** 교체 응답은 일자가 아니라 **일정 상세 전체**이고
 *   호출부가 그대로 `setQueryData` 한다(재조회 없음). 다른 일자 저장 둘이 겹쳐 응답이 실행 순서와
 *   다르게 도착하면 늦게 온 옛 스냅숏이 캐시에서 다른 일자의 변경을 되돌리고, 그 캐시로 다음 저장을
 *   하면 서버에서도 지운다(F6 "담기 중 다른 담기 — 전부 잠근다").
 * - **편집 진입(`blocksEntry`)은 같은 일자만이다.** 진입은 쓰기가 아니라 그 일자 항목을 읽어 여는
 *   것이고, 다른 일자의 교체는 이 일자 항목 · id 를 바꾸지 않는다(E0 — 교체 단위가 일자다). 열린
 *   편집기의 저장은 `busy` 가 막는다.
 */
export type DayItemsSaveInFlight = {
  saving: boolean
  /** 그 저장이 건드리는 일자. 저장 중인데 모르면 `null` — 모든 일자를 막는다 */
  day: number | null
}

export type DayItemsLock = {
  busy: boolean
  blocksEntry: (day: number) => boolean
}

export function dayItemsLock(saves: DayItemsSaveInFlight[]): DayItemsLock {
  const inFlight = saves.filter((save) => save.saving)

  return {
    busy: inFlight.length > 0,
    blocksEntry: (day) => inFlight.some((save) => save.day === null || save.day === day),
  }
}
