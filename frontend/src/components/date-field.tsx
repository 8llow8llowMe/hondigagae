'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Calendar, dayLabel } from '@/components/calendar'
import { fieldErrorId } from '@/components/field'
import { PlanIcon } from '@/components/icons'
import { type AnchoredPosition, anchoredPosition } from '@/lib/ui/anchored-position'
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
 * **달력은 `document.body` 로 포털된 `fixed` 팝오버다.**
 *
 * 처음에는 `BottomSheet`(모바일 시트 / 데스크톱 중앙 패널)로 만들었다. 그런데 이 필드를
 * 쓰는 `PlanCreateForm` 이 **장소 상세의 `담기` 시트 안에서도** 렌더된다 — 시트 위에 시트가
 * 겹치는 것이고, `bottom-sheet.tsx` 가 "오버레이 위에 오버레이를 쌓지 않는다" 로 못박은
 * 바로 그 경우다. 그 다음에는 흐름 안에서 펼쳤다 — 세 사용처가 한 코드로 성립했지만
 * **열 때마다 아래 내용이 300px 밀렸다.**
 *
 * **포털 + `fixed` 가 세 번째 답이다.** body 에 붙은 `fixed` 는 조상 `overflow` 가 없어
 * 담기 시트의 `overflow-hidden`(패널) · `overflow-y-auto`(본문) 를 모두 빠져나간다.
 * `absolute` 팝오버가 잘렸던 이유가 사라지고, 세 사용처가 여전히 한 코드다.
 *
 * 좌표는 `lib/ui/anchored-position.ts` 가 정한다 — 순수 함수라 뒤집기·clamp 가 node 에서
 * 테스트된다. 스크롤하면 닫는다(재배치보다 단순하다). `z-[60]` 은 담기 시트(`z-50`) 위다.
 *
 * 이제 **진짜로 떠 있으므로 그림자가 있다** (DESIGN.md §6). 흐름 안이던 때 그림자가
 * 없었던 것은 떠 있지 않았기 때문이다.
 *
 * `Esc`·바깥 클릭·포커스 복귀는 `useOverlay` 가 그대로 소유한다 — ref 기반이라 포털
 * 노드에서도 성립한다 (이슈 #70). 다만 포털로 나가면서 **Tab 가두기**와 **스크롤로 닫힐 때의
 * 포커스 복귀**는 따로 켜야 했다 — 아래 `useOverlay` 호출의 옵션 주석 참고.
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
  open: openProp,
  onOpenChange,
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
  /**
   * 열림 상태를 부모가 쥔다. **생략하면 내부 상태를 쓴다** — 세 사용처 중 둘은 그대로다.
   *
   * 기간 입력이 이것을 쓴다: 시작일을 고른 순간 종료일 달력을 이어서 연다. 두 필드를
   * 하나의 기간 선택으로 합치지 않기로 한 결정(#162)을 지키면서, 합쳤을 때 얻는 흐름만
   * 가져오는 방법이다.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  /*
    **controlled / uncontrolled 둘 다 받는다.** `open` 을 넘기지 않으면 지금까지처럼
    자기 상태로 연다 — 기존 사용처를 건드리지 않기 위해서다.
  */
  const [selfOpen, setSelfOpen] = useState(false)
  const open = openProp ?? selfOpen
  const setOpen = useCallback(
    (next: boolean) => {
      // controlled 면 부모만 상태를 바꾼다. 둘 다 쓰면 한쪽이 뒤늦게 되돌린다
      if (onOpenChange !== undefined) onOpenChange(next)
      else setSelfOpen(next)
    },
    [onOpenChange],
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  /** 첫 초점을 날짜 격자로 보낸다 — `Calendar` 의 `focusRef` 주석 참고 */
  const dayRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const [position, setPosition] = useState<AnchoredPosition | null>(null)

  /*
    **열린 뒤에 잰다.** 패널이 마운트돼야 크기를 알 수 있어 `useLayoutEffect` 로 그린 직후
    측정한다 — `useEffect` 로 두면 좌상단(0,0)에 한 프레임 그려졌다가 제자리로 튄다.
  */
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const anchor = inputRef.current?.getBoundingClientRect()
    const panel = panelRef.current?.getBoundingClientRect()
    if (anchor === undefined || panel === undefined) return

    setPosition(
      anchoredPosition(
        { top: anchor.top, bottom: anchor.bottom, left: anchor.left, width: anchor.width },
        { width: panel.width, height: panel.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    )
  }, [open])

  useOverlay({
    open,
    onClose: () => setOpen(false),
    containerRef: panelRef,
    triggerRef: inputRef,
    initialFocusRef: dayRef,
    // 바탕을 막지 않는다 — 덮개가 없고, 스크롤은 잠그는 대신 닫는 것으로 처리한다
    lockScroll: false,
    /*
      **포털로 나갔으니 Tab 도 가둔다.** 흐름 안에서 펼치던 때는 Tab 이 종료일 필드로
      이어졌지만, 지금 이 패널은 `body` 의 마지막 자식이라 Tab 이 문서 맨 끝으로 빠진다 —
      달력을 열어 둔 채 페이지 전체를 훑게 된다. 나가는 길은 이미 둘 다 있다: Esc 와 날짜
      선택이 닫으면서 입력으로 포커스를 돌려주고, 거기서부터 Tab 은 원래대로 흐른다.
    */
    trapFocus: true,
    /*
      **스크롤로 닫힐 때 화면을 되감지 않는다.** 아래 effect 가 스크롤을 닫기 조건으로
      쓰는데, 복귀 포커스가 기본 동작이면 화면 밖으로 밀려난 입력을 브라우저가 다시 끌어와
      방금 굴린 만큼이 통째로 되돌아간다. Esc · 날짜 선택 경로에서는 입력이 이미 화면 안이라
      아무것도 달라지지 않는다.
    */
    restoreFocusPreventScroll: true,
  })

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

  /*
    **스크롤하면 닫는다.** `fixed` 라 페이지가 움직여도 패널은 제자리에 남아 입력에서
    떨어진다. 재배치보다 닫는 쪽이 단순하고 날짜 피커에서 흔한 처리다.

    **중첩 스크롤러를 잡으려면 `capture: true` 여야 한다** — 담기 시트 본문이
    `overflow-y-auto` 라(`bottom-sheet.tsx:92`) 그 스크롤은 window 까지 버블링되지 않는다.

    **다음 프레임에 붙인다.** `useOverlay` 가 패널로 초기 포커스를 옮기는데, 그 포커스가
    스크롤을 유발하면 방금 건 리스너가 열리자마자 닫아 버린다.
  */
  useEffect(() => {
    if (!open) return

    let dispose = () => undefined as void
    const raf = requestAnimationFrame(() => {
      const close = () => setOpen(false)
      window.addEventListener('scroll', close, true)
      window.addEventListener('resize', close)
      dispose = () => {
        window.removeEventListener('scroll', close, true)
        window.removeEventListener('resize', close)
      }
    })

    return () => {
      cancelAnimationFrame(raf)
      dispose()
    }
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
            /*
              44px — 모바일 최소 터치 영역 (DESIGN.md §7).

              **우측은 아이콘 자리를 비운다.** 아이콘은 `end-3`(12) 에 20px 이라 오른쪽
              32px 을 먹는다. `pr-10`(40) 이면 글자와 아이콘 사이가 8px 남는다 — 예전
              `pr-11`(44) 은 스케일 밖 값이었고(§4) 필요보다 4px 넓었다.
            */
            'text-body-1 h-11 w-full cursor-pointer rounded-md border pr-10 pl-3 text-left',
            'placeholder:text-fg-subtle',
            'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-none',
            invalid ? 'border-danger-500' : 'border-border-strong',
          )}
        />
        {/* 장식이다 — 입력 자체가 이미 열기 버튼이라 여기에 별도 버튼을 두지 않는다 */}
        <PlanIcon
          size={20}
          className="text-fg-subtle pointer-events-none absolute end-3 top-1/2 -translate-y-1/2"
        />
      </div>

      {open &&
        /*
          `aria-modal` 을 붙이지 않는다 — 실제로 바탕을 막지 않으므로 막는다고 말하면
          거짓이 된다. `role="dialog"` 만으로 "빠져나올 수 있는 묶음" 이 전달되고,
          `Esc` 가 실제로 그 일을 한다.
        */
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              minWidth: position?.minWidth ?? 0,
              /*
                `visibility: hidden` 이 아니라 `opacity` 로 감춘다. `useOverlay` 가 마운트
                직후 이 패널에 `.focus()` 를 거는데, `visibility: hidden` 인 요소는 포커스를
                받지 못한다 — 재는 동안 포커스가 날아가 버리는 것이다. `opacity: 0` 은 안
                보이게 하면서도 포커스는 그대로 받아 준다. 대신 좌상단(0,0)에 한 프레임
                떠 있는 동안 눌리면 안 되므로 `pointerEvents: 'none'` 으로 클릭만 막는다.
              */
              opacity: position === null ? 0 : 1,
              pointerEvents: position === null ? 'none' : undefined,
            }}
            className="border-border bg-bg fixed z-[60] rounded-md border p-3 shadow-md outline-none"
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
          </div>,
          document.body,
        )}
    </div>
  )
}
