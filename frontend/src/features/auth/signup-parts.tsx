import Link from 'next/link'

import { messages } from '@/lib/messages'

/**
 * 회원가입 화면의 **단계와 무관한 조각** — 이슈 #1083.
 *
 * 셋 다 상태 없는 표시 컴포넌트다. `SignupForm` · `SignupScreen` 은 `useRouter` 를 들고 있어
 * node 테스트 환경에서 렌더되지 않으므로(testing-guide.md §1), 배치를 잠글 조각을 여기로
 * 빼서 따로 렌더한다.
 */

/** 가입 단계 수. 단계 표시와 단계 컴포넌트가 같은 수를 말해야 한다 */
export const SIGNUP_STEP_COUNT = 3

export type SignupHeadingProps = {
  /** 1부터 센다 */
  step: 1 | 2 | 3
}

/**
 * 제목 + 단계 표시.
 *
 * **단계 표시는 제목 바로 아래다** (회원가입-세부명세 D1 "상단"). #1083 이전에는 단계
 * 컴포넌트 안에 있어 그 위에 선 동의 블록 **아래**로 밀려 있었다 — 동의 3종을 다 읽고 나서야
 * "지금 몇 단계인지" 가 보였다. 동의 블록은 모든 단계에 서는 화면 단위 요소라(D10) 단계
 * 표시가 그보다 먼저 와야 "이 화면이 어디쯤인가" 가 먼저 읽힌다.
 *
 * 단계는 텍스트로 읽힌다 — 색·아이콘만으로 표현하지 않는다 (D6).
 */
export function SignupHeading({ step }: SignupHeadingProps) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-title-1 text-fg font-bold">{messages.auth.signupTitle}</h1>
      <p className="text-caption text-fg-muted">{messages.auth.stepOf(step, SIGNUP_STEP_COUNT)}</p>
    </div>
  )
}

export type SignupEmailSummaryProps = {
  /** 이 단계에서 이메일이 맡은 역할 — "받는 이메일" / "가입할 이메일" */
  label: string
  email: string
}

/**
 * 2·3단계에서 **진행 중인 이메일을 라벨과 함께** 보인다 (#1083).
 *
 * 2단계는 이메일만 덩그러니 있어 무엇을 가리키는 값인지 읽히지 않았고, 3단계에는 아예
 * 없어 "어느 계정을 만들고 있는가" 를 확인할 길이 없었다. 이메일은 1단계 값이라 여기서
 * 고칠 수 없으므로 입력이 아니라 **값 표시**다 — `dl` 로 이름과 값을 묶는다.
 */
export function SignupEmailSummary({ label, email }: SignupEmailSummaryProps) {
  return (
    <dl className="flex flex-col gap-1">
      <dt className="text-caption text-fg-muted">{label}</dt>
      {/* 이메일은 줄바꿈 기회가 없는 토큰이다 — 긴 이메일이 375px 폭에서 넘치지 않게 break-all */}
      <dd className="text-body-2 text-fg font-medium break-all">{email}</dd>
    </dl>
  )
}

export type SignupLoginPromptProps = {
  /** 로그인 뒤 돌아갈 경로. 회원가입에 들고 온 값을 그대로 넘긴다 */
  returnTo: string
}

/**
 * 하단 "이미 계정이 있나요? 로그인" (#1083).
 *
 * 로그인 화면에는 "회원가입" 링크가 있었는데 반대 방향이 없었다 — 잘못 들어온 기존 회원은
 * 브라우저 뒤로 가기밖에 길이 없었다.
 *
 * **`returnTo` 를 이어받는다.** 로그인 → 회원가입 → 로그인 으로 돌아와도 처음 가려던 곳을
 * 잃지 않는다. 로그인 화면의 "회원가입" 링크와 같은 쿼리 셰이프다.
 */
export function SignupLoginPrompt({ returnTo }: SignupLoginPromptProps) {
  return (
    <p className="text-body-2 text-fg-muted flex flex-wrap items-center justify-center gap-1">
      <span>{messages.auth.haveAccountPrompt}</span>
      <Link
        href={`/login?${new URLSearchParams({ returnTo }).toString()}`}
        // 높이 44 — 규칙이 아니라 이 자리에서 고른 값이다 (#883 이 §7 하한을 지도 타깃으로
        // 좁혔다). 글자 한 줄 높이 링크는 손가락으로 겨누기 어렵고, 동의 블록의 "전문 보기" 와 같다
        className="text-brand-600 inline-flex min-h-11 items-center px-1 font-medium underline"
      >
        {messages.auth.haveAccountLink}
      </Link>
    </p>
  )
}
