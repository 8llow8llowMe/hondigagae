'use client'

import { createContext, type ReactNode, useContext } from 'react'

/**
 * `Field` 가 **실제로 그린 설명**을 안쪽 입력에 알리는 통로 (#1100).
 *
 * `hint` 가 보이는지는 `Field` 만 안다 — 오류가 있으면 hint 를 감추고 그 자리에 오류를 그린다
 * (#1080). 입력 쪽이 `invalid` 하나로 짐작하면 정상 상태의 hint 를 놓치고, 사용처가 prop 으로
 * 다시 넘기게 하면 `Field` 의 `hint` 와 입력의 prop 이 따로 놀아 열다섯 곳 중 한 곳이 빠져도
 * 아무도 모른다. 그래서 **그린 쪽이 알린다.**
 *
 * **`'use client'` 를 이 모듈에만 둔다.** `createContext` 는 서버 그래프에 없다. `Field` 는
 * 지시어 없이 남아 이 Provider(문자열 prop + children)를 렌더하므로 서버 컴포넌트에서도 그려지고,
 * `field.tsx` 의 id 규칙(`fieldErrorId` · `fieldHintId`)도 서버에서 그대로 부를 수 있다.
 */
type FieldDescribedBy = {
  /** 이 `Field` 의 `id` — 입력의 `id` 와 같을 때만 설명을 가져간다 */
  id: string
  describedBy: string | undefined
}

const FieldDescribedByContext = createContext<FieldDescribedBy | null>(null)

export function FieldDescribedByProvider({
  id,
  describedBy,
  children,
}: FieldDescribedBy & { children: ReactNode }) {
  return <FieldDescribedByContext value={{ id, describedBy }}>{children}</FieldDescribedByContext>
}

/**
 * 입력 요소의 `aria-describedby`.
 *
 * - **같은 id 의 `Field` 안이면 `Field` 가 그린 것을 그대로 쓴다** — hint 만 보이면 hint id,
 *   오류가 보이면 오류 id 하나, 둘 다 없으면 `undefined`.
 * - `Field` 밖이거나 id 가 다르면 `fallback` 이다. 입력마다 `invalid ? fieldErrorId(id) : undefined`
 *   를 넘긴다 — 오류 문구를 직접 그리는 사용처(`Field` 를 쓰지 않는 칸)의 지금 동작이다.
 *
 * id 를 대조하는 이유: `Field` 하나 안에 다른 입력이 함께 서는 자리(보조 입력 · 버튼 안 입력)가
 * 그 `Field` 의 설명을 가져가면, 가리키는 문구가 자기 것이 아니다.
 */
export function useFieldDescribedBy(id: string, fallback: string | undefined): string | undefined {
  const field = useContext(FieldDescribedByContext)
  return field !== null && field.id === id ? field.describedBy : fallback
}
