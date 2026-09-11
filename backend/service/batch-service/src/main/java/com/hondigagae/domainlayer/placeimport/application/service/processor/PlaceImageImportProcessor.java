package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
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
 * 이미지는 장소당 한 번씩 detailImage2 를 불러야 한다 — 성격상 반복이 맞는 호출이다(§9-7).
 *
 * <p><b>이 스텝은 하루 예산의 나머지를 쓴다.</b> 대상이 제주 TourAPI 장소 전량(약 964곳)으로
 * 늘어난 지금, 개발계정 한도(일 1,000건)에서 운영시간 스텝(#361)이 먼저 예산을 쓰고 나면
 * 이 스텝은 도중에 한도에 닿는다. 그것이 정상 경로라, 한도 초과를 만나면 <b>남은 장소를 건너뛰고
 * 조용히 끝낸다</b> — 스텝을 실패로 만들지 않는다. 재실행이 멱등이고 기존 place_image 행은
 * 그대로 남으므로 잃는 것은 "이번 주 갱신"뿐이다. 매 실행 전량을 갱신해야 하면 이 대상 쿼리에도
 * 운영시간 스텝과 같은 증분 규칙이 필요하다.
 *
 * <p>그 밖의 한 장소 실패는 기록하고 계속 간다 — 이미지는 보강 데이터라, 한 곳의 원천 오류가
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
        int processedPlaces = 0;
        boolean quotaExhausted = false;

        for (PlaceImageTargetQueryResult target : targets) {
            processedPlaces++;
            try {
                List<ImportedPlaceImage> images = placeCatalogPort.fetchDetailImages(target.contentId());
                importedImages += placeImageBulkPort.replaceImages(target.placeId(), images);
            } catch (PlaceImportException exception) {
                if (exception.getErrorCode() == PlaceImportErrorCode.TOUR_API_QUOTA_EXCEEDED) {
                    // 하루 몫이 끝났다. 남은 장소를 계속 두드려 봐야 전부 같은 실패라 여기서 멈춘다.
                    // 스텝을 실패로 끝내지는 않는다 — 운영시간 스텝이 먼저 예산을 쓰는 순서(#361)라
                    // 여기서 한도에 닿는 것이 정상 경로다. 기존 place_image 행은 그대로 남는다.
                    quotaExhausted = true;
                    log.warn("place image import stopped: daily quota exhausted. done={}, remaining={}",
                        processedPlaces, targets.size() - processedPlaces);
                    break;
                }
                failedPlaces++;
                log.warn("place image import failed. placeId={}, contentId={}, reason={}",
                    target.placeId(), target.contentId(), exception.getMessage());
            }
            sleepQuietly();
        }

        log.info("place image import finished. targets={}, processedPlaces={}, images={}, failedPlaces={}, quotaExhausted={}",
            targets.size(), processedPlaces, importedImages, failedPlaces, quotaExhausted);
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
