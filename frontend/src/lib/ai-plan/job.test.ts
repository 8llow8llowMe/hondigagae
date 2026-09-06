import { describe, expect, it } from 'vitest'

import {
  isJobCanceled,
  isJobCompleted,
  isJobFailed,
  JOB_POLL_INTERVAL_MS,
  JOB_POLL_LIMIT_MS,
  JOB_POLL_SLOW_MS,
  JOB_STREAM_SAFETY_POLL_MS,
  jobPollInterval,
  jobPollPhase,
  jobStepProgress,
  shouldKeepPolling,
} from '@/lib/ai-plan/job'

describe('isJobFailed', () => {
  it('status 가 FAILED 면 실패로 판정한다 (HTTP 200 으로 오는 실패다)', () => {
    expect(isJobFailed({ status: 'FAILED' })).toBe(true)
  })

  it('metadata 객체 형태의 status 에서도 code 를 읽어 판정한다', () => {
    expect(isJobFailed({ status: { code: 'FAILED', name: '실패' } })).toBe(true)
  })

  it('진행 중인 작업은 실패가 아니다', () => {
    expect(isJobFailed({ status: 'RUNNING' })).toBe(false)
  })

  it('완료된 작업은 실패가 아니다', () => {
    expect(isJobFailed({ status: 'COMPLETED' })).toBe(false)
  })
})

describe('isJobCompleted', () => {
  it('status 가 COMPLETED 면 완료로 판정한다', () => {
    expect(isJobCompleted({ status: 'COMPLETED' })).toBe(true)
  })

  it('실패한 작업을 완료로 판정하지 않는다', () => {
    expect(isJobCompleted({ status: 'FAILED' })).toBe(false)
  })
})

describe('shouldKeepPolling', () => {
  it('대기 중이면 폴링을 계속한다', () => {
    expect(shouldKeepPolling({ status: 'PENDING' })).toBe(true)
  })

  it('완료되면 폴링을 멈춘다', () => {
    expect(shouldKeepPolling({ status: 'COMPLETED' })).toBe(false)
  })

  it('실패하면 폴링을 멈춘다', () => {
    expect(shouldKeepPolling({ status: 'FAILED' })).toBe(false)
  })

  /*
    **취소도 종결이다** (#250). 빠뜨리면 취소한 작업을 상한(90초)까지 2초마다 두드리고,
    화면은 그동안 진행 중으로 남는다 — 서버는 이미 상태를 못 박고 SSE 도 닫은 뒤다.
  */
  it('취소되면 폴링을 멈춘다', () => {
    expect(shouldKeepPolling({ status: 'CANCELED' })).toBe(false)
  })

  it('아직 응답이 없으면 폴링을 계속한다', () => {
    expect(shouldKeepPolling(null)).toBe(true)
  })
})

describe('isJobCanceled (#250)', () => {
  it('status 가 CANCELED 면 취소로 판정한다', () => {
    expect(isJobCanceled({ status: 'CANCELED' })).toBe(true)
    expect(isJobCanceled({ status: { code: 'CANCELED', name: '취소됨' } })).toBe(true)
  })

  /*
    **실패와 갈라야 한다.** 취소는 `errorCode` 를 비운 채로 오므로 실패 화면에 태우면
    사유 없는 "일정을 만들지 못했어요" 가 뜬다 — 사용자가 스스로 그만둔 일이다.
  */
  it('실패·완료는 취소가 아니다', () => {
    expect(isJobCanceled({ status: 'FAILED' })).toBe(false)
    expect(isJobCanceled({ status: 'COMPLETED' })).toBe(false)
    expect(isJobFailed({ status: 'CANCELED' })).toBe(false)
  })
})

describe('jobStepProgress (#250)', () => {
  it('서버가 준 n / m 을 그대로 돌려준다', () => {
    expect(jobStepProgress({ stepOrder: 2, totalSteps: 4 })).toEqual({ order: 2, total: 4 })
  })

  /*
    **`PENDING` 은 `stepOrder` 가 null 이다.** 0 이나 1 로 채우면 아직 시작하지 않은
    작업을 시작한 것으로 그린다.
  */
  it('대기 중이면 그릴 것이 없다', () => {
    expect(jobStepProgress({ stepOrder: null, totalSteps: 4 })).toBeNull()
  })

  /*
    **필드를 모르는 서버가 붙어 있을 수 있다.** SSE 프레임은 `parseJobEvent` 가 모양을
    검사하지 않고 통과시키므로 타입만 믿으면 `NaN / undefined 단계` 가 화면에 나간다.
  */
  it('값이 아예 없으면 그리지 않는다', () => {
    expect(jobStepProgress({})).toBeNull()
    expect(jobStepProgress(null)).toBeNull()
  })

  /** `5 / 4 단계` 는 진행률이 아니라 버그의 표시다 */
  it('순서가 전체보다 크면 그리지 않는다', () => {
    expect(jobStepProgress({ stepOrder: 5, totalSteps: 4 })).toBeNull()
  })

  it('0 이하나 정수가 아닌 값은 그리지 않는다', () => {
    expect(jobStepProgress({ stepOrder: 0, totalSteps: 4 })).toBeNull()
    expect(jobStepProgress({ stepOrder: 1.5, totalSteps: 4 })).toBeNull()
  })
})

describe('jobPollInterval', () => {
  it('진행 중이면 간격(ms)을 반환한다', () => {
    expect(jobPollInterval({ status: 'RUNNING' })).toBe(2000)
  })

  it('실패하면 false 를 반환해 폴링을 끝낸다', () => {
    expect(jobPollInterval({ status: 'FAILED' })).toBe(false)
  })
})

describe('jobPollPhase — 명세 S7 (30초 · 90초)', () => {
  it('30초 전에는 아무 말도 하지 않는다 — 정상 소요 시간이다', () => {
    expect(jobPollPhase(0)).toBe('normal')
    expect(jobPollPhase(JOB_POLL_SLOW_MS - 1)).toBe('normal')
  })

  it('30초를 넘기면 기다려 달라고 덧붙인다', () => {
    expect(jobPollPhase(JOB_POLL_SLOW_MS)).toBe('slow')
    expect(jobPollPhase(JOB_POLL_LIMIT_MS - 1)).toBe('slow')
  })

  it('90초를 넘기면 폴링을 끝낸 국면이다', () => {
    expect(jobPollPhase(JOB_POLL_LIMIT_MS)).toBe('exceeded')
    expect(jobPollPhase(120_000)).toBe('exceeded')
  })
})

describe('jobPollInterval — 상한', () => {
  it('상한 안에서는 진행 중이면 계속 폴링한다', () => {
    expect(jobPollInterval({ status: 'RUNNING' }, JOB_POLL_SLOW_MS)).toBe(2000)
  })

  it('상한을 넘기면 진행 중이어도 멈춘다 — 죽은 작업을 영원히 두드리지 않는다', () => {
    expect(jobPollInterval({ status: 'RUNNING' }, JOB_POLL_LIMIT_MS)).toBe(false)
  })

  it('경과 시간을 주지 않으면 상한을 보지 않는다', () => {
    expect(jobPollInterval({ status: 'RUNNING' })).toBe(2000)
  })
})

describe('JOB_STREAM_SAFETY_POLL_MS', () => {
  /*
    구독 중에도 남기는 확인 주기다. 하트비트가 코멘트 프레임이라 JS 가 구독의 생존을
    관측할 수 없어(반열림 연결) 폴링을 완전히 끄면 상한까지 화면이 멈춘다.
  */
  it('2초 폴링보다 느리고 상한보다 짧다', () => {
    expect(JOB_STREAM_SAFETY_POLL_MS).toBeGreaterThan(JOB_POLL_INTERVAL_MS)
    expect(JOB_STREAM_SAFETY_POLL_MS).toBeLessThan(JOB_POLL_LIMIT_MS)
  })

  /** 백엔드 하트비트(25초)보다 길어야 정상 구독을 불필요하게 두드리지 않는다 */
  it('백엔드 하트비트 주기보다 길다', () => {
    expect(JOB_STREAM_SAFETY_POLL_MS).toBeGreaterThanOrEqual(25_000)
  })
})
