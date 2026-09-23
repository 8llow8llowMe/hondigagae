import { fieldErrorId } from '@/components/field'
import { cn } from '@/lib/utils/cn'

export type CheckboxOption = {
  value: string
  label: string
  /** 선택의 근거가 되는 보조 설명. 있으면 함께 노출한다 */
  description?: string | null
}

export type CheckboxGroupProps = {
  /** 오류 요소 id 의 근거이자 checkbox 들의 name 이다 */
  id: string
  label: string
  options: readonly CheckboxOption[]
  values: readonly string[]
  onValuesChange: (values: string[]) => void
  error?: string | undefined
  required?: boolean
  className?: string
}

/**
 * 다중 선택 그룹 — 아트보드 01 의 반려견 선택 (#128).
 *
 * **`RadioGroup` 을 그대로 본떴다.** `<fieldset>` + `<legend>` · `fieldErrorId()` 공유 ·
 * 행 높이 44 · 선택 틴트 · `aria-invalid` 를 fieldset 에만 두는 것까지 같다
 * (component-guide.md §7). 같은 폼 안에서 두 그룹의 오류 표현이 갈리면 안 된다.
 *
 * **`PetCheckboxGroup` 에서 승격했다** (#622 · 명세 D13-8). AI 조건 폼 하나뿐이던
 * 사용처에 일정 수정 모달이 더해져 §9 의 "2곳 이상이면 `src/components/` 로 올리고
 * 도메인 용어(`pet`)를 이름에서 뗀다" 에 걸렸다. **동작은 그대로다** — 이동 · 이름
 * 변경뿐이고 새 prop(대표 배지 등)을 함께 얹지 않았다.
 *
 * **`Checkbox`(단일)와 합치지 않는다.** 그룹 시맨틱(`fieldset`/`legend`/그룹 오류)이
 * 없는 컴포넌트다.
 *
 * **`RadioGroup` 을 확장하지 않은 이유**: 단일/다중은 `value: T` ↔ `values: T[]` 로 타입이
 * 갈리고 `name` 공유·키보드 이동 규칙이 다르다. optional prop 하나로 겸하게 만들면
 * §9 의 "기본 동작을 바꾸는 변경" 이 된다.
 *
 * controlled 전용이다 (component-guide.md §5).
 */
export function CheckboxGroup({
  id,
  label,
  options,
  values,
  onValuesChange,
  error,
  required = false,
  className,
}: CheckboxGroupProps) {
  const invalid = error !== undefined

  function toggle(value: string): void {
    onValuesChange(
      values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
    )
  }

  return (
    <fieldset
      className={cn('flex flex-col gap-1', className)}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={invalid ? fieldErrorId(id) : undefined}
    >
      <legend className="text-body-2 text-fg mb-1 font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger-500 ml-1">
            *
          </span>
        )}
      </legend>

      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const optionId = `${id}-${option.value}`
          const checked = values.includes(option.value)

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                // 높이 44 — §7 하한이 아니라 이 자리에서 고른 값이다 (#883). 줄이려면 375 에서 재고 줄인다
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2',
                /*
                  **`focus-within` 이 아니라 `has-[:focus-visible]` 이다** — `RadioGroup` 과
                  같은 이유다. `focus-within` 은 마우스 클릭에도 걸려 선택 테두리 바깥에
                  링이 한 겹 더 그려졌다.
                */
                'has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-offset-0',
                checked ? 'border-brand-500 bg-row-selected' : 'border-border-strong',
                invalid && 'border-danger-500',
              )}
            >
              <input
                type="checkbox"
                id={optionId}
                name={id}
                value={option.value}
                checked={checked}
                onChange={() => toggle(option.value)}
                className="accent-brand-500 mt-1 size-4 shrink-0"
              />
              <span className="flex flex-col gap-1">
                <span className="text-body-2 text-fg font-medium">{option.label}</span>
                {option.description !== undefined && option.description !== null && (
                  <span className="text-caption text-fg-muted">{option.description}</span>
                )}
              </span>
            </label>
          )
        })}
      </div>

      {invalid && (
        <p id={fieldErrorId(id)} className="text-caption text-danger-500">
          {error}
        </p>
      )}
    </fieldset>
  )
}
