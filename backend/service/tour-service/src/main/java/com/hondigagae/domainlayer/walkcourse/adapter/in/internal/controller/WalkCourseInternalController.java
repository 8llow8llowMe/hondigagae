package com.hondigagae.domainlayer.walkcourse.adapter.in.internal.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.walkcourse.adapter.in.internal.dto.WalkCourseCandidateInternalResponse;
import com.hondigagae.domainlayer.walkcourse.application.port.in.WalkCourseInternalUseCase;
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
 * <p>plan-service 가 일정 상세의 {@code WALK} 항목에 코스 요약을 붙일 때 쓴다. 항목마다 상세
 * API 를 부르면 일정 하나 조회에 HTTP 왕복이 항목 수만큼 생기므로 아이디 목록을 한 번에 받는다.
 */
@Hidden
@RestController
@RequiredArgsConstructor
@RequestMapping("/internal/v1/walk-courses")
public class WalkCourseInternalController {

    private final WalkCourseInternalUseCase walkCourseInternalUseCase;

    /**
     * 아이디로 코스 요약을 준다.
     *
     * <p>없는 아이디는 <b>조용히 빠진다</b> — plan-service 의 {@code WALK} 항목 {@code targetId} 는
     * 저장 시 검증되지 않아 없는 코스를 가리킬 수 있고(수기로 정리된 행도 마찬가지다), 그쪽에서는
     * 요약만 비우면 된다. 404 로 답하면 그 항목 하나 때문에 일정이 통째로 안 보인다.
     * Java 서비스끼리의 호출이라 식별자를 String 으로 바꾸지 않는다.
     */
    @GetMapping("/candidates")
    public ResponseEntity<Response<List<WalkCourseCandidateInternalResponse>>> getWalkCourseCandidates(
        @RequestParam List<Long> walkCourseIds
    ) {
        return ResponseEntity.ok()
            .body(Response.success(walkCourseInternalUseCase.findWalkCourseCandidates(walkCourseIds)));
    }
}
