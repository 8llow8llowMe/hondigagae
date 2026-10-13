'use client'

import { useState } from 'react'

import { serviceTodayDay } from '@/lib/date/day'

/**
 * 서비스 시간대(서울)의 오늘(`'YYYY-MM-DD'`) — **클라이언트에서만 렌더되는 화면용**.
 *
 * 원칙은 `today` 를 서버 컴포넌트가 만들어 내려보내는 것이다 (`lib/plan/date.ts` 주석).
 * 클라이언트가 따로 `new Date()` 를 부르면 자정 근처에서 서버 렌더와 하이드레이션의
 * 값이 하루 갈린다.
 *
 * ### 사용 조건
 *
 * - **서버가 그린 적 없는 트리에만 쓴다.** 장소 상세 · 산책 코스의 `담기` 시트는 사용자가
 *   열기 전까지 렌더되지 않아(`BottomSheet` 가 닫힌 동안 `null`) 비교될 서버 출력 자체가 없다.
 *   서버가 렌더하는 트리라면 서버 페이지가 `todayDay(new Date())` 로 칸을 내리고 클라이언트가
 *   `todayFromDay` 로 세운다 (#1490).
 * - **값은 서울의 칸이다** (#1499). 브라우저 로컬 날짜(`todayDay(new Date())`)를 쓰면 브라우저가
 *   UTC 이고 KST 00–09시일 때 KST 기준 어제가 출발일 하한이 됐다. 서버 페이지(프로세스 시간대
 *   서울) · 백엔드(`Asia/Seoul` 고정 `Clock`)와 같은 기준이 되도록 `serviceTodayDay` 로 읽는다.
 * - **판정 함수에 `Date` 로 넘길 때는 `todayFromDay(useToday())` 로 세운다.** 판정 함수는 로컬
 *   getter 를 읽으므로 `new Date()` 를 그대로 넘기면 다시 브라우저 시간대가 날짜를 정한다.
 *
 * **시트에 서버 페이지의 오늘을 내려보내지 않은 이유** (#1499 재평가). 장소 상세는 판정용으로
 * 이미 서버의 `today` 를 받지만(#1476) 산책 코스는 받지 않아, 그쪽에 prop 을 새로 꿰야 한다.
 * 더 큰 이유는 **시점**이다 — 페이지의 오늘은 렌더한 순간에 굳는다. 23시대에 열어 둔 화면에서
 * 자정을 넘겨 시트를 열면 서버의 칸은 어제고, 그 값이 출발일 하한이 되면 이 이슈가 그대로
 * 돌아온다. 시트를 여는 순간 서울의 칸을 읽으면 그때의 서버 · 백엔드와 같은 날이다.
 *
 * 지연 초기화라 **마운트 시점에 한 번만** 읽는다. 렌더마다 다시 읽으면 같은 화면에서
 * 값이 바뀔 수 있다.
 */
export function useToday(): string {
  const [today] = useState(() => serviceTodayDay(new Date()))
  return today
}
