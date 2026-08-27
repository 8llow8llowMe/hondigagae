package com.hondigagae.domainlayer.planner.adapter.out.client;

import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PlaceCandidateClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse.MetadataClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse.PlaceItemClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.planner.application.port.out.PlaceCandidateQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.query.PlaceCandidateQueryResult;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceCandidateClientAdapter implements PlaceCandidateQueryPort {

    /** 동반 가능이 확인된 곳만 후보로 준다. UNKNOWN 을 섞으면 LLM 이 그것을 가능으로 읽는다. */
    private static final String PET_ALLOWED = "ALLOWED";

    private final PlaceCandidateClient placeCandidateClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public List<PlaceCandidateQueryResult> findPetFriendlyCandidates(String areaCode, int size) {
        PlaceSliceClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
            InternalResponseSupport.TOUR_SERVICE,
            () -> placeCandidateClient.searchPlaces(areaCode, PET_ALLOWED, size));

        if (body == null || body.contents() == null) {
            log.warn("Place candidates empty areaCode={} size={}", areaCode, size);
            return List.of();
        }
        return body.contents().stream()
            // 식별자나 좌표가 없으면 일정에 넣어도 저장하거나 지도에 그릴 수 없다.
            // 후보 단계에서 빼는 편이 낫다 - LLM 에게 못 쓰는 선택지를 주지 않는다.
            .filter(item -> item.placeId() != null && !item.placeId().isBlank())
            .filter(item -> item.lat() != null && item.lng() != null)
            .map(this::toQueryResult)
            .toList();
    }

    private PlaceCandidateQueryResult toQueryResult(PlaceItemClientResponse item) {
        return PlaceCandidateQueryResult.builder()
            .placeId(Long.parseLong(item.placeId()))
            .title(item.title())
            .contentTypeName(nameOf(item.contentType()))
            .addr(item.addr1())
            .petAllowanceName(nameOf(item.petAllowanceType()))
            .indoor(item.indoor())
            .sourceCategory(item.sourceCategory())
            .lat(item.lat())
            .lng(item.lng())
            .build();
    }

    private String nameOf(MetadataClientResponse metadata) {
        return metadata == null ? null : metadata.name();
    }
}
