package com.hondigagae.domainlayer.dining.application.info;

import com.hondigagae.domainlayer.dining.application.port.out.query.NearbyDiningQueryResult;
import lombok.Builder;

@Builder
public record NearbyDiningInfo(
    String name,
    String address,
    double lat,
    double lng,
    String phone,
    String category,
    String detailUrl,
    int distanceMeters
) {

    public static NearbyDiningInfo from(NearbyDiningQueryResult result) {
        String address = result.roadAddress() == null || result.roadAddress().isBlank()
            ? result.address()
            : result.roadAddress();

        return NearbyDiningInfo.builder()
            .name(result.name())
            .address(address)
            .lat(result.lat())
            .lng(result.lng())
            .phone(result.phone())
            .category(result.category())
            .detailUrl(result.detailUrl())
            .distanceMeters(result.distanceMeters())
            .build();
    }
}
