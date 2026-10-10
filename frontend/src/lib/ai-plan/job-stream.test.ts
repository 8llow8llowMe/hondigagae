import { describe, expect, it } from 'vitest'

import {
  isTerminalJob,
  JOB_STREAM_EVENT,
  jobProgressRank,
  mergeJobUpdate,
  parseJobEvent,
} from '@/lib/ai-plan/job-stream'
import { aiPlanJob } from '@/test/fixtures/ai-plan'
import type { AiPlanJob } from '@/types/ai-plan'

/** 이 파일이 보는 것은 상태 전이라 조건은 쓰이지 않는다 (#498) */
function job(code: string): AiPlanJob {
  return aiPlanJob(code)
}

/** 단계를 밟고 있는 `RUNNING` — `stepOrder` 가 null 이면 단계에 들어가기 전이다 */
function running(stepOrder: number | null, stepStartedAt: string | null = null): AiPlanJob {
  return aiPlanJob('RUNNING', { stepOrder, stepStartedAt })
}

describe('JOB_STREAM_EVENT', () => {
  /*
    백엔드 `AiPlanJobSseStreamer.EVENT_NAME` 과 한 글자라도 다르면 `addEventListener` 가
    아무것도 받지 못하고 화면이 영원히 대기한다. **이름을 바꾸려면 백엔드부터 본다.**
  */
  it('백엔드 이벤트 이름과 같다', () => {
    expect(JOB_STREAM_EVENT).toBe('job-update')
  })
})

describe('parseJobEvent', () => {
  it('이벤트 data 를 작업으로 읽는다', () => {
    const parsed = parseJobEvent(JSON.stringify(job('RUNNING')))

    expect(parsed?.jobId).toBe('job-1')
  })

  /*
    **공통 래퍼가 없다.** 컨트롤러 설명이 "이벤트 data 는 작업 상태 조회 응답의 dataBody 와
    동일한 JSON" 이라고 못박고 있다 — `dataHeader` 를 기대하고 읽으면 안 된다.
  */
  it('dataHeader 봉투를 기대하지 않는다', () => {
    const parsed = parseJobEvent(JSON.stringify(job('COMPLETED')))

    expect(parsed).not.toBeNull()
    expect(parsed).not.toHaveProperty('dataHeader')
  })

  it('깨진 JSON 은 던지지 않고 null 이다', () => {
    expect(parseJobEvent('{')).toBeNull()
    expect(parseJobEvent('')).toBeNull()
  })

  it('작업 모양이 아니면 null 이다', () => {
    expect(parseJobEvent('null')).toBeNull()
    expect(parseJobEvent('"RUNNING"')).toBeNull()
    expect(parseJobEvent('{"jobId":"job-1"}')).toBeNull()
  })

  it('하트비트 코멘트가 새어 들어와도 죽지 않는다', () => {
    expect(parseJobEvent('ping')).toBeNull()
  })
})

describe('isTerminalJob', () => {
  /*
    **닫지 않으면 무한 재구독이다.** 서버가 종결 후 연결을 닫고 `EventSource` 는 그것을
    자동 재연결 대상으로 본다.
  */
  it('완료·실패에서 닫는다', () => {
    expect(isTerminalJob(job('COMPLETED'))).toBe(true)
    expect(isTerminalJob(job('FAILED'))).toBe(true)
  })

  /*
    **취소도 종결이다** (#250). 백엔드 `AiPlanJobStatus.isTerminal()` 이 `CANCELED` 를
    포함하고 그 순간 `complete()` 로 닫는다 — 여기서 빠지면 취소한 작업에서 정확히
    무한 재구독이 돈다.
  */
  it('취소에서도 닫는다', () => {
    expect(isTerminalJob(job('CANCELED'))).toBe(true)
  })

  it('진행 중에는 열어 둔다', () => {
    expect(isTerminalJob(job('PENDING'))).toBe(false)
    expect(isTerminalJob(job('RUNNING'))).toBe(false)
    expect(isTerminalJob(null)).toBe(false)
  })
})

describe('mergeJobUpdate', () => {
  /*
    SSE 와 폴링이 같은 캐시에 쓴다. 순서가 엇갈려 완료된 화면이 대기 화면으로 되돌아가는
    것을 막는 것이 이 함수의 유일한 일이다.
  */
  it('종결 상태를 진행 중으로 되돌리지 않는다', () => {
    expect(mergeJobUpdate(job('COMPLETED'), job('PENDING')).status).toMatchObject({
      code: 'COMPLETED',
    })
    expect(mergeJobUpdate(job('FAILED'), job('RUNNING')).status).toMatchObject({ code: 'FAILED' })
  })

  it('진행 중 → 종결은 반영한다', () => {
    expect(mergeJobUpdate(job('RUNNING'), job('COMPLETED')).status).toMatchObject({
      code: 'COMPLETED',
    })
  })

  it('앞으로 가는 진행 중 갱신은 쓴다', () => {
    expect(mergeJobUpdate(job('PENDING'), job('RUNNING')).status).toMatchObject({
      code: 'RUNNING',
    })
    expect(mergeJobUpdate(running(null), running(1)).stepOrder).toBe(1)
    expect(mergeJobUpdate(running(3), running(4)).stepOrder).toBe(4)
  })

  /*
    **원인 재현 (#1057)** — 하루 다시 만들기가 `3/4 · 날씨 전망 반영` 에 40초 머물던 것. SSE 가
    `DRAFTING`(4) 을 넣은 뒤 그보다 먼저 떠난 조회 응답(`WEATHER`, 3)이 도착해 덮었고, SSE 는 열려
    있어 30초 안전 폴링이 와서야 복구됐다. **한 작업 안에서 단계는 앞으로만 간다** — 줄어드는
    쪽이 항상 늦게 온 옛 값이다.
  */
  it('진행 중 단계가 줄어드는 갱신을 버린다', () => {
    const drafting = running(4)
    expect(mergeJobUpdate(drafting, running(3))).toBe(drafting)
  })

  it('RUNNING → PENDING 역행을 버린다 — 단계 전 RUNNING 도 PENDING 보다 앞이다', () => {
    const started = running(null)
    expect(mergeJobUpdate(started, job('PENDING'))).toBe(started)
    expect(mergeJobUpdate(running(2), job('PENDING')).stepOrder).toBe(2)
  })

  it('단계를 밟은 뒤 단계 없는 RUNNING 이 와도 되돌리지 않는다', () => {
    expect(mergeJobUpdate(running(2), running(null)).stepOrder).toBe(2)
  })

  // 같은 단계의 다시 보낸 값(하트비트 재확인 · 안전 폴링)은 새 값이 이긴다 — 버릴 이유가 없다
  it('같은 순위면 새 값을 쓴다', () => {
    const later = running(4, '2026-09-30T14:03:12.345+09:00')
    expect(mergeJobUpdate(running(4), later)).toBe(later)
  })

  /*
    **모르는 상태는 가로막지 않는다.** 순위를 매길 수 없는 값을 "낮다" 로 읽으면 서버가 상태를
    늘렸을 때 화면이 영영 옛 값에 머문다 — 막는 것보다 한 번 틀리게 그리는 쪽이 낫다.
  */
  it('순위를 모르는 상태는 새 값을 쓴다', () => {
    expect(mergeJobUpdate(running(4), job('ARCHIVED')).status).toMatchObject({ code: 'ARCHIVED' })
    expect(mergeJobUpdate(job('ARCHIVED'), job('PENDING')).status).toMatchObject({
      code: 'PENDING',
    })
  })

  it('캐시가 비어 있으면 새 값을 쓴다', () => {
    expect(mergeJobUpdate(undefined, job('PENDING')).status).toMatchObject({ code: 'PENDING' })
  })
})

/*
  백엔드 `AiPlanJobSseStreamer` 의 단조 가드와 **같은 순서**다 — PENDING < 단계 전 RUNNING <
  `stepOrder` 1..n < 종결 (`backend/docs/services/ai-service.md` "단조 가드"). 서버가 한 연결 안에서
  지키는 것을 화면은 두 출처(SSE · 조회)를 합칠 때 지킨다.
*/
describe('jobProgressRank', () => {
  it('PENDING < 단계 전 RUNNING < 단계 1..n < 종결', () => {
    const ranks = [
      job('PENDING'),
      running(null),
      running(1),
      running(2),
      running(4),
      job('COMPLETED'),
    ].map(jobProgressRank)

    expect(ranks).toEqual([...ranks].sort((a, b) => (a ?? 0) - (b ?? 0)))
    expect(new Set(ranks).size).toBe(ranks.length)
  })

  it('종결 셋은 단계와 무관하게 같은 순위다', () => {
    const terminal = { ...job('FAILED'), stepOrder: 2 }
    expect(jobProgressRank(terminal)).toBe(jobProgressRank(job('COMPLETED')))
    expect(jobProgressRank(job('CANCELED'))).toBe(jobProgressRank(job('COMPLETED')))
  })

  // 계약보다 앞선 서버는 `stepOrder` 를 싣지 않는다 — `NaN` 이 비교를 망치지 않게 단계 전으로 읽는다
  it('stepOrder 가 없거나 이상하면 단계 전 RUNNING 이다', () => {
    const bare = { ...job('RUNNING'), stepOrder: undefined } as unknown as AiPlanJob
    expect(jobProgressRank(bare)).toBe(jobProgressRank(running(null)))
    expect(jobProgressRank(running(0))).toBe(jobProgressRank(running(null)))
  })

  it('모르는 상태는 순위가 없다', () => {
    expect(jobProgressRank(job('ARCHIVED'))).toBeNull()
  })
})
