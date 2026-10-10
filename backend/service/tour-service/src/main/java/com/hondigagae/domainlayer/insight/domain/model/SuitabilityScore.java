package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.shared.travel.insight.SuitabilityLevel;
import java.util.Comparator;
import java.util.List;
import lombok.Builder;

/**
 * 적합도 판정 결과.
 *
 * <p>{@code score} 가 Wrapper 인 것이 이 모델의 요점이다. 근거가 없으면 <b>점수를 만들지
 * 않는다</b> - null 이고 등급은 {@link SuitabilityLevel#INSUFFICIENT} 다. 예보가 닿지 않는
 * 날짜에 0점이나 50점을 주면 사용자는 그것을 "여기는 별로다"로 읽는다. 모르는 것과 나쁜 것은
 * 다르고, 그 구분을 값의 모양으로 강제한다.
 *
 * <p>근거가 부족해도 {@code reasons} 는 비지 않는다. 동반 가능 여부처럼 날씨와 무관하게
 * 아는 사실은 그대로 내려 주고, 왜 점수를 못 냈는지도 근거로 남긴다.
 */
@Builder
public record SuitabilityScore(
    Integer score,
    SuitabilityLevel level,
    List<SuitabilityReason> reasons,
    boolean weatherApplied,
    boolean congestionApplied
) {

    public static SuitabilityScore scored(
        int score, List<SuitabilityReason> reasons, boolean weatherApplied, boolean congestionApplied
    ) {
        return SuitabilityScore.builder()
            .score(score)
            .level(SuitabilityLevel.from(score))
            .reasons(sortByImpact(reasons))
            .weatherApplied(weatherApplied)
            .congestionApplied(congestionApplied)
            .build();
    }

    public static SuitabilityScore insufficient(List<SuitabilityReason> reasons) {
        return SuitabilityScore.builder()
            .score(null)
            .level(SuitabilityLevel.INSUFFICIENT)
            .reasons(sortByImpact(reasons))
            .weatherApplied(false)
            .congestionApplied(false)
            .build();
    }

    /** 영향이 큰 근거부터 보여 준다. 화면이 앞의 두어 개만 잘라 써도 말이 되게 하기 위해서다. */
    private static List<SuitabilityReason> sortByImpact(List<SuitabilityReason> reasons) {
        return reasons.stream()
            .sorted(Comparator.comparingInt((SuitabilityReason reason) -> Math.abs(reason.scoreDelta())).reversed())
            .toList();
    }
}
