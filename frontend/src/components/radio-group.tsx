import { fieldErrorId } from '@/components/field'
import { cn } from '@/lib/utils/cn'

export type RadioOption<T extends string> = {
  value: T
  label: string
  /** 선택의 근거가 되는 보조 설명. 있으면 함께 노출한다 */
  description?: string | null
}

export type RadioGroupProps<T extends string> = {
  /** 오류 요소 id 의 근거이자 radio 들의 name 이다 */
  id: string
  label: string
  options: readonly RadioOption<T>[]
  value: T
  onValueChange: (value: T) => void
  error?: string | undefined
  required?: boolean
  disabled?: boolean
  className?: string
}

/**
 * 단일 선택 그룹.
 *
 * **`Field` 로 감싸지 않는다.** `Field` 는 `<label htmlFor>` 로 단일 입력 요소를
 * 가리키는데, 라디오 *그룹* 은 labelable 요소가 아니라서 그 배선이 성립하지 않는다.
 * 대신 `<fieldset>` + `<legend>` 로 그룹 라벨을 만들고, 오류 요소 id 만
 * `fieldErrorId()` 를 공유해 규칙을 한 곳에 유지한다 (docs/component-guide.md §7).
 *
 * `select` 대신 라디오를 쓰는 이유: 선택지의 `description`("체중 10kg 미만")이 선택의
 * 근거 자체다. `select` 는 그것을 숨긴다 (docs/features/pet/공통명세.md S5-2).
 *
 * controlled 전용이다. `defaultValue` 를 지원하지 않는다 (component-guide.md §5).
 *
 * `aria-invalid` 는 **`<fieldset>` 에만** 둔다. `role="radio"` 는 이 속성을 지원하지 않아
 * 개별 input 에 붙이면 무효다 (`jsx-a11y/role-supports-aria-props` 가 잡는다).
 * 오류는 그룹 단위 상태이므로 그것이 의미상으로도 맞다.
 */
export function RadioGroup<T extends string>({
  id,
  label,
  options,
  value,
  onValueChange,
  error,
  required = false,
  disabled = false,
  className,
}: RadioGroupProps<T>) {
  const invalid = error !== undefined

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
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2',
                'focus-within:ring-brand-500 focus-within:ring-2 focus-within:ring-offset-1',
                disabled && 'cursor-not-allowed opacity-50',
                value === option.value ? 'border-brand-500 bg-brand-50' : 'border-border-strong',
                invalid && 'border-danger-500',
              )}
            >
              <input
                type="radio"
                id={optionId}
                name={id}
                value={option.value}
                checked={value === option.value}
                disabled={disabled}
                onChange={() => onValueChange(option.value)}
                className="accent-brand-500 mt-1 size-4 shrink-0"
              />
              <span className="flex flex-col gap-0.5">
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
