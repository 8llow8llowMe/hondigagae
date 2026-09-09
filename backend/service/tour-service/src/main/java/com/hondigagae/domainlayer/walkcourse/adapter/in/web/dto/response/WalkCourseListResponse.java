package com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.item.WalkCourseItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "산책 코스 목록 응답 DTO")
public record WalkCourseListResponse(

    @Schema(description = "코스 목록. 기본은 코스번호 순이다")
    List<WalkCourseItem> courses,

    @Schema(description = "조건에 맞는 코스 수. 코스는 30개 안팎이라 잘리지 않고 전부 내려간다", example = "29")
    int totalCount,

    @Schema(description = "반려견 활동량 필터가 적용됐는지", example = "true")
    boolean petActivityLevelApplied,

    @Schema(description = "정보 출처", example = "제주특별자치도 올레코스현황 · 한국관광공사 TourAPI")
    String providerName
) {
}
