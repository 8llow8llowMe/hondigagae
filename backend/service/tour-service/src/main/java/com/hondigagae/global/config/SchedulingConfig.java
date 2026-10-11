package com.hondigagae.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 스케줄러 활성화. 현재는 장소 추천 예열({@code PlaceRecommendationPrewarmScheduler}, #1388)이 쓴다.
 *
 * <p>스케줄러 스레드는 Spring Boot 기본({@code ThreadPoolTaskScheduler}, 1개)을 쓴다. 작업이 하나이고 회차가 3시간 간격이라
 * 따로 풀을 둘 이유가 없다.
 *
 * <p>다중 인스턴스에서 동시에 울리므로 <b>작업마다 중복 실행에 대한 근거가 있어야</b> 한다. 예열은 Redis 작업 잠금
 * ({@code PlaceRecommendationPrewarmLockPort})으로 회차당 한 인스턴스만 돈다.
 *
 * <p>이 설정으로 Boot 의 {@code taskScheduler}(이것도 {@code TaskExecutor})가 생겨 {@code TaskExecutor} 빈이 둘이 된다.
 * {@code @Async} 를 쓸 때는 반드시 executor 이름을 지정한다 — 지정하지 않으면 기본 executor 를 고르지 못해 무제한
 * {@code SimpleAsyncTaskExecutor} 로 떨어진다.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {

}
