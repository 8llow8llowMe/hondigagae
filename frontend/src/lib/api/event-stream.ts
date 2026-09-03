/**
 * SSE 판별과 통과 헤더 — BFF 스트리밍 분기(#91).
 *
 * `app/api/bff/[...path]/route.ts` 는 응답을 통째로 버퍼링한다(`await response.text()`).
 * 스트림에 그 경로를 태우면 작업이 끝난 뒤에야 이벤트가 한꺼번에 도착해 **폴링만도
 * 못하다** — 그래서 스트림만 따로 갈라낸다.
 *
 * env·transport 의존이 없는 순수 함수라 테스트할 수 있다 (`bff-error.ts` 와 같은 규칙).
 */

export const EVENT_STREAM_MIME = 'text/event-stream'

/**
 * 요청이 SSE 를 원하는가 — **응답이 아니라 요청으로 판정한다.**
 *
 * 백엔드 `streamJobStatus` 가 `produces = TEXT_EVENT_STREAM_VALUE` 라, BFF 가 고정으로
 * 박는 `Accept: application/json` 을 그대로 보내면 게이트웨이가 **406** 을 낸다.
 * 응답 Content-Type 을 보고 분기하면 이미 늦는다 — 부르기 전에 알아야 한다.
 */
export function wantsEventStream(accept: string | null | undefined): boolean {
  if (!accept) return false
  return accept
    .split(',')
    .some((part) => (part.split(';')[0] ?? '').trim().toLowerCase() === EVENT_STREAM_MIME)
}

/**
 * 응답이 실제로 SSE 인가.
 *
 * 요청이 SSE 를 원했어도 응답은 JSON 일 수 있다 — 스트림 시작 전 오류(`AIPLAN_002` 404,
 * 401)는 일반 JSON 으로 온다(`AiPlanJobSseStreamer.stream` 주석). 그때는 기존 버퍼링
 * 경로로 되돌려 앱의 공통 에러 봉투를 유지한다.
 */
export function isEventStream(contentType: string | null | undefined): boolean {
  if (!contentType) return false
  return (contentType.split(';')[0] ?? '').trim().toLowerCase() === EVENT_STREAM_MIME
}

/**
 * 스트림 응답에 실어 보낼 헤더.
 *
 * `X-Accel-Buffering: no` 는 nginx 가 이 응답을 모아 두지 않게 한다 — 백엔드
 * 컨트롤러도 같은 헤더를 붙이고 있어 프록시 2단(게이트웨이 앞·FE 앞) 모두를 막는다.
 *
 * `Connection` 은 Node 의 HTTP 계층이 직접 관리해 무시될 수 있다. 그래도 명시해 둔다 —
 * 이 응답이 keep-alive 를 전제한다는 사실이 헤더에 남아 있는 편이 낫다.
 */
export function eventStreamHeaders(): Record<string, string> {
  return {
    'Content-Type': `${EVENT_STREAM_MIME}; charset=utf-8`,
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }
}
