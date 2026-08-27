package com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * tour-service 장소 목록 응답의 Feign 전용 표현 (coding-conventions §12-1).
 *
 * <p>tour-service 의 DTO 를 그대로 참조할 수 없으므로(피어 서비스 import 금지) 필요한 필드만
 * 다시 선언한다. {@code @JsonIgnoreProperties(ignoreUnknown = true)} 를 붙여 상대 서비스가
 * 필드를 늘려도 이쪽이 깨지지 않게 한다 - 계약이 커지는 것은 정상이고, 그때마다 배포가
 * 묶이면 서비스를 나눈 의미가 없다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlaceSliceClientResponse(List<PlaceItemClientResponse> contents, boolean hasNext) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PlaceItemClientResponse(
        String placeId,
        MetadataClientResponse contentType,
        String title,
        String addr1,
        Double lat,
        Double lng,
        MetadataClientResponse petAllowanceType,
        Boolean indoor,
        String sourceCategory
    ) {

    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MetadataClientResponse(String code, String name, String description) {

    }
}
