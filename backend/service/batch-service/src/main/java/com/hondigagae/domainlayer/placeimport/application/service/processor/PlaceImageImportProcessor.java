package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImageBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceImageTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceImage;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * TourAPI 추가 이미지(detailImage2) 적재.
 *
 * <p>목록 API(areaBasedList2)는 대표 이미지(firstImage)만 주므로, 상세 갤러리용 추가
 * 이미지는 장소당 한 번씩 detailImage2 를 불러야 한다. 대상이 TourAPI 원천(제주 수십 곳)
 * 뿐이라 호출량은 쿼터(일 1,000건) 안에서 넉넉하다 — 성격상 반복이 맞는 호출이다(§9-7).
 *
 * <p>한 장소의 실패는 기록하고 계속 간다 — 이미지는 보강 데이터라, 한 곳의 원천 오류가
 * 나머지 장소의 갤러리 적재까지 막으면 손해가 더 크다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceImageImportProcessor {

    // 공공 API 쿼터를 배려한 호출 간 대기 (장소 목록 적재와 동일한 값)
    private static final long CALL_INTERVAL_MILLIS = 200L;

    private final PlaceCatalogPort placeCatalogPort;
    private final PlaceImageBulkPort placeImageBulkPort;

    public int importImages() {
        List<PlaceImageTargetQueryResult> targets = placeImageBulkPort.findTourApiTargets();
        int importedImages = 0;
        int failedPlaces = 0;

        for (PlaceImageTargetQueryResult target : targets) {
            try {
                List<ImportedPlaceImage> images = placeCatalogPort.fetchDetailImages(target.contentId());
                importedImages += placeImageBulkPort.replaceImages(target.placeId(), images);
            } catch (PlaceImportException exception) {
                failedPlaces++;
                log.warn("place image import failed. placeId={}, contentId={}, reason={}",
                    target.placeId(), target.contentId(), exception.getMessage());
            }
            sleepQuietly();
        }

        log.info("place image import finished. targets={}, images={}, failedPlaces={}",
            targets.size(), importedImages, failedPlaces);
        return importedImages;
    }

    private void sleepQuietly() {
        try {
            Thread.sleep(CALL_INTERVAL_MILLIS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("place image import interrupted", exception);
        }
    }
}
