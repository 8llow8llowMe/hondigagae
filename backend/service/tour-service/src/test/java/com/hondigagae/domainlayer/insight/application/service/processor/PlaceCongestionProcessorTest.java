package com.hondigagae.domainlayer.insight.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.info.PlaceCongestionInfo;
import com.hondigagae.domainlayer.insight.application.port.out.CongestionForecastPort;
import com.hondigagae.domainlayer.insight.domain.enums.CongestionLevel;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 기간 혼잡도 조회 검증.
 *
 * <p>핵심은 <b>데이터가 없는 날짜를 빠뜨리지 않는 것</b>이다. 빠뜨리면 화면의 날짜 축에
 * 구멍이 생기고 사용자는 그 날을 "한산한 날"로 읽는다 - 없는 것을 좋은 쪽으로 읽게 만드는
 * 형태라 이 서비스에서 가장 피해야 하는 실수다.
 */
class PlaceCongestionProcessorTest {

    private static final long PLACE_ID = 212481712381923328L;
    private static final LocalDate FROM = LocalDate.of(2026, 9, 1);

    @Test
    @DisplayName("데이터가 없는 날짜도 UNKNOWN 으로 자리를 지킨다")
    void fillsMissingDatesWithUnknown() {
        // 원천이 3일 중 가운데 하루만 준 상황.
        CongestionForecastPort port = fixedPort(List.of(CongestionSnapshot.of(FROM.plusDays(1), 42.0)));
        PlaceCongestionProcessor processor = new PlaceCongestionProcessor(port);

        PlaceCongestionInfo info = processor.getCongestions(PLACE_ID, FROM, FROM.plusDays(2));

        assertThat(info.snapshots()).hasSize(3);
        assertThat(info.snapshots()).extracting(CongestionSnapshot::date)
            .containsExactly(FROM, FROM.plusDays(1), FROM.plusDays(2));
        assertThat(info.snapshots().get(0).level()).isEqualTo(CongestionLevel.UNKNOWN);
        assertThat(info.snapshots().get(2).level()).isEqualTo(CongestionLevel.UNKNOWN);
        // UNKNOWN 은 한산함이 아니라 모름이다. 집중률이 0 이 아니라 null 이어야 한다.
        assertThat(info.snapshots().get(0).concentrationRate()).isNull();
    }

    @Test
    @DisplayName("있는 날짜는 원천 값을 그대로 쓴다")
    void keepsKnownDates() {
        CongestionForecastPort port = fixedPort(List.of(CongestionSnapshot.of(FROM, 42.0)));
        PlaceCongestionProcessor processor = new PlaceCongestionProcessor(port);

        PlaceCongestionInfo info = processor.getCongestions(PLACE_ID, FROM, FROM);

        assertThat(info.snapshots()).singleElement()
            .satisfies(snapshot -> assertThat(snapshot.concentrationRate()).isEqualTo(42.0));
    }

    @Test
    @DisplayName("요청한 기간을 그대로 되돌려 준다")
    void echoesRequestedRange() {
        // 클라이언트가 기본값으로 불렀을 때 어느 구간을 받은 것인지 알아야 날짜 축을 그린다.
        PlaceCongestionProcessor processor = new PlaceCongestionProcessor(fixedPort(List.of()));

        PlaceCongestionInfo info = processor.getCongestions(PLACE_ID, FROM, FROM.plusDays(6));

        assertThat(info.fromDate()).isEqualTo(FROM);
        assertThat(info.toDate()).isEqualTo(FROM.plusDays(6));
        assertThat(info.snapshots()).hasSize(7);
    }

    @Test
    @DisplayName("종료일이 시작일보다 앞서면 400 으로 올린다")
    void rejectsInvertedRange() {
        PlaceCongestionProcessor processor = new PlaceCongestionProcessor(fixedPort(List.of()));

        assertThatThrownBy(() -> processor.getCongestions(PLACE_ID, FROM, FROM.minusDays(1)))
            .isInstanceOf(InsightException.class)
            .hasFieldOrPropertyWithValue("errorCode", InsightErrorCode.DATE_RANGE_INVALID);
    }

    /** 조회 결과만 정하면 되는 자리라 손으로 만든 fake 를 쓴다. */
    private CongestionForecastPort fixedPort(List<CongestionSnapshot> snapshots) {
        return new CongestionForecastPort() {

            @Override
            public CongestionSnapshot findByPlaceAndDate(long placeId, LocalDate date) {
                throw new UnsupportedOperationException("이 테스트에서는 쓰지 않는다");
            }

            @Override
            public List<CongestionSnapshot> findByPlaceAndDateRange(long placeId, LocalDate from, LocalDate to) {
                return snapshots;
            }
        };
    }
}
