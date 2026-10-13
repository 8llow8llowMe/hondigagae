import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { useToday } from '@/lib/date/use-today'

/*
  **#1499.** 담기 시트의 출발일 하한이 이 hook 의 값이다. 브라우저가 UTC 이고 KST 00–09시면
  브라우저 로컬 날짜는 KST 기준 어제라, 어제를 출발일로 고를 수 있었다. 시간대는 `day.test.ts` 의
  #1396 · #1490 묶음과 같이 테스트 안에서 `process.env.TZ` 로 고정한다.
*/
function TodayProbe() {
  return createElement('span', null, useToday())
}

describe('useToday (#1499)', () => {
  const originalTz = process.env.TZ
  afterEach(() => {
    process.env.TZ = originalTz
    vi.useRealTimers()
  })

  it('UTC 브라우저에서 KST 새벽에 열어도 KST 의 오늘이다', () => {
    process.env.TZ = 'UTC'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:30:00+09:00'))

    expect(renderToStaticMarkup(createElement(TodayProbe))).toBe('<span>2026-10-15</span>')
  })
})
