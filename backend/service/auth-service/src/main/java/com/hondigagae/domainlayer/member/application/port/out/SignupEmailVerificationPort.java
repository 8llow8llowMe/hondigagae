package com.hondigagae.domainlayer.member.application.port.out;

/**
 * 회원가입 시 이메일 인증 완료 여부를 확인/소비하는 계약.
 * 인증 상태의 저장 방식(auth 컨텍스트의 Redis 키 설계)을 member 컨텍스트로부터 숨긴다.
 */
public interface SignupEmailVerificationPort {

    boolean isVerified(String email);

    void consume(String email);
}
