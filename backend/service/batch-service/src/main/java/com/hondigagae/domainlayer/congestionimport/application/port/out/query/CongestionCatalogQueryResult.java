package com.hondigagae.domainlayer.congestionimport.application.port.out.query;

import com.hondigagae.domainlayer.congestionimport.domain.model.ImportedCongestionForecast;
import java.util.List;

/**
 * 집중률 예측 API 한 페이지 결과.
 *
 * <p>{@code totalCount} 를 함께 주는 이유는 페이지를 몇 번 더 돌아야 하는지 호출부가 알아야
 * 하기 때문이다. 서귀포 한 곳만 4,284행(30일 x 143곳)이라 페이지네이션이 필수다.
 */
public record CongestionCatalogQueryResult(
    List<ImportedCongestionForecast> forecasts,
    int pageNo,
    int numOfRows,
    int totalCount
) {

    public boolean hasNextPage() {
        return (long) pageNo * numOfRows < totalCount;
    }
}
