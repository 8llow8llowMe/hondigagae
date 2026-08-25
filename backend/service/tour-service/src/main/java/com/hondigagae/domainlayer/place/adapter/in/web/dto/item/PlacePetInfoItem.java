package com.hondigagae.domainlayer.place.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "반려동물 동반 정보")
public record PlacePetInfoItem(

    @Schema(description = "동반 유형 원문", example = "전구역 동반가능")
    String acmpyTypeCd,

    @Schema(description = "동반 가능 동물 원문", example = "전 견종 동반 가능")
    String acmpyPsblCpam,

    @Schema(description = "동반 시 필요사항 원문", example = "목줄 착용")
    String acmpyNeedMtr,

    @Schema(description = "기타 동반 정보 원문")
    String etcAcmpyInfo,

    @Schema(description = "사고 대비사항 원문")
    String relaAcdntRiskMtr,

    @Schema(description = "비치 품목 원문")
    String relaFrnshPrdlst,

    @Schema(description = "부대시설 원문 (반려견 운동장 등)")
    String relaPosesFclty,

    @Schema(description = "구매 가능 품목 원문")
    String relaPurcPrdlst,

    @Schema(description = "대여 가능 품목 원문")
    String relaRntlPrdlst,

    @Schema(description = "동반 가능 구역 metadata (가공값)")
    CodeNameDescriptionMetadata allowanceScope,

    @Schema(description = "동반 가능 크기 metadata (가공값)")
    CodeNameDescriptionMetadata allowedPetSize,

    @Schema(description = "목줄 필요 여부 (가공값)", example = "true")
    boolean leashRequired
) {

}
