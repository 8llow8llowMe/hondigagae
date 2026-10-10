package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanItemPlaceItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanItemWalkCourseItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.SharedPlanItemItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanShareLinkResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.SharedPlanResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanShareLinkInfo;
import com.hondigagae.shared.travel.plan.PlanItemType;
import org.springframework.stereotype.Component;

/**
 * 공유 링크 응답 변환 (이슈 #627).
 *
 * <p><b>{@link PlanPresenter} 와 같은 {@link PlanInfo} 를 받아 더 좁게 투영한다.</b> 조회 흐름을
 * 복제하지 않는 대신, "무엇을 빼는가" 를 이 한 곳에 모은다 — 필드를 흘리는 실수가 일어난다면
 * 여기이고, {@code PlanShareLinkPresenterTest} 가 그 자리를 지킨다.
 */
@Component
public class PlanShareLinkPresenter {

    public PlanShareLinkResponse toShareLinkResponse(PlanShareLinkInfo info) {
        return PlanShareLinkResponse.builder()
            .planId(String.valueOf(info.planId()))
            .token(info.token())
            .expiresAt(info.expiresAt())
            .build();
    }

    public SharedPlanResponse toSharedPlanResponse(PlanInfo info) {
        return SharedPlanResponse.builder()
            .title(info.title())
            .areaCode(info.areaCode())
            .sigunguCode(info.sigunguCode())
            .startDate(info.startDate())
            .endDate(info.endDate())
            .totalDays(info.totalDays())
            .status(info.status().toMetadata())
            .items(info.items().stream().map(PlanShareLinkPresenter::toSharedItem).toList())
            .build();
    }

    /**
     * {@code planItemId}·{@code memo}·{@code visited} 는 여기서 <b>읽지 않는다</b> — 주인만 쓰는 값이다.
     *
     * <p>장소·산책 코스 요약과 상태 메타데이터 변환은 소유자 상세와 <b>같은 것을 쓴다</b>
     * ({@link PlanItemPlaceItem#from}, {@link PlanItemWalkCourseItem#from},
     * {@code CodeNameDescribable.toMetadata}). 사본을 두면 필드가 늘 때 공유 응답만 비게 된다 —
     * {@code walkCourse} 가 실제로 그렇게 빠져 있었다 (#719). 이 Presenter 가 따로 갖는 책임은
     * "무엇을 빼는가" 뿐이다.
     */
    private static SharedPlanItemItem toSharedItem(PlanItemInfo info) {
        PlanItemType itemType = info.itemType();
        return SharedPlanItemItem.builder()
            .day(info.day())
            .sequence(info.sequence())
            .itemType(CodeNameDescriptionMetadata.of(itemType.name(), itemType.getDisplayName(), itemType.getDescription()))
            // Snowflake 아이디는 문자열로 내린다. 대상이 없는 항목(이동 등)은 null 을 유지한다.
            .targetId(info.targetId() == null ? null : String.valueOf(info.targetId()))
            .title(info.title())
            .startTime(info.startTime())
            .place(PlanItemPlaceItem.from(info.place()))
            // 코스 요약은 제주올레 공공데이터라 감출 값이 아니다. 빠져 있으면 WALK 항목만 제목 한
            // 줄로 남아, 장소 항목은 요약이 실리는 옆에서 비대칭이 된다.
            .walkCourse(PlanItemWalkCourseItem.from(info.walkCourse()))
            .build();
    }
}
