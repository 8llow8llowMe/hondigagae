'use client'

import { useEffect } from 'react'

import { markAboutSeen } from '@/lib/about/seen-cookie'

/**
 * `/about` 을 연 순간 소개를 본 것으로 적는다 (#950). 이후 홈의 소개 카드가 서지 않는다.
 *
 * **그리는 것이 없다.** `/about` 페이지는 세션도 프리페치도 없는 정적 화면이라 서버에서
 * 쿠키를 쓸 수 없고(서버 컴포넌트는 쿠키를 읽기만 한다), 이 조각 하나만 클라이언트다.
 */
export function MarkAboutSeen() {
  useEffect(() => {
    markAboutSeen()
  }, [])

  return null
}
