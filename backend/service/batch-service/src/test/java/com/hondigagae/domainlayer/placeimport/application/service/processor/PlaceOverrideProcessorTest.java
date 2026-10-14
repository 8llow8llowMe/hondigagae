package com.hondigagae.domainlayer.placeimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.placeimport.application.model.PlaceOverrideOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceOverrideCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceOverrideCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceOverrideTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.OverridablePlace;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceOverride;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.Collection;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * 장소 보정 적용 (#1434) — 제목이 같을 때만, 바뀔 것이 있을 때만 쓴다.
 */
class PlaceOverrideProcessorTest {

    private static final List<String> EVIDENCE = List.of("사용성 테스트 2026-10-13 (#1434)");

    private final PlaceOverrideCatalogPort catalogPort = mock(PlaceOverrideCatalogPort.class);
    private final PlaceOverrideCommandPort commandPort = mock(PlaceOverrideCommandPort.class);
    private final PlaceOverrideProcessor processor = new PlaceOverrideProcessor(catalogPort, commandPort);

    @Test
    @DisplayName("제목이 같은 행만 바꾸고, 없는 id · 제목이 다른 행은 건너뛴다")
    void appliesOnlyToRowsWithExpectedTitle() {
        PlaceOverride hallim = new PlaceOverride(126455L, "한림공원", false, true, null, "야외 정원", EVIDENCE);
        PlaceOverride daiso = new PlaceOverride(2907285L, "다이소 제주연동점", null, null, PetAllowanceType.UNKNOWN, "원천끼리 어긋난다", EVIDENCE);
        PlaceOverride missing = new PlaceOverride(9L, "없는 장소", false, null, null, "근거", EVIDENCE);
        PlaceOverride renamed = new PlaceOverride(4026812L, "다이소 서귀포중문점", null, null, PetAllowanceType.UNKNOWN, "근거", EVIDENCE);
        when(catalogPort.readOverrides()).thenReturn(List.of(hallim, daiso, missing, renamed));
        when(commandPort.findTargets(any())).thenReturn(List.of(
            target(126455L, "한림공원", true, true, "ALLOWED", "ALL", true),
            target(2907285L, "다이소 제주연동점", null, null, "ALLOWED", "ALL", true),
            // id 가 다른 장소를 가리키게 됐다 — 고치지 않는다
            target(4026812L, "올리브영 중문점", null, null, "ALLOWED", "ALL", true)));
        when(commandPort.applyOverrides(anyList())).thenAnswer(invocation -> ((List<?>) invocation.getArgument(0)).size());

        PlaceOverrideOutcome outcome = processor.applyOverrides();

        ArgumentCaptor<Collection<Long>> queried = collectionCaptor();
        verify(commandPort).findTargets(queried.capture());
        assertThat(queried.getValue()).containsExactlyInAnyOrder(126455L, 2907285L, 9L, 4026812L);
        // 지금 값에 보정을 얹은 다섯 칸을 그대로 쓴다 — 적지 않은 칸은 지금 값, 동반 UNKNOWN 이면 크기도 UNKNOWN
        ArgumentCaptor<List<OverridablePlace>> written = listCaptor();
        verify(commandPort).applyOverrides(written.capture());
        assertThat(written.getValue()).containsExactly(
            new OverridablePlace(126455L, "한림공원", false, true, "ALLOWED", "ALL", true),
            new OverridablePlace(2907285L, "다이소 제주연동점", null, null, "UNKNOWN", "UNKNOWN", false));
        assertThat(outcome).isEqualTo(new PlaceOverrideOutcome(4, 2, 2, 1, 1));
    }

    @Test
    @DisplayName("이미 그 값이면 적용으로 세되 쓰지 않는다 — 다시 돌려도 바뀌는 행이 없다")
    void doesNotWriteWhenAlreadySatisfied() {
        when(catalogPort.readOverrides()).thenReturn(List.of(
            new PlaceOverride(126455L, "한림공원", false, true, null, "야외 정원", EVIDENCE),
            new PlaceOverride(2907285L, "다이소 제주연동점", null, null, PetAllowanceType.UNKNOWN, "원천끼리 어긋난다", EVIDENCE)));
        when(commandPort.findTargets(any())).thenReturn(List.of(
            target(126455L, "한림공원", false, true, "ALLOWED", "ALL", true),
            target(2907285L, "다이소 제주연동점", null, null, "UNKNOWN", "UNKNOWN", false)));

        PlaceOverrideOutcome outcome = processor.applyOverrides();

        verify(commandPort, never()).applyOverrides(anyList());
        assertThat(outcome).isEqualTo(new PlaceOverrideOutcome(2, 2, 0, 0, 0));
    }

    @Test
    @DisplayName("동반 구분이 같아도 pet_available · 크기 제한이 어긋나 있으면 쓴다")
    void writesWhenOnlyDerivedColumnsDiffer() {
        PlaceOverride daiso = new PlaceOverride(2907285L, "다이소 제주연동점", null, null, PetAllowanceType.UNKNOWN, "원천끼리 어긋난다", EVIDENCE);
        when(catalogPort.readOverrides()).thenReturn(List.of(daiso));
        // 지난 보정 뒤 크기만 이력의 ALL 로 남은 상태 — #1434 첫 판(크기 규칙 없음)이 남긴 모양이다
        when(commandPort.findTargets(any())).thenReturn(List.of(target(2907285L, "다이소 제주연동점", null, null, "UNKNOWN", "ALL", true)));
        when(commandPort.applyOverrides(anyList())).thenReturn(1);

        PlaceOverrideOutcome outcome = processor.applyOverrides();

        verify(commandPort).applyOverrides(List.of(new OverridablePlace(2907285L, "다이소 제주연동점", null, null, "UNKNOWN", "UNKNOWN", false)));
        assertThat(outcome.changed()).isEqualTo(1);
    }

    @Test
    @DisplayName("보정 항목이 없으면 DB 를 읽지도 쓰지도 않는다")
    void doesNothingWithoutEntries() {
        when(catalogPort.readOverrides()).thenReturn(List.of());

        PlaceOverrideOutcome outcome = processor.applyOverrides();

        verifyNoInteractions(commandPort);
        assertThat(outcome).isEqualTo(new PlaceOverrideOutcome(0, 0, 0, 0, 0));
    }

    private static PlaceOverrideTargetQueryResult target(
        long placeId, String title, Boolean indoor, Boolean outdoor, String allowance, String size, boolean petAvailable
    ) {
        return new PlaceOverrideTargetQueryResult(placeId, "TOUR_API", title, indoor, outdoor, allowance, size, petAvailable);
    }

    private static ArgumentCaptor<List<OverridablePlace>> listCaptor() {
        return ArgumentCaptor.captor();
    }

    private static ArgumentCaptor<Collection<Long>> collectionCaptor() {
        return ArgumentCaptor.captor();
    }
}
