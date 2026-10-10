package com.hondigagae.domainlayer.emergency.adapter.in.web.presenter;

import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.item.NearbyFacilityItem;
import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response.EmergencyFacilityDetailResponse;
import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response.NearbyFacilityResponse;
import com.hondigagae.domainlayer.emergency.application.info.EmergencyFacilityDetailInfo;
import com.hondigagae.domainlayer.emergency.application.info.NearbyFacilitiesInfo;
import com.hondigagae.domainlayer.emergency.application.info.NearbyFacilityInfo;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class NearbyFacilityPresenter {

    private static final String PROVIDER_NAME = "한국문화정보원 반려동물 동반 가능 문화시설 위치 데이터";

    /**
     * 목록 응답.
     *
     * <p><b>{@code totalCount} 는 {@code items.size()} 가 아니다</b>(이슈 #285). 목록은
     * {@code size} 로 잘려 있고 총계는 자르기 전 개수라, 여기서 항목을 다시 세면 두 값이
     * 언제나 같아져 "더 있다"를 말할 방법이 사라진다. 세지 말고 프로세서가 센 값을 그대로 내린다.
     */
    public NearbyFacilityResponse toResponse(NearbyFacilitiesInfo info, NearbyFacilityQuery query) {
        List<NearbyFacilityItem> items = info.facilities().stream()
            .map(this::toItem)
            .toList();

        return NearbyFacilityResponse.builder()
            .facilities(items)
            .totalCount(info.totalCount())
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
            .facilityType(info.facilityType().toMetadata())
            .name(info.name())
            .addr(info.addr())
            .lat(info.lat())
            .lng(info.lng())
            .tel(info.tel())
            .operatingHours(hours)
            .restDate(info.restDate())
            .open24(info.open24())
            .openNow(info.openNow())
            // 동물병원은 절반이 운영시간을 주지 않는다(약국은 98%가 준다).
            // null 을 "휴무"로 오해하지 않도록 플래그를 따로 내린다.
            .operatingHoursKnown(hours != null && !hours.isBlank())
            .distanceMeters(info.distanceMeters())
            .build();
    }

    /**
     * 상세 응답.
     *
     * <p>목록 항목과 같은 필드를 쓰지만 거리는 없다 - 상세는 검색 중심점 없이 부르는 화면이라
     * 거리를 낼 기준이 없다. 0 을 채우면 "바로 여기"라는 뜻이 되어 명백히 틀린 값이 나간다.
     */
    public EmergencyFacilityDetailResponse toDetailResponse(EmergencyFacilityDetailInfo info) {
        String hours = info.operatingHours();
        return EmergencyFacilityDetailResponse.builder()
            // Snowflake 아이디는 문자열로 내린다. long 그대로 보내면 JS 가 조용히 절삭한다.
            .facilityId(String.valueOf(info.facilityId()))
            .facilityType(info.facilityType().toMetadata())
            .name(info.name())
            .addr(info.addr())
            .lat(info.lat())
            .lng(info.lng())
            .tel(info.tel())
            .operatingHours(hours)
            .restDate(info.restDate())
            .open24(info.open24())
            .openNow(info.openNow())
            .operatingHoursKnown(hours != null && !hours.isBlank())
            .build();
    }
}
