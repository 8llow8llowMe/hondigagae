import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import {
  appendMoveItemPayload,
  appendPlaceItemPayload,
  appendWalkCourseItemPayload,
  hasEditChanges,
  ITEM_TITLE_MAX,
  moveEditItem,
  placeIdsOf,
  planDayItemsPayload,
  survivingItems,
  toEditItems,
  toggleRemoved,
  validateMoveTitle,
  walkCourseIdsOf,
} from '@/lib/plan/day-items'
import { planItem } from '@/test/fixtures/plan'
import type { PlanItemDetail } from '@/types/plan'

/** Snowflake — Number() 를 거치면 정밀도를 잃는 값이다 */
const BIG_ID = '212481712381923328'

const ITEMS: PlanItemDetail[] = [
  planItem({
    planItemId: 'a',
    day: 2,
    sequence: 0,
    title: '미술관',
    targetId: BIG_ID,
    memo: '실내라 비가 와도 괜찮아요',
    startTime: '10:00:00',
  }),
  planItem({ planItemId: 'b', day: 2, sequence: 1, title: '시장', targetId: '212481712381923334' }),
  planItem({
    planItemId: 'c',
    day: 2,
    sequence: 2,
    title: '이동',
    itemType: { code: 'MOVE', name: '이동', description: null },
    targetId: null,
  }),
]

describe('moveEditItem', () => {
  it('한 칸 위로 옮긴다', () => {
    const moved = moveEditItem(toEditItems(ITEMS), 1, 'up')

    expect(moved.map((entry) => entry.item.title)).toEqual(['시장', '미술관', '이동'])
  })

  it('한 칸 아래로 옮긴다', () => {
    const moved = moveEditItem(toEditItems(ITEMS), 0, 'down')

    expect(moved.map((entry) => entry.item.title)).toEqual(['시장', '미술관', '이동'])
  })

  it('맨 위에서 위로 · 맨 아래에서 아래로는 배열이 그대로다', () => {
    const items = toEditItems(ITEMS)

    // 참조까지 같아야 호출부가 "안 움직였다" 를 알 수 있다
    expect(moveEditItem(items, 0, 'up')).toBe(items)
    expect(moveEditItem(items, items.length - 1, 'down')).toBe(items)
  })

  it('범위 밖 index 는 배열을 그대로 둔다', () => {
    const items = toEditItems(ITEMS)

    expect(moveEditItem(items, -1, 'down')).toBe(items)
    expect(moveEditItem(items, 9, 'up')).toBe(items)
  })

  it('원본 배열을 바꾸지 않는다', () => {
    const items = toEditItems(ITEMS)
    moveEditItem(items, 0, 'down')

    expect(items.map((entry) => entry.item.title)).toEqual(['미술관', '시장', '이동'])
  })

  it('삭제 표시된 항목도 함께 움직인다 — 목록에 남아 있다', () => {
    const marked = toggleRemoved(toEditItems(ITEMS), 0)
    const moved = moveEditItem(marked, 0, 'down')

    expect(moved[1]?.item.title).toBe('미술관')
    expect(moved[1]?.removed).toBe(true)
  })
})

describe('toggleRemoved', () => {
  it('켜고 끈다 — 배열에서 빼지 않는다', () => {
    const once = toggleRemoved(toEditItems(ITEMS), 1)

    expect(once).toHaveLength(3)
    expect(once[1]?.removed).toBe(true)
    expect(toggleRemoved(once, 1)[1]?.removed).toBe(false)
  })
})

/**
 * **편집모드는 이제 시각을 고치지 않는다** (#1028 · 명세 G0). 시각은 일정 목록의 칩이
 * 소유하고, 편집 상태에는 시각 필드가 없다 — 저장은 서버가 준 원문을 그대로 되싣는다.
 */
describe('toEditItems — 시각을 들지 않는다 (#1028)', () => {
  it('편집 항목에 편집용 시각 필드가 없다 — 되싣는 값은 item.startTime 원문이다', () => {
    expect(toEditItems(ITEMS)[0]).not.toHaveProperty('startTime')
    expect(toEditItems(ITEMS)[0]?.item.startTime).toBe('10:00:00')
  })
})

describe('hasEditChanges — 변경이 없으면 저장을 잠근다', () => {
  it('아무것도 안 했으면 false 다', () => {
    expect(hasEditChanges(toEditItems(ITEMS), ITEMS)).toBe(false)
  })

  it('순서를 바꾸면 true 다', () => {
    expect(hasEditChanges(moveEditItem(toEditItems(ITEMS), 0, 'down'), ITEMS)).toBe(true)
  })

  it('삭제 표시만 해도 true 다', () => {
    expect(hasEditChanges(toggleRemoved(toEditItems(ITEMS), 0), ITEMS)).toBe(true)
  })

  it('옮겼다가 되돌리면 false 다 — 같은 목록을 다시 보내지 않는다', () => {
    const back = moveEditItem(moveEditItem(toEditItems(ITEMS), 0, 'down'), 1, 'up')

    expect(hasEditChanges(back, ITEMS)).toBe(false)
  })
})

describe('planDayItemsPayload', () => {
  it('삭제 표시 항목이 빠지고 sequence 가 0부터 다시 매겨진다', () => {
    const payload = planDayItemsPayload(toggleRemoved(toEditItems(ITEMS), 0), 2)

    expect(payload.items.map((entry) => entry.title)).toEqual(['시장', '이동'])
    expect(payload.items.map((entry) => entry.sequence)).toEqual([0, 1])
  })

  it('memo · startTime · itemType 을 그대로 되돌려 싣는다 — 빼먹으면 지워진다', () => {
    const first = planDayItemsPayload(toEditItems(ITEMS), 2).items[0]

    expect(first?.memo).toBe('실내라 비가 와도 괜찮아요')
    expect(first?.startTime).toBe('10:00:00')
    expect(first?.itemType).toBe('PLACE')
  })

  it('targetId 를 문자열로 싣는다 — Snowflake 정밀도를 잃지 않는다', () => {
    const first = planDayItemsPayload(toEditItems(ITEMS), 2).items[0]

    expect(first?.targetId).toBe(BIG_ID)
    expect(typeof first?.targetId).toBe('string')
    // 숫자로 바꿨다면 값이 달라진다
    expect(String(Number(BIG_ID))).not.toBe(BIG_ID)
  })

  it('targetId 가 null 인 항목(MOVE)은 키 자체를 넣지 않는다', () => {
    const move = planDayItemsPayload(toEditItems(ITEMS), 2).items[2]

    expect(move).not.toHaveProperty('targetId')
  })

  // ── 편집 저장이 시각을 지우지 않는다 (#1028) ───────────────────────────────
  it('순서를 바꿔 저장해도 기존 startTime 이 그 항목을 따라 그대로 되실린다', () => {
    const moved = moveEditItem(toEditItems(ITEMS), 0, 'down')
    const payload = planDayItemsPayload(moved, 2)

    expect(payload.items[1]?.title).toBe('미술관')
    expect(payload.items[1]?.startTime).toBe('10:00:00')
    expect(payload.items[0]).not.toHaveProperty('startTime')
  })

  it('다른 항목을 삭제 표시해 저장해도 남는 항목의 startTime 은 그대로다', () => {
    const removed = toggleRemoved(toEditItems(ITEMS), 1)

    expect(planDayItemsPayload(removed, 2).items[0]?.startTime).toBe('10:00:00')
  })

  it('삭제 표시된 항목은 시각도 함께 빠진다', () => {
    const removed = toggleRemoved(toEditItems(ITEMS), 0)

    expect(planDayItemsPayload(removed, 2).items.some((entry) => entry.title === '미술관')).toBe(
      false,
    )
  })

  it('memo · startTime 이 null 이면 키를 넣지 않는다', () => {
    const second = planDayItemsPayload(toEditItems(ITEMS), 2).items[1]

    expect(second).not.toHaveProperty('memo')
    expect(second).not.toHaveProperty('startTime')
  })

  it('day 를 경로값 그대로 싣는다 — 0 을 보내면 @Min(1) 에 걸린다', () => {
    const payload = planDayItemsPayload(toEditItems(ITEMS), 3)

    expect(payload.items.every((entry) => entry.day === 3)).toBe(true)
  })

  it('전부 삭제하면 빈 목록이다 — 서버가 허용하는 동작이라 막지 않는다', () => {
    let items = toEditItems(ITEMS)
    for (let index = 0; index < ITEMS.length; index += 1) items = toggleRemoved(items, index)

    expect(planDayItemsPayload(items, 2).items).toEqual([])
  })
})

describe('survivingItems', () => {
  it('저장 후 남을 항목만 준다', () => {
    expect(survivingItems(toggleRemoved(toEditItems(ITEMS), 1)).map((item) => item.title)).toEqual([
      '미술관',
      '이동',
    ])
  })
})

describe('placeIdsOf — 같은 일자 중복 담기 판정 (#82)', () => {
  it('그 일자에 담긴 장소 id 를 모은다', () => {
    const ids = placeIdsOf(ITEMS)

    expect(ids.has(BIG_ID)).toBe(true)
    expect(ids.has('212481712381923334')).toBe(true)
  })

  it('targetId 가 null 인 항목(MOVE)은 들어가지 않는다', () => {
    expect(placeIdsOf(ITEMS).size).toBe(2)
  })

  it('MEAL·LODGING 은 포함한다 — 같은 곳이 식사로 담겨 있어도 또 담을 이유가 없다', () => {
    const meal = planItem({
      planItemId: 'd',
      day: 2,
      sequence: 3,
      title: '점심',
      itemType: { code: 'MEAL', name: '식사', description: null },
      targetId: '212481712381923340',
    })

    expect(placeIdsOf([meal]).has('212481712381923340')).toBe(true)
  })

  /*
    회귀 방지 — `WALK` 의 `targetId` 는 `walk_course.id` 라 **장소 id 가 아니다.**
    걸러내지 않으면 우연히 값이 겹치는 장소가 `이미 담았어요` 로 잠겨, 담을 수 있는 곳을
    담지 못한다. 버튼이 사라져 우회로도 없다.
  */
  it('WALK 의 targetId 는 walk_course.id 라 장소로 세지 않는다', () => {
    const walk = planItem({
      planItemId: 'e',
      day: 2,
      sequence: 4,
      title: '산책 코스',
      itemType: { code: 'WALK', name: '산책', description: null },
      targetId: '777777777777000001',
    })

    expect(placeIdsOf([walk]).has('777777777777000001')).toBe(false)
    expect(placeIdsOf([walk]).size).toBe(0)
  })
})

describe('appendPlaceItemPayload — 장소 담기 (#82)', () => {
  const place = { placeId: '212481712381923350', title: '오설록 티뮤지엄' }

  it('기존 항목을 전부 되싣고 새 항목을 맨 끝에 붙인다 — 일괄 교체다', () => {
    const payload = appendPlaceItemPayload(ITEMS, 2, place)

    expect(payload.items).toHaveLength(4)
    expect(payload.items.at(-1)?.title).toBe(place.title)
  })

  it('되싣는 항목의 memo · startTime · itemType 이 살아 있다 — 빼먹으면 조용히 지워진다', () => {
    const first = appendPlaceItemPayload(ITEMS, 2, place).items[0]

    expect(first?.memo).toBe('실내라 비가 와도 괜찮아요')
    expect(first?.startTime).toBe('10:00:00')
    expect(first?.itemType).toBe('PLACE')
  })

  it('sequence 를 0부터 다시 매기고 새 항목이 마지막 번호를 받는다', () => {
    const payload = appendPlaceItemPayload(ITEMS, 2, place)

    expect(payload.items.map((item) => item.sequence)).toEqual([0, 1, 2, 3])
  })

  it('targetId 가 문자열이다 — Snowflake 는 Number() 를 거치면 정밀도를 잃는다', () => {
    const added = appendPlaceItemPayload([], 1, place).items[0]

    expect(added?.targetId).toBe(place.placeId)
    expect(typeof added?.targetId).toBe('string')
    // 직렬화해도 숫자가 되지 않는다
    expect(JSON.stringify(added)).toContain(`"targetId":"${place.placeId}"`)
  })

  it('itemType 이 PLACE 고정이다 — 유형 선택 UI 가 없다 (F3)', () => {
    expect(appendPlaceItemPayload([], 1, place).items[0]?.itemType).toBe('PLACE')
  })

  it('day 를 경로값 그대로 싣는다 — @Min(1) 이 덮어쓰기보다 먼저 돈다', () => {
    const payload = appendPlaceItemPayload(ITEMS, 3, place)

    expect(payload.items.every((item) => item.day === 3)).toBe(true)
  })

  it('title 이 100자를 넘으면 잘라서 보낸다 — 서버는 자르지 않고 PLAN_100 을 낸다', () => {
    const long = 'ㄱ'.repeat(150)
    const added = appendPlaceItemPayload([], 1, { placeId: place.placeId, title: long }).items[0]

    expect(added?.title).toHaveLength(ITEM_TITLE_MAX)
  })

  it('빈 일자에 담으면 항목 하나짜리 목록이 된다', () => {
    expect(appendPlaceItemPayload([], 1, place).items).toHaveLength(1)
  })

  it('대상이 없는 항목(MOVE)은 targetId 키 자체가 없다', () => {
    const move = appendPlaceItemPayload(ITEMS, 2, place).items[2]

    expect(move).not.toHaveProperty('targetId')
  })
})

describe('walkCourseIdsOf — 같은 일자 중복 담기 판정 (#620)', () => {
  const WALK_ID = '6911167100216303304'

  const withWalk = [
    ...ITEMS,
    planItem({
      planItemId: 'w',
      day: 2,
      sequence: 5,
      title: '2코스 광치기-온평포구',
      itemType: { code: 'WALK', name: '산책', description: null },
      targetId: WALK_ID,
      place: null,
    }),
  ]

  it('그 일자에 담긴 WALK 항목의 targetId(walk_course.id) 를 모은다', () => {
    expect(walkCourseIdsOf(withWalk).has(WALK_ID)).toBe(true)
    expect(walkCourseIdsOf(withWalk).size).toBe(1)
  })

  /*
    회귀 방지 — 코스 판정에 placeIdsOf 의 결과를 섞지 않는다. 우연히 값이 겹치는 장소가
    담겨 있으면 담을 수 있는 코스가 잠긴다(#82 가 겪은 결함의 거울상, D3-2).
  */
  it('PLACE·MEAL·LODGING 의 targetId 는 담지 않는다 — 네임스페이스가 다르다', () => {
    const ids = walkCourseIdsOf(ITEMS)

    expect(ids.size).toBe(0)
    expect(ids.has('212481712381923328')).toBe(false)
  })

  it('MOVE(targetId: null)는 담지 않는다 — isPlaceTarget 의 부정이 아니다', () => {
    const move = planItem({
      planItemId: 'm',
      day: 2,
      sequence: 6,
      title: '이동',
      itemType: { code: 'MOVE', name: '이동', description: null },
      targetId: null,
      place: null,
    })

    expect(walkCourseIdsOf([move]).size).toBe(0)
  })

  /* placeIdsOf 쪽 회귀는 day-items.test.ts:206 근처가 이미 지킨다 — 여기서는 반대 방향을 본다 */
  it('placeIdsOf 는 WALK 를 여전히 세지 않는다', () => {
    expect(placeIdsOf(withWalk).has(WALK_ID)).toBe(false)
  })
})

describe('appendWalkCourseItemPayload — 산책 코스 담기 (#620)', () => {
  const course = { walkCourseId: '6911167100216303304', title: '2코스 광치기-온평포구' }

  it('기존 항목을 전부 되싣고 새 항목을 맨 끝에 붙인다 — 일괄 교체다', () => {
    const payload = appendWalkCourseItemPayload(ITEMS, 2, course)

    expect(payload.items).toHaveLength(4)
    expect(payload.items.at(-1)?.title).toBe(course.title)
  })

  it('새 항목의 itemType 이 WALK 고정이다', () => {
    expect(appendWalkCourseItemPayload([], 1, course).items[0]?.itemType).toBe('WALK')
  })

  it('targetId 가 문자열 그대로다 — Snowflake 는 서버가 검증도 안 해 준다 (D3-3)', () => {
    const bigId = '6911167100216303304'
    const added = appendWalkCourseItemPayload([], 1, { walkCourseId: bigId, title: '2코스' })
      .items[0]

    expect(added?.targetId).toBe(bigId)
    expect(typeof added?.targetId).toBe('string')
    expect(JSON.stringify(added)).toContain(`"targetId":"${bigId}"`)
    // 직렬화한 뒤 다시 숫자로 바꾸면 정밀도를 잃는다는 것 자체가 문자열이어야 하는 이유다
    expect(String(Number(bigId))).not.toBe(bigId)
  })

  it('되싣는 항목의 memo · startTime · itemType 이 살아 있다 — 빼먹으면 조용히 지워진다', () => {
    const first = appendWalkCourseItemPayload(ITEMS, 2, course).items[0]

    expect(first?.memo).toBe('실내라 비가 와도 괜찮아요')
    expect(first?.startTime).toBe('10:00:00')
    expect(first?.itemType).toBe('PLACE')
  })

  /** 이미 담겨 있던 WALK 항목도 PLACE 로 뭉개지지 않는다 */
  it('기존에 담겨 있던 WALK 항목도 itemType: WALK 로 되실린다', () => {
    const existingWalk = planItem({
      planItemId: 'w0',
      day: 2,
      sequence: 3,
      title: '1코스 시흥-광치기',
      itemType: { code: 'WALK', name: '산책', description: null },
      targetId: '6911167100216303301',
      place: null,
    })

    const payload = appendWalkCourseItemPayload([...ITEMS, existingWalk], 2, course)
    const reloaded = payload.items.find((item) => item.title === '1코스 시흥-광치기')

    expect(reloaded?.itemType).toBe('WALK')
    expect(reloaded?.targetId).toBe('6911167100216303301')
  })

  it('sequence 를 0부터 다시 매기고 새 항목이 마지막 번호를 받는다', () => {
    const payload = appendWalkCourseItemPayload(ITEMS, 2, course)

    expect(payload.items.map((item) => item.sequence)).toEqual([0, 1, 2, 3])
  })

  it('day 를 경로값 그대로 싣는다', () => {
    const payload = appendWalkCourseItemPayload(ITEMS, 3, course)

    expect(payload.items.every((item) => item.day === 3)).toBe(true)
  })

  it('title 이 100자를 넘으면 잘라서 보낸다 — 서버는 자르지 않고 PLAN_110 을 낸다', () => {
    const long = 'ㄱ'.repeat(150)
    const added = appendWalkCourseItemPayload([], 1, {
      walkCourseId: course.walkCourseId,
      title: long,
    }).items[0]

    expect(added?.title).toHaveLength(ITEM_TITLE_MAX)
  })

  it('빈 일자에 담으면 항목 하나짜리 목록이 된다', () => {
    expect(appendWalkCourseItemPayload([], 1, course).items).toHaveLength(1)
  })
})

describe('appendMoveItemPayload — 이동·휴식 직접 추가 (#1014)', () => {
  /*
    **비우면 `이동 및 휴식` 이다** (#1026). AI 일정이 만드는 같은 자리의 제목과 맞춘다 —
    서버 `@NotBlank` 라 빈 제목은 보낼 수 없고, 막는 대신 채운다.
  */
  it('빈 제목은 기본 제목으로 보낸다', () => {
    expect(appendMoveItemPayload([], 1, { title: '' }).items[0]?.title).toBe(
      messages.plan.addMoveDefaultTitle,
    )
    expect(messages.plan.addMoveDefaultTitle).toBe('이동 및 휴식')
  })

  it('공백만 있는 제목도 기본 제목으로 보낸다', () => {
    expect(appendMoveItemPayload([], 1, { title: '   ' }).items[0]?.title).toBe(
      messages.plan.addMoveDefaultTitle,
    )
  })

  it('기존 항목을 전부 되싣고 새 항목을 맨 끝에 붙인다 — 일괄 교체다', () => {
    const payload = appendMoveItemPayload(ITEMS, 2, { title: '카페에서 쉬기' })

    expect(payload.items).toHaveLength(4)
    expect(payload.items.map((item) => item.title)).toEqual([
      '미술관',
      '시장',
      '이동',
      '카페에서 쉬기',
    ])
  })

  it('새 항목의 itemType 이 MOVE 고정이다', () => {
    expect(appendMoveItemPayload([], 1, { title: '차로 이동' }).items[0]?.itemType).toBe('MOVE')
  })

  it('새 항목에 targetId 키가 없다 — MOVE 는 대상이 없다 (PlanItemRequest.targetId)', () => {
    const added = appendMoveItemPayload(ITEMS, 2, { title: '차로 이동' }).items.at(-1)

    expect(added).not.toHaveProperty('targetId')
    expect(JSON.stringify(added)).not.toContain('targetId')
  })

  it('memo · startTime 을 싣지 않는다 — 제목만 받는다', () => {
    const added = appendMoveItemPayload([], 1, { title: '차로 이동' }).items[0]

    expect(added).toEqual({ day: 1, sequence: 0, itemType: 'MOVE', title: '차로 이동' })
  })

  it('되싣는 항목의 targetId · memo · startTime · itemType 이 살아 있다', () => {
    const [first, , third] = appendMoveItemPayload(ITEMS, 2, { title: '쉬기' }).items

    expect(first?.targetId).toBe(BIG_ID)
    expect(first?.memo).toBe('실내라 비가 와도 괜찮아요')
    expect(first?.startTime).toBe('10:00:00')
    expect(first?.itemType).toBe('PLACE')
    // 이미 있던 MOVE 도 MOVE 로, targetId 없이 되실린다
    expect(third?.itemType).toBe('MOVE')
    expect(third).not.toHaveProperty('targetId')
  })

  it('sequence 를 0부터 다시 매기고 새 항목이 마지막 번호를 받는다', () => {
    const payload = appendMoveItemPayload(ITEMS, 2, { title: '쉬기' })

    expect(payload.items.map((item) => item.sequence)).toEqual([0, 1, 2, 3])
  })

  it('day 를 경로값 그대로 싣는다', () => {
    const payload = appendMoveItemPayload(ITEMS, 3, { title: '쉬기' })

    expect(payload.items.every((item) => item.day === 3)).toBe(true)
  })

  it('앞뒤 공백을 걷어 보낸다', () => {
    expect(appendMoveItemPayload([], 1, { title: '  차로 이동  ' }).items[0]?.title).toBe(
      '차로 이동',
    )
  })

  it('title 이 100자를 넘으면 잘라서 보낸다 — 서버는 자르지 않고 PLAN_110 을 낸다', () => {
    const added = appendMoveItemPayload([], 1, { title: 'ㄱ'.repeat(150) }).items[0]

    expect(added?.title).toHaveLength(ITEM_TITLE_MAX)
  })

  it('빈 일자에 붙이면 항목 하나짜리 목록이 된다', () => {
    expect(appendMoveItemPayload([], 1, { title: '쉬기' }).items).toHaveLength(1)
  })
})

describe('validateMoveTitle — 이동·휴식 제목 검증 (#1014)', () => {
  /* 비우면 기본 제목으로 만든다 (#1026) — 막지 않는다. 기본값은 `appendMoveItemPayload` 가 채운다 */
  it('빈 문자열은 통과한다 — 기본 제목으로 만든다', () => {
    expect(validateMoveTitle('')).toBeNull()
  })

  it('공백만 있어도 통과한다 — 걷으면 빈 값이다', () => {
    expect(validateMoveTitle('   ')).toBeNull()
  })

  it('100자는 통과한다', () => {
    expect(validateMoveTitle('ㄱ'.repeat(ITEM_TITLE_MAX))).toBeNull()
  })

  it('101자는 길이 오류다 — 자르지 않고 막는다 (사용자가 쓴 글이다)', () => {
    expect(validateMoveTitle('ㄱ'.repeat(ITEM_TITLE_MAX + 1))).toBe(
      messages.plan.addMoveTitleTooLong,
    )
  })

  it('앞뒤 공백은 길이에 세지 않는다', () => {
    expect(validateMoveTitle(` ${'ㄱ'.repeat(ITEM_TITLE_MAX)} `)).toBeNull()
  })

  it('보통 제목은 통과한다', () => {
    expect(validateMoveTitle('차로 이동')).toBeNull()
  })
})
