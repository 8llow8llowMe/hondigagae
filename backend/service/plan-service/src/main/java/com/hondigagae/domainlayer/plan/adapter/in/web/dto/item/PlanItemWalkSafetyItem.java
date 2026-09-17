package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import lombok.Builder;

/**
 * 일정 항목 하나의 산책 위험도.
 *
 * <p>판정을 못 낸 항목도 <b>줄은 그대로 내려간다</b> — 화면은 그 항목을 여전히 그려야 하고,
 * 왜 비었는지를 {@code unavailableReasonCode} 로 사유별로 다르게 말할 수 있어야 한다.
 */
@Builder
@Schema(description = "일정 항목 산책 위험도 DTO")
public record PlanItemWalkSafetyItem(

    @Schema(description = "일정 항목 아이디", example = "1234567890123456790")
    String planItemId,

    @Schema(description = "일차 (1부터)", example = "2")
    int day,

    @Schema(description = "그 일차의 날짜", example = "2026-09-13")
    LocalDate date,

    @Schema(description = "그 일차 안의 순서 (0부터)", example = "1")
    int sequence,

    @Schema(description = "항목 시작 시각. 없으면 null 이고 위험도도 비어 있다", example = "14:00:00")
    LocalTime startTime,

    @Schema(description = "항목 이름", example = "협재해수욕장")
    String title,

    @Schema(description = "장소 아이디. 좌표를 아는 장소 항목이 아니면(unavailableReasonCode=NOT_PLACE_TARGET) null 입니다. "
        + "**판정을 못 낸 줄에도 남습니다** — LOOKUP_FAILED 같은 줄에서 화면이 "
        + "`GET /api/v1/places/{placeId}/walk-safety` 를 직접 불러 다시 시도할 수 있어야 하기 때문입니다",
        example = "212481712381923328")
    String placeId,

    @Schema(description = "tour-service 가 확인한 장소명. **판정을 못 낸 항목은 물어보지 않았으므로 null 입니다** "
        + "— 일정에 적힌 이름은 title 로 내려갑니다", example = "협재해수욕장")
    String placeTitle,

    @Schema(description = "판정 기준 시각", example = "2026-09-13T14:00:00")
    LocalDateTime targetDateTime,

    @Schema(description = "판정 기준 반려견 아이디. 그날 날씨 판정의 basisPetId 와 같다", example = "1234567890123456789")
    String basisPetId,

    @Schema(description = "산책 위험도 등급 metadata. 못 낸 항목은 null")
    ScoreMetricMetadata walkSafetyLevel,

    @Schema(
        description = "추정 노면(아스팔트) 표면온도(섭씨). 실측이 아니라 tour-service 의 추정치다. "
            + "**화면 문구에 '노면(아스팔트)' 를 밝히고 temperature(기온)와 나란히 보여 주세요** "
            + "— 노면온도만 표시하면 사용자가 그것을 기온으로 읽는다",
        example = "58.0")
    Double estimatedPavementCelsius,

    @Schema(description = "기상청 여름철 체감온도(섭씨). 등급 판정의 기준값이다", example = "33.5")
    Double feelsLikeCelsius,

    @Schema(description = "판정에 쓴 기온(섭씨)", example = "31.0")
    Double temperature,

    @Schema(description = "같은 날 더 안전한 시간대 시작. 없으면 null", example = "18:00:00")
    LocalTime saferWindowStart,

    @Schema(description = "같은 날 더 안전한 시간대 종료. 없으면 null", example = "21:00:00")
    LocalTime saferWindowEnd,

    @Schema(description = "판정을 못 낸 사유 코드. 정상이면 null. "
        + "PAST_DATE 지난 날짜 · NOT_PLACE_TARGET 장소 항목 아님 · NO_START_TIME 시각 미지정 · "
        + "BEYOND_FORECAST_RANGE 시각별 예보 범위(오늘~오늘+4) 밖 · LOOKUP_FAILED 조회 실패",
        example = "NO_START_TIME")
    String unavailableReasonCode,

    @Schema(description = "판정을 못 낸 사유 문장. 정상이면 null",
        example = "이 항목에 시작 시각이 없어 산책 위험도를 낼 수 없습니다. 시각은 시간대마다 판정이 갈립니다.")
    String unavailableReason
) {
}
