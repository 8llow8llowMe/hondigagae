import { describe, expect, it } from 'vitest'

import {
  isTerminalJob,
  JOB_STREAM_EVENT,
  mergeJobUpdate,
  parseJobEvent,
} from '@/lib/ai-plan/job-stream'
import type { AiPlanJob } from '@/types/ai-plan'

function job(code: string): AiPlanJob {
  return {
    jobId: 'job-1',
    status: { code, name: code, description: null },
    step: null,
    stepOrder: null,
    totalSteps: 4,
    planDraft: null,
    errorCode: null,
    errorMessage: null,
    // 이 파일이 보는 것은 상태 전이라 조건은 쓰이지 않는다 (#498)
    conditions: null,
  }
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

  it('진행 중끼리는 새 값을 쓴다', () => {
    expect(mergeJobUpdate(job('PENDING'), job('RUNNING')).status).toMatchObject({
      code: 'RUNNING',
    })
  })

  it('캐시가 비어 있으면 새 값을 쓴다', () => {
    expect(mergeJobUpdate(undefined, job('PENDING')).status).toMatchObject({ code: 'PENDING' })
  })
})
