import { describe, expect, it } from 'vitest'

import { fillTemplate } from '@/lib/text/template'

describe('fillTemplate', () => {
  it('자리표시자를 값으로 바꾼다', () => {
    expect(fillTemplate('{title} 일정을 삭제할까요?', { title: '제주 여행' })).toBe(
      '제주 여행 일정을 삭제할까요?',
    )
  })

  it('숫자 값은 문자열로 넣는다', () => {
    expect(fillTemplate('{day}일차', { day: 2 })).toBe('2일차')
  })

  /*
    #1487 — `String.prototype.replace` 에 문자열을 두 번째 인자로 주면 `$&` `$'`
    `` $` `` `$$` 가 치환 패턴으로 해석된다. 사용자 입력은 글자 그대로 보여야 한다.
  */
  it.each([
    ['$&', '가격 $& 이하'],
    ["$'", "끝 $' 표시"],
    ['$`', '앞 $` 표시'],
    ['$$', '달러 $$ 두 개'],
    ['$1', '그룹 $1 참조'],
    ['$<key>', '이름 $<key> 그룹'],
  ])('값 안의 %s 를 치환 패턴으로 해석하지 않는다', (_pattern, value) => {
    expect(fillTemplate('요청 “{note}”', { note: value })).toBe(`요청 “${value}”`)
  })

  it('값에 다른 자리표시자가 들어 있어도 다시 치환하지 않는다', () => {
    expect(fillTemplate('{title} · {time}', { title: '{time} 산책', time: '09:00' })).toBe(
      '{time} 산책 · 09:00',
    )
  })

  it('같은 자리표시자가 여러 번 나오면 모두 바꾼다', () => {
    expect(fillTemplate('{name}와 {name}', { name: '몽실이' })).toBe('몽실이와 몽실이')
  })

  it('값이 없는 자리표시자는 그대로 둔다', () => {
    expect(fillTemplate('{title} · {missing}', { title: '제목' })).toBe('제목 · {missing}')
  })

  it('Object 원형의 이름을 자리표시자로 오인하지 않는다', () => {
    expect(fillTemplate('{constructor} {toString}', {})).toBe('{constructor} {toString}')
  })
})
