import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { SurfaceList } from '@/components/surface'
import { LEGAL_LINKS } from '@/lib/legal/links'
import { type AccountState, canSetupPassword } from '@/lib/member/account-state'
import { providerName } from '@/lib/member/provider'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/** 이동 항목(`Link`)과 같은 높이 · 인셋 · 초점 링이다 — 행 모양이 같아야 한 목록으로 읽힌다 */
const ACTION_ROW_CLASS = cn(
  'focus-visible:ring-brand-500 flex min-h-14 w-full items-center py-3 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
  INSET_CLASS.card,
)

/**
 * `계정` 카드의 **내용**— 아트보드 01 의 세 번째 블록.
 *
 * **카드(`Surface`)는 `MyPageSections` 가 그린다** (`styling-guide.md §3-1`). 제목 `계정`
 * 이 응답과 무관한 정적 값이라 기준의 "정적이면 페이지가" 쪽이다 — 여기서 그리면서 값만
 * 내려보내면 제목 줄과 목록 사이에 카드 여백이 한 번 더 낀다.
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
 * `SurfaceList` 이고, **이동 항목은 `<a>` · 읽기 전용 항목은 `<li>` 안의 텍스트**다. 모양이
 * 같아도 역할이 다르다. `버전 1.0.0` 은 조작할 수 없어 목록 항목이 아니라 정의 목록으로
 * 그린다 — `<li>` 에 넣으면 스크린리더가 나머지와 같은 "항목"으로 읽는다.
 *
 * **항목이 자기 `border-b` 를 긋지 않는다** (3a, #466). 선은 `SurfaceList` 가 항목
 * **사이에만** 긋고, 마지막 항목 아래 선은 없다 — 2a 때 마지막 행의 `border-b` 가 버전
 * 줄 위에 선을 남겨, 목록과 정의 목록이 같은 묶음처럼 읽혔다.
 *
 * `이용약관` · `개인정보 처리방침` 은 #610 에서 문서와 페이지가 생겨 **이제 렌더한다.**
 * 규칙("진입점만 먼저 만들지 않는다", D8-1)이 바뀐 것이 아니라 전제가 채워진 것이다.
 *
 * **이 둘은 계정 상태로 갈리지 않는다.** 약관은 소셜 계정에도, 비밀번호 계정에도,
 * 판별 불가한 계정에도 똑같이 적용된다 — 그래서 목록은 **항상 항목을 갖는다**. *
 * ### 로그아웃 · 회원탈퇴 — 카드의 마지막 두 행
 *
 * 예전에는 카드 밖 L0 에 `secondary` 버튼과 글자 링크로 섰다(#913). 둘이 모양도 무게도 달라
 * 어느 묶음에도 속하지 않은 것처럼 떠 보였다. **`버전` 줄과 같은 행 모양**으로 카드 안
 * 맨 아래에 둔다 — 위치(맨 마지막)가 "약하게" 를 지킨다.
 *
 * - **둘 다 동작이라 `<button>` 이다.** 탈퇴도 이제 라우트 이동이 아니라 확인 모달을 연다
 *   (`WithdrawModal`). 이동 항목이 아니므로 꺾쇠를 달지 않는다 — 꺾쇠는 "다른 화면으로 간다" 는
 *   신호다 (위 이동 항목들과 갈리는 지점).
 * - **회원탈퇴만 danger 글자색이다.** 되돌릴 수 없는 유일한 행이라 한눈에 갈려야 한다. 면을
 *   칠하지 않는다 — 글자만 붉다(병원 배너의 "아이콘만 danger" 와 같은 절제). 실수를 막는 것은
 *   여전히 위치와 확인 모달이다.
 * - 로그아웃은 중립 글자다. 되돌릴 수 있는 동작이라 경고색을 쓰면 탈퇴와 같은 무게가 된다.
 */
export function AccountSection({
  state,
  provider,
  onLogout,
  onWithdraw,
}: {
  state: AccountState
  provider: string | null
  onLogout: () => void
  onWithdraw: () => void
}) {
  const name = providerName(provider)
  /*
    **빈 목록이 더는 나올 수 없다** (#610). 예전에는 `unknown`(provider 없음 + 비밀번호
    없음)이면 항목이 하나도 없어 빈 `ul` 과 허공의 선이 생겼고, 그래서 `hasItems` 로
    통째로 감쌌다. 이제 약관 항목 둘이 상태와 무관하게 항상 들어와 그 경우가 사라졌다.
  */

  return (
    <>
      <SurfaceList>
        {name !== null && (
          <li className={cn('flex min-h-14 items-center py-3', INSET_CLASS.card)}>
            <span className="text-body-1 text-fg">{messages.member.linkedWith(name)}</span>
          </li>
        )}

        {/*
            판별 불가(`unknown`)면 비밀번호 항목을 내지 않는다. 어느 동작을 제시해도
            틀리기 때문이다 — 안내는 `/mypage/password` 가 맡는다 (D5).
          */}
        {state !== 'unknown' && (
          <li className={INSET_CLASS.card}>
            <Link
              href="/mypage/password"
              className="focus-visible:ring-brand-500 flex min-h-14 items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
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

        {/*
            **계정 상태로 갈리지 않는다.** 약관은 모든 회원에게 같게 적용되므로 조건 없이
            낸다 — 목록이 항상 항목을 갖는 이유이기도 하다.
          */}
        {LEGAL_LINKS.map((link) => (
          <li key={link.href} className={INSET_CLASS.card}>
            <Link
              href={link.href}
              className="focus-visible:ring-brand-500 flex min-h-14 items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
            >
              <span className="text-body-1 text-fg flex-1">{link.label}</span>
              <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
            </Link>
          </li>
        ))}
      </SurfaceList>

      {/*
        조작 불가 정보 — 목록 항목이 아니라 정의 목록이다 (D6).
        **목록 밖이라 선을 스스로 든다.** `SurfaceList` 의 선은 자기 `li` 사이에만 걸린다.
        목록이 항상 항목을 가지므로 선도 항상 긋는다 (#610).
      */}
      <dl
        className={cn(
          'border-border flex min-h-14 items-center gap-3 border-t py-3',
          INSET_CLASS.card,
        )}
      >
        <dt className="text-body-1 text-fg flex-1">{messages.member.version}</dt>
        <dd className="text-body-2 text-fg-muted">{messages.member.versionValue}</dd>
      </dl>

      {/* 동작 행 둘 — 머리주석 "로그아웃 · 회원탈퇴" 절. 목록 밖이라 선을 스스로 든다 */}
      <div className="border-border border-t">
        <button type="button" onClick={onLogout} className={ACTION_ROW_CLASS}>
          <span className="text-body-1 text-fg">{messages.member.logout}</span>
        </button>
      </div>
      <div className="border-border border-t">
        <button type="button" onClick={onWithdraw} className={ACTION_ROW_CLASS}>
          <span className="text-body-1 text-danger-700 font-medium">
            {messages.member.withdraw}
          </span>
        </button>
      </div>
    </>
  )
}
