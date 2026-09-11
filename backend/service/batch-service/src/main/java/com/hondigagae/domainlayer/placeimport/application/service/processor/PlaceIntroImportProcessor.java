package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceIntroBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceIntroTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceIntro;
import com.hondigagae.global.properties.PlaceIntroImportProperties;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * TourAPI 상세 소개(detailIntro2) 적재.
 *
 * <p>TourAPI 출처 장소는 목록 API(areaBasedList2)만으로는 운영시간을 전혀 모른다 — 그래서
 * 장소 상세의 {@code intro.openNow}/{@code open24} 판정이 전부 "모름"이었다. 운영시간은
 * 장소당 한 번 detailIntro2 를 불러야만 얻을 수 있다.
 *
 * <p><b>쿼터가 희소하다.</b> 개발계정 일 1,000건 중 추가 이미지 스텝이 이미 964콜을 쓴다.
 * 그래서 두 겹으로 방어한다 — (1) 실행당 호출 상한, (2) "intro 없는 곳 먼저 →
 * synced_at 오래된 순" 증분 선정. 주 1회 실행이 반복되며 전량을 덮고 이후에는 갱신 순환이 된다.
 *
 * <p>대상 타입도 좁힌다. detailIntro2 에 운영시간 필드가 없는 숙박·여행코스·축제는 호출해도
 * 얻을 것이 없어 {@link PlaceContentType#INTRO_HOURS_TARGETS} 만 부른다.
 *
 * <p>한 장소의 실패는 기록하고 계속 간다 (이미지 적재와 같은 결). <b>단 서킷 오픈·키 누락·
 * 한도 초과는 다시 던진다</b> ({@link #STOPS_THE_STEP}) — 남은 대상을 다 돌아도 결과가 같은
 * 상태라 시간만 태우고, 대상 순환까지 헝클어뜨린다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceIntroImportProcessor {

    // 공공 API 쿼터를 배려한 호출 간 대기 (장소·이미지 적재와 동일한 값)
    private static final long CALL_INTERVAL_MILLIS = 200L;

    /**
     * 한 곳의 실패로 넘기지 않고 스텝을 즉시 끝내는 오류. 셋 다 <b>남은 대상을 다 돌아도 결과가
     * 같은</b> 상태다 — 원천이 죽었거나(서킷), 키가 없거나, 오늘 몫을 다 썼다. 계속 가면 시간만
     * 태우고, 실패한 장소마다 synced_at 을 밀어 대상 순환까지 헝클어뜨린다.
     *
     * <p>한도 초과가 특히 중요하다. 같은 잡의 이미지 스텝이 먼저 하루 예산의 대부분을 쓰므로
     * <b>이 스텝이 한도에 걸리는 것은 예외가 아니라 정상 경로</b>다. 이것을 "한 곳 실패"로 접으면
     * 상한만큼의 장소가 전부 뒤로 밀려 다음 실행에서도 채워지지 않는다.
     */
    private static final Set<PlaceImportErrorCode> STOPS_THE_STEP = EnumSet.of(
        PlaceImportErrorCode.TOUR_API_CIRCUIT_OPEN,
        PlaceImportErrorCode.TOUR_API_SERVICE_KEY_MISSING,
        PlaceImportErrorCode.TOUR_API_QUOTA_EXCEEDED
    );

    private final PlaceCatalogPort placeCatalogPort;
    private final PlaceIntroBulkPort placeIntroBulkPort;
    private final PlaceIntroImportProperties placeIntroImportProperties;

    public int importIntros() {
        List<PlaceIntroTargetQueryResult> targets = placeIntroBulkPort.findTourApiTargets(
            PlaceContentType.INTRO_HOURS_TARGETS, placeIntroImportProperties.maxCallsPerRun());

        int upserted = 0;
        int withUseTime = 0;
        int withWeeklyHoursSpec = 0;
        int open24 = 0;
        int emptyIntro = 0;
        int skipped = 0;
        int failedPlaces = 0;

        for (PlaceIntroTargetQueryResult target : targets) {
            Optional<PlaceContentType> contentType = PlaceContentType.findByCode(target.contentTypeId());
            if (contentType.isEmpty()) {
                // 대상 쿼리가 이미 타입을 가두므로 실제로는 오지 않는다. 포트 계약상 가능한 값이라
                // 방어만 해 둔다 — 호출 파라미터를 만들 수 없으니 쿼터를 쓰지 않고 건너뛴다.
                skipped++;
                log.warn("place intro import skipped: unknown contentTypeId. placeId={}, contentTypeId={}",
                    target.placeId(), target.contentTypeId());
                continue;
            }

            try {
                Optional<ImportedPlaceIntro> intro =
                    placeCatalogPort.fetchDetailIntro(target.contentId(), contentType.get());
                if (intro.isEmpty()) {
                    // 원천에 내용이 없는 곳. 내용 컬럼은 건드리지 않고 synced_at 만 민다 —
                    // 그러지 않으면 "intro 없는 곳 먼저"인 대상 선정에서 이 장소들이 영원히
                    // 앞자리를 차지해 나머지 장소의 차례가 오지 않는다.
                    placeIntroBulkPort.touchSyncedAt(target.placeId());
                    emptyIntro++;
                } else {
                    ImportedPlaceIntro value = intro.get();
                    placeIntroBulkPort.upsert(target.placeId(), value);
                    upserted++;
                    if (value.useTime() != null) {
                        withUseTime++;
                    }
                    if (value.weeklyHoursSpec() != null) {
                        withWeeklyHoursSpec++;
                    }
                    if (value.open24()) {
                        open24++;
                    }
                }
            } catch (PlaceImportException exception) {
                if (STOPS_THE_STEP.contains(exception.getErrorCode())) {
                    throw exception;
                }
                // 실패한 곳도 순환에 넣는다. 그러지 않으면 영영 실패하는 장소(원천에서 사라진
                // contentId 등)가 "intro 없는 곳 먼저" 정렬의 앞자리를 매 실행 다시 차지해
                // 예산만 태운다. 여기서 뒤로 밀린 장소는 한 바퀴 뒤에 다시 시도된다.
                placeIntroBulkPort.touchSyncedAt(target.placeId());
                failedPlaces++;
                log.warn("place intro import failed. placeId={}, contentId={}, reason={}",
                    target.placeId(), target.contentId(), exception.getMessage());
            }
            sleepQuietly();
        }

        // withWeeklyHoursSpec 은 수집 기준이다 — 컬럼을 넘겨 버려진 spec 이 있으면 쓰기 어댑터가
        // 따로 warn 을 남긴다("weekly hours spec dropped"). 커버리지를 볼 때 두 줄을 함께 읽는다.
        log.info("place intro import finished. targets={}, upserted={}, withUseTime={}, withWeeklyHoursSpec={}, "
                + "open24={}, emptyIntro={}, skipped={}, failedPlaces={}",
            targets.size(), upserted, withUseTime, withWeeklyHoursSpec, open24, emptyIntro, skipped, failedPlaces);
        return upserted;
    }

    private void sleepQuietly() {
        try {
            Thread.sleep(CALL_INTERVAL_MILLIS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("place intro import interrupted", exception);
        }
    }
}
