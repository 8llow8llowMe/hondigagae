package com.hondigagae.domainlayer.placeimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.placeimport.application.model.PetAllowanceReflectOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlacePetAllowanceCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlacePetAllowanceEvidenceQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ReflectedPetAllowance;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * 동반 가능 여부 재계산 프로세서 (#886) — 근거 조합별 결과와 "바뀐 행만 쓴다".
 */
class PlacePetAllowanceReflectProcessorTest {

    private final PlacePetAllowanceCommandPort port = mock(PlacePetAllowanceCommandPort.class);
    private final PlacePetAllowanceReflectProcessor processor = new PlacePetAllowanceReflectProcessor(port);

    @Test
    @DisplayName("근거 조합마다 가장 제한적인 값을 쓰고, 바뀐 행만 갱신한다")
    void reflectsEachEvidenceCombination() {
        when(port.findTourApiEvidences()).thenReturn(List.of(
            // 1: 동반 정보만 — 전구역 · 크기 제한 없음
            evidence(1L, "UNKNOWN", "UNKNOWN", false, "FULL_AREA", "ALL", List.of(), List.of()),
            // 2: 흡수 행만 — 문화정보원이 동반 불가로 확인
            evidence(2L, "UNKNOWN", "UNKNOWN", false, null, null, List.of("NOT_ALLOWED"), List.of("UNKNOWN")),
            // 3: 둘이 다르다 — 흡수 행 ALLOWED ↔ 동반 정보 일부구역 → 일부. 크기도 제한적인 쪽
            evidence(3L, "UNKNOWN", "UNKNOWN", false, "PARTIAL", "SMALL_MEDIUM", List.of("ALLOWED"), List.of("SMALL_ONLY")),
            // 4: 두 근거 모두 UNKNOWN → UNKNOWN (이미 UNKNOWN 이라 쓰지 않는다)
            evidence(4L, "UNKNOWN", "UNKNOWN", false, "UNKNOWN", "UNKNOWN", List.of("UNKNOWN"), List.of("UNKNOWN")),
            // 5: 근거가 사라졌다 — 지난 실행의 ALLOWED 가 UNKNOWN 으로 돌아간다
            evidence(5L, "ALLOWED", "SMALL_ONLY", true, null, null, List.of(), List.of()),
            // 6: 이미 맞는 값 — 쓰지 않는다
            evidence(6L, "ALLOWED", "ALL", true, "FULL_AREA", "ALL", List.of(), List.of()),
            // 8: 동반 구분 · 크기는 맞는데 pet_available 만 false(적재 리터럴) — 이것도 바뀐 행이다
            evidence(8L, "ALLOWED", "ALL", false, "FULL_AREA", "ALL", List.of(), List.of())));
        when(port.updatePetAllowances(anyList())).thenAnswer(invocation -> ((List<?>) invocation.getArgument(0)).size());

        PetAllowanceReflectOutcome outcome = processor.reflectPetAllowances();

        ArgumentCaptor<List<ReflectedPetAllowance>> written = listCaptor();
        verify(port).updatePetAllowances(written.capture());
        assertThat(written.getValue()).containsExactly(
            new ReflectedPetAllowance(1L, PetAllowanceType.ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(2L, PetAllowanceType.NOT_ALLOWED, AllowedPetSize.UNKNOWN),
            new ReflectedPetAllowance(3L, PetAllowanceType.PARTIALLY_ALLOWED, AllowedPetSize.SMALL_ONLY),
            new ReflectedPetAllowance(5L, PetAllowanceType.UNKNOWN, AllowedPetSize.UNKNOWN),
            new ReflectedPetAllowance(8L, PetAllowanceType.ALLOWED, AllowedPetSize.ALL));
        assertThat(written.getValue()).extracting(ReflectedPetAllowance::petAvailable).containsExactly(true, false, true, false, true);

        assertThat(outcome.targets()).isEqualTo(7);
        assertThat(outcome.changed()).isEqualTo(5);
        assertThat(outcome.countOf(PetAllowanceType.ALLOWED)).isEqualTo(3);
        assertThat(outcome.countOf(PetAllowanceType.PARTIALLY_ALLOWED)).isEqualTo(1);
        assertThat(outcome.countOf(PetAllowanceType.NOT_ALLOWED)).isEqualTo(1);
        assertThat(outcome.countOf(PetAllowanceType.UNKNOWN)).isEqualTo(2);
        assertThat(outcome.sizeRestricted()).isEqualTo(1);
    }

    @Test
    @DisplayName("바뀔 것이 없으면 쓰기 포트를 부르지 않는다 — 두 번째 실행은 0행이다")
    void writesNothingWhenAlreadyReflected() {
        when(port.findTourApiEvidences()).thenReturn(List.of(
            evidence(6L, "ALLOWED", "ALL", true, "FULL_AREA", "ALL", List.of(), List.of()),
            evidence(7L, "UNKNOWN", "UNKNOWN", false, null, null, List.of(), List.of())));

        PetAllowanceReflectOutcome outcome = processor.reflectPetAllowances();

        verify(port, never()).updatePetAllowances(anyList());
        assertThat(outcome.changed()).isZero();
        assertThat(outcome.targets()).isEqualTo(2);
    }

    private static PlacePetAllowanceEvidenceQueryResult evidence(
        long placeId, String currentAllowance, String currentSize, boolean currentPetAvailable, String petInfoScope, String petInfoSize,
        List<String> absorbedAllowances, List<String> absorbedSizes
    ) {
        return new PlacePetAllowanceEvidenceQueryResult(placeId, currentAllowance, currentSize, currentPetAvailable, petInfoScope, petInfoSize,
            absorbedAllowances, absorbedSizes);
    }

    private static ArgumentCaptor<List<ReflectedPetAllowance>> listCaptor() {
        return ArgumentCaptor.captor();
    }
}
