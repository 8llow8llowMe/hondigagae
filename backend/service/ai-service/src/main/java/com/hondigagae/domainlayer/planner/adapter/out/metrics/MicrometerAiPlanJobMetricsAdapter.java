package com.hondigagae.domainlayer.planner.adapter.out.metrics;

import com.hondigagae.domainlayer.planner.application.model.AiPlanJobMode;
import com.hondigagae.domainlayer.planner.application.model.AiPlanStepOutcome;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobMetricsPort;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import org.springframework.stereotype.Component;

/**
 * 일정 생성 잡의 단계별 소요를 Micrometer Timer 로 노출한다 (#985).
 *
 * <p>Prometheus 에서는 {@code ai_plan_job_step_seconds_{count,sum,max,bucket}} 이다. 태그는
 * {@code step}(4) × {@code mode}(2) × {@code outcome}(3) 의 24 조합으로 닫혀 있다.
 *
 * <p><b>버킷을 손으로 정한 10개로 연다.</b> 단계별 p95 를 서버 여러 대에 걸쳐 합산하려면
 * {@code histogram_quantile} 이 필요하고, 그것은 버킷이 있어야 된다. 기본 퍼센타일 히스토그램은 버킷이
 * 수십 개라 24 조합과 곱하면 시계열이 천 단위가 된다. 경계는 조회 한 번(100ms) 부터 RUNNING 타임아웃
 * 기본값(300초)까지 — 그보다 긴 단계는 워커가 아니라 타임아웃 판정이 먼저 끝낸다. 경계를 바꾸면
 * observability-guide.md 의 목록도 함께 고친다.
 */
@Component
public class MicrometerAiPlanJobMetricsAdapter implements AiPlanJobMetricsPort {

    static final String STEP_METRIC = "ai.plan.job.step";
    static final Duration[] BUCKETS = {
        Duration.ofMillis(100), Duration.ofMillis(500), Duration.ofSeconds(1), Duration.ofSeconds(2), Duration.ofSeconds(5),
        Duration.ofSeconds(10), Duration.ofSeconds(30), Duration.ofSeconds(60), Duration.ofSeconds(120), Duration.ofSeconds(300)
    };

    private final MeterRegistry meterRegistry;

    public MicrometerAiPlanJobMetricsAdapter(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    @Override
    public void recordStep(AiPlanJobStep step, AiPlanJobMode mode, AiPlanStepOutcome outcome, Duration elapsed) {
        Timer.builder(STEP_METRIC)
            .description("AI 일정 생성 잡의 단계별 소요 (단계를 떠난 방식별)")
            .tags(Tags.of("step", step.name(), "mode", mode.tagValue(), "outcome", outcome.tagValue()))
            .serviceLevelObjectives(BUCKETS)
            .register(meterRegistry)
            .record(elapsed);
    }
}
