'use client'

import { EmergencySection } from '@/features/emergency/emergency-section'
import { type EmergencyBoard, useEmergencyBoard } from '@/features/emergency/use-emergency-board'
import { toErrorStatus } from '@/lib/api/error'

/**
 * 목록 갈래 — `?view=list` 와 **지도 SDK 실패 폴백이 같은 것을 쓴다.**
 *
 * 응급 화면에서 지도 없이 전화까지 도달하는 경로가 여기다. 지도가 기본 보기가 된 뒤에도
 * 이 갈래는 그대로 남는다.
 *
 * **개수는 반경 전량 기준이다** — 이 갈래에는 지도 영역이 없다 (설계 §5-3).
 * 지도 갈래는 `EmergencySection` 을 쓰지 않고 자기 패널 본문을 갖는다.
 */
export function EmergencyListView() {
  return <EmergencyBoardSection board={useEmergencyBoard()} />
}

/**
 * 보드를 **받아서** 목록을 그린다. **보드를 만들지 않는다.**
 *
 * 지도 갈래의 SDK 실패 분기가 자기 보드를 그대로 넘기기 위해 갈라 뒀다. 거기서
 * `EmergencyListView` 를 렌더하면 보드가 두 벌이 되어 위치를 두 번 묻고 반경·필터가
 * 갈린다 — SDK 실패는 카카오 키 도메인이 안 맞을 때 **항상** 오는 경로라 예외가 아니다.
 */
export function EmergencyBoardSection({ board }: { board: EmergencyBoard }) {
  return (
    <EmergencySection
      result={board.query.data ?? null}
      // 좌표를 기다리는 동안에도 로딩이다 — 조회는 아직 시작도 못 했다
      loading={board.position === null || board.query.isPending}
      errorStatus={toErrorStatus(board.query.error)}
      onRetry={() => void board.query.refetch()}
      filters={board.filters}
      onFiltersChange={board.setFilters}
      positionFallback={board.fallback}
      onRetryPosition={board.locate}
      onWidenRadius={board.widenRadius}
      canWiden={board.canWiden}
    />
  )
}
