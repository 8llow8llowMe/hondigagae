package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanItemDetailItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanItemPlaceItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanItemWalkCourseItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanSummaryItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanDetailResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanEmergencyResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanEmergencyInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanSummaryInfo;
import com.hondigagae.shared.travel.plan.PlanItemType;
import com.hondigagae.persistence.dto.SliceResponse;
import java.util.List;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Component;

@Component
public class PlanPresenter {

    public PlanDetailResponse toDetailResponse(PlanInfo info) {
        List<PlanItemDetailItem> items = info.items().stream()
            .map(this::toItemDetail)
            .toList();

        return PlanDetailResponse.builder()
            .planId(String.valueOf(info.planId()))
            .petId(String.valueOf(info.petId()))
            .petIds(toIdStrings(info.petIds()))
            .areaCode(info.areaCode())
            .sigunguCode(info.sigunguCode())
            .title(info.title())
            .startDate(info.startDate())
            .endDate(info.endDate())
            .budget(info.budget())
            .status(info.status().toMetadata())
            .totalDays(info.totalDays())
            .items(items)
            .build();
    }

    public SliceResponse<PlanSummaryItem> toSliceResponse(Slice<PlanSummaryInfo> slice) {
        return SliceResponse.of(slice.map(this::toSummaryItem));
    }

    private PlanSummaryItem toSummaryItem(PlanSummaryInfo info) {
        return PlanSummaryItem.builder()
            .planId(String.valueOf(info.planId()))
            .petId(String.valueOf(info.petId()))
            .petIds(toIdStrings(info.petIds()))
            .areaCode(info.areaCode())
            .title(info.title())
            .startDate(info.startDate())
            .endDate(info.endDate())
            .status(info.status().toMetadata())
            .build();
    }

    public PlanEmergencyResponse toEmergencyResponse(PlanEmergencyInfo info) {
        return PlanEmergencyResponse.builder()
            .planId(String.valueOf(info.planId()))
            .radiusMeters(info.radiusMeters())
            .days(info.days().stream()
                .map(day -> PlanEmergencyResponse.DayItem.builder()
                    .day(day.day())
                    .spots(day.spots().stream().map(this::toEmergencySpot).toList())
                    .build())
                .toList())
            .build();
    }

    private PlanEmergencyResponse.SpotItem toEmergencySpot(PlanEmergencyInfo.SpotEmergencyInfo spot) {
        return PlanEmergencyResponse.SpotItem.builder()
            .planItemId(String.valueOf(spot.planItemId()))
            .placeId(String.valueOf(spot.placeId()))
            .title(spot.title())
            .facilities(spot.facilities().stream()
                .map(facility -> PlanEmergencyResponse.FacilityItem.builder()
                    .name(facility.name())
                    .typeName(facility.typeName())
                    .addr(facility.addr())
                    .tel(facility.tel())
                    .distanceMeters(facility.distanceMeters())
                    .open24(facility.open24())
                    .operatingHoursKnown(facility.operatingHoursKnown())
                    .build())
                .toList())
            .build();
    }

    private PlanItemDetailItem toItemDetail(PlanItemInfo info) {
        PlanItemType itemType = info.itemType();
        return PlanItemDetailItem.builder()
            .planItemId(String.valueOf(info.planItemId()))
            .day(info.day())
            .sequence(info.sequence())
            .itemType(CodeNameDescriptionMetadata.of(itemType.name(), itemType.getDisplayName(), itemType.getDescription()))
            // Snowflake 아이디는 문자열로 내린다. 대상이 없는 항목(이동 등)은 null 을 유지한다.
            .targetId(info.targetId() == null ? null : String.valueOf(info.targetId()))
            .title(info.title())
            .memo(info.memo())
            .startTime(info.startTime())
            .visited(info.visited())
            .place(PlanItemPlaceItem.from(info.place()))
            // 변환은 DTO 의 정적 팩토리에 있다 — 공유 응답(PlanShareLinkPresenter)이 같은 코드를
            // 써야 두 화면이 같은 항목을 같게 설명한다 (#719).
            .walkCourse(PlanItemWalkCourseItem.from(info.walkCourse()))
            .build();
    }

    /** Snowflake 아이디 목록은 문자열로 내린다 (coding-conventions §7-1). */
    private List<String> toIdStrings(List<Long> ids) {
        return ids == null ? List.of() : ids.stream().map(String::valueOf).toList();
    }
}
