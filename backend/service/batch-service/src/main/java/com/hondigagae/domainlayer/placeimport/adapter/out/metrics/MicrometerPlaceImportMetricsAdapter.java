package com.hondigagae.domainlayer.placeimport.adapter.out.metrics;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImportMetricsPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceImportResultType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 적재 결과를 Micrometer 게이지로 노출한다 (observability-guide.md "배치 지표").
 *
 * <p>행 수를 Counter 가 아니라 Gauge 로 둔다 — 배치는 실행 단위가 명확해서 "마지막 실행에서
 * 몇 건"이 경보 기준(geocode_failed &gt; 10, delisted &gt; 30)과 그대로 대응한다.
 * Counter 누적값은 increase() 없이는 실행 단위를 읽을 수 없다.
 *
 * <p>last_success 는 단조 증가로만 갱신한다. 기동 시 Spring Batch 메타데이터로 씨딩하는
 * {@link PlaceImportMetricsSeeder} 와 실행 중 기록이 어느 순서로 겹쳐도 최신 값이 남는다.
 */
@Component
@RequiredArgsConstructor
public class MicrometerPlaceImportMetricsAdapter implements PlaceImportMetricsPort {

    static final String ROWS_METRIC = "place.import.rows";
    static final String LAST_SUCCESS_METRIC = "place.import.last.success.timestamp";

    private final MeterRegistry meterRegistry;

    // Micrometer 게이지는 참조를 약하게 잡으므로 값 홀더를 여기서 강하게 붙들어야 한다
    private final ConcurrentMap<String, AtomicLong> rowsBySourceAndResult = new ConcurrentHashMap<>();
    private final ConcurrentMap<PlaceSourceType, AtomicLong> lastSuccessEpochBySource = new ConcurrentHashMap<>();

    @Override
    public void recordRows(PlaceSourceType source, PlaceImportResultType result, long rows) {
        rowsBySourceAndResult.computeIfAbsent(source.name() + "/" + result.getTagValue(), key ->
            registerGauge(ROWS_METRIC, "마지막 적재 실행에서 처리한 행 수",
                Tags.of("source", source.name(), "result", result.getTagValue()))
        ).set(rows);
    }

    @Override
    public void recordLastSuccess(PlaceSourceType source, Instant completedAt) {
        lastSuccessEpochBySource.computeIfAbsent(source, key ->
            registerGauge(LAST_SUCCESS_METRIC, "소스별 마지막 적재 성공 시각 (epoch seconds)",
                Tags.of("source", source.name()))
        ).accumulateAndGet(completedAt.getEpochSecond(), Math::max);
    }

    private AtomicLong registerGauge(String name, String description, Tags tags) {
        AtomicLong holder = new AtomicLong();
        Gauge.builder(name, holder, AtomicLong::get)
            .description(description)
            .tags(tags)
            .register(meterRegistry);
        return holder;
    }
}
