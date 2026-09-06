package com.hondigagae.domainlayer.placeimport.adapter.out.metrics;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceImportResultType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MicrometerPlaceImportMetricsAdapterTest {

    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final MicrometerPlaceImportMetricsAdapter adapter = new MicrometerPlaceImportMetricsAdapter(meterRegistry);

    @Test
    @DisplayName("행 수 게이지는 마지막 실행 값으로 덮어쓴다 — 누적하면 실행 단위 경보 기준과 어긋난다")
    void rowsGaugeKeepsLastRunValue() {
        adapter.recordRows(PlaceSourceType.MFDS, PlaceImportResultType.GEOCODE_FAILED, 12);
        adapter.recordRows(PlaceSourceType.MFDS, PlaceImportResultType.GEOCODE_FAILED, 3);

        assertThat(rowsValue(PlaceSourceType.MFDS, PlaceImportResultType.GEOCODE_FAILED)).isEqualTo(3);
    }

    @Test
    @DisplayName("(source, result) 조합마다 게이지가 갈린다")
    void rowsGaugeIsSplitBySourceAndResult() {
        adapter.recordRows(PlaceSourceType.TOUR_API, PlaceImportResultType.UPSERTED, 29);
        adapter.recordRows(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.UPSERTED, 228);
        adapter.recordRows(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.DELISTED, 2);

        assertThat(rowsValue(PlaceSourceType.TOUR_API, PlaceImportResultType.UPSERTED)).isEqualTo(29);
        assertThat(rowsValue(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.UPSERTED)).isEqualTo(228);
        assertThat(rowsValue(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.DELISTED)).isEqualTo(2);
    }

    @Test
    @DisplayName("last_success 는 과거로 되돌리지 않는다 — 씨딩과 실측이 어느 순서로 와도 최신이 남는다")
    void lastSuccessIsMonotonic() {
        adapter.recordLastSuccess(PlaceSourceType.TOUR_API, Instant.ofEpochSecond(2_000));
        adapter.recordLastSuccess(PlaceSourceType.TOUR_API, Instant.ofEpochSecond(1_000));

        assertThat(lastSuccessValue(PlaceSourceType.TOUR_API)).isEqualTo(2_000);

        adapter.recordLastSuccess(PlaceSourceType.TOUR_API, Instant.ofEpochSecond(3_000));
        assertThat(lastSuccessValue(PlaceSourceType.TOUR_API)).isEqualTo(3_000);
    }

    private double rowsValue(PlaceSourceType source, PlaceImportResultType result) {
        return meterRegistry.get(MicrometerPlaceImportMetricsAdapter.ROWS_METRIC)
            .tags("source", source.name(), "result", result.getTagValue())
            .gauge()
            .value();
    }

    private double lastSuccessValue(PlaceSourceType source) {
        return meterRegistry.get(MicrometerPlaceImportMetricsAdapter.LAST_SUCCESS_METRIC)
            .tags("source", source.name())
            .gauge()
            .value();
    }
}
