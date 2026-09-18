package com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.item.AppliedPetActivityLevelItem;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.item.WalkCourseItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "산책 코스 목록 응답 DTO")
public record WalkCourseListResponse(

    @Schema(description = "코스 목록. 기본은 코스번호 순이다")
    List<WalkCourseItem> courses,

    @Schema(description = "조건에 맞는 코스 수. 코스는 30개 안팎이라 잘리지 않고 전부 내려간다", example = "29")
    int totalCount,

    @Schema(
        description = "적용된 반려견 활동량 필터와 그 소요시간 상한. **활동량으로 거르지 않았으면 이 객체가 통째로 null 이다** — "
            + "\"적용 안 함\"을 별도 불리언 없이 그 자체로 말한다. 객체가 있는데 maxDurationMinutes 만 null 이면 "
            + "HIGH(상한 없음)를 적용한 것이라 뜻이 다르다",
        nullable = true)
    AppliedPetActivityLevelItem appliedPetActivityLevel,

    /**
     * {@code appliedPetActivityLevel != null} 과 <b>같은 사실</b>을 말한다 — 두 곳이 같은 것을
     * 말하는 상태를 일부러 한동안 둔다.
     *
     * <p>화면이 이 값으로 "기준" 줄을 그리고 있어서(`walk-course-list-view.tsx`) 지금 빼면 그 줄이
     * 조용히 사라진다. 게다가 프론트 CI 는 {@code frontend/**} 경로에서만 돌고 목 테스트는 제 목을
     * 검증해서, <b>이 PR 이 초록인 채로 화면만 한 줄을 잃는다.</b> 그래서 새 필드를 먼저 얹고,
     * 화면이 옮겨간 뒤 별도 PR 로 이 줄을 지운다 — 화면 쪽 작업은 이슈 #735 다.
     */
    @Schema(
        description = "**deprecated — `appliedPetActivityLevel` 로 대체되었습니다.** `appliedPetActivityLevel != null` 과 "
            + "같은 값이며, 화면이 새 필드로 옮겨간 뒤 제거됩니다. 새로 붙는 화면은 이 필드를 읽지 마세요 — "
            + "상한 숫자가 없어 화면이 4시간·6시간을 직접 적게 되는 것이 이 필드를 대체하는 이유입니다",
        deprecated = true,
        example = "true")
    @Deprecated(forRemoval = true)
    boolean petActivityLevelApplied,

    @Schema(description = "정보 출처", example = "제주특별자치도 올레코스현황 · 한국관광공사 TourAPI")
    String providerName
) {
}
