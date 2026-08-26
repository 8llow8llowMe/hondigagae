import { describe, expect, it } from 'vitest'

import { isJobCompleted, isJobFailed, jobPollInterval, shouldKeepPolling } from '@/lib/ai-plan/job'

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
