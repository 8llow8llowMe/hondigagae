package com.hondigagae.global.config;

import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * AI 여행 플래너 일정 생성 전용 executor.
     * 빈 이름은 {도메인}{용도}TaskExecutor 규칙(api-design-guide §7)을 따르며,
     * 이 이름이 Micrometer executor 메트릭의 name 태그(Grafana 범례)가 된다.
     *
     * <p><b>세 값은 한 세트다</b> — 동시 실행(max 2, 로컬 LLM GPU 1대 기준), 대기열(4),
     * PENDING 타임아웃(기본 300초, {@code AiPlanJobProperties}). 대기열 끝의 잡이 기다리는
     * 최악값은 2라운드 × LLM 타임아웃(120초) = 240초라 300초 안에 실행이 시작된다.
     * 대기열을 다시 키우면 뒤쪽 잡이 PENDING 타임아웃으로 연쇄 FAILED 가 되고, 넘치는
     * 제출은 {@code TaskRejectedException} → JOB_QUEUE_FULL(503) 로 즉시 거절된다.
     */
    @Bean(name = "aiPlanTaskExecutor")
    public Executor aiPlanTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(4);
        executor.setThreadNamePrefix("ai-plan-worker-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(15);
        executor.initialize();
        return executor;
    }
}
