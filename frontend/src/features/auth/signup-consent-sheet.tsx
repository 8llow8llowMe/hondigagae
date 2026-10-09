'use client'

import type { ReactNode, RefObject } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { SignupConsentFields } from '@/features/auth/signup-consent-fields'
import type { SignupConsent, SignupConsentKey } from '@/lib/auth/signup-consent'
import type { FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 가입 약관 시트 (#1284, 회원가입-세부명세 D14).
 *
 * **동의를 첫 화면이 아니라 "개인정보가 서버로 처음 나가기 직전" 에 받는다.** 예전에는 가입 첫
 * 화면에 동의 4줄이 이메일 · 소셜 버튼과 함께 서 있어(S1 · S3) 무엇부터 할지 안 보였고, 동의 전에는
 * 소셜 버튼이 흐려 고장으로 읽혔다(S2). 시트는 두 자리에서 뜬다:
 *
 * - **이메일 가입** — 이메일을 쓰고 `인증코드 받기` 를 누를 때. 코드 발송이 이메일을 서버에 보내는
 *   첫 요청이다.
 * - **소셜 가입** — 진입 화면에서 카카오 · 네이버를 누를 때. 동의는 `/authorize` 쿼리에만 실을 수
 *   있고(인가코드 1회용) 그 뒤에는 받을 자리가 없다 (#688).
 *
 * 맨 마지막(프로필 뒤)으로 미루지 않은 이유가 위 둘이다 — 이메일은 이미 나간 뒤고, 소셜은 받을
 * 방법이 없다.
 *
 * **동의 상태를 갖지 않는다.** 소유자는 `SignupScreen`(#688) 그대로이고 시트는 값과 콜백만 받는다.
 * 시트를 닫았다 다시 열어도 켠 항목이 남는다.
 *
 * `action` 은 시트 바닥의 실행 자리다 — 이메일은 `동의하고 인증코드 받기` 버튼, 소셜은 제공자
 * 하나만 그린 `SocialLoginButtons`(#707 의 소셜 동의 화면과 같은 배치)다. **`BottomSheet` 의
 * `footer`(하단 고정)에 둔다** (#1295) — 스크롤 영역 안에 두면 낮은 기기에서 동의 네 줄에 밀려 실행
 * 버튼이 화면 밖으로 나간다.
 *
 * **Tab 을 시트 안에 가둔다** (#1295, D15) — `aria-modal="true"` 인데 Tab 이 뒤쪽 상단바 `←` 로
 * 빠졌다. 닫을 때 돌아갈 자리는 `triggerRef` 로 받는다(없으면 열기 직전의 활성 요소).
 */
export function SignupConsentSheet({
  open,
  onClose,
  consent,
  errors,
  onConsentChange,
  onConsentAllChange,
  action,
  triggerRef,
}: {
  open: boolean
  onClose: () => void
  consent: SignupConsent
  errors: FormErrors
  onConsentChange: (key: SignupConsentKey, checked: boolean) => void
  onConsentAllChange: (checked: boolean) => void
  action: ReactNode
  /** 닫을 때 포커스가 돌아갈 자리 — `BottomSheet.triggerRef` */
  triggerRef?: RefObject<HTMLElement | null>
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={messages.auth.consentSheetTitle}
      footer={action}
      trapFocus
      {...(triggerRef !== undefined ? { triggerRef } : {})}
    >
      <div className="flex flex-col gap-4 px-4 pt-1 pb-5">
        <SignupConsentFields
          consent={consent}
          errors={errors}
          onConsentChange={onConsentChange}
          onConsentAllChange={onConsentAllChange}
        />
      </div>
    </BottomSheet>
  )
}
