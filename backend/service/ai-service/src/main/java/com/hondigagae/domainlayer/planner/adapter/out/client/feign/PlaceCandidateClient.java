package com.hondigagae.domainlayer.planner.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * tour-service 장소 검색 클라이언트.
 *
 * <p>서비스명을 하드코딩하지 않고 프로퍼티 참조 + local 기본값 폴백으로 선언한다.
 * Eureka 등록명은 환경별 접미사가 붙으므로 하드코딩하면 dev/prod 에서 503 이 난다
 * (coding-conventions §10).
 */
@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "placeCandidateClient"
)
public interface PlaceCandidateClient {

    /**
     * @param sigunguCode null 이면 Feign 이 쿼리에서 아예 뺀다 — tour-service 쪽 선택 파라미터라
     *                    빈 문자열을 보내면 "빈 시군구" 로 걸러질 위험이 있다
     * @param indoor null 이면 실내 여부를 가리지 않는다. true 면 실내만
     * @param sourceCategory null 이면 분류를 가리지 않는다. 카페는 {@code 카페}
     * @param contentType null 이면 콘텐츠 타입을 가리지 않는다. 숙박은 {@code LODGING} (#1236)
     * @param lat 기준 위도. {@code lng} 와 함께 주면 그 점에서 가까운 순이고, 둘 다 null 이면 {@code placeId} 순이다 (#1312).
     *            하나만 주면 tour-service 가 400(PLACE_109)을 낸다
     * @param lng 기준 경도
     * @param petSizeType 동행견 중 가장 큰 크기({@code PetSizeType} 이름). 받아 주지 않는 것으로 확인된 곳을 뺀다 —
     *                    정보 없음인 곳은 남는다. null 이면 크기로 거르지 않는다 (#1420)
     * @param petWeightKg 동행견 중 가장 무거운 유효 체중의 올림(kg, 1~100). 상한이 그보다 낮은 곳을 뺀다. null 이면 체중으로 거르지 않는다 (#1420).
     *                    거리순({@code lat} · {@code lng})이어도 같은 필터가 걸린다
     */
    @GetMapping("/api/v1/places")
    Response<PlaceSliceClientResponse> searchPlaces(
        @RequestParam("areaCode") String areaCode,
        @RequestParam(value = "sigunguCode", required = false) String sigunguCode,
        @RequestParam("petAllowanceType") String petAllowanceType,
        @RequestParam("size") int size,
        @RequestParam(value = "indoor", required = false) Boolean indoor,
        @RequestParam(value = "sourceCategory", required = false) String sourceCategory,
        @RequestParam(value = "contentType", required = false) String contentType,
        @RequestParam(value = "lat", required = false) Double lat,
        @RequestParam(value = "lng", required = false) Double lng,
        @RequestParam(value = "petSizeType", required = false) String petSizeType,
        @RequestParam(value = "petWeightKg", required = false) Integer petWeightKg
    );
}
