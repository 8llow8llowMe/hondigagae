package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImageBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceImageBackfillTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlace;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceNameMatcher;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 문화정보원·식약처 원천 장소의 대표 이미지 백필.
 *
 * <p>두 원천에는 이미지 필드 자체가 없다(문화정보원 CSV 31개 컬럼 중 이미지 없음).
 * 같은 장소가 TourAPI 에도 있으면 그쪽 대표 이미지를 빌려 온다 — 시설명 키워드 검색 후
 * <b>정규화 제목 일치 + 좌표 근접(500m)</b> 이중 검증을 통과한 경우에만 채운다.
 * 틀린 이미지가 붙는 것이 이미지가 없는 것보다 나쁘기 때문에 부분 일치는 쓰지 않는다.
 *
 * <p>못 채운 장소는 그대로 이미지 없음으로 남는다 — 원천의 한계라 화면(placeholder)이 담당한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceImageBackfillProcessor {

    /** 같은 장소 판정 거리 상한. 제주 시가지에서 같은 이름의 다른 지점을 걸러내는 값이다. */
    private static final double MATCH_DISTANCE_METERS = 500.0;
    // 공공 API 쿼터를 배려한 호출 간 대기 (장소 목록 적재와 동일한 값)
    private static final long CALL_INTERVAL_MILLIS = 200L;

    private final PlaceCatalogPort placeCatalogPort;
    private final PlaceImageBulkPort placeImageBulkPort;

    public int backfillImages(String areaCode) {
        List<PlaceImageBackfillTargetQueryResult> targets = placeImageBulkPort.findImageBackfillTargets();
        int backfilled = 0;
        int failed = 0;

        for (PlaceImageBackfillTargetQueryResult target : targets) {
            try {
                if (backfillOne(target, areaCode)) {
                    backfilled++;
                }
            } catch (PlaceImportException exception) {
                failed++;
                log.warn("place image backfill failed. placeId={}, title={}, reason={}",
                    target.placeId(), target.title(), exception.getMessage());
            }
            sleepQuietly();
        }

        log.info("place image backfill finished. targets={}, backfilled={}, failed={}",
            targets.size(), backfilled, failed);
        return backfilled;
    }

    private boolean backfillOne(PlaceImageBackfillTargetQueryResult target, String areaCode) {
        if (target.title() == null || target.title().isBlank()) {
            return false;
        }
        List<ImportedPlace> candidates = placeCatalogPort.searchPlacesByKeyword(target.title(), areaCode);
        for (ImportedPlace candidate : candidates) {
            if (candidate.firstImage() == null || candidate.firstImage().isBlank()) {
                continue;
            }
            if (!PlaceNameMatcher.isExactMatch(target.title(), candidate.title())) {
                continue;
            }
            if (candidate.lat() == null || candidate.lng() == null) {
                continue;
            }
            double distance = PlaceNameMatcher.distanceMeters(
                target.lat(), target.lng(), candidate.lat().doubleValue(), candidate.lng().doubleValue());
            if (distance > MATCH_DISTANCE_METERS) {
                continue;
            }
            placeImageBulkPort.updateFirstImage(target.placeId(), candidate.firstImage(), candidate.firstImage2());
            log.info("place image backfilled. placeId={}, title={}, contentId={}, distanceMeters={}",
                target.placeId(), target.title(), candidate.contentId(), Math.round(distance));
            return true;
        }
        return false;
    }

    private void sleepQuietly() {
        try {
            Thread.sleep(CALL_INTERVAL_MILLIS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("place image backfill interrupted", exception);
        }
    }
}
