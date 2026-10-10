import { createPortal } from 'react-dom'

import type { ReactNode } from 'react'

/**
 * 화면 전체를 덮는 겹(뷰어 · 바텀시트)을 `body` 끝으로 띄운다 (#1230).
 *
 * **`z-50` 은 조상이 쌓임 맥락을 만들면 그 안에서만 유효하다** (DESIGN.md z 스케일 — #393 과 같은
 * 원인). 지도 미리보기 래퍼(`absolute`/`fixed` + `z-30`) 안에서 연 사진 뷰어는 바깥에서 보면 통째로
 * 30 이라, 헤더(z-40)가 닫기 버튼을, 모바일 탭바(z-40)가 넘기기 버튼을 덮었다 — 모바일에는 Esc 도
 * 없어 **뷰어를 닫을 수 없었다**(리뷰 재현). 어디서 열어도 같은 층에 서도록 `body` 로 뺀다.
 *
 * **`document` 가 없으면(서버 · node 테스트) 제자리에 그린다.** 서버 렌더러는 포털을 그리지 못한다.
 * 이 겹들은 열려 있을 때만 그려지고 여는 것은 사용자 조작(하이드레이션 뒤)이라 서버 · 클라이언트
 * 트리가 갈리지 않는다.
 */
export function toBody(node: ReactNode): ReactNode {
  return typeof document === 'undefined' ? node : createPortal(node, document.body)
}
