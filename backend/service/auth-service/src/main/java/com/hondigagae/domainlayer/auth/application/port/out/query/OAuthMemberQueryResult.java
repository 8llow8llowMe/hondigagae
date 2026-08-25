package com.hondigagae.domainlayer.auth.application.port.out.query;

import lombok.Builder;

/**
 * 소셜 제공자에게서 조회한 사용자 프로필. adapter가 외부 응답을 이 형태로 변환해 넘긴다.
 *
 * <p>emailVerified는 "제공자가 이메일 소유를 검증했는지"를 뜻한다. 미검증 이메일로
 * 기존 계정을 연결하면 계정 탈취가 가능하므로, 신규 가입/계정 연결 판단에 반드시 사용한다.
 */
@Builder
public record OAuthMemberQueryResult(
    String email,
    boolean emailVerified,
    String name,
    String nickname,
    String profileImageUrl
) {

}
