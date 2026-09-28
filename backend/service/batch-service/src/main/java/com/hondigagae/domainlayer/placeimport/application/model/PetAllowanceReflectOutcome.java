package com.hondigagae.domainlayer.placeimport.application.model;

import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;

/**
 * 동반 가능 여부 재계산 결과 (#886).
 *
 * @param targets        대상(TourAPI 노출) 장소 수
 * @param changed        값이 바뀌어 실제로 갱신한 행 수. 입력이 같으면 두 번째 실행부터 0 이다
 * @param distribution   재계산 뒤 대상 전체의 동반 구분 분포. 네 값 모두 키가 있다(0 포함)
 * @param sizeRestricted 재계산 뒤 크기 제한(SMALL_ONLY · SMALL_MEDIUM)이 걸린 대상 수
 */
public record PetAllowanceReflectOutcome(int targets, int changed, Map<PetAllowanceType, Integer> distribution, int sizeRestricted) {

    public PetAllowanceReflectOutcome {
        Map<PetAllowanceType, Integer> filled = new EnumMap<>(PetAllowanceType.class);
        for (PetAllowanceType type : PetAllowanceType.values()) {
            filled.put(type, distribution == null ? 0 : distribution.getOrDefault(type, 0));
        }
        distribution = Collections.unmodifiableMap(filled);
    }

    public int countOf(PetAllowanceType type) {
        return distribution.get(type);
    }
}
