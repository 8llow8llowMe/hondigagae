package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceVerifyQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.enums.PlanItemType;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;

@Component
@RequiredArgsConstructor
public class PlanCommandProcessor {

    private final PlanRepositoryPort planRepositoryPort;
    private final PlanItemRepositoryPort planItemRepositoryPort;
    private final PlaceVerifyQueryPort placeVerifyQueryPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;

    public Plan createPlan(long memberId, PlanCreateCommand command) {
        validateDateRange(command.startDate(), command.endDate());

        Plan plan = Plan.builder()
            .id(snowflakeIdGenerator.generateId())
            .memberId(memberId)
            .petId(command.petId())
            .areaCode(command.areaCode())
            .sigunguCode(command.sigunguCode())
            .title(command.title())
            .startDate(command.startDate())
            .endDate(command.endDate())
            .budget(command.budget())
            .status(PlanStatus.DRAFT)
            .deleted(false)
            .build();

        Plan saved = planRepositoryPort.save(plan);

        if (!CollectionUtils.isEmpty(command.items())) {
            validateItemDays(saved, command.items());
            verifyPlaceTargets(command.items());
            planItemRepositoryPort.saveAll(toItems(saved.id(), command.items()));
        }
        return saved;
    }

    public Plan updatePlan(Plan plan, PlanUpdateCommand command) {
        LocalDate startDate = command.startDate() != null ? command.startDate() : plan.startDate();
        LocalDate endDate = command.endDate() != null ? command.endDate() : plan.endDate();
        validateDateRange(startDate, endDate);

        Plan updated = plan.toBuilder()
            .title(command.title() != null ? command.title() : plan.title())
            .startDate(startDate)
            .endDate(endDate)
            .budget(command.budget() != null ? command.budget() : plan.budget())
            .status(command.status() != null ? command.status() : plan.status())
            .build();

        return planRepositoryPort.save(updated);
    }

    public void softDeletePlan(Plan plan) {
        planRepositoryPort.save(plan.markDeleted());
    }

    /**
     * 특정 일차의 항목을 일괄 교체한다. (삭제 후 재삽입)
     */
    public void replaceDayItems(Plan plan, int day, List<PlanItemCommand> commands) {
        if (!plan.containsDay(day)) {
            throw new PlanException(PlanErrorCode.PLAN_DAY_OUT_OF_RANGE);
        }
        List<PlanItemCommand> dayItems = commands.stream()
            .map(command -> PlanItemCommand.builder()
                .day(day)
                .sequence(command.sequence())
                .itemType(command.itemType())
                .targetId(command.targetId())
                .title(command.title())
                .memo(command.memo())
                .startTime(command.startTime())
                .build())
            .toList();

        verifyPlaceTargets(dayItems);
        planItemRepositoryPort.deleteByPlanIdAndDay(plan.id(), day);
        planItemRepositoryPort.saveAll(toItems(plan.id(), dayItems));
    }

    private void validateDateRange(LocalDate startDate, LocalDate endDate) {
        if (startDate.isAfter(endDate)) {
            throw new PlanException(PlanErrorCode.PLAN_DATE_RANGE_INVALID);
        }
    }

    private void validateItemDays(Plan plan, List<PlanItemCommand> commands) {
        boolean outOfRange = commands.stream().anyMatch(command -> !plan.containsDay(command.day()));
        if (outOfRange) {
            throw new PlanException(PlanErrorCode.PLAN_DAY_OUT_OF_RANGE);
        }
    }

    /**
     * 장소를 참조하는 항목들을 <b>한 번의 원격 호출</b>로 검증한다.
     *
     * <p>항목마다 따로 부르면 일정 하루(항목 8개 안팎) 저장에 HTTP 왕복이 8번 생긴다.
     * delisted 장소는 tour-service 가 목록에서 빼고 돌려주므로, 원천에서 사라진 장소를
     * 새 항목이 참조하는 것도 여기서 함께 막힌다.
     */
    private void verifyPlaceTargets(List<PlanItemCommand> commands) {
        Set<Long> targetIds = commands.stream()
            .filter(command -> command.itemType().isPlaceTarget() && command.targetId() != null)
            .map(PlanItemCommand::targetId)
            .collect(Collectors.toSet());
        if (targetIds.isEmpty()) {
            return;
        }

        Set<Long> visibleIds = placeVerifyQueryPort.findVisiblePlaceIds(targetIds);
        if (!visibleIds.containsAll(targetIds)) {
            throw new PlanException(PlanErrorCode.NOT_FOUND_PLAN_PLACE);
        }
    }

    /**
     * 방문 체크. 소유권은 일정 기준으로 보고, 항목이 그 일정의 것인지 다시 확인한다 —
     * planItemId 만 믿으면 남의 일정 항목을 내 planId 로 체크할 수 있다.
     */
    public PlanItem markItemVisited(Plan plan, long planItemId, boolean visited) {
        PlanItem item = planItemRepositoryPort.findById(planItemId)
            .filter(found -> found.planId() == plan.id())
            .orElseThrow(() -> new PlanException(PlanErrorCode.NOT_FOUND_PLAN_ITEM));
        return planItemRepositoryPort.save(item.withVisited(visited));
    }

    private List<PlanItem> toItems(long planId, List<PlanItemCommand> commands) {
        return commands.stream()
            .map(command -> PlanItem.builder()
                .id(snowflakeIdGenerator.generateId())
                .planId(planId)
                .day(command.day())
                .sequence(command.sequence())
                .itemType(command.itemType())
                .targetId(command.targetId())
                .title(command.title())
                .memo(command.memo())
                .startTime(command.startTime())
                .build())
            .toList();
    }
}
