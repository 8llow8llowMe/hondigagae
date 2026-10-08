import Link from 'next/link'

import { Button } from '@/components/button'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 회원가입 화면의 **단계와 무관한 조각** — 이슈 #1083.
 *
 * 셋 다 상태 없는 표시 컴포넌트다. `SignupForm` · `SignupScreen` 은 `useRouter` 를 들고 있어
 * node 테스트 환경에서 렌더되지 않으므로(testing-guide.md §1), 배치를 잠글 조각을 여기로
 * 빼서 따로 렌더한다.
 */

/** 가입 단계 수. 단계 표시와 단계 컴포넌트가 같은 수를 말해야 한다 */
export const SIGNUP_STEP_COUNT = 3

export type SignupStep = 1 | 2 | 3

/* 진행 바 채움 — 임의 값(`w-[33%]`) 대신 스케일의 분수 클래스 (component-guide.md §11 `Record`) */
const PROGRESS_WIDTH: Record<SignupStep, string> = { 1: 'w-1/3', 2: 'w-2/3', 3: 'w-full' }

export type SignupStepHeadingProps = {
  step: SignupStep
  /** 이 단계의 질문 — "이메일을 알려주세요" 등. 화면의 `h1` 이다 */
  heading: string
  description?: string | undefined
}

/**
 * 진행 바 + 단계 질문 (#1284, 회원가입-세부명세 D14). `SignupHeading`(제목 "회원가입" + "3단계 중
 * N단계" 글자)을 대신한다.
 *
 * **제목은 화면 이름이 아니라 그 단계에서 할 일이다** — 토스 · 카카오의 가입 단계처럼 질문 한 줄이
 * 본문의 큰 글자다. "회원가입" 은 진입 화면 제목("혼디가개에 오신 걸 환영해요")이 이미 말했다.
 *
 * **진행 바는 장식이고 단계는 글자로 읽힌다** (D6 "색 · 아이콘만으로 표현하지 않는다"). 바는
 * `aria-hidden`, "3단계 중 N단계" 는 sr-only 로 제목 바로 뒤에 둔다 — 보이는 글자는 바가 대신한다.
 */
export function SignupStepHeading({ step, heading, description }: SignupStepHeadingProps) {
  return (
    <div className="flex flex-col gap-6">
      <div aria-hidden="true" className="bg-band h-1 overflow-hidden rounded-full">
        <div className={cn('bg-brand-500 h-full rounded-full', PROGRESS_WIDTH[step])} />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-title-1 text-fg font-bold">{heading}</h1>
        <p className="sr-only">{messages.auth.stepOf(step, SIGNUP_STEP_COUNT)}</p>
        {description !== undefined && <p className="text-body-2 text-fg-muted">{description}</p>}
      </div>
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

export type SignupConsentActionProps = {
  /** 세 항목이 다 켜졌는가 — 꺼져 있으면 버튼을 잠그고 이유를 글자로 말한다 */
  complete: boolean
  /** "동의하고 인증코드 받기" / "동의하고 가입하기" — 동의 뒤 일어날 일을 쓴다 */
  label: string
  /** 잠긴 이유 — 무엇을 하려면 체크해야 하는지 (`emailConsentRequired` 등) */
  requiredMessage: string
  onConfirm: () => void
}

/**
 * 이메일 가입 약관 시트의 실행 자리 (#1284). 소셜 쪽 `SocialLoginButtons` 가 `consent` 로 잠기며
 * 안내 한 줄을 다는 것과 **같은 모양**이다 — 버튼만 흐리게 두면 고장으로 읽는다.
 */
export function SignupConsentAction({
  complete,
  label,
  requiredMessage,
  onConfirm,
}: SignupConsentActionProps) {
  return (
    <div className="flex flex-col gap-3">
      {!complete && <p className="text-caption text-fg-muted">{requiredMessage}</p>}
      <Button size="lg" disabled={!complete} onClick={onConfirm}>
        {label}
      </Button>
    </div>
  )
}
