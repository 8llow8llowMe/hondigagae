package com.hondigagae.shared.travel.insight;

import com.hondigagae.common.dto.metadata.ScoreMetricDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 여행 적합도 등급 (coding-conventions §8-3).
 *
 * <p>tour-service 가 규칙으로 산출하고, ai-service 가 해설에 쓰고, plan-service 가 일정 브리핑에
 * 표시한다. 세 서비스가 같은 기준을 봐야 하므로 shared-travel 에 둔다.
 *
 * <p>{@link #INSUFFICIENT} 가 이 enum 의 핵심이다. 예보가 없는 날짜(단기예보 범위 밖)나 원천
 * 장애 때 <b>점수를 만들어 내지 않기 위한 자리</b>다. 근거 없는 낮은 점수를 주면 사용자는 그것을
 * "여기는 별로다"로 읽는다. 모른다는 것은 나쁘다는 뜻이 아니다.
 */
@Getter
@RequiredArgsConstructor
public enum SuitabilityLevel implements ScoreMetricDescribable {

    HIGH("여행 적합", "반려견과 방문하기 좋은 조건입니다.",
        "점수가 높을수록 날씨/동반 조건이 반려견에게 유리합니다.", 80),
    MEDIUM("보통", "일부 조건을 확인하고 가면 무난합니다.",
        "점수가 중간이면 주의할 조건이 한둘 있다는 뜻입니다.", 60),
    LOW("주의 필요", "반려견과 방문하기에 불리한 조건이 있습니다.",
        "점수가 낮을수록 피하거나 시간대를 옮기는 편이 좋습니다.", 0),
    INSUFFICIENT("판단 근거 부족", "점수를 낼 만한 데이터가 없습니다.",
        "예보 범위 밖이거나 날씨 정보를 가져오지 못해 점수를 내지 않았습니다.", -1);

    private final String displayName;
    private final String description;
    private final String scoreDescription;
    /** 이 등급의 하한 점수. INSUFFICIENT 는 점수 체계 밖이라 -1 이다. */
    private final int minScore;

    /**
     * 점수를 등급으로 바꾼다. {@code null} 은 점수를 내지 못한 상태이므로 INSUFFICIENT 다.
     */
    public static SuitabilityLevel from(Integer score) {
        if (score == null) {
            return INSUFFICIENT;
        }
        if (score >= HIGH.minScore) {
            return HIGH;
        }
        if (score >= MEDIUM.minScore) {
            return MEDIUM;
        }
        return LOW;
    }
}
