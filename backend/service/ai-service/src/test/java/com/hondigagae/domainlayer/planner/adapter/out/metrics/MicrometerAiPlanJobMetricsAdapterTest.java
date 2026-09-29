package com.hondigagae.domainlayer.planner.adapter.out.metrics;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.AiPlanJobMode;
import com.hondigagae.domainlayer.planner.application.model.AiPlanStepOutcome;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import com.hondigagae.global.properties.AiPlanJobProperties;
import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.Tag;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.config.MeterFilter;
import io.micrometer.core.instrument.distribution.DistributionStatisticConfig;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 단계별 소요 Timer (#985). 이름·태그가 observability-guide.md 의 PromQL 이 기대는 계약이다.
 */
class MicrometerAiPlanJobMetricsAdapterTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final MicrometerAiPlanJobMetricsAdapter adapter =
        new MicrometerAiPlanJobMetricsAdapter(registry, new AiPlanJobProperties(0, 0, 0));

    @Test
    @DisplayName("태그는 step·mode·outcome 셋뿐이다 — 잡·회원·지역을 가리키는 값은 없다")
    void tagsCarryNoJobIdentity() {
        adapter.recordStep(AiPlanJobStep.DRAFTING, AiPlanJobMode.REGENERATE, AiPlanStepOutcome.COMPLETED, Duration.ofSeconds(40));

        Timer timer = registry.get(MicrometerAiPlanJobMetricsAdapter.STEP_METRIC).timer();
        assertThat(timer.getId().getTags()).extracting(Tag::getKey).containsExactlyInAnyOrder("step", "mode", "outcome");
        assertThat(timer.getId().getTags()).extracting(Tag::getValue).containsExactlyInAnyOrder("DRAFTING", "regenerate", "completed");
        assertThat(timer.totalTime(TimeUnit.SECONDS)).isEqualTo(40.0);
    }

    @Test
    @DisplayName("단계를 떠난 방식마다 따로 센다")
    void separatesSeriesByOutcome() {
        adapter.recordStep(AiPlanJobStep.WEATHER, AiPlanJobMode.FULL, AiPlanStepOutcome.COMPLETED, Duration.ofMillis(300));
        adapter.recordStep(AiPlanJobStep.WEATHER, AiPlanJobMode.FULL, AiPlanStepOutcome.COMPLETED, Duration.ofMillis(500));
        adapter.recordStep(AiPlanJobStep.WEATHER, AiPlanJobMode.FULL, AiPlanStepOutcome.FAILED, Duration.ofMillis(900));
        adapter.recordStep(AiPlanJobStep.WEATHER, AiPlanJobMode.FULL, AiPlanStepOutcome.CANCELED, Duration.ofMillis(100));

        assertThat(countOf("completed")).isEqualTo(2);
        assertThat(countOf("failed")).isEqualTo(1);
        assertThat(countOf("canceled")).isEqualTo(1);
    }

    @Test
    @DisplayName("히스토그램 버킷을 연다 — 서버 여러 대의 p95 를 histogram_quantile 로 합산하려면 필요하다")
    void publishesHistogramBuckets() {
        AtomicReference<DistributionStatisticConfig> configured = new AtomicReference<>();
        registry.config().meterFilter(new MeterFilter() {
            @Override
            public DistributionStatisticConfig configure(Meter.Id id, DistributionStatisticConfig config) {
                configured.set(config);
                return config;
            }
        });

        adapter.recordStep(AiPlanJobStep.CANDIDATES, AiPlanJobMode.FULL, AiPlanStepOutcome.COMPLETED, Duration.ofSeconds(2));

        assertThat(configured.get().isPercentileHistogram()).isTrue();
        // RUNNING 타임아웃(기본 300초)까지 버킷이 닿아야 DRAFTING 의 꼬리가 +Inf 로 뭉개지지 않는다.
        assertThat(configured.get().getMaximumExpectedValueAsDouble()).isEqualTo(Duration.ofSeconds(300).toNanos());
    }

    private long countOf(String outcome) {
        return registry.get(MicrometerAiPlanJobMetricsAdapter.STEP_METRIC).tag("outcome", outcome).timer().count();
    }
}
