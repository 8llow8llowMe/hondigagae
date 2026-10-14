package com.hondigagae.domainlayer.placeimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.placeimport.application.model.PetAllowanceReflectOutcome;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceOverrideCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlacePetAllowanceCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlacePetAllowanceEvidenceQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceOverride;
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

    /** 생각하는 정원(125445) 근처. 위도 0.00025° ≈ 28m, 0.00052° ≈ 58m (prod 실측 거리). */
    private static final double PARENT_LAT = 33.3195;
    private static final double PARENT_LNG = 126.2390;

    private static final List<String> EVIDENCE = List.of("사용성 테스트 2026-10-13 (#1434)");

    private final PlacePetAllowanceCommandPort port = mock(PlacePetAllowanceCommandPort.class);
    // 기본은 보정 없음(빈 목록) — 보정과의 관계는 아래 #1434 테스트가 본다
    private final PlaceOverrideCatalogPort overrideCatalogPort = mock(PlaceOverrideCatalogPort.class);
    private final PlacePetAllowanceReflectProcessor processor = new PlacePetAllowanceReflectProcessor(port, overrideCatalogPort);

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

    @Test
    @DisplayName("하위 시설은 본 시설의 결과까지 근거로 삼는다 — 생각하는 정원 면세점 · 청원 (#1340)")
    void subFacilityInheritsParentRestriction() {
        when(port.findTourApiEvidences()).thenReturn(List.of(
            // 본 시설: 자기 동반 정보 전구역 + 흡수된 문화정보원 행 "야외만" → 일부. 크기는 소형만
            located(125445L, "생각하는 정원", PARENT_LAT, PARENT_LNG, "UNKNOWN", "UNKNOWN", false,
                "FULL_AREA", "ALL", List.of("PARTIALLY_ALLOWED"), List.of("SMALL_ONLY")),
            // 면세점(28m): 자기 근거는 전구역뿐 → 본 시설 따라 일부. 크기 제한은 상속하지 않는다
            located(4054291L, "생각하는 정원[면세점(TAX REFUND SHOP)]", PARENT_LAT + 0.00025, PARENT_LNG, "UNKNOWN", "UNKNOWN", false,
                "FULL_AREA", "ALL", List.of(), List.of()),
            // 청원(58m): 근거 없음 → 본 시설 따라 일부
            located(2907434L, "생각하는정원(청원)", PARENT_LAT + 0.00052, PARENT_LNG, "UNKNOWN", "UNKNOWN", false,
                null, null, List.of(), List.of())));
        when(port.updatePetAllowances(anyList())).thenAnswer(invocation -> ((List<?>) invocation.getArgument(0)).size());

        PetAllowanceReflectOutcome outcome = processor.reflectPetAllowances();

        ArgumentCaptor<List<ReflectedPetAllowance>> written = listCaptor();
        verify(port).updatePetAllowances(written.capture());
        assertThat(written.getValue()).containsExactly(
            new ReflectedPetAllowance(125445L, PetAllowanceType.PARTIALLY_ALLOWED, AllowedPetSize.SMALL_ONLY),
            new ReflectedPetAllowance(4054291L, PetAllowanceType.PARTIALLY_ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(2907434L, PetAllowanceType.PARTIALLY_ALLOWED, AllowedPetSize.UNKNOWN));
        assertThat(written.getValue()).extracting(ReflectedPetAllowance::petAvailable).containsOnly(true);
        assertThat(outcome.countOf(PetAllowanceType.PARTIALLY_ALLOWED)).isEqualTo(3);
        assertThat(outcome.inherited()).isEqualTo(2);
    }

    @Test
    @DisplayName("상속은 본 시설 → 하위 시설 한 방향이다 — 하위가 더 제한적이어도 본 시설은 그대로, 본 시설이 UNKNOWN 이면 하위도 그대로 (#1340)")
    void inheritsOnlyFromParentToChild() {
        when(port.findTourApiEvidences()).thenReturn(List.of(
            // 역방향: 하위가 동반 불가여도 본 시설은 자기 근거대로 가능
            located(10L, "용머리해안", PARENT_LAT, PARENT_LNG, "UNKNOWN", "UNKNOWN", false, "FULL_AREA", "ALL", List.of(), List.of()),
            located(11L, "용머리해안(매표소)", PARENT_LAT + 0.0002, PARENT_LNG, "UNKNOWN", "UNKNOWN", false, null, null, List.of("NOT_ALLOWED"), List.of()),
            // 본 시설 UNKNOWN — 하위 결과에 영향이 없다
            located(20L, "산방산", 33.24, 126.31, "UNKNOWN", "UNKNOWN", false, null, null, List.of(), List.of()),
            located(21L, "산방산(카페)", 33.2401, 126.31, "UNKNOWN", "UNKNOWN", false, "FULL_AREA", "ALL", List.of(), List.of()),
            // 반경 밖(약 550m) — 괄호가 지역 표기인 다른 곳일 수 있어 상속하지 않는다
            located(30L, "성산일출봉", 33.46, 126.94, "UNKNOWN", "UNKNOWN", false, "PARTIAL", "ALL", List.of(), List.of()),
            located(31L, "성산일출봉(제주)", 33.465, 126.94, "UNKNOWN", "UNKNOWN", false, "FULL_AREA", "ALL", List.of(), List.of()),
            // 좌표 없는 하위 행은 판정하지 않는다
            located(40L, "비자림", 33.49, 126.81, "UNKNOWN", "UNKNOWN", false, "PARTIAL", "ALL", List.of(), List.of()),
            located(41L, "비자림(매점)", null, null, "UNKNOWN", "UNKNOWN", false, "FULL_AREA", "ALL", List.of(), List.of()),
            // 본 시설 후보가 둘이면 더 제한적인 쪽
            located(50L, "한림공원", 33.39, 126.24, "UNKNOWN", "UNKNOWN", false, "PARTIAL", "ALL", List.of(), List.of()),
            located(51L, "한림공원", 33.3901, 126.24, "UNKNOWN", "UNKNOWN", false, null, null, List.of("NOT_ALLOWED"), List.of()),
            located(52L, "한림공원(매표소)", 33.3902, 126.24, "UNKNOWN", "UNKNOWN", false, "FULL_AREA", "ALL", List.of(), List.of()),
            // 본 시설 ALLOWED 는 물려주지 않는다 — 근거 없는 실내 매장이 "동반 가능" 으로 보이면 #1340 과 같은 오해다
            located(60L, "섭지코지", 33.42, 126.93, "UNKNOWN", "UNKNOWN", false, "FULL_AREA", "ALL", List.of(), List.of()),
            located(61L, "섭지코지(카페)", 33.4201, 126.93, "UNKNOWN", "UNKNOWN", false, null, null, List.of(), List.of())));
        when(port.updatePetAllowances(anyList())).thenAnswer(invocation -> ((List<?>) invocation.getArgument(0)).size());

        PetAllowanceReflectOutcome outcome = processor.reflectPetAllowances();

        ArgumentCaptor<List<ReflectedPetAllowance>> written = listCaptor();
        verify(port).updatePetAllowances(written.capture());
        assertThat(written.getValue()).containsExactly(
            new ReflectedPetAllowance(10L, PetAllowanceType.ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(11L, PetAllowanceType.NOT_ALLOWED, AllowedPetSize.UNKNOWN),
            new ReflectedPetAllowance(21L, PetAllowanceType.ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(30L, PetAllowanceType.PARTIALLY_ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(31L, PetAllowanceType.ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(40L, PetAllowanceType.PARTIALLY_ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(41L, PetAllowanceType.ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(50L, PetAllowanceType.PARTIALLY_ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(51L, PetAllowanceType.NOT_ALLOWED, AllowedPetSize.UNKNOWN),
            new ReflectedPetAllowance(52L, PetAllowanceType.NOT_ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(60L, PetAllowanceType.ALLOWED, AllowedPetSize.ALL));
        assertThat(outcome.countOf(PetAllowanceType.UNKNOWN)).isEqualTo(2);   // 20 · 61
        assertThat(outcome.inherited()).isEqualTo(1);
    }

    @Test
    @DisplayName("상속까지 반영된 상태면 다시 돌려도 쓰지 않는다 (#1340)")
    void writesNothingWhenInheritanceAlreadyReflected() {
        when(port.findTourApiEvidences()).thenReturn(List.of(
            located(125445L, "생각하는 정원", PARENT_LAT, PARENT_LNG, "PARTIALLY_ALLOWED", "ALL", true,
                "FULL_AREA", "ALL", List.of("PARTIALLY_ALLOWED"), List.of()),
            located(4054291L, "생각하는 정원[면세점(TAX REFUND SHOP)]", PARENT_LAT + 0.00025, PARENT_LNG, "PARTIALLY_ALLOWED", "ALL", true,
                "FULL_AREA", "ALL", List.of(), List.of())));

        PetAllowanceReflectOutcome outcome = processor.reflectPetAllowances();

        verify(port, never()).updatePetAllowances(anyList());
        assertThat(outcome.changed()).isZero();
        // 상속은 매 실행 다시 판정하므로 쓰지 않아도 센다 — 지금 몇 곳이 본 시설 값을 받고 있는지다
        assertThat(outcome.inherited()).isEqualTo(1);
    }

    @Test
    @DisplayName("동반 구분 보정이 걸린 행은 읽은 근거에서 걸러 낸다 — 쓰지 않고 대상 수에도 넣지 않는다. 판정은 id · 정확한 제목이다 (#1434)")
    void filtersRowsWhosePetAllowanceIsOverridden() {
        when(overrideCatalogPort.readOverrides()).thenReturn(List.of(
            new PlaceOverride(126455L, "한림공원", false, true, null, "야외 정원", EVIDENCE),
            new PlaceOverride(2907285L, "다이소 제주연동점", null, null, PetAllowanceType.UNKNOWN, "원천끼리 어긋난다", EVIDENCE),
            new PlaceOverride(4026812L, "다이소 서귀포중문점", null, null, PetAllowanceType.UNKNOWN, "원천끼리 어긋난다", EVIDENCE),
            new PlaceOverride(4026821L, "다이소 제주노형점", null, null, PetAllowanceType.UNKNOWN, "원천끼리 어긋난다", EVIDENCE)));
        when(port.findTourApiEvidences()).thenReturn(List.of(
            // 제목까지 맞는 보정 행 — 원천은 전구역이지만 재계산하지 않는다(이미 보정 값이라도, 아니라도)
            evidence(2907285L, "다이소 제주연동점", "ALLOWED", "ALL", true, "FULL_AREA", "ALL"),
            // 뒤 공백이 다르다 — 보정 스텝이 건너뛰므로 재계산도 빼지 않는다(MySQL 콜레이션이면 같다고 봤을 행)
            evidence(4026812L, "다이소 서귀포중문점 ", "UNKNOWN", "UNKNOWN", false, "FULL_AREA", "ALL"),
            // id 가 다른 장소를 가리키게 됐다 — 마찬가지로 재계산한다
            evidence(4026821L, "올리브영 노형점", "UNKNOWN", "UNKNOWN", false, "FULL_AREA", "ALL"),
            // 실내외만 보정한 행 — 동반 칸은 재계산 몫이다
            evidence(126455L, "한림공원", "UNKNOWN", "UNKNOWN", false, "PARTIAL", "ALL")));
        when(port.updatePetAllowances(anyList())).thenAnswer(invocation -> ((List<?>) invocation.getArgument(0)).size());

        PetAllowanceReflectOutcome outcome = processor.reflectPetAllowances();

        ArgumentCaptor<List<ReflectedPetAllowance>> written = listCaptor();
        verify(port).updatePetAllowances(written.capture());
        assertThat(written.getValue()).containsExactly(
            new ReflectedPetAllowance(4026812L, PetAllowanceType.ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(4026821L, PetAllowanceType.ALLOWED, AllowedPetSize.ALL),
            new ReflectedPetAllowance(126455L, PetAllowanceType.PARTIALLY_ALLOWED, AllowedPetSize.ALL));
        assertThat(outcome.targets()).isEqualTo(3);
        assertThat(outcome.changed()).isEqualTo(3);
    }

    @Test
    @DisplayName("걸러 낸 행은 본 시설 후보도 아니다 — 보정한 본 시설의 원천 제한이 하위 시설로 번지지 않는다 (#1434)")
    void overriddenRowIsNotParentCandidate() {
        when(overrideCatalogPort.readOverrides()).thenReturn(List.of(
            new PlaceOverride(2907285L, "다이소 제주연동점", null, null, PetAllowanceType.UNKNOWN, "원천끼리 어긋난다", EVIDENCE)));
        when(port.findTourApiEvidences()).thenReturn(List.of(
            // 본 시설: 원천 근거는 일부구역 — 걸러지지 않았다면 하위 시설이 PARTIALLY_ALLOWED 를 받았다
            located(2907285L, "다이소 제주연동점", PARENT_LAT, PARENT_LNG, "UNKNOWN", "UNKNOWN", false, "PARTIAL", "ALL", List.of(), List.of()),
            located(2907286L, "다이소 제주연동점(주차장)", PARENT_LAT + 0.00025, PARENT_LNG, "UNKNOWN", "UNKNOWN", false,
                "FULL_AREA", "ALL", List.of(), List.of())));
        when(port.updatePetAllowances(anyList())).thenAnswer(invocation -> ((List<?>) invocation.getArgument(0)).size());

        PetAllowanceReflectOutcome outcome = processor.reflectPetAllowances();

        ArgumentCaptor<List<ReflectedPetAllowance>> written = listCaptor();
        verify(port).updatePetAllowances(written.capture());
        assertThat(written.getValue()).containsExactly(new ReflectedPetAllowance(2907286L, PetAllowanceType.ALLOWED, AllowedPetSize.ALL));
        assertThat(outcome.inherited()).isZero();
    }

    @Test
    @DisplayName("걸러 낸 행만 남으면 쓰기 포트를 부르지 않는다 — 보정이 들어간 뒤 재계산은 그 행으로 changed 가 늘지 않는다 (#1434)")
    void writesNothingForOverriddenRowsOnly() {
        when(overrideCatalogPort.readOverrides()).thenReturn(List.of(
            new PlaceOverride(2907285L, "다이소 제주연동점", null, null, PetAllowanceType.UNKNOWN, "원천끼리 어긋난다", EVIDENCE)));
        when(port.findTourApiEvidences()).thenReturn(List.of(evidence(2907285L, "다이소 제주연동점", "UNKNOWN", "UNKNOWN", false, "FULL_AREA", "ALL")));

        PetAllowanceReflectOutcome outcome = processor.reflectPetAllowances();

        verify(port, never()).updatePetAllowances(anyList());
        assertThat(outcome.targets()).isZero();
        assertThat(outcome.changed()).isZero();
    }

    @Test
    @DisplayName("보정 파일이 깨지면 재계산도 PLACE_IMPORT_024 로 실패한다 — 보정된 행을 원천 값으로 되돌리지 않는다 (#1434)")
    void failsWhenOverrideFileIsInvalid() {
        when(overrideCatalogPort.readOverrides()).thenThrow(new PlaceImportException(PlaceImportErrorCode.PLACE_OVERRIDE_INVALID, "reason 이 비었다"));

        assertThatThrownBy(processor::reflectPetAllowances)
            .isInstanceOf(PlaceImportException.class)
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(PlaceImportErrorCode.PLACE_OVERRIDE_INVALID);
        verifyNoInteractions(port);
    }

    private static PlacePetAllowanceEvidenceQueryResult evidence(
        long placeId, String currentAllowance, String currentSize, boolean currentPetAvailable, String petInfoScope, String petInfoSize,
        List<String> absorbedAllowances, List<String> absorbedSizes
    ) {
        return located(placeId, "place-" + placeId, null, null, currentAllowance, currentSize, currentPetAvailable, petInfoScope, petInfoSize,
            absorbedAllowances, absorbedSizes);
    }

    /** 제목이 있는 근거 — 동반 정보만 있고 흡수 행 · 좌표는 없다 (#1434 보정 판정용). */
    private static PlacePetAllowanceEvidenceQueryResult evidence(
        long placeId, String title, String currentAllowance, String currentSize, boolean currentPetAvailable, String petInfoScope, String petInfoSize
    ) {
        return located(placeId, title, null, null, currentAllowance, currentSize, currentPetAvailable, petInfoScope, petInfoSize, List.of(), List.of());
    }

    private static PlacePetAllowanceEvidenceQueryResult located(
        long placeId, String title, Double lat, Double lng, String currentAllowance, String currentSize, boolean currentPetAvailable,
        String petInfoScope, String petInfoSize, List<String> absorbedAllowances, List<String> absorbedSizes
    ) {
        return new PlacePetAllowanceEvidenceQueryResult(placeId, title, lat, lng, currentAllowance, currentSize, currentPetAvailable,
            petInfoScope, petInfoSize, absorbedAllowances, absorbedSizes);
    }

    private static ArgumentCaptor<List<ReflectedPetAllowance>> listCaptor() {
        return ArgumentCaptor.captor();
    }
}
