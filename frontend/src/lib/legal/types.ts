/**
 * 약관·개인정보 처리방침의 **본문 구조**.
 *
 * **마크다운이 아니라 조·항 트리다.** 약관은 산문이 아니라 번호가 붙은 조문 트리라
 * 배열이 실제 구조와 일치한다 — 목차·`#article-N` 앵커·누락 검증이 순회로 따라온다.
 * 마크다운 파서를 쓰면 런타임 의존성, `dangerouslySetInnerHTML`, 그리고
 * `@tailwindcss/typography` 가 없어 파서 출력에 스타일이 안 먹는 문제가 함께 온다.
 *
 * **이 디렉터리의 문구는 합니다체다.** 법률문서의 어미이고, 화면 문구(해요체)는
 * `src/lib/messages/legal.ts` 에 따로 있다 — `message-tone.test.ts` 가 그 디렉터리만
 * 훑으므로 경계가 테스트로 강제된다.
 */

/** 조문 안의 한 덩어리 */
export type Block =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: readonly string[] }
  | {
      kind: 'table'
      headers: readonly string[]
      /** 각 행의 길이는 `headers` 와 같아야 한다 — `legal.test.ts` 가 감시한다 */
      rows: readonly (readonly string[])[]
    }

export type Article = {
  /** 조 번호. **1부터 연속이어야 한다** — 개정하다 한 조를 빠뜨리는 사고를 테스트가 잡는다 */
  no: number
  title: string
  blocks: readonly Block[]
}

/** 개정 한 줄. 최초 제정도 여기 남긴다 */
export type Revision = {
  version: string
  /** YYYY-MM-DD */
  effectiveDate: string
  summary: string
}

export type LegalDocument = {
  id: 'terms' | 'privacy'
  title: string
  version: string
  /** YYYY-MM-DD. **미래 날짜를 둘 수 있다** — 사전 공지 기간을 두고 먼저 배포하기 위해서다 */
  effectiveDate: string
  articles: readonly Article[]
  /** 최신이 앞 */
  history: readonly Revision[]
}
