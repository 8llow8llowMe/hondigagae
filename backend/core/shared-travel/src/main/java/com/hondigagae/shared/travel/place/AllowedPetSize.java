package com.hondigagae.shared.travel.place;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import com.hondigagae.shared.travel.pet.PetSizeType;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 동반 가능 반려견 크기 (acmpyPsblCpam 원문 가공).
 *
 * <p>장소가 받아 주는 크기이고, {@link PetSizeType} 은 실제 반려견의 크기다. 둘을 맞대 보는
 * 판정을 {@link #allows(PetSizeType)} 한곳에 모은다 - 이 비교가 여러 서비스에 흩어지면
 * "소형견만 가능"을 어디서는 중형견까지 통과시키는 일이 생긴다.
 */
@Getter
@RequiredArgsConstructor
public enum AllowedPetSize implements CodeNameDescribable {

    ALL("전 견종 가능", "견종/크기 제한 없이 동반이 가능합니다."),
    SMALL_ONLY("소형견만 가능", "소형견만 동반이 가능합니다."),
    SMALL_MEDIUM("중소형견 가능", "소형견과 중형견까지 동반이 가능합니다."),
    UNKNOWN("정보 없음", "동반 가능 크기 정보가 확인되지 않았습니다.");

    private final String displayName;
    private final String description;

    /**
     * 이 장소가 해당 크기의 반려견을 받아 주는지.
     *
     * <p><b>UNKNOWN 은 true 로 본다.</b> 정보가 없는 것을 "불가"로 단정하면 실제로는 갈 수 있는
     * 장소가 검색에서 사라진다. 문화정보원 원천에서 크기 정보가 없는 곳이 58곳이라 실제로 흔한
     * 상태다. 판단은 사용자에게 남기고, 응답에는 정보 없음임을 드러낸다.
     */
    public boolean allows(PetSizeType petSizeType) {
        if (petSizeType == null || this == UNKNOWN) {
            return true;
        }
        return switch (this) {
            case ALL -> true;
            case SMALL_MEDIUM -> petSizeType != PetSizeType.LARGE;
            case SMALL_ONLY -> petSizeType == PetSizeType.SMALL;
            case UNKNOWN -> true;
        };
    }

    /** 크기 제한이 실제로 걸려 있는지. 정보 없음은 제한이 아니다. */
    public boolean hasRestriction() {
        return this == SMALL_ONLY || this == SMALL_MEDIUM;
    }
}
