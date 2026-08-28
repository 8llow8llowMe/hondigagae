package com.hondigagae.domainlayer.auth.adapter.in.web.support;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * 프록시(nginx) 뒤에서 실제 클라이언트 IP 를 얻는다.
 *
 * <p>auth-service 는 nginx 가 직접 프록시하므로 X-Forwarded-For 의 첫 값이 원 클라이언트다.
 * 헤더는 위조 가능하지만 이 값은 발송 상한(rate limit) 키로만 쓰므로, 위조 시 공격자가 얻는 것은
 * "자기 상한 키를 바꾸는 것"뿐이고 신뢰가 필요한 판단(인증 등)에는 쓰지 않는다.
 */
@Component
public class ClientIpResolver {

    private static final String X_FORWARDED_FOR = "X-Forwarded-For";
    private static final String X_REAL_IP = "X-Real-IP";

    public String resolve(HttpServletRequest request) {
        String forwardedFor = request.getHeader(X_FORWARDED_FOR);
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        String realIp = request.getHeader(X_REAL_IP);
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
