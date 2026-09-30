'use client'

import { useState } from 'react'

import { Button } from '@/components/button'
import { EyeIcon, EyeOffIcon } from '@/components/icons'
import { Input, type InputProps } from '@/components/input'
import { messages } from '@/lib/messages'

/** 토글 버튼의 이름. 누르면 보이는 쪽(`show`)과 누르면 가려지는 쪽(`hide`) */
export type PasswordRevealLabels = { show: string; hide: string }

/**
 * `Input` 에서 **이 컴포넌트가 정하는 것**을 뺀다.
 *
 * - `type` — 표시 상태가 정한다 (`password` ↔ `text`)
 * - `action` — 눈 토글 자리다
 * - `suffix` — `action` 과 같은 자리를 쓴다. 둘 다 오면 `Input` 이 `action` 만 그린다
 */
export type PasswordInputProps = Omit<InputProps, 'type' | 'action' | 'suffix'> & {
  /**
   * 토글 버튼의 이름. 기본은 `비밀번호 표시` / `비밀번호 숨기기`.
   *
   * **한 화면에 비밀번호 칸이 둘 이상이면 넘긴다** (마이페이지 변경 폼: `현재 비밀번호 표시` ·
   * `새 비밀번호 표시`). 같은 이름이 둘이면 버튼 목록으로 훑는 스크린리더에 어느 칸인지
   * 들리지 않는다.
   */
  revealLabels?: PasswordRevealLabels
}

const DEFAULT_REVEAL_LABELS: PasswordRevealLabels = {
  show: messages.auth.passwordShow,
  hide: messages.auth.passwordHide,
}

/**
 * 표시 상태 → 입력 타입 · 버튼 이름. 누른 뒤의 상태를 node 환경에서 볼 수 있는 자리가
 * 여기뿐이라 순수 함수로 뺐다 (`password-input.test.ts`).
 */
export function passwordReveal(
  revealed: boolean,
  labels: PasswordRevealLabels,
): { type: 'text' | 'password'; toggleLabel: string } {
  return revealed
    ? { type: 'text', toggleLabel: labels.hide }
    : { type: 'password', toggleLabel: labels.show }
}

/**
 * 비밀번호 입력 — 입력란 **안** 오른쪽에 눈 토글이 선다 (#1080).
 *
 * 로그인 · 비밀번호 재설정이 각자 들고 있던 토글을 가입 3단계와 마이페이지까지 한 벌로 모은다.
 * 배선은 로그인 폼의 것을 그대로 옮겼다 — 로그인도 이것으로 옮길 수 있게 동작을 맞춘다.
 *
 * - `ghost` · `size="md"` `iconOnly` — 입력란 안에 서는 버튼이라 자기 면을 갖지 않고,
 *   44×44 로 입력란 높이(`h-11`)를 꽉 채운다 (`Input.action` 주석)
 * - **이름은 `aria-label` 이 준다** — 아이콘은 `aria-hidden` 이다. 상태는 `aria-pressed`
 * - `aria-controls` 가 어느 입력란을 여닫는지 잇는다. 아이콘은 입력란 안에 시각적으로만 붙어 있다
 *
 * ### 표시 상태는 이 컴포넌트가 갖는다
 *
 * **값(`value`)은 controlled 다** (`component-guide.md` §5). 가려짐/보임은 폼 값이 아니라
 * **이 칸의 표시 방식**이다 — 제출에 실리지 않고, 사용처가 읽을 일도, 밖에서 되돌릴 일도
 * 없다. `InfoTip` 의 열림 상태와 같은 자리다. 사용처가 들고 있게 하면 칸 하나마다 상태 한
 * 쌍과 prop 두 개가 폼 컨테이너까지 올라간다 — 비밀번호 칸이 둘인 마이페이지는 넷이 된다.
 *
 * 칸이 새로 그려지면(단계를 되돌아왔다 다시 오면) 가려진 채로 다시 시작한다.
 */
export function PasswordInput({
  id,
  revealLabels = DEFAULT_REVEAL_LABELS,
  ...rest
}: PasswordInputProps) {
  const [revealed, setRevealed] = useState(false)
  const { type, toggleLabel } = passwordReveal(revealed, revealLabels)

  return (
    <Input
      {...rest}
      id={id}
      type={type}
      action={
        <Button
          variant="ghost"
          size="md"
          iconOnly
          aria-label={toggleLabel}
          aria-pressed={revealed}
          aria-controls={id}
          leading={revealed ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
          onClick={() => setRevealed((previous) => !previous)}
        />
      }
    />
  )
}
