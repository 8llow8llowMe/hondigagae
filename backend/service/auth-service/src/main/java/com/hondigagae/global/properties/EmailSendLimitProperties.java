package com.hondigagae.global.properties;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 미인증 이메일 발송 API 의 IP 기준 발송 상한.
 *
 * <p>이메일 키 쿨다운(60초)만으로는 한 IP 가 서로 다른 이메일 다수로 발송을 반복하는 남용
 * (메일 발신 평판 훼손, 타인 메일함 괴롭힘)을 막지 못해 IP 차원의 상한을 추가로 둔다.
 * 기본 10회 / 1시간 — 정상 사용자는 회원가입 시 1~2회면 충분하다.
 */
@ConfigurationProperties(prefix = "auth.email-send")
public record EmailSendLimitProperties(
    int ipMaxSendCount,
    Duration ipWindow
) {

    public EmailSendLimitProperties {
        if (ipMaxSendCount <= 0) {
            ipMaxSendCount = 10;
        }
        if (ipWindow == null || ipWindow.isZero() || ipWindow.isNegative()) {
            ipWindow = Duration.ofHours(1);
        }
    }
}
