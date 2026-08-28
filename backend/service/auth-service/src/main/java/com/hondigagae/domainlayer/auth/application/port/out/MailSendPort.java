package com.hondigagae.domainlayer.auth.application.port.out;

public interface MailSendPort {

    void sendVerificationCode(String email, String code);

    void sendAlreadyRegisteredNotice(String email);

    /** 비밀번호 재설정 코드 발송. */
    void sendPasswordResetCode(String email, String code);

    /** 재설정 요청했지만 가입되지 않은 이메일 — 계정 존재 여부는 메일로만 알린다. */
    void sendPasswordResetNotRegisteredNotice(String email);

    /** 재설정 요청했지만 소셜 전용 계정(비밀번호 없음) — 소셜 로그인 이용 안내. */
    void sendPasswordResetSocialOnlyNotice(String email, String providerName);

    /** 일반 계정에 소셜 로그인이 연결된 사실을 통보한다 (계정 탈취 감지 수단). */
    void sendSocialLinkedNotice(String email, String providerName);
}
