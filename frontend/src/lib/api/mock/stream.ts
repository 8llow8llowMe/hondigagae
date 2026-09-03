/**
 * mock SSE 스트림 (#91).
 *
 * 로컬에서 스트리밍을 **실제로** 확인하기 위한 계층이다. 백엔드가 로컬에 뜨지 않으므로
 * (`screen-inventory.md` §5 · ai-plan 공통명세 S9 #7) mock 이 스트림을 내지 못하면
 * BFF 통과 경로도 폴백 경로만 열어 볼 수 있다.
 *
 * **프레임 조립과 시간 진행을 나눈다.** 프레임 목록은 순수 데이터라 테스트로 덮고,
 * `ReadableStream` 조립만 여기서 한다.
 */

/**
 * 스트림 한 프레임.
 *
 * `delayMs` 는 **직전 프레임과의 간격**이다. 첫 프레임이 0 이면 구독 즉시 나간다 —
 * 백엔드도 구독 직후 현재 상태 스냅샷을 먼저 보낸다(`AiPlanJobSseStreamer.stream`).
 */
export type MockStreamFrame = {
  delayMs: number
  event: string
  data: unknown
}

/**
 * SSE 프레임 한 개를 와이어 형식으로 만든다.
 *
 * **이름 있는 이벤트로 쓴다.** 백엔드가 `job-update` 라는 이름을 붙여 보내므로
 * (`AiPlanJobSseStreamer.EVENT_NAME`) mock 이 이름을 빼면 클라이언트의
 * `addEventListener` 가 아무것도 못 받는다 — 실제와 다른 것을 통과시키면 안 된다.
 *
 * `data` 는 줄바꿈이 없는 JSON 한 줄이라 다중 `data:` 줄을 다루지 않는다.
 */
export function encodeEventFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/** 하트비트 코멘트 프레임. `onmessage`·`addEventListener` 로 오지 않는다 */
export function encodeCommentFrame(comment: string): string {
  return `: ${comment}\n\n`
}

/**
 * 프레임 목록을 SSE 본문 스트림으로 만든다.
 *
 * **구독이 끊기면 타이머를 반드시 정리한다.** `signal` 을 넘기지 않거나 무시하면
 * 사용자가 화면을 떠난 뒤에도 타이머가 남아 개발 서버에 누적된다.
 */
export function toEventStream(
  frames: readonly MockStreamFrame[],
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let timer: ReturnType<typeof globalThis.setTimeout> | null = null
  let index = 0

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false

      const stop = (): void => {
        if (closed) return
        closed = true
        if (timer !== null) globalThis.clearTimeout(timer)
        timer = null
        try {
          controller.close()
        } catch {
          // 이미 닫힌 스트림 — 중복 close 는 무시한다
        }
      }

      if (signal?.aborted === true) {
        stop()
        return
      }
      signal?.addEventListener('abort', stop, { once: true })

      const pump = (): void => {
        if (closed) return

        const frame = frames[index]
        if (frame === undefined) {
          // 마지막 프레임까지 보냈다 — 백엔드도 종결 상태에서 연결을 닫는다
          stop()
          return
        }
        index += 1

        timer = globalThis.setTimeout(() => {
          if (closed) return
          try {
            controller.enqueue(encoder.encode(encodeEventFrame(frame.event, frame.data)))
          } catch {
            stop()
            return
          }
          pump()
        }, frame.delayMs)
      }

      pump()
    },
    cancel() {
      if (timer !== null) globalThis.clearTimeout(timer)
      timer = null
    },
  })
}
