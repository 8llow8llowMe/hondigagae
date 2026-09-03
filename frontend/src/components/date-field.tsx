'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { Calendar, dayLabel } from '@/components/calendar'
import { fieldErrorId } from '@/components/field'
import { PlanIcon } from '@/components/icons'
import { useOverlay } from '@/lib/ui/overlay'
import { cn } from '@/lib/utils/cn'

/**
 * 날짜 입력 — 눌러서 달력을 연다.
 *
 * **`<input type="date">` 를 쓰지 않는다.** 네이티브 날짜 입력은
 *  - 브라우저마다 조작이 다르다 (크롬은 달력 아이콘, 사파리는 스텝퍼, 파이어폭스는 또 다르다)
 *  - 값이 비었을 때 `연도-월-일` 같은 회색 서식이 보여 **플레이스홀더처럼 읽히지 않는다**
 *  - `min` 을 넘겨도 왜 못 고르는지 화면에 남지 않는다
 *  - 무엇보다 **여행 기간처럼 두 날짜의 관계를 보여줄 자리가 없다**
 *
 * 그래서 표시는 우리가 하고(`2026-09-12 (토)`), 고르는 것은 `Calendar` 가 맡는다.
 *
 * **`readOnly` 인 진짜 `<input>` 이다.** `<button>` 으로 만들면 `Field` 의
 * `<label htmlFor>` 가 붙지 않는다 — `button` 은 label 이 가리킬 수 있는 요소가 아니다.
 * 타이핑은 막는다: 날짜를 손으로 치게 하면 `2026/9/1` · `9월 1일` 이 들어오고 그 전부를
 * 형식 오류로 되돌려 줘야 한다.
 *
 * **달력은 오버레이가 아니라 문서 흐름 안에서 펼쳐진다.**
 *
 * 처음에는 `BottomSheet`(모바일 시트 / 데스크톱 중앙 패널)로 만들었다. 그런데 이 필드를
 * 쓰는 `PlanCreateForm` 이 **장소 상세의 `담기` 시트 안에서도** 렌더된다 — 시트 위에 시트가
 * 겹치는 것이고, `bottom-sheet.tsx` 가 "오버레이 위에 오버레이를 쌓지 않는다" 로 못박은
 * 바로 그 경우다. 팝오버(absolute)도 답이 아니다: 그 시트 본문이 `overflow-y-auto` 라
 * 잘린다. 흐름 안에서 펼치면 세 사용처(`/plans/new` · 담기 시트 · `/ai-plans/new`)가
 * 같은 한 가지 코드로 성립한다.
 *
 * 흐름 안에 있으므로 **덮개도 스크롤 잠금도 없다.** 다만 열린 것은 닫혀야 하므로
 * `Esc`·바깥 클릭·포커스 복귀는 `Menu` 와 같은 방식으로 배선한다 (이슈 #70 — 오버레이
 * 배선을 손으로 다시 만들지 않고 `useOverlay` 가 소유한다).
 *
 * **시작일·종료일을 하나의 기간 선택으로 합치지 않는다** (#162 에서 검토하고 내린 결정).
 * 클릭은 줄지만 세 가지를 잃는다.
 *  - **"시작일만 바꾸기" 가 어려워진다.** 이미 잡은 일정을 하루 미루는 것은 흔한 조작인데,
 *    기간 선택은 대개 시작을 다시 찍는 순간 종료가 지워진다
 *  - **오류를 어디에 붙일지 애매해진다.** 지금은 두 필드가 각각 `Field` 라벨·오류를 갖고
 *    있어 폼 검증이 필드 단위로 붙는다 (`schemas.ts` 가 두 키를 따로 본다)
 *  - **세 사용처 중 담기 시트는 폭이 좁다.** 두 달을 나란히 놓는 흔한 기간 UI 가 안 들어간다
 *
 * 지금 방식이 잃는 것(클릭 한 번)보다 이쪽이 크다. 대신 **두 달력 모두 고른 기간을 띠로
 * 보여 줘서**(`rangeStart`/`rangeEnd`) 관계는 그대로 읽힌다.
 */
export function DateField({
  id,
  /** `'YYYY-MM-DD'` 또는 빈 문자열 */
  value,
  onValueChange,
  /** 달력의 접근 가능한 이름. 어느 날짜를 고르는 중인지 말한다 — `여행 시작일` */
  label,
  placeholder,
  min = null,
  max = null,
  today,
  rangeStart = null,
  rangeEnd = null,
  invalid = false,
  className,
}: {
  id: string
  value: string
  onValueChange: (value: string) => void
  label: string
  placeholder: string
  min?: string | null
  max?: string | null
  today: string
  rangeStart?: string | null
  rangeEnd?: string | null
  invalid?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  /** 첫 초점을 날짜 격자로 보낸다 — `Calendar` 의 `focusRef` 주석 참고 */
  const dayRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useOverlay({
    open,
    onClose: () => setOpen(false),
    containerRef: panelRef,
    triggerRef: inputRef,
    initialFocusRef: dayRef,
    // 흐름 안에서 펼쳐진다 — 바탕은 살아 있고 스크롤도 잠그지 않는다
    lockScroll: false,
  })

  /*
    **열 때 패널이 보이는 자리까지 스크롤한다** (#162).

    흐름 안 확장이라 잘리지는 않지만, 필드가 화면 아래쪽에 있으면 펼쳐진 달력이 접힌
    화면 밖으로 나가 사용자가 직접 스크롤해야 했다.

    `useOverlay` 가 첫 초점을 날짜 격자로 보내면서 그 칸까지는 브라우저가 스크롤하지만,
    **격자 첫 칸이 보인다고 달력 아래쪽까지 보이는 것은 아니다** — 여기서 패널 전체를
    기준으로 한 번 더 맞춘다. `block: 'nearest'` 라 이미 보이면 아무 일도 하지 않는다.

    `useOverlay` 보다 **뒤에** 선언해 포커스 스크롤이 끝난 뒤에 돈다 — 순서가 바뀌면
    우리가 맞춘 위치를 포커스가 다시 흔든다.
  */
  useEffect(() => {
    if (!open) return
    panelRef.current?.scrollIntoView({ block: 'nearest' })
  }, [open])

  // 바깥을 누르면 닫는다. 덮개가 없으므로 문서에서 직접 듣는다 (`Menu` 와 같은 방식)
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) === true) return
      if (inputRef.current?.contains(target) === true) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          readOnly
          // 값이 있으면 요일까지 보여준다 — 여행 계획에서 요일은 날짜만큼 중요하다
          value={value === '' ? '' : dayLabel(value)}
          placeholder={placeholder}
          /*
            `aria-expanded` 를 붙이지 않는다 — `input` 의 암묵 role(`textbox`)이 받지
            않는 속성이다. 대신 `aria-controls` 로 펼쳐진 달력을 가리킨다.
          */
          aria-haspopup="dialog"
          {...(open ? { 'aria-controls': panelId } : {})}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? fieldErrorId(id) : undefined}
          onClick={() => setOpen(true)}
          // readOnly 라 타이핑은 들어오지 않지만 Enter·Space 는 열기여야 한다
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            setOpen(true)
          }}
          className={cn(
            // 44px — 모바일 최소 터치 영역 (DESIGN.md §7). 우측 아이콘 자리를 비운다
            'text-body-1 h-11 w-full cursor-pointer rounded-md border pr-11 pl-3 text-left',
            'placeholder:text-fg-subtle',
            'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
            invalid ? 'border-danger-500' : 'border-border-strong',
          )}
        />
        {/* 장식이다 — 입력 자체가 이미 열기 버튼이라 여기에 별도 버튼을 두지 않는다 */}
        <PlanIcon
          size={20}
          className="text-fg-subtle pointer-events-none absolute end-3 top-1/2 -translate-y-1/2"
        />
      </div>

      {open && (
        /*
          `aria-modal` 을 붙이지 않는다 — 실제로 바탕을 막지 않으므로 막는다고 말하면
          거짓이 된다. `role="dialog"` 만으로 "빠져나올 수 있는 묶음" 이 전달되고,
          `Esc` 가 실제로 그 일을 한다.

          **그림자가 없다.** 떠 있지 않고 흐름 안에 있으므로 테두리로만 묶는다 (DESIGN.md §6).
        */
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className="border-border bg-bg mt-2 rounded-md border p-3 outline-none"
        >
          <Calendar
            focusRef={dayRef}
            value={value}
            min={min}
            max={max}
            today={today}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onSelect={(date) => {
              onValueChange(date)
              // 고르면 닫고 포커스를 입력으로 되돌린다. "고르고 확인 누르기" 는
              // 한 값을 두 번 확정하는 것이다
              setOpen(false)
              inputRef.current?.focus()
            }}
          />
        </div>
      )}
    </div>
  )
}
