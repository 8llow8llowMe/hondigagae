package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.info.PlaceCongestionInfo;
import com.hondigagae.domainlayer.insight.application.port.out.CongestionForecastPort;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 기간 혼잡도 조회.
 *
 * <p>답하는 질문이 적합도와 다르다. 적합도는 "이 날 갈 만한가"이고 이쪽은
 * <b>"이번 주 언제 덜 붐비나"</b> 다. 그래서 하루가 아니라 기간을 받는다.
 *
 * <p>날씨와 커버리지가 다르다는 점이 이 기능의 근거다. 예보는 약 11일까지지만 집중률 예측은
 * 30일 rolling 이라, <b>날씨는 없고 혼잡도만 있는 날짜</b>가 흔하다. 적합도로는 답할 수 없는
 * 구간을 이 조회가 덮는다.
 */
@Component
@RequiredArgsConstructor
public class PlaceCongestionProcessor {

    private final CongestionForecastPort congestionForecastPort;

    /**
     * 기간 안의 일자별 혼잡도.
     *
     * <p><b>데이터가 없는 날짜도 UNKNOWN 으로 채워 돌려준다.</b> 빠뜨리면 화면의 날짜 축에
     * 구멍이 생기고 사용자는 그 날을 "한산한 날"로 읽는다 - 없는 것을 좋은 쪽으로 읽게 만드는
     * 형태라 이 서비스에서 가장 피해야 하는 실수다.
     */
    public PlaceCongestionInfo getCongestions(long placeId, LocalDate fromDate, LocalDate toDate) {
        if (toDate.isBefore(fromDate)) {
            throw new InsightException(InsightErrorCode.DATE_RANGE_INVALID);
        }

        Map<LocalDate, CongestionSnapshot> byDate = new LinkedHashMap<>();
        for (CongestionSnapshot snapshot : congestionForecastPort.findByPlaceAndDateRange(placeId, fromDate, toDate)) {
            byDate.put(snapshot.date(), snapshot);
        }

        List<CongestionSnapshot> filled = fromDate.datesUntil(toDate.plusDays(1))
            .map(date -> byDate.getOrDefault(date, CongestionSnapshot.unknown(date)))
            .toList();

        return PlaceCongestionInfo.builder()
            .placeId(placeId)
            .fromDate(fromDate)
            .toDate(toDate)
            .snapshots(filled)
            .build();
    }
}
