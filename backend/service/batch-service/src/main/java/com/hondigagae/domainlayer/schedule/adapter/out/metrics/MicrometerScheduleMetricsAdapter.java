package com.hondigagae.domainlayer.schedule.adapter.out.metrics;

import com.hondigagae.domainlayer.schedule.application.model.ScheduledLaunchResult.LaunchOutcome;
import com.hondigagae.domainlayer.schedule.application.port.out.ScheduleMetricsPort;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 스케줄 발화를 Micrometer 로 노출한다 (observability-guide.md "배치 지표").
 *
 * <p>발화 횟수는 Counter 다. 적재 행 수와 달리 "마지막 실행에서 몇 건"이 아니라 "지난 한 주에
 * 몇 번 건너뛰었나"를 보게 되므로 누적값이 맞다.
 *
 * <p>마지막 발화 시각은 결과와 무관하게 기록한다. 이 게이지가 답하는 질문은 "잡이 성공했나"가
 * 아니라 <b>"스케줄러가 살아서 발화는 하고 있나"</b>다 — 성공 여부는 잡별
 * {@code place_import_last_success_timestamp} 가 이미 답한다. 컨테이너가 죽었거나 트리거가
 * 등록되지 않은 상태는 이 값이 멈추는 것으로만 드러난다.
 */
@Component
@RequiredArgsConstructor
public class MicrometerScheduleMetricsAdapter implements ScheduleMetricsPort {

    static final String FIRE_METRIC = "batch.schedule.fire";
    static final String LAST_FIRE_METRIC = "batch.schedule.last.fire.timestamp";

    private final MeterRegistry meterRegistry;

    // Micrometer 게이지는 참조를 약하게 잡으므로 값 홀더를 여기서 강하게 붙들어야 한다
    private final ConcurrentMap<String, AtomicLong> lastFireEpochByJob = new ConcurrentHashMap<>();

    @Override
    public void recordFire(String jobName, LaunchOutcome outcome, Instant firedAt) {
        Counter.builder(FIRE_METRIC)
            .description("스케줄 발화 횟수")
            .tags(Tags.of("job", jobName, "result", outcome.name().toLowerCase(Locale.ROOT)))
            .register(meterRegistry)
            .increment();

        lastFireEpochByJob.computeIfAbsent(jobName, key -> {
            AtomicLong holder = new AtomicLong();
            Gauge.builder(LAST_FIRE_METRIC, holder, AtomicLong::get)
                .description("잡별 마지막 스케줄 발화 시각 (epoch seconds)")
                .tags(Tags.of("job", key))
                .register(meterRegistry);
            return holder;
        }).accumulateAndGet(firedAt.getEpochSecond(), Math::max);
    }
}
