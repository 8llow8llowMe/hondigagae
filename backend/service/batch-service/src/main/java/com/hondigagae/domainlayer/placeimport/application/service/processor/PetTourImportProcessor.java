package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlacePetInfoBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PetTourSyncQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlacePetInfoTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlacePetInfo;
import com.hondigagae.global.properties.PetTourImportProperties;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 반려동물 동반 조건(detailPetTour2) 적재 (#877).
 *
 * <p>place 마스터는 동반 조건을 모른다 — 목록 API 에 그 필드가 없고, 장소당 한 번 detailPetTour2 를
 * 불러야만 얻는다. 그런데 제주 TourAPI 장소 2,099곳 전부에 부르면 대부분이 {@code items=""} 로 온다.
 * <b>동반 정보가 있는 곳은 원천이 따로 목록으로 준다</b>(petTourSyncList2, 제주 336건). 그래서 두 단계다:
 * <ol>
 *   <li>동기화 목록으로 "노출 중" contentId 집합과 "내림" 집합을 받는다 (1콜)</li>
 *   <li>내림 집합의 행을 지우고, 노출 집합 ∩ place 마스터에만 상세를 부른다 (상한까지)</li>
 * </ol>
 *
 * <p>나머지는 {@link PlaceIntroImportProcessor} 와 같은 결이다 — 실행당 상한, "행 없는 곳 먼저 →
 * synced_at 오래된 순" 증분 선정, 한 곳의 실패는 기록하고 계속, <b>단 서킷 오픈·키 누락·한도 초과는
 * 다시 던진다</b> ({@link PlaceImportErrorCode#stopsTheStep}).
 *
 * <p><b>동기화 목록 호출이 실패하면 아무것도 쓰지 않고 실패한다.</b> 대상 집합 없이는 지울 것도
 * 부를 것도 정할 수 없고, 기존 행은 지난 실행 값 그대로 남는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PetTourImportProcessor {

    // 공공 API 쿼터를 배려한 호출 간 대기 (다른 상세 적재와 동일한 값)
    private static final long CALL_INTERVAL_MILLIS = 200L;
    /** 동기화 목록 페이지 크기. 제주 336건이 한 페이지에 든다. */
    static final int SYNC_PAGE_SIZE = 1000;
    /**
     * 동기화 목록 페이지 수의 천장. 전국 10,152건도 11페이지라 정상 경로에서는 닿지 않는다 —
     * totalCount 가 이상하게 오는 날 목록 호출만으로 예산을 태우지 않게 하는 장치다.
     */
    static final int MAX_SYNC_PAGES = 20;

    private final PlaceCatalogPort placeCatalogPort;
    private final PlacePetInfoBulkPort placePetInfoBulkPort;
    private final PetTourImportProperties petTourImportProperties;

    /**
     * @param areaCode 관광 지역코드 (제주=39)
     * @return upsert 한 장소 수
     */
    public int importPetTourInfos(String areaCode) {
        Set<Long> shown = new LinkedHashSet<>();
        Set<Long> withdrawn = new HashSet<>();
        int syncPages = collectSyncEntries(areaCode, shown, withdrawn);
        // 같은 contentId 가 노출·내림으로 함께 오면 노출을 믿는다 — 지우는 쪽은 확실할 때만 간다.
        withdrawn.removeAll(shown);

        int removed = placePetInfoBulkPort.deleteByContentIds(withdrawn);

        List<PlacePetInfoTargetQueryResult> targets =
            placePetInfoBulkPort.findTourApiTargets(shown, petTourImportProperties.maxCallsPerRun());

        int upserted = 0;
        int leashRequired = 0;
        int emptyInfo = 0;
        int failedPlaces = 0;

        for (PlacePetInfoTargetQueryResult target : targets) {
            try {
                Optional<ImportedPlacePetInfo> petInfo = placeCatalogPort.fetchDetailPetTour(target.contentId());
                if (petInfo.isEmpty()) {
                    // 목록에는 있는데 상세가 비어 온 곳. 이미 있는 값은 지우지 않고 synced_at 만 민다 —
                    // 원천이 이번에 말이 없다고 지난 값을 버릴 근거는 없다. 행이 없으면 만들지 않으므로
                    // 그런 곳은 다음 실행에도 맨 앞에서 다시 불린다 (PetTourImportProperties 의 한계 절).
                    placePetInfoBulkPort.touchSyncedAt(target.placeId());
                    emptyInfo++;
                } else {
                    placePetInfoBulkPort.upsert(target.placeId(), petInfo.get());
                    upserted++;
                    if (petInfo.get().leashRequired()) {
                        leashRequired++;
                    }
                }
            } catch (PlaceImportException exception) {
                if (PlaceImportErrorCode.stopsTheStep(exception.getErrorCode())) {
                    throw exception;
                }
                placePetInfoBulkPort.touchSyncedAt(target.placeId());
                failedPlaces++;
                log.warn("pet tour import failed. placeId={}, contentId={}, reason={}",
                    target.placeId(), target.contentId(), exception.getMessage());
            }
            sleepQuietly();
        }

        // shown - targets 는 원천에는 있는데 place 마스터에 없는(또는 병합·delisted) contentId 와
        // 상한에 걸려 다음 실행으로 넘어간 곳의 합이다. 상한보다 targets 가 적으면 전자만 남는다.
        log.info("pet tour import finished. areaCode={}, syncPages={}, shown={}, withdrawn={}, removed={}, "
                + "targets={}, maxCalls={}, upserted={}, leashRequired={}, emptyInfo={}, failedPlaces={}",
            areaCode, syncPages, shown.size(), withdrawn.size(), removed, targets.size(),
            petTourImportProperties.maxCallsPerRun(), upserted, leashRequired, emptyInfo, failedPlaces);
        return upserted;
    }

    private int collectSyncEntries(String areaCode, Set<Long> shown, Set<Long> withdrawn) {
        int pages = 0;
        while (true) {
            PetTourSyncQueryResult page = placeCatalogPort.fetchPetTourSyncList(areaCode, pages + 1, SYNC_PAGE_SIZE);
            pages++;
            for (PetTourSyncQueryResult.Entry entry : page.entries()) {
                (entry.shown() ? shown : withdrawn).add(entry.contentId());
            }
            // totalCount 가 남았다고 해도 빈 페이지 뒤는 믿지 않는다 — 같은 빈 페이지를 반복해 부를 뿐이다.
            if (page.entries().isEmpty() || !page.hasNext()) {
                return pages;
            }
            if (pages >= MAX_SYNC_PAGES) {
                log.warn("pet tour sync list truncated at page cap. areaCode={}, pages={}, totalCount={}",
                    areaCode, pages, page.totalCount());
                return pages;
            }
            sleepQuietly();
        }
    }

    private void sleepQuietly() {
        try {
            Thread.sleep(CALL_INTERVAL_MILLIS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("pet tour import interrupted", exception);
        }
    }
}
