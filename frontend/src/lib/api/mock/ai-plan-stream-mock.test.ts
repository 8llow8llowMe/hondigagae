import { beforeEach, describe, expect, it } from 'vitest'

import { JOB_STREAM_EVENT, parseJobEvent } from '@/lib/ai-plan/job-stream'
import { resolveMock, resolveMockStream } from '@/lib/api/mock'
import { resetMockStore } from '@/lib/api/mock/store'
import { encodeCommentFrame, encodeEventFrame, toEventStream } from '@/lib/api/mock/stream'
import type { AiPlanJob, AiPlanSubmitResult } from '@/types/ai-plan'
import type { ApiResponse } from '@/types/api'

const TOKEN = 'mock-access-900000000000000001'
const OTHER = 'mock-access-900000000000000777'

/**
 * 오늘부터 `offset` 일 뒤 (`YYYY-MM-DD`).
 *
 * **고정 날짜를 쓸 수 없다.** mock 이 `START_DATE_IN_PAST`(`AIPLAN_017`)를 판정하면서
 * 시계를 보게 되었으므로(#128), 박아 둔 날짜는 그 날이 지나는 순간 이 파일의 제출
 * 대부분을 400 으로 만든다. mock 이 로컬 날짜로 읽으므로 같은 기준으로 만든다.
 */
function fromToday(offset: number): string {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  const month = String(target.getMonth() + 1).padStart(2, '0')
  const day = String(target.getDate()).padStart(2, '0')

  return `${target.getFullYear()}-${month}-${day}`
}

const VALID = {
  areaCode: '39',
  startDate: fromToday(30),
  endDate: fromToday(32),
  petId: '123456789012000001',
}

function newJob(note?: string): string {
  const body = note === undefined ? VALID : { ...VALID, requestNote: note }
  const result = resolveMock('/ai-plans', 'POST', '', JSON.stringify(body), TOKEN)
  return (result?.payload as ApiResponse<AiPlanSubmitResult>).dataBody!.jobId
}

function stream(jobId: string, token: string | null = TOKEN) {
  return resolveMockStream(`/ai-plans/jobs/${jobId}/stream`, 'GET', token)
}

/** 프레임의 상태 코드만 순서대로 뽑는다 */
function codes(result: ReturnType<typeof stream>): string[] {
  if (result?.kind !== 'stream') throw new Error('스트림이 아니다')
  return result.frames.map((frame) => {
    const data = frame.data as AiPlanJob
    return typeof data.status === 'string' ? data.status : data.status.code
  })
}

beforeEach(() => {
  resetMockStore()
})

describe('resolveMockStream — 대상 판별', () => {
  it('작업 조회 경로는 스트림이 아니다', () => {
    expect(resolveMockStream('/ai-plans/jobs/x', 'GET', TOKEN)).toBeNull()
  })

  it('GET 이 아니면 다루지 않는다', () => {
    expect(resolveMockStream('/ai-plans/jobs/x/stream', 'POST', TOKEN)).toBeNull()
  })

  it('다른 도메인 경로는 다루지 않는다', () => {
    expect(resolveMockStream('/places', 'GET', TOKEN)).toBeNull()
  })
})

describe('resolveMockStream — 스트림 시작 전 오류', () => {
  /*
    **스트림 시작 전 실패는 SSE 가 아니라 JSON 이다** (`AiPlanJobSseStreamer.stream`).
    mock 이 이것을 스트림으로 내면 BFF 가 통과시켜 버려 화면이 404 를 못 읽는다.
  */
  it('없는 작업은 404 AIPLAN_002 JSON 이다', () => {
    const result = stream('없는-작업')

    expect(result?.kind).toBe('error')
    if (result?.kind !== 'error') return
    expect(result.result.status).toBe(404)
    expect((result.result.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_002')
  })

  it('타인의 작업도 404 다 — 존재를 노출하지 않는다', () => {
    const jobId = newJob()

    const result = stream(jobId, OTHER)

    expect(result?.kind).toBe('error')
    if (result?.kind !== 'error') return
    expect(result.result.status).toBe(404)
  })

  it('토큰이 없으면 401 이다', () => {
    const jobId = newJob()

    const result = stream(jobId, null)

    expect(result?.kind).toBe('error')
    if (result?.kind !== 'error') return
    expect(result.result.status).toBe(401)
  })
})

describe('resolveMockStream — 프레임 순서', () => {
  it('스냅샷 → RUNNING → COMPLETED 로 전이한다', () => {
    expect(codes(stream(newJob()))).toEqual(['PENDING', 'RUNNING', 'COMPLETED'])
  })

  it('첫 프레임은 지연 없이 나간다 — 구독 즉시 스냅샷', () => {
    const result = stream(newJob())

    if (result?.kind !== 'stream') throw new Error('스트림이 아니다')
    expect(result.frames[0]?.delayMs).toBe(0)
    // 나머지는 간격이 있어야 통과 여부를 눈으로 가를 수 있다
    expect(result.frames[1]?.delayMs).toBeGreaterThan(0)
  })

  it('모든 프레임이 백엔드와 같은 이벤트 이름을 쓴다', () => {
    const result = stream(newJob())

    if (result?.kind !== 'stream') throw new Error('스트림이 아니다')
    expect(result.frames.every((frame) => frame.event === JOB_STREAM_EVENT)).toBe(true)
  })

  /** 시나리오 트리거는 폴링 mock 과 같은 낱말을 쓴다 (`local-run-guide.md`) */
  it('요청 메모에 "실패" 가 있으면 FAILED 로 끝난다', () => {
    expect(codes(stream(newJob('실패 시나리오')))).toEqual(['PENDING', 'RUNNING', 'FAILED'])
  })

  it('FAILED 프레임에 errorCode 가 실린다 — 화면이 이유를 말해야 한다', () => {
    const result = stream(newJob('실패 시나리오'))

    if (result?.kind !== 'stream') throw new Error('스트림이 아니다')
    const last = result.frames.at(-1)?.data as AiPlanJob
    expect(last.errorCode).toBe('AIPLAN_012')
    expect(last.errorMessage).not.toBeNull()
  })

  it('COMPLETED 프레임에 초안이 실린다', () => {
    const result = stream(newJob())

    if (result?.kind !== 'stream') throw new Error('스트림이 아니다')
    const last = result.frames.at(-1)?.data as AiPlanJob
    expect(last.planDraft?.days.length).toBeGreaterThan(0)
  })

  /*
    **진행은 시간이 끌고 간다.** 스트림을 한 번 열면 작업이 종결까지 간 것으로 본다 —
    보는 사람이 없어도 실제 작업은 백그라운드에서 끝난다.
  */
  it('이미 종결된 작업을 다시 구독하면 스냅샷 하나로 닫는다', () => {
    const jobId = newJob()
    stream(jobId)

    expect(codes(stream(jobId))).toEqual(['COMPLETED'])
  })

  it('스트림을 연 뒤 폴링으로 조회해도 같은 종결 상태다', () => {
    const jobId = newJob()
    stream(jobId)

    const polled = resolveMock(`/ai-plans/jobs/${jobId}`, 'GET', '', null, TOKEN)
    const body = (polled?.payload as ApiResponse<AiPlanJob>).dataBody!
    expect(typeof body.status === 'string' ? body.status : body.status.code).toBe('COMPLETED')
  })
})

describe('SSE 와이어 형식', () => {
  it('이름 있는 이벤트로 조립한다', () => {
    expect(encodeEventFrame('job-update', { jobId: 'x' })).toBe(
      'event: job-update\ndata: {"jobId":"x"}\n\n',
    )
  })

  it('클라이언트 파서가 읽을 수 있는 data 를 만든다', () => {
    const frame = encodeEventFrame('job-update', {
      jobId: 'x',
      status: { code: 'RUNNING', name: '생성 중', description: null },
    })
    const data = frame.split('data: ')[1]?.trimEnd() ?? ''

    expect(parseJobEvent(data)?.jobId).toBe('x')
  })

  it('하트비트는 코멘트 프레임이라 data 가 없다', () => {
    expect(encodeCommentFrame('ping')).toBe(': ping\n\n')
    expect(encodeCommentFrame('ping')).not.toContain('data:')
  })
})

describe('toEventStream', () => {
  async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
    const decoder = new TextDecoder()
    const reader = stream.getReader()
    let text = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value)
    }
    return text
  }

  it('프레임을 순서대로 흘려보내고 닫는다', async () => {
    const text = await readAll(
      toEventStream([
        { delayMs: 0, event: 'job-update', data: { step: 1 } },
        { delayMs: 1, event: 'job-update', data: { step: 2 } },
      ]),
    )

    expect(text).toBe(
      'event: job-update\ndata: {"step":1}\n\nevent: job-update\ndata: {"step":2}\n\n',
    )
  })

  it('프레임이 없으면 즉시 닫는다', async () => {
    expect(await readAll(toEventStream([]))).toBe('')
  })

  /*
    **구독이 끊기면 타이머를 정리해야 한다.** 정리하지 않으면 사용자가 화면을 떠난 뒤에도
    타이머가 남아 개발 서버에 누적된다.
  */
  it('이미 끊긴 signal 이면 아무것도 보내지 않는다', async () => {
    const controller = new AbortController()
    controller.abort()

    const text = await readAll(
      toEventStream([{ delayMs: 0, event: 'job-update', data: { step: 1 } }], controller.signal),
    )

    expect(text).toBe('')
  })

  /*
    `request.signal` 이 발화하지 않는 배포에서는 리더의 `cancel()` 이 정리 경로다.
    타이머를 지우지 않으면 응답이 끝난 뒤에도 pump 체인이 남는다.
  */
  it('리더가 cancel 하면 남은 프레임을 보내지 않는다', async () => {
    const stream = toEventStream([
      { delayMs: 0, event: 'job-update', data: { step: 1 } },
      { delayMs: 50, event: 'job-update', data: { step: 2 } },
    ])

    const reader = stream.getReader()
    const first = await reader.read()
    await reader.cancel()

    expect(new TextDecoder().decode(first.value)).toContain('"step":1')
    expect((await reader.read()).done).toBe(true)
  })

  it('중간에 끊기면 남은 프레임을 보내지 않는다', async () => {
    const controller = new AbortController()
    const stream = toEventStream(
      [
        { delayMs: 0, event: 'job-update', data: { step: 1 } },
        { delayMs: 50, event: 'job-update', data: { step: 2 } },
      ],
      controller.signal,
    )

    const decoder = new TextDecoder()
    const reader = stream.getReader()
    const first = await reader.read()
    controller.abort()

    expect(decoder.decode(first.value)).toContain('"step":1')
    expect((await reader.read()).done).toBe(true)
  })
})
