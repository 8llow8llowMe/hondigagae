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
            + "오늘의 시각별 예보가 없기 때문이며, 그때도 200 이고 각 권역의 `reasons` 에 이유가 담깁니다.\n\n"
            + "**필수 파라미터는 없습니다.** 전부 생략하면 오늘, 조건 없는 반려견 기준으로 비교합니다.\n\n"
            + "호출 예: `GET /api/v1/insights/regional-weather?petSizeType=SMALL&heatSensitive=true`")
    @GetMapping("/regional-weather")
    public ResponseEntity<Response<RegionalWeatherResponse>> getRegionalWeather(
        @Parameter(description = "[선택, 기본 오늘] 비교 기준 일자 (yyyy-MM-dd). 오늘~내일을 전제로 합니다", example = "2026-09-05")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        @RequestParam(required = false) LocalDate date,

        @Parameter(description = "[선택] 반려견 크기. SMALL 10kg 미만 · MEDIUM 10~25kg · LARGE 25kg 이상. 생략하면 크기 조건을 판정에 넣지 않습니다", example = "SMALL")
        @RequestParam(required = false) PetSizeType petSizeType,

        @Parameter(description = "[선택, 기본 false] 더위에 민감한지. true 면 고온 위험을 한 단계 높게 잡습니다", example = "true")
        @RequestParam(defaultValue = "false") boolean heatSensitive,

        @Parameter(description = "[선택, 기본 false] 추위에 민감한지", example = "false")
        @RequestParam(defaultValue = "false") boolean coldSensitive,

        @Parameter(description = "[선택] 활동량. LOW 짧은 산책 선호 · MEDIUM 보통 · HIGH 긴 산책 선호. 생략하면 활동량 조건을 판정에 넣지 않습니다", example = "LOW")
        @RequestParam(required = false) ActivityLevel activityLevel,

        @Parameter(description = "[선택] 견종 이름(한글). 단두종(불독·퍼그·시츄 등)이면 고온 위험을 높게 잡습니다. 생략하면 견종 보정 없음", example = "퍼그")
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
            + "`goldenStart` 가 null 이면 추천할 구간이 없다는 뜻이고, **그 이유는 `goldenWindowStatus` 로 갈라 줍니다** — "
            + "`ALL_HOURS_RISKY`(남은 시각이 전부 위험) / `SUPPRESSED_BY_WARNING`(특보 경보라 보류) / "
            + "`NO_FORECAST`(판정할 예보 없음). 경보로 보류한 날에도 곡선에는 안전 시각이 남아 있으므로 "
            + "null 하나만 보고 \"남은 시간이 모두 위험\"이라고 쓰면 화면이 곡선과 다른 말을 하게 됩니다. "
            + "아무 구간이나 골라 주면 사용자가 그것을 허락으로 읽기 때문에 주지 않습니다. "
            + "**`hourly` 가 빈 배열이어도 200 입니다.** 늦은 밤에는 오늘 남은 예보가 없는 것이 정상입니다 — "
            + "기상청은 23시 발표부터 다음 날 예보만 주므로 그 시간대에는 오늘의 시각별 예보가 원천에 없고, "
            + "재시도해도 자정 전에는 풀리지 않습니다. 빈 이유는 `forecastCoverage` 로 구분하세요 — "
            + "`DAY_ENDED` 는 정상이고 `UNAVAILABLE` 만 다시 시도할 일입니다. "
            + "추정 노면(아스팔트) 온도는 기온에 일사(날짜·시각·위도로 낸 태양 고도)·하늘상태·바람을 반영해 "
            + "계산한 값이며 실측이 아닙니다. **`temperature`(기온)와 나란히 보여 주세요** — "
            + "노면온도만 표시하면 사용자가 그것을 기온으로 읽습니다.\n\n"
            + "**필수: lat, lng.** 반려견 조건은 전부 생략 가능합니다.\n\n"
            + "호출 예: `GET /api/v1/insights/walk-times?lat=33.4996&lng=126.5312&petSizeType=SMALL&heatSensitive=true`")
    @GetMapping("/walk-times")
    public ResponseEntity<Response<WalkTimesResponse>> getWalkTimes(
        @Parameter(description = "[필수] 위도 (WGS84, -90~90)", required = true, example = "33.4996213")
        @Min(value = -90, message = InsightValidationMessage.LAT_RANGE_INVALID)
        @Max(value = 90, message = InsightValidationMessage.LAT_RANGE_INVALID)
        @RequestParam double lat,

        @Parameter(description = "[필수] 경도 (WGS84, -180~180)", required = true, example = "126.5311884")
        @Min(value = -180, message = InsightValidationMessage.LNG_RANGE_INVALID)
        @Max(value = 180, message = InsightValidationMessage.LNG_RANGE_INVALID)
        @RequestParam double lng,

        @Parameter(description = "[선택] 반려견 크기. SMALL 10kg 미만 · MEDIUM 10~25kg · LARGE 25kg 이상. 생략하면 크기 조건을 판정에 넣지 않습니다", example = "SMALL")
        @RequestParam(required = false) PetSizeType petSizeType,

        @Parameter(description = "[선택, 기본 false] 더위에 민감한지. true 면 고온 위험을 한 단계 높게 잡습니다", example = "true")
        @RequestParam(defaultValue = "false") boolean heatSensitive,

        @Parameter(description = "[선택, 기본 false] 추위에 민감한지", example = "false")
        @RequestParam(defaultValue = "false") boolean coldSensitive,

        @Parameter(description = "[선택] 활동량. LOW 짧은 산책 선호 · MEDIUM 보통 · HIGH 긴 산책 선호. 생략하면 활동량 조건을 판정에 넣지 않습니다", example = "LOW")
        @RequestParam(required = false) ActivityLevel activityLevel,

        @Parameter(description = "[선택] 견종 이름(한글). 단두종(불독·퍼그·시츄 등)이면 고온 위험을 높게 잡습니다. 생략하면 견종 보정 없음", example = "퍼그")
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
