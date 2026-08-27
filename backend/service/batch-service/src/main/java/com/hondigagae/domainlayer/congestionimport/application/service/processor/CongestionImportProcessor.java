package com.hondigagae.domainlayer.congestionimport.application.service.processor;

import com.hondigagae.domainlayer.congestionimport.application.exception.CongestionImportException;
import com.hondigagae.domainlayer.congestionimport.application.port.out.CongestionForecastBulkPort;
import com.hondigagae.domainlayer.congestionimport.application.port.out.CongestionForecastCatalogPort;
import com.hondigagae.domainlayer.congestionimport.application.port.out.query.CongestionCatalogQueryResult;
import com.hondigagae.domainlayer.congestionimport.domain.enums.JejuLegalRegion;
import com.hondigagae.domainlayer.congestionimport.domain.model.ImportedCongestionForecast;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 제주 두 시군구의 집중률 예측을 페이지 단위로 받아 적재한다.
 *
 * <p><b>지역 단위로 실패를 격리한다.</b> 제주시가 실패해도 서귀포시 적재는 진행한다 -
 * 원천 스키마 변경이나 일시 장애가 전체 배치를 막지 않게 하기 위해서다
 * (external-api-guide §5).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CongestionImportProcessor {

    /** 무한 루프 방어. 서귀포 한 곳이 4,284행이라 넉넉히 잡되 상한은 둔다. */
    private static final int MAX_PAGES = 100;

    private final CongestionForecastCatalogPort congestionForecastCatalogPort;
    private final CongestionForecastBulkPort congestionForecastBulkPort;

    public ImportResult importAll(int numOfRows) {
        List<ImportedCongestionForecast> collected = new ArrayList<>();
        int upserted = 0;

        for (JejuLegalRegion region : JejuLegalRegion.all()) {
            try {
                List<ImportedCongestionForecast> regionRows = fetchRegion(region, numOfRows);
                upserted += congestionForecastBulkPort.upsertAll(regionRows);
                collected.addAll(regionRows);
                log.info("Congestion import region done region={} rows={}", region.getDisplayName(), regionRows.size());
            } catch (CongestionImportException exception) {
                log.error("Congestion import region failed region={} errorCode={} reason={}",
                    region.getDisplayName(), exception.getErrorCode().getCode(), exception.getMessage());
            }
        }
        return new ImportResult(collected, upserted);
    }

    private List<ImportedCongestionForecast> fetchRegion(JejuLegalRegion region, int numOfRows) {
        List<ImportedCongestionForecast> rows = new ArrayList<>();
        int pageNo = 1;

        while (pageNo <= MAX_PAGES) {
            CongestionCatalogQueryResult page =
                congestionForecastCatalogPort.fetchConcentrationRates(region, pageNo, numOfRows);
            rows.addAll(page.forecasts());
            if (!page.hasNextPage() || page.forecasts().isEmpty()) {
                break;
            }
            pageNo++;
        }
        if (pageNo > MAX_PAGES) {
            log.warn("Congestion import hit page cap region={} cap={}", region.getDisplayName(), MAX_PAGES);
        }
        return rows;
    }

    public record ImportResult(List<ImportedCongestionForecast> forecasts, int upserted) {

    }
}
