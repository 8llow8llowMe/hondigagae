package com.hondigagae.domainlayer.insight.adapter.in.internal.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.insight.adapter.in.internal.dto.DailyWeatherInternalResponse;
import com.hondigagae.domainlayer.insight.adapter.in.internal.dto.WeatherWarningInternalResponse;
import com.hondigagae.domainlayer.insight.application.port.in.InsightInternalUseCase;
import io.swagger.v3.oas.annotations.Hidden;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서비스 간 호출 전용 엔드포인트.
 *
 * <p><b>경로가 {@code /internal/v1} 인 것이 보호 장치다.</b> 게이트웨이는 {@code /api/v1/**}
 * 만 외부로 라우팅하므로 이 경로는 클러스터 밖에서 닿지 않는다.
 *
 * <p>ai-service 가 일정 생성 프롬프트에 여행 기간 날씨 전망을 실을 때 쓴다.
 * {@code @Hidden} 으로 공개 Swagger 문서에서 감춘다 (coding-conventions §6).
 */
@Hidden
@RestController
@RequiredArgsConstructor
@RequestMapping("/internal/v1/weather")
public class WeatherInternalController {

    private final InsightInternalUseCase insightInternalUseCase;

    /** 지역 대표 지점의 일자별 예보(약 11일). 현재 제주(39) 전용 — 다른 코드는 빈 목록. */
    @GetMapping("/daily")
    public ResponseEntity<Response<List<DailyWeatherInternalResponse>>> getDailyWeather(
        @RequestParam String areaCode
    ) {
        return ResponseEntity.ok().body(Response.success(insightInternalUseCase.getDailyWeather(areaCode)));
    }

    /**
     * 발효 중인 기상특보 중 가장 무거운 한 건. plan-service 여행 브리핑이 당일 일정에 붙인다.
     *
     * <p><b>없으면 {@code dataBody} 가 null 인 200 이다.</b> 404 로 답하면 "특보 없음" 이
     * 호출부의 오류 경로로 들어가는데, 특보가 없는 것이 압도적으로 흔한 정상 상태다.
     */
    @GetMapping("/warnings")
    public ResponseEntity<Response<WeatherWarningInternalResponse>> getActiveWeatherWarning() {
        return ResponseEntity.ok().body(
            Response.success(insightInternalUseCase.getActiveWeatherWarning().orElse(null)));
    }
}
