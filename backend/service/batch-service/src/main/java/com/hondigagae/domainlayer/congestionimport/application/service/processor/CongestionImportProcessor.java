package com.hondigagae.domainlayer.congestionimport.application.service.processor;

import com.hondigagae.domainlayer.congestionimport.application.exception.CongestionImportErrorCode;
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
        int failedRegions = 0;
        CongestionImportException lastFailure = null;

        for (JejuLegalRegion region : JejuLegalRegion.all()) {
            try {
                List<ImportedCongestionForecast> regionRows = fetchRegion(region, numOfRows);
                upserted += congestionForecastBulkPort.upsertAll(regionRows);
                collected.addAll(regionRows);
                log.info("Congestion import region done region={} rows={}", region.getDisplayName(), regionRows.size());
            } catch (CongestionImportException exception) {
                failedRegions++;
                lastFailure = exception;
                log.error("Congestion import region failed region={} errorCode={} reason={}",
                    region.getDisplayName(), exception.getErrorCode().getCode(), exception.getMessage());
            }
        }
        // 지역 격리는 "일부 실패"까지다. 전 지역이 실패했는데 잡이 COMPLETED 로 끝나면
        // 30일 rolling 원천이 조용히 낡아 가는 것을 아무도 모른다 — 스텝을 실패시켜 드러낸다.
        if (failedRegions == JejuLegalRegion.all().size()) {
            throw new CongestionImportException(CongestionImportErrorCode.ALL_REGIONS_FAILED, lastFailure);
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
            // forecasts 는 필수 필드 필터를 거친 목록이라 비었다고 끝난 게 아니다 — 한 페이지가
            // 전부 걸러져도 다음 페이지는 있을 수 있다. 종료는 totalCount 기반 hasNextPage 로만
            // 판정하고, totalCount 가 깨진 경우는 MAX_PAGES 상한이 막는다.
            if (!page.hasNextPage()) {
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
