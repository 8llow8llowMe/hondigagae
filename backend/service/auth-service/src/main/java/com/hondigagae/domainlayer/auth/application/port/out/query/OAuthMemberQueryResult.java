package com.hondigagae.domainlayer.auth.application.port.out.query;

import lombok.Builder;

/**
 * 카카오에게서 조회한 사용자 프로필. adapter가 외부 응답을 이 형태로 변환해 넘긴다.
 *
 * <p>회원 식별 기준은 kakaoId(카카오 회원번호)다. 이메일은 동의 항목이라 없을 수 있으며
 * 참고 정보로만 저장한다.
 */
@Builder
public record OAuthMemberQueryResult(
    long kakaoId,
    String email,
    String nickname,
    String profileImageUrl
) {

}
