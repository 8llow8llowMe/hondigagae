import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { PlanBriefingCurve } from '@/features/plan/plan-briefing-section'
import { PlanBriefingHeader, PlanBriefingSection } from '@/features/plan/plan-briefing-section'
import { mockWalkTimes } from '@/lib/api/mock/insight-data'
import { messages } from '@/lib/messages'
import {
  planBriefing,
  planBriefingItem,
  planBriefingSchedule,
  planBriefingWalkTimes,
  planBriefingWarning,
  planVerdict,
} from '@/test/fixtures/plan'
import type { PlanBriefingResponse, PlanDayWeatherItem } from '@/types/plan'

/**
 * 곡선이 그려졌는지 세는 표식 — `HourCell` 의 칸 폭이다.
 *
 * 문구로 세지 않는다: 행 라벨 `노면` 은 기준 캡션의 `노면(아스팔트)` 와 겹치고, 스크롤
 * 화살표 라벨은 클라이언트 측정을 거쳐야 나와 SSR 마크업에 없다.
 */
const CURVE_CELL = 'min-width:3.5rem'

/**
 * 지도 기준 줄 — **줄 전체로 센다.** `협재해수욕장 기준` 은 골든타임 각주
 * (`… 기준 · 노면(아스팔트) 온도는 추정치예요`)의 앞부분과 겹쳐서, 부분 문자열로는
 * 지도가 없는데 있다고 읽는다.
 */
const MAP_BASIS_LINE = `>${messages.plan.briefingScheduleMapBasis.replace('{title}', '협재해수욕장')}</p>`

/** 곡선을 아직 안 받은 기본값 — 이 이슈의 갈래는 대부분 곡선과 무관하다 */
const NO_CURVE: PlanBriefingCurve = { hourly: null, failed: false, onRetry: () => undefined }

/**
 * **기본 갈래는 `TODAY` 다** — 카드 넷이 그대로 서는 쪽이라 기존 갈래별 검사가 그대로
 * 성립한다. 전날 갈래는 `renderEve()` 가 따로 그린다 (#733).
 */
function render(
  overrides: Partial<PlanBriefingResponse> = {},
  curve: PlanBriefingCurve = NO_CURVE,
  basisPetName: string | null = null,
) {
  return renderToStaticMarkup(
    createElement(PlanBriefingSection, {
      briefing: planBriefing(overrides),
      kind: 'TODAY',
      basisPetName,
      curve,
      onRetry: () => undefined,
    }),
  )
}

/**
 * 전날 갈래 — **서버가 특보·골든타임을 채우지 않는 날이다.**
 *
 * `today === false` 면 두 필드가 null 이고 각 이유 문장이 채워진다 (`types/plan.ts`).
 * 기본값을 그 모양으로 두어야 화면이 실제로 받는 응답을 그린다.
 */
function renderEve(overrides: Partial<PlanBriefingResponse> = {}) {
  return renderToStaticMarkup(
    createElement(PlanBriefingSection, {
      briefing: planBriefing({
        today: false,
        weatherWarning: null,
        weatherWarningUnavailableReasonCode: 'NOT_TODAY',
        weatherWarningUnavailableReason: '기상특보는 출발 당일에만 확인합니다.',
        walkTimes: null,
        walkTimesUnavailableReasonCode: 'NOT_TODAY',
        walkTimesUnavailableReason: '산책 골든타임은 출발 당일에만 제공됩니다.',
        ...overrides,
      }),
      kind: 'EVE',
      basisPetName: null,
      curve: NO_CURVE,
      onRetry: () => undefined,
    }),
  )
}

/*
  ── 기상특보 — 이 이슈의 핵심 규칙 (명세 D5-3) ──────────────────────────────

  서버 javadoc: *"특보는 필드와 이유가 둘 다 null 일 때만 '발효 중인 특보 없음' 이다 —
  확인하지 못한 날은 이유가 채워진다."* 이유를 "없음" 으로 접으면 태풍경보를 조용히 지운다.
*/
describe('PlanBriefingSection — 기상특보의 "없음" 과 "확인 못 함"', () => {
  it('필드와 이유가 둘 다 null 일 때만 "없음" 이라고 말한다', () => {
    const markup = render({ weatherWarning: null, weatherWarningUnavailableReason: null })

    expect(markup).toContain(messages.plan.briefingWarningNone)
  })

  /** 회귀 감시의 본체 — 이유가 있는데 "없음" 으로 접으면 여기서 깨진다 */
  it('이유가 있으면 "없음" 이 아니라 "확인 못 함" 이고 서버 문장을 그대로 쓴다', () => {
    const reason = '기상특보는 출발 당일에만 확인합니다.'
    const markup = render({
      weatherWarning: null,
      weatherWarningUnavailableReason: reason,
    })

    expect(markup).toContain(messages.plan.briefingWarningUnavailableTitle)
    expect(markup).toContain(reason)
    expect(markup).not.toContain(messages.plan.briefingWarningNone)
  })

  it('조회 실패 문장도 같은 갈래로 간다 — 문장을 파싱해 가르지 않는다', () => {
    const reason = '기상특보 정보를 가져오지 못했습니다. 기상청 발표를 직접 확인해 주세요.'
    const markup = render({
      weatherWarning: null,
      weatherWarningUnavailableReason: reason,
    })

    expect(markup).toContain(reason)
    expect(markup).not.toContain(messages.plan.briefingWarningNone)
  })

  /*
    **이유 문장에 `다시 시도` 를 달지 않는다** (명세 D9-2). 코드가 없어 "당일에만
    확인"(정상)과 "가져오지 못했다"(일시 장애)를 화면이 가를 수 없다 — 고칠 수 없는 것에
    버튼을 달면 사용자가 계속 누른다.
  */
  it('특보를 확인하지 못한 날에 재시도 버튼을 달지 않는다', () => {
    const markup = render({
      weatherWarning: null,
      weatherWarningUnavailableReason: '기상특보는 출발 당일에만 확인합니다.',
      // 골든타임 쪽 재시도가 섞여 들어오지 않게 같은 갈래로 둔다
      walkTimes: null,
      walkTimesUnavailableReason: '산책 골든타임은 출발 당일에만 확인합니다.',
    })

    expect(markup).not.toContain(messages.common.retry)
  })

  it('특보가 있으면 배지 안에 낱말로 적고 "없음" 을 말하지 않는다', () => {
    const markup = render({ weatherWarning: planBriefingWarning() })

    expect(markup).toContain('태풍')
    expect(markup).toContain('경보')
    expect(markup).not.toContain(messages.plan.briefingWarningNone)
  })

  it('경보 단계 설명은 level 쪽을 쓴다 — type.description 은 판정 근거가 이미 쓴다', () => {
    const warning = planBriefingWarning()
    const markup = render({ weatherWarning: warning })

    expect(markup).toContain(warning.level.description)
    expect(markup).not.toContain(warning.type.description)
  })

  it('발효 시각은 HH:mm 만 쓰고, 없으면 그 줄을 만들지 않는다', () => {
    const withTime = render({ weatherWarning: planBriefingWarning() })
    const without = render({ weatherWarning: planBriefingWarning({ effectiveAt: null }) })

    // `발효 중이라 …`(추천 보류)와 섞이지 않게 시각이 붙은 꼴로만 센다
    expect(withTime).toContain('07:00 발효')
    expect(without).not.toMatch(/\d\d:\d\d 발효/)
  })

  /** **`level.code` 로 직접 판정하지 않는다** — 서버 DTO 가 이 값을 쓰라고 못박는다 */
  it('추천 보류 문장은 recommendationSuppressed 가 정한다', () => {
    const on = render({ weatherWarning: planBriefingWarning({ recommendationSuppressed: true }) })
    const off = render({
      weatherWarning: planBriefingWarning({ recommendationSuppressed: false }),
    })

    expect(on).toContain(messages.plan.briefingWarningSuppressed)
    expect(off).not.toContain(messages.plan.briefingWarningSuppressed)
  })
})

describe('PlanBriefingSection — 산책하기 좋은 시간 (명세 D5-4)', () => {
  /*
    **`NO_PLACE_POINT` 는 좌표가 없다는 사유 그 자체다** — 곡선을 부를 좌표도 없고 다시
    시도할 것도 없다. 사유 코드가 생긴 뒤에도 이 갈래의 화면은 그대로다 (#716).
  */
  it('walkTimes 가 null 이면 이유 문장만 내고 곡선도 재시도도 없다', () => {
    const reason = '대표 장소의 좌표가 없어 골든타임을 붙이지 못했습니다.'
    const markup = render({
      walkTimes: null,
      walkTimesUnavailableReasonCode: 'NO_PLACE_POINT',
      walkTimesUnavailableReason: reason,
      schedule: planBriefingSchedule({ representativeLat: null, representativeLng: null }),
    })

    expect(markup).toContain(reason)
    expect(markup).not.toContain(messages.common.retry)
    expect(markup).not.toContain(CURVE_CELL)
  })

  it('AVAILABLE 이면 창을 시각으로 적는다', () => {
    const markup = render()

    expect(markup).toContain('18:00 – 21:00')
  })

  /** en dash 를 "에서" 로 읽지 못하는 보조기기에 낱말로도 준다 (명세 D6) */
  it('시각 범위를 sr-only 낱말로도 말한다', () => {
    expect(render()).toContain('18:00부터 21:00까지')
  })

  /*
    **추천 구간 헤드라인 줄** — 시각이 곧 그 줄이다. 카드 제목(`h1`)도 `text-title-1` 을
    쓰지만 그쪽은 `<h1>` 이라 `<p` 로 시작하는 이 정규식에 걸리지 않는다.
  */
  function headlineLine(markup: string): string {
    return /<p class="text-title-1[^>]*>.*?<\/p>/.exec(markup)?.[0] ?? ''
  }

  /** 창 전체 등급이 `CAUTION` 인 날 — 접힌 값이라 창 안에는 안전한 칸이 섞여 있다 */
  const CAUTION_GOLDEN = {
    walkTimes: planBriefingWalkTimes({
      goldenLevel: { code: 'CAUTION', name: '주의', description: null, scoreDescription: null },
    }),
  }

  /*
    **#671 A-4 — `walk-times-section` 의 A-3 과 같은 판정이다.**

    #637 이 `11:00 – 23:00 [주의]` 배지를 걷은 이유가 "창 **전체**가 주의" 로 읽히는
    것이었는데, 배지의 글자만 지우고 **같은 주장을 하던 색이 헤드라인에 남아 있었다.**
    `goldenLevel` 은 서버가 창 안 등급을 `worseOf` 로 접은 값이라, 22px 굵은 시각을 그
    색으로 칠하면 창 안 안전한 칸들까지 주의색 아래로 들어간다.

    #656 이후 곡선의 면은 **칸마다** 등급이 갈린다 — 이 색만 홀로 "창 하나에 등급 하나" 를
    말하고 있었다.
  */
  it('헤드라인이 창 전체를 한 등급으로 칠하지 않는다', () => {
    const line = headlineLine(render(CAUTION_GOLDEN))

    expect(line).toContain('18:00')
    expect(line).not.toContain('text-metric-')
  })

  /** 색을 걷는 것이지 톤을 낮추는 것이 아니다 — 카드 제목과 같은 본문 색으로 선다 */
  it('헤드라인이 본문 색을 쓴다', () => {
    expect(headlineLine(render(CAUTION_GOLDEN))).toContain('text-fg')
  })

  /*
    **`goldenLevel` 이 이 섹션의 렌더에서 사라졌다** (A-4). 응답 필드·타입은 그대로 받는다 —
    곡선 면(#656)이 `hourly` 를 근거로 칸마다 칠하므로 화면에 소비처가 없어진 것이지 계약이
    바뀐 것이 아니다. 소비처가 다시 생기면 "창 하나에 등급 하나" 가 조용히 돌아오므로
    **소스에서 직접 본다**: 렌더 결과로는 잡히지 않는다.

    **브리핑에는 A-3 의 등급 문장(`GoldenWindowLevels`)에 해당하는 자리가 없다.** 브리핑
    응답에 `hourly` 가 없어서다 (`PlanBriefingWalkTimes` javadoc) — 등급을 칸 단위로 말하는
    것은 곡선뿐이고, 그 아래 줄은 서버 `goldenWindowStatus.description` 이다.
  */
  it('goldenLevel 을 렌더에 쓰지 않는다', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./plan-briefing-section.tsx', import.meta.url)),
      'utf8',
    )
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    expect(code).not.toContain('goldenLevel')
  })

  /*
    **상태 문구를 FE 가 짓지 않는다.** `goldenWindowStatus` 는 metadata 고 서버가 한국어를
    채워 보낸다 — `goldenStart` 가 null 이라는 이유만으로 "모두 위험" 이라고 쓰지 않는다
    (그 문장은 `ALL_HOURS_RISKY` 일 때만 참이다).
  */
  it('SUPPRESSED_BY_WARNING 은 서버 name·description 을 그대로 쓴다', () => {
    const status = {
      code: 'SUPPRESSED_BY_WARNING',
      name: '특보로 추천 보류',
      description:
        '기상특보 경보가 발효 중이라 시간대가 좋아도 추천하지 않습니다. 시간대 곡선은 근거로 그대로 제공됩니다.',
    }
    const markup = render({
      walkTimes: planBriefingWalkTimes({
        goldenStart: null,
        goldenEnd: null,
        goldenWindowStatus: status,
      }),
    })

    expect(markup).toContain(status.name)
    expect(markup).toContain(status.description)
    expect(markup).not.toContain('모두 위험')
  })

  it('모르는 코드도 서버 문구를 그대로 낸다 — FE 매핑 테이블을 만들지 않는다', () => {
    const status = { code: 'NEW_SERVER_CODE', name: '새 상태', description: '새 설명입니다.' }
    const markup = render({
      walkTimes: planBriefingWalkTimes({
        goldenStart: null,
        goldenEnd: null,
        goldenWindowStatus: status,
      }),
    })

    expect(markup).toContain('새 상태')
    expect(markup).toContain('새 설명입니다.')
  })

  it('UNAVAILABLE 에만 곡선 재시도를 준다 — DAY_ENDED 는 정상이라 달지 않는다', () => {
    const broken = render({
      walkTimes: planBriefingWalkTimes({
        forecastCoverage: { code: 'UNAVAILABLE', name: '예보 없음', description: null },
      }),
    })
    const normal = render({
      walkTimes: planBriefingWalkTimes({
        forecastCoverage: { code: 'DAY_ENDED', name: '오늘 예보 종료', description: null },
      }),
    })

    expect(broken).toContain(messages.common.retry)
    expect(normal).not.toContain(messages.common.retry)
  })

  it('곡선 조회가 실패하면 그 자리만 실패하고 창·상태는 남는다', () => {
    const markup = render({}, { hourly: null, failed: true, onRetry: () => undefined })

    expect(markup).toContain(messages.plan.briefingCurveErrorTitle)
    expect(markup).toContain(messages.common.retry)
    // 창은 브리핑 응답의 것이라 곡선 실패와 무관하게 그대로 있다
    expect(markup).toContain('18:00 – 21:00')
  })

  it('곡선이 오면 그린다', () => {
    const data = mockWalkTimes({ heatSensitive: false, coldSensitive: true, noiseSensitive: false })
    const markup = render({}, { hourly: data.hourly, failed: false, onRetry: () => undefined })

    expect(markup).toContain(CURVE_CELL)
  })

  it('곡선이 빈 배열이면 곡선 자리를 비운다 — 상태 문구가 이미 이유를 말한다', () => {
    const markup = render({}, { hourly: [], failed: false, onRetry: () => undefined })

    expect(markup).not.toContain(CURVE_CELL)
  })

  /** **"현재 위치 기준" 이 아니다** — 그날 대표 장소 좌표 기준이다 */
  it('기준 줄이 대표 장소를 말한다', () => {
    const markup = render()

    expect(markup).toContain('협재해수욕장 기준')
    expect(markup).not.toContain('현재 위치')
  })

  it('대표 장소가 없으면 앞을 빼고 뒤만 쓴다', () => {
    const markup = render({
      schedule: planBriefingSchedule({
        representativePlaceId: null,
        representativePlaceTitle: null,
      }),
    })

    expect(markup).toContain(messages.plan.briefingWalkBasisNoPlace)
    expect(markup).not.toContain('기준 ·')
  })
})

/*
  ── 사유 코드로 재시도를 가른다 (#716 · 명세 D9-2) ──────────────────────────

  이유가 문장뿐이던 v1 은 "당일에만"(정상)과 "가져오지 못했다"(일시 장애)를 가를 수 없어
  **아무 데도 `다시 시도` 를 달지 못했다.** 코드가 오면서 그 제약이 풀렸다 — 다만 풀린
  것은 `LOOKUP_FAILED` 하나뿐이고, 나머지는 눌러도 같은 응답이라 버튼을 달면 계속 누른다.
*/
describe('PlanBriefingSection — 사유 코드와 재시도 (명세 D9-2)', () => {
  it('특보가 LOOKUP_FAILED 면 다시 시도를 단다', () => {
    const markup = render({
      weatherWarning: null,
      weatherWarningUnavailableReasonCode: 'LOOKUP_FAILED',
      weatherWarningUnavailableReason: '기상특보 정보를 가져오지 못했습니다.',
    })

    expect(markup).toContain(messages.common.retry)
  })

  it('특보가 NOT_TODAY 면 다시 시도를 달지 않는다 — 눌러도 생기지 않는 값이다', () => {
    const markup = render({
      weatherWarning: null,
      weatherWarningUnavailableReasonCode: 'NOT_TODAY',
      weatherWarningUnavailableReason: '기상특보는 출발 당일에만 확인합니다.',
    })

    expect(markup).not.toContain(messages.common.retry)
  })

  /**
   * **세 상태를 가르는 규칙은 코드가 생긴 뒤에도 그대로다** — 문장과 코드가 **둘 다** null
   * 일 때만 "특보 없음" 이다. 코드만 보고 접으면 태풍경보를 조용히 지우던 v1 의 실패로
   * 되돌아간다.
   */
  it('코드만 있고 문장이 없어도 "특보 없음" 으로 쓰지 않는다', () => {
    const markup = render({
      weatherWarning: null,
      weatherWarningUnavailableReasonCode: 'LOOKUP_FAILED',
      weatherWarningUnavailableReason: null,
    })

    expect(markup).not.toContain(messages.plan.briefingWarningNone)
    expect(markup).toContain(messages.plan.briefingWarningUnavailableTitle)
  })

  it('골든타임이 LOOKUP_FAILED 면 다시 시도를 단다', () => {
    const markup = render({
      walkTimes: null,
      walkTimesUnavailableReasonCode: 'LOOKUP_FAILED',
      walkTimesUnavailableReason: '산책 골든타임 정보를 가져오지 못했습니다.',
    })

    expect(markup).toContain(messages.common.retry)
  })

  /*
    **`NO_PLACE_ITEM` 은 재시도가 아니라 할 일이다.** 서버 enum 이 이 문제를 직접 적어
    뒀다 — *"정작 사용자가 할 일(장소 담기)은 화면 어디에도 드러나지 않는다."*
  */
  it('골든타임이 NO_PLACE_ITEM 이면 재시도 대신 장소 담기로 보낸다', () => {
    const markup = render({
      walkTimes: null,
      walkTimesUnavailableReasonCode: 'NO_PLACE_ITEM',
      walkTimesUnavailableReason: '이 날짜에는 장소가 지정된 일정 항목이 없어 …',
    })

    expect(markup).not.toContain(messages.common.retry)
    expect(markup).toContain(messages.plan.briefingWalkNoPlaceItemAction)
    expect(markup).toContain(`/plans/${planBriefing().planId}/days/${planBriefing().day}/add`)
  })

  /*
    **곡선 실패는 곡선 재시도로 푼다.** 브리핑 재시도로 대신하면, 재조회가 같은
    `LOOKUP_FAILED` 를 낼 때 좌표가 같아 `queryKey` 가 같고 에러 상태 곡선 쿼리는 다시
    돌지 않는다 — 눌러도 곡선이 영원히 오지 않는다.
  */
  it('골든타임이 없는 갈래에서 곡선이 실패하면 곡선 오류 문구를 낸다', () => {
    const markup = render(
      {
        walkTimes: null,
        walkTimesUnavailableReasonCode: 'LOOKUP_FAILED',
        walkTimesUnavailableReason: '산책 골든타임 정보를 가져오지 못했습니다.',
      },
      { hourly: null, failed: true, onRetry: () => undefined },
    )

    expect(markup).toContain(messages.plan.briefingCurveErrorTitle)
  })

  /*
    **항목이 아예 없는 날에는 내지 않는다** — 그날 일정 카드의 `EmptyState` 가 이미 **같은
    주소로** 보낸다. 라벨만 다른 버튼 둘이 한 화면에 서면 반복은 강조가 아니라 소음이다.
  */
  it('항목이 0개면 장소 담기 버튼을 두 번 두지 않는다', () => {
    const markup = render({
      schedule: planBriefingSchedule({ itemCount: 0, firstItem: null, lastItem: null }),
      walkTimes: null,
      walkTimesUnavailableReasonCode: 'NO_PLACE_ITEM',
      walkTimesUnavailableReason: '이 날짜에는 장소가 지정된 일정 항목이 없어 …',
    })

    expect(markup).toContain(messages.plan.briefingScheduleEmptyAction)
    expect(markup).not.toContain(messages.plan.briefingWalkNoPlaceItemAction)
  })

  /** 원격 장애는 특보·골든타임을 함께 때린다 — 이름 없는 `다시 시도` 가 둘 서면 안 된다 */
  it('두 카드가 함께 실패해도 재시도 버튼의 접근 이름이 갈린다', () => {
    const markup = render({
      weatherWarning: null,
      weatherWarningUnavailableReasonCode: 'LOOKUP_FAILED',
      weatherWarningUnavailableReason: '기상특보 정보를 가져오지 못했습니다.',
      walkTimes: null,
      walkTimesUnavailableReasonCode: 'LOOKUP_FAILED',
      walkTimesUnavailableReason: '산책 골든타임 정보를 가져오지 못했습니다.',
    })

    expect(markup).toContain(messages.plan.briefingWarningRetryLabel)
    expect(markup).toContain(messages.plan.briefingWalkRetryLabel)
  })

  /** 서버가 코드를 하나 더 내도 화면이 깨지지 않는다 — 모르는 코드는 재시도 없는 쪽이다 */
  it('모르는 사유 코드에는 재시도를 달지 않는다', () => {
    const markup = render({
      walkTimes: null,
      walkTimesUnavailableReasonCode: 'SOMETHING_NEW',
      walkTimesUnavailableReason: '새 사유입니다.',
    })

    expect(markup).not.toContain(messages.common.retry)
  })
})

/*
  ── 좌표 폴백 (#716 · 명세 D9-3) ────────────────────────────────────────────

  좌표가 `schedule` 에도 오면서 **골든타임을 못 붙인 날에도 곡선을 부를 수 있다.** 다만
  tour 의 곡선은 "오늘 남은 시간" 전용이라 실익이 있는 갈래는 `LOOKUP_FAILED` 하나다 —
  나머지 셋은 좌표가 없거나(둘) 오늘이 아니다(하나).
*/
describe('PlanBriefingSection — 좌표 폴백 (명세 D9-3)', () => {
  it('골든타임이 없어도 곡선을 받았으면 그린다', () => {
    const markup = render(
      {
        walkTimes: null,
        walkTimesUnavailableReasonCode: 'LOOKUP_FAILED',
        walkTimesUnavailableReason: '산책 골든타임 정보를 가져오지 못했습니다.',
      },
      { hourly: mockWalkTimes(null).hourly, failed: false, onRetry: () => undefined },
    )

    expect(markup).toContain(CURVE_CELL)
  })

  /**
   * **창·상태의 정본은 브리핑 응답이다** (명세 D3-3). 골든타임이 없는 날에 곡선만 그릴
   * 때 화면이 창을 지어내면 두 채널이 갈린다 — 곡선은 근거로만 선다.
   */
  it('골든타임이 없는 날의 곡선에는 추천 구간을 지어내지 않는다', () => {
    const markup = render(
      {
        walkTimes: null,
        walkTimesUnavailableReasonCode: 'LOOKUP_FAILED',
        walkTimesUnavailableReason: '산책 골든타임 정보를 가져오지 못했습니다.',
      },
      { hourly: mockWalkTimes(null).hourly, failed: false, onRetry: () => undefined },
    )

    expect(markup).not.toContain('18:00 – 21:00')
  })

  /*
    **지도는 좌표가 있을 때만 선다** — `PlaceMiniMap` 이 좌표 없으면 통째로 사라진다.
    캔버스는 `ssr: false` 라 서버 렌더에 없고, 길찾기 링크가 그 자리의 표식이다.
  */
  it('대표 장소 좌표가 있으면 지도와 길찾기를 그린다', () => {
    expect(render()).toContain('map.kakao.com/link/to')
  })

  /*
    **`map.kakao.com` 부재만으로는 부족하다.** 캔버스는 `ssr: false` 라 서버 렌더에 없어
    그 단언은 길찾기 링크만 본다 — 빈 래퍼가 남아 `gap-3` 이 두 번 먹어도 통과한다.
    기준 줄이 지도 자리의 표식이라 그것으로 함께 센다.
  */
  it('대표 장소 좌표가 없으면 지도 자리를 아예 만들지 않는다', () => {
    const markup = render({
      schedule: planBriefingSchedule({ representativeLat: null, representativeLng: null }),
    })

    expect(markup).not.toContain('map.kakao.com/link/to')
    expect(markup).not.toContain(MAP_BASIS_LINE)
  })

  /**
   * **`0` 은 좌표 미상이다** (`lib/geo/coord.ts`). `!= null` 로만 거르면 지도는 사라지는데
   * 곡선은 기니 만 앞바다를 부르는 모순이 한 화면에 생긴다 — 지도 쪽 관문을 먼저 잠근다.
   */
  it('좌표가 0 이면 지도를 그리지 않는다', () => {
    const markup = render({
      schedule: planBriefingSchedule({ representativeLat: 0, representativeLng: 0 }),
    })

    expect(markup).not.toContain('map.kakao.com/link/to')
  })

  /** 핀이 대표 장소 하나뿐이라 "이 날의 경로" 로 읽히지 않게 기준을 적는다 */
  it('지도 위에 기준 장소를 적는다', () => {
    expect(render()).toContain(MAP_BASIS_LINE)
  })
})

describe('PlanBriefingSection — 그날 일정 (명세 D5-1)', () => {
  it('항목 수와 다녀온 수를 적는다 — 0 도 정보다', () => {
    const markup = render({ schedule: planBriefingSchedule({ itemCount: 4, visitedCount: 0 }) })

    expect(markup).toContain('항목 4개 · 다녀온 곳 0개')
  })

  it('항목이 0개면 빈 상태와 담기 링크를 내고 동선을 그리지 않는다', () => {
    const markup = render({
      schedule: planBriefingSchedule({
        itemCount: 0,
        visitedCount: 0,
        firstItem: null,
        lastItem: null,
      }),
    })

    expect(markup).toContain(messages.plan.briefingScheduleEmptyTitle)
    expect(markup).toContain('/days/2/add')
    expect(markup).not.toContain('<ol')
  })

  /*
    ── 동선 흐름 (#733) ────────────────────────────────────────────────────────

    **`처음` · `마지막` 라벨을 값과 한 노드에 두지 않는다.** 예전에는 둘이 같은 굵기·크기·
    색으로 붙어 `처음 함덕 서우봉 해변` 이 한 문장처럼 읽혔다. 순서는 `ol` 과 점·선이 말한다.
  */
  it('처음·마지막 라벨을 글자로 쓰지 않고 ol 로 순서를 남긴다', () => {
    const markup = render()

    expect(markup).toContain('<ol')
    expect(markup).not.toContain('처음 ')
    expect(markup).not.toContain('마지막 ')
  })

  it('항목이 하나면 마디를 하나만 세운다 — 처음과 마지막이 같은 항목이다', () => {
    const only = planBriefingItem()
    const markup = render({
      schedule: planBriefingSchedule({ itemCount: 1, firstItem: only, lastItem: only }),
    })

    expect(markup).toContain('10:30')
    expect(markup).toContain('협재해수욕장')
    // 동선 마디의 표식 — 판정 근거 목록의 `li` 와 섞이지 않게 마디 클래스로 센다
    expect(markup.split('last:pb-0').length - 1).toBe(1)
  })

  it('처음과 마지막 사이에 낀 항목 수를 센다 — 거리는 응답에 없다', () => {
    const markup = render({ schedule: planBriefingSchedule({ itemCount: 4 }) })

    expect(markup).toContain('사이 2곳')
  })

  it('바로 이어지는 두 항목이면 사이 줄을 내지 않는다', () => {
    const markup = render({ schedule: planBriefingSchedule({ itemCount: 2 }) })

    expect(markup).not.toContain('사이')
  })

  it('시각이 없는 항목은 제목만 남기고 자리표시를 만들지 않는다', () => {
    const markup = render({
      schedule: planBriefingSchedule({
        itemCount: 1,
        firstItem: planBriefingItem({ startTime: null }),
        lastItem: planBriefingItem({ startTime: null }),
      }),
    })

    expect(markup).toContain('협재해수욕장')
    expect(markup).not.toContain('--:--')
    // 시각이 붙은 마디의 꼴(`10:30 `)이 남지 않는다. `18:00 – 21:00` 은 골든타임 카드다
    expect(markup).not.toContain('10:30')
  })

  /*
    **유형 라벨을 그린다** (#716 · 명세 D9-1). `itemType` 이 metadata 가 되면서 v1 이 라벨을
    포기했던 이유(FE 한국어 매핑 테이블이 필요하다)가 사라졌다 — 서버 `name` 을 그대로 쓴다.
  */
  it('itemType 의 name 을 마디마다 그린다', () => {
    const markup = render()

    // `장소` 는 기준 장소 태그와 겹쳐 표식이 되지 못한다 — 겹치지 않는 쪽으로 센다
    expect(markup).toContain('숙박')
  })

  /** 라벨은 `name` 이다 — `code` 가 그대로 새면 FE 가 서버 문구를 안 쓰고 있다는 뜻이다 */
  it('itemType 코드가 화면에 새지 않는다', () => {
    const markup = render()

    expect(markup).not.toContain('LODGING')
    expect(markup).not.toContain('PLACE')
  })

  /*
    **기준 장소는 해당 마디에 태그로 붙는다** (#733). 별도 줄로 세우면 동선 아래에 같은
    장소 이름이 한 번 더 서서, 마디 둘짜리 카드에 장소 줄이 셋이 된다.

    이을 열쇠가 응답에 없어(항목은 `planItemId`, 기준은 **장소** id) 제목으로 맞춘다 —
    픽스처의 기준 장소가 첫 마디와 같은 `협재해수욕장` 이다.
  */
  it('기준 장소가 처음 마디면 태그로 붙이고 별도 줄을 내지 않는다', () => {
    const markup = render()

    expect(markup).toContain(messages.plan.briefingScheduleBasisTag)
    expect(markup).not.toContain('이 날 기준 장소 · 협재해수욕장')
  })

  it('기준 장소가 처음·마지막 어느 쪽도 아니면 예전처럼 줄로 남는다', () => {
    const markup = render({
      schedule: planBriefingSchedule({ representativePlaceTitle: '성산일출봉' }),
    })

    expect(markup).toContain('>이 날 기준 장소 · 성산일출봉</a>')
  })

  it('대표 장소 id 가 없으면 링크를 만들지 않는다', () => {
    const plain = render({
      schedule: planBriefingSchedule({
        representativePlaceId: null,
        representativePlaceTitle: '성산일출봉',
      }),
    })

    // 링크가 아니라 글자로만 남는다. `/places/` 자체는 날씨 카드의 산책 버튼이 쓴다
    expect(plain).toContain('이 날 기준 장소 · 성산일출봉')
    expect(plain).not.toContain('>이 날 기준 장소 · 성산일출봉</a>')
  })

  it('그 일차 앵커로 돌아가는 링크를 준다', () => {
    expect(render()).toContain('#day2')
  })
})

describe('PlanBriefingSection — 날씨와 적합도 (명세 D5-2)', () => {
  it('일정 상세와 같은 판정 컴포넌트를 쓴다', () => {
    const markup = render()

    expect(markup).toContain('여행 적합')
  })

  it('weather 가 null 이면 자리를 비우지 않고 못 받았다고 말한다', () => {
    expect(render({ weather: null })).toContain(messages.plan.briefingWeatherMissing)
  })

  /*
    ── 하루 지표 줄 (#733) ─────────────────────────────────────────────────────

    응답에 실려 오는데 화면이 버리고 있던 값들이다. **시간대 라벨을 붙이지 않는다** —
    전부 하루치 집계라 `아침`·`낮` 으로 옮겨 적으면 응답에 없는 사실을 지어내는 것이 된다.
  */
  it('하늘상태·최저기온·강수확률을 세운다 — 판정 카드가 버리던 값이다', () => {
    const markup = render()

    expect(markup).toContain('맑음')
    expect(markup).toContain('최저 21.0℃')
    expect(markup).toContain('강수 10%')
  })

  it('시간대 라벨을 만들지 않는다 — 응답에 시간대별 값이 없다', () => {
    const markup = render()

    for (const label of ['아침', '낮', '저녁', '오전', '오후']) {
      expect(markup).not.toContain(label)
    }
  })

  /** 큰 숫자가 이미 최고기온인 날(중기예보)에 같은 값을 두 번 세우지 않는다 */
  it('체감온도를 못 받은 날에는 최고기온을 지표 줄에서 뺀다', () => {
    const markup = render({
      weather: {
        ...planVerdict,
        weather: {
          date: '2026-09-13',
          forecastSourceCode: 'MID_TERM',
          forecastSourceName: '중기예보',
          minTemperature: 21,
          maxTemperature: 26,
          maxFeelsLikeTemperature: null,
          maxPrecipitationProbability: 10,
          precipitationTypeName: '없음',
          skyStateName: '흐림',
          maxWindSpeed: 3.1,
          maxHumidity: 60,
        },
      },
    })

    expect(markup).toContain('최저 21.0℃')
    expect(markup).not.toContain('최고 26.0℃')
  })

  it('날씨 값이 없으면 지표 줄 자체를 내지 않는다', () => {
    const markup = render({ weather: { ...planVerdict, weather: null } })

    expect(markup).not.toContain('최저')
    expect(markup).not.toContain('강수')
  })
})

/*
  ── 갈래 (#733) ───────────────────────────────────────────────────────────────

  **전날에는 값이 없는 카드를 그리지 않는다.** 서버가 특보·골든타임을 당일에만 채우므로
  (`today === false` 면 둘 다 null + 이유 문장) 전날 카드 둘은 안내 한 줄만 담고 있었다.

  갈래는 `pickBriefingDate` 가 이미 돌려주는 `kind` 다 — 새 판정 축을 만들지 않는다.
*/
describe('PlanBriefingSection — EVE / TODAY 갈래', () => {
  it('EVE 는 카드 둘을 접고 각주 한 줄로 내린다', () => {
    const markup = renderEve()

    // 각주 문장 자체가 `기상특보` 를 담으므로 **제목 꼴**로 센다
    expect(markup).not.toContain(`>${messages.plan.briefingWarningHeading}<`)
    expect(markup).not.toContain(`>${messages.plan.briefingWalkHeading}<`)
    expect(markup).toContain(messages.plan.briefingEveFootnote)
    expect(markup.split('<h2').length - 1).toBe(2)
  })

  it('EVE 각주는 실패 톤이 아니다 — 서버의 "확인하지 못했습니다" 문장도 함께 내리지 않는다', () => {
    const markup = renderEve()

    expect(markup).not.toContain(messages.plan.briefingWarningUnavailableTitle)
    expect(markup).not.toContain('기상특보는 출발 당일에만 확인합니다.')
  })

  it('EVE 날씨 카드는 제목으로 갈래를 말한다', () => {
    expect(renderEve()).toContain(messages.plan.briefingWeatherEveHeading)
    expect(render()).toContain(messages.plan.briefingWeatherTodayHeading)
  })

  /*
    **회귀 감시의 본체.** `kind` 는 FE 시계로 고른 값이라 자정 전후에 서버 응답과 갈릴 수
    있다 — 그때 값이 실려 왔는데 카드째 접으면 이 화면이 가장 크게 지키는 규칙(태풍경보를
    조용히 지우지 않는다)을 뒤에서 깨게 된다.
  */
  it('EVE 라도 특보가 실려 오면 접지 않는다', () => {
    const markup = renderEve({
      weatherWarning: planBriefingWarning(),
      weatherWarningUnavailableReason: null,
    })

    expect(markup).toContain(`>${messages.plan.briefingWarningHeading}<`)
    expect(markup).not.toContain(messages.plan.briefingEveFootnote)
  })

  it('TODAY 는 카드 넷 그대로다', () => {
    const markup = render()

    expect(markup).toContain(`>${messages.plan.briefingWarningHeading}<`)
    expect(markup).toContain(`>${messages.plan.briefingWalkHeading}<`)
    expect(markup).not.toContain(messages.plan.briefingEveFootnote)
  })
})

/*
  ── 값이 없는 날씨 카드 (#788 · 명세 D11-1) ─────────────────────────────────

  **오늘 출발인데 그날 항목이 하나도 없는 갈래다.** 서버가 기준 장소를 못 잡아
  (`NO_PLACE_ITEM`) 판정도 날씨 값도 비우고, 화면의 두 조각(`PlanDayVerdict` ·
  지표 줄)이 각자 옳게 `null` 을 내 **제목만 남은 카드**가 섰다.

  접는 규칙은 전날 갈래와 같은 것이다 — **값이 실제로 비어 있을 때만 접는다**(D11-2).
  사유 코드나 날짜로 다시 가르지 않는다.
*/
describe('PlanBriefingSection — 값이 없는 날씨 카드 (명세 D11-1)', () => {
  /** 기준 장소를 못 잡은 날의 판정 — 점수도 날씨 값도 비어 온다 (`mock/plan-data.ts`) */
  const noPlaceItemVerdict: PlanDayWeatherItem = {
    ...planVerdict,
    representativePlaceId: null,
    representativePlaceTitle: null,
    basisPetId: null,
    score: null,
    suitabilityLevel: null,
    reasons: [],
    petSuitabilities: [],
    weather: null,
    unavailableReasonCode: 'NO_PLACE_ITEM',
    unavailableReason: '이 날짜에는 장소가 지정된 일정 항목이 없어 날씨를 붙이지 못했습니다.',
  }

  /** 항목 0개 — 대표 장소도 좌표도 없다 */
  const itemlessSchedule = planBriefingSchedule({
    itemCount: 0,
    visitedCount: 0,
    firstItem: null,
    lastItem: null,
    representativePlaceId: null,
    representativePlaceTitle: null,
    representativeLat: null,
    representativeLng: null,
  })

  it('판정도 지표도 없으면 카드를 통째로 접는다 — 제목만 남기지 않는다', () => {
    const markup = render({ schedule: itemlessSchedule, weather: noPlaceItemVerdict })

    expect(markup).not.toContain(`>${messages.plan.briefingWeatherTodayHeading}<`)
  })

  /** 빈 카드가 사라져도 길을 잃지 않는다 — 그날 일정 카드가 이유와 다음 걸음을 이미 말한다 */
  it('접힌 자리를 대신할 안내를 따로 세우지 않는다 — 그날 일정 카드가 이미 말한다', () => {
    const markup = render({ schedule: itemlessSchedule, weather: noPlaceItemVerdict })

    expect(markup).toContain(messages.plan.briefingScheduleEmptyTitle)
    expect(markup).not.toContain(messages.plan.briefingWeatherMissing)
  })

  /*
    **회귀 감시의 본체.** 산책 항목만 있는 날도 `NO_PLACE_ITEM` 이면서 항목은 있다 —
    거기서 접으면 판정이 왜 없는지 아무도 말하지 않게 된다 (`unavailableSentence` 주석).
  */
  it('같은 사유라도 항목이 있는 날은 접지 않는다 — 그때는 서버 문장이 유일한 설명이다', () => {
    const markup = render({
      schedule: planBriefingSchedule({ itemCount: 1, visitedCount: 0, lastItem: null }),
      weather: noPlaceItemVerdict,
    })

    expect(markup).toContain(`>${messages.plan.briefingWeatherTodayHeading}<`)
    expect(markup).toContain('장소가 지정된 일정 항목이 없어')
  })

  /** 판정을 못 낸 날에도 하루 지표가 오면 카드가 할 말이 있다 */
  it('판정이 없어도 날씨 값이 오면 접지 않는다 — 지표 줄이 설 자리다', () => {
    const markup = render({
      schedule: itemlessSchedule,
      weather: { ...noPlaceItemVerdict, weather: planVerdict.weather },
    })

    expect(markup).toContain(`>${messages.plan.briefingWeatherTodayHeading}<`)
    expect(markup).toContain('최저 21.0℃')
  })

  /** 응답에 날씨 자리 자체가 없는 것은 다른 갈래다 — 못 받았다고 말한다 (D5-2) */
  it('weather 가 null 인 갈래는 접지 않는다', () => {
    const markup = render({ schedule: itemlessSchedule, weather: null })

    expect(markup).toContain(`>${messages.plan.briefingWeatherTodayHeading}<`)
    expect(markup).toContain(messages.plan.briefingWeatherMissing)
  })
})

describe('PlanBriefingSection — 접근성 계약 (명세 D6)', () => {
  it('카드 제목 넷이 h2 로 선다', () => {
    const markup = render()

    for (const heading of [
      messages.plan.briefingScheduleHeading,
      messages.plan.briefingWeatherTodayHeading,
      messages.plan.briefingWarningHeading,
      messages.plan.briefingWalkHeading,
    ]) {
      expect(markup).toContain(`>${heading}<`)
    }
    expect(markup.split('<h2').length - 1).toBe(4)
  })

  it('카드 순서는 일정 → 날씨 → 특보 → 골든타임이다', () => {
    const markup = render()
    const order = [
      messages.plan.briefingScheduleHeading,
      messages.plan.briefingWeatherTodayHeading,
      messages.plan.briefingWarningHeading,
      messages.plan.briefingWalkHeading,
    ].map((heading) => markup.indexOf(heading))

    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})

describe('PlanBriefingHeader — h1 은 어느 갈래에도 있다 (명세 D6)', () => {
  it('부제가 없어도 h1 과 돌아가기가 선다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlanBriefingHeader, { planId: 'p-1', subtitle: null }),
    )

    expect(markup).toContain(`>${messages.plan.briefingHeading}<`)
    expect(markup).toContain(messages.plan.briefingBack)
    expect(markup).toContain('href="/plans/p-1"')
  })

  it('부제가 있으면 그대로 그린다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlanBriefingHeader, {
        planId: 'p-1',
        subtitle: '몽실이와 제주 2박 3일 · 2일차 09-13 (일)',
      }),
    )

    expect(markup).toContain('2일차 09-13 (일)')
  })
})
