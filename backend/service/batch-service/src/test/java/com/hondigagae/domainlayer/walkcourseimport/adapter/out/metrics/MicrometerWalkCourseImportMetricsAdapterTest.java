package com.hondigagae.domainlayer.walkcourseimport.adapter.out.metrics;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.walkcourseimport.domain.enums.WalkCourseImportResultType;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MicrometerWalkCourseImportMetricsAdapterTest {

    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final MicrometerWalkCourseImportMetricsAdapter adapter = new MicrometerWalkCourseImportMetricsAdapter(meterRegistry);

    @Test
    @DisplayName("우회 플래그는 마지막 실행 값으로 덮어쓴다 — 우회 뒤 정상 실행이면 0 으로 돌아온다")
    void fallbackGaugeKeepsLastRunValue() {
        adapter.recordRows(WalkCourseImportResultType.FALLBACK, 1);
        adapter.recordRows(WalkCourseImportResultType.FALLBACK, 0);

        assertThat(rowsValue(WalkCourseImportResultType.FALLBACK)).isZero();
    }

    @Test
    @DisplayName("result 마다 게이지가 갈리고 source=OLLE 태그가 붙는다")
    void rowsGaugeIsSplitByResult() {
        adapter.recordRows(WalkCourseImportResultType.UPSERTED, 29);
        adapter.recordRows(WalkCourseImportResultType.FALLBACK, 1);

        assertThat(rowsValue(WalkCourseImportResultType.UPSERTED)).isEqualTo(29);
        assertThat(rowsValue(WalkCourseImportResultType.FALLBACK)).isEqualTo(1);
    }

    private double rowsValue(WalkCourseImportResultType result) {
        return meterRegistry.get(MicrometerWalkCourseImportMetricsAdapter.ROWS_METRIC)
            .tags("source", MicrometerWalkCourseImportMetricsAdapter.SOURCE_OLLE, "result", result.getTagValue())
            .gauge()
            .value();
    }
}
