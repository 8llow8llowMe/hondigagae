package com.hondigagae.domainlayer.member.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 가입 시 받는 필수 동의 항목.
 *
 * <p>선택 동의(마케팅 수신 등)는 아직 없다. 생기면 여기에 상수를 더하되, "필수인가"는
 * 이 enum 이 아니라 요청 검증(@AssertTrue)과 가입 로직이 정한다 — 항목의 정체와
 * 필수 여부는 개정 주기가 다르다.
 */
@Getter
@RequiredArgsConstructor
public enum ConsentType {
    TERMS_OF_SERVICE("이용약관"),
    PRIVACY_POLICY("개인정보 처리방침");

    private final String description;
}
