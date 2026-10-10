package com.hondigagae.domainlayer.walkcourseimport.adapter.out.metrics;

import com.hondigagae.domainlayer.walkcourseimport.application.port.out.WalkCourseImportMetricsPort;
import com.hondigagae.domainlayer.walkcourseimport.domain.enums.WalkCourseImportResultType;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 걷기 코스 적재 결과를 Micrometer 게이지로 노출한다 (observability-guide.md "배치 지표").
 *
 * <p>{@code MicrometerPlaceImportMetricsAdapter} 와 같은 모양이다 — 행 수를 Counter 가 아니라
 * Gauge 로 두어 "마지막 실행에서 몇 건"을 그대로 읽고, {@code source}·{@code result} 태그를 붙인다.
 * 원천은 지금 제주올레 하나라 {@code source} 는 상수다.
 */
@Component
@RequiredArgsConstructor
public class MicrometerWalkCourseImportMetricsAdapter implements WalkCourseImportMetricsPort {

    static final String ROWS_METRIC = "walk.course.import.rows";
    static final String SOURCE_OLLE = "OLLE";

    private final MeterRegistry meterRegistry;

    // Micrometer 게이지는 참조를 약하게 잡으므로 값 홀더를 여기서 강하게 붙들어야 한다
    private final ConcurrentMap<WalkCourseImportResultType, AtomicLong> rowsByResult = new ConcurrentHashMap<>();

    @Override
    public void recordRows(WalkCourseImportResultType result, long rows) {
        rowsByResult.computeIfAbsent(result, key -> {
            AtomicLong holder = new AtomicLong();
            Gauge.builder(ROWS_METRIC, holder, AtomicLong::get)
                .description("마지막 걷기 코스 적재 실행에서 처리한 행 수")
                .tags(Tags.of("source", SOURCE_OLLE, "result", result.getTagValue()))
                .register(meterRegistry);
            return holder;
        }).set(rows);
    }
}
