package com.hondigagae.domainlayer.member.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 가입 시 받아 이력으로 남기는 필수 확인 항목.
 *
 * <p>선택 동의(마케팅 수신 등)는 아직 없다. 생기면 여기에 상수를 더하되, "필수인가"는
 * 이 enum 이 아니라 요청 검증(@AssertTrue)과 가입 로직이 정한다 — 항목의 정체와
 * 필수 여부는 개정 주기가 다르다.
 *
 * <p><b>{@link #AGE_OVER_14} 는 "동의"가 아니라 "확인"이다.</b> 앞의 두 항목은 <i>문서에 대한
 * 의사표시</i>라 철회하면 이용계약이 끝나지만, 이 항목은 <i>사실에 대한 자기신고</i>라 철회라는
 * 개념이 없다 — 나이는 되돌릴 수 있는 값이 아니다. 그래서 동의 철회·재동의 흐름을 만들 때
 * <b>이 항목을 대상에 넣지 않는다.</b> 같은 테이블에 담는 이유는 "가입 시점에 무엇을 묻고 무엇을
 * 확인받았는가"가 한 자리에서 복원돼야 하기 때문이지, 성격이 같아서가 아니다.
 *
 * <p>이 항목의 {@code documentVersion} 에는 <b>이용약관 버전</b>이 들어간다. 만 14세 미만 가입
 * 불가를 규정하는 것이 이용약관이라, 나중에 다툼이 생겼을 때 복원해야 하는 것은 "그때 그 조항이
 * 어떤 문장이었는가"다. 개인정보 처리방침 버전을 넣으면 근거 문서와 박제된 버전이 어긋난다.
 */
@Getter
@RequiredArgsConstructor
public enum ConsentType {
    TERMS_OF_SERVICE("이용약관"),
    PRIVACY_POLICY("개인정보 처리방침"),
    AGE_OVER_14("만 14세 이상 확인");

    private final String description;
}
