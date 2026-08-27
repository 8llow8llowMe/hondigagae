package com.hondigagae.domainlayer.insight.adapter.out.persistence;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.CongestionForecastRepository;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.application.port.out.CongestionForecastPort;
import com.hondigagae.domainlayer.insight.domain.enums.NameLinkSourceType;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CongestionForecastPersistenceAdapter implements CongestionForecastPort {

    private static final DateTimeFormatter BASE_YMD_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;

    private final CongestionForecastRepository congestionForecastRepository;
    private final InsightMapper insightMapper;

    @Override
    public CongestionSnapshot findByPlaceAndDate(long placeId, LocalDate date) {
        return findByPlaceAndDateRange(placeId, date, date).stream()
            .findFirst()
            // 매칭된 데이터가 없으면 UNKNOWN 이다. 없는 것을 한산함으로 바꿔치기하지 않는다.
            .orElseGet(() -> CongestionSnapshot.unknown(date));
    }

    @Override
    public List<CongestionSnapshot> findByPlaceAndDateRange(long placeId, LocalDate from, LocalDate to) {
        return congestionForecastRepository.findLinkedByPlaceIdAndDateRange(
                placeId, from.format(BASE_YMD_FORMAT), to.format(BASE_YMD_FORMAT),
                NameLinkSourceType.CONGESTION
            ).stream()
            .map(insightMapper::toCongestionSnapshotFromEntity)
            .toList();
    }
}
