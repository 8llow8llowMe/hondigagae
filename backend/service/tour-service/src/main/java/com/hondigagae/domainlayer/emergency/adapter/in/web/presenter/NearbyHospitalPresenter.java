package com.hondigagae.domainlayer.emergency.adapter.in.web.presenter;

import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.item.NearbyHospitalItem;
import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response.NearbyHospitalResponse;
import com.hondigagae.domainlayer.emergency.application.info.NearbyHospitalInfo;
import com.hondigagae.domainlayer.emergency.application.model.NearbyHospitalQuery;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class NearbyHospitalPresenter {

    private static final String PROVIDER_NAME = "한국문화정보원 반려동물 동반 가능 문화시설 위치 데이터";

    public NearbyHospitalResponse toResponse(List<NearbyHospitalInfo> infos, NearbyHospitalQuery query) {
        List<NearbyHospitalItem> items = infos.stream()
            .map(this::toItem)
            .toList();

        return NearbyHospitalResponse.builder()
            .hospitals(items)
            .totalCount(items.size())
            .radius(query.radius())
            .open24Only(query.open24Only())
            .providerName(PROVIDER_NAME)
            .build();
    }

    private NearbyHospitalItem toItem(NearbyHospitalInfo info) {
        String hours = info.operatingHours();
        return NearbyHospitalItem.builder()
            .hospitalId(info.hospitalId())
            .name(info.name())
            .addr(info.addr())
            .lat(info.lat())
            .lng(info.lng())
            .tel(info.tel())
            .operatingHours(hours)
            .restDate(info.restDate())
            .open24(info.open24())
            // 원천의 49%가 운영시간을 주지 않는다. null 을 "휴무"로 오해하지 않도록 플래그를 따로 내린다.
            .operatingHoursKnown(hours != null && !hours.isBlank())
            .distanceMeters(info.distanceMeters())
            .build();
    }
}
