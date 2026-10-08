'use client'

import { useEffect, useState } from 'react'

import { BackLink } from '@/components/back-link'
import { messages } from '@/lib/messages'
import { PLACES_PATH, readPlacesHref } from '@/lib/place/places-return'

/**
 * 장소 찾기로 돌아가는 링크.
 *
 * 외형·접근성 계약은 `BackLink` 가 소유한다. 이 파일은 **목적지와 문구만** 정한다.
 *
 * **목적지는 이 탭에서 떠난 장소 찾기 화면이다** (#1272, `lib/place/places-return.ts`). `/places` 로
 * 고정이었을 때 기본 보기가 지도라, 목록 보기에서 들어온 사람도 지도로 돌아갔고 필터까지 잃었다.
 * 서버 렌더와 첫 렌더는 `/places` 다 — 저장소는 브라우저에만 있어, 마운트 뒤에 바꿔야 수화가
 * 어긋나지 않는다. 처음 들어온 상세(검색 유입)는 `/places` 그대로다.
 */
export function PlaceBackLink({ className }: { className?: string }) {
  const [href, setHref] = useState(PLACES_PATH)

  useEffect(() => {
    // 저장소는 외부 시스템이다 — 마운트 뒤 한 번 읽어 맞춘다
    setHref(readPlacesHref())
  }, [])

  return <BackLink href={href} label={messages.place.backToList} className={className} />
}
