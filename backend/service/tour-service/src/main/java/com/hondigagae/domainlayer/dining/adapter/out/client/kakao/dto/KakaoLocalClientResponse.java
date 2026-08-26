package com.hondigagae.domainlayer.dining.adapter.out.client.kakao.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.hondigagae.domainlayer.dining.application.port.out.query.NearbyDiningQueryResult;
import java.util.List;

/**
 * 카카오 로컬 검색 원본 응답. 이 타입은 어댑터 밖으로 나가지 않는다.
 *
 * <p>응답 필드가 계속 늘 수 있어 모르는 필드는 무시한다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record KakaoLocalClientResponse(
    List<Document> documents
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Document(
        @JsonProperty("place_name") String placeName,
        @JsonProperty("address_name") String addressName,
        @JsonProperty("road_address_name") String roadAddressName,
        // 카카오는 x=경도, y=위도이며 문자열로 온다.
        String x,
        String y,
        String phone,
        @JsonProperty("category_name") String categoryName,
        @JsonProperty("place_url") String placeUrl,
        String distance
    ) {

        public NearbyDiningQueryResult toQueryResult() {
            return NearbyDiningQueryResult.builder()
                .name(placeName)
                .address(addressName)
                .roadAddress(roadAddressName)
                .lat(toDouble(y))
                .lng(toDouble(x))
                .phone(phone)
                .category(categoryName)
                .detailUrl(placeUrl)
                .distanceMeters(toInt(distance))
                .build();
        }

        private double toDouble(String value) {
            try {
                return value == null ? 0d : Double.parseDouble(value);
            } catch (NumberFormatException exception) {
                return 0d;
            }
        }

        private int toInt(String value) {
            try {
                return value == null ? 0 : Integer.parseInt(value);
            } catch (NumberFormatException exception) {
                return 0;
            }
        }
    }
}
