import Link from 'next/link'

import { Checkbox } from '@/components/checkbox'
import {
  SIGNUP_CONSENT_KEYS,
  type SignupConsent,
  type SignupConsentKey,
} from '@/lib/auth/signup-consent'
import type { FormErrors } from '@/lib/form/field-errors'
import { LEGAL_HREF } from '@/lib/legal/links'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 가입 동의 체크박스 3종 — 이슈 #688.
 *
 * **상태를 갖지 않는다.** 소유자는 `SignupScreen` 이다 — 같은 값을 이메일 가입
 * 요청(`POST /members/signup`)과 소셜 `/authorize` 쿼리가 함께 쓰기 때문이고,
 * 상태를 가진 컴포넌트는 node 환경에서 렌더 테스트가 되지 않기 때문이다
 * (testing-guide.md §1).
 *
 * **`Record<SignupConsentKey, …>` 다.** 항목을 늘리면 여기 누락을 타입체커가 잡는다
 * (component-guide.md §2).
 */

const CONSENT_LABEL: Record<SignupConsentKey, string> = {
  termsAgreed: messages.auth.termsConsentLabel,
  privacyAgreed: messages.auth.privacyConsentLabel,
  ageOver14Confirmed: messages.auth.ageConsentLabel,
}

/**
 * 항목에 딸린 본문 링크. **만 14세 확인은 `null` 이다** — 읽을 문서가 있는 동의가
 * 아니라 사용자의 자기신고다 (보호법 제22조의2). 없는 문서로 가는 링크를 만들지 않는다.
 */
const CONSENT_DOCUMENT: Record<SignupConsentKey, { href: string; title: string } | null> = {
  termsAgreed: { href: LEGAL_HREF.terms, title: messages.legal.termsTitle },
  privacyAgreed: { href: LEGAL_HREF.privacy, title: messages.legal.privacyTitle },
  ageOver14Confirmed: null,
}

export type SignupConsentFieldsProps = {
  consent: SignupConsent
  /** 항목별 오류. `MEMBER_115/116/117` 과 코드로 판정한 `MEMBER_010/011` 이 함께 온다 */
  errors: FormErrors
  disabled?: boolean
  onConsentChange: (key: SignupConsentKey, checked: boolean) => void
  /** 레이아웃 유틸리티만 허용한다 */
  className?: string
}

export function SignupConsentFields({
  consent,
  errors,
  disabled = false,
  onConsentChange,
  className,
}: SignupConsentFieldsProps) {
  return (
    /*
      **`fieldset` + `legend` 다.** 세 체크박스는 "가입 동의" 라는 하나의 질문이고,
      그룹 라벨은 `label htmlFor` 로 가리킬 수 없다 — `RadioGroup` 과 같은 판단
      (component-guide.md §7).
    */
    <fieldset className={cn('flex flex-col gap-2', className)}>
      <legend className="text-body-2 text-fg mb-1 font-medium">
        {messages.auth.consentHeading}
      </legend>

      {SIGNUP_CONSENT_KEYS.map((key) => {
        const document = CONSENT_DOCUMENT[key]

        return (
          <div key={key} className="flex items-start gap-2">
            <Checkbox
              id={key}
              label={CONSENT_LABEL[key]}
              checked={consent[key]}
              disabled={disabled}
              error={errors.fields[key]}
              onCheckedChange={(checked) => onConsentChange(key, checked)}
              className="min-w-0 flex-1"
            />

            {document !== null && (
              /*
                **새 창으로 연다.** 같은 탭으로 나가면 3단계까지 입력한 값이 사라지고
                (`useUnsavedWarning` 이 이탈 경고를 띄운다), 돌아왔을 때 1단계부터
                다시 밟아야 한다 — 서버가 인증 상태를 30분 들고 있어도 화면 단계는
                복원되지 않는다 (회원가입-세부명세.md D8-1).

                링크 글자는 짧게 두되 접근 가능한 이름은 문서 제목까지 말한다. 보이는
                글자("전문 보기")가 이름에 그대로 들어 있어 WCAG 2.5.3 을 지킨다.
              */
              <Link
                href={document.href}
                target="_blank"
                rel="noreferrer"
                aria-label={messages.auth.consentDocumentLinkLabel(document.title)}
                // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
                className="text-caption text-brand-600 inline-flex min-h-11 shrink-0 items-center px-1 underline"
              >
                {messages.auth.consentDocumentLinkText}
              </Link>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
