package com.hondigagae.domainlayer.pet.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "내 반려견 목록 응답 DTO")
public record PetsResponse(

    @Schema(description = "반려견 목록")
    List<PetResponse> pets,

    @Schema(description = "등록된 반려견 수", example = "2")
    int totalCount
) {
}
