package com.hondigagae.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 검증 실패 응답의 resultMessage 본문.
 * 대표 메시지 1건과 필드별 오류 목록을 함께 제공해, 클라이언트가 코드 단위로 분기할 수 있게 한다.
 */
@Schema(description = "검증 오류 상세")
public record ValidationErrorBody(

    @Schema(description = "대표 오류 메시지 (첫 번째 오류)", example = "닉네임은 10자 이하만 가능합니다.")
    String message,

    @Schema(description = "필드별 오류 목록")
    List<ValidationErrorItem> errors
) {

}
