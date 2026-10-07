'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import {
  placePreviewHistoryAction,
  placePreviewHref,
  readPlacePreview,
} from '@/lib/url/place-preview'

/**
 * 지도 보기의 **고른 장소** (#1227).
 *
 * `urlSynced` 면 `?place=` 가 정본이다 — 새로고침 · 공유 · 뒤로가기가 같은 미리보기를 복원한다.
 * 아니면(담기 지도) 예전처럼 화면 안 상태다. 담기 화면은 행마다 담기 버튼이 있어 미리보기를
 * 켜지 않고, 그 주소에 `place` 가 붙을 이유도 없다.
 *
 * **`router` 가 아니라 `window.history` 로 바꾼다.** `/places` 는 서버 페이지가 `searchParams`
 * 로 목록을 프리페치한다 — `router.replace` 로 `place` 를 바꾸면 고를 때마다 RSC 를 다시 받는다.
 * Next 는 네이티브 `pushState`/`replaceState` 를 `useSearchParams` 와 동기화하고 서버를 부르지
 * 않는다 (Next 14.1+ 공식 동작, 실측 RSC 0건).
 *
 * 무엇을 할지는 `placePreviewHistoryAction` 이 정한다 — 처음 열기 push · 바꾸기 replace · 닫기는
 * 쌓은 칸이면 back, 아니면 replace.
 */
export function usePlacePreview(urlSynced: boolean): {
  selectedId: string | null
  select: (placeId: string | null) => void
} {
  const searchParams = useSearchParams()
  const [localId, setLocalId] = useState<string | null>(null)
  /*
    **이 화면이 쌓은 기록 칸 위에 서 있는가.**

    `history.state` 에 표시를 싣지 않는다 — 실어 보냈는데 읽어 보면 Next 내부 키(`__NA` · 트리)만
    남아 있었다 (실측 2026-10-07, Next 16.3). 그래서 이 화면이 마운트된 동안만 아는 ref 다.

    **뒤로 · 앞으로 가기가 오면 버린다** (`popstate`). 쌓은 칸을 지나 공유 링크로 들어온 칸에
    돌아왔는데 표시가 남아 있으면 ✕ 가 back 해서 사이트 밖으로 나간다. 버리면 최악이 "칸 하나가
    남는다" 이고, 그쪽이 훨씬 덜 나쁘다.
  */
  const pushedRef = useRef(false)

  useEffect(() => {
    if (!urlSynced) return
    const forget = () => {
      pushedRef.current = false
    }
    window.addEventListener('popstate', forget)
    return () => window.removeEventListener('popstate', forget)
  }, [urlSynced])

  const select = useCallback(
    (placeId: string | null) => {
      if (!urlSynced) {
        setLocalId(placeId)
        return
      }

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const action = placePreviewHistoryAction({
        currentId: readPlacePreview(new URLSearchParams(window.location.search)),
        placeId,
        pushed: pushedRef.current,
      })

      if (action === 'none') return
      if (action === 'back') {
        pushedRef.current = false
        window.history.back()
        return
      }

      const next = placePreviewHref(current, placeId)
      if (action === 'push') {
        window.history.pushState(null, '', next)
        pushedRef.current = true
      } else {
        window.history.replaceState(null, '', next)
      }
    },
    [urlSynced],
  )

  return {
    selectedId: urlSynced
      ? readPlacePreview(new URLSearchParams(searchParams.toString()))
      : localId,
    select,
  }
}
