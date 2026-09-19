package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.model.PlaceImportOutcome;
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
import com.hondigagae.domainlayer.placeimport.domain.enums.RegionCodeMapping;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportVolumeGuard;
import com.hondigagae.global.properties.PlaceImportVolumeProperties;
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
    private final PlaceImportVolumeProperties placeImportVolumeProperties;

    @Override
    public int importPlaces(String areaCode, List<PlaceContentType> contentTypes) {
        LocalDateTime runStartedAt = LocalDateTime.now();
        PlaceImportOutcome outcome = placeImportProcessor.importPlaces(areaCode, contentTypes);
        int imported = outcome.totalUpserted();

        // 일부 타입만 지정한 부분 실행에서는 delist 하지 않는다 — 이번에 안 돈 타입의 행이
        // 전부 stale 로 보여 통째로 내려간다.
        boolean fullRun = contentTypes == null || contentTypes.isEmpty()
            || contentTypes.containsAll(PlaceContentType.DEFAULT_IMPORT_TARGETS);
        int delisted = 0;
        if (fullRun) {
            verifyImportVolume(imported);
            // delist 범위는 총 건수가 아니라 outcome 이 정한다 — 이번에 1건 이상 들어온
            // contentType 만 내린다 (#726, DelistProcessor javadoc 참고).
            delisted = delistProcessor.delistPlacesByContentType(PlaceSourceType.TOUR_API, areaCode, runStartedAt, outcome);
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

    /**
     * 전량 실행의 적재 건수를 절대 범위와 대조하고, 벗어나면 잡을 실패시킨다 (#726).
     *
     * <p><b>delist 앞에서 막는다.</b> 적게 받아온 실행으로 delist 까지 돌면 멀쩡한 행이 stale 로
     * 내려간다. {@code DelistGuard} 가 상대 비율로 한 번 더 막지만, 그것은 "직전보다 줄었는가"만
     * 보므로 처음부터 계속 적게 들어오는 상태는 통과시킨다.
     *
     * <p><b>셋이 막는 것이 다르다.</b> 이 가드는 "총량의 절대 이탈", {@code DelistGuard} 는
     * "직전 활성 건수 대비 급감", 그리고 delist 범위 자체를 이번에 들어온 contentType 으로 좁히는
     * 것({@code DelistProcessor.delistPlacesByContentType})은 "타입 하나가 통째로 사라진 실행이
     * 그 타입을 다 내리는 것"을 막는다. 하나가 통과해도 다른 하나가 막는 경우가 있어 겹쳐 둔다.
     *
     * <p>실패 전에 UPSERTED 지표는 남긴다 — 몇 건이 들어와서 걸렸는지가 대시보드에서 바로
     * 읽혀야 원인을 짚을 수 있다. 반면 {@code recordLastSuccess} 는 호출하지 않으므로 신선도
     * 경보도 함께 울린다.
     */
    private void verifyImportVolume(int imported) {
        int minRows = placeImportVolumeProperties.minRows();
        int maxRows = placeImportVolumeProperties.maxRows();
        if (ImportVolumeGuard.withinRange(imported, minRows, maxRows)) {
            return;
        }
        placeImportMetricsPort.recordRows(PlaceSourceType.TOUR_API, PlaceImportResultType.UPSERTED, imported);
        throw new PlaceImportException(PlaceImportErrorCode.IMPORT_VOLUME_OUT_OF_RANGE,
            "imported=%d, expected=%d~%d".formatted(imported, minRows, maxRows));
    }

    @Override
    public int importPlaceImages() {
        return placeImageImportProcessor.importImages();
    }

    @Override
    public int importPlaceIntros() {
        return placeIntroImportProcessor.importIntros();
    }

    /**
     * 지역코드는 <b>백필 루프에 들어가기 전에</b> 검사한다 ({@code PlaceMergeFacade.mergeDuplicates} 와 같은 선례).
     *
     * <p>루프 안에서 걸러도 되지 않는다. 백필은 대상마다 {@code PlaceImportException} 을 받아
     * {@code failed++} 와 warn 만 남기고 계속 도는 구조라, 매핑에 없는 areaCode 로 돌리면
     * {@code searchPlacesByKeyword} 가 매 대상마다 {@code REGION_NOT_SUPPORTED} 를 던지는데도
     * 잡은 {@code COMPLETED} + {@code backfilled=0} 으로 끝난다 — 대상 수 × 200ms 만 태우고,
     * 운영자는 "매칭이 안 됐나 보다"로 읽는다. 잡 파라미터 오타는 조용한 0건이 아니라 실패로
     * 보여야 한다.
     */
    @Override
    public int backfillPlaceImages(String areaCode) {
        if (!RegionCodeMapping.isKnownAreaCode(areaCode)) {
            throw new PlaceImportException(PlaceImportErrorCode.REGION_NOT_SUPPORTED, areaCode);
        }
        return placeImageBackfillProcessor.backfillImages(areaCode);
    }
}
