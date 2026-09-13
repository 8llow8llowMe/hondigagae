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
     * <p><b>스레드는 1이다</b> — 늘려도 처리량이 늘지 않기 때문이다. Ollama 가
     * {@code OLLAMA_NUM_PARALLEL=1} 이라 한 번에 하나만 추론하므로, 실효 처리량은 스레드 수와
     * 무관하게 "LLM 1회 소요당 1건" 이다. 전에는 2였고 이 자리의 근거는 "대기열 끝의 잡이
     * 기다리는 최악값 = 2라운드 × LLM 타임아웃(120초) = 240초" 였는데, <b>그 계산은 두 워커가
     * 진짜 병렬이라는 전제였고 인프라가 그것을 주지 않는다.</b>
     *
     * <p>2026-09-13 dev 대조 실험(#508): 단독 제출은 66초에 COMPLETED, 동시 2건은 <b>둘 다</b>
     * 123.5초에 AIPLAN_020 이었다. 두 워커가 Ollama 안에서 서로를 기다리는 동안 각자의 read
     * timeout 시계가 돌아, 뒤에 누른 사람만이 아니라 <b>먼저 누른 사람까지</b> 잃었다.
     * 기다림을 호출 안에서 이 대기열과 {@code LlmCallGate} 로 옮긴 것이 수정의 핵심이다.
     *
     * <p><b>세 값은 한 세트다</b> — 동시 실행(1), 대기열(1), PENDING 타임아웃(기본 300초,
     * {@code AiPlanJobProperties}). 잡 1건이 <b>워커 스레드를 쥐고 있는</b> 벽시계 최악값은
     * 다음 셋의 합이다.
     *
     * <pre>
     *   게이트 대기 (ai-llm.queue-wait-ms)    90초   ← 동기 준비물 생성이 모델을 쥐고 있을 때
     * + 모델 호출   (ai-llm.timeout-ms)      120초
     * + 내부 조회   (Feign read timeout 5초 × 최대 7회)  35초
     * = 245초
     * </pre>
     *
     * <p>내부 조회 7회는 {@code AiPlanWorker#toQuery} 가 최악에 부르는 횟수다 — 반려견 특성,
     * 일정 개요, 즐겨찾기, 후보 검색, 필수 포함 장소, 즐겨찾기 후보, 날씨 전망.
     *
     * <p><b>게이트 대기를 반드시 더한다.</b> 드문 경로라고 빼면 PENDING 산술이 RUNNING 산술과
     * 어긋나고, 어긋난 쪽으로 대기열을 잡는 순간 대기열 끝의 잡이 <b>정상 대기 중에</b> PENDING
     * 타임아웃 FAILED 가 된다 — 이 이슈가 없애려던 바로 그 증상이다.
     *
     * <p>그래서 대기열은 1이다: 1 × 245 = <b>245초</b> ≤ 300초. 실측(66초) 기준이면 66초다.
     * <b>동시 제출 2건까지 받고</b>(실행 1 + 대기 1) 3번째부터는 {@code TaskRejectedException} →
     * JOB_QUEUE_FULL(503) 로 <b>즉시</b> 거절한다 — 5분 기다렸다가 실패하는 것보다 지금 붐빈다고
     * 바로 말하는 편이 낫다.
     *
     * <p>대기열을 키우려면 <b>PENDING 타임아웃을 함께 올린다</b> — 조건은
     * {@code 대기열 길이 × 245초 ≤ pending-timeout-seconds} 이고,
     * {@code AiPlanTaskExecutorTest} 가 이 부등식을 설정값에서 직접 계산해 잠근다.
     */
    @Bean(name = "aiPlanTaskExecutor")
    public Executor aiPlanTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(1);
        executor.setThreadNamePrefix("ai-plan-worker-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(15);
        executor.initialize();
        return executor;
    }
}
