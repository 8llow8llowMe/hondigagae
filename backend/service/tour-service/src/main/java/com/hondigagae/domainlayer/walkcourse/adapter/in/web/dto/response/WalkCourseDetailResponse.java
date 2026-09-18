package com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.List;
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

    @Schema(
        description = "소요시간 상한(분). **null 은 제한 없음이 아니라 원문을 파싱하지 못했다는 뜻이다** — "
            + "화면은 durationText 원문을 보여 준다",
        example = "420", nullable = true)
    Integer durationMaxMinutes,

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

    @Schema(
        description = "이 코스를 걸을 만한 반려견 활동량 목록. 판정 기준은 목록 필터와 같다(WalkCourseActivityFit). "
            + "durationMaxMinutes 가 null 인 코스는 세 값이 모두 담기는데, 이는 \"아무 아이나 된다\"가 아니라 "
            + "\"소요시간을 모른다\"는 뜻이다. **목록 항목에는 싣지 않는다** — 목록은 이미 활동량으로 걸러 내려가므로 "
            + "항목마다 반복하면 응답만 부푼다",
        example = "[{\"code\":\"MEDIUM\",\"name\":\"보통\",\"description\":\"일반적인 산책과 관광 일정을 소화합니다.\"}]")
    List<CodeNameDescriptionMetadata> fitsActivityLevels,

    @Schema(description = "정보 출처", example = "제주특별자치도 올레코스현황 · 한국관광공사 TourAPI")
    String providerName
) {
}
