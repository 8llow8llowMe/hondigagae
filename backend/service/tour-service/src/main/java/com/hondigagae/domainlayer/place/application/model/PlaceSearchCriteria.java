package com.hondigagae.domainlayer.place.application.model;

import com.hondigagae.domainlayer.place.application.exception.PlaceErrorCode;
import com.hondigagae.domainlayer.place.application.exception.PlaceException;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import lombok.Builder;

/**
 * 장소 목록 조회 조건. filter + cursor + size 가 함께 움직이므로 Criteria 로 묶는다.
 *
 * <p>기준 좌표({@code lat}·{@code lng})가 있으면 거리순, 없으면 {@code placeId} 오름차순이다 (#1202).
 * 커서는 어느 쪽이든 {@code lastPlaceId} 하나다 — 거리순에서는 그 장소의 좌표로 거리 키를 되살린다.
 */
@Builder(toBuilder = true)
public record PlaceSearchCriteria(
    String areaCode,
    String sigunguCode,
    ContentType contentType,
    PetAllowanceType petAllowanceType,
    // 비 오는 날 실내 대안을 고를 때 쓴다. null 이면 실내외를 가리지 않는다.
    Boolean indoor,
    AllowedPetSize allowedPetSize,
    // 내 반려견 크기. 받아 주지 않는 것으로 확인된 장소만 뺀다 — 정보 없음(UNKNOWN)은 남긴다.
    PetSizeType petSizeType,
    // 내 반려견 체중(kg). 체중 상한이 명시된 장소("12kg 미만")를 정확히 거른다.
    Integer petWeightKg,
    // 원본 분류로 거른다. contentTypeId 39 에 음식점과 카페가 섞여 있어 이 값이 필요하다.
    String sourceCategory,
    // 장소명·주소 부분 일치. 공백/빈 값은 필터 없음이다.
    String keyword,
    // 기준 좌표(WGS84). 둘 다 있으면 이 점에서 가까운 순이다. 하나만 있는 조건은 만들 수 없다.
    Double lat,
    Double lng,
    Long lastPlaceId,
    int size
) {

    /**
     * 좌표는 둘이 함께 와야 뜻이 있다. 하나만 온 조건을 조용히 id 순으로 떨어뜨리면 클라이언트는 좌표를 빠뜨린 줄
     * 모르고 id 순 목록을 "가까운 순" 이라고 그린다. 그래서 조건을 만드는 자리에서 거절한다 — 컨트롤러가 조립할 때
     * 걸리므로 유스케이스까지 내려가지 않는다.
     */
    public PlaceSearchCriteria {
        if ((lat == null) != (lng == null)) {
            throw new PlaceException(PlaceErrorCode.COORDINATE_PAIR_REQUIRED);
        }
    }

    /** 기준 좌표가 있으면 거리순 목록이다. 생성자가 짝을 보장하므로 한쪽만 보면 된다. */
    public boolean hasOrigin() {
        return lat != null;
    }
}
