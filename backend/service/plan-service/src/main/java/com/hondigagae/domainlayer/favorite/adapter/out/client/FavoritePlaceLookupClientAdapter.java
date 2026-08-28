package com.hondigagae.domainlayer.favorite.adapter.out.client;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.favorite.adapter.out.client.feign.FavoritePlaceLookupClient;
import com.hondigagae.domainlayer.favorite.adapter.out.client.feign.dto.FavoritePlaceClientResponse;
import com.hondigagae.domainlayer.favorite.application.exception.FavoriteErrorCode;
import com.hondigagae.domainlayer.favorite.application.exception.FavoriteException;
import com.hondigagae.domainlayer.favorite.application.port.out.FavoritePlaceLookupPort;
import com.hondigagae.domainlayer.favorite.application.port.out.query.FavoritePlaceQueryResult;
import feign.FeignException;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 장소 요약 조회 어댑터.
 *
 * <p>서킷 인스턴스는 plan 컨텍스트와 같은 논리 서비스명("tour-service")을 쓴다 —
 * 같은 원격 서비스의 장애는 컨텍스트와 무관하게 하나의 서킷으로 집계돼야 한다.
 */
@Component
@RequiredArgsConstructor
public class FavoritePlaceLookupClientAdapter implements FavoritePlaceLookupPort {

    private static final String TOUR_SERVICE = "tour-service";

    private final FavoritePlaceLookupClient favoritePlaceLookupClient;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    @Override
    public List<FavoritePlaceQueryResult> findSummaries(List<Long> placeIds) {
        if (placeIds.isEmpty()) {
            return List.of();
        }
        Response<List<FavoritePlaceClientResponse>> response;
        try {
            response = circuitBreakerRegistry.circuitBreaker(TOUR_SERVICE)
                .executeSupplier(() -> favoritePlaceLookupClient.getPlaceSummaries(placeIds));
        } catch (CallNotPermittedException | FeignException exception) {
            throw new FavoriteException(FavoriteErrorCode.INTERNAL_SERVICE_UNAVAILABLE, exception);
        }
        List<FavoritePlaceClientResponse> body = response == null ? null : response.dataBody();
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
