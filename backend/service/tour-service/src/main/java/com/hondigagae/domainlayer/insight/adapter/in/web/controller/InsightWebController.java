package com.hondigagae.domainlayer.insight.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.RegionalWeatherResponse;
import com.hondigagae.domainlayer.insight.application.port.in.InsightWebUseCase;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
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
            + "`recommendedRegion` 이 null 이면 판정할 수 있는 권역이 하나도 없었다는 뜻입니다.")
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
}
