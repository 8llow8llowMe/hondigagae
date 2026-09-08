import { fieldErrorId } from '@/components/field'
import { cn } from '@/lib/utils/cn'

export type PetCheckboxOption = {
  value: string
  label: string
  /** 선택의 근거가 되는 보조 설명. 있으면 함께 노출한다 */
  description?: string | null
}

export type PetCheckboxGroupProps = {
  /** 오류 요소 id 의 근거이자 checkbox 들의 name 이다 */
  id: string
  label: string
  options: readonly PetCheckboxOption[]
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
 * 44px 터치 영역 · 선택 틴트 · `aria-invalid` 를 fieldset 에만 두는 것까지 같다
 * (component-guide.md §7). 같은 폼 안에서 두 그룹의 오류 표현이 갈리면 안 된다.
 *
 * **`src/components/` 에 두지 않는다.** 사용처가 하나라 §9 가 feature 안에 두라고 정했다.
 * 두 번째 사용처가 생기면 승격하고 `pet` 을 이름에서 뗀다.
 *
 * **`RadioGroup` 을 확장하지 않은 이유**: 단일/다중은 `value: T` ↔ `values: T[]` 로 타입이
 * 갈리고 `name` 공유·키보드 이동 규칙이 다르다. optional prop 하나로 겸하게 만들면
 * §9 의 "기본 동작을 바꾸는 변경" 이 된다.
 *
 * controlled 전용이다 (component-guide.md §5).
 */
export function PetCheckboxGroup({
  id,
  label,
  options,
  values,
  onValuesChange,
  error,
  required = false,
  className,
}: PetCheckboxGroupProps) {
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
                // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2',
                'focus-within:ring-brand-500 focus-within:ring-2 focus-within:ring-offset-1',
                checked ? 'border-fg bg-row-selected' : 'border-border-strong',
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
