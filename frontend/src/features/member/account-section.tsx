import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { Section } from '@/components/surface'
import { type AccountState, canSetupPassword } from '@/lib/member/account-state'
import { providerName } from '@/lib/member/provider'
import { messages } from '@/lib/messages'

/**
 * `계정` 섹션 — 아트보드 01 의 세 번째 블록.
 *
 * ### 아트보드의 예고를 이행한다
 *
 * 아트보드 01 주석이 스스로 이렇게 적어 뒀다: *"소셜 로그인은 범위 밖 — 이메일 계정만
 * 다루므로 비밀번호 변경이 항상 보인다. 소셜 계정이 추가되면 이 행을 숨기고 '카카오로
 * 연결됨'을 표시해야 한다."* **그 시점이 지금이다** — 백엔드에 소셜 로그인·계정
 * 연결/전환이 들어와 있다 (#55).
 *
 * | 상태      | 계정 섹션                                       |
 * | --------- | ----------------------------------------------- |
 * | 일반      | `비밀번호 변경` ›                               |
 * | 소셜 전용 | `{provider} 로 연결됨` (읽기) + `비밀번호 설정` › |
 * | 연결됨    | `{provider} 로 연결됨` (읽기) + `비밀번호 변경` › |
 *
 * ### 목록 규칙 (D6)
 *
 * `<ul>` 이고, **이동 항목은 `<a>` · 읽기 전용 항목은 `<li>` 안의 텍스트**다. 모양이
 * 같아도 역할이 다르다. `버전 1.0.0` 은 조작할 수 없어 목록 항목이 아니라 정의 목록으로
 * 그린다 — `<li>` 에 넣으면 스크린리더가 나머지와 같은 "항목"으로 읽는다.
 *
 * `이용약관` · `개인정보 처리방침` 은 **이번에 렌더하지 않는다.** 링크 대상 문서가
 * 아직 없다 — "API 없이 진입점만 만들지 않는다" 와 같은 규칙이다 (D8-1).
 */
export function AccountSection({
  state,
  provider,
}: {
  state: AccountState
  provider: string | null
}) {
  const name = providerName(provider)

  return (
    <Section title={messages.member.accountSection}>
      <ul>
        {name !== null && (
          <li className="border-border flex min-h-14 items-center border-b px-4 py-3 md:px-10">
            <span className="text-body-1 text-fg">{messages.member.linkedWith(name)}</span>
          </li>
        )}

        {/*
          판별 불가(`unknown`)면 비밀번호 항목을 내지 않는다. 어느 동작을 제시해도
          틀리기 때문이다 — 안내는 `/mypage/password` 가 맡는다 (D5).
        */}
        {state !== 'unknown' && (
          <li className="border-border border-b">
            <Link
              href="/mypage/password"
              className="hover:bg-band focus-visible:ring-brand-500 flex min-h-14 items-center gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:px-10"
            >
              <span className="text-body-1 text-fg flex-1">
                {canSetupPassword(state)
                  ? messages.member.passwordSetup
                  : messages.member.passwordChange}
              </span>
              <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
            </Link>
          </li>
        )}
      </ul>

      {/* 조작 불가 정보 — 목록 항목이 아니라 정의 목록이다 (D6) */}
      <dl className="flex min-h-14 items-center gap-3 px-4 py-3 md:px-10">
        <dt className="text-body-1 text-fg flex-1">{messages.member.version}</dt>
        <dd className="text-body-2 text-fg-muted">{messages.member.versionValue}</dd>
      </dl>
    </Section>
  )
}
