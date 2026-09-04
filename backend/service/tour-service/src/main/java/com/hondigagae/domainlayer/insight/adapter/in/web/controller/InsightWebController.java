package com.hondigagae.domainlayer.insight.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.RegionalWeatherResponse;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.WalkTimesResponse;
import com.hondigagae.domainlayer.insight.application.exception.InsightValidationMessage;
import com.hondigagae.domainlayer.insight.application.port.in.InsightWebUseCase;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 장소에 매이지 않은 인사이트 API.
 *
 * <p>{@code PlaceInsightWebController}({@code /api/v1/places/{placeId}/...})와 경로를 나눈 이유는
 * 입력이 다르기 때문이다. 그쪽은 장소 하나를 놓고 묻고, 이쪽은 섬 전체나 좌표를 놓고 묻는다.
 */
@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/insights")
@Tag(name = "여행 인사이트 (권역)", description = "장소가 아니라 제주 전체나 좌표를 기준으로 답하는 분석 API 입니다.")
public class InsightWebController {

    private final InsightWebUseCase insightWebUseCase;

    @Operation(summary = "제주 권역 날씨 비교",
        description = "제주를 다섯 권역(제주시·서귀포·동부·서부·한라산)으로 나눠 날씨를 나란히 보여 주고, "
            + "지금 반려견과 나가기 가장 좋은 권역을 추천합니다. "
            + "한라산이 섬을 기후로 갈라 놓기 때문에 성립하는 비교입니다 — 같은 시각에 북부는 비가 오고 "
            + "남부는 개어 있는 일이 흔합니다. "
            + "판정은 장소 적합도와 **같은 날씨 규칙**을 쓰되 장소·혼잡도 항목이 없어, "
            + "이 점수는 \"이 권역이 나가기 좋은가\"이지 \"이 장소가 갈 만한가\"가 아닙니다. "
            + "예보를 못 받은 권역도 `weatherScore = null` 로 목록에 남습니다 — 지우면 사용자가 "
            + "그 권역이 조회되지 않았다는 것조차 모릅니다. "
            + "`recommendedRegion` 이 null 이면 판정할 수 있는 권역이 하나도 없었다는 뜻입니다. "
            + "늦은 밤에 오늘을 조회하면 다섯 권역이 모두 점수 없이 올 수 있습니다 — 기상청 23시 발표부터는 "
            + "오늘의 시각별 예보가 없기 때문이며, 그때도 200 이고 각 권역의 `reasons` 에 이유가 담깁니다.")
    @GetMapping("/regional-weather")
    public ResponseEntity<Response<RegionalWeatherResponse>> getRegionalWeather(
        @Parameter(description = "비교 기준 일자. 생략하면 오늘. 오늘~내일을 전제로 합니다", example = "2026-09-02")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        @RequestParam(required = false) LocalDate date,

        @Parameter(description = "반려견 크기", example = "SMALL")
        @RequestParam(required = false) PetSizeType petSizeType,

        @Parameter(description = "더위에 민감한지", example = "true")
        @RequestParam(defaultValue = "false") boolean heatSensitive,

        @Parameter(description = "추위에 민감한지", example = "false")
        @RequestParam(defaultValue = "false") boolean coldSensitive,

        @Parameter(description = "활동량", example = "LOW")
        @RequestParam(required = false) ActivityLevel activityLevel,

        @Parameter(description = "견종. 단두종(불독/퍼그/시츄 등)이면 고온 위험을 높게 잡습니다", example = "퍼그")
        @RequestParam(required = false) String breed
    ) {
        PetCondition pet = PetCondition.builder()
            .sizeType(petSizeType)
            .heatSensitive(heatSensitive)
            .coldSensitive(coldSensitive)
            .activityLevel(activityLevel)
            .breed(breed)
            .build();

        return ResponseEntity.ok().body(
            Response.success(insightWebUseCase.getRegionalWeather(date, pet)));
    }

    @Operation(summary = "오늘의 산책 골든타임",
        description = "좌표 기준으로 오늘 남은 시간의 산책 안전 등급 곡선과 가장 좋은 연속 구간을 줍니다. "
            + "장소 산책 위험도가 \"지금 나가도 되나\"를 답한다면 이쪽은 \"오늘 언제 나가야 하나\"를 답합니다 — "
            + "여름 제주에서는 낮에 어차피 못 나가고 문제는 아침이 나은지 저녁이 나은지입니다. "
            + "판정은 산책 위험도와 **같은 규칙**을 씁니다. "
            + "`goldenStart` 가 null 이면 남은 시간이 전부 위험 등급이거나 특보 경보가 발효 중이라는 뜻입니다 — "
            + "아무 구간이나 골라 주면 사용자가 그것을 허락으로 읽기 때문에 주지 않습니다. "
            + "**`hourly` 가 빈 배열이어도 200 입니다.** 늦은 밤에는 오늘 남은 예보가 없는 것이 정상입니다 — "
            + "기상청은 23시 발표부터 다음 날 예보만 주므로 그 시간대에는 오늘의 시각별 예보가 원천에 없고, "
            + "재시도해도 자정 전에는 풀리지 않습니다. 빈 이유는 `forecastCoverage` 로 구분하세요 — "
            + "`DAY_ENDED` 는 정상이고 `UNAVAILABLE` 만 다시 시도할 일입니다. "
            + "추정 노면온도는 기온에 일사와 시간대를 더해 계산한 값이며 실측이 아닙니다.")
    @GetMapping("/walk-times")
    public ResponseEntity<Response<WalkTimesResponse>> getWalkTimes(
        @Parameter(description = "위도", required = true, example = "33.4996213")
        @Min(value = -90, message = InsightValidationMessage.LAT_RANGE_INVALID)
        @Max(value = 90, message = InsightValidationMessage.LAT_RANGE_INVALID)
        @RequestParam double lat,

        @Parameter(description = "경도", required = true, example = "126.5311884")
        @Min(value = -180, message = InsightValidationMessage.LNG_RANGE_INVALID)
        @Max(value = 180, message = InsightValidationMessage.LNG_RANGE_INVALID)
        @RequestParam double lng,

        @Parameter(description = "반려견 크기", example = "SMALL")
        @RequestParam(required = false) PetSizeType petSizeType,

        @Parameter(description = "더위에 민감한지", example = "true")
        @RequestParam(defaultValue = "false") boolean heatSensitive,

        @Parameter(description = "추위에 민감한지", example = "false")
        @RequestParam(defaultValue = "false") boolean coldSensitive,

        @Parameter(description = "활동량", example = "LOW")
        @RequestParam(required = false) ActivityLevel activityLevel,

        @Parameter(description = "견종. 단두종(불독/퍼그/시츄 등)이면 고온 위험을 높게 잡습니다", example = "퍼그")
        @RequestParam(required = false) String breed
    ) {
        PetCondition pet = PetCondition.builder()
            .sizeType(petSizeType)
            .heatSensitive(heatSensitive)
            .coldSensitive(coldSensitive)
            .activityLevel(activityLevel)
            .breed(breed)
            .build();

        return ResponseEntity.ok().body(
            Response.success(insightWebUseCase.getWalkTimes(lat, lng, pet)));
    }
}
