package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.port.in.PlaceImportUseCase;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImportMetricsPort;
import com.hondigagae.domainlayer.placeimport.application.service.processor.DelistProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceImageBackfillProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceImageImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceIntroImportProcessor;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceImportResultType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 장소 적재 유스케이스 오케스트레이터.
 *
 * <p>{@code @Transactional}을 붙이지 않는다 — 적재는 외부 API 호출(수십 페이지의 HTTP I/O)을
 * 반복하는 작업이라 하나의 트랜잭션으로 묶으면 DB 커넥션을 잡은 채 대기하게 된다.
 * 쓰기 원자성은 페이지 단위 upsert(JdbcTemplate batchUpdate)로 충분하고, 재실행이 멱등이라
 * 중간 실패 시 잡을 다시 돌리면 된다.
 */
@Service
@RequiredArgsConstructor
public class PlaceImportFacade implements PlaceImportUseCase {

    private final PlaceImportProcessor placeImportProcessor;
    private final DelistProcessor delistProcessor;
    private final PlaceImageImportProcessor placeImageImportProcessor;
    private final PlaceIntroImportProcessor placeIntroImportProcessor;
    private final PlaceImageBackfillProcessor placeImageBackfillProcessor;
    private final PlaceImportMetricsPort placeImportMetricsPort;

    @Override
    public int importPlaces(String areaCode, List<PlaceContentType> contentTypes) {
        LocalDateTime runStartedAt = LocalDateTime.now();
        int imported = placeImportProcessor.importPlaces(areaCode, contentTypes);

        // 일부 타입만 지정한 부분 실행에서는 delist 하지 않는다 — 이번에 안 돈 타입의 행이
        // 전부 stale 로 보여 통째로 내려간다.
        boolean fullRun = contentTypes == null || contentTypes.isEmpty()
            || contentTypes.containsAll(PlaceContentType.DEFAULT_IMPORT_TARGETS);
        int delisted = 0;
        if (fullRun) {
            delisted = delistProcessor.delistPlaces(PlaceSourceType.TOUR_API, areaCode, runStartedAt, imported);
        }

        placeImportMetricsPort.recordRows(PlaceSourceType.TOUR_API, PlaceImportResultType.UPSERTED, imported);
        placeImportMetricsPort.recordRows(PlaceSourceType.TOUR_API, PlaceImportResultType.DELISTED, delisted);
        if (imported > 0) {
            // 신선도는 실제로 데이터가 들어온 실행만 갱신한다 — 원천이 빈 응답을 준 실행을
            // "성공"으로 남기면 데이터가 낡아도 경보가 울리지 않는다.
            placeImportMetricsPort.recordLastSuccess(PlaceSourceType.TOUR_API, Instant.now());
        }
        return imported;
    }

    @Override
    public int importPlaceImages() {
        return placeImageImportProcessor.importImages();
    }

    @Override
    public int importPlaceIntros() {
        return placeIntroImportProcessor.importIntros();
    }

    @Override
    public int backfillPlaceImages(String areaCode) {
        return placeImageBackfillProcessor.backfillImages(areaCode);
    }
}
