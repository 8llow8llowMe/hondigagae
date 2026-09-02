package com.hondigagae.domainlayer.insight.application.service;

import com.hondigagae.domainlayer.insight.adapter.in.internal.dto.DailyWeatherInternalResponse;
import com.hondigagae.domainlayer.insight.adapter.in.internal.presenter.InsightInternalPresenter;
import com.hondigagae.domainlayer.insight.application.port.in.InsightInternalUseCase;
import com.hondigagae.domainlayer.insight.application.service.processor.WeatherForecastProcessor;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class InsightInternalFacade implements InsightInternalUseCase {

    private static final String JEJU_AREA_CODE = "39";
    /**
     * 제주 대표 지점(제주시 도심). 지역 단위 요청이라 대표 격자 하나로 답한다 —
     * 격자를 늘리면 KMA 호출·캐시가 늘어나는데, 여행 전망 용도로는 대표 지점이면 충분하다.
     */
    private static final double JEJU_LAT = 33.4996213;
    private static final double JEJU_LNG = 126.5311884;
    private static final String JEJU_SIGUNGU_CODE = "4";

    private final WeatherForecastProcessor weatherForecastProcessor;
    private final InsightInternalPresenter insightInternalPresenter;

    @Override
    public List<DailyWeatherInternalResponse> getDailyWeather(String areaCode) {
        // 제주 전용 서비스다. 다른 지역 코드는 근거 없는 예보를 지어내는 대신 빈 목록으로 답하고,
        // 소비 측(ai)은 절 생략으로 관용 처리한다.
        if (!JEJU_AREA_CODE.equals(areaCode)) {
            log.info("Daily weather requested for unsupported areaCode={}", areaCode);
            return List.of();
        }
        return insightInternalPresenter.toDailyWeatherResponses(
            weatherForecastProcessor.dailyForecastsAt(JEJU_LAT, JEJU_LNG, JEJU_SIGUNGU_CODE));
    }
}
