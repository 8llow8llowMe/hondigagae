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
            pendingTimeoutSeconds = 30L;
        }
        if (runningTimeoutSeconds <= 0) {
            runningTimeoutSeconds = 300L;
        }
    }
}
