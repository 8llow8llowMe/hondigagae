package com.hondigagae.domainlayer.placeimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.hondigagae.domainlayer.placeimport.application.port.out.CultureFacilityCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.EmergencyFacilityBulkPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.EmergencyFacilityTypeCode;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedEmergencyFacility;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceIdFactory;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 접기가 <b>실제로 적재 경로에 걸려 있는지</b> 잠근다 (#569).
 *
 * <p>{@code EmergencyFacilityDeduplicator} 단위 테스트만으로는 누군가 프로세서에서
 * {@code upsertAll(rows)} 로 되돌리거나 {@code return rows.size()} 로 되돌려도 빌드가 초록이다.
 *
 * <p><b>반환값이 특히 중요하다.</b> 이 값은 {@code CultureFacilityImportFacade} 를 거쳐
 * {@code DelistGuard.allows(importedCount, activeCount)} 로 가고, 통과하면
 * {@code UPDATE emergency_facility SET delisted_at = NOW() WHERE synced_at < ?} 라는 파괴적 쿼리가 열린다.
 * 접기 전 원천 행 수를 돌려주면 활성 건수의 몇 배라 가드가 늘 통과해, <b>원천이 반토막 나도 못 잡는다.</b>
 */
@ExtendWith(MockitoExtension.class)
class EmergencyFacilityImportProcessorTest {

    private static final Path CSV = Path.of("pet_culture.csv");
    private static final String SIDO = "제주특별자치도";
    private static final BigDecimal LAT = new BigDecimal("33.4935");
    private static final BigDecimal LNG = new BigDecimal("126.4885");

    @Mock
    private CultureFacilityCatalogPort cultureFacilityCatalogPort;
    @Mock
    private EmergencyFacilityBulkPort emergencyFacilityBulkPort;
    @InjectMocks
    private EmergencyFacilityImportProcessor processor;

    @Captor
    private ArgumentCaptor<List<ImportedEmergencyFacility>> upsertedCaptor;

    private static ImportedEmergencyFacility facility(String name, String addr) {
        return ImportedEmergencyFacility.builder()
            .sourceKey(PlaceIdFactory.sourceKeyOf(name, addr))
            .facilityType(EmergencyFacilityTypeCode.ANIMAL_HOSPITAL)
            .name(name)
            .addr(addr)
            .lat(LAT)
            .lng(LNG)
            .tel("064-749-7585")
            .operatingHours("매일 00:00~24:00")
            .build();
    }

    /** dev 실측 쌍 — 이름의 공백 한 칸만 다르다. */
    private static List<ImportedEmergencyFacility> duplicatedRows() {
        return List.of(
            facility("24시똑똑똑 동물메디컬센터", "제주특별자치도 제주시 도령로 129"),
            facility("24시똑똑똑동물메디컬센터", "제주특별자치도 제주시 도령로 129"),
            facility("한림동물병원", "제주특별자치도 제주시 한림읍 한림로 12"));
    }

    @Test
    @DisplayName("접은 목록을 적재한다 — 원천 행을 그대로 넘기지 않는다")
    void upsertsFoldedRows() {
        given(cultureFacilityCatalogPort.readEmergencyFacilities(CSV, SIDO)).willReturn(duplicatedRows());

        processor.importFacilities(CSV, SIDO);

        verify(emergencyFacilityBulkPort).upsertAll(upsertedCaptor.capture());
        assertThat(upsertedCaptor.getValue()).hasSize(2);
    }

    @Test
    @DisplayName("접은 뒤 건수를 돌려준다 — 이 값이 delist 급감 가드의 기준이 된다")
    void returnsFoldedCount() {
        given(cultureFacilityCatalogPort.readEmergencyFacilities(CSV, SIDO)).willReturn(duplicatedRows());

        // 원천 3행 중 2행이 같은 시설이다. 3 을 돌려주면 가드가 실제보다 후하게 본다
        assertThat(processor.importFacilities(CSV, SIDO)).isEqualTo(2);
    }

    @Test
    @DisplayName("원천이 비면 적재도 delist 도 열지 않는다")
    void doesNothingWhenSourceIsEmpty() {
        given(cultureFacilityCatalogPort.readEmergencyFacilities(CSV, SIDO)).willReturn(List.of());

        assertThat(processor.importFacilities(CSV, SIDO)).isZero();
        verify(emergencyFacilityBulkPort, org.mockito.Mockito.never()).upsertAll(any());
    }
}
