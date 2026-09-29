/**
 * 카드 전체를 잡아 끌기 — **언제 끌기가 시작되는가**의 판정 (#1029).
 *
 * 번호만 잡던 때(#161)는 누르는 순간이 곧 끌기였다. 손잡이가 작고 뜻이 하나라 헷갈릴 일이
 * 없었다. **카드 전체를 잡게 하면 같은 누름이 세 가지를 뜻할 수 있다** — 클릭, 화면 스크롤,
 * 끌기. 그래서 입력마다 "끌기로 넘어가는 문턱" 을 둔다.
 *
 * - **마우스**: 몇 px 움직여야 끌기다. 누르고 바로 떼는 것은 클릭이다.
 * - **터치**: 0.3초 길게 눌러야 끌기다. 그 전에 손가락이 움직이면 **스크롤**로 본다 —
 *   카드가 화면 대부분을 덮으므로, 누르는 즉시 끌기로 잡으면 목록 위에서 화면을 올릴 수 없다.
 *
 * 순수 함수로 뺀 이유는 **상태 전이만 따로 검증하기 위해서다.** 타이머·포인터·스크롤 차단은
 * DOM 이 필요해 node 환경 테스트로 덮을 수 없고(`docs/testing-guide.md` §1), e2e 가 맡는다.
 */

/**
 * 마우스가 이만큼 움직이면 끌기다. **클릭 중 손 떨림(1~2px)보다 크고, 끌려는 사람이 기다림을
 * 느끼지 않을 만큼 작다.** 흔한 드래그 구현의 기본값(3~8px) 한가운데다.
 */
export const MOUSE_DRAG_THRESHOLD_PX = 5

/** 터치로 이만큼 누르고 있으면 끌기다 — 사용자 확정값 (#1029) */
export const TOUCH_HOLD_MS = 300

/**
 * 길게 누르는 동안 이만큼 움직이면 스크롤로 본다.
 *
 * **마우스 문턱보다 크다.** 손가락은 가만히 대고 있어도 몇 px 흔들린다 — 문턱이 작으면
 * 길게 누르기가 성립하지 않는다. 반대로 브라우저가 스크롤을 시작하는 거리(Chrome 약
 * 15px)보다는 작게 두어, 브라우저가 스크롤을 가져가기 전에 이쪽이 먼저 손을 뗀다.
 */
export const TOUCH_SLOP_PX = 8

type DragInput = 'mouse' | 'touch'

export type DragGesture =
  /** 눌렀지만 아직 끌기가 아니다 — 클릭·스크롤일 수 있다 */
  | { phase: 'pending'; input: DragInput; pointerId: number; startX: number; startY: number }
  /** 끌기 중. 이때부터 화면 스크롤을 막고 카드를 띄운다 */
  | { phase: 'active'; input: DragInput; pointerId: number }

export type DragGestureEvent =
  | { type: 'move'; x: number; y: number }
  /** 터치 길게 누르기 타이머가 찼다 */
  | { type: 'hold' }
  /** 놓았거나 브라우저가 취소했다 (`pointerup` · `pointercancel`) */
  | { type: 'end' }

/**
 * 누름 하나를 받을지 정한다. 받지 않으면 `null` — 그 누름은 이 화면의 일이 아니다.
 *
 * **펜은 터치로 다룬다.** 태블릿의 펜도 화면을 끌어 스크롤하므로, 누르는 즉시 끌기로 잡으면
 * 터치와 같은 문제가 난다.
 */
export function beginDragGesture(down: {
  pointerType: string
  pointerId: number
  button: number
  x: number
  y: number
}): DragGesture | null {
  // 왼쪽 버튼·터치·펜 접촉만(`button === 0`). 오른쪽 클릭은 컨텍스트 메뉴와 엉킨다
  if (down.button !== 0) return null

  return {
    phase: 'pending',
    input: down.pointerType === 'mouse' ? 'mouse' : 'touch',
    pointerId: down.pointerId,
    startX: down.x,
    startY: down.y,
  }
}

/**
 * 다음 상태. **`null` 은 끝** — 놓았거나, 터치가 스크롤로 판정됐다.
 *
 * 호출부는 `pending → active` 로 넘어간 순간을 보고 카드를 띄우고 스크롤을 막는다.
 */
export function advanceDragGesture(
  gesture: DragGesture,
  event: DragGestureEvent,
): DragGesture | null {
  if (event.type === 'end') return null
  if (gesture.phase === 'active') return gesture

  if (event.type === 'hold') {
    // 마우스에는 타이머가 없다 — 가만히 눌러 둔 것은 여전히 클릭 후보다
    return gesture.input === 'touch' ? activate(gesture) : gesture
  }

  const distance = Math.hypot(event.x - gesture.startX, event.y - gesture.startY)

  if (gesture.input === 'mouse') {
    return distance >= MOUSE_DRAG_THRESHOLD_PX ? activate(gesture) : gesture
  }

  // 길게 누르기 전에 움직였다 — 사용자는 화면을 올리려는 것이다
  return distance >= TOUCH_SLOP_PX ? null : gesture
}

function activate(gesture: DragGesture): DragGesture {
  return { phase: 'active', input: gesture.input, pointerId: gesture.pointerId }
}

/** 누름의 출발점과 그 조상 — 태그와 속성만 본다. DOM `Element` 가 그대로 맞는다 */
export type ElementLike = {
  tagName: string
  getAttribute: (name: string) => string | null
}

const INTERACTIVE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'SUMMARY'])

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'menuitem',
  'option',
  'tab',
  'textbox',
  'slider',
  'spinbutton',
  'combobox',
])

/**
 * 누름이 **대화형 요소 위에서** 시작됐는가. 그렇다면 끌기로 잡지 않는다.
 *
 * `삭제` · ▲▼ 를 누르다 손이 조금 흔들렸다고 카드가 딸려 오면 버튼을 누를 수 없다. **잠긴
 * 버튼도 제외한다** — 맨 위의 ▲ 를 눌렀는데 카드가 들리면 놀란다.
 *
 * @param chain 누른 요소부터 카드 바로 안쪽까지의 조상 목록. 카드 자신은 넣지 않는다
 */
export function isInteractiveOrigin(chain: readonly ElementLike[]): boolean {
  return chain.some((node) => {
    if (INTERACTIVE_TAGS.has(node.tagName.toUpperCase())) return true

    const role = node.getAttribute('role')
    if (role !== null && INTERACTIVE_ROLES.has(role)) return true

    const editable = node.getAttribute('contenteditable')
    return editable !== null && editable !== 'false'
  })
}
