import { describe, expect, it } from 'vitest'

import { planItemIllustration } from '@/lib/plan/illustration'
import { PLAN_ITEM_TYPES } from '@/types/plan'

/* 회색 타일이 예외가 아니라 기본이었다 — 이미지 없는 장소가 70% 다 (#842) */
describe('planItemIllustration — 항목 유형으로 타일을 채운다', () => {
  it('다섯 유형이 모두 일러스트를 갖는다', () => {
    expect(planItemIllustration('LODGING')).toBe('/illustrations/place-lodging.svg')
    expect(planItemIllustration('MEAL')).toBe('/illustrations/place-restaurant.svg')
    expect(planItemIllustration('PLACE')).toBe('/illustrations/place-tourist_spot.svg')
    expect(planItemIllustration('WALK')).toBe('/illustrations/plan-item-walk.svg')
    expect(planItemIllustration('MOVE')).toBe('/illustrations/plan-item-move.svg')
  })

  /*
    **계약이 늘면 이 단언이 먼저 깨진다.** 위 단언은 다섯을 손으로 적어 두므로 서버가
    여섯 번째 유형을 보내기 시작해도 그대로 통과한다 — 타입 쪽 목록으로 한 번 더 센다.
  */
  it('`PLAN_ITEM_TYPES` 의 모든 코드가 빠짐없이 덮인다', () => {
    for (const code of PLAN_ITEM_TYPES) {
      expect(planItemIllustration(code)).not.toBeNull()
    }
  })

  /* 유형을 지어내지 않는다 — 호출부가 회색 타일로 떨어뜨린다 */
  it('모르는 코드와 빈 값은 null 이다', () => {
    expect(planItemIllustration('SOMETHING_NEW')).toBeNull()
    expect(planItemIllustration('')).toBeNull()
    expect(planItemIllustration(null)).toBeNull()
  })

  /* 한국어를 키로 쓰는 매핑은 이 저장소가 금지한다 (api-integration-guide §6) */
  it('한국어 이름으로는 고르지 않는다', () => {
    expect(planItemIllustration('숙박')).toBeNull()
  })
})
