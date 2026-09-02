'use client'

import { useState } from 'react'

import { todayDay } from '@/lib/date/day'

/**
 * 오늘(`'YYYY-MM-DD'`) — **클라이언트에서만 렌더되는 화면용**.
 *
 * 원칙은 `today` 를 서버 컴포넌트가 만들어 내려보내는 것이다 (`lib/plan/date.ts` 주석).
 * 클라이언트가 따로 `new Date()` 를 부르면 자정 근처에서 서버 렌더와 하이드레이션의
 * 값이 하루 갈린다.
 *
 * **그 위험이 없는 자리에만 쓴다.** 장소 상세의 `담기` 시트는 사용자가 열기 전까지
 * 렌더되지 않아(`BottomSheet` 가 닫힌 동안 `null`) 서버가 그린 적이 없는 트리다 —
 * 비교될 서버 출력 자체가 없으므로 어긋날 수 없다. 서버 페이지에서 내려보내려면 장소
 * 상세 전체에 prop 을 꿰야 하는데, 그 화면은 오늘 날짜와 아무 상관이 없다.
 *
 * 지연 초기화라 **마운트 시점에 한 번만** 읽는다. 렌더마다 다시 읽으면 같은 화면에서
 * 값이 바뀔 수 있다.
 */
export function useToday(): string {
  const [today] = useState(() => todayDay(new Date()))
  return today
}
