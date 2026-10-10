'use client'

import { useEffect, useRef } from 'react'

/**
 * 해시 앵커로 **자료가 안정된 뒤** 다시 정렬한다.
 *
 * **왜 필요한가**: 브라우저의 해시 스크롤은 문서가 로드되는 즉시 일어나는데, 일정 상세는
 * 그 뒤에 도착하는 것들이 전부 앵커 **위** 콘텐츠를 키운다 — 항목 보강(`GET /places/{id}`)이
 * 행마다 주소·거리 줄을 더하고, 판정이 일자마다 브리핑 블록을 통째로 더한다. 그래서 담기를
 * 마치고 `/plans/{id}#day3` 으로 돌아오면 3일차가 화면 밖으로 밀린다
 * (실측: 고치기 전 741px 아래).
 *
 * **해시를 `ready` 가 참이 되는 순간에 읽는다.** 렌더 시점에 읽으면 클라이언트 이동에서
 * 주소 갱신과 렌더 순서가 보장되지 않아 빈 해시를 잡고 영영 움직이지 않는다 (실측).
 *
 * **한 번만 움직인다.** 그 뒤의 목차 클릭은 자료가 이미 안정돼 있어 브라우저 기본 동작으로
 * 충분하고, 여기서 계속 개입하면 사용자의 스크롤을 빼앗는다.
 */
export function useAnchorScroll(ready: boolean): void {
  const settled = useRef(false)

  useEffect(() => {
    if (settled.current || !ready) return
    settled.current = true

    const id = window.location.hash.slice(1)
    if (id === '') return

    /*
      레이아웃이 확정된 다음 프레임에 잰다. `ready` 가 참이 된 렌더의 커밋 직후에는
      방금 들어온 자료의 높이가 아직 반영되지 않을 수 있다.
    */
    const frame = window.requestAnimationFrame(() => {
      // smooth 를 쓰지 않는다 — 이미 한 번 튄 화면을 또 애니메이션하면 어디로 가는지 모른다
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [ready])
}
