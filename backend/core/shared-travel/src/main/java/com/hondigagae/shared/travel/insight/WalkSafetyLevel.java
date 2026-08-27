package com.hondigagae.shared.travel.insight;

import com.hondigagae.common.dto.metadata.ScoreMetricDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 산책 위험도 등급.
 *
 * <p>여행 적합도({@link SuitabilityLevel})와 <b>일부러 분리한다.</b> 적합도는 "여기 갈 만한가"를
 * 묻고, 위험도는 "지금 걸어도 되는가"를 묻는다. 적합도가 높아도 오후 두 시 아스팔트는 위험할 수
 * 있어서, 하나로 합치면 둘 중 하나가 반드시 희석된다.
 */
@Getter
@RequiredArgsConstructor
public enum WalkSafetyLevel implements ScoreMetricDescribable {

    SAFE("안전", "산책하기에 무리가 없는 조건입니다.",
        "위험 요인이 확인되지 않았습니다.", 0),
    CAUTION("주의", "짧게 걷고 물과 그늘을 챙기는 편이 좋습니다.",
        "위험 요인이 하나 이상 확인되었습니다.", 1),
    DANGER("위험", "이 시간대 야외 산책은 피하는 편이 좋습니다.",
        "발바닥 화상이나 열 스트레스 위험이 큰 조건입니다.", 2),
    UNKNOWN("판단 근거 부족", "예보가 없어 위험도를 판단하지 않았습니다.",
        "예보 범위 밖이거나 날씨 정보를 가져오지 못했습니다.", -1);

    private final String displayName;
    private final String description;
    private final String scoreDescription;
    /** 심각도. 여러 요인 중 가장 나쁜 것을 고를 때 쓴다. */
    private final int severity;

    /** 둘 중 더 나쁜 등급. UNKNOWN 은 비교 대상이 아니라 실제 판정이 있으면 그쪽을 택한다. */
    public WalkSafetyLevel worseOf(WalkSafetyLevel other) {
        if (other == null || other == UNKNOWN) {
            return this;
        }
        if (this == UNKNOWN) {
            return other;
        }
        return this.severity >= other.severity ? this : other;
    }
}
