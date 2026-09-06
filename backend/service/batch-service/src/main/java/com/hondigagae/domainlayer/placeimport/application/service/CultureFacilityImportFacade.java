package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.port.in.CultureFacilityImportUseCase;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImportMetricsPort;
import com.hondigagae.domainlayer.placeimport.application.service.processor.DelistProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.EmergencyFacilityImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.CultureFacilityImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceMergeProcessor;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceImportResultType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.enums.RegionCodeMapping;
import java.time.Instant;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 문화정보원 문화시설 적재 오케스트레이터.
 *
 * <p>여행 시설 적재 → 중복 병합 → 긴급 시설(동물병원·동물약국) 적재를 잇달아 수행한다.
 * 병합은 적재 뒤에 해야 새로 들어온 행까지 판정 대상이 된다.
 *
 * <p>{@code @Transactional}을 붙이지 않는 이유는 {@code PlaceImportFacade} 와 같다 —
 * 파일 파싱과 대량 upsert 를 한 트랜잭션으로 묶으면 커넥션을 오래 잡는다. 재실행이 멱등이라
 * 중간에 실패하면 잡을 다시 돌리면 된다.
 */
@Service
@RequiredArgsConstructor
public class CultureFacilityImportFacade implements CultureFacilityImportUseCase {

    private final CultureFacilityImportProcessor cultureFacilityImportProcessor;
    private final EmergencyFacilityImportProcessor emergencyFacilityImportProcessor;
    private final PlaceMergeProcessor placeMergeProcessor;
    private final DelistProcessor delistProcessor;
    private final PlaceImportMetricsPort placeImportMetricsPort;

    @Override
    public int importFacilities(String sido) {
        // 병합 범위는 적재 범위와 반드시 같아야 한다. 예전에는 제주 코드를 상수로 박아 둬서,
        // 다른 시도로 잡을 돌리면 그 지역을 적재해 놓고 제주만 병합하는 조용한 어긋남이 났다.
        String areaCode = resolveAreaCode(sido);

        LocalDateTime runStartedAt = LocalDateTime.now();
        int imported = cultureFacilityImportProcessor.importFacilities(sido);
        int delisted = delistProcessor.delistPlaces(PlaceSourceType.CULTURE_PORTAL, areaCode, runStartedAt, imported);
        placeMergeProcessor.mergeDuplicates(areaCode);
        // 같은 파일에 동물병원·동물약국이 함께 들어 있어 한 번 읽는 김에 같이 적재한다.
        int facilities = emergencyFacilityImportProcessor.importFacilities(sido);
        delistProcessor.delistEmergencyFacilities(runStartedAt, facilities);

        // 긴급 시설 건수는 place 지표에 섞지 않는다 — place_import_rows 는 장소 마스터 기준이고,
        // 긴급 시설은 급감 가드 + 경고 로그가 별도로 지킨다.
        placeImportMetricsPort.recordRows(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.UPSERTED, imported);
        placeImportMetricsPort.recordRows(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.DELISTED, delisted);
        if (imported > 0) {
            // 신선도는 실제로 데이터가 들어온 실행만 갱신한다 (PlaceImportFacade 와 같은 이유)
            placeImportMetricsPort.recordLastSuccess(PlaceSourceType.CULTURE_PORTAL, Instant.now());
        }
        return imported;
    }

    /**
     * 시도 명칭을 관광 지역코드로 옮긴다. 원천은 명칭으로 주고 place 테이블은 코드 체계라
     * 여기서 맞춰야 한다.
     *
     * <p>매핑에 없는 시도면 <b>적재를 시작하기 전에 실패시킨다.</b> 그대로 진행하면 병합
     * 범위가 비어 중복이 남거나, 예전처럼 엉뚱한 지역을 병합하게 된다.
     * 지금 채워진 것은 제주뿐이다 - 검증되지 않은 전국 매핑을 미리 넣지 않는다는 방침이다
     * ({@link RegionCodeMapping}).
     */
    private String resolveAreaCode(String sido) {
        String areaCode = RegionCodeMapping.toAreaCode(sido);
        if (areaCode == null) {
            throw new PlaceImportException(PlaceImportErrorCode.REGION_NOT_SUPPORTED, sido);
        }
        return areaCode;
    }
}
