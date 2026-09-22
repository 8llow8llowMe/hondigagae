import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanItemRow, type PlanItemVisit } from '@/features/plan/plan-item-row'
import { messages } from '@/lib/messages'
import type { PlanItemRowModel } from '@/lib/plan/detail'
import {
  planDetail,
  planItem,
  planItemPlace,
  planItemWalkCourse,
  planItemWalkSafety,
} from '@/test/fixtures/plan'
import type { PlanItemPlace, PlanItemWalkSafetyItem } from '@/types/plan'

/**
 * 일정 항목 행의 메타 줄 — 이슈 #112.
 *
 * 거리 줄은 `plan-detail.test.ts` 가 값으로 검증한다. 여기서 보는 것은 **항목이 들고 온
 * `place` 요약이 메타 줄로 옮겨지는 방식**이다 (#86·#115) — 특히 `indoor` 가 `null` 일 때
 * "야외" 로 단정하지 않는지.
 */
function render(place: PlanItemPlace | null) {
  const model: PlanItemRowModel = {
    item: { ...planDetail.items[0]!, place },
    distanceMeters: null,
    distanceKind: null,
  }

  return renderToStaticMarkup(createElement(PlanItemRow, { model }))
}

describe('PlanItemRow — 메타 줄 (#112)', () => {
  it('주소와 실내 여부를 한 줄로 붙인다 (명세 D2)', () => {
    expect(render(planItemPlace())).toContain(`제주시 한림읍 · ${messages.place.rowIndoor}`)
  })

  it('야외면 야외라고 쓴다', () => {
    expect(render(planItemPlace({ indoor: false }))).toContain(
      `제주시 한림읍 · ${messages.place.rowOutdoor}`,
    )
  })

  it('실내 여부를 모르면 낱말만 빠지고 주소는 남는다 — 야외라고 단정하지 않는다', () => {
    const markup = render(planItemPlace({ indoor: null }))

    expect(markup).toContain('제주시 한림읍')
    expect(markup).not.toContain(messages.place.rowOutdoor)
  })

  it('실내 여부만 있고 주소가 없으면 낱말만 남는다 — 빈 구분자를 남기지 않는다', () => {
    const markup = render(planItemPlace({ addr1: null }))

    expect(markup).toContain(messages.place.rowIndoor)
    expect(markup).not.toContain(`· ${messages.place.rowIndoor}`)
  })

  it('place 가 통째로 비어도 행을 지우지 않는다 — 일정 자료는 우리 DB 고 장소는 다른 서비스다', () => {
    const markup = render(null)

    expect(markup).toContain(planDetail.items[0]!.title)
  })

  it('미확인 배지를 만들지 않는다 — 여기에는 실내 필터가 없어 설명할 자리가 없다', () => {
    const markup = render(planItemPlace({ indoor: null }))

    expect(markup).not.toContain(messages.place.rowIndoorUnknown)
  })
})

/**
 * 방문 체크 토글 — 이슈 #124.
 *
 * `visit` 를 넘기지 않으면 토글이 아예 없다는 것까지 본다. 기간 밖 고아 항목 섹션이
 * 그 경로다 — 어느 일자에도 속하지 않는 항목에 '다녀옴' 을 두면 무엇을 다녀왔다는
 * 것인지 말할 수 없다.
 */
function renderWithVisit({ visited = false, visit }: { visited?: boolean; visit?: PlanItemVisit }) {
  const model: PlanItemRowModel = {
    item: { ...planDetail.items[0]!, visited },
    distanceMeters: null,
    distanceKind: null,
  }

  return renderToStaticMarkup(
    createElement(PlanItemRow, visit === undefined ? { model } : { model, visit }),
  )
}

const idleVisit: PlanItemVisit = {
  pending: false,
  error: null,
  onToggle: () => undefined,
  // 기본은 여행 중·지난 일정이다 — 낱말이 서는 갈래 (#732)
  compact: false,
}

describe('PlanItemRow — 방문 체크 토글 (#124)', () => {
  it('visit 를 넘기지 않으면 토글이 없다 — 기간 밖 항목 섹션의 경로다', () => {
    const markup = renderWithVisit({})

    expect(markup).not.toContain(messages.plan.visitAction)
    expect(markup).not.toContain('aria-pressed')
  })

  it('체크되지 않은 항목은 aria-pressed=false 이고 이름이 "표시" 다', () => {
    const markup = renderWithVisit({ visited: false, visit: idleVisit })

    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain(`aria-label="${messages.plan.visitAction}"`)
  })

  /*
    **WCAG 2.5.3 Label in Name** (#653). 토글이 `iconOnly` 를 벗으면서 보이는 글자가
    생겼다 — 접근 가능한 이름이 그 글자를 **포함하지 않으면** 음성 제어 사용자가 화면에
    보이는 그대로 말했을 때 버튼이 잡히지 않는다. 아이콘만이던 시절에는 없던 제약이라
    글자를 붙이면서 새로 생겼고, 이 단언이 그 관계를 잠근다.
  */
  it('보이는 글자가 접근 가능한 이름에 들어 있다 — 양쪽 상태 모두', () => {
    expect(messages.plan.visitAction).toContain(messages.plan.visitToggleLabel)
    expect(messages.plan.visitedAction).toContain(messages.plan.visitedLabel)
  })

  it('체크된 항목은 aria-pressed=true 이고 이름이 "해제" 다 — 누르면 일어날 일을 말한다', () => {
    const markup = renderWithVisit({ visited: true, visit: idleVisit })

    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain(`aria-label="${messages.plan.visitedAction}"`)
  })

  /*
    낱말로도 말한다는 요구는 그대로이고(#124), **그 일을 하는 요소가 배지에서 토글 버튼으로
    옮겨 갔다** (#653 · 진단 PL-5 · 명세 D11-5). 버튼이 `iconOnly` 를 벗으면서 같은 낱말이
    한 행에 두 번 서서 배지를 걷었다.

    **`aria-label` 에 걸리지 않게 닫는 태그까지 묶어 본다.** `다녀옴` 은 토글 이름
    (`다녀옴으로 표시`)의 substring 이라 낱낱으로 찾으면 꺼진 행에서도 걸린다.
  */
  it('체크된 항목은 낱말로도 말한다 — 색·투명도만으로 전달하지 않는다', () => {
    const visited = `${messages.plan.visitedLabel}</button>`

    expect(renderWithVisit({ visited: true, visit: idleVisit })).toContain(visited)
    expect(renderWithVisit({ visited: false, visit: idleVisit })).not.toContain(visited)
  })

  /*
    **체크 전에 `다녀옴` 이라고 적지 않는다.** 아직 안 간 행에 그 낱말이 있으면 훑는
    사람에게 그 행이 이미 다녀온 것으로 읽힌다 — 모르는 것보다 틀리게 아는 것이 나쁘다.
  */
  it('체크 전에는 상태가 아니라 할 일을 적는다', () => {
    const markup = renderWithVisit({ visited: false, visit: idleVisit })

    expect(markup).toContain(`${messages.plan.visitToggleLabel}</button>`)
    expect(markup).not.toContain(`>${messages.plan.visitedLabel}</button>`)
  })

  /* 같은 사실을 배지와 버튼이 두 번 말하지 않는다 — 배지를 걷은 근거 */
  it('체크된 행에서 다녀옴이 한 번만 보인다', () => {
    const markup = renderWithVisit({ visited: true, visit: idleVisit })
    const visible = markup.match(new RegExp(`>${messages.plan.visitedLabel}<`, 'g')) ?? []

    expect(visible).toHaveLength(1)
  })

  /*
    **출발 전에는 `다녀옴 표시` 가 D-1 화면에서 가장 많이 반복되는 문자열이었다** (#732 ·
    진단 665-7). 아무도 다녀오지 않은 일정의 모든 항목에 붙어 있었다. 기능은 그대로 두고
    글자만 접는다 — 접근 가능한 이름은 양쪽 갈래 모두 그대로다.
  */
  it('출발 전 미체크 행은 체크 아이콘만 남는다 — 기능과 이름은 그대로다', () => {
    const markup = renderWithVisit({ visited: false, visit: { ...idleVisit, compact: true } })

    expect(markup).not.toContain(`${messages.plan.visitToggleLabel}</button>`)
    expect(markup).toContain(`aria-label="${messages.plan.visitAction}"`)
    expect(markup).toContain('aria-pressed="false"')
  })

  /* `다녀옴` 은 상태를 말하는 유일한 낱말이다 — 접으면 색과 아이콘만 남는다 (DESIGN.md §7) */
  it('출발 전이어도 체크된 행은 낱말을 지킨다', () => {
    const markup = renderWithVisit({ visited: true, visit: { ...idleVisit, compact: true } })

    expect(markup).toContain(`${messages.plan.visitedLabel}</button>`)
  })

  it('저장 중이면 그 행의 토글만 잠기고 aria-busy 가 붙는다', () => {
    const markup = renderWithVisit({ visit: { ...idleVisit, pending: true } })

    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('disabled')
  })

  it('실패는 토스트가 아니라 이 행에 남는다 — role=alert 로 알린다', () => {
    const markup = renderWithVisit({
      visit: {
        ...idleVisit,
        error: { message: messages.plan.visitErrorDescription, retriable: true },
      },
    })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.plan.visitErrorDescription)
  })

  /*
    **문구로 세지 않는다.** 실패 문장 자체가 "다시 시도해 주세요" 를 품고 있어
    `messages.common.retry` 를 substring 으로 찾으면 항상 걸린다. 버튼 개수로 본다 —
    행에 있는 버튼은 토글 하나뿐이어야 한다.
  */
  function buttonCount(markup: string): number {
    return markup.split('<button').length - 1
  }

  it('실패해도 재시도 버튼을 따로 두지 않는다 — 같은 토글을 다시 누르는 것이 재시도다', () => {
    const markup = renderWithVisit({
      visit: {
        ...idleVisit,
        error: { message: messages.plan.visitErrorDescription, retriable: true },
      },
    })

    expect(buttonCount(markup)).toBe(1)
  })

  it('4xx 는 새로고침을 안내하고, 그때도 버튼이 늘지 않는다', () => {
    const markup = renderWithVisit({
      visit: { ...idleVisit, error: { message: messages.plan.visitStaleError, retriable: false } },
    })

    expect(markup).toContain(messages.plan.visitStaleError)
    expect(buttonCount(markup)).toBe(1)
  })
})

/**
 * 항목 시작 시각 — 이슈 #623 · 명세 D14-2 · D14-3 · D14-7.
 *
 * **D8-9 를 뒤집는다.** 아트보드 헤더 주석 "시간 없음" 은 예시 일정에 값이 없었다는
 * 사실이지 표시 금지가 아니다 — 이탈 근거는 `plan-item-row.tsx` 문서 주석에 있다.
 */
function renderWithStartTime(startTime: string | null) {
  const model: PlanItemRowModel = {
    item: { ...planDetail.items[0]!, startTime },
    distanceMeters: null,
    distanceKind: null,
  }

  return renderToStaticMarkup(createElement(PlanItemRow, { model }))
}

describe('PlanItemRow — 시작 시각 (#623)', () => {
  it('시각이 있으면 정규화된 HH:mm 을 <time> 으로 그린다', () => {
    const markup = renderWithStartTime('10:30:00')

    // React 서버 렌더 출력은 `dateTime` (camelCase) 그대로다 — 실제 DOM에서는
    // 브라우저가 `datetime` 으로 정규화한다
    expect(markup).toContain('<time dateTime="10:30"')
    expect(markup).toContain(messages.plan.startTimeSrLabel)
  })

  it('null 이면 시각 줄이 없다 — 지어내지 않는다', () => {
    const markup = renderWithStartTime(null)

    expect(markup).not.toContain('<time')
    expect(markup).not.toContain(messages.plan.startTimeSrLabel)
  })

  it('형식이 어긋난 값도 시각 줄을 그리지 않는다', () => {
    const markup = renderWithStartTime('오전 10시')

    expect(markup).not.toContain('<time')
  })

  it('시각 줄이 제목보다 앞이다 — 제목 위 캡션이다', () => {
    const markup = renderWithStartTime('10:30:00')
    const title = planDetail.items[0]!.title

    expect(markup.indexOf('10:30')).toBeLessThan(markup.indexOf(title))
  })

  it('메타 줄을 밀어내지 않는다 — 주소가 여전히 나온다', () => {
    const model: PlanItemRowModel = {
      item: { ...planDetail.items[0]!, startTime: '10:30:00', place: planItemPlace() },
      distanceMeters: null,
      distanceKind: null,
    }
    const markup = renderToStaticMarkup(createElement(PlanItemRow, { model }))

    expect(markup).toContain('제주시 한림읍')
  })
})

/**
 * 항목 산책 위험도 — 이슈 #625 · 명세 D15-5 · D15-9.
 *
 * **시각이 있어야 이 자리가 성립한다** (D14-4) — `walkSafety` 를 넘겨도 `startTime` 이
 * 없으면 줄 자체가 없다. 기본 항목의 `startTime` 은 `null` 이라(fixtures/plan.ts)
 * 여기서는 매번 `10:30:00` 으로 덮어쓴다.
 */
function renderWithWalkSafety(walkSafety: PlanItemWalkSafetyItem | undefined) {
  const model: PlanItemRowModel = {
    item: { ...planDetail.items[0]!, startTime: '10:30:00' },
    distanceMeters: null,
    distanceKind: null,
  }

  return renderToStaticMarkup(createElement(PlanItemRow, { model, walkSafety }))
}

describe('PlanItemRow — 항목 산책 위험도 (#625)', () => {
  it('정상 등급은 축 라벨과 함께 한 덩어리로 읽힌다 — 산책 주의', () => {
    const markup = renderWithWalkSafety(
      planItemWalkSafety({
        planItemId: 'i-1',
        walkSafetyLevel: {
          code: 'CAUTION',
          name: '주의',
          description: null,
          scoreDescription: null,
        },
      }),
    )

    // 라벨은 자기 <span> 이라 태그를 걷어낸 텍스트로 "한 덩어리" 를 확인한다 (metric.test.ts 와 같은 방식)
    expect(markup.replace(/<[^>]*>/g, '')).toContain('산책 주의')
  })

  it('정상 등급에는 체감온도가 함께 선다 — 최고 체감온도가 아니다', () => {
    const markup = renderWithWalkSafety(
      planItemWalkSafety({ planItemId: 'i-1', feelsLikeCelsius: 33.5 }),
    )

    expect(markup).toContain(`${messages.plan.walkSafetyFeelsLikeLabel} 33.5℃`)
    expect(markup).not.toContain(messages.plan.verdictFeelsLikeLabel)
  })

  it('시각이 없으면 산책도 체감온도도 없다 — 시각 줄 자체가 없다 (D14-3 회귀)', () => {
    const model: PlanItemRowModel = {
      item: { ...planDetail.items[0]!, startTime: null },
      distanceMeters: null,
      distanceKind: null,
    }
    const markup = renderToStaticMarkup(
      createElement(PlanItemRow, {
        model,
        walkSafety: planItemWalkSafety({ planItemId: 'i-1' }),
      }),
    )

    expect(markup).not.toContain(messages.common.metricAxisWalkSafety)
    expect(markup).not.toContain(messages.plan.walkSafetyFeelsLikeLabel)
  })

  it('PAST_DATE 는 서버 문장이 없다 — 일자 판정이 이미 한 번 말했다', () => {
    const sentence = '이미 지난 날짜라 산책 위험도를 판정할 수 없습니다.'
    const markup = renderWithWalkSafety(
      planItemWalkSafety({
        planItemId: 'i-1',
        walkSafetyLevel: null,
        unavailableReasonCode: 'PAST_DATE',
        unavailableReason: sentence,
      }),
    )

    expect(markup).not.toContain(sentence)
  })

  it('NOT_PLACE_TARGET 은 서버 문장이 없다 — WALK·MOVE 는 화면이 이미 안다', () => {
    const sentence = '장소를 가리키는 항목이 아니라 판정할 수 없습니다.'
    const markup = renderWithWalkSafety(
      planItemWalkSafety({
        planItemId: 'i-1',
        placeId: null,
        walkSafetyLevel: null,
        unavailableReasonCode: 'NOT_PLACE_TARGET',
        unavailableReason: sentence,
      }),
    )

    expect(markup).not.toContain(sentence)
  })

  it('LOOKUP_FAILED 는 서버 문장이 있고 role=alert 가 아니다 — 조회 실패는 폼 오류가 아니다', () => {
    const sentence = '산책 위험도를 조회하지 못했습니다.'
    const markup = renderWithWalkSafety(
      planItemWalkSafety({
        planItemId: 'i-1',
        walkSafetyLevel: null,
        unavailableReasonCode: 'LOOKUP_FAILED',
        unavailableReason: sentence,
      }),
    )

    expect(markup).toContain(sentence)
    expect(markup).not.toContain('role="alert"')
  })

  it('등급 UNKNOWN 은 배지 없이 description 문장을 낸다', () => {
    const description = '이 시각의 예보 자료가 부족해 등급을 매기지 못했습니다.'
    const markup = renderWithWalkSafety(
      planItemWalkSafety({
        planItemId: 'i-1',
        unavailableReasonCode: null,
        unavailableReason: null,
        walkSafetyLevel: {
          code: 'UNKNOWN',
          name: '판단 근거 부족',
          description,
          scoreDescription: null,
        },
      }),
    )

    expect(markup).not.toContain('bg-metric')
    expect(markup).toContain(description)
  })

  it('DANGER 는 critical 톤이고 낱말로도 위험을 말한다 — 색만으로 전달하지 않는다', () => {
    const markup = renderWithWalkSafety(
      planItemWalkSafety({
        planItemId: 'i-1',
        walkSafetyLevel: {
          code: 'DANGER',
          name: '위험',
          description: null,
          scoreDescription: null,
        },
      }),
    )

    expect(markup).toContain('metric-critical')
    expect(markup.replace(/<[^>]*>/g, '')).toContain('산책 위험')
  })

  it('위험도가 아직 안 왔으면(undefined) 배지도 문장도 없다 — 시각은 그대로다', () => {
    const markup = renderWithWalkSafety(undefined)

    expect(markup).toContain('10:30')
    expect(markup).not.toContain(messages.common.metricAxisWalkSafety)
    expect(markup).not.toContain(messages.plan.walkSafetyFeelsLikeLabel)
  })
})

/**
 * `WALK` 항목 행 — 산책 코스 요약 (#620 · 일정상세-세부명세 D12).
 */
describe('PlanItemRow — WALK 항목 (#620)', () => {
  function renderWalk(walkCourse: ReturnType<typeof planItemWalkCourse> | null) {
    const item = planItem({
      planItemId: 'w-1',
      day: 1,
      sequence: 0,
      title: '1코스 시흥-광치기',
      itemType: { code: 'WALK', name: '산책', description: null },
      targetId: '6911167100216303301',
      place: null,
      walkCourse,
    })

    const model: PlanItemRowModel = { item, distanceMeters: null, distanceKind: null }

    return renderToStaticMarkup(createElement(PlanItemRow, { model }))
  }

  /*
    회귀 — WALK 의 targetId 는 walk_course.id 라 /places/{id} 로 보내면 남의 id 로 404 를
    만든다 (`plan-item-row.tsx` 의 `isPlaceTarget` 판정, D12-3).
  */
  it('장소 링크를 만들지 않는다 — /places/ 가 없다', () => {
    const markup = renderWalk(planItemWalkCourse())

    expect(markup).not.toContain('/places/')
  })

  /** 이번 범위에서는 코스 화면으로 나가는 링크도 만들지 않는다 (D12-6 12-1) */
  it('코스 상세 링크도 만들지 않는다 — /olle/ 가 없다', () => {
    expect(renderWalk(planItemWalkCourse())).not.toContain('/olle/')
  })

  it('링크(<a) 가 아니라 div 갈래를 탄다', () => {
    expect(renderWalk(planItemWalkCourse())).not.toContain('<a')
  })

  it('유형 배지에 서버 itemType.name 을 그대로 쓴다', () => {
    expect(renderWalk(planItemWalkCourse())).toContain('산책')
  })

  it('요약이 있으면 구간명 · 거리 · 소요시간이 있다', () => {
    const markup = renderWalk(planItemWalkCourse())

    expect(markup).toContain('15.1km')
    expect(markup).toContain('4~5시간')
  })

  /** 요약이 없어도 오류로 말하지 않는다 — 저장을 막지 않아 사용자가 할 수 있는 일이 없다 (D12-4-1) */
  it('요약이 없으면 메타 줄이 없고 오류 문구도 없다', () => {
    const markup = renderWalk(null)

    expect(markup).toContain('1코스 시흥-광치기')
    expect(markup).not.toContain('조회되지')
  })

  it('요약이 있고 firstImage 가 있으면 img 가 있다', () => {
    // 허용 호스트만 next/image 에 넘어간다 (`lib/image/remote-host.ts`) — 실제 코스
    // fixture(`walk-course-data.ts`)와 같은 호스트를 쓴다
    const withImage = planItemWalkCourse({
      firstImage: 'http://tong.visitkorea.or.kr/cms/resource/60/2666460_image2_1.jpg',
    })

    expect(renderWalk(withImage)).toContain('<img')
  })

  /*
    **`img` 가 없다 → 사진이 없다 로 바뀌었다** (#842). 예전에는 사진이 없으면 타일이
    회색 아이콘이라 `img` 자체가 사라졌는데, 이제 유형 일러스트가 그 자리를 `img` 로
    채운다. 잠가야 할 것은 태그 유무가 아니라 **원격 사진을 그리지 않는다**는 쪽이다.
  */
  it('firstImage 가 null 이면 원격 사진 대신 WALK 일러스트가 선다', () => {
    const markup = renderWalk(planItemWalkCourse({ firstImage: null }))

    expect(markup).toContain('/illustrations/plan-item-walk.svg')
    expect(markup).not.toContain('tong.visitkorea.or.kr')
  })

  /** 코스를 걷는 길이와 직전 항목까지의 직선거리는 다른 값이다 (D12-5) */
  it('거리 문구(직선)가 없다 — 코스 좌표로 거리를 재지 않는다', () => {
    expect(renderWalk(planItemWalkCourse())).not.toContain('직선')
  })

  /** 같은 행에 PLACE 항목을 넣어도 기존 동작이 그대로다 (회귀) */
  it('PLACE 항목은 기존 동작 그대로다', () => {
    const model: PlanItemRowModel = {
      item: planDetail.items[0]!,
      distanceMeters: null,
      distanceKind: null,
    }
    const markup = renderToStaticMarkup(createElement(PlanItemRow, { model }))

    expect(markup).toContain(planDetail.items[0]!.title)
    expect(markup).toContain(`/places/${planDetail.items[0]!.targetId}`)
  })
})

/**
 * 반려견 특성이 이 항목 판정에만 빠진 경우 (#717 · #758).
 *
 * **행은 일자와 어긋날 때만 말한다.** 일자 판정 자리(`PlanDayVerdict`)가 이미 기준을
 * 말하므로, 항목이 같은 말을 되풀이하면 항목 수만큼 줄이 늘면서 새 정보는 0 이다.
 * 그래서 그리는 조건이 `항목 false` 가 아니라 **`일자 true && 항목 false`** 다 —
 * 근거는 `plan-item-row.tsx` 의 `showPetConditionNote` 주석에 있다.
 */
function renderWithPetCondition(
  petConditionApplied: boolean | null,
  dayPetConditionApplied: boolean,
) {
  const model: PlanItemRowModel = {
    item: { ...planDetail.items[0]!, startTime: '10:30:00' },
    distanceMeters: null,
    distanceKind: null,
  }
  const walkSafety = planItemWalkSafety({ planItemId: 'i-1', petConditionApplied })

  return renderToStaticMarkup(
    createElement(PlanItemRow, { model, walkSafety, dayPetConditionApplied }),
  )
}

describe('PlanItemRow — 항목만 반려견 특성이 빠진 경우 (#758)', () => {
  const note = messages.plan.walkSafetyPetConditionMissing

  it('일자는 반영했는데 항목이 아니면 한 줄을 더한다 — 일자 카드가 말할 수 없는 사실이다', () => {
    expect(renderWithPetCondition(false, true)).toContain(note)
  })

  it('일자도 반영하지 못한 날은 행이 말하지 않는다 — 일자 판정이 이미 같은 말을 했다', () => {
    expect(renderWithPetCondition(false, false)).not.toContain(note)
  })

  it('항목이 반영했으면 말하지 않는다 — 일자와 어긋나지 않는다', () => {
    expect(renderWithPetCondition(true, true)).not.toContain(note)
  })

  /** `null` 은 "묻지 않았다"(판정을 못 낸 줄)이고 `false`("물어봤지만 반영 못 함")와 다른 사실이다 */
  it('항목이 null 이면 말하지 않는다 — 판정 자체가 없는 줄이라 말할 것이 없다', () => {
    expect(renderWithPetCondition(null, true)).not.toContain(note)
  })

  /** 배지가 선 정상 판정에서도 어긋남은 따로 생긴다 — 사유 문장과 배타가 아니다 */
  it('배지가 선 정상 판정에서도 나온다', () => {
    const markup = renderWithPetCondition(false, true)

    expect(markup).toContain(note)
    // 기본 픽스처는 SAFE 판정이라 배지가 선다 — 둘이 함께 있는 것이 정상이다
    expect(markup).toContain('안전')
  })
})

/**
 * 썸네일 폴백 — 사진 → 유형 일러스트 → 회색 타일 (#842).
 *
 * **`itemType` 을 갈아 끼우는 헬퍼가 따로 필요하다.** 위쪽 `render(place)` 는 fixture 의
 * `PLACE` 유형에 고정돼 있어 유형별 갈래를 볼 수 없다.
 */
function renderThumbnail({
  firstImage,
  itemTypeCode,
}: {
  firstImage: string | null
  itemTypeCode: string
}) {
  const model: PlanItemRowModel = {
    item: {
      ...planDetail.items[0]!,
      itemType: { code: itemTypeCode, name: '유형', description: null },
      place: planItemPlace({ firstImage }),
    },
    distanceMeters: null,
    distanceKind: null,
  }

  return renderToStaticMarkup(createElement(PlanItemRow, { model }))
}

/* 회색 타일은 예외여야 한다 — dev 실측으로 이미지 없는 장소가 70% 다 (#842) */
describe('PlanItemRow — 썸네일 폴백', () => {
  it('사진이 없으면 항목 유형 일러스트가 선다', () => {
    const html = renderThumbnail({ firstImage: null, itemTypeCode: 'LODGING' })

    expect(html).toContain('/illustrations/place-lodging.svg')
  })

  it('WALK · MOVE 도 자기 자산을 갖는다 — 장소 카테고리에 없는 둘이다', () => {
    expect(renderThumbnail({ firstImage: null, itemTypeCode: 'WALK' })).toContain(
      '/illustrations/plan-item-walk.svg',
    )
    expect(renderThumbnail({ firstImage: null, itemTypeCode: 'MOVE' })).toContain(
      '/illustrations/plan-item-move.svg',
    )
  })

  it('사진이 있으면 사진이 이긴다', () => {
    const html = renderThumbnail({
      firstImage: 'https://tong.visitkorea.or.kr/a.jpg',
      itemTypeCode: 'LODGING',
    })

    expect(html).not.toContain('/illustrations/')
  })

  /* 유형을 지어내지 않는다 — 모르는 코드는 예전 그대로 회색 타일이다 */
  it('모르는 유형은 회색 타일 그대로다', () => {
    const html = renderThumbnail({ firstImage: null, itemTypeCode: 'SOMETHING_NEW' })

    expect(html).not.toContain('/illustrations/')
  })

  /*
    **장식이라 이름을 갖지 않는다.** 무엇인지는 제목과 유형 배지가 이미 낱말로 말한다 —
    `alt` 를 채우면 같은 사실이 스크린 리더에서 두 번 들린다 (`place-row.tsx` 와 같은 판단).
  */
  it('일러스트는 alt 가 비어 있다', () => {
    const html = renderThumbnail({ firstImage: null, itemTypeCode: 'MEAL' })

    expect(html).toMatch(/<img[^>]*src="\/illustrations\/place-restaurant\.svg"[^>]*alt=""/)
  })
})
