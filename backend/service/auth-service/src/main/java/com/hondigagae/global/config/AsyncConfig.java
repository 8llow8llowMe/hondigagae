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
     * 인증코드 메일 발송 전용 executor.
     * 빈 이름은 {도메인}{용도}TaskExecutor 규칙(api-design-guide §7)을 따르며,
     * 이 이름이 Micrometer executor 메트릭의 name 태그(Grafana 범례)가 된다.
     */
    @Bean(name = "authMailTaskExecutor")
    public Executor authMailTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("auth-mail-worker-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(15);
        executor.initialize();
        return executor;
    }
}
