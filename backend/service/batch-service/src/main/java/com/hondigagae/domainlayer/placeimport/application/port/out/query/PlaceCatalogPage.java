package com.hondigagae.domainlayer.placeimport.application.port.out.query;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlace;
import java.util.List;

/**
 * 장소 카탈로그 한 페이지 조회 결과.
 */
public record PlaceCatalogPage(List<ImportedPlace> places, int pageNo, int numOfRows, int totalCount) {

    public boolean hasNext() {
        return (long) pageNo * numOfRows < totalCount;
    }
}
