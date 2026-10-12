package com.hondigagae.domainlayer.insight.adapter.out.persistence;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.CongestionForecastRepository;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.application.port.out.CongestionForecastPort;
import com.hondigagae.shared.travel.insight.NameLinkSourceType;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

    @Override
    public Map<Long, CongestionSnapshot> findByPlacesAndDate(Collection<Long> placeIds, LocalDate date) {
        Map<Long, CongestionSnapshot> snapshots = new HashMap<>();
        // 같은 장소에 링크가 여럿이면 질의 정렬(예측 아이디 오름차순)의 첫 건을 쓴다 — 실행마다 같은 값이 나온다.
        congestionForecastRepository.findLinkedByPlaceIdsAndDate(placeIds, date.format(BASE_YMD_FORMAT), NameLinkSourceType.CONGESTION)
            .forEach(linked -> snapshots.putIfAbsent(
                linked.placeId(), insightMapper.toCongestionSnapshotFromEntity(linked.forecast())));
        // 연결된 예측이 없는 장소도 키로 남긴다. 없는 것을 한산함으로 바꿔치기하지 않는다.
        placeIds.forEach(placeId -> snapshots.putIfAbsent(placeId, CongestionSnapshot.unknown(date)));
        return snapshots;
    }
}
