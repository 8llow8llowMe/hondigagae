package com.hondigagae.domainlayer.member.application.port.out;

/**
 * 회원 보안 이벤트(탈퇴/비밀번호 변경) 시 세션을 무효화하는 계약.
 * member 컨텍스트가 auth 컨텍스트 구현에 직접 의존하지 않도록 경계를 둔다.
 * 구현 실패는 전파되어 호출 트랜잭션을 롤백시킨다.
 */
public interface MemberSessionRevokePort {

    void revokeAllSessions(long memberId, String tokenId);
}
