package com.hondigagae.domainlayer.walkcourse.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseDetailResponse;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseListResponse;
import com.hondigagae.domainlayer.walkcourse.application.exception.WalkCourseValidationMessage;
import com.hondigagae.domainlayer.walkcourse.application.model.WalkCourseSearchQuery;
import com.hondigagae.domainlayer.walkcourse.application.port.in.WalkCourseWebUseCase;
import com.hondigagae.domainlayer.walkcourse.domain.enums.WalkCourseSort;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/walk-courses")
@Tag(name = "산책 코스", description = "제주올레 코스를 반려견 조건에 맞춰 찾습니다.")
public class WalkCourseWebController {

    private final WalkCourseWebUseCase walkCourseWebUseCase;

    @Operation(summary = "산책 코스 목록",
        description = "제주올레 코스(27개 + A/B 변형) 목록입니다. 기본 정렬은 코스번호 순입니다.\n\n"
            + "petActivityLevel 을 주면 반려견 활동량으로 거릅니다 — LOW 는 4시간 이하, MEDIUM 은 "
            + "6시간 이하 코스만 남고 HIGH 는 거르지 않습니다. 활동량 설명(\"장시간 활동을 힘들어합니다\" 등)에서 "
            + "끌어낸 서비스 정의 기준입니다.\n\n"
            + "**lat/lng 가 null 인 코스가 있습니다**(원천에 좌표가 없는 20·18-2코스). 좌표가 있는 코스는 "
            + "`GET /api/v1/insights/walk-times?lat=&lng=` 에 그대로 넣어 \"오늘 이 코스 언제 걷기 좋은가\"(골든타임)를 "
            + "이어 볼 수 있습니다 — 좌표가 null 이면 그 동선을 만들지 마세요.\n\n"
            + "호출 예\n"
            + "- 전체: `GET /api/v1/walk-courses`\n"
            + "- 활동량 낮은 아이가 걸을 만한 짧은 코스부터: `GET /api/v1/walk-courses?petActivityLevel=LOW&sort=DISTANCE_ASC`")
    @GetMapping
    public ResponseEntity<Response<WalkCourseListResponse>> searchWalkCourses(
        @Parameter(description = "[선택] 반려견 활동량. 주면 소요시간 상한으로 거릅니다 — LOW 4시간 · MEDIUM 6시간 · HIGH 제한 없음", example = "LOW")
        @RequestParam(required = false) ActivityLevel petActivityLevel,

        @Parameter(description = "[선택] 최대 거리(km). 0.1~50", example = "12.0")
        @DecimalMin(value = "0.1", message = WalkCourseValidationMessage.MAX_DISTANCE_RANGE_INVALID)
        @DecimalMax(value = "50", message = WalkCourseValidationMessage.MAX_DISTANCE_RANGE_INVALID)
        @RequestParam(required = false) BigDecimal maxDistanceKm,

        @Parameter(description = "[선택, 기본 COURSE_NO] 정렬. COURSE_NO 코스번호 · DISTANCE_ASC/DESC 거리 · DURATION_ASC 소요시간", example = "COURSE_NO")
        @RequestParam(required = false) WalkCourseSort sort
    ) {
        WalkCourseSearchQuery query = WalkCourseSearchQuery.builder()
            .petActivityLevel(petActivityLevel)
            .maxDistanceKm(maxDistanceKm)
            .sort(sort)
            .build();
        return ResponseEntity.ok().body(Response.success(walkCourseWebUseCase.search(query)));
    }

    @Operation(summary = "산책 코스 상세",
        description = "목록에서 고른 코스 한 곳의 상세입니다. 목록이 내려주는 walkCourseId 를 그대로 씁니다. "
            + "lat/lng 의 뜻은 목록과 같습니다 — 좌표가 있으면 골든타임(walk-times)으로 이어집니다.")
    @GetMapping("/{walkCourseId}")
    public ResponseEntity<Response<WalkCourseDetailResponse>> getWalkCourseDetail(
        @Parameter(description = "[필수] 산책 코스 아이디. 목록 응답의 walkCourseId 를 그대로 씁니다. 예시 값은 형식 안내용",
            required = true, example = "212481712381923328")
        @PathVariable long walkCourseId
    ) {
        return ResponseEntity.ok().body(Response.success(walkCourseWebUseCase.getDetail(walkCourseId)));
    }
}
