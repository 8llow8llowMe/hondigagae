import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { WalkVerdict } from '@/features/home/walk-verdict'
import { messages } from '@/lib/messages'
import { walkSafety } from '@/test/fixtures/insight'
import type { WalkSafetyResponse, WeatherWarningItem } from '@/types/insight'

const HEAT_WAVE_WARNING: WeatherWarningItem = {
  type: { code: 'HEAT_WAVE', name: '폭염', description: '더위가 심합니다.' },
  level: { code: 'WARNING', name: '경보', description: '기상청이 위험을 경고한 단계입니다.' },
  effectiveAt: '2026-08-29T11:00:00',
}

const TODAY_LABEL = '2026-08-29 (금) · 제주시'

function render(data: WalkSafetyResponse, basisIsDefault = false) {
  return renderToStaticMarkup(
    createElement(WalkVerdict, {
      data,
      petName: '몽실이',
      todayLabel: TODAY_LABEL,
      basisIsDefault,
    }),
  )
}

/*
  **대표 지점 캡션** (#636 · 홈-첫방문-판정-세부명세 D4). 기준 줄은 `{장소} 기준` 이라고만
  말하는데, 그 장소를 사용자가 고른 적이 없으면 화면이 고른 척을 하게 된다.
*/
describe('대표 지점 캡션', () => {
  it('대표 지점이면 기준 줄 아래에 한 줄이 붙는다', () => {
    expect(render(walkSafety, true)).toContain(messages.home.basisDefaultNote)
  })

  it('사용자가 고른 장소면 붙지 않는다', () => {
    expect(render(walkSafety, false)).not.toContain(messages.home.basisDefaultNote)
  })

  /*
    **모바일 접힌 줄에도 선다.** 데스크톱 패널에만 두면 390 기본 상태(접힘)에서 캡션이
    사라져, 정작 첫 방문자가 제일 많이 보는 화면에서만 설명이 없다 — 날짜 줄이 #530 에서
    같은 이유로 양쪽에 섰다.
  */
  it('모바일 접힌 줄과 데스크톱 패널 양쪽에 한 번씩 선다', () => {
    const markup = render(walkSafety, true)

    // 문구에 `.` 이 있어 정규식으로 세지 않는다 — 리터럴로 쪼갠다
    expect(markup.split(messages.home.basisDefaultNote)).toHaveLength(3)
  })

  it('모바일 캡션이 펼침 패널 밖(버튼 안)에 있다', () => {
    const markup = render(walkSafety, true)

    expect(markup.indexOf(messages.home.basisDefaultNote)).toBeLessThan(markup.indexOf('</button>'))
  })
})

describe('날짜 줄 — 이 카드가 겸한다 (#428 · #530)', () => {
  it('체감온도 라벨과 같은 줄에 날짜가 선다', () => {
    const markup = render(walkSafety)

    expect(markup).toContain(TODAY_LABEL)
    /*
      **`items-baseline` 이어야 한다.** 양쪽이 caption + 값 두 줄이 되면서 값 줄 높이가
      갈리는데(16 vs 28), `items-end` 로 두면 위 caption 두 개가 어긋난다.
    */
    expect(markup).toContain('items-baseline')
  })

  /*
    **모바일도 같은 자리다** (#530). #428 은 여기를 데스크톱 전용으로 두고 모바일은
    `home-view` 가 카드 밖에 그리게 했는데, 3a 바닥 위의 그 자리는 어느 카드에도 붙지
    않는다. 접힌 줄 위에도 caption 자리가 있었다.
  */
  it('모바일 접힌 줄에도 날짜가 선다', () => {
    const markup = render(walkSafety)

    // 모바일 버튼(`md:hidden`)과 데스크톱 패널(`md:flex`) 양쪽에 한 번씩
    expect(markup.match(new RegExp(TODAY_LABEL.replace(/[().·]/g, '\\$&'), 'g'))).toHaveLength(2)
  })

  /*
    **접힘과 무관하게 보인다.** 날짜를 펼침 패널 안에만 두면 기본 상태(접힘)에서 날짜가
    사라진다 — 그 버튼은 `open` 과 상관없이 늘 렌더된다.
  */
  it('모바일 날짜가 펼침 패널 밖에 있다', () => {
    const markup = render(walkSafety)
    const button = markup.indexOf('<button')
    const buttonEnd = markup.indexOf('</button>')

    expect(markup.indexOf(TODAY_LABEL)).toBeGreaterThan(button)
    expect(markup.indexOf(TODAY_LABEL)).toBeLessThan(buttonEnd)
  })
})

/*
  #349. 예전에는 이 섹션이 접힌 모바일 줄과 데스크톱 등급 줄 **양쪽에** 배지를 그렸다.
  세 섹션이 각자 그리던 배지를 페이지 최상단 `WeatherWarningStrip` 하나로 모으면서 여기서
  걷었다 — 백엔드가 제주 전역 단일 지점에서 특보 하나를 골라 네 응답에 함께 싣기 때문에
  세 배지의 값은 갈릴 수 없었다.
*/
describe('WalkVerdict — 기상특보 (#349)', () => {
  it('특보가 있어도 배지를 그리지 않는다', () => {
    expect(render({ ...walkSafety, weatherWarning: HEAT_WAVE_WARNING })).not.toContain('폭염')
  })

  /*
    **배지가 사라져도 정보는 남는다.** 서버가 보내는 `WEATHER_WARNING_ACTIVE` 문장이
    무엇을 조심해야 하는지 말한다 — 배지는 그 사실을 문단 밖으로 올리는 강조였을 뿐이고,
    강조는 이제 최상단 스트립이 맡는다.
  */
  it('근거 목록의 특보 문장은 그대로 남는다', () => {
    const markup = render({
      ...walkSafety,
      weatherWarning: HEAT_WAVE_WARNING,
      reasons: [
        {
          code: 'WEATHER_WARNING_ACTIVE',
          name: '기상특보 발효',
          description: '폭염 경보 발효 중입니다. 더위가 심합니다.',
        },
      ],
    })

    expect(markup).toContain('폭염 경보 발효 중입니다.')
  })
})

/*
  #349. 판정은 "지금 나가도 되나" 만 답한다. "오늘 언제 나가나" 는 바로 아래
  `WalkTimesSection` 이 답하는데, 두 섹션이 각자 답하는 동안 **서로를 부정했다** — 폭염
  경보 날 이 초록 박스가 `18:00 – 21:00` 을 제시하고 골든타임이 `경보가 발효 중이라
  추천하지 않아요` 라고 말했다. `WalkSafetyEvaluator` 가 `level == SAFE` 일 때만
  `saferWindow` 를 비우고 경보를 보지 않기 때문이다.
*/
describe('WalkVerdict — saferWindow 는 홈에서 말하지 않는다 (#349)', () => {
  it('안전 시간대가 와도 시각을 그리지 않는다', () => {
    const markup = render({
      ...walkSafety,
      saferWindowStart: '18:00:00',
      saferWindowEnd: '21:00:00',
    })

    expect(markup).not.toContain('18:00')
    expect(markup).not.toContain('21:00')
  })

  /*
    **조건문으로 끄지 않았다.** 경보 여부를 화면이 다시 판정하면 서버의 판정 순서를 복제하는
    것이 된다 (`WalkTimesSection` 머리주석). 경보가 아닌 날에도 이 줄은 없다.
  */
  it('특보가 없는 날에도 마찬가지다', () => {
    const markup = render({
      ...walkSafety,
      weatherWarning: null,
      saferWindowStart: '06:00:00',
      saferWindowEnd: '08:00:00',
    })

    expect(markup).not.toContain('06:00')
  })
})

/*
  #259. 모바일 접힌 줄은 `feelsLikeLabel` 을 달고 있었는데 **데스크톱 hero 만 맨 숫자**였다 —
  같은 화면의 같은 값이 폭에 따라 이름을 잃었다. 아래 기준 줄(`{장소} 기준`)은 어디의
  값인지만 말하고 무엇인지는 말하지 않는다.

  `renderToStaticMarkup` 은 두 분기를 **함께** 그린다(`md:` 는 CSS 다). 그래서 두 자리를
  각각 확인한다.

  **낱말을 세지 않는다** (#292). 예전에는 `체감온도` 등장 횟수가 2 인지 봤는데, 서버 근거
  문장이 `FEELS_LIKE_HIGH`("기상청 여름철 체감온도 기준으로…")로 바뀌면서 같은 낱말이
  근거 목록에도 들어왔다 — 셈이 3 이 되어 화면은 맞는데 테스트가 깨졌다. **라벨은 자기
  텍스트 노드로 서는지**를 본다.
*/
describe('WalkVerdict — 체감온도 라벨 (#259)', () => {
  it('모바일 접힌 줄과 데스크톱 hero 양쪽에 라벨이 붙는다', () => {
    const markup = render(walkSafety)

    /*
      데스크톱 hero — `MetricValue` 의 라벨은 자기 span 이다. **낱말 뒤가 `</span>` 이 아니다**
      (#313): 라벨 옆에 `InfoTip` 물음표가 서면서 낱말과 버튼을 한 줄로 묶는 span 이 하나
      더 생겼다. 확인할 것은 낱말이 자기 요소의 **텍스트 시작**에 선다는 것이다.
    */
    expect(markup).toContain(`>${messages.home.feelsLikeLabel}`)
    // 모바일 접힌 줄 — 라벨과 값이 한 문장으로 붙는다
    expect(markup).toContain(`>${messages.home.feelsLikeLabel} 33.0℃`)
  })

  /*
    #313 — 체감온도 근거를 여는 물음표. **`feelsLikeBasis` 가 있을 때만 선다** —
    눌러도 빈 말풍선이 뜨는 물음표를 두지 않는다.
  */
  it('체감온도 근거가 있으면 물음표를 세운다', () => {
    expect(render(walkSafety)).toContain(`aria-label="${messages.home.feelsLikeBasisLabel}"`)
  })

  it('체감온도 근거가 없으면 물음표를 그리지 않는다', () => {
    const markup = render({ ...walkSafety, feelsLikeBasis: null })

    expect(markup).not.toContain(`aria-label="${messages.home.feelsLikeBasisLabel}"`)
    // 값은 그대로 남는다 — 사라지는 것은 근거를 여는 버튼뿐이다
    expect(markup).toContain('33.0')
  })

  /*
    **장소 상세 산책 위험도와 같은 이름이다** — 같은 `feelsLikeCelsius` 다. 하루 최대
    (`최고 체감온도`)와는 `최고` 가 가른다.
  */
  it('장소 상세 산책 위험도와 같은 이름을 쓴다', () => {
    expect(messages.home.feelsLikeLabel).toBe(messages.place.detailFeelsLike)
  })

  /*
    **낱말이 아니라 자리를 확인한다** (#292). 서버 근거 문장에도 `체감온도` 가 들어 있어
    `not.toContain('체감온도')` 는 이제 근거 목록 때문에 실패한다 — 화면은 맞는데도.
  */
  it('체감온도가 없으면 라벨도 렌더하지 않는다', () => {
    const markup = render({ ...walkSafety, feelsLikeCelsius: null })

    // hero 라벨 자리가 사라진다
    expect(markup).not.toContain(`>${messages.home.feelsLikeLabel}</span>`)
    expect(markup).not.toContain('33.0')
    // 접힌 요약줄은 온도를 빼고 기준 장소만 남긴다 — `·` 만 남아 떠 있지 않다
    expect(markup).toContain(`>${walkSafety.placeTitle} ${messages.home.basisSuffix}<`)
  })
})

/*
  #292. BE `46f35e4` 가 판정 기준을 NOAA 열지수 → 기상청 체감온도로 바꿨는데 이 화면은
  한동안 `heatIndexCelsius` 를 계속 읽었다. **그동안 라벨은 줄곧 `체감온도` 였다** — 그래서
  라벨만 보는 테스트로는 이 버그를 잡을 수 없었다. 값을 봐야 한다.

  fixture 가 두 필드를 **다른 숫자**(33.0 vs 40.2)로 두는 이유가 이것이다.
*/
describe('WalkVerdict — 판정값은 체감온도다 (#292)', () => {
  it('`feelsLikeCelsius` 를 그리고 참고 열지수는 그리지 않는다', () => {
    const markup = render(walkSafety)

    expect(markup).toContain('33.0')
    expect(markup).not.toContain('40.2')
  })

  /*
    **열지수만 없어도 화면은 그대로다.** 홈은 참고값을 아예 읽지 않으므로 그 필드가
    비어도 판정 숫자가 사라질 이유가 없다 — 반대로 사라지면 옛 필드를 읽고 있는 것이다.
  */
  it('열지수가 없어도 체감온도는 그대로 그린다', () => {
    const markup = render({ ...walkSafety, heatIndexCelsius: null, heatIndexBasis: null })

    expect(markup).toContain('33.0')
    expect(markup).toContain(messages.home.feelsLikeLabel)
  })
})

describe('WalkVerdict — 등급이 권하는 행동', () => {
  /*
    `walkSafetyLevel.description` 은 완성형 행동 지침이다 ("짧게 걷고 물과 그늘을 챙기는
    편이 좋습니다"). 예전에는 등급어 두 글자만 쓰고 이 문장을 버렸다 — 판정만 하고 판단을
    돕지 않던 자리다.
  */
  it('등급 설명 문장을 렌더한다', () => {
    const markup = render({
      ...walkSafety,
      walkSafetyLevel: {
        ...walkSafety.walkSafetyLevel,
        description: '짧게 걷고 물과 그늘을 챙기는 편이 좋습니다.',
      },
    })

    expect(markup).toContain('짧게 걷고 물과 그늘을 챙기는 편이 좋습니다.')
  })

  /* 서버가 안 주면 빈 문단을 만들지 않는다 */
  it('설명이 없으면 줄을 만들지 않는다', () => {
    const markup = render({
      ...walkSafety,
      walkSafetyLevel: { ...walkSafety.walkSafetyLevel, description: null },
    })

    expect(markup).not.toContain('<p class="text-body-2 text-fg"></p>')
  })

  /* `reasons` 가 같은 요인을 낱낱이 세므로 같은 말을 두 번 하지 않는다 */
  it('scoreDescription 은 쓰지 않는다', () => {
    const markup = render({
      ...walkSafety,
      walkSafetyLevel: {
        ...walkSafety.walkSafetyLevel,
        scoreDescription: '위험 요인이 하나 이상 확인되었습니다.',
      },
    })

    expect(markup).not.toContain('위험 요인이 하나 이상 확인되었습니다.')
  })
})

/*
  #840. 이 섹션은 `ReasonList` 를 쓰지 않고 **같은 일을 직접 구현**했다 — 앞 2개만 세우고
  나머지는 `근거 N개 더 보기` 버튼 뒤에 숨겼다(접기는 없어 한 번 펼치면 끝이었다).

  근거는 등급이 권하는 행동을 뒷받침하는 문장이라 세 번째부터 덜 중요하지 않다. 한 번 열면
  닫히지 않는 버튼은 그 순간 이후로 아무 일도 하지 않으면서, 첫 화면에서만 문장을 가렸다.
*/
describe('WalkVerdict — 근거는 접지 않는다 (#840)', () => {
  it('근거가 셋 이상이어도 전부 서고 여는 버튼이 없다', () => {
    const firstDescription = '근거 하나'
    const reasons = [
      { code: 'R1', name: '하나', description: firstDescription },
      { code: 'R2', name: '둘', description: '근거 둘' },
      { code: 'R3', name: '셋', description: '근거 셋' },
      { code: 'R4', name: '넷', description: '근거 넷' },
    ]
    const markup = render({ ...walkSafety, reasons })

    for (const reason of reasons) {
      expect(markup).toContain(reason.description)
    }

    /*
      **`markup` 전체에 `aria-expanded` 가 없다고 세지 않는다.** 이 화면에는 이 작업이
      건드리지 않는 펼침이 둘 더 있다 — 모바일 접힘 토글과 체감온도 `InfoTip` 물음표.
      근거 목록은 패널의 마지막 블록이라, 첫 근거부터 끝까지를 잘라 그 안만 본다.
    */
    const reasonsBlock = markup.slice(markup.indexOf(firstDescription))

    expect(reasonsBlock).not.toContain('<button')
    // 버튼이 사라지면 그것이 들고 있던 ARIA 도 함께 사라진다 — 컨테이너에 남기지 않는다
    expect(reasonsBlock).not.toContain('aria-expanded')
  })
})
