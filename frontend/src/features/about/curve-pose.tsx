import { CharacterImage } from '@/components/character'
import type { HourlyGradeCode } from '@/features/about/golden-curve-specimen'

export type CurvePoseName = 'leash' | 'stand' | 'hot'

/**
 * 무대 단계 → 자세 (명세 2026-09-25 §6-3). 단계 2(판정) · 4(기상특보)가 앞발이고 나머지는 목줄
 * 산책이다. 무대의 첫 렌더 · 감속 모션은 마지막 단계라 앞발로 선다 — 정적 렌더와 같다.
 */
export function poseForStep(step: number): CurvePoseName {
  return step === 2 || step >= 4 ? 'hot' : 'leash'
}

/** 시각 핸들 판정 → 자세. 서버 code 를 받는다 — 낱말이 아니라 판정이 자세를 고른다 */
export function poseForGrade(code: HourlyGradeCode): CurvePoseName {
  if (code === 'DANGER') return 'hot'
  if (code === 'CAUTION') return 'stand'
  return 'leash'
}

/**
 * 질문 2 자세 스택 (#917, 명세 §6-3).
 *
 * 세 장(산책 · 서기 · 앞발)을 **코끝(오른쪽) 기준으로 겹쳐** 두고 `data-pose` 하나로 고른다.
 * 전환은 `opacity` 150ms, 열기 선은 앞발일 때만 200ms 로 올라온다 — 전부 `globals.css` 캐릭터
 * 블록이다. 세 장이 같은 시트 · 같은 축척에서 잘려 폭 비율(.936 · .904 · .981)이 곧 축척이다.
 *
 * 곡선 카드의 **윗변 위**에 선다(`bottom: 100%`) — 카드 안에 넣지 않는다(§6-1). 카드를 감싼
 * `.about-pose-room` 이 자세 높이만큼 위 여백을 준다.
 *
 * **색을 칠하지 않는다.** 뜨거운 노면 장면에서도 개는 크림색이고, 빨강은 열기 선 그림에만 있다.
 */
export function CurvePose({ pose }: { pose: CurvePoseName }) {
  return (
    <span aria-hidden className="about-pose" data-pose={pose}>
      <CharacterImage name="leash" className="about-pose-layer about-pose-leash" />
      <CharacterImage name="stand" className="about-pose-layer about-pose-stand" />
      <CharacterImage name="hot" className="about-pose-layer about-pose-hot" />
      <CharacterImage name="heatLines" className="about-pose-layer about-pose-heat" />
    </span>
  )
}
