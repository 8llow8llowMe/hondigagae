'use client'

import { useLayoutEffect, useRef } from 'react'

import { Input } from '@/components/input'
import { normalizeVerificationCodeInput } from '@/lib/auth/verification-code'

export type VerificationCodeInputProps = {
  id: string
  value: string
  /** **정규화한 값**을 준다 — 대문자 · 공백 없음 · 8자 이하 */
  onValueChange: (value: string) => void
  invalid: boolean
}

/**
 * 이메일 인증코드 칸 — 가입 2단계 · 비밀번호 재설정이 같이 쓴다 (#1078).
 *
 * **입력 중에 바로 대문자로 바꾸고 공백을 지운다** (사용자 결정 2026-10-01). 백엔드는 대문자
 * 코드를 대소문자를 가려 비교하므로, 고치지 않으면 맞는 코드가 늘 "일치하지 않습니다" 다
 * (`lib/auth/verification-code.ts`).
 *
 * ## 커서가 튀지 않게
 *
 * 제어 입력의 값을 프로그램이 바꿔 쓰면(`ab` → `AB`) 브라우저는 커서를 끝으로 보낸다. 가운데를
 * 고치던 사람은 다음 글자를 엉뚱한 자리에 친다. 입력 이벤트 순간의 커서로 새 자리를 셈해
 * 두고(`normalizeVerificationCodeInput`), 렌더가 값을 써 넣은 **직후** 되돌린다.
 *
 * `useLayoutEffect` 라 칠하기 전에 돌아가 커서가 끝으로 갔다 오는 것이 보이지 않는다.
 * **의존성 배열을 두지 않는다** — 스페이스를 치면 정규화 값이 직전 값과 같아(`AB CD` → `ABCD`)
 * `[value]` 로는 effect 가 돌지 않는데, React 는 DOM 의 `AB CD` 를 `ABCD` 로 되돌려 쓰며
 * 커서를 끝으로 보낸다. 기다리는 자리가 없으면 아무것도 하지 않으니 매 렌더 돌아도 싸다.
 *
 * ## 네이티브 `maxLength` 를 걸지 않는다
 *
 * 브라우저는 붙여넣은 글자를 `maxlength` 로 **먼저** 자른다 — 공백 섞인 코드가 정규화 전에
 * 잘린다. 8자 제한은 정규화가 공백을 지운 뒤에 건다.
 */
export function VerificationCodeInput({
  id,
  value,
  onValueChange,
  invalid,
}: VerificationCodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCaretRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current
    pendingCaretRef.current = null
    const input = inputRef.current
    // 포커스가 없으면 건드리지 않는다 — `setSelectionRange` 가 일부 브라우저에서 포커스를 끌어온다
    if (caret === null || input === null || input.ownerDocument.activeElement !== input) return
    input.setSelectionRange(caret, caret)
  })

  return (
    <Input
      ref={inputRef}
      id={id}
      type="text"
      // 백엔드 예시가 A3K7MP2X 로 영숫자 혼합이다. numeric 이면 영문자를 못 넣는다 (D6)
      inputMode="text"
      autoComplete="one-time-code"
      // 모바일 키보드를 대문자로 띄운다 — 정규화가 고치기 전에 화면부터 맞는 모양이다
      autoCapitalize="characters"
      // 영숫자 무작위 문자열이다. 자동 고침이 낱말로 바꾸거나 맞춤법 밑줄을 그을 이유가 없다
      autoCorrect="off"
      spellCheck={false}
      value={value}
      onValueChange={(raw) => {
        const next = normalizeVerificationCodeInput(raw, inputRef.current?.selectionStart ?? null)
        pendingCaretRef.current = next.caret
        onValueChange(next.value)
      }}
      invalid={invalid}
    />
  )
}
