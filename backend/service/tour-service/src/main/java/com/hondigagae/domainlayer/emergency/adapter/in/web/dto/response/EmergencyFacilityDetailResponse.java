package com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

/**
 * 긴급 시설 상세 응답.
 *
 * <p>목록 항목({@code NearbyFacilityItem})과 필드가 겹치지만 <b>distanceMeters 가 없다.</b>
 * 상세는 검색 중심점 없이 부르는 화면이라 거리를 낼 기준이 없다. 목록 DTO 를 재사용하면
 * 그 자리에 0 을 채워 넣게 되는데, 0m 는 "바로 여기"라는 뜻이라 명백히 틀린 값이다.
 */
@Builder
@Schema(description = "긴급 시설 상세 응답 DTO")
public record EmergencyFacilityDetailResponse(

    @Schema(
        description = "긴급 시설 아이디. Snowflake 라 자바스크립트 Number 의 안전 정수 범위를 넘으므로 문자열로 내린다",
        example = "4611686018427387904")
    String facilityId,

    @Schema(description = "시설 종류 metadata")
    CodeNameDescriptionMetadata facilityType,

    @Schema(description = "시설명", example = "제주동물병원")
    String name,

    @Schema(description = "주소", example = "제주특별자치도 제주시 ...")
    String addr,

    @Schema(description = "위도", example = "33.4996213")
    double lat,

    @Schema(description = "경도", example = "126.5311884")
    double lng,

    @Schema(description = "전화번호", example = "064-000-0000")
    String tel,

    @Schema(
        description = "운영시간. 원천에 정보가 없으면 null 이며, 이는 \"휴무\"가 아니라 \"확인 필요\"를 뜻한다",
        example = "09:00~19:00")
    String operatingHours,

    @Schema(description = "휴무일", example = "일요일")
    String restDate,

    @Schema(description = "24시간 운영 여부", example = "false")
    boolean open24,

    @Schema(
        description = "지금 영업 중인지. null 이면 영업시간 정보가 없어 판정할 수 없는 곳이다 — "
            + "\"닫힘\"으로 표시하지 말고 전화 확인을 안내해야 한다",
        example = "true", nullable = true)
    Boolean openNow,

    @Schema(
        description = "운영시간 정보 보유 여부. false 면 화면에서 \"영업시간 정보 없음\"으로 안내해야 한다",
        example = "true")
    boolean operatingHoursKnown
) {
}
