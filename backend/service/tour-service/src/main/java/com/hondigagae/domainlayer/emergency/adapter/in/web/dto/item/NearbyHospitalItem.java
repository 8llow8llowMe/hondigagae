package com.hondigagae.domainlayer.emergency.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "주변 동물병원 항목 DTO")
public record NearbyHospitalItem(

    @Schema(description = "동물병원 아이디", example = "4611686018427387904")
    long hospitalId,

    @Schema(description = "병원명", example = "제주동물병원")
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
        description = "운영시간 정보 보유 여부. false 면 화면에서 \"영업시간 정보 없음\"으로 안내해야 한다",
        example = "true")
    boolean operatingHoursKnown,

    @Schema(description = "검색 중심점으로부터의 거리(m)", example = "1250")
    int distanceMeters
) {
}
