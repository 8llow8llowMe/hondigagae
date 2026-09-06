package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ai.plan.job")
public record AiPlanJobProperties(
    long ttlSeconds,
    long pendingTimeoutSeconds,
    long runningTimeoutSeconds
) {

    public AiPlanJobProperties {
        if (ttlSeconds <= 0) {
            ttlSeconds = 86_400L;
        }
        if (pendingTimeoutSeconds <= 0) {
            // 동시 실행 2 + 대기열 4(AsyncConfig)에서 대기열 끝의 잡이 최악 240초(2라운드 ×
            // LLM 120초)를 기다린다. 30초였을 때는 동시 사용자 3명부터 정상 대기가 타임아웃
            // FAILED 로 판정됐다. 세 값은 한 세트로 조정한다.
            pendingTimeoutSeconds = 300L;
        }
        if (runningTimeoutSeconds <= 0) {
            runningTimeoutSeconds = 300L;
        }
    }
}
