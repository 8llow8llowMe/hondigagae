package com.hondigagae.domainlayer.planner.adapter.out.client;

import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PlanOutlineClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlanOutlineClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline.PlanOutlineDay;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline.PlanOutlineItem;
import com.hondigagae.domainlayer.planner.application.port.out.PlanOutlineQueryPort;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 일정 개요 조회 어댑터.
 *
 * <p>반려견 특성 어댑터와 달리 <b>호출 실패를 삼키지 않는다.</b> 재생성에서 기존 일정은
 * 있으면 좋은 값이 아니라 필수 입력이다 — 실패는 그대로 전파되어 잡이 명확한 코드로
 * 실패한다. 404(없음/남의 일정)만 빈 값으로 바꿔 호출부의 도메인 판단에 맡긴다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanOutlineClientAdapter implements PlanOutlineQueryPort {

    private static final String PLAN_SERVICE = "plan-service";

    private final PlanOutlineClient planOutlineClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public Optional<PlanOutline> findOutline(long memberId, long planId) {
        PlanOutlineClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
            PLAN_SERVICE, () -> planOutlineClient.getPlanOutline(planId, memberId));
        if (body == null) {
            log.info("Plan outline not found planId={} memberId={}", planId, memberId);
            return Optional.empty();
        }
        return Optional.of(PlanOutline.builder()
            .planId(body.planId() == null ? planId : body.planId())
            .startDate(body.startDate())
            .endDate(body.endDate())
            .days(toDays(body.days()))
            .build());
    }

    private List<PlanOutlineDay> toDays(List<PlanOutlineClientResponse.DayClientResponse> days) {
        if (days == null) {
            return List.of();
        }
        return days.stream()
            .filter(day -> day.day() != null)
            .map(day -> PlanOutlineDay.builder()
                .day(day.day())
                .items(toItems(day.items()))
                .build())
            .toList();
    }

    private List<PlanOutlineItem> toItems(List<PlanOutlineClientResponse.ItemClientResponse> items) {
        if (items == null) {
            return List.of();
        }
        return items.stream()
            .map(item -> PlanOutlineItem.builder()
                .title(item.title())
                .itemType(item.itemType())
                .placeId(item.placeId())
                .build())
            .toList();
    }
}
