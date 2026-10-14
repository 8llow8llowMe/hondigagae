import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as code } from '@/test/source'

/**
 * 서버가 만드는 "오늘" — 이슈 #1396.
 *
 * `/ai-plans/new` · `/plans/new` 가 `new Date().toISOString().slice(0, 10)` 으로 오늘을 만들었다.
 * 그것은 **UTC 날짜**라 KST 00:00–09:00 에는 어제고, 달력의 `min` 으로 들어가 어제가 열렸다
 * (e2e `ai-plan-conditions.spec.ts` 가 08시대에만 실패했다). 기준이 둘이면 한쪽만 틀린다.
 *
 * **라우트의 오늘은 서울의 칸이다** (#1507). 예전에는 `todayDay(new Date())` — 프로세스 로컬
 * 날짜였고, 운영 컨테이너의 `TZ` 는 배포 환경변수(`TIME_ZONE`)라 코드상 서울이 아니었다. 백엔드
 * (`Asia/Seoul` 고정 `Clock`) · 클라이언트 `useToday`(#1499)와 같은 `serviceTodayDay(new Date())` 를 쓴다.
 *
 * `src/lib/date/day.ts` 의 `toDayString` 처럼 **UTC 자정 epoch 를 칸으로 바꾸는** 쓰임은 맞다 —
 * 이 검사는 라우트 파일(`app/**`)만 본다. 라우트가 오늘을 직접 만들 일은 `serviceTodayDay` 하나뿐이다.
 */
const APP_DIR = join(process.cwd(), 'app')

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return routeFiles(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('라우트의 오늘은 serviceTodayDay 하나다 (#1396 · #1507)', () => {
  it('어느 라우트도 toISOString 으로 날짜를 자르지 않는다 — UTC 라 KST 오전 9시 전에 어제다', () => {
    const offenders = routeFiles(APP_DIR)
      .map((path) => relative(process.cwd(), path))
      .filter((path) => /toISOString\(\)\.slice\(0,\s*10\)/.test(code(path)))

    expect(offenders).toEqual([])
  })

  it('어느 라우트도 todayDay 로 오늘을 만들지 않는다 — 프로세스 시간대를 따라 서울이 아닐 수 있다 (#1507)', () => {
    const offenders = routeFiles(APP_DIR)
      .map((path) => relative(process.cwd(), path))
      .filter((path) => /\btodayDay\(/.test(code(path)))

    expect(offenders).toEqual([])
  })

  it.each(['app/(main)/ai-plans/new/page.tsx', 'app/(main)/plans/new/page.tsx'])(
    '%s 는 달력의 오늘을 serviceTodayDay(new Date()) 로 만든다',
    (page) => {
      expect(code(page)).toContain('const today = serviceTodayDay(new Date())')
    },
  )
})
