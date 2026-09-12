package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImageBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceImageTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceImage;
import com.hondigagae.global.properties.PlaceImageImportProperties;
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
 * <p><b>전량을 매 실행 부르지 않는다 (#478).</b> 예전에는 제주 TourAPI 장소 964곳 전량을 불렀고,
 * 운영시간 스텝(#361)이 먼저 예산을 쓰는 순서가 되면서 매 실행 약 280곳의 갱신이 그냥 빠졌다.
 * 이제 운영시간 스텝과 같은 규칙으로 고른다 — (1) 실행당 상한
 * ({@code place-image-import.max-calls-per-run}, 기본 400), (2) "한 번도 부르지 않은 곳 먼저 →
 * {@code place.image_synced_at} 오래된 순 → id" 증분 선정. 주 1회 실행 3주면 한 바퀴가 돈다.
 *
 * <p><b>커서는 원천에서 확정 답을 받았을 때만 전진한다.</b> 이 규칙이 증분의 전부다.
 * <ul>
 *   <li>이미지를 받았다 → 교체 + touch</li>
 *   <li><b>빈 목록</b>을 받았다 → 빈 교체(기존 행 제거) + touch. 안 하면 원천이 갤러리를 주지
 *       않는 장소(약 30%)가 NULL 머리를 영원히 독식해 나머지 장소의 차례가 오지 않는다</li>
 *   <li>그 밖의 한 곳 실패 → 기록 + touch. 영영 실패하는 장소(원천에서 사라진 contentId 등)가
 *       머리에 고착하는 것을 막는다. 한 바퀴 뒤에 자연히 재시도되므로 일시적 실패도 잃지 않는다</li>
 *   <li>한도 초과 → touch 없이 멈추고 <b>스텝은 성공으로 끝낸다</b>(종전과 같다). 채우지 못한
 *       장소는 커서 앞자리에 그대로 남는다</li>
 *   <li>서킷 오픈·키 누락 → touch 없이 다시 던진다. <b>아래 행동 변화 참고</b></li>
 * </ul>
 *
 * <p><b>행동 변화 — 서킷 오픈·키 누락이 이제 스텝을 실패시킨다.</b> 종전에는 두 오류가 "한 곳
 * 실패"로 접혀 964번 찍히고 스텝이 {@code COMPLETED} 로 끝났다. 대상 선정이 무상태라 잃는 것이
 * 없었기 때문이다 — 다음 실행이 같은 964곳을 다시 돌았다. 순환 커서가 생긴 지금은 그 한 번에
 * <b>상한(400)만큼의 장소가 아무것도 받지 못한 채 커서만 밀려</b>, 한 바퀴(3주) 뒤까지 차례가
 * 오지 않는다. 키를 빠뜨린 배포 한 번이 3주짜리 공백을 만드는 셈이다. 그래서 스텝을 실패로
 * 끝내 모니터링에 드러낸다 ({@link PlaceImportErrorCode#stopsTheStep} — 운영시간 스텝과 공유).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceImageImportProcessor {

    // 공공 API 쿼터를 배려한 호출 간 대기 (장소 목록 적재와 동일한 값)
    private static final long CALL_INTERVAL_MILLIS = 200L;

    private final PlaceCatalogPort placeCatalogPort;
    private final PlaceImageBulkPort placeImageBulkPort;
    private final PlaceImageImportProperties placeImageImportProperties;

    public int importImages() {
        List<PlaceImageTargetQueryResult> targets =
            placeImageBulkPort.findTourApiTargets(placeImageImportProperties.maxCallsPerRun());

        int importedImages = 0;
        int emptyImages = 0;
        int failedPlaces = 0;
        int processedPlaces = 0;
        boolean quotaExhausted = false;

        for (PlaceImageTargetQueryResult target : targets) {
            processedPlaces++;
            try {
                List<ImportedPlaceImage> images = placeCatalogPort.fetchDetailImages(target.contentId());
                // 빈 목록도 원천의 확정 답이다 — 갤러리를 내렸으면 우리도 내린다(기존 동작).
                importedImages += placeImageBulkPort.replaceImages(target.placeId(), images);
                if (images.isEmpty()) {
                    emptyImages++;
                }
                placeImageBulkPort.touchImageSyncedAt(target.placeId());
            } catch (PlaceImportException exception) {
                // 한도 초과를 stopsTheStep 보다 먼저 가려낸다. 그 집합에도 들어 있지만 이 스텝에서는
                // 예산 소진이 예외가 아니라 정상 경로라 다르게 다룬다 — 순서가 뒤집히면 매주 실패한다.
                if (exception.getErrorCode() == PlaceImportErrorCode.TOUR_API_QUOTA_EXCEEDED) {
                    // 하루 몫이 끝났다. 남은 장소를 계속 두드려 봐야 전부 같은 실패라 여기서 멈춘다.
                    // 커서는 밀지 않는다 — 이 장소는 아무 답도 받지 못했으므로 다음 실행의 앞자리에
                    // 그대로 남아야 한다. 스텝을 실패로 끝내지도 않는다: 재실행이 멱등이고 기존
                    // place_image 행이 그대로 남아 잃는 것은 "이번 주 갱신"뿐이다.
                    quotaExhausted = true;
                    log.warn("place image import stopped: daily quota exhausted. done={}, remaining={}",
                        processedPlaces, targets.size() - processedPlaces);
                    break;
                }
                if (PlaceImportErrorCode.stopsTheStep(exception.getErrorCode())) {
                    // 서킷 오픈·키 누락. 남은 대상을 다 돌아도 결과가 같은데, 계속 가면 상한만큼의
                    // 장소가 아무것도 받지 못한 채 커서만 밀려 순환이 헝클어진다. 클래스 javadoc 참고.
                    log.warn("place image import aborted. processedPlaces={}, reason={}",
                        processedPlaces, exception.getMessage());
                    throw exception;
                }
                // 실패한 곳도 순환에 넣는다 — 영영 실패하는 장소가 NULL 머리에 고착하면 매 실행
                // 그만큼의 예산이 아무것도 채우지 못하고 사라진다.
                placeImageBulkPort.touchImageSyncedAt(target.placeId());
                failedPlaces++;
                log.warn("place image import failed. placeId={}, contentId={}, reason={}",
                    target.placeId(), target.contentId(), exception.getMessage());
            }
            sleepQuietly();
        }

        // targets 가 상한보다 작으면 대상 자체가 그만큼이다. 두 번째 실행의 대상이 첫 실행과
        // 겹치면 touch 가 걸리지 않은 것이므로, 커버리지는 연속 두 실행의 로그를 함께 읽어 본다.
        log.info("place image import finished. targets={}, processedPlaces={}, images={}, emptyImages={}, "
                + "failedPlaces={}, quotaExhausted={}",
            targets.size(), processedPlaces, importedImages, emptyImages, failedPlaces, quotaExhausted);
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
