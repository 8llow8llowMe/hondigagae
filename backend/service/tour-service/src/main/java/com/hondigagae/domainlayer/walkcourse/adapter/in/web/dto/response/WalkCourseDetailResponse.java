package com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import lombok.Builder;

@Builder
@Schema(description = "산책 코스 상세 응답 DTO")
public record WalkCourseDetailResponse(

    @Schema(description = "산책 코스 아이디", example = "212481712381923328")
    String walkCourseId,

    @Schema(description = "코스 이름표", example = "3코스 (A)")
    String courseLabel,

    @Schema(description = "코스명 (구간)", example = "온평-표선(A)")
    String name,

    @Schema(description = "거리(km)", example = "20.9")
    BigDecimal distanceKm,

    @Schema(description = "소요시간 원문", example = "6~7시간")
    String durationText,

    @Schema(description = "시종점 원문", example = "온평포구-제주민속촌주차장입구")
    String startEndPoint,

    @Schema(description = "시작점 위도 (WGS84). 원천에 좌표가 없는 코스는 null", example = "33.4052580126", nullable = true)
    Double lat,

    @Schema(description = "시작점 경도 (WGS84). 원천에 좌표가 없는 코스는 null", example = "126.9039284074", nullable = true)
    Double lng,

    @Schema(description = "대표 이미지 URL. 없으면 null", nullable = true)
    String firstImage,

    @Schema(description = "원천 데이터 기준일자", example = "2025-04-28")
    String baseDate,

    @Schema(description = "정보 출처", example = "제주특별자치도 올레코스현황 · 한국관광공사 TourAPI")
    String providerName
) {
}
