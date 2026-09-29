package com.hondigagae.domainlayer.planner.adapter.out.metrics;

import com.hondigagae.domainlayer.planner.application.model.AiPlanJobMode;
import com.hondigagae.domainlayer.planner.application.model.AiPlanStepOutcome;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobMetricsPort;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import com.hondigagae.global.properties.AiPlanJobProperties;
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
 * <p><b>히스토그램 버킷을 연다.</b> 단계별 p95 를 서버 여러 대에 걸쳐 합산하려면
 * {@code histogram_quantile} 이 필요하고, 그것은 버킷이 있어야 된다. 범위는 조회 한 번(수십 ms)에서
 * RUNNING 타임아웃까지다 — 그보다 긴 단계는 워커가 아니라 타임아웃 판정이 먼저 끝낸다.
 */
@Component
public class MicrometerAiPlanJobMetricsAdapter implements AiPlanJobMetricsPort {

    static final String STEP_METRIC = "ai.plan.job.step";
    private static final Duration MINIMUM_EXPECTED = Duration.ofMillis(10);

    private final MeterRegistry meterRegistry;
    private final Duration maximumExpected;

    public MicrometerAiPlanJobMetricsAdapter(MeterRegistry meterRegistry, AiPlanJobProperties jobProperties) {
        this.meterRegistry = meterRegistry;
        this.maximumExpected = Duration.ofSeconds(jobProperties.runningTimeoutSeconds());
    }

    @Override
    public void recordStep(AiPlanJobStep step, AiPlanJobMode mode, AiPlanStepOutcome outcome, Duration elapsed) {
        Timer.builder(STEP_METRIC)
            .description("AI 일정 생성 잡의 단계별 소요 (단계를 떠난 방식별)")
            .tags(Tags.of("step", step.name(), "mode", mode.tagValue(), "outcome", outcome.tagValue()))
            .publishPercentileHistogram()
            .minimumExpectedValue(MINIMUM_EXPECTED)
            .maximumExpectedValue(maximumExpected)
            .register(meterRegistry)
            .record(elapsed);
    }
}
