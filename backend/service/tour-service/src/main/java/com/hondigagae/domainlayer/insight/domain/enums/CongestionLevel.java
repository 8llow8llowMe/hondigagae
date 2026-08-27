package com.hondigagae.domainlayer.insight.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 관광지 집중률 등급 (TatsCnctrRateService 의 cnctrRate 를 구간으로 나눈 값).
 *
 * <p>원천은 0~100 실수인데 그 숫자를 그대로 보여 주면 "37.2 가 붐비는 것인가"를 사용자가
 * 판단해야 한다. 구간을 여기서 확정한다.
 *
 * <p>{@link #UNKNOWN} 이 필요한 이유는 혼잡도 데이터가 <b>명칭 기반 매칭</b>이라 장소에 붙지
 * 않는 경우가 실제로 많기 때문이다 (place_name_link 의 UNMATCHED). 매칭 실패를
 * "한산함"으로 바꿔치기하면 없는 근거를 지어내는 것이 된다.
 */
@Getter
@RequiredArgsConstructor
public enum CongestionLevel implements CodeNameDescribable {

    LOW("한산", "관광객 집중도가 낮은 편입니다."),
    MODERATE("보통", "관광객 집중도가 평균 수준입니다."),
    HIGH("혼잡", "관광객 집중도가 높아 붐빌 것으로 예상됩니다."),
    UNKNOWN("정보 없음", "이 장소에 연결된 혼잡도 예측 데이터가 없습니다.");

    private static final double MODERATE_THRESHOLD = 30.0d;
    private static final double HIGH_THRESHOLD = 60.0d;

    private final String displayName;
    private final String description;

    public static CongestionLevel from(Double concentrationRate) {
        if (concentrationRate == null) {
            return UNKNOWN;
        }
        if (concentrationRate >= HIGH_THRESHOLD) {
            return HIGH;
        }
        if (concentrationRate >= MODERATE_THRESHOLD) {
            return MODERATE;
        }
        return LOW;
    }

    public boolean isKnown() {
        return this != UNKNOWN;
    }
}
