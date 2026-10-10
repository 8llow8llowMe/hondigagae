import { describe, expect, it } from 'vitest'

import {
  CLOCK_DEFAULT,
  clockKeyValue,
  formatClockPart,
  initialClockTime,
  parsePastedClock,
  readClockInput,
  stepClock,
  toClockTime,
  toServerStartTime,
  typeClockDigit,
} from '@/lib/plan/clock-time'
import { planItem } from '@/test/fixtures/plan'

describe('stepClock — ▲▼ · 방향키', () => {
  it('시는 1 단위다', () => {
    expect(stepClock('hour', 10, 1)).toBe(11)
    expect(stepClock('hour', 10, -1)).toBe(9)
  })

  it('시는 23 ↔ 00 으로 순환한다', () => {
    expect(stepClock('hour', 23, 1)).toBe(0)
    expect(stepClock('hour', 0, -1)).toBe(23)
  })

  it('분은 5 단위다', () => {
    expect(stepClock('minute', 30, 1)).toBe(35)
    expect(stepClock('minute', 30, -1)).toBe(25)
  })

  it('분은 55 ↔ 00 으로 순환한다', () => {
    expect(stepClock('minute', 55, 1)).toBe(0)
    expect(stepClock('minute', 0, -1)).toBe(55)
  })

  it('5 의 배수가 아닌 분은 가까운 5 의 배수로 붙는다 — 07 ↑ 10, 07 ↓ 05', () => {
    expect(stepClock('minute', 7, 1)).toBe(10)
    expect(stepClock('minute', 7, -1)).toBe(5)
  })

  it('58 ↑ 은 00, 02 ↓ 는 00 이다', () => {
    expect(stepClock('minute', 58, 1)).toBe(0)
    expect(stepClock('minute', 2, -1)).toBe(0)
  })
})

describe('clockKeyValue — 키 → 다음 값', () => {
  it('↑ ↓ 는 stepClock 과 같다', () => {
    expect(clockKeyValue('hour', 10, 'ArrowUp')).toBe(11)
    expect(clockKeyValue('minute', 30, 'ArrowDown')).toBe(25)
  })

  it('Home · End 는 최솟값 · 최댓값이다 (APG spinbutton)', () => {
    expect(clockKeyValue('hour', 10, 'Home')).toBe(0)
    expect(clockKeyValue('hour', 10, 'End')).toBe(23)
    expect(clockKeyValue('minute', 10, 'End')).toBe(59)
  })

  it('다른 키는 null — 호출부가 기본 동작을 막지 않는다', () => {
    expect(clockKeyValue('hour', 10, 'Tab')).toBeNull()
    expect(clockKeyValue('hour', 10, 'Enter')).toBeNull()
    expect(clockKeyValue('hour', 10, '5')).toBeNull()
  })
})

describe('typeClockDigit — 숫자 직접 입력 (두 자리)', () => {
  it('첫 자리가 십의 자리가 될 수 있으면 기다린다 — 시 1', () => {
    expect(typeClockDigit('hour', '', 1)).toEqual({ value: 1, buffer: '1', complete: false })
  })

  it('두 번째 자리로 두 자리를 채운다 — 시 1 → 14', () => {
    expect(typeClockDigit('hour', '1', 4)).toEqual({ value: 14, buffer: '', complete: true })
  })

  it('십의 자리가 될 수 없는 첫 자리는 바로 끝난다 — 시 3 은 03', () => {
    expect(typeClockDigit('hour', '', 3)).toEqual({ value: 3, buffer: '', complete: true })
  })

  it('범위를 넘는 두 자리는 새 첫 자리로 다시 시작한다 — 시 2 → 5 는 05', () => {
    expect(typeClockDigit('hour', '2', 5)).toEqual({ value: 5, buffer: '', complete: true })
  })

  it('시 2 → 3 은 23 이다', () => {
    expect(typeClockDigit('hour', '2', 3)).toEqual({ value: 23, buffer: '', complete: true })
  })

  it('분은 1 단위로 들어간다 — 0 → 7 은 07', () => {
    expect(typeClockDigit('minute', '0', 7)).toEqual({ value: 7, buffer: '', complete: true })
  })

  it('분 5 → 9 는 59, 분 6 은 바로 06', () => {
    expect(typeClockDigit('minute', '5', 9)).toEqual({ value: 59, buffer: '', complete: true })
    expect(typeClockDigit('minute', '', 6)).toEqual({ value: 6, buffer: '', complete: true })
  })
})

describe('readClockInput — 입력칸 onChange 에서 방금 친 것 읽기', () => {
  it('insertText 는 넣은 글자를 읽는다 — 전체 선택을 덮어쓴 경우도 같다', () => {
    expect(readClockInput({ inputType: 'insertText', data: '7', raw: '7', caret: 1 })).toEqual({
      kind: 'digit',
      digit: 7,
    })
  })

  it('전체 선택 위에 1 을 쳐도 지우기로 읽지 않는다 — 길이로 가르면 틀린다', () => {
    expect(readClockInput({ inputType: 'insertText', data: '1', raw: '1', caret: 1 })).toEqual({
      kind: 'digit',
      digit: 1,
    })
  })

  it('delete 계열은 지우기다', () => {
    expect(
      readClockInput({ inputType: 'deleteContentBackward', data: null, raw: '1', caret: 1 }),
    ).toEqual({ kind: 'clear' })
  })

  it('숫자가 아닌 글자는 무시한다', () => {
    expect(readClockInput({ inputType: 'insertText', data: 'a', raw: '10a', caret: 3 })).toBeNull()
  })

  /* 마지막 숫자 하나만 읽으면 `14` 가 `04` 가 되고 `10:30` 이 `0` 이 됐다 (#1028 검토) */
  it('붙여넣기는 글 전체를 넘긴다 — 한 글자로 읽지 않는다', () => {
    expect(
      readClockInput({ inputType: 'insertFromPaste', data: '10:30', raw: '10:30', caret: 5 }),
    ).toEqual({ kind: 'paste', text: '10:30' })
  })

  it('insertText 라도 여러 글자가 한 번에 들어오면 붙여넣기로 본다 (자동완성·음성 입력)', () => {
    expect(readClockInput({ inputType: 'insertText', data: '14', raw: '14', caret: 2 })).toEqual({
      kind: 'paste',
      text: '14',
    })
  })

  it('inputType 을 모르면 커서 바로 앞 글자를 읽는다', () => {
    expect(readClockInput({ inputType: null, data: null, raw: '150', caret: 2 })).toEqual({
      kind: 'digit',
      digit: 5,
    })
    expect(readClockInput({ inputType: null, data: null, raw: '104', caret: null })).toEqual({
      kind: 'digit',
      digit: 4,
    })
  })

  it('inputType 을 모르고 비었으면 지우기다', () => {
    expect(readClockInput({ inputType: null, data: null, raw: '', caret: 0 })).toEqual({
      kind: 'clear',
    })
  })
})

describe('toClockTime · toServerStartTime · formatClockPart', () => {
  it('서버 원문 HH:mm:ss 를 시 · 분으로 읽는다', () => {
    expect(toClockTime('10:30:00')).toEqual({ hour: 10, minute: 30 })
  })

  it('초 없는 원문도 받는다 — 응답 형식이 확정되지 않았다 (D14-8 미결 1)', () => {
    expect(toClockTime('09:05')).toEqual({ hour: 9, minute: 5 })
  })

  it('없거나 형식이 어긋나면 null 이다', () => {
    expect(toClockTime(null)).toBeNull()
    expect(toClockTime('오전 10시')).toBeNull()
  })

  it('보낼 때는 HH:mm:ss 다 — 요청 계약이 못박았다 (G1)', () => {
    expect(toServerStartTime({ hour: 9, minute: 5 })).toBe('09:05:00')
    expect(toServerStartTime({ hour: 23, minute: 59 })).toBe('23:59:00')
  })

  it('두 자리로 채운다', () => {
    expect(formatClockPart(0)).toBe('00')
    expect(formatClockPart(7)).toBe('07')
    expect(formatClockPart(12)).toBe('12')
  })
})

describe('initialClockTime — 모달을 열 때의 값', () => {
  const day = [
    planItem({ day: 1, planItemId: 'a', sequence: 0, startTime: '09:30:00' }),
    planItem({ day: 1, planItemId: 'b', sequence: 1, startTime: null }),
    planItem({ day: 1, planItemId: 'c', sequence: 2, startTime: '14:00:00' }),
    planItem({ day: 1, planItemId: 'd', sequence: 3, startTime: null }),
  ]

  it('이미 시각이 있으면 그 값이다', () => {
    expect(initialClockTime(day, 'c')).toEqual({ hour: 14, minute: 0 })
  })

  it('없으면 가장 가까운 앞 항목의 시각이다 — 하루는 순서대로 흘러간다', () => {
    expect(initialClockTime(day, 'b')).toEqual({ hour: 9, minute: 30 })
    expect(initialClockTime(day, 'd')).toEqual({ hour: 14, minute: 0 })
  })

  it('뒤 항목의 시각은 보지 않는다 — 앞 항목이 없으면 기본값이다', () => {
    const noneBefore = [
      planItem({ day: 1, planItemId: 'x', sequence: 0, startTime: null }),
      planItem({ day: 1, planItemId: 'y', sequence: 1, startTime: '15:00:00' }),
    ]

    expect(initialClockTime(noneBefore, 'x')).toEqual(CLOCK_DEFAULT)
  })

  it('기본값은 10:00 이다', () => {
    expect(CLOCK_DEFAULT).toEqual({ hour: 10, minute: 0 })
  })

  it('형식이 어긋난 앞 항목 시각은 건너뛴다 — 지어내지 않는다', () => {
    const broken = [
      planItem({ day: 1, planItemId: 'a', sequence: 0, startTime: '08:00:00' }),
      planItem({ day: 1, planItemId: 'b', sequence: 1, startTime: '오전 10시' }),
      planItem({ day: 1, planItemId: 'c', sequence: 2, startTime: null }),
    ]

    expect(initialClockTime(broken, 'c')).toEqual({ hour: 8, minute: 0 })
  })
})

describe('parsePastedClock — 붙여넣은 글을 시각으로 (#1028 검토)', () => {
  it('`HH:MM` 이면 칸과 무관하게 시·분을 함께 채운다', () => {
    expect(parsePastedClock('hour', '10:30')).toEqual({ hour: 10, minute: 30 })
    expect(parsePastedClock('minute', ' 9:05 ')).toEqual({ hour: 9, minute: 5 })
    expect(parsePastedClock('hour', '14시 20분')).toEqual({ hour: 14, minute: 20 })
  })

  it('숫자 네 자리·세 자리는 뒤 두 자리가 분이다', () => {
    expect(parsePastedClock('hour', '1030')).toEqual({ hour: 10, minute: 30 })
    expect(parsePastedClock('hour', '930')).toEqual({ hour: 9, minute: 30 })
  })

  it('숫자 한두 자리는 그 칸의 값이다', () => {
    expect(parsePastedClock('hour', '14')).toEqual({ hour: 14 })
    expect(parsePastedClock('minute', '7')).toEqual({ minute: 7 })
  })

  it('범위를 넘거나 숫자가 없으면 아무것도 바꾸지 않는다', () => {
    expect(parsePastedClock('hour', '25')).toBeNull()
    expect(parsePastedClock('minute', '75')).toBeNull()
    expect(parsePastedClock('hour', '24:00')).toBeNull()
    expect(parsePastedClock('hour', '12:60')).toBeNull()
    expect(parsePastedClock('hour', 'abc')).toBeNull()
    expect(parsePastedClock('hour', '12345')).toBeNull()
  })
})
