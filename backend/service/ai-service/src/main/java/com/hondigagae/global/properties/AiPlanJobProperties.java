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
        // 아래 둘은 같은 수를 쓴다 — 잡 1건이 워커 스레드를 쥐고 있는 벽시계 최악값 245초다
        // (게이트 대기 90 + 모델 호출 120 + 내부 조회 5초 × 최대 7회 = 35). 두 산술이 갈라지면
        // 한쪽 기준으로 잡은 대기열이 다른 쪽에서 타임아웃을 넘긴다 (#508).
        if (pendingTimeoutSeconds <= 0) {
            // 실효 동시성 1 기준이다. 동시 실행 1 + 대기열 1(AsyncConfig)에서 대기열 끝의
            // 최악 대기는 1 × 245 = 245초이고 300초가 그것을 덮는다(실측 66초 기준이면 66초).
            // 30초였을 때는 동시 사용자 3명부터 정상 대기가 타임아웃 FAILED 로 판정됐다.
            // 대기열을 키우려면 이 값도 함께 올린다 — 대기열 길이 × 245초 ≤ 이 값.
            pendingTimeoutSeconds = 300L;
        }
        if (runningTimeoutSeconds <= 0) {
            // RUNNING 최악값도 같은 245초다. 게이트 대기가 실제로 걸리는 것은 동기 준비물 생성과
            // 겹칠 때뿐이지만(일정 생성끼리는 풀이 1이라 부딪히지 않는다), 그 경우가 곧 게이트를
            // 둔 이유이므로 최악값 계산에서 빼지 않는다.
            runningTimeoutSeconds = 300L;
        }
    }
}
