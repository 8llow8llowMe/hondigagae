package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

/**
 * 추천 장소 한 곳 (#1368).
 *
 * <p>앞쪽 요약 필드는 장소 목록 항목({@code PlaceItem})과 같은 뜻 · 같은 표현이고, 뒤쪽 판정 필드는 적합도 응답
 * ({@code PlaceSuitabilityResponse})과 같은 뜻 · 같은 표현이다. 화면이 이미 가진 카드와 적합도 조각을 그대로 쓸 수 있게
 * 하위 조각(날씨 · 혼잡도 · 근거 · 실내 대안)은 적합도 응답의 Item 을 그대로 쓴다.
 */
@Builder
@Schema(description = "추천 장소 항목 DTO")
public record PlaceRecommendationItem(

    @Schema(description = "장소 아이디", example = "212481712381923328")
    String placeId,

    @Schema(description = "콘텐츠 타입 metadata")
    CodeNameDescriptionMetadata contentType,

    @Schema(description = "장소명", example = "가세오름")
    String title,

    @Schema(description = "주소", example = "제주특별자치도 서귀포시 표선면 가시리")
    String addr1,

    @Schema(description = "관광 시군구코드", example = "3")
    String sigunguCode,

    @Schema(description = "위도", example = "33.3608276172")
    Double lat,

    @Schema(description = "경도", example = "126.7818122232")
    Double lng,

    @Schema(description = "대표 이미지 원본 URL. 추천 후보는 사진이 있는 장소뿐이라 비지 않는다")
    String firstImage,

    @Schema(description = "대표 이미지 썸네일 URL", nullable = true)
    String firstImage2,

    @Schema(description = "반려동물 동반 구분 metadata. 추천에는 동반 가능(ALLOWED) · 일부 허용(PARTIALLY_ALLOWED)만 온다")
    CodeNameDescriptionMetadata petAllowanceType,

    @Schema(description = "입장 가능 체중 상한(kg). 원문에 숫자가 있을 때만 온다", example = "12", nullable = true)
    Integer maxPetWeightKg,

    @Schema(description = "실내 여부. null 이면 원천에 정보가 없다", example = "false", nullable = true)
    Boolean indoor,

    @Schema(description = "적합도 점수(0~100). 추천에 오른 장소는 점수가 있다 — 점수를 못 낸 곳은 추천하지 않는다", example = "82")
    Integer score,

    @Schema(description = "적합도 등급 metadata")
    ScoreMetricMetadata suitabilityLevel,

    @Schema(description = "서술형 결론 한 문장. 적합도 응답의 headline 과 같은 규칙이다", example = "오늘 가기 좋아요", nullable = true)
    String headline,

    @Schema(description = "판정 근거. 점수 영향이 큰 순서다")
    List<SuitabilityReasonItem> reasons,

    @Schema(description = "이 장소 격자의 그날 날씨")
    DailyWeatherItem weather,

    @Schema(description = "근거로 쓴 혼잡도 예측. 연결된 예측이 없으면 level 이 UNKNOWN 이다")
    CongestionItem congestion,

    @Schema(description = "비 예보이고 이 장소에 실내 공간이 없을 때만 채워지는 실내 대안 장소. 아니면 빈 배열")
    List<AlternativePlaceItem> indoorAlternatives,

    @Schema(description = "요청에 반려견 조건이 포함되어 판정에 반영됐는지", example = "true")
    boolean petConditionApplied,

    @Schema(description = "날씨를 근거로 썼는지", example = "true")
    boolean weatherApplied,

    @Schema(description = "혼잡도를 근거로 썼는지. false 면 그 장소에 연결된 예측 데이터가 없다", example = "false")
    boolean congestionApplied
) {

}
