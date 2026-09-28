import { describe, expect, it } from 'vitest'

import { editGroupedDigits, formatGroupedDigits } from '@/lib/form/grouped-digits'

/**
 * 금액 입력칸의 순수 로직 — 이슈 #986.
 *
 * 입력란에는 `300,000` 이 보이고 **폼 값은 숫자만(`'300000'`)** 이다. 쉼표를 넣고 빼는 동안
 * 커서가 끝으로 튀지 않는지가 이 파일의 핵심이다 — node 환경이라 실제 커서는 못 보지만
 * "몇 번째 칸에 둘지" 는 여기서 정해지고, 컴포넌트는 그 값을 그대로 옮기기만 한다.
 *
 * 커서는 `|` 로 표기한 문자열에서 뽑는다 — 숫자로 적으면 어느 자리인지 읽히지 않는다.
 */
function at(marked: string): { raw: string; caret: number } {
  const caret = marked.indexOf('|')
  if (caret === -1) throw new Error(`커서 표기(|)가 없다: ${marked}`)
  return { raw: marked.replace('|', ''), caret }
}

function mark(display: string, caret: number): string {
  return `${display.slice(0, caret)}|${display.slice(caret)}`
}

type Edit = { previousDigits: string; inputType?: string | null }

/** 편집 직후 입력란(`marked`)을 넣고, 다시 그린 입력란을 같은 표기로 돌려받는다 */
function edit(marked: string, { previousDigits, inputType = 'insertText' }: Edit) {
  const result = editGroupedDigits({ ...at(marked), previousDigits, inputType })
  return { digits: result.digits, view: mark(result.display, result.caret) }
}

describe('formatGroupedDigits — 폼 값을 입력란 표기로', () => {
  it('세 자리마다 쉼표를 넣는다', () => {
    expect(formatGroupedDigits('300000')).toBe('300,000')
    expect(formatGroupedDigits('1234567')).toBe('1,234,567')
    expect(formatGroupedDigits('2147483647')).toBe('2,147,483,647')
  })

  it('세 자리 이하는 그대로다', () => {
    expect(formatGroupedDigits('0')).toBe('0')
    expect(formatGroupedDigits('30')).toBe('30')
    expect(formatGroupedDigits('999')).toBe('999')
  })

  it('빈 값은 빈 값이다 — "안 정했다" 를 0 으로 바꾸지 않는다', () => {
    expect(formatGroupedDigits('')).toBe('')
  })

  /*
    `Number()` · `toLocaleString` 을 거치지 않는다는 것을 잠근다. 상한(`2147483647`)을 넘긴
    값도 **검증 문구가 뜰 때까지는 적힌 그대로** 보여야 한다 — 정밀도를 잃은 수로 바뀌면
    "자릿수를 확인해 주세요" 를 읽고 확인할 자릿수가 이미 달라져 있다.
  */
  it('긴 값도 자릿수를 잃지 않는다', () => {
    expect(formatGroupedDigits('99999999999999999999')).toBe('99,999,999,999,999,999,999')
  })
})

describe('editGroupedDigits — 입력', () => {
  it('끝에 이어 치면 쉼표가 생겨도 커서는 끝에 있다', () => {
    expect(edit('30000|', { previousDigits: '3000' })).toEqual({
      digits: '30000',
      view: '30,000|',
    })
    expect(edit('30,0000|', { previousDigits: '30000' })).toEqual({
      digits: '300000',
      view: '300,000|',
    })
    expect(edit('300,0000|', { previousDigits: '300000' })).toEqual({
      digits: '3000000',
      view: '3,000,000|',
    })
  })

  it('가운데에 끼워 치면 방금 친 숫자 바로 뒤에 커서가 선다', () => {
    // 3|0,000 에 1 → 31|0,000 이 아니라 쉼표 자리가 바뀐 310,000 에서 "1" 뒤
    expect(edit('31|0,000', { previousDigits: '30000' })).toEqual({
      digits: '310000',
      view: '31|0,000',
    })
    // 쉼표가 커서 앞으로 새로 생기는 경우 — 3|,000 에 5 → 35,000 의 "5" 뒤
    expect(edit('35|,000', { previousDigits: '3000' })).toEqual({
      digits: '35000',
      view: '35|,000',
    })
    // 쉼표가 하나 늘어 커서 앞 글자 수가 달라지는 경우
    expect(edit('1|300,000', { previousDigits: '300000' })).toEqual({
      digits: '1300000',
      view: '1|,300,000',
    })
  })

  it('숫자가 아닌 글자는 버리고 커서는 제자리다', () => {
    expect(edit('300a|', { previousDigits: '300' })).toEqual({ digits: '300', view: '300|' })
    expect(edit('3a|00', { previousDigits: '300' })).toEqual({ digits: '300', view: '3|00' })
    // 부호 · 소수점 · 지수 표기도 글자일 뿐이다 — `Number('1e3')` 이 1000 인 함정을 여기서 끊는다
    expect(edit('-|', { previousDigits: '' })).toEqual({ digits: '', view: '|' })
    expect(edit('1.|', { previousDigits: '1' })).toEqual({ digits: '1', view: '1|' })
    expect(edit('1e|', { previousDigits: '1' })).toEqual({ digits: '1', view: '1|' })
  })

  it('앞자리 0 은 떼어 낸다 — 0 하나만은 값이다', () => {
    expect(edit('05|', { previousDigits: '0' })).toEqual({ digits: '5', view: '5|' })
    expect(edit('0|300', { previousDigits: '300' })).toEqual({ digits: '300', view: '|300' })
    expect(edit('0|', { previousDigits: '' })).toEqual({ digits: '0', view: '0|' })
    expect(edit('00|', { previousDigits: '0' })).toEqual({ digits: '0', view: '0|' })
  })
})

describe('editGroupedDigits — 붙여넣기', () => {
  const paste = { previousDigits: '', inputType: 'insertFromPaste' }

  it('단위 · 쉼표가 섞인 금액에서 숫자만 남긴다', () => {
    expect(edit('300,000원|', paste)).toEqual({ digits: '300000', view: '300,000|' })
    expect(edit('300000|', paste)).toEqual({ digits: '300000', view: '300,000|' })
    expect(edit('₩ 1,200,000|', paste)).toEqual({ digits: '1200000', view: '1,200,000|' })
    expect(edit(' 45 000 |', paste)).toEqual({ digits: '45000', view: '45,000|' })
  })

  it('전각 숫자도 숫자로 읽는다 — 한국어 IME 가 전각으로 두는 경우가 있다', () => {
    expect(edit('３００，０００|', paste)).toEqual({ digits: '300000', view: '300,000|' })
  })

  it('숫자가 하나도 없으면 빈 값이다', () => {
    expect(edit('미정|', paste)).toEqual({ digits: '', view: '|' })
  })

  it('있던 값 가운데에 붙여 넣어도 붙여 넣은 끝 뒤에 커서가 선다', () => {
    expect(edit('1,000|000', { previousDigits: '1000', inputType: 'insertFromPaste' })).toEqual({
      digits: '1000000',
      view: '1,000|,000',
    })
  })
})

describe('editGroupedDigits — 지우기', () => {
  it('숫자를 지우면 쉼표가 다시 자리를 잡고 커서는 지운 자리에 있다', () => {
    expect(
      edit('300,00|', { previousDigits: '300000', inputType: 'deleteContentBackward' }),
    ).toEqual({ digits: '30000', view: '30,000|' })
    expect(edit('3|,000', { previousDigits: '30000', inputType: 'deleteContentBackward' })).toEqual(
      { digits: '3000', view: '3|,000' },
    )
  })

  it('전부 지우면 빈 값이다 — 0 이 아니다', () => {
    expect(edit('|', { previousDigits: '300000', inputType: 'deleteContentBackward' })).toEqual({
      digits: '',
      view: '|',
    })
  })

  /*
    **쉼표 바로 뒤에서 백스페이스를 누르면 쉼표만 지워진다.** 그대로 두면 다시 그릴 때 쉼표가
    되살아나 "눌렀는데 아무 일도 없다" 가 된다. 쉼표는 사용자가 친 글자가 아니므로 그 앞 숫자를
    지운 것으로 읽는다.
  */
  it('쉼표 뒤 백스페이스는 쉼표 앞 숫자를 지운다', () => {
    expect(
      edit('300|000', { previousDigits: '300000', inputType: 'deleteContentBackward' }),
    ).toEqual({ digits: '30000', view: '30|,000' })
  })

  it('쉼표 앞 Delete 는 쉼표 뒤 숫자를 지운다', () => {
    expect(
      edit('300|000', { previousDigits: '300000', inputType: 'deleteContentForward' }),
    ).toEqual({ digits: '30000', view: '30,0|00' })
  })

  it('입력 종류를 모르면 쉼표만 지운 편집은 되살린다 — 추측으로 숫자를 지우지 않는다', () => {
    expect(edit('300|000', { previousDigits: '300000', inputType: null })).toEqual({
      digits: '300000',
      view: '300|,000',
    })
  })
})
