import { describe, expect, it } from 'vitest'

import { eventStreamHeaders, isEventStream, wantsEventStream } from '@/lib/api/event-stream'

describe('wantsEventStream', () => {
  it('EventSource 가 보내는 Accept 를 알아본다', () => {
    expect(wantsEventStream('text/event-stream')).toBe(true)
  })

  it('여러 타입 중 하나로 섞여 있어도 알아본다', () => {
    expect(wantsEventStream('text/event-stream, */*;q=0.5')).toBe(true)
  })

  it('q 파라미터가 붙어도 알아본다', () => {
    expect(wantsEventStream('text/event-stream;q=0.9, application/json')).toBe(true)
  })

  it('대소문자를 가리지 않는다', () => {
    expect(wantsEventStream('Text/Event-Stream')).toBe(true)
  })

  /*
    이 판정이 느슨하면 일반 JSON 요청이 스트림 분기로 새고, 그 경로는 토큰 스트립을
    건너뛴다 — **`*​/*` 를 SSE 로 읽어서는 안 된다.**
  */
  it('와일드카드만으로는 스트림으로 보지 않는다', () => {
    expect(wantsEventStream('*/*')).toBe(false)
  })

  it('일반 JSON 요청은 스트림이 아니다', () => {
    expect(wantsEventStream('application/json')).toBe(false)
  })

  it('Accept 가 없으면 스트림이 아니다', () => {
    expect(wantsEventStream(null)).toBe(false)
    expect(wantsEventStream(undefined)).toBe(false)
    expect(wantsEventStream('')).toBe(false)
  })

  it('타입 이름의 일부만 겹치는 것을 통과시키지 않는다', () => {
    expect(wantsEventStream('text/event-streaming')).toBe(false)
    expect(wantsEventStream('application/text/event-stream')).toBe(false)
  })
})

describe('isEventStream', () => {
  it('charset 이 붙은 응답 헤더를 알아본다', () => {
    expect(isEventStream('text/event-stream;charset=utf-8')).toBe(true)
    expect(isEventStream('text/event-stream; charset=UTF-8')).toBe(true)
  })

  /*
    **스트림 시작 전 오류는 JSON 으로 온다** (`AiPlanJobSseStreamer.stream`).
    이것을 스트림으로 오판하면 404 `AIPLAN_002` 본문이 통과해 화면이 이유를 잃는다.
  */
  it('JSON 오류 응답은 스트림이 아니다', () => {
    expect(isEventStream('application/json')).toBe(false)
    expect(isEventStream(null)).toBe(false)
  })
})

describe('eventStreamHeaders', () => {
  it('버퍼링을 막는 헤더를 모두 싣는다', () => {
    const headers = eventStreamHeaders()

    expect(headers['Content-Type']).toContain('text/event-stream')
    expect(headers['Cache-Control']).toContain('no-cache')
    expect(headers.Connection).toBe('keep-alive')
    // nginx 가 응답을 모아 두지 않게 한다 — 이것이 빠지면 통과 작업 전체가 무효다
    expect(headers['X-Accel-Buffering']).toBe('no')
  })
})
