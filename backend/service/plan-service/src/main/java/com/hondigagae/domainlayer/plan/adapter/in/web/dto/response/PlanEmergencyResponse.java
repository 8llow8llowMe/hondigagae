package com.hondigagae.domainlayer.plan.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "일정 응급 브리핑 응답 DTO — 일자별 방문 장소 주변의 동물병원·동물약국")
public record PlanEmergencyResponse(

    @Schema(description = "일정 아이디", example = "1234567890123456789")
    String planId,

    @Schema(description = "검색 반경(m)", example = "10000")
    int radiusMeters,

    @Schema(description = "일자별 브리핑")
    List<DayItem> days
) {

    @Builder
    @Schema(description = "일자별 응급 브리핑 항목")
    public record DayItem(

        @Schema(description = "일차 (1부터)", example = "1")
        int day,

        @Schema(description = "방문 장소별 주변 시설")
        List<SpotItem> spots
    ) {
    }

    @Builder
    @Schema(description = "방문 장소 기준 주변 시설 묶음")
    public record SpotItem(

        @Schema(description = "일정 항목 아이디", example = "1234567890123456789")
        String planItemId,

        @Schema(description = "장소 아이디", example = "212481712381923328")
        String placeId,

        @Schema(description = "항목 이름", example = "협재해수욕장")
        String title,

        @Schema(description = "가까운 순 시설 목록 (최대 3곳)")
        List<FacilityItem> facilities
    ) {
    }

    @Builder
    @Schema(description = "주변 긴급 시설")
    public record FacilityItem(

        @Schema(description = "시설명", example = "제주동물병원")
        String name,

        @Schema(description = "시설 종류 표시명", example = "동물병원")
        String typeName,

        @Schema(description = "주소", example = "제주특별자치도 제주시 ...")
        String addr,

        @Schema(description = "전화번호", example = "064-000-0000")
        String tel,

        @Schema(description = "방문 장소로부터의 거리(m)", example = "1250")
        int distanceMeters,

        @Schema(description = "24시간 운영 여부", example = "false")
        boolean open24,

        @Schema(description = "운영시간 정보 보유 여부. false 면 전화 확인을 안내해야 한다", example = "true")
        boolean operatingHoursKnown
    ) {
    }
}
