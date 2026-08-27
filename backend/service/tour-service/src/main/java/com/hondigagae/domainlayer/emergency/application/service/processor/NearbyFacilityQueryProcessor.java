package com.hondigagae.domainlayer.emergency.application.service.processor;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.emergency.application.info.NearbyFacilityInfo;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.hondigagae.domainlayer.emergency.application.port.out.EmergencyFacilityRepositoryPort;
import com.hondigagae.domainlayer.emergency.application.port.out.query.EmergencyFacilityQueryResult;
import com.hondigagae.shared.travel.schedule.WeeklySchedule;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NearbyFacilityQueryProcessor {

    private final EmergencyFacilityRepositoryPort emergencyFacilityRepositoryPort;

    /**
     * 사각 범위 결과를 정확한 반경으로 다듬고 가까운 순으로 자른다.
     *
     * <p>제주 전체가 214곳뿐이라 메모리 정렬 비용이 문제 되지 않는다. 규모가 커지면
     * 공간 인덱스로 옮겨야 하는 지점이 여기다.
     */
    public List<NearbyFacilityInfo> searchNearby(NearbyFacilityQuery query) {
        LocalDateTime now = LocalDateTime.now();
        return emergencyFacilityRepositoryPort.findWithinBox(query).stream()
            .filter(result -> result.lat() != null && result.lng() != null)
            .map(result -> toInfo(result, query, now))
            // openNowOnly 는 "지금 확실히 열린 곳"이다. 모름(null)도 뺀다 — 급할 때
            // 근거 없이 열려 있다고 말하는 편이 더 나쁘다. 다만 24시간 확인 시설은 spec 없이도 연다.
            .filter(info -> !query.openNowOnly() || Boolean.TRUE.equals(info.openNow()))
            .filter(info -> info.distanceMeters() <= query.radius())
            .sorted(Comparator.comparingInt(NearbyFacilityInfo::distanceMeters))
            .limit(query.size())
            .toList();
    }

    private NearbyFacilityInfo toInfo(EmergencyFacilityQueryResult result, NearbyFacilityQuery query,
        LocalDateTime now) {
        double lat = toDouble(result.lat());
        double lng = toDouble(result.lng());
        int distance = (int) Math.round(GeoDistance.meters(query.lat(), query.lng(), lat, lng));

        return NearbyFacilityInfo.builder()
            .facilityId(result.facilityId())
            .facilityType(result.facilityType())
            .name(result.name())
            .addr(result.addr())
            .lat(lat)
            .lng(lng)
            .tel(result.tel())
            .operatingHours(result.operatingHours())
            .restDate(result.restDate())
            .open24(result.open24())
            .openNow(resolveOpenNow(result, now))
            .distanceMeters(distance)
            .build();
    }

    /**
     * 지금 영업 중인가. spec 이 있으면 그것으로 판정하고, 없어도 24시간 확인 시설은 연 것으로
     * 본다(상호의 "24시"만으로 open24 가 켜진 곳은 spec 이 없다). 둘 다 아니면 모름(null)이다.
     */
    private Boolean resolveOpenNow(EmergencyFacilityQueryResult result, LocalDateTime now) {
        WeeklySchedule schedule = WeeklySchedule.parseSpec(result.weeklyHoursSpec());
        if (schedule != null) {
            return schedule.isOpenAt(now);
        }
        return result.open24() ? Boolean.TRUE : null;
    }

    private double toDouble(BigDecimal value) {
        return value.doubleValue();
    }
}
