package com.hondigagae.domainlayer.congestionimport.application.port.out;

import com.hondigagae.domainlayer.congestionimport.domain.model.ImportedCongestionForecast;
import java.util.List;

/** congestion_forecast 대량 upsert (coding-conventions §12-3). */
public interface CongestionForecastBulkPort {

    int upsertAll(List<ImportedCongestionForecast> forecasts);
}
