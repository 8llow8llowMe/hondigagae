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
    **취소도 종결이다** (#250). 빠뜨리면 취소한 작업을 폴링 상한까지 2초마다 두드리고,
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

describe('jobPollPhase — 명세 S7', () => {
  it('안내 시점 전에는 아무 말도 하지 않는다 — 정상 소요 시간이다', () => {
    expect(jobPollPhase(0)).toBe('normal')
    expect(jobPollPhase(JOB_POLL_SLOW_MS - 1)).toBe('normal')
  })

  it('안내 시점을 넘기면 기다려 달라고 덧붙인다', () => {
    expect(jobPollPhase(JOB_POLL_SLOW_MS)).toBe('slow')
    expect(jobPollPhase(JOB_POLL_LIMIT_MS - 1)).toBe('slow')
  })

  it('상한을 넘기면 폴링을 끝낸 국면이다', () => {
    expect(jobPollPhase(JOB_POLL_LIMIT_MS)).toBe('exceeded')
    expect(jobPollPhase(JOB_POLL_LIMIT_MS * 2)).toBe('exceeded')
  })

  /*
    **두 임계값은 백엔드 예산에 매여 있다** (#495). 검사하는 것은 값 자체가 아니라
    **그 값이 밖의 사실에 대해 서 있는 관계**다 — 값만 보면 누가 30초로 되돌려도
    테스트를 같이 고치면 초록불이지만, 관계로 적으면 되돌린 이유를 설명해야 한다.

    밖의 사실은 상수로 드러내 이름을 준다. 숫자를 단언문에 흩뿌리면 그 숫자가 **무엇의**
    값인지가 사라지고, 같은 숫자가 `job.ts` JSDoc 과 두 곳에 복제된다.
  */

  /** BE `ai-plan.job.pending/running-timeout-seconds` — 시계 하나의 예산 */
  const BE_TIMEOUT_MS = 300_000
  /** dev 실측 최악 (2026-09-12 · 1박 2일 · 반려견 1) — #495 본문 */
  const OBSERVED_WORST_MS = 80_000

  it('정상 소요 실측이 안내에 걸리지 않는다', () => {
    expect(jobPollPhase(OBSERVED_WORST_MS)).toBe('normal')
  })

  /*
    **BE 의 300초는 제출 시각부터의 총 예산이 아니다.** `PENDING` 은 `createdAt`,
    `RUNNING` 은 `startedAt` 기준으로 따로 재므로, 대기열에 선 잡은 제출 → 판정까지
    최악 545초다 (`AiPlanJobProcessor.expireIfStuck`). 그래서 이 단언이 말할 수 있는
    것은 **단독 실행 잡에 한해** 서버 판정을 받아 보여 준다는 것까지다 — 줄 선 잡은
    수동 확인 화면으로 넘어가고, 그 화면이 작업이 계속된다고 말하는 것이 설계다.
  */
  it('상한이 시계 하나의 예산보다 뒤에 온다 — 단독 실행 잡은 서버 판정을 받아 보여 준다', () => {
    expect(JOB_POLL_LIMIT_MS).toBeGreaterThan(BE_TIMEOUT_MS)
  })

  it('안내 시점이 상한보다 먼저다', () => {
    expect(JOB_POLL_SLOW_MS).toBeLessThan(JOB_POLL_LIMIT_MS)
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
  /*
    **상한과의 비교는 #495 로 이빨이 빠졌다.** 30k < 90k 일 때는 실질적 제약이었지만
    30k < 330k 는 어떤 회귀도 막지 못한다. 이 주기가 지켜야 하는 것은 상한이 아니라
    **안내 시점**이다 — 반열림 연결에서 폴링이 이 주기로만 돌 때, 사용자가 `slow` 안내를
    보기 전에 최소 한 번은 상태를 다시 확인해야 국면 전환이 실제 상태 위에서 일어난다.
  */
  it('2초 폴링보다 느리고, 안내 시점 전에 적어도 한 번은 확인한다', () => {
    expect(JOB_STREAM_SAFETY_POLL_MS).toBeGreaterThan(JOB_POLL_INTERVAL_MS)
    expect(JOB_STREAM_SAFETY_POLL_MS).toBeLessThan(JOB_POLL_SLOW_MS)
  })

  /** 백엔드 하트비트(25초)보다 길어야 정상 구독을 불필요하게 두드리지 않는다 */
  it('백엔드 하트비트 주기보다 길다', () => {
    expect(JOB_STREAM_SAFETY_POLL_MS).toBeGreaterThanOrEqual(25_000)
  })
})
