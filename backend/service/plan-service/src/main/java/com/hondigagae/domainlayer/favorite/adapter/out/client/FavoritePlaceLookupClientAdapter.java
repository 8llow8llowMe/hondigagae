package com.hondigagae.domainlayer.favorite.adapter.out.client;

import com.hondigagae.domainlayer.favorite.adapter.out.client.feign.FavoritePlaceLookupClient;
import com.hondigagae.domainlayer.favorite.adapter.out.client.feign.dto.FavoritePlaceClientResponse;
import com.hondigagae.domainlayer.favorite.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.favorite.application.exception.FavoriteErrorCode;
import com.hondigagae.domainlayer.favorite.application.exception.FavoriteException;
import com.hondigagae.domainlayer.favorite.application.port.out.FavoritePlaceLookupPort;
import com.hondigagae.domainlayer.favorite.application.port.out.query.FavoritePlaceQueryResult;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class FavoritePlaceLookupClientAdapter implements FavoritePlaceLookupPort {

    private final FavoritePlaceLookupClient favoritePlaceLookupClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public List<FavoritePlaceQueryResult> findSummaries(List<Long> placeIds) {
        if (placeIds.isEmpty()) {
            return List.of();
        }
        List<FavoritePlaceClientResponse> body = internalResponseSupport.requestAndUnwrapOrNull(
            InternalResponseSupport.TOUR_SERVICE,
            () -> favoritePlaceLookupClient.getPlaceSummaries(placeIds));
        if (body == null) {
            // 목록 엔드포인트는 404 를 내지 않는다. null 이면 응답 자체가 깨진 것이다.
            throw new FavoriteException(FavoriteErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
        }
        return body.stream()
            .filter(item -> item.placeId() != null)
            .map(item -> FavoritePlaceQueryResult.builder()
                .placeId(item.placeId())
                .title(item.title())
                .contentTypeName(item.contentTypeName())
                .addr(item.addr())
                .petAllowanceName(item.petAllowanceName())
                .indoor(item.indoor())
                .firstImage(item.firstImage())
                .build())
            .toList();
    }
}
