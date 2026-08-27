package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PlanDayWeatherInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceSuitabilityQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import com.hondigagae.domainlayer.plan.domain.enums.PlanItemType;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 일정 날씨 브리핑 산출.
 *
 * <p><b>일자마다 대표 장소 한 곳만 조회한다.</b> 항목마다 부르면 3박 4일 일정에 열 번 넘는
 * 원격 호출이 생기고, 그만큼 타임아웃 위험이 커진다. 하루 안의 항목들은 대개 같은 격자에
 * 들어가 날씨가 거의 같으므로, 대표 한 곳이면 "그날 우산 필요한가"에 답이 된다.
 *
 * <p>항목 단위 판정이 필요해지는 순간은 <b>산책 위험도</b>다. 그것은 시각에 따라 갈리므로
 * 같은 방식으로 접을 수 없고, 별도 조회로 다뤄야 한다.
 *
 * <p>좌표 없는 항목(이동 등)은 대표에서 제외한다. {@code targetId} 가 있는 장소성 항목만
 * 대표가 될 수 있다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanWeatherProcessor {

    private static final String NO_PLACE_ITEM = "이 날짜에는 장소가 지정된 일정 항목이 없어 날씨를 붙이지 못했습니다.";
    private static final String LOOKUP_FAILED = "날씨 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.";

    private final PlanItemRepositoryPort planItemRepositoryPort;
    private final PetConditionQueryPort petConditionQueryPort;
    private final PlaceSuitabilityQueryPort placeSuitabilityQueryPort;

    public PlanWeatherInfo brief(long memberId, Plan plan) {
        PetConditionQueryResult pet = petConditionQueryPort.findCondition(memberId, plan.petId());
        Map<Integer, List<PlanItem>> itemsByDay = planItemRepositoryPort.findByPlanId(plan.id()).stream()
            .collect(Collectors.groupingBy(PlanItem::day));

        List<PlanDayWeatherInfo> days = new ArrayList<>();
        for (int day = 1; day <= plan.totalDays(); day++) {
            days.add(briefDay(plan, day, itemsByDay.getOrDefault(day, List.of()), pet));
        }

        return PlanWeatherInfo.builder()
            .planId(plan.id())
            .planTitle(plan.title())
            .startDate(plan.startDate())
            .endDate(plan.endDate())
            // 반려견 특성을 실제로 받아왔는지. 못 받았으면 일반 조건으로 판정된 결과다.
            .petConditionApplied(pet.sizeType() != null || pet.heatSensitive() || pet.coldSensitive()
                || pet.noiseSensitive() || pet.breed() != null)
            .days(days)
            .build();
    }

    private PlanDayWeatherInfo briefDay(Plan plan, int day, List<PlanItem> items, PetConditionQueryResult pet) {
        LocalDate date = plan.startDate().plusDays(day - 1L);

        Optional<PlanItem> representative = pickRepresentative(items);
        if (representative.isEmpty()) {
            return PlanDayWeatherInfo.unavailable(day, date, NO_PLACE_ITEM);
        }

        PlanItem item = representative.get();
        Optional<PlaceSuitabilityQueryResult> suitability =
            placeSuitabilityQueryPort.findSuitability(item.targetId(), date, pet);
        if (suitability.isEmpty()) {
            log.info("Plan weather unavailable planId={} day={} placeId={}", plan.id(), day, item.targetId());
            return PlanDayWeatherInfo.builder()
                .day(day).date(date)
                .representativePlaceId(item.targetId())
                .representativePlaceTitle(item.title())
                .unavailableReason(LOOKUP_FAILED)
                .build();
        }

        return PlanDayWeatherInfo.builder()
            .day(day)
            .date(date)
            .representativePlaceId(item.targetId())
            .representativePlaceTitle(item.title())
            .suitability(suitability.get())
            .build();
    }

    /**
     * 그날의 대표 장소.
     *
     * <p>가장 이른 순서의 장소성 항목을 쓴다. 하루의 첫 목적지가 그날 동선의 기준점이고,
     * 사용자도 보통 그곳을 떠올린다.
     */
    private Optional<PlanItem> pickRepresentative(List<PlanItem> items) {
        return items.stream()
            .filter(item -> item.targetId() != null)
            .filter(item -> item.itemType() != PlanItemType.MOVE)
            .min(Comparator.comparingInt(PlanItem::sequence));
    }
}
