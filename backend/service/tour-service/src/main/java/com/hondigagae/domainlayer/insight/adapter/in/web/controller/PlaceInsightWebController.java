package com.hondigagae.domainlayer.insight.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceCongestionResponse;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceSuitabilityResponse;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.WalkSafetyResponse;
import com.hondigagae.domainlayer.insight.application.exception.InsightValidationMessage;
import com.hondigagae.domainlayer.insight.application.model.PlaceInsightQuery;
import com.hondigagae.domainlayer.insight.application.port.in.PlaceInsightWebUseCase;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 장소 여행 적합도 / 산책 위험도 조회.
 *
 * <p><b>반려견 조건을 회원 정보가 아니라 파라미터로 받는다.</b> tour-service 는 인증이 없는
 * 공개 조회 서비스이고(service-inventory.md), 반려견 프로필의 원천은 auth-service 다. 사본을
 * 두는 대신 필요한 특성만 받으면 비회원도 조회할 수 있고, 같은 장소를 여러 아이 기준으로
 * 비교해 보는 것도 자연스럽게 된다.
 */
@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/places")
@Tag(name = "여행 인사이트", description = "날씨와 반려견 조건을 결합한 장소 적합도/산책 위험도 분석 API를 제공합니다.")
public class PlaceInsightWebController {

    private final PlaceInsightWebUseCase placeInsightWebUseCase;

    @Operation(summary = "장소 여행 적합도",
        description = "날씨(기상청 단기예보) + 반려견 동반 조건 + 혼잡도를 결합해 0~100 점수와 판정 근거를 제공합니다. "
            + "score 는 null 일 수 있으며, 이는 0점이 아니라 판단 근거가 없다는 뜻입니다 "
            + "(단기·중기예보를 합쳐 약 11일까지 답하며, 그보다 먼 날짜는 근거가 없습니다). "
            + "이때 suitabilityLevel 은 INSUFFICIENT 이고 reasons 에 그 이유가 담깁니다. "
            + "비 예보가 있고 이 장소에 실내 공간이 없으면 indoorAlternatives 에 실내 대안을 함께 내려 줍니다.")
    @GetMapping("/{placeId}/suitability")
    public ResponseEntity<Response<PlaceSuitabilityResponse>> getSuitability(
        @Parameter(description = "장소 아이디", required = true, example = "212481712381923328")
        @Min(value = 1, message = InsightValidationMessage.PLACE_ID_INVALID)
        @PathVariable long placeId,

        @Parameter(description = "판정 기준 일자. 생략하면 오늘", example = "2026-08-27")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        @RequestParam(required = false) LocalDate targetDate,

        @Parameter(description = "반려견 크기. 장소의 입장 조건과 대조한다", example = "SMALL")
        @RequestParam(required = false) PetSizeType petSizeType,

        @Parameter(description = "더위에 민감한지", example = "false")
        @RequestParam(defaultValue = "false") boolean heatSensitive,

        @Parameter(description = "추위에 민감한지", example = "false")
        @RequestParam(defaultValue = "false") boolean coldSensitive,

        @Parameter(description = "소음에 민감한지. 혼잡도 판정에 반영된다", example = "false")
        @RequestParam(defaultValue = "false") boolean noiseSensitive,

        @Parameter(description = "활동량", example = "MEDIUM")
        @RequestParam(required = false) ActivityLevel activityLevel,

        @Parameter(description = "견종. 단두종 여부 판정에 쓴다", example = "퍼그")
        @RequestParam(required = false) String breed
    ) {
        PlaceInsightQuery query = PlaceInsightQuery.builder()
            .placeId(placeId)
            .targetDate(targetDate)
            .petCondition(toPetCondition(petSizeType, heatSensitive, coldSensitive, noiseSensitive, activityLevel, breed))
            .build();

        return ResponseEntity.ok().body(Response.success(placeInsightWebUseCase.getSuitability(query)));
    }

    @Operation(summary = "장소 산책 위험도",
        description = "그 시각에 반려견과 걸어도 되는지를 판정합니다. 사람 기준 기온이 아니라 "
            + "추정 아스팔트 노면온도와 열지수를 봅니다 — 기온 25도 맑은 한낮의 아스팔트는 50도를 넘어 "
            + "발바닥 화상 위험 구간에 들어갑니다. estimatedPavementCelsius 는 실측이 아니라 "
            + "기온/하늘상태/시간대로 계산한 추정치이므로 안내 용도로만 쓰고 단정하지 말아야 합니다. "
            + "위험/주의로 판정되면 같은 날 더 나은 시간대를 saferWindow 로 함께 제안합니다.")
    @GetMapping("/{placeId}/walk-safety")
    public ResponseEntity<Response<WalkSafetyResponse>> getWalkSafety(
        @Parameter(description = "장소 아이디", required = true, example = "212481712381923328")
        @Min(value = 1, message = InsightValidationMessage.PLACE_ID_INVALID)
        @PathVariable long placeId,

        @Parameter(description = "판정 기준 시각. 생략하면 오늘은 지금, 다른 날은 14시 기준", example = "2026-08-27T14:00:00")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        @RequestParam(required = false) LocalDateTime targetDateTime,

        @Parameter(description = "판정 기준 일자. targetDateTime 을 주면 무시된다", example = "2026-08-27")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        @RequestParam(required = false) LocalDate targetDate,

        @Parameter(description = "반려견 크기", example = "SMALL")
        @RequestParam(required = false) PetSizeType petSizeType,

        @Parameter(description = "더위에 민감한지", example = "true")
        @RequestParam(defaultValue = "false") boolean heatSensitive,

        @Parameter(description = "추위에 민감한지", example = "false")
        @RequestParam(defaultValue = "false") boolean coldSensitive,

        @Parameter(description = "소음에 민감한지", example = "false")
        @RequestParam(defaultValue = "false") boolean noiseSensitive,

        @Parameter(description = "활동량", example = "LOW")
        @RequestParam(required = false) ActivityLevel activityLevel,

        @Parameter(description = "견종. 단두종(불독/퍼그/시츄 등)이면 고온 위험을 높게 잡는다", example = "퍼그")
        @RequestParam(required = false) String breed
    ) {
        PlaceInsightQuery query = PlaceInsightQuery.builder()
            .placeId(placeId)
            .targetDate(targetDate)
            .targetDateTime(targetDateTime)
            .petCondition(toPetCondition(petSizeType, heatSensitive, coldSensitive, noiseSensitive, activityLevel, breed))
            .build();

        return ResponseEntity.ok().body(Response.success(placeInsightWebUseCase.getWalkSafety(query)));
    }

    @Operation(summary = "장소 기간 혼잡도",
        description = "\"이번 주 언제 덜 붐비나\"에 답합니다. 적합도가 하루를 판정하는 것과 달리 기간을 봅니다. "
            + "혼잡도 예측은 30일 rolling 이라 예보(약 11일)보다 멀리까지 답할 수 있습니다 — "
            + "적합도로는 근거가 없는 날짜도 여기서는 붐빔 정도를 알 수 있습니다. "
            + "데이터가 없는 날짜도 UNKNOWN 으로 목록에 남습니다. 빠뜨리면 날짜 축에 구멍이 생겨 "
            + "사용자가 그 날을 \"한산한 날\"로 읽기 때문입니다 — UNKNOWN 은 한산함이 아니라 모름입니다.")
    @GetMapping("/{placeId}/congestions")
    public ResponseEntity<Response<PlaceCongestionResponse>> getCongestions(
        @Parameter(description = "장소 아이디", required = true, example = "212481712381923328")
        @Min(value = 1, message = InsightValidationMessage.PLACE_ID_INVALID)
        @PathVariable long placeId,

        @Parameter(description = "조회 시작일. 생략하면 오늘", example = "2026-09-01")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        @RequestParam(required = false) LocalDate fromDate,

        @Parameter(description = "조회 일수 (1~30). fromDate 부터 이 일수만큼 봅니다", example = "7")
        @Min(value = 1, message = InsightValidationMessage.CONGESTION_DAYS_RANGE_INVALID)
        @Max(value = 30, message = InsightValidationMessage.CONGESTION_DAYS_RANGE_INVALID)
        @RequestParam(defaultValue = "7") int days
    ) {
        // 종료일이 아니라 일수를 받는다. 사용자가 묻는 것은 "이번 주"나 "다음 열흘"이지
        // 특정 종료일이 아니고, 일수로 받으면 상한(30일)을 애노테이션으로 그대로 표현할 수 있다.
        LocalDate from = fromDate == null ? LocalDate.now() : fromDate;
        LocalDate to = from.plusDays(days - 1L);

        return ResponseEntity.ok().body(
            Response.success(placeInsightWebUseCase.getCongestions(placeId, from, to)));
    }

    private PetCondition toPetCondition(
        PetSizeType petSizeType, boolean heatSensitive, boolean coldSensitive, boolean noiseSensitive,
        ActivityLevel activityLevel, String breed
    ) {
        return PetCondition.builder()
            .sizeType(petSizeType)
            .heatSensitive(heatSensitive)
            .coldSensitive(coldSensitive)
            .noiseSensitive(noiseSensitive)
            .activityLevel(activityLevel)
            .breed(breed)
            .build();
    }
}
