import { describe, expect, it } from 'vitest'

import { parseHomepage } from '@/lib/place/homepage'

describe('parseHomepage — HTML anchor 원문 처리', () => {
  it('anchor 에서 href 를 뽑는다', () => {
    expect(
      parseHomepage('<a href="https://www.visitjeju.net" target="_blank">비짓제주</a>'),
    ).toEqual({ href: 'https://www.visitjeju.net/', label: 'www.visitjeju.net' })
  })

  it('anchor 가 여러 개면 첫 번째를 쓴다', () => {
    const raw = '<a href="https://a.example.com">A</a> <a href="https://b.example.com">B</a>'

    expect(parseHomepage(raw)?.href).toBe('https://a.example.com/')
  })

  it('작은따옴표 href 도 처리한다', () => {
    expect(parseHomepage("<a href='http://jeju.go.kr'>제주도청</a>")?.href).toBe(
      'http://jeju.go.kr/',
    )
  })

  it('anchor 가 아닌 순수 URL 도 처리한다', () => {
    expect(parseHomepage('https://www.jeju.go.kr/tour')?.href).toBe('https://www.jeju.go.kr/tour')
  })

  it('스킴이 없는 도메인은 https 로 보정한다', () => {
    expect(parseHomepage('www.jejutour.go.kr')?.href).toBe('https://www.jejutour.go.kr/')
  })

  it('javascript 스킴을 거부한다', () => {
    expect(parseHomepage('<a href="javascript:alert(1)">클릭</a>')).toBeNull()
    expect(parseHomepage('javascript:alert(1)')).toBeNull()
  })

  it('data 스킴을 거부한다', () => {
    expect(parseHomepage('<a href="data:text/html,<h1>x</h1>">x</a>')).toBeNull()
  })

  it('URL 로 볼 수 없으면 null 이다', () => {
    expect(parseHomepage('전화 문의 바랍니다')).toBeNull()
    expect(parseHomepage('')).toBeNull()
    expect(parseHomepage(null)).toBeNull()
  })
})
