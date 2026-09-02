package com.hondigagae.domainlayer.planner.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.DailyWeatherClientResponse;
import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * tour-service 일자별 예보 조회 — 여행 기간의 날씨 전망을 일정 생성 프롬프트에 싣기 위해 가져온다.
 * 예보 판정·캐시의 원천은 tour-service 이고, ai-service 는 사본을 두지 않는다.
 */
@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "weatherOutlookClient"
)
public interface WeatherOutlookClient {

    @GetMapping("/internal/v1/weather/daily")
    Response<List<DailyWeatherClientResponse>> getDailyWeather(@RequestParam("areaCode") String areaCode);
}
