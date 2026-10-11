package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * TourAPI 장소의 {@code place.pet_allowance_type} · {@code allowed_pet_size} · {@code pet_available} 을 근거에서 다시 계산하는 규칙 (#886).
 *
 * <p>근거는 둘이다 — 반려동물 동반여행 API 가 준 {@code place_pet_info}, 그리고 병합으로 이 행에 흡수된 행들
 * ({@code merged_into_id = 이 행}). 근거마다 값을 뽑아 <b>가장 제한적인 값</b>을 고른다. "전 구역 가능" 을 믿고 갔다가
 * 못 들어가는 쪽이 "일부만" 이라 했는데 실제로 다 되는 쪽보다 사용자에게 더 나쁘기 때문이다.
 *
 * <p><b>UNKNOWN 은 근거가 아니다.</b> 모든 근거가 UNKNOWN 이거나 근거가 없으면 결과가 UNKNOWN 이다. 특히
 * {@code place_pet_info} 가 없다는 것을 NOT_ALLOWED 로 읽지 않는다 — 동반여행 목록에 없다는 것은 "모른다" 이지
 * "안 된다" 가 아니다.
 *
 * <p>하위 시설(본 시설 이름 + 괄호 수식어, 100m 안)은 본 시설 결과 중 제한만 근거로 더 받는다 — {@link #withParentRestriction} (#1340).
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
            // scope 이름의 정본은 PetFieldParser 다 — tour-service PetAllowanceScope 를 batch 가 모르므로 이름으로 맞춘다
            case PetFieldParser.SCOPE_FULL_AREA -> PetAllowanceType.ALLOWED;
            case PetFieldParser.SCOPE_PARTIAL, PetFieldParser.SCOPE_OUTDOOR_ONLY -> PetAllowanceType.PARTIALLY_ALLOWED;
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

    /**
     * 하위 시설의 동반 구분에 본 시설의 제한을 얹는다 (#1340). 본 시설 판정은 {@code PlaceIdentityPolicy.isSubFacilityOf}.
     *
     * <p>본 시설 결과 중 <b>제한(PARTIALLY_ALLOWED · NOT_ALLOWED)만</b> 근거로 더하고 가장 제한적인 값을 고른다. 본 시설이
     * "야외만" 인데 그 안 매장이 자기 근거("전 구역")로 ALLOWED 로 보이던 것({@code 생각하는 정원[면세점]})을 막는다.
     * 자기 근거가 없는 하위 시설도 본 시설 제한을 받는다({@code 생각하는정원(청원)} → PARTIALLY_ALLOWED).
     *
     * <p><b>본 시설의 ALLOWED 는 물려주지 않는다.</b> 근거 없는 실내 매장이 본 시설 덕에 "동반 가능" 으로 보이면 이 이슈와 같은
     * 오해가 반대 경로로 생긴다. UNKNOWN 은 원래 근거가 아니다. 그래서 상속은 근거 있는 구분을 좁히기만 한다.
     * 자기 근거가 없는(UNKNOWN) 하위 시설은 본 시설 제한으로 PARTIALLY_ALLOWED 가 되어 {@code pet_available} 이 true 가 된다
     * (data-refresh-guide.md §10).
     *
     * @param own     하위 시설 자기 근거(동반 정보 · 흡수 행)로 낸 결과
     * @param parents 본 시설 후보들의 자기 근거 결과. 후보가 여럿이면 모두 본다
     */
    public static PetAllowanceType withParentRestriction(PetAllowanceType own, Collection<PetAllowanceType> parents) {
        List<PetAllowanceType> evidences = new ArrayList<>();
        evidences.add(own);
        parents.stream().filter(PetAllowancePolicy::isRestriction).forEach(evidences::add);
        return mostRestrictiveAllowance(evidences);
    }

    private static boolean isRestriction(PetAllowanceType allowance) {
        return allowance == PetAllowanceType.PARTIALLY_ALLOWED || allowance == PetAllowanceType.NOT_ALLOWED;
    }

    /**
     * 동반 구분에서 {@code place.pet_available} 을 정한다. ALLOWED · PARTIALLY_ALLOWED 면 true, NOT_ALLOWED · UNKNOWN 이면 false.
     *
     * <p>TourAPI 행의 {@code pet_available} 은 적재가 INSERT 리터럴 false 로만 넣는다. 재계산이 이 칸을 같이 쓰지 않으면 비 오는 날
     * 실내 대안({@code petAvailable = true} 조건)이 동반이 확인된 TourAPI 장소를 계속 못 고르고, 상세 응답에 {@code petAvailable=false}
     * 와 {@code ALLOWED} 가 함께 나간다.
     */
    public static boolean petAvailableOf(PetAllowanceType allowance) {
        return allowance == PetAllowanceType.ALLOWED || allowance == PetAllowanceType.PARTIALLY_ALLOWED;
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
