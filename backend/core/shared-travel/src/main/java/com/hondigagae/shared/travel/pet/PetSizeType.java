package com.hondigagae.shared.travel.pet;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 반려견 크기 구분. 장소의 동반 가능 조건(소형견만 허용 등)과 대조하는 데 쓰인다.
 *
 * <p>경계(10kg / 25kg)의 단일 출처가 이 enum 이다. 설명 문자열과 화면 안내문에만 있던 경계를
 * {@link #fromWeight} 로 코드에 세웠다 — 체중과 크기가 어긋난 반려견(30kg 소형견)이 저장되면
 * 적합도 판정이 "소형견만 가능" 장소를 동반 가능으로 읽는다 (#364).
 */
@Getter
@RequiredArgsConstructor
public enum PetSizeType implements CodeNameDescribable {

    SMALL("소형견", "체중 10kg 미만"),
    MEDIUM("중형견", "체중 10kg 이상 25kg 미만"),
    LARGE("대형견", "체중 25kg 이상");

    private static final BigDecimal MEDIUM_MIN_KG = BigDecimal.valueOf(10);
    private static final BigDecimal LARGE_MIN_KG = BigDecimal.valueOf(25);

    private final String displayName;
    private final String description;

    /**
     * 체중이 속하는 크기 구분. 체중을 모르면(null) 판정하지 않고 null 을 돌려준다 —
     * 체중은 선택 입력이라, 없는 값으로 크기를 지어내면 안 된다.
     */
    public static PetSizeType fromWeight(BigDecimal weightKg) {
        if (weightKg == null) {
            return null;
        }
        if (weightKg.compareTo(MEDIUM_MIN_KG) < 0) {
            return SMALL;
        }
        return weightKg.compareTo(LARGE_MIN_KG) < 0 ? MEDIUM : LARGE;
    }

    /** 이 크기 구분이 그 체중과 어긋나지 않는지. 체중이 없으면 어긋남을 판정할 수 없어 참이다. */
    public boolean matchesWeight(BigDecimal weightKg) {
        PetSizeType derived = fromWeight(weightKg);
        return derived == null || derived == this;
    }
}
