package com.hondigagae.global.config;

import com.hondigagae.domainlayer.insight.domain.enums.JejuRegion;
import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * 권역 날씨 비교 전용 executor.
     *
     * <p>빈 이름은 {도메인}{용도}TaskExecutor 규칙(api-design-guide §7)을 따르며,
     * 이 이름이 Micrometer executor 메트릭의 name 태그(Grafana 범례)가 된다.
     *
     * <h2>왜 전용 풀인가</h2>
     *
     * {@code parallelStream()} 은 공용 ForkJoinPool 을 쓴다. 여기서 하는 일은 <b>블로킹 HTTP
     * 호출</b>이라 그 풀을 오래 잡으면 JVM 전체가 공유하는 자원을 날씨 조회가 점유하게 된다.
     *
     * <h2>크기를 권역 수에 맞춘다</h2>
     *
     * 한 요청이 정확히 {@link JejuRegion} 수만큼 작업을 낸다. 그보다 크게 잡으면 남는 스레드가
     * 놀고, 작게 잡으면 병렬화한 의미가 줄어든다.
     *
     * <p>동시 요청은 <b>큐로 받는다.</b> 최대 풀을 키워 요청 수만큼 스레드를 늘리면 기상청으로
     * 나가는 동시 호출이 그만큼 늘어난다 - 쿼터가 일 1,000건인 원천에 그렇게 몰아치면 안 된다.
     * 대기가 길어지는 것이 원천을 두드리는 것보다 낫고, 애초에 대표 격자 다섯은 관광지가 몰린
     * 곳이라 대개 캐시에 있어 이 풀까지 오는 일 자체가 드물다.
     */
    @Bean(name = "insightRegionalTaskExecutor")
    public Executor insightRegionalTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(JejuRegion.values().length);
        executor.setMaxPoolSize(JejuRegion.values().length);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("insight-regional-worker-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(15);
        executor.initialize();
        return executor;
    }
}
