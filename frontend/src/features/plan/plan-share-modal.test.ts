import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanShareContent, type PlanShareContentProps } from '@/features/plan/plan-share-modal'
import { messages } from '@/lib/messages'

/**
 * 발급 모달 본문의 네 갈래 (#628).
 *
 * **가장 중요한 것은 `idle` 이 오류가 아니라는 것**이다. 서버는 "한 번도 발급하지
 * 않았다" 를 `PLAN_023` 404 로 답하는데, 그것을 오류 갈래로 그리면 **처음 공유하는
 * 사람이 전부 오류 화면을 본다.**
 */
function render(overrides: Partial<PlanShareContentProps> = {}): string {
  const props: PlanShareContentProps = {
    state: 'idle',
    url: null,
    expiry: null,
    issuing: false,
    copied: false,
    copyFailed: false,
    onIssue: () => undefined,
    onCopy: () => undefined,
    onRevoke: () => undefined,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PlanShareContent, props))
}

describe('공유 모달 — 아직 공유 중이 아닐 때', () => {
  it('링크 만들기만 보인다 — 폐기할 것이 없다', () => {
    const html = render()

    expect(html).toContain(messages.plan.shareIssueAction)
    expect(html).not.toContain(messages.plan.shareRevokeAction)
  })

  it('404 를 오류로 그리지 않는다 — 처음 공유하는 사람이 보는 화면이다', () => {
    expect(render()).not.toContain(messages.plan.shareLoadError)
  })
})

describe('공유 모달 — 공유 중일 때', () => {
  const shared = {
    state: 'shared' as const,
    url: 'https://hondigagae.com/shared-plans/abc123',
    expiry: '2026년 10월 18일까지 볼 수 있어요',
  }

  it('주소와 복사·폐기를 함께 보여준다', () => {
    const html = render(shared)

    expect(html).toContain('https://hondigagae.com/shared-plans/abc123')
    expect(html).toContain(messages.plan.shareCopyAction)
    expect(html).toContain(messages.plan.shareRevokeAction)
  })

  it('만료일을 말한다', () => {
    expect(render(shared)).toContain('2026년 10월 18일까지 볼 수 있어요')
  })

  /*
    `disabled` 는 포커스가 잡히지 않아 복사 버튼이 실패했을 때 **수동 복사까지 막힌다.**
    이 화면에서 유일한 탈출구라 `readOnly` 여야 한다.
  */
  it('주소 입력이 readOnly 이고 disabled 가 아니다', () => {
    const html = render(shared)

    expect(html).toContain('readOnly=""')
    expect(html).not.toContain('<input disabled')
  })

  it('복사 실패를 조용히 넘기지 않는다', () => {
    expect(render({ ...shared, copyFailed: true })).toContain(messages.plan.shareCopyError)
  })

  it('복사 성공을 스크린리더에도 알린다 — 버튼 라벨만 바꾸면 말하지 않는다', () => {
    const html = render({ ...shared, copied: true })

    expect(html).toContain('aria-live="polite"')
    expect(html).toContain(messages.plan.shareCopiedLabel)
  })

  /*
    **`disabled` 라는 낱말로 세지 않는다** — 버튼의 class 에 `disabled:opacity-50` 이
    늘 들어 있어 어떤 상태든 통과한다. 속성으로 봐야 한다.
  */
  it('origin 을 아직 못 읽었으면 복사를 잠근다 — 빈 주소를 복사시키지 않는다', () => {
    expect(render({ ...shared, url: null })).toContain('disabled=""')
    expect(render(shared)).not.toContain('disabled=""')
  })
})

describe('공유 모달 — 불러오기 실패', () => {
  it('5xx 는 오류로 말한다', () => {
    const html = render({ state: 'error' })

    expect(html).toContain(messages.plan.shareLoadError)
    expect(html).not.toContain(messages.plan.shareIssueAction)
  })
})
