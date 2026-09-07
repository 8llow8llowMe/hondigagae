package com.hondigagae.domainlayer.emergency.application.service.processor;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.emergency.application.info.NearbyFacilitiesInfo;
import com.hondigagae.domainlayer.emergency.application.info.NearbyFacilityInfo;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.hondigagae.domainlayer.emergency.application.port.out.EmergencyFacilityRepositoryPort;
import com.hondigagae.domainlayer.emergency.application.exception.EmergencyErrorCode;
import com.hondigagae.domainlayer.emergency.application.exception.EmergencyException;
import com.hondigagae.domainlayer.emergency.application.info.EmergencyFacilityDetailInfo;
import com.hondigagae.domainlayer.emergency.application.port.out.query.EmergencyFacilityQueryResult;
import com.hondigagae.domainlayer.emergency.domain.model.FacilityOpenState;
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
     *
     * <p><b>총계는 자르기 전에 센다</b>(이슈 #285). 자른 뒤에 세면 {@code size} 와 늘 같은
     * 값이 나와, 그 수를 받은 쪽은 반경 안에 몇 곳이 더 있는지 영영 알 수 없다.
     */
    public NearbyFacilitiesInfo searchNearby(NearbyFacilityQuery query) {
        LocalDateTime now = LocalDateTime.now();
        List<NearbyFacilityInfo> matched = emergencyFacilityRepositoryPort.findWithinBox(query).stream()
            .filter(result -> result.lat() != null && result.lng() != null)
            .map(result -> toInfo(result, query, now))
            // openNowOnly 는 "지금 확실히 열린 곳"이다. 모름(null)도 뺀다 — 급할 때
            // 근거 없이 열려 있다고 말하는 편이 더 나쁘다. 다만 24시간 확인 시설은 spec 없이도 연다.
            .filter(info -> !query.openNowOnly() || Boolean.TRUE.equals(info.openNow()))
            .filter(info -> info.distanceMeters() <= query.radius())
            // 거리(m 반올림)는 같은 건물의 병원·약국처럼 동률이 흔하다 — 아이디로 순서를
            // 고정하지 않으면 호출마다 목록이 흔들리고 limit 경계의 포함 여부도 바뀐다.
            .sorted(Comparator.comparingInt(NearbyFacilityInfo::distanceMeters)
                .thenComparingLong(NearbyFacilityInfo::facilityId))
            .toList();

        return new NearbyFacilitiesInfo(
            matched.stream().limit(query.size()).toList(),
            matched.size());
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
     * 시설 상세.
     *
     * <p>목록과 <b>같은 판정 규칙</b>을 쓴다 ({@link FacilityOpenState}). 두 화면이 같은 시설을
     * 다르게 말하면 사용자는 어느 쪽도 믿지 않는다.
     *
     * <p>내려간(delisted) 시설은 포트가 없는 것으로 돌려주므로 404 가 된다. 목록이 안 보여
     * 주는 시설을 상세로는 볼 수 있으면, 폐업한 병원 주소를 들고 급하게 찾아가게 된다.
     */
    public EmergencyFacilityDetailInfo getDetail(long facilityId) {
        EmergencyFacilityQueryResult result = emergencyFacilityRepositoryPort.findById(facilityId)
            .orElseThrow(() -> new EmergencyException(EmergencyErrorCode.NOT_FOUND_FACILITY));

        return EmergencyFacilityDetailInfo.builder()
            .facilityId(result.facilityId())
            .facilityType(result.facilityType())
            .name(result.name())
            .addr(result.addr())
            // 좌표가 없는 행은 적재되지 않으므로 여기서는 값이 있다고 본다.
            .lat(toDouble(result.lat()))
            .lng(toDouble(result.lng()))
            .tel(result.tel())
            .operatingHours(result.operatingHours())
            .restDate(result.restDate())
            .open24(result.open24())
            .openNow(resolveOpenNow(result, LocalDateTime.now()))
            .build();
    }

    private Boolean resolveOpenNow(EmergencyFacilityQueryResult result, LocalDateTime now) {
        return FacilityOpenState.resolve(result.weeklyHoursSpec(), result.open24(), now);
    }

    private double toDouble(BigDecimal value) {
        return value.doubleValue();
    }
}
