package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.WalkSafetyReasonCode;

/** 산책 위험도 판정 근거 한 줄. 문장에는 추정 수치가 들어간다. */
public record WalkSafetyReason(WalkSafetyReasonCode code, String description) {

    public static WalkSafetyReason of(WalkSafetyReasonCode code, String description) {
        return new WalkSafetyReason(code, description);
    }
}
