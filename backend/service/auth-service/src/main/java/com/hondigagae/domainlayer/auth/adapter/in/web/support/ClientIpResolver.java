package com.hondigagae.domainlayer.auth.adapter.in.web.support;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * 프록시(nginx) 뒤에서 실제 클라이언트 IP 를 얻는다.
 *
 * <p><b>X-Forwarded-For 는 마지막(가장 오른쪽) 값을 쓴다.</b> nginx 표준 구성
 * ({@code $proxy_add_x_forwarded_for})은 클라이언트가 보낸 헤더 뒤에 실제 접속 IP 를
 * <b>덧붙이므로</b>, 마지막 값만 신뢰 프록시가 기록한 것이고 앞의 값들은 클라이언트가 임의로
 * 넣을 수 있다. 첫 값을 쓰면 요청마다 헤더를 바꿔 보내는 것만으로 IP 발송 상한(AUTH_016)
 * 키가 매번 달라져 상한이 통째로 우회된다 — "자기 상한 키만 바뀐다"가 아니라 상한의 존재
 * 이유(한 IP 의 다계정 남용 차단)가 사라지는 것이다.
 */
@Component
public class ClientIpResolver {

    private static final String X_FORWARDED_FOR = "X-Forwarded-For";
    private static final String X_REAL_IP = "X-Real-IP";

    public String resolve(HttpServletRequest request) {
        String forwardedFor = request.getHeader(X_FORWARDED_FOR);
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] values = forwardedFor.split(",");
            return values[values.length - 1].trim();
        }
        String realIp = request.getHeader(X_REAL_IP);
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
