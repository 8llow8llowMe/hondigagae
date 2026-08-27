package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import lombok.Builder;

/**
 * 판정에 쓰는 장소 조건 (domain model).
 *
 * <p>{@code indoor} / {@code outdoor} 가 Wrapper 인 것이 중요하다. 식약처 원천은 실내외를
 * 알려 주지 않아 <b>null 이 실제로 존재하는 상태</b>이고, 그것을 false 로 뭉개면
 * "실외 전용"이라고 잘못 말하게 된다 (place-data-integration.md §6-3).
 *
 * <p>{@code lat} / {@code lng} 도 같은 이유로 Wrapper 다. 좌표가 없는 장소가 실제로 있고,
 * 그런 곳은 격자를 구할 수 없어 날씨를 붙일 수 없다. 0 으로 채우면 적도 앞바다의 날씨를
 * 가져오게 된다 - 조용히 틀리는 쪽이 훨씬 나쁘다 (coding-conventions §9-3 의 nullable 기준).
 */
@Builder
public record PlaceCondition(
    long placeId,
    String title,
    Double lat,
    Double lng,
    PetAllowanceType petAllowanceType,
    AllowedPetSize allowedPetSize,
    Boolean indoor,
    Boolean outdoor,
    String petRestriction,
    String petExtraFee
) {

    /** 좌표가 있는지. 없으면 날씨 기반 판정 자체가 불가능하다. */
    public boolean hasCoordinate() {
        return lat != null && lng != null;
    }

    /** 비를 피할 곳이 있는지. 확인된 실내만 true 다 - 정보 없음은 피난처가 아니다. */
    public boolean hasIndoorShelter() {
        return Boolean.TRUE.equals(indoor);
    }

    /** 날씨를 그대로 맞는 곳인지. 실외가 확인됐거나, 실내가 확인되지 않은 경우다. */
    public boolean isWeatherExposed() {
        return Boolean.TRUE.equals(outdoor) || !hasIndoorShelter();
    }

    public boolean hasExtraFee() {
        return petExtraFee != null && !petExtraFee.isBlank();
    }
}
