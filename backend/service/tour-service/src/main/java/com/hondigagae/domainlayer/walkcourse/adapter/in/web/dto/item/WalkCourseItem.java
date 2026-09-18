package com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import lombok.Builder;

/**
 * 산책 코스 한 줄.
 *
 * <p>{@code lat/lng} 가 null 인 코스가 있다(원천에 좌표가 없는 20·18-2코스). 좌표가 있는
 * 코스만 골든타임(`GET /api/v1/insights/walk-times?lat=&lng=`)과 이어진다 — 화면은 좌표가
 * null 이면 그 버튼을 만들지 않아야 한다.
 */
@Builder
@Schema(description = "산책 코스 목록 항목 DTO")
public record WalkCourseItem(

    @Schema(description = "산책 코스 아이디", example = "212481712381923328")
    String walkCourseId,

    @Schema(description = "코스 이름표. 올레 코스는 번호가 곧 사용자가 아는 이름이다", example = "1코스")
    String courseLabel,

    @Schema(description = "코스명 (구간)", example = "시흥-광치기")
    String name,

    @Schema(description = "거리(km)", example = "15.1")
    BigDecimal distanceKm,

    @Schema(description = "소요시간 원문", example = "4~5시간")
    String durationText,

    @Schema(
        description = "소요시간 상한(분). **null 은 제한 없음이 아니라 원문을 파싱하지 못했다는 뜻이다** — "
            + "화면은 durationText 원문을 보여 준다",
        example = "300", nullable = true)
    Integer durationMaxMinutes,

    @Schema(description = "시종점 원문", example = "시흥리정류장-광치기해변")
    String startEndPoint,

    @Schema(description = "시작점 위도 (WGS84). 원천에 좌표가 없는 코스는 null", example = "33.4796218839", nullable = true)
    Double lat,

    @Schema(description = "시작점 경도 (WGS84). 원천에 좌표가 없는 코스는 null", example = "126.8955024257", nullable = true)
    Double lng,

    @Schema(description = "대표 이미지 URL. 없으면 null", nullable = true)
    String firstImage
) {
}
