package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.List;
import lombok.Builder;

/**
 * 일정 항목이 가리키는 산책 코스 요약.
 *
 * <p>필드명은 tour-service 의 코스 항목({@code WalkCourseItem})과 맞췄다 — 같은 값을 두 API 에서
 * 다른 이름으로 받으면 프론트가 변환 계층을 하나 더 만들게 된다.
 */
@Builder
@Schema(description = "일정 항목의 산책 코스 요약. 산책 항목이 아니거나 원천에서 사라진 코스면 null 이다")
public record PlanItemWalkCourseItem(

    @Schema(description = "코스명", example = "시흥-광치기", nullable = true)
    String name,

    @Schema(description = "화면이 부르는 이름표. 변형이 있으면 괄호가 붙는다", example = "3코스 (A)", nullable = true)
    String courseLabel,

    @Schema(description = "거리 (km)", example = "15.1", nullable = true)
    BigDecimal distanceKm,

    @Schema(description = "소요시간 원문", example = "4~5시간", nullable = true)
    String durationText,

    @Schema(
        description = "소요시간 상한(분). **null 은 제한 없음이 아니라 원문을 파싱하지 못했다는 뜻이다** — "
            + "화면은 durationText 원문을 보여 준다",
        example = "300", nullable = true)
    Integer durationMaxMinutes,

    @Schema(description = "시작점 위도. TourAPI 매칭에 실패한 코스는 null", example = "33.4", nullable = true)
    Double lat,

    @Schema(description = "시작점 경도", example = "126.5", nullable = true)
    Double lng,

    @Schema(description = "대표 이미지 URL. 없으면 null", example = "http://tong.visitkorea.or.kr/cms/resource/1.jpg", nullable = true)
    String firstImage,

    @Schema(
        description = "이 코스를 걸을 만한 반려견 활동량(LOW/MEDIUM/HIGH) 목록. 판정은 tour-service 가 한다. "
            + "durationMaxMinutes 가 null 인 코스는 세 값이 모두 담기는데, 이는 \"아무 아이나 된다\"가 아니라 "
            + "\"소요시간을 모른다\"는 뜻이다",
        example = "[{\"code\":\"MEDIUM\",\"name\":\"보통\",\"description\":\"일반적인 산책과 관광 일정을 소화합니다.\"}]")
    List<CodeNameDescriptionMetadata> fitsActivityLevels
) {
}
