package com.hondigagae.domainlayer.emergency.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.item.NearbyFacilityItem;
import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response.NearbyFacilityResponse;
import com.hondigagae.domainlayer.emergency.application.info.NearbyFacilityInfo;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.hondigagae.domainlayer.emergency.domain.enums.EmergencyFacilityType;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class NearbyFacilityPresenter {

    private static final String PROVIDER_NAME = "한국문화정보원 반려동물 동반 가능 문화시설 위치 데이터";

    public NearbyFacilityResponse toResponse(List<NearbyFacilityInfo> infos, NearbyFacilityQuery query) {
        List<NearbyFacilityItem> items = infos.stream()
            .map(this::toItem)
            .toList();

        return NearbyFacilityResponse.builder()
            .facilities(items)
            .totalCount(items.size())
            .radius(query.radius())
            .open24Only(query.open24Only())
            .providerName(PROVIDER_NAME)
            .build();
    }

    private NearbyFacilityItem toItem(NearbyFacilityInfo info) {
        String hours = info.operatingHours();
        return NearbyFacilityItem.builder()
            // Snowflake 아이디는 문자열로 내린다. long 그대로 보내면 JS 가 조용히 절삭한다.
            .facilityId(String.valueOf(info.facilityId()))
            .facilityType(toFacilityTypeMetadata(info.facilityType()))
            .name(info.name())
            .addr(info.addr())
            .lat(info.lat())
            .lng(info.lng())
            .tel(info.tel())
            .operatingHours(hours)
            .restDate(info.restDate())
            .open24(info.open24())
            // 동물병원은 절반이 운영시간을 주지 않는다(약국은 98%가 준다).
            // null 을 "휴무"로 오해하지 않도록 플래그를 따로 내린다.
            .operatingHoursKnown(hours != null && !hours.isBlank())
            .distanceMeters(info.distanceMeters())
            .build();
    }

    private CodeNameDescriptionMetadata toFacilityTypeMetadata(EmergencyFacilityType facilityType) {
        return CodeNameDescriptionMetadata.of(
            facilityType.name(), facilityType.getDisplayName(), facilityType.getDescription());
    }
}
