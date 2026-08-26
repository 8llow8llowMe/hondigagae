package com.hondigagae.domainlayer.dining.adapter.out.client;

import com.hondigagae.domainlayer.dining.application.exception.DiningErrorCode;
import com.hondigagae.domainlayer.dining.application.exception.DiningException;
import com.hondigagae.domainlayer.dining.application.model.NearbyDiningQuery;
import com.hondigagae.domainlayer.dining.application.port.out.NearbyDiningQueryPort;
import com.hondigagae.domainlayer.dining.application.port.out.query.NearbyDiningQueryResult;
import com.hondigagae.domainlayer.dining.adapter.out.client.kakao.dto.KakaoLocalClientResponse;
import com.hondigagae.global.properties.KakaoLocalProperties;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriBuilder;

/**
 * 카카오 로컬 장소 검색 어댑터.
 *
 * <p><b>응답을 저장하지 않는다.</b> 카카오는 로컬 API 응답의 DB 저장뿐 아니라 세션 단위 임시 저장과
 * 캐싱도 허용하지 않는다. 그래서 이 어댑터에는 Redis 캐시가 없고, 호출 결과를 어떤 테이블에도 쓰지 않는다.
 * 다른 외부 API 와 정반대 규칙이라 실수로 캐시를 붙이지 않도록 여기 적어 둔다
 * (docs/external-api-guide.md §2-1, docs/place-data-integration.md §6).
 *
 * <p>원본 응답 DTO({@link KakaoLocalClientResponse})는 이 어댑터 안에서만 쓰고
 * application 계층에는 {@link NearbyDiningQueryResult} 만 넘긴다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KakaoLocalClientAdapter implements NearbyDiningQueryPort {

    private static final String KEYWORD_PATH = "/v2/local/search/keyword.json";
    private static final String CATEGORY_PATH = "/v2/local/search/category.json";
    private static final String AUTH_PREFIX = "KakaoAK ";
    private static final String CIRCUIT_NAME = "kakao-local";

    private final WebClient kakaoLocalWebClient;
    private final KakaoLocalProperties properties;

    @Override
    @CircuitBreaker(name = CIRCUIT_NAME, fallbackMethod = "searchNearbyFallback")
    public List<NearbyDiningQueryResult> searchNearby(NearbyDiningQuery query) {
        if (properties.restApiKey() == null || properties.restApiKey().isBlank()) {
            throw new DiningException(DiningErrorCode.SEARCH_KEY_MISSING);
        }

        boolean byKeyword = query.keyword() != null && !query.keyword().isBlank();

        KakaoLocalClientResponse response = kakaoLocalWebClient.get()
            .uri(uriBuilder -> buildUri(uriBuilder, query, byKeyword))
            .header("Authorization", AUTH_PREFIX + properties.restApiKey())
            .retrieve()
            .bodyToMono(KakaoLocalClientResponse.class)
            .block();

        if (response == null || response.documents() == null) {
            return List.of();
        }
        return response.documents().stream()
            .map(KakaoLocalClientResponse.Document::toQueryResult)
            .toList();
    }

    private java.net.URI buildUri(UriBuilder uriBuilder, NearbyDiningQuery query, boolean byKeyword) {
        uriBuilder.path(byKeyword ? KEYWORD_PATH : CATEGORY_PATH)
            // 카카오는 x=경도, y=위도다. 관광 API 의 mapx/mapy 와 같은 함정이라 여기서만 맞춰 준다.
            .queryParam("x", query.lng())
            .queryParam("y", query.lat())
            .queryParam("radius", query.radius())
            .queryParam("size", query.size())
            .queryParam("sort", "distance");

        if (byKeyword) {
            uriBuilder.queryParam("query", query.keyword());
            // 키워드 검색에서도 종류를 좁혀 "애견동반"만 검색했을 때 잡화점이 섞이지 않게 한다.
            uriBuilder.queryParam("category_group_code", query.diningType().getCategoryGroupCode());
        } else {
            uriBuilder.queryParam("category_group_code", query.diningType().getCategoryGroupCode());
        }
        return uriBuilder.build();
    }

    /**
     * 서킷이 열렸거나 카카오가 응답하지 않을 때. 빈 목록으로 조용히 넘기지 않는다 —
     * "주변에 식당이 없다"와 "지금 검색이 안 된다"는 사용자에게 전혀 다른 의미다.
     */
    @SuppressWarnings("unused")
    private List<NearbyDiningQueryResult> searchNearbyFallback(NearbyDiningQuery query, Throwable throwable) {
        if (throwable instanceof DiningException diningException) {
            throw diningException;
        }
        if (throwable instanceof CallNotPermittedException) {
            log.warn("kakao local circuit open. lat={} lng={}", query.lat(), query.lng());
            throw new DiningException(DiningErrorCode.NEARBY_SEARCH_UNAVAILABLE, throwable);
        }
        if (throwable instanceof WebClientResponseException responseException) {
            log.error("kakao local call failed status={} body={}",
                responseException.getStatusCode(), responseException.getResponseBodyAsString());
            throw new DiningException(DiningErrorCode.NEARBY_SEARCH_UNAVAILABLE, throwable);
        }
        log.error("kakao local call failed reason={}", throwable.getMessage(), throwable);
        throw new DiningException(DiningErrorCode.NEARBY_SEARCH_UNAVAILABLE, throwable);
    }
}
