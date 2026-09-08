'use client'

import { useEffect, useRef } from 'react'

/**
 * 무한 스크롤 감지자 — 목록 끝에 두는 빈 표식.
 *
 * 화면에 들어오면 `onIntersect` 를 부른다. 커서 페이지네이션을 "더 보기" 버튼으로
 * 드러내지 않고 스크롤에 맡기기 위한 것이다.
 *
 * **`root` 를 지정하지 않는다.** 목록은 전폭 페이지(뷰포트 스크롤)에도 있고 지도 옆
 * 패널(`overflow-y-auto` 안쪽 스크롤)에도 있다. `IntersectionObserver` 는 뷰포트를
 * 기준으로 재면서 **조상 스크롤 컨테이너의 클리핑까지 반영**하므로, 둘 다 같은 코드로
 * 맞는다. `root` 를 패널로 고정하면 반대로 전폭 목록에서 안 먹는다.
 *
 * **`rootMargin` 으로 미리 받는다.** 0 이면 사용자가 바닥에 닿은 뒤에야 요청이 나가
 * 스크롤이 한 번 멈춘다.
 *
 * `aria-hidden` 인 이유: 자료가 아니라 계측용 표식이다. 진행 상황은 호출부가
 * `role="status"` 로 알린다.
 */
export function InfiniteScrollSentinel({
  onIntersect,
  /** 이미 받아오는 중이면 끈다 — 같은 페이지를 두 번 요청하지 않는다 */
  disabled = false,
  rootMargin = '240px',
}: {
  onIntersect: () => void
  disabled?: boolean
  rootMargin?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  /*
    콜백을 ref 로 들고 다닌다 — 호출부가 인라인 함수를 넘겨도(그것이 보통이다)
    observer 를 매 렌더마다 다시 만들지 않는다. 다시 만들면 이미 화면에 있는 표식이
    매번 "새로 들어왔다" 로 잡혀 요청이 연달아 나간다.
  */
  const handler = useRef(onIntersect)
  useEffect(() => {
    handler.current = onIntersect
  })

  useEffect(() => {
    const node = ref.current
    if (node === null || disabled) return
    // 지원하지 않는 환경에서는 아무 일도 하지 않는다 — 목록은 첫 페이지로 남는다
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) handler.current()
      },
      { rootMargin },
    )
    observer.observe(node)

    return () => observer.disconnect()
  }, [disabled, rootMargin])

  return <div ref={ref} aria-hidden className="h-px w-full" />
}
