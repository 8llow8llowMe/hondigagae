package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.port.out.CultureFacilityCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.EmergencyFacilityBulkPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.EmergencyFacilityTypeCode;
import com.hondigagae.domainlayer.placeimport.domain.model.EmergencyFacilityDeduplicator;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedEmergencyFacility;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 긴급 시설(동물병원·동물약국) 적재. 긴급 상황 도우미가 쓰는 데이터다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmergencyFacilityImportProcessor {

    private final CultureFacilityCatalogPort cultureFacilityCatalogPort;
    private final EmergencyFacilityBulkPort emergencyFacilityBulkPort;

    public int importFacilities(Path csvFile, String sido) {
        List<ImportedEmergencyFacility> rows = cultureFacilityCatalogPort.readEmergencyFacilities(csvFile, sido);
        if (rows.isEmpty()) {
            log.warn("emergency facility import found nothing sido={}", sido);
            return 0;
        }

        /*
         * 원천이 같은 시설을 표기만 달리해 여러 행으로 넣는다 (#569). sourceKey 는 이름·주소 표기가
         * 조금만 달라도 갈려서 DB 의 upsert 만으로는 안 접히고, 그대로 목록에 같은 병원이 두 번 뜬다.
         * 무엇을 같은 시설로 볼지는 도메인 규칙이라 여기서 정하지 않고 정본에 맡긴다.
         */
        EmergencyFacilityDeduplicator.Result deduplicated = EmergencyFacilityDeduplicator.fold(rows);
        List<ImportedEmergencyFacility> facilities = deduplicated.facilities();
        if (!deduplicated.mergedNotes().isEmpty()) {
            // 무엇이 접혔는지 남긴다 — 원천 품질이 나빠지면 이 줄이 먼저 길어진다
            log.info("emergency facility duplicates folded sido={} count={} merged={}",
                sido, deduplicated.mergedNotes().size(), deduplicated.mergedNotes());
        }

        emergencyFacilityBulkPort.upsertAll(facilities);

        // 종류별 건수와 24시간 운영 수를 남긴다. 원천 품질이 흔들리면 여기서 먼저 드러난다.
        Map<EmergencyFacilityTypeCode, Long> byType = facilities.stream()
            .collect(Collectors.groupingBy(ImportedEmergencyFacility::facilityType, Collectors.counting()));
        Map<EmergencyFacilityTypeCode, Long> open24ByType = facilities.stream()
            .filter(ImportedEmergencyFacility::open24)
            .collect(Collectors.groupingBy(ImportedEmergencyFacility::facilityType, Collectors.counting()));
        long withHours = facilities.stream().filter(f -> f.operatingHours() != null).count();

        log.info(
            "emergency facility import done sido={} sourceRows={} facilities={} byType={} open24ByType={} "
                + "withOperatingHours={}",
            sido, rows.size(), facilities.size(), byType, open24ByType, withHours);

        /*
         * **접은 뒤의 건수를 돌려준다.** 이 값은 delist 급감 가드(`DelistGuard`)의 `importedCount` 가 된다.
         * 예전에는 접기 전 원천 행 수(제주 841)가 넘어가 활성 건수(214)의 몇 배라 가드가 늘 통과했다 —
         * 원천이 절반으로 잘려 와도 못 잡았다는 뜻이다. 이제 실제 적재 대상 수라 가드가 제 일을 한다.
         */
        return facilities.size();
    }

}
