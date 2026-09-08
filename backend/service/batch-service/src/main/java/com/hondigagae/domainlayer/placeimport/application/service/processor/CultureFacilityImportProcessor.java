package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.port.out.CultureFacilityCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceBulkPort;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedCultureFacility;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 문화정보원 문화시설 적재.
 *
 * <p>파일 하나를 통째로 읽어 upsert 한다. 제주 기준 1,191행 중 여행 대상은 171행 수준이라
 * 페이지 분할 없이 한 번에 처리해도 메모리 부담이 없다. 전국으로 넓히면 시도 단위로 나눠 호출한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CultureFacilityImportProcessor {

    private final CultureFacilityCatalogPort cultureFacilityCatalogPort;
    private final PlaceBulkPort placeBulkPort;

    public int importFacilities(String sido) {
        List<ImportedCultureFacility> facilities = cultureFacilityCatalogPort.readTravelFacilities(sido);
        if (facilities.isEmpty()) {
            log.warn("culture facility import found nothing sido={}", sido);
            return 0;
        }

        placeBulkPort.upsertCultureFacilities(facilities);

        // 영업시간 구조화 커버리지를 남긴다 (긴급 시설 적재와 같은 결). withWeeklyHoursSpec 이 0 이면
        // 컬럼만 있고 값이 없는 상태라 장소 상세의 openNow 가 전부 "모름"으로 내려간다 — #301 이 그랬다.
        // 재적재 로그에서 바로 드러나야 API 를 전수 조회해 보기 전에 잡을 수 있다.
        long withUseTime = facilities.stream().filter(facility -> facility.useTime() != null).count();
        long withWeeklyHoursSpec = facilities.stream().filter(facility -> facility.weeklyHoursSpec() != null).count();
        long open24 = facilities.stream().filter(ImportedCultureFacility::open24).count();
        log.info("culture facility import done sido={} upserted={} withUseTime={} withWeeklyHoursSpec={} open24={}",
            sido, facilities.size(), withUseTime, withWeeklyHoursSpec, open24);
        return facilities.size();
    }
}
