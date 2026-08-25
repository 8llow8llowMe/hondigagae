package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceCatalogQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceImportProcessor {

    private static final int PAGE_SIZE = 100;
    // 공공 API 쿼터(개발계정 일 1,000건)를 배려한 호출 간 대기
    private static final long CALL_INTERVAL_MILLIS = 200L;

    private final PlaceCatalogPort placeCatalogPort;
    private final PlaceBulkPort placeBulkPort;

    /**
     * 타입별로 페이지를 순회하며 수집 즉시 페이지 단위로 upsert한다.
     * 타입 하나가 실패해도 이미 upsert된 페이지는 유지된다 (재실행 멱등).
     */
    public int importPlaces(String areaCode, List<PlaceContentType> contentTypes) {
        List<PlaceContentType> targets = (contentTypes == null || contentTypes.isEmpty())
            ? PlaceContentType.DEFAULT_IMPORT_TARGETS
            : contentTypes;

        int totalUpserted = 0;
        for (PlaceContentType contentType : targets) {
            totalUpserted += importByContentType(areaCode, contentType);
        }
        log.info("place import finished. areaCode={}, contentTypes={}, upserted={}", areaCode, targets, totalUpserted);
        return totalUpserted;
    }

    private int importByContentType(String areaCode, PlaceContentType contentType) {
        int upserted = 0;
        int pageNo = 1;
        while (true) {
            PlaceCatalogQueryResult page = placeCatalogPort.fetchAreaBasedPlaces(areaCode, contentType, pageNo, PAGE_SIZE);
            if (!page.places().isEmpty()) {
                placeBulkPort.upsertAll(page.places());
                upserted += page.places().size();
            }
            log.info("place import page done. areaCode={}, contentType={}, page={}/{}(totalCount={})",
                areaCode, contentType, pageNo, (page.totalCount() + PAGE_SIZE - 1) / PAGE_SIZE, page.totalCount());

            if (!page.hasNext()) {
                break;
            }
            pageNo++;
            sleepQuietly();
        }
        return upserted;
    }

    private void sleepQuietly() {
        try {
            Thread.sleep(CALL_INTERVAL_MILLIS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("place import interrupted", exception);
        }
    }
}
