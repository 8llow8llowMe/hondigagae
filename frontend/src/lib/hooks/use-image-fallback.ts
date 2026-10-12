'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 로드가 끝났는데 크기가 0 인 `<img>` — 깨진 이미지다 (#1382).
 *
 * 아직 받는 중(`complete === false`)이면 단정하지 않는다. 그 뒤 실패는 `onError` 가 알린다.
 */
export function isBrokenImage(
  img: Pick<HTMLImageElement, 'complete' | 'naturalWidth'> | null,
): boolean {
  return img !== null && img.complete && img.naturalWidth === 0
}

/**
 * 업로드 사진 `<img>` 가 열리지 않으면 폴백으로 떨어뜨린다 — `PetAvatar` · `PetPhoto` ·
 * `ProfileAvatar` 가 같이 쓴다.
 *
 * ### `onError` 만으로는 부족하다 (#1382)
 *
 * **서버 렌더된 `<img>` 가 하이드레이션 전에 실패하면 `onError` 가 불리지 않는다.** 브라우저는
 * HTML 을 받자마자 사진을 받기 시작하고, 404 의 `error` 이벤트는 React 가 리스너를 붙이기
 * 전에 지나간다. React 는 클라이언트에서 만든 `<img>` 에는 마운트 때 `src` 를 다시 넣어
 * 이벤트를 되살리지만(`commitMount`), 하이드레이션한 `<img>` 에는 아무것도 하지 않는다
 * (`commitHydratedInstance` 가 빈 함수다, react-dom 19.2). 그래서 dev 홈 프로필 카드에
 * 깨진 이미지 아이콘이 남았다 — 재현: 404 URL 을 SSR 한 뒤 `complete: true ·
 * naturalWidth: 0` 인 `<img>` 가 그대로 있었다.
 *
 * 마운트 때(그리고 URL 이 바뀔 때) `ref` 로 `isBrokenImage` 를 한 번 읽어 이 경우를 잡는다.
 *
 * ### URL 이 바뀌면 실패 기록을 다시 판정한다
 *
 * 안 그러면 한 번 깨진 뒤 새 사진을 올려도 계속 폴백만 보인다 — 업로드 성공이 화면에
 * 반영되지 않는다. 폴백을 그리는 중이면 `ref` 가 비어 `false` 로 돌아가 새 사진을 시도하고,
 * 그 `<img>` 는 클라이언트에서 만든 것이라 `onError` 가 제대로 불린다.
 */
export function useImageFallback(url: string | null) {
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setFailed(isBrokenImage(imgRef.current))
  }, [url])

  return { failed, imgRef, onError: () => setFailed(true) }
}
