'use client'

import type { FormEvent } from 'react'

import { Input, type InputProps } from '@/components/input'
import { editGroupedDigits, formatGroupedDigits } from '@/lib/form/grouped-digits'

/**
 * `Input` 에서 **이 컴포넌트가 정하는 것**을 뺀다.
 *
 * - `inputMode` · `type` — 숫자 키패드를 여는 `text` 로 고정한다. `type="number"` 는 휠
 *   스크롤로 값이 바뀌고 빈 값과 잘못된 값을 구분하지 못하며, 쉼표를 그릴 수 없다
 * - `onInput` — 표기와 커서를 다시 그리는 자리다
 * - `maxLength` · `minLength` · `pattern` — 쉼표까지 글자로 세어 폼 값과 어긋난다. 상한은
 *   스키마가 본다 (`lib/plan/budget.ts` 등)
 */
export type AmountInputProps = Omit<
  InputProps,
  'inputMode' | 'type' | 'onInput' | 'maxLength' | 'minLength' | 'pattern'
>

/**
 * 금액 입력 — 이슈 #986. **입력란에는 `300,000`, 폼 값은 `'300000'`** 이다.
 *
 * `value` · `onValueChange` 는 **숫자만 든 문자열**을 주고받는다(비우면 `''`). 쉼표는 표기라
 * 폼 값에 들어가지 않으므로, 쓰는 폼의 스키마·전송 변환은 그대로다. 규칙과 커서 계산은
 * `lib/form/grouped-digits.ts` 가 갖는다 — node 환경에서 테스트되는 자리가 거기다.
 *
 * ### 왜 `onInput` 에서 DOM 을 직접 고치나
 *
 * 쉼표를 넣으면 글자 수가 바뀌어 **React 가 값을 다시 쓰는 순간 커서가 끝으로 튄다.** 그래서
 * 이벤트 안에서 표기와 커서를 먼저 써 두고 폼 값을 올린다. 다시 그릴 때 React 가 보는 값이
 * 이미 DOM 과 같아 값을 건드리지 않으므로 커서가 그 자리에 남는다. 숫자가 바뀌지 않은
 * 입력(글자를 친 경우)은 폼 값을 올리지 않는다 — 다시 그릴 일이 없고, 방금 쓴 표기가 곧
 * 원래 표기다.
 *
 * `onInput` 인 이유는 **`InputEvent.inputType` 이 필요해서다.** 쉼표만 지운 백스페이스를
 * "그 앞 숫자를 지웠다" 로 읽으려면 백스페이스인지 Delete 인지 알아야 한다. `Input` 의
 * `onValueChange` 는 문자열만 넘기므로 여기서는 쓰지 않는다.
 */
export function AmountInput({ value, onValueChange, ...rest }: AmountInputProps) {
  function handleInput(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const next = editGroupedDigits({
      raw: input.value,
      caret: input.selectionStart ?? input.value.length,
      previousDigits: value,
      inputType: inputTypeOf(event.nativeEvent),
    })

    input.value = next.display
    input.setSelectionRange(next.caret, next.caret)
    if (next.digits !== value) onValueChange(next.digits)
  }

  return (
    <Input
      {...rest}
      value={formatGroupedDigits(value)}
      onValueChange={ignoreRawValue}
      onInput={handleInput}
      inputMode="numeric"
    />
  )
}

/** 쉼표가 섞인 날 값이다. 폼 값은 `handleInput` 이 숫자만 골라 올린다 */
function ignoreRawValue(): void {
  // 의도적으로 비운다 — 위 JSDoc 의 "왜 onInput 에서" 참고
}

/** `input` 이벤트는 대개 `InputEvent` 지만 타입은 `Event` 다. 없으면 `null` */
function inputTypeOf(event: Event): string | null {
  return 'inputType' in event && typeof event.inputType === 'string' ? event.inputType : null
}
