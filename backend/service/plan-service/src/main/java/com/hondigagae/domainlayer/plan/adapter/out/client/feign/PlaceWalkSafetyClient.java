package com.hondigagae.domainlayer.plan.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlaceWalkSafetyClientResponse;
import java.time.LocalDateTime;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * tour-service 산책 위험도 조회.
 *
 * <p><b>판정 규칙을 이쪽으로 옮기지 않는다.</b> 노면온도 추정·체감온도 산식·등급 임계는 전부
 * tour-service 가 갖고 있고, 같은 규칙을 두 곳에서 구현하면 장소 화면과 일정 화면이 같은 시각
 * 같은 곳을 다르게 말하게 된다. 여기서는 <b>항목의 시각으로 같은 API 를 부를 뿐</b>이다.
 *
 * <p>같은 대상 서비스를 여러 클라이언트가 호출하므로 {@code contextId} 를 반드시 다르게 준다
 * (coding-conventions §10).
 *
 * <p><b>{@code targetDateTime} 의 {@code @DateTimeFormat} 을 빼지 않는다 (#1419).</b> 없으면 Feign 이
 * 값을 <b>요청 로케일의 SHORT 형식</b>으로 문자열화한다. BFF(Node fetch)는 {@code Accept-Language: *}
 * 를 보내고 Tomcat 은 이를 {@code Locale.ROOT} 로 읽으므로 {@code 2026-10-15 10:00} 이 나가고,
 * tour-service 는 이를 읽지 못해 400 을 준다 — 운영에서 일정 항목 산책 위험도가 전부
 * {@code LOOKUP_FAILED} 였던 원인이다.
 */
@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "placeWalkSafetyClient"
)
public interface PlaceWalkSafetyClient {

    @GetMapping("/api/v1/places/{placeId}/walk-safety")
    Response<PlaceWalkSafetyClientResponse> getWalkSafety(
        @PathVariable long placeId,
        @RequestParam("targetDateTime") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        LocalDateTime targetDateTime,
        @RequestParam(name = "petSizeType", required = false) String petSizeType,
        @RequestParam("heatSensitive") boolean heatSensitive,
        @RequestParam("coldSensitive") boolean coldSensitive,
        @RequestParam("noiseSensitive") boolean noiseSensitive,
        @RequestParam(name = "activityLevel", required = false) String activityLevel,
        @RequestParam(name = "breed", required = false) String breed
    );
}
