package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.plan.application.info.PlanItemWalkCourseInfo;
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

    /**
     * 요약이 없으면 <b>객체 통째로 null</b> 이다 — 장소({@link PlanItemPlaceItem#from})와 같은 규칙이다.
     *
     * <p><b>변환을 여기 둔 이유</b>: 일정 상세({@code PlanPresenter})와 공유 응답
     * ({@code PlanShareLinkPresenter})이 같은 값을 내려야 한다. 각 Presenter 가 사본을 들면 필드가
     * 늘 때 한쪽만 비고, 그러면 주인이 보는 화면과 공유받은 사람이 보는 화면이 같은 항목을 다르게
     * 설명한다 — 그게 이슈 #719 가 고친 증상이다.
     */
    public static PlanItemWalkCourseItem from(PlanItemWalkCourseInfo walkCourse) {
        if (walkCourse == null) {
            return null;
        }
        return PlanItemWalkCourseItem.builder()
            .name(walkCourse.name())
            .courseLabel(walkCourse.courseLabel())
            .distanceKm(walkCourse.distanceKm())
            .durationText(walkCourse.durationText())
            .durationMaxMinutes(walkCourse.durationMaxMinutes())
            .lat(walkCourse.lat())
            .lng(walkCourse.lng())
            .firstImage(walkCourse.firstImage())
            /*
              raw enum 문자열이 아니라 metadata 객체로 내린다 (coding-conventions §11).
              같은 응답 안의 itemType 이 이미 metadata 라, 한쪽만 문자열이면 화면이 두 가지
              해석 코드를 갖게 된다. 표시명·설명은 tour-service 가 실어 준 값 그대로다.
            */
            .fitsActivityLevels(walkCourse.fitsActivityLevels().stream()
                .map(fit -> CodeNameDescriptionMetadata.of(fit.code(), fit.name(), fit.description()))
                .toList())
            .build();
    }
}
