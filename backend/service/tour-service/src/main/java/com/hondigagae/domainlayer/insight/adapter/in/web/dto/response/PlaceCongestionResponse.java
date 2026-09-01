package com.hondigagae.domainlayer.insight.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.DailyCongestionItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 장소의 기간별 혼잡도 응답.
 *
 * <p>요청한 기간을 그대로 되돌려 준다. 클라이언트가 기본값(오늘부터 7일)으로 불렀을 때
 * 어느 구간을 받은 것인지 알 수 있어야 화면에 날짜 축을 그릴 수 있다.
 *
 * <p><b>데이터가 없는 날짜도 목록에 담는다.</b> 빠뜨리면 화면의 날짜 축에 구멍이 생기고,
 * 사용자는 그 날을 "한산한 날"로 읽는다. UNKNOWN 등급으로 자리를 지킨다.
 */
@Builder
@Schema(description = "장소 기간별 혼잡도 응답 DTO")
public record PlaceCongestionResponse(

    @Schema(
        description = "장소 아이디. Snowflake 라 자바스크립트 Number 의 안전 정수 범위를 넘으므로 문자열로 내린다",
        example = "212481712381923328")
    String placeId,

    @Schema(description = "조회 시작일", example = "2026-09-01")
    LocalDate fromDate,

    @Schema(description = "조회 종료일", example = "2026-09-07")
    LocalDate toDate,

    @Schema(description = "일자별 혼잡도. 데이터가 없는 날짜도 UNKNOWN 으로 자리를 지킨다")
    List<DailyCongestionItem> dailyCongestions
) {
}
