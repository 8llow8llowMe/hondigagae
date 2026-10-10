package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.SuitabilityReasonCode;

/**
 * 판정 근거 한 줄. 코드는 열거된 것 중 하나여야 하고, 문장에는 실제 수치가 들어간다.
 *
 * <p>{@code description} 을 코드에서 만드는 것이 XAI 규약의 핵심이다. "날씨가 좋습니다"는
 * 근거가 아니고 "최고기온 24도, 강수확률 10%" 가 근거다.
 *
 * @param scoreDelta 이 근거가 점수에 미친 영향. 감점이면 음수다. 화면이 근거를 영향 순으로
 *                   정렬할 수 있게 값을 함께 내린다
 */
public record SuitabilityReason(SuitabilityReasonCode code, String description, int scoreDelta) {

    public static SuitabilityReason of(SuitabilityReasonCode code, String description, int scoreDelta) {
        return new SuitabilityReason(code, description, scoreDelta);
    }

    /** 점수에 영향을 주지 않는 정보성 근거. */
    public static SuitabilityReason informational(SuitabilityReasonCode code, String description) {
        return new SuitabilityReason(code, description, 0);
    }
}
