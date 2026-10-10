package com.hondigagae.domainlayer.member.application.port.out;

/**
 * 회원 라이프사이클 이벤트의 메일 통보. 발송 구현은 auth 컨텍스트의 메일 어댑터에 위임한다.
 */
public interface MemberMailNotifyPort {

    /** 비밀번호가 제거되어 소셜 전용 계정으로 전환된 사실을 통보한다. */
    void notifyPasswordRemoved(String email, String providerName);
}
