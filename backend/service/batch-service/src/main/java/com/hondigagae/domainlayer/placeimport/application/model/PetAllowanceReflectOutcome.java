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
 * @param inherited      본 시설의 제한을 물려받아 자기 근거만으로 낸 값보다 좁아진 하위 시설 수 (#1340). 쓰기 여부와 무관하게
 *                       이번 실행에서 상속이 적용된 행 전부를 센다 — 두 번째 실행에서도 같은 값이다
 */
public record PetAllowanceReflectOutcome(
    int targets, int changed, Map<PetAllowanceType, Integer> distribution, int sizeRestricted, int inherited
) {

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
