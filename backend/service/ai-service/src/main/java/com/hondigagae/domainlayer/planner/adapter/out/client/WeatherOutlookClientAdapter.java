package com.hondigagae.domainlayer.planner.adapter.out.client;

import com.hondigagae.domainlayer.planner.adapter.out.client.feign.WeatherOutlookClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.DailyWeatherClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.port.out.WeatherOutlookQueryPort;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 날씨 전망 조회 어댑터. <b>실패를 예외로 올리지 않는다</b> — 날씨는 배치 품질을 높이는
 * 근거이지 필수 입력이 아니라, tour 장애가 일정 생성을 막으면 안 된다. 빠진 사실은 로그로 남긴다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherOutlookClientAdapter implements WeatherOutlookQueryPort {

    private final WeatherOutlookClient weatherOutlookClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public List<DayWeatherOutlook> findDailyOutlook(String areaCode) {
        try {
            List<DailyWeatherClientResponse> body = internalResponseSupport.requestAndUnwrapOrNull(
                InternalResponseSupport.TOUR_SERVICE,
                () -> weatherOutlookClient.getDailyWeather(areaCode));
            if (body == null) {
                return List.of();
            }
            return body.stream()
                .filter(item -> item.date() != null)
                .map(item -> DayWeatherOutlook.builder()
                    .date(item.date())
                    .forecastSourceName(item.forecastSourceName())
                    .skyStateName(item.skyStateName())
                    .precipitationTypeName(item.precipitationTypeName())
                    .maxPrecipitationProbability(item.maxPrecipitationProbability())
                    .minTemperature(item.minTemperature())
                    .maxTemperature(item.maxTemperature())
                    .maxWindSpeed(item.maxWindSpeed())
                    .build())
                .toList();
        } catch (AiPlanException exception) {
            log.warn("Weather outlook lookup failed areaCode={} errorCode={}",
                areaCode, exception.getErrorCode().getCode());
            return List.of();
        }
    }
}
