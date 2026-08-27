package com.hondigagae.shared.travel.insight;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 판정에 쓴 예보의 출처.
 *
 * <p>같은 {@code score = 72} 라도 단기예보에서 나온 것과 중기예보에서 나온 것은 신뢰도가 다르다.
 * 사용자가 그것을 알아야 하므로 값으로 드러낸다 - {@code weatherApplied} 플래그를 둔 것과
 * 같은 이유다. 근거의 성질을 감추지 않는다.
 *
 * <p>tour-service 가 산출하고 plan-service 의 일정 브리핑이 그대로 표시하므로 shared-travel 에 둔다.
 */
@Getter
@RequiredArgsConstructor
public enum ForecastSource implements CodeNameDescribable {

    SHORT_TERM("단기예보", "오늘부터 약 5일까지의 시간 단위 예보입니다. 가장 정확합니다."),
    MID_TERM("중기예보", "약 5일 이후 예보입니다. 오전/오후 단위라 단기예보보다 대략적이고 습도와 바람 정보가 없습니다."),
    NONE("예보 없음", "예보가 닿지 않는 날짜라 날씨를 근거로 쓰지 못했습니다.");

    private final String displayName;
    private final String description;

    public boolean isAvailable() {
        return this != NONE;
    }

    /**
     * 시각 단위 판정이 가능한 출처인지.
     *
     * <p>산책 위험도는 노면온도를 {@code 기온 + 하늘상태 x 시간대} 로 추정하므로 시각별 데이터가
     * 필요하다. 중기예보는 오전/오후뿐이라 "14시 아스팔트"를 판정할 수 없다 - 억지로 값을 내면
     * 없는 근거를 지어내는 것이 된다.
     */
    public boolean supportsHourlyJudgement() {
        return this == SHORT_TERM;
    }
}
