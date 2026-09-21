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

    @Schema(description = "시작 지점명. 시종점 원문을 가른 값이며 표기는 원문 그대로다. 가르지 못하면 null",
        example = "온평포구", nullable = true)
    String startPointName,

    @Schema(
        description = "종점 지점명. 시종점 원문을 가른 값이며 **표기는 원문 그대로다** — 같은 곳을 원천이 "
            + "두 표기로 부르는 쌍이 있다(3코스 종점 `제주민속촌주차장입구` = 4코스 시작 `제주민속촌주차장 입구`). "
            + "좌표는 같게 맞추지만 이름은 고쳐 부르지 않는다. 가르지 못하면 null",
        example = "제주민속촌주차장입구", nullable = true)
    String endPointName,

    @Schema(description = "시작점 위도 (WGS84). 원천에 좌표가 없는 코스는 null", example = "33.4052580126", nullable = true)
    Double lat,

    @Schema(description = "시작점 경도 (WGS84). 원천에 좌표가 없는 코스는 null", example = "126.9039284074", nullable = true)
    Double lng,

    @Schema(
        description = "종점 위도 (WGS84). **null 이 정상인 코스가 있다** — 종점 좌표는 그 지점에서 출발하는 "
            + "이웃 코스의 시작점에서 끌어오는데, 이어지는 코스가 없는 종점(7 · 9 · 21 · 10-1 · 14-1코스)은 "
            + "끌어올 곳이 없어 비운다. 결함이 아니라 원천의 한계다. "
            + "**순환 코스(1-1)는 시작점과 값이 같다** — 두 점이 겹친다고 코스 길이가 0 인 것이 아니며, "
            + "길이는 distanceKm(11.3) 이 말한다. "
            + "**경로 좌표열은 응답에 없다** — 공개 원천에 없어서이며(backend/docs/data-api-analysis.md §9), "
            + "화면은 두 점 사이 직선을 실제 걷는 길로 그리지 않아야 한다",
        example = "33.3223400000", nullable = true)
    Double endLat,

    @Schema(description = "종점 경도 (WGS84). null 규칙은 endLat 과 같다", example = "126.7982800000", nullable = true)
    Double endLng,

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
