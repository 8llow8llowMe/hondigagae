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
  /**
   * 선택지를 한 줄에 몇 칸으로 세울지. 기본은 세로 목록(`1`)이다.
   *
   * `3` 은 **3지선다 전용**이다 — 375 에서 카드 안쪽 폭(343)을 셋으로 나누면 한 칸이
   * 109px 이고, 그보다 더 쪼개면 `description` 이 읽히지 않는다. `description` 은
   * 장식이 아니라 선택의 근거라(아래 주석) 줄일 수 없는 값이다.
   */
  columns?: 1 | 3
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
  columns = 1,
  className,
}: RadioGroupProps<T>) {
  const invalid = error !== undefined
  const grid = columns === 3

  return (
    /*
      **`id` 와 `tabIndex` 는 짝이다 — 둘 중 하나만 있으면 아무 일도 일어나지 않는다.**

      폼의 첫 오류 필드 포커스는 `querySelector('#' + field)?.focus()` 한 줄이다
      (`pet-form.tsx` 의 `submitCount` effect). 여기 `id` 가 없던 동안 그 조회가 `null` 을
      돌려줘 **크기·활동량·사회성이 첫 오류일 때 포커스도 스크롤도 조용히 실패했다**
      (#538 실측). 라디오는 `sizeType` 처럼 그룹 이름으로 오류를 받으므로(예: PET_004 의
      체중↔크기 모순) 실제로 닿는 갈래다.

      **`id` 만 붙이는 것으로는 고쳐지지 않는다.** `<fieldset>` 은 기본 포커스 대상이
      아니라서 `focus()` 가 무시된다 — 조회는 성공하는데 증상은 그대로다. `tabIndex={-1}`
      이 그것을 프로그램 포커스만 받는 요소로 만든다(순차 탭 이동에는 끼지 않는다).

      **그룹에 포커스를 주는 것이 의미상으로도 맞다.** 오류는 개별 라디오가 아니라 그룹
      단위 상태이고(아래 `aria-invalid` 주석), `aria-describedby` 가 이 요소에 걸려 있어
      포커스가 오는 순간 스크린리더가 legend 와 오류 문구를 함께 읽는다.
    */
    <fieldset
      id={id}
      tabIndex={-1}
      className={cn('flex flex-col gap-1 focus:outline-none', className)}
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

      {/*
        **`grid` 갈래는 칸 폭을 균등하게 고정한다** — `flex` 로 세 칸을 만들면 `description`
        길이가 폭을 갈라(활동량은 24자, 사회성은 9자) 같은 질문의 선택지가 서로 다른
        크기로 선다. 고르는 것은 라벨이지 설명 길이가 아니다.
      */}
      <div className={cn(grid ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2')}>
        {options.map((option) => {
          const optionId = `${id}-${option.value}`
          /*
            **입력은 한 번만 적는다.** 두 갈래가 각자 `<input>` 을 그리면 `name` · `checked` ·
            `onChange` 배선이 두 벌이 되고, 한쪽만 고친 채로 남는다.
          */
          const input = (
            <input
              type="radio"
              id={optionId}
              name={id}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onValueChange(option.value)}
              className={cn('accent-brand-500 size-4 shrink-0', !grid && 'mt-1')}
            />
          )
          const description =
            option.description !== undefined && option.description !== null ? (
              <span className="text-caption text-fg-muted break-keep">{option.description}</span>
            ) : null

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
                'flex min-h-11 cursor-pointer rounded-md border px-3 py-2',
                /*
                  세 칸일 때는 라벨과 설명이 위아래로 쌓인다. 109px 칸에서 `items-start gap-3`
                  을 그대로 쓰면 라디오 원(16)과 여백(12)이 글자 자리를 절반 가까이 먹는다.
                */
                grid ? 'flex-col gap-1' : 'items-start gap-3',
                /*
                  **`focus-within` 이 아니라 `has-[:focus-visible]` 이다.** `focus-within` 은
                  마우스 클릭에도 걸려서, 카드를 고르기만 해도 키보드용 링이 함께 떴다 —
                  선택 테두리와 겹쳐 테두리가 두 겹으로 보였다. 라디오는 클릭으로
                  `:focus-visible` 이 되지 않으므로 이 변형이 키보드 이동에서만 링을 낸다.
                */
                'has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-offset-0',
                disabled && 'cursor-not-allowed opacity-50',
                value === option.value
                  ? 'border-brand-500 bg-row-selected'
                  : 'border-border-strong',
                invalid && 'border-danger-500',
              )}
            >
              {grid ? (
                <>
                  <span className="flex items-center gap-2">
                    {input}
                    <span className="text-body-2 text-fg font-medium break-keep">
                      {option.label}
                    </span>
                  </span>
                  {description}
                </>
              ) : (
                <>
                  {input}
                  <span className="flex flex-col gap-1">
                    <span className="text-body-2 text-fg font-medium">{option.label}</span>
                    {description}
                  </span>
                </>
              )}
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
