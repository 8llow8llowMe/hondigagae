package com.hondigagae.domainlayer.congestionimport.application.service;

import com.hondigagae.domainlayer.congestionimport.application.port.in.CongestionImportUseCase;
import com.hondigagae.domainlayer.congestionimport.application.service.processor.CongestionImportProcessor;
import com.hondigagae.domainlayer.congestionimport.application.service.processor.PlaceNameLinkProcessor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 집중률 적재 오케스트레이터.
 *
 * <p>적재와 명칭 연결을 한 잡으로 묶는다. 따로 돌리면 "적재는 됐는데 아무 장소에도 붙지 않은"
 * 상태가 생기고, 그 상태에서 적합도 응답은 조용히 혼잡도를 빼고 나간다.
 *
 * <p>트랜잭션을 걸지 않는다. 외부 API 호출이 섞여 있어 DB 커넥션을 잡은 채 원격 응답을 기다리게
 * 되기 때문이다 (architecture-guide §3 의 문서화된 예외). 대량 upsert 는 멱등하므로 부분 실패
 * 후 재실행으로 복구한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CongestionImportFacade implements CongestionImportUseCase {

    /** 명칭 매칭 대상 장소를 좁히는 관광 지역코드. 통계 API 의 법정동 코드와는 다른 체계다. */
    private static final String JEJU_TOUR_AREA_CODE = "39";

    private final CongestionImportProcessor congestionImportProcessor;
    private final PlaceNameLinkProcessor placeNameLinkProcessor;

    @Override
    public CongestionImportResult importJejuCongestion(int numOfRows) {
        CongestionImportProcessor.ImportResult imported = congestionImportProcessor.importAll(numOfRows);
        PlaceNameLinkProcessor.LinkResult linked =
            placeNameLinkProcessor.linkAll(imported.forecasts(), JEJU_TOUR_AREA_CODE);

        CongestionImportResult result = new CongestionImportResult(
            imported.forecasts().size(), imported.upserted(), linked.matched(), linked.unmatched());
        log.info("Congestion import finished fetched={} upserted={} linked={} unmatched={}",
            result.fetched(), result.upserted(), result.linked(), result.unmatched());
        return result;
    }
}
