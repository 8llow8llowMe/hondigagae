package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.Collection;
import java.util.List;

/**
 * TourAPI 장소의 {@code place.pet_allowance_type} · {@code allowed_pet_size} 를 근거에서 다시 계산하는 규칙 (#886).
 *
 * <p>근거는 둘이다 — 반려동물 동반여행 API 가 준 {@code place_pet_info}, 그리고 병합으로 이 행에 흡수된 행들
 * ({@code merged_into_id = 이 행}). 근거마다 값을 뽑아 <b>가장 제한적인 값</b>을 고른다. "전 구역 가능" 을 믿고 갔다가
 * 못 들어가는 쪽이 "일부만" 이라 했는데 실제로 다 되는 쪽보다 사용자에게 더 나쁘기 때문이다.
 *
 * <p><b>UNKNOWN 은 근거가 아니다.</b> 모든 근거가 UNKNOWN 이거나 근거가 없으면 결과가 UNKNOWN 이다. 특히
 * {@code place_pet_info} 가 없다는 것을 NOT_ALLOWED 로 읽지 않는다 — 동반여행 목록에 없다는 것은 "모른다" 이지
 * "안 된다" 가 아니다.
 *
 * <p>설계: {@code docs/superpowers/specs/2026-09-28-pet-allowance-reflect-design.md} §2.
 */
public final class PetAllowancePolicy {

    /** 제한이 강한 순. 앞에 있을수록 이긴다. */
    private static final List<PetAllowanceType> ALLOWANCE_RESTRICTIVENESS =
        List.of(PetAllowanceType.NOT_ALLOWED, PetAllowanceType.PARTIALLY_ALLOWED, PetAllowanceType.ALLOWED);

    /** 제한이 강한 순. 앞에 있을수록 이긴다. */
    private static final List<AllowedPetSize> SIZE_RESTRICTIVENESS =
        List.of(AllowedPetSize.SMALL_ONLY, AllowedPetSize.SMALL_MEDIUM, AllowedPetSize.ALL);

    /** tour-service {@code PetAllowanceScope} 의 이름들. batch 는 그 enum 을 모르므로 이름으로 맞춘다. */
    private static final String SCOPE_FULL_AREA = "FULL_AREA";
    private static final String SCOPE_PARTIAL = "PARTIAL";
    private static final String SCOPE_OUTDOOR_ONLY = "OUTDOOR_ONLY";

    private PetAllowancePolicy() {
    }

    /**
     * {@code place_pet_info.allowance_scope} 를 동반 구분 근거로 옮긴다.
     *
     * <p>FULL_AREA → ALLOWED, PARTIAL · OUTDOOR_ONLY → PARTIALLY_ALLOWED. 그 밖(UNKNOWN · null · 모르는 값)은
     * UNKNOWN — 근거가 아니다. 실외만 되는 곳은 들어갈 수 있는 구역이 있으니 "불가" 가 아니라 "일부" 다.
     */
    public static PetAllowanceType allowanceOfScope(String allowanceScope) {
        if (allowanceScope == null) {
            return PetAllowanceType.UNKNOWN;
        }
        return switch (allowanceScope.trim()) {
            case SCOPE_FULL_AREA -> PetAllowanceType.ALLOWED;
            case SCOPE_PARTIAL, SCOPE_OUTDOOR_ONLY -> PetAllowanceType.PARTIALLY_ALLOWED;
            default -> PetAllowanceType.UNKNOWN;
        };
    }

    /** 근거들 중 가장 제한적인 동반 구분. UNKNOWN · null 은 건너뛰고, 남는 것이 없으면 UNKNOWN. */
    public static PetAllowanceType mostRestrictiveAllowance(Collection<PetAllowanceType> evidences) {
        for (PetAllowanceType candidate : ALLOWANCE_RESTRICTIVENESS) {
            if (evidences.contains(candidate)) {
                return candidate;
            }
        }
        return PetAllowanceType.UNKNOWN;
    }

    /** 근거들 중 가장 제한적인 크기 제한. UNKNOWN · null 은 건너뛰고, 남는 것이 없으면 UNKNOWN. */
    public static AllowedPetSize mostRestrictiveSize(Collection<AllowedPetSize> evidences) {
        for (AllowedPetSize candidate : SIZE_RESTRICTIVENESS) {
            if (evidences.contains(candidate)) {
                return candidate;
            }
        }
        return AllowedPetSize.UNKNOWN;
    }

    /**
     * 컬럼 문자열을 동반 구분으로 읽는다. 모르는 값 · null 은 UNKNOWN(근거 아님)으로 본다.
     *
     * <p>잘못된 값 하나로 잡 전체를 실패시키지 않는다 — 그 행만 근거에서 빠진다.
     */
    public static PetAllowanceType parseAllowance(String value) {
        if (value == null) {
            return PetAllowanceType.UNKNOWN;
        }
        for (PetAllowanceType type : PetAllowanceType.values()) {
            if (type.name().equals(value.trim())) {
                return type;
            }
        }
        return PetAllowanceType.UNKNOWN;
    }

    /** 컬럼 문자열을 크기 제한으로 읽는다. 모르는 값 · null 은 UNKNOWN(근거 아님)으로 본다. */
    public static AllowedPetSize parseSize(String value) {
        if (value == null) {
            return AllowedPetSize.UNKNOWN;
        }
        for (AllowedPetSize size : AllowedPetSize.values()) {
            if (size.name().equals(value.trim())) {
                return size;
            }
        }
        return AllowedPetSize.UNKNOWN;
    }
}
