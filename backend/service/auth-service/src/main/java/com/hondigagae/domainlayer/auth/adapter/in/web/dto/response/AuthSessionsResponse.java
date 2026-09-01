package com.hondigagae.domainlayer.auth.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.auth.adapter.in.web.dto.item.AuthSessionItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "로그인 기기(세션) 목록 응답 DTO")
public record AuthSessionsResponse(

    @Schema(description = "활성 세션 목록 (최근 갱신순)")
    List<AuthSessionItem> sessions,

    @Schema(description = "활성 세션 수", example = "2")
    int totalCount
) {

}
