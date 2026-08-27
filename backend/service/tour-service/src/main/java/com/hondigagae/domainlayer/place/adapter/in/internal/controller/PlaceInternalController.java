package com.hondigagae.domainlayer.place.adapter.in.internal.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.place.application.port.in.PlaceInternalUseCase;
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
 * <p>plan-service 가 일정 항목의 장소 존재를 확인할 때 쓴다. 항목마다 상세 API 를 부르면
 * 일정 하나 저장에 HTTP 왕복이 항목 수만큼 생기므로 아이디 목록을 한 번에 받는다.
 */
@Hidden
@RestController
@RequiredArgsConstructor
@RequestMapping("/internal/v1/places")
public class PlaceInternalController {

    private final PlaceInternalUseCase placeInternalUseCase;

    /**
     * 주어진 아이디 중 노출 가능한 장소만 돌려준다.
     *
     * <p>delisted 는 제외된다 — 새 일정 항목이 원천에서 사라진 장소를 참조하게 두지 않는다.
     * Java 서비스끼리의 호출이라 식별자를 String 으로 바꾸지 않는다.
     */
    @GetMapping("/visible-ids")
    public ResponseEntity<Response<List<Long>>> getVisiblePlaceIds(
        @RequestParam List<Long> placeIds
    ) {
        return ResponseEntity.ok().body(Response.success(placeInternalUseCase.findVisiblePlaceIds(placeIds)));
    }
}
