import { describe, expect, it } from 'vitest'

import {
  isJobCompleted,
  isJobFailed,
  JOB_POLL_INTERVAL_MS,
  JOB_POLL_LIMIT_MS,
  JOB_POLL_SLOW_MS,
  JOB_STREAM_SAFETY_POLL_MS,
  jobPollInterval,
  jobPollPhase,
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

  it('아직 응답이 없으면 폴링을 계속한다', () => {
    expect(shouldKeepPolling(null)).toBe(true)
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
