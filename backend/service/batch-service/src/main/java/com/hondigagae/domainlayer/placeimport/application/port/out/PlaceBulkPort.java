package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlace;
import java.util.List;

/**
 * place 테이블 대량 upsert 계약.
 */
public interface PlaceBulkPort {

    void upsertAll(List<ImportedPlace> places);
}
