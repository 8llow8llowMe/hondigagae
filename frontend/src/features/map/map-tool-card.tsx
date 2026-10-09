import { Children, Fragment, type ReactNode } from 'react'

/**
 * 지도 우측 **아이콘 묶음 카드** (#1300, `docs/features/place/지도-아일랜드알약-정리-세부명세.md` D1-2 · D3-3).
 *
 * 지도 위 상태를 바꾸는 도구(`병원·약국` 층 · `내 위치`)를 둥근 사각 카드 하나에 세로로 쌓는다 — 카카오맵 우측
 * 툴바 방식. 예전에는 글자 버튼 · 아이콘 버튼이 따로 떠서 폭 · 모양이 제각각이었다(D0 #4).
 *
 * - 카드 폭 48 · 테두리 1 · `rounded-lg`(12) · `shadow-md` — **떠 있는 조작 = 둥근 사각**(D1-1 모양 언어)
 * - 칸은 46 × 48(테두리 안). 칸 사이 **전폭 구분선 1** — 켠 칸의 채움이 칸 경계까지 차므로 안쪽으로 들여 쓴 선은
 *   끊겨 보인다. 높이 = 1 + 48 + 1 + 48 + 1 = **99**, 칸 하나면 50
 * - `overflow-hidden` — 켠 칸의 채움이 카드 곡률에서 잘린다. 그래서 칸의 포커스 링은 안쪽(`ring-inset`)이다
 *
 * **다른 화면으로 가는 링크는 넣지 않는다** — 모바일 목록 아이콘(`ViewToggle`)은 카드 위 검색창 옆에 남는다(D1-2).
 * 빈 자식(`false` · `null`)은 칸으로 세지 않는다 — 칸이 없으면 카드도 없다.
 */
export function MapToolCard({ children }: { children: ReactNode }) {
  const cells = Children.toArray(children)
  if (cells.length === 0) return null

  return (
    <div className="bg-bg border-border pointer-events-auto flex w-12 flex-col overflow-hidden rounded-lg border shadow-md">
      {cells.map((cell, index) => (
        <Fragment key={index}>
          {index > 0 && <div aria-hidden data-map-tool-divider className="bg-border h-px" />}
          {cell}
        </Fragment>
      ))}
    </div>
  )
}
