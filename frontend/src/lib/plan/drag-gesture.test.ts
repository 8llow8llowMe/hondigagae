import { describe, expect, it } from 'vitest'

import {
  advanceDragGesture,
  beginDragGesture,
  type DragGesture,
  isInteractiveOrigin,
  MOUSE_DRAG_THRESHOLD_PX,
  TOUCH_SLOP_PX,
} from '@/lib/plan/drag-gesture'

function element(tagName: string, attributes: Record<string, string> = {}) {
  return { tagName, getAttribute: (name: string) => attributes[name] ?? null }
}

const MOUSE_DOWN = { pointerType: 'mouse', pointerId: 1, button: 0, x: 100, y: 200 }
const TOUCH_DOWN = { pointerType: 'touch', pointerId: 7, button: 0, x: 100, y: 200 }

function begin(down: typeof MOUSE_DOWN): DragGesture {
  const gesture = beginDragGesture(down)
  if (gesture === null) throw new Error('누름이 시작되지 않았다')
  return gesture
}

describe('beginDragGesture — 누름을 받는가', () => {
  it('마우스 왼쪽 버튼은 대기로 시작한다 — 아직 끌기가 아니다', () => {
    expect(begin(MOUSE_DOWN)).toEqual({
      phase: 'pending',
      input: 'mouse',
      pointerId: 1,
      startX: 100,
      startY: 200,
    })
  })

  it('터치는 길게 누르기 대기로 시작한다', () => {
    expect(begin(TOUCH_DOWN)).toMatchObject({ phase: 'pending', input: 'touch' })
  })

  it('펜은 터치처럼 다룬다 — 펜도 화면을 스크롤한다', () => {
    expect(begin({ ...TOUCH_DOWN, pointerType: 'pen' })).toMatchObject({ input: 'touch' })
  })

  it('오른쪽 클릭은 받지 않는다 — 컨텍스트 메뉴와 엉킨다', () => {
    expect(beginDragGesture({ ...MOUSE_DOWN, button: 2 })).toBeNull()
  })
})

describe('advanceDragGesture — 마우스', () => {
  it(`${MOUSE_DRAG_THRESHOLD_PX}px 미만 움직임은 클릭으로 본다 — 끌기가 아니다`, () => {
    const next = advanceDragGesture(begin(MOUSE_DOWN), {
      type: 'move',
      x: 100 + MOUSE_DRAG_THRESHOLD_PX - 1,
      y: 200,
    })

    expect(next).toMatchObject({ phase: 'pending' })
  })

  it('임계값에 닿으면 끌기가 시작된다', () => {
    const next = advanceDragGesture(begin(MOUSE_DOWN), {
      type: 'move',
      x: 100,
      y: 200 + MOUSE_DRAG_THRESHOLD_PX,
    })

    expect(next).toEqual({ phase: 'active', input: 'mouse', pointerId: 1 })
  })

  it('거리는 가로·세로를 합친 직선 거리다 — 대각선도 끌기다', () => {
    const next = advanceDragGesture(begin(MOUSE_DOWN), { type: 'move', x: 104, y: 204 })

    expect(next).toMatchObject({ phase: 'active' })
  })

  it('마우스에는 길게 누르기 타이머가 없다 — 가만히 눌러 두어도 끌기가 아니다', () => {
    expect(advanceDragGesture(begin(MOUSE_DOWN), { type: 'hold' })).toMatchObject({
      phase: 'pending',
    })
  })
})

describe('advanceDragGesture — 터치', () => {
  it('0.3초를 채우면 끌기가 시작된다', () => {
    expect(advanceDragGesture(begin(TOUCH_DOWN), { type: 'hold' })).toEqual({
      phase: 'active',
      input: 'touch',
      pointerId: 7,
    })
  })

  it('떨림 정도의 움직임은 기다림을 깨지 않는다', () => {
    const next = advanceDragGesture(begin(TOUCH_DOWN), {
      type: 'move',
      x: 100,
      y: 200 + TOUCH_SLOP_PX - 1,
    })

    expect(next).toMatchObject({ phase: 'pending' })
  })

  it('길게 누르기 전에 임계값 이상 움직이면 스크롤로 보고 끝낸다', () => {
    const next = advanceDragGesture(begin(TOUCH_DOWN), {
      type: 'move',
      x: 100,
      y: 200 - TOUCH_SLOP_PX,
    })

    expect(next).toBeNull()
  })

  it('끌기가 시작된 뒤의 움직임은 끌기를 유지한다 — 멀리 가도 취소가 아니다', () => {
    const active = advanceDragGesture(begin(TOUCH_DOWN), { type: 'hold' })

    expect(advanceDragGesture(active!, { type: 'move', x: 100, y: 900 })).toEqual(active)
  })
})

describe('advanceDragGesture — 끝', () => {
  it('놓으면 어느 단계에서든 끝난다', () => {
    const pending = begin(TOUCH_DOWN)
    const active = advanceDragGesture(pending, { type: 'hold' })!

    expect(advanceDragGesture(pending, { type: 'end' })).toBeNull()
    expect(advanceDragGesture(active, { type: 'end' })).toBeNull()
  })

  it('끌기 중 또 타이머가 와도 그대로다', () => {
    const active = advanceDragGesture(begin(TOUCH_DOWN), { type: 'hold' })!

    expect(advanceDragGesture(active, { type: 'hold' })).toBe(active)
  })
})

describe('isInteractiveOrigin — 대화형 요소 위의 누름은 끌기가 아니다', () => {
  it('버튼 안(아이콘 svg)에서 시작한 누름은 제외한다', () => {
    expect(isInteractiveOrigin([element('svg'), element('BUTTON')])).toBe(true)
  })

  it('잠긴 버튼 위도 제외한다 — 맨 위의 ▲ 를 눌렀는데 카드가 딸려 오면 놀란다', () => {
    expect(isInteractiveOrigin([element('BUTTON', { disabled: '' })])).toBe(true)
  })

  it.each(['A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'SUMMARY'])('%s 도 제외한다', (tag) => {
    expect(isInteractiveOrigin([element(tag)])).toBe(true)
  })

  it('역할이 대화형이면 태그가 무엇이든 제외한다', () => {
    expect(isInteractiveOrigin([element('DIV', { role: 'button' })])).toBe(true)
    expect(isInteractiveOrigin([element('SPAN', { role: 'switch' })])).toBe(true)
  })

  it('편집 가능한 영역은 제외한다', () => {
    expect(isInteractiveOrigin([element('DIV', { contenteditable: 'true' })])).toBe(true)
    expect(isInteractiveOrigin([element('DIV', { contenteditable: '' })])).toBe(true)
  })

  it('제목 글자·배지·빈 자리는 끌기다', () => {
    expect(isInteractiveOrigin([element('SPAN'), element('DIV'), element('DIV')])).toBe(false)
    expect(isInteractiveOrigin([])).toBe(false)
  })

  it('역할이 대화형이 아닌 표시용 역할은 끌기다', () => {
    expect(isInteractiveOrigin([element('SPAN', { role: 'img' })])).toBe(false)
    expect(isInteractiveOrigin([element('DIV', { contenteditable: 'false' })])).toBe(false)
  })

  it('태그 대소문자에 흔들리지 않는다 — svg 계열은 소문자로 온다', () => {
    expect(isInteractiveOrigin([element('button')])).toBe(true)
  })
})
