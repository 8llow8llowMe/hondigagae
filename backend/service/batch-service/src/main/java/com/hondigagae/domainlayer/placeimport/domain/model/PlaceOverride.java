package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.List;

/**
 * 근거를 적은 장소 보정 한 건 (#1434). 원천끼리 어긋나거나 원천이 화면에 틀린 말을 하게 하는 장소를 사람이 고친 값이다.
 *
 * <p><b>적은 칸만 바꾼다.</b> {@code indoor} · {@code outdoor} · {@code petAllowanceType} 중 null 인 칸은 건드리지 않는다. 그래서 칸을
 * "모름(NULL)" 으로 되돌리는 보정은 이 모양으로 표현하지 못한다. {@code petAllowanceType} 을 바꾸면 두 칸이 따라온다({@link #applyTo}).
 * <ul>
 *   <li>{@code pet_available} — {@link PetAllowancePolicy#petAvailableOf}. 어긋나면 상세에 {@code petAvailable=false} 와 {@code ALLOWED} 가 함께 나간다.</li>
 *   <li>{@code allowed_pet_size} — {@code UNKNOWN} · {@code NOT_ALLOWED} 로 바꾸면 {@code UNKNOWN}. 동반이 안 되거나 모르는 곳에 크기 제한이 남으면
 *       {@code allowedPetSize=ALL} 필터에 잡힌다. 재계산은 보정 행을 쓰지 않으므로 그대로 두면 이력의 값에서 멈춘다.</li>
 * </ul>
 *
 * <p><b>적용 판정은 여기 한 곳이다</b> — {@link #appliesTo}(id 와 제목이 정확히 같다)와 {@link #overridesPetAllowance}. 보정 스텝
 * ({@code PlaceOverrideProcessor})과 동반 재계산({@code PlacePetAllowanceReflectProcessor})이 둘 다 이 판정을 쓴다. 제목 대조를 SQL 에
 * 맡기면 MySQL 콜레이션(대소문자 · 뒤 공백 무시)과 {@link String#equals} 가 갈라져, 한쪽은 적용하고 다른 쪽은 빼지 않는 행이 생긴다.
 *
 * <p>잘못된 항목은 만들어지지 않는다 — {@code reason} · {@code evidence} 가 비었거나 바꿀 칸이 없으면 {@code PLACE_OVERRIDE_INVALID}.
 * 근거 없는 보정은 원천보다 믿을 이유가 없다.
 *
 * @param placeId          {@code place.id}
 * @param expectedTitle    적용 조건 — {@code place.title} 과 정확히 같아야 한다
 * @param indoor           바꿀 실내 여부. null 이면 그대로
 * @param outdoor          바꿀 실외 여부. null 이면 그대로
 * @param petAllowanceType 바꿀 동반 구분. null 이면 그대로
 * @param reason           원천 값과 다르게 두는 이유
 * @param evidence         근거(원천 · 날짜). 하나 이상
 */
public record PlaceOverride(
    long placeId, String expectedTitle, Boolean indoor, Boolean outdoor, PetAllowanceType petAllowanceType, String reason, List<String> evidence
) {

    public PlaceOverride {
        if (placeId <= 0) {
            throw invalid(placeId, "placeId 가 양수가 아니다");
        }
        if (isBlank(expectedTitle)) {
            throw invalid(placeId, "expectedTitle 이 비었다");
        }
        if (indoor == null && outdoor == null && petAllowanceType == null) {
            throw invalid(placeId, "바꿀 칸(indoor · outdoor · petAllowanceType)이 하나도 없다");
        }
        if (isBlank(reason)) {
            throw invalid(placeId, "reason 이 비었다");
        }
        if (evidence == null || evidence.isEmpty() || evidence.stream().anyMatch(PlaceOverride::isBlank)) {
            throw invalid(placeId, "evidence 가 비었거나 빈 줄이 있다");
        }
        evidence = List.copyOf(evidence);
    }

    /**
     * 이 보정이 그 행에 적용되는지 — id 가 같고 제목이 <b>정확히</b> 같다(대소문자 · 공백 포함). 다르면 id 가 다른 장소를 가리키게 된 것으로 보고
     * 고치지 않는다.
     */
    public boolean appliesTo(long targetPlaceId, String targetTitle) {
        return placeId == targetPlaceId && expectedTitle.equals(targetTitle);
    }

    /** 동반 구분을 보정하는지. 그렇다면 그 행의 동반 세 칸은 재계산이 아니라 이 보정이 소유한다. */
    public boolean overridesPetAllowance() {
        return petAllowanceType != null;
    }

    /** 바꿀 {@code pet_available}. 동반 구분을 적지 않았으면 null(그대로). */
    public Boolean petAvailable() {
        return petAllowanceType == null ? null : PetAllowancePolicy.petAvailableOf(petAllowanceType);
    }

    /**
     * 지금 값에 이 보정을 얹은 결과. 적지 않은 칸은 지금 값 그대로다. 결과가 지금 값과 같으면 쓸 것이 없다.
     *
     * <p>{@link #appliesTo} 를 통과한 행에만 부른다 — 판정은 호출하는 쪽이 먼저 한다.
     */
    public OverridablePlace applyTo(OverridablePlace current) {
        boolean resetsSize = petAllowanceType == PetAllowanceType.UNKNOWN || petAllowanceType == PetAllowanceType.NOT_ALLOWED;
        return new OverridablePlace(current.placeId(), current.title(),
            indoor != null ? indoor : current.indoor(),
            outdoor != null ? outdoor : current.outdoor(),
            petAllowanceType != null ? petAllowanceType.name() : current.petAllowanceType(),
            resetsSize ? AllowedPetSize.UNKNOWN.name() : current.allowedPetSize(),
            petAllowanceType != null ? PetAllowancePolicy.petAvailableOf(petAllowanceType) : current.petAvailable());
    }

    private static PlaceImportException invalid(long placeId, String detail) {
        return new PlaceImportException(PlaceImportErrorCode.PLACE_OVERRIDE_INVALID, "placeId=" + placeId + ": " + detail);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
