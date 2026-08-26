package com.hondigagae.domainlayer.placeimport.adapter.out.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.GeocodingPort;
import com.hondigagae.domainlayer.placeimport.domain.model.Coordinate;
import com.hondigagae.global.properties.VworldProperties;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * VWorld 지오코더 어댑터.
 *
 * <p>제주 등록 업소 102건을 실제로 돌려 검증했다 — 102/102 성공, 좌표 중복 0건(도로 중심점으로
 * 뭉개지지 않고 건물 단위로 떨어진다). 문화정보원이 자체 좌표를 가진 업소와 대조하면 38m 차이다.
 *
 * <p>주소는 <b>정제하지 않고 원문 그대로</b> 넘긴다. 식약처 주소에 붙는 "(1층)", "(B동)",
 * "(2층 색달동)" 같은 꼬리를 떼지 않아도 전부 통과한다. 섣불리 괄호를 지우면 동을 구분하는
 * 정보까지 날아가 오히려 정확도가 떨어진다.
 *
 * <p>도로명으로 못 찾으면 지번으로 한 번 더 시도한다. 실패는 예외가 아니라 빈 값이다 —
 * 한 건 때문에 배치를 세우지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VworldGeocodingAdapter implements GeocodingPort {

    private static final String GEOCODE_PATH = "/req/address";
    private static final String STATUS_OK = "OK";
    private static final String TYPE_ROAD = "road";
    private static final String TYPE_PARCEL = "parcel";

    private final WebClient openApiWebClient;
    private final ObjectMapper objectMapper;
    private final VworldProperties vworldProperties;

    @Override
    public Optional<Coordinate> geocode(String address) {
        if (vworldProperties.apiKey() == null || vworldProperties.apiKey().isBlank()) {
            throw new PlaceImportException(PlaceImportErrorCode.GEOCODING_KEY_MISSING);
        }
        if (address == null || address.isBlank()) {
            return Optional.empty();
        }

        Optional<Coordinate> byRoad = request(address, TYPE_ROAD);
        if (byRoad.isPresent()) {
            return byRoad;
        }
        return request(address, TYPE_PARCEL);
    }

    private Optional<Coordinate> request(String address, String type) {
        String rawBody;
        try {
            rawBody = openApiWebClient.get()
                .uri(buildUri(address, type))
                .retrieve()
                .bodyToMono(String.class)
                .block(Duration.ofMillis(vworldProperties.readTimeoutMs()));
        } catch (RuntimeException exception) {
            log.warn("vworld geocode call failed type={} address={} reason={}",
                type, address, exception.getMessage());
            return Optional.empty();
        }

        if (rawBody == null || rawBody.isBlank()) {
            return Optional.empty();
        }

        try {
            JsonNode response = objectMapper.readTree(rawBody).path("response");
            if (!STATUS_OK.equals(response.path("status").asText())) {
                return Optional.empty();
            }
            JsonNode point = response.path("result").path("point");
            String x = point.path("x").asText(null);
            String y = point.path("y").asText(null);
            if (x == null || y == null) {
                return Optional.empty();
            }
            // VWorld 도 x=경도, y=위도다. 뒤집으면 좌표가 통째로 엉뚱한 곳으로 간다.
            return Optional.of(new Coordinate(new BigDecimal(y), new BigDecimal(x)));
        } catch (Exception exception) {
            log.warn("vworld geocode parse failed type={} address={}", type, address, exception);
            return Optional.empty();
        }
    }

    private URI buildUri(String address, String type) {
        return URI.create(vworldProperties.baseUrl() + GEOCODE_PATH
            + "?service=address"
            + "&request=getcoord"
            + "&version=2.0"
            + "&crs=epsg:4326"
            + "&refine=true"
            + "&simple=false"
            + "&format=json"
            + "&type=" + type
            + "&address=" + URLEncoder.encode(address, StandardCharsets.UTF_8)
            + "&key=" + URLEncoder.encode(vworldProperties.apiKey(), StandardCharsets.UTF_8));
    }
}
