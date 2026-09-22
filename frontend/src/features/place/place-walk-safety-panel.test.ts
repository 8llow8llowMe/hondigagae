import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PlaceWalkSafetyPanel,
  type PlaceWalkSafetyPanelProps,
} from '@/features/place/place-walk-safety-panel'
import { messages } from '@/lib/messages'
import { walkSafety } from '@/test/fixtures/insight'

function render(overrides: Partial<PlaceWalkSafetyPanelProps> = {}) {
  const props: PlaceWalkSafetyPanelProps = {
    data: walkSafety,
    loading: false,
    failed: false,
    onRetry: () => undefined,
    petName: '몽실이',
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PlaceWalkSafetyPanel, props))
}

describe('PlaceWalkSafetyPanel — 상태 배타성', () => {
  it('조회 중에는 스켈레톤만 그린다', () => {
    const markup = render({ data: null, loading: true })

    expect(markup).not.toContain(messages.place.detailWalkSafetyLabel)
    expect(markup).not.toContain(messages.place.detailWalkSafetyErrorTitle)
  })

  /*
    적합도·기본 정보와 **따로 실패한다.** 화면 전체를 에러로 덮으면 노면 온도만 죽었는데
    주소·전화까지 사라진다.
  */
  it('판정만 실패하면 그 자리에서 재시도를 준다', () => {
    const markup = render({ data: null, failed: true })

    expect(markup).toContain(messages.place.detailWalkSafetyErrorTitle)
    expect(markup).toContain(messages.common.retry)
  })
})

describe('PlaceWalkSafetyPanel — 등급과 수치', () => {
  /*
    등급어는 서버 `walkSafetyLevel.name` 이다. FE 가 등급 문구를 다시 쓰지 않는다
    (api-integration-guide.md §6).
  */
  it('서버 등급명을 그대로 쓴다', () => {
    const markup = render()

    expect(markup).toContain(walkSafety.walkSafetyLevel.name)
    expect(markup).toContain(messages.place.detailWalkSafetyLabel)
  })

  /*
    ℃ 를 빼면 58 이 무슨 단위인지 알 수 없다. 노면 온도는 **추정치**라 라벨이 그렇게 말한다 —
    실측으로 읽으면 사용자가 "58도면 못 나간다" 를 확정된 사실로 받는다.
  */
  it('노면 온도와 체감온도에 ℃ 를 붙이고, 노면은 추정임을 밝힌다', () => {
    const markup = render()

    expect(markup).toContain('58.0')
    expect(markup).toContain('33.0')
    expect(markup).toContain(messages.place.detailTemperatureUnit)
    expect(markup).toContain(messages.place.detailPavement)
    expect(markup).toContain('추정')
  })

  /*
    #269. "노면" 만으로는 흙길·잔디를 떠올리는데 추정식은 아스팔트 기준이다. 홈 곡선과
    **같은 값**이므로 두 화면이 같은 낱말로 부른다 — 갈리면 사용자는 다른 값으로 읽는다.
  */
  it('노면이 아스팔트임을 밝히고 홈과 같은 낱말을 쓴다', () => {
    expect(render()).toContain('아스팔트')
    expect(messages.place.detailPavement).toBe(messages.home.pavementLabel)
  })

  /*
    #259. 예전에는 hero 에 라벨이 없었다 — 적합도의 점수 hero(`82 /100`)를 따라 뺐던 것인데,
    점수는 단위가 스스로 말하고 온도는 그렇지 않다. 게스트 경로에서는 바로 위 적합도가
    **하루 최대** 체감온도를 같은 ℃ 로 내므로, 라벨이 없으면 기준이 다른 두 숫자가 이름
    없이 붙어 선다.
  */
  it('체감온도 hero 에 라벨을 붙인다', () => {
    expect(render()).toContain(messages.place.detailFeelsLike)
  })

  /*
    **하루 최대 라벨을 쓰지 않는다** (#259). 이 값은 `targetDateTime` 그 시각의 체감온도라
    `최고` 를 붙이면 하루 최고를 말하게 된다.

    `not.toContain` 이 성립하는 방향을 골랐다 — `detailFeelsLike`(`체감온도`)는
    `detailFeelsLikeTemperature`(`최고 체감온도`)의 **부분 문자열**이라 반대 방향으로
    쓰면 라벨이 뒤바뀌어도 통과한다.
  */
  it('하루 최대 라벨을 쓰지 않는다 — 시각 기준 값이다', () => {
    expect(messages.place.detailFeelsLikeTemperature).not.toBe(messages.place.detailFeelsLike)
    expect(render()).not.toContain(messages.place.detailFeelsLikeTemperature)
  })

  /*
    `null` 이면 hero 자체가 없으므로 **라벨도 함께 사라져야 한다** — 라벨만 남으면 값이
    빠진 것이 아니라 0 인 것처럼 읽힌다.
  */
  /*
    **`feelsLikeBasis` 도 같이 비운다.** BE 는 두 값을 같은 `temperature` 에서 내므로 값이
    없으면 근거 문장도 없다 (`WalkSafetyPresenter`). 근거만 남겨 두면 근거 라벨
    (`체감온도 계산 근거`)이 `체감온도` 를 품고 있어 이 단정이 값 때문인지 라벨 때문인지
    가릴 수 없다.
  */
  it('체감온도가 없으면 라벨도 렌더하지 않는다', () => {
    const markup = render({
      data: { ...walkSafety, feelsLikeCelsius: null, feelsLikeBasis: null },
    })

    /*
      **낱말이 아니라 라벨 자리를 본다** (#292). 서버 근거 문장이 `FEELS_LIKE_HIGH`
      ("기상청 여름철 체감온도 기준으로…")로 바뀌어 `체감온도` 가 근거 목록에도 있다 —
      낱말로 단정하면 화면이 맞아도 실패한다. `MetricValue` 라벨은 자기 span 이다.
    */
    expect(markup).not.toContain(`>${messages.place.detailFeelsLike}</span>`)
    expect(markup).not.toContain('33.0')
  })

  /*
    **소수점 1자리를 유지한다.** `35` 와 `35.0` 이 섞이면 자릿수가 흔들려 값을 비교할 수
    없다 (`formatCelsius`).
  */
  it('정수 값도 소수점 1자리로 그린다', () => {
    const markup = render({
      data: { ...walkSafety, feelsLikeCelsius: 31, estimatedPavementCelsius: 50 },
    })

    expect(markup).toContain('31.0')
    expect(markup).toContain('50.0')
  })

  /*
    `null` 은 0 이 아니다. `0.0℃` 로 채우면 영하 판정으로 읽힌다 — 이 저장소가
    `score: null` 을 0 으로 접지 않는 것과 같은 이유다.
  */
  it('수치가 null 이면 자리를 0 으로 채우지 않는다', () => {
    const markup = render({
      data: {
        ...walkSafety,
        feelsLikeCelsius: null,
        feelsLikeBasis: null,
        heatIndexCelsius: null,
        heatIndexBasis: null,
        estimatedPavementCelsius: null,
      },
    })

    expect(markup).not.toContain('0.0')
    expect(markup).not.toContain(messages.place.detailPavement)
    // 등급은 그대로 남는다 — 수치가 없어도 판정은 있다
    expect(markup).toContain(walkSafety.walkSafetyLevel.name)
  })

  /*
    `WalkSafetyResponse` 에는 `score` 가 아예 없다. 적합도 패널에서 복사해 오면 없는
    필드를 읽고 `/100` 이 값 없이 떠 있게 된다.
  */
  it('적합도의 점수 단위를 쓰지 않는다', () => {
    expect(render()).not.toContain(messages.place.detailScoreUnit)
  })
})

/*
  #292. BE `46f35e4` 가 판정 기준을 NOAA 열지수 → 기상청 체감온도로 바꿨는데 이 패널은
  한동안 `heatIndexCelsius` 를 계속 읽었다. **라벨은 줄곧 `체감온도` 였다** — 라벨만 보는
  테스트로는 잡히지 않는 종류의 버그다. fixture 가 두 필드를 다른 숫자(33.0 vs 40.2)로
  두는 이유가 이것이다.
*/
describe('PlaceWalkSafetyPanel — 판정값과 참고값의 위계 (#292)', () => {
  it('hero 는 `feelsLikeCelsius` 다', () => {
    const markup = render()

    expect(markup).toContain('33.0')
    // hero 라벨 바로 뒤에 판정값이 온다 — 참고값이 그 자리를 차지하지 않는다
    expect(markup.indexOf('33.0')).toBeLessThan(markup.indexOf('40.2'))
  })

  /*
    **참고 열지수는 계산 근거 문단 안에만 있다.** 평면에 세 번째 온도로 세우면 판정값과
    참고값이 같은 위계로 읽히고, 그것이 이 변경이 고치려는 오독 그 자체다.
  */
  it('참고 열지수는 판정 라벨이 아니라 `참고` 라벨을 단다', () => {
    const markup = render()

    expect(markup).toContain(messages.place.detailHeatIndexReference)
    expect(markup).toContain('40.2')
  })

  /*
    서버 문장을 그대로 렌더한다 (styling-guide.md §7). **열지수 쪽 문장이 "판정에는 쓰지
    않으며" 를 말한다** — 숫자만 떼어 읽히지 않게 하는 것이 이 문장의 역할이다.
  */
  it('두 근거 문장을 서버 문구 그대로 담는다', () => {
    const markup = render()

    expect(markup).toContain('기상청 여름철 체감온도 산식으로 계산했습니다')
    expect(markup).toContain('판정에는 쓰지 않으며')
  })

  /*
    **`feelsLikeBasis` 가 없으면 문단 자체가 없다.** 라벨이 체감온도 근거라고 말하므로
    체감온도 근거 없이 열지수만 담으면 라벨이 거짓이 된다.
  */
  it('체감온도 근거가 없으면 참고 열지수도 담지 않는다', () => {
    const markup = render({ data: { ...walkSafety, feelsLikeBasis: null } })

    expect(markup).not.toContain(messages.place.detailHeatIndexReference)
  })

  /*
    반대 방향. 열지수만 비어도 체감온도 근거는 남아야 한다 — 참고값이 없다는 것이 판정
    근거를 감출 이유가 되지 않는다.
  */
  it('열지수가 없어도 체감온도 근거는 남는다', () => {
    const markup = render({
      data: { ...walkSafety, heatIndexCelsius: null, heatIndexBasis: null },
    })

    expect(markup).toContain(messages.place.detailFeelsLikeBasisLabel)
    expect(markup).toContain('기상청 여름철 체감온도 산식으로 계산했습니다')
    expect(markup).not.toContain(messages.place.detailHeatIndexReference)
  })
})

/* 계산 근거를 접지 않는다 (#840) — 서랍이 사라지고 라벨 + 문장이 늘 선다 */
describe('PlaceWalkSafetyPanel — 체감온도 계산 근거', () => {
  /*
    **근거 문장 자체는 여기서 단언하지 않는다.** `두 근거 문장을 서버 문구 그대로 담는다`
    가 같은 입력(`render()` 기본값)으로 이미 그것을 증명한다 — 여기 한 줄 더 두면 둘 중
    하나가 죽어도 아무도 모른다. 이 테스트의 고유한 증명은 **라벨이 서고 여는 버튼이
    없다**는 것이다.
  */
  it('근거 문장이 접힘 없이 선다', () => {
    const markup = render()

    expect(markup).toContain(messages.place.detailFeelsLikeBasisLabel)
    expect(markup).not.toContain('aria-expanded')
  })

  /*
    `render` 헬퍼는 **props** 오버라이드를 받는다. `feelsLikeBasis` 는 `data` 안의 필드라
    이 파일의 다른 테스트와 같은 모양(`data: { ...walkSafety, … }`)으로 준다 — 헬퍼에
    응답 필드용 두 번째 인자를 더하면 오버라이드가 두 층으로 갈린다.
  */
  it('feelsLikeBasis 가 없으면 라벨도 서지 않는다', () => {
    const markup = render({ data: { ...walkSafety, feelsLikeBasis: null } })

    expect(markup).not.toContain(messages.place.detailFeelsLikeBasisLabel)
  })
})

describe('PlaceWalkSafetyPanel — 근거', () => {
  /*
    서버가 완성 문장을 순서대로 준다. 재정렬하지 않는다 — 영향이 큰 순서가 곧 중요도다.
  */
  it('근거 문장을 서버 순서로 그린다', () => {
    const markup = render()
    const [first, second] = walkSafety.reasons
    expect(first).toBeDefined()
    expect(second).toBeDefined()

    expect(markup).toContain(first!.description)
    expect(markup.indexOf(first!.description)).toBeLessThan(markup.indexOf(second!.description))
  })

  /*
    **`WalkSafetyReasonItem` 에는 `scoreDelta` 가 없다** (적합도와 다르다). 적합도 패널의
    `informational: reason.scoreDelta === 0` 을 복사해 오면 없는 필드가 `undefined === 0`
    으로 항상 false 가 되거나, 반대로 전부 흐려진다.
  */
  it('근거를 정보성으로 흐리지 않는다 — scoreDelta 가 없는 축이다', () => {
    const markup = render()

    for (const reason of walkSafety.reasons.slice(0, 3)) {
      expect(markup).toContain(reason.description)
    }

    /*
      적합도 패널은 정보성 근거를 한 단계 흐리게(`text-fg-muted`) 내린다. 이쪽은 그 근거가
      없으니 **근거 문장에 흐림 클래스가 붙지 않아야 한다** — 붙어 있으면 `scoreDelta` 를
      읽었다는 뜻이다.
    */
    expect(markup).not.toContain('text-body-2 text-fg-muted">기온 31도')
  })
})

describe('PlaceWalkSafetyPanel — 기준 줄', () => {
  /*
    적합도는 **일자**(`targetDate`), 이쪽은 **시각**(`targetDateTime`)이다. 같은 레일에
    두 판정이 나란히 서므로 기준 줄이 다르지 않으면 사용자가 한 판정의 두 표현으로 읽고,
    "오늘은 적합 / 지금은 위험" 을 모순으로 본다.
  */
  it('시각 기준임을 밝힌다 — 적합도의 일자 기준과 다른 문구다', () => {
    const markup = render()

    expect(markup).toContain('14:00')
    expect(markup).not.toContain(messages.place.detailSuitabilityBasis.replace('{date}', ''))
  })

  /*
    **서버 문자열을 그대로 자른다.** `Date` 로 파싱하면 브라우저 타임존이 KST 가 아닌
    사용자에게 다른 시각이 나온다 — 판정 화면에서 시각이 어긋나면 답을 못 믿는다.
  */
  it('타임존 변환 없이 서버가 준 시각을 쓴다', () => {
    const markup = render({ data: { ...walkSafety, targetDateTime: '2026-08-27T05:00:00' } })

    expect(markup).toContain('05:00')
  })

  it('반려견을 고르면 누구 기준인지 함께 말한다', () => {
    expect(render()).toContain('몽실이')
  })

  /*
    **`petConditionApplied` 가 false 면 반려견을 말하지 않는다.** 고른 아이가 있어도
    서버가 특성을 반영하지 못했으면 "몽실이 기준" 은 거짓이다 — 일자 판정이 `basisPetId`
    로 같은 문제를 푸는 것과 같은 방향이다.
  */
  it('특성이 반영되지 않았으면 반려견 이름을 붙이지 않는다', () => {
    const markup = render({ data: { ...walkSafety, petConditionApplied: false } })

    expect(markup).not.toContain('몽실이')
    expect(markup).toContain('14:00')
  })

  /*
    게스트에게도 그린다 — 적합도가 `GuestBlock` 으로 갈리는 것과 다르다. 노면 온도와
    열지수는 장소와 시각의 속성이라 반려견이 없어도 값 자체가 참이다.
  */
  it('반려견이 없어도 등급과 수치를 그린다', () => {
    const markup = render({ petName: null })

    expect(markup).toContain(walkSafety.walkSafetyLevel.name)
    expect(markup).toContain('58.0')
    expect(markup).not.toContain('몽실이')
  })
})

describe('PlaceWalkSafetyPanel — 더 안전한 시간대', () => {
  it('구간이 있으면 시·분만 남긴다', () => {
    const markup = render()

    expect(markup).toContain('18:00')
    expect(markup).toContain('21:00')
    // LocalTime 의 초는 버린다 — 산책 시간대에 초는 뜻이 없다
    expect(markup).not.toContain('18:00:00')
  })

  /*
    **없는 시간대를 지어내지 않는다.** 남은 시간이 전부 위험이면 서버가 일부러 구간을
    주지 않는다 — "그나마 이때가 낫다" 고 말하면 사용자가 그것을 허락으로 읽는다.
  */
  it('구간이 없으면 줄 자체를 렌더하지 않는다', () => {
    const markup = render({
      data: { ...walkSafety, saferWindowStart: null, saferWindowEnd: null },
    })

    expect(markup).not.toContain('더 안전한 시간대')
  })

  /** 반쪽 구간은 시간대가 아니다 */
  it('한쪽만 와도 렌더하지 않는다', () => {
    const markup = render({ data: { ...walkSafety, saferWindowEnd: null } })

    expect(markup).not.toContain('더 안전한 시간대')
  })
})

describe('PlaceWalkSafetyPanel — 기상특보', () => {
  /*
    경보면 서버가 등급을 이미 내려놓았고, 배지는 그렇게 된 이유를 말한다 — 등급을
    대신하지 않는다 (적합도 패널과 같은 자리·같은 규칙).
  */
  it('특보가 있으면 등급 줄에 배지를 세운다', () => {
    const markup = render({
      data: {
        ...walkSafety,
        weatherWarning: {
          type: { code: 'HEAT_WAVE', name: '폭염', description: null },
          level: { code: 'WARNING', name: '경보', description: null },
          effectiveAt: '2026-08-27T11:00:00',
        },
      },
    })

    expect(markup).toContain('폭염 경보')
    expect(markup).toContain(walkSafety.walkSafetyLevel.name)
  })

  /*
    **`폭염` 이 아니라 `폭염 경보` 로 본다** (#292). 서버 `feelsLikeBasis` 가 척도를 설명하며
    "폭염특보 기준(주의보 33℃·경보 35℃)과 같은 척도입니다" 라고 말한다 — 발효 중인 특보가
    아니라 **임계의 출처**다. 낱말로 단정하면 그 문장 때문에 실패한다. 배지가 실제로 그리는
    문자열(`{type.name} {level.name}`)을 그대로 확인한다.
  */
  it('특보가 없으면 배지 자리를 비운다', () => {
    expect(render()).not.toContain('폭염 경보')
  })
})
