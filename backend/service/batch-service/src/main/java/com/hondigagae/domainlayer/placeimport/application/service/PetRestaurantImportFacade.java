package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.in.PetRestaurantImportUseCase;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImportMetricsPort;
import com.hondigagae.domainlayer.placeimport.application.service.processor.DelistProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PetRestaurantImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceMergeProcessor;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceImportResultType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.enums.RegionCodeMapping;
import java.time.Instant;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 식약처 음식점 적재 오케스트레이터.
 *
 * <p>적재 뒤 중복 병합을 돌린다. 문화정보원 카페와 겹치는 업소가 실제로 있어서다
 * (제주 기준 이름 대조로 1곳 확인). 병합을 적재 뒤에 해야 새로 들어온 행까지 판정 대상이 된다.
 *
 * <p>{@code @Transactional} 을 붙이지 않는 이유는 다른 적재 파사드와 같다 — 외부 호출과
 * 대량 upsert 를 한 트랜잭션으로 묶으면 커넥션을 오래 잡는다. 재실행이 멱등이라 중간에
 * 실패하면 잡을 다시 돌리면 된다.
 */
@Service
@RequiredArgsConstructor
public class PetRestaurantImportFacade implements PetRestaurantImportUseCase {

    private final PetRestaurantImportProcessor petRestaurantImportProcessor;
    private final PlaceMergeProcessor placeMergeProcessor;
    private final DelistProcessor delistProcessor;
    private final PlaceImportMetricsPort placeImportMetricsPort;

    @Override
    public int importPetRestaurants(String region) {
        // 병합 범위는 적재 범위와 같아야 한다 (CultureFacilityImportFacade 와 같은 이유).
        // 식약처 원천은 "제주"처럼 줄여 주므로 시도 명칭으로 편 뒤 코드로 옮긴다.
        String areaCode = resolveAreaCode(region);

        LocalDateTime runStartedAt = LocalDateTime.now();
        int imported = petRestaurantImportProcessor.importPetRestaurants(region);
        // 등록 철회가 실제로 일어나는 원천이다. 이번 파일에 없는 업소를 delist 해야
        // 폐업한 식당이 "동반 가능 확인됨"으로 남지 않는다.
        int delisted = delistProcessor.delistPlaces(PlaceSourceType.MFDS, runStartedAt, imported);
        placeMergeProcessor.mergeDuplicates(areaCode);

        // geocode_failed 는 건수가 태어나는 PetRestaurantImportProcessor 가 기록한다
        placeImportMetricsPort.recordRows(PlaceSourceType.MFDS, PlaceImportResultType.UPSERTED, imported);
        placeImportMetricsPort.recordRows(PlaceSourceType.MFDS, PlaceImportResultType.DELISTED, delisted);
        if (imported > 0) {
            // 신선도는 실제로 데이터가 들어온 실행만 갱신한다 (PlaceImportFacade 와 같은 이유)
            placeImportMetricsPort.recordLastSuccess(PlaceSourceType.MFDS, Instant.now());
        }
        return imported;
    }

    /** 매핑에 없는 지역이면 적재를 시작하기 전에 실패시킨다. */
    private String resolveAreaCode(String region) {
        String areaCode = RegionCodeMapping.toAreaCode(RegionCodeMapping.toSidoName(region));
        if (areaCode == null) {
            throw new PlaceImportException(PlaceImportErrorCode.REGION_NOT_SUPPORTED, region);
        }
        return areaCode;
    }
}
