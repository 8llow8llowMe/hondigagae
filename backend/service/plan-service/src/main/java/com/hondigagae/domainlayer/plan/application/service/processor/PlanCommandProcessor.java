package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceVerifyQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.enums.PlanItemType;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
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

    /** 여행 기간 상한(일). 개인 여행 기준으로 충분하고, 일자 배열과 브리핑 루프의 상한이 된다. */
    private static final int MAX_TRIP_DAYS = 30;

    private final PlanRepositoryPort planRepositoryPort;
    private final PlanItemRepositoryPort planItemRepositoryPort;
    private final PlanPetRepositoryPort planPetRepositoryPort;
    private final PlaceVerifyQueryPort placeVerifyQueryPort;
    private final PetConditionQueryPort petConditionQueryPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;

    public Plan createPlan(long memberId, PlanCreateCommand command) {
        validateDateRange(command.startDate(), command.endDate());
        List<Long> petIds = resolvePetIds(memberId, command.petIds());

        Plan plan = Plan.builder()
            .id(snowflakeIdGenerator.generateId())
            .memberId(memberId)
            // 대표 반려견 = 첫 번째. 목록 전체는 plan_pet 에 따로 둔다.
            .petId(petIds.get(0))
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
        planPetRepositoryPort.saveAll(toPets(saved.id(), petIds));

        if (!CollectionUtils.isEmpty(command.items())) {
            validateItemDays(saved, command.items());
            validateSequenceUniqueness(command.items());
            verifyPlaceTargets(command.items());
            planItemRepositoryPort.saveAll(toItems(saved.id(), command.items()));
        }
        return saved;
    }

    /**
     * 요청이 반려견을 지정하지 않았으면 <b>대표 반려견</b>으로 대신한다 — ai-service 의 생성과 같은
     * 규칙이다. 한 마리만 키우는 사용자가 담기마다 petId 를 고르게 하지 않기 위한 기본값이고,
     * 그것도 없으면 일정을 만들 수 없다 — petId 는 NOT NULL 이고 날씨 판정의 기준이기 때문이다.
     */
    private List<Long> resolvePetIds(long memberId, List<Long> requested) {
        if (!CollectionUtils.isEmpty(requested)) {
            return requested;
        }
        return petConditionQueryPort.findRepresentativePetId(memberId)
            .map(List::of)
            .orElseThrow(() -> new PlanException(PlanErrorCode.PET_REQUIRED));
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

        // 기간을 줄이면 범위 밖 일차의 항목이 고아가 된다 — 조용히 남기면 상세와 날씨 브리핑이 어긋나므로
        // 사용자가 항목을 먼저 정리하도록 거부한다. 자동 삭제는 사용자의 기록을 말없이 지우는 일이라 하지 않는다.
        if (updated.totalDays() < plan.totalDays()) {
            boolean hasOrphanItems = planItemRepositoryPort.findByPlanId(plan.id()).stream()
                .anyMatch(item -> item.day() > updated.totalDays());
            if (hasOrphanItems) {
                throw new PlanException(PlanErrorCode.PLAN_PERIOD_SHRINK_CONFLICT);
            }
        }

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

        validateSequenceUniqueness(dayItems);
        verifyPlaceTargets(dayItems);
        planItemRepositoryPort.deleteByPlanIdAndDay(plan.id(), day);
        planItemRepositoryPort.saveAll(toItems(plan.id(), dayItems));
    }

    private void validateDateRange(LocalDate startDate, LocalDate endDate) {
        if (startDate.isAfter(endDate)) {
            throw new PlanException(PlanErrorCode.PLAN_DATE_RANGE_INVALID);
        }
        // 상한 없는 기간은 일자 배열·브리핑 루프를 무한정 키운다. 과거 날짜는 기록용으로 허용한다.
        if (java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate) + 1 > MAX_TRIP_DAYS) {
            throw new PlanException(PlanErrorCode.PLAN_PERIOD_TOO_LONG);
        }
    }

    private void validateItemDays(Plan plan, List<PlanItemCommand> commands) {
        // day 는 일자별 교체 경로에서 생략 가능하도록 Integer 다. 생성 경로에서는 여기서 필수를 강제한다.
        if (commands.stream().anyMatch(command -> command.day() == null)) {
            throw new PlanException(PlanErrorCode.ITEM_DAY_REQUIRED);
        }
        boolean outOfRange = commands.stream().anyMatch(command -> !plan.containsDay(command.day()));
        if (outOfRange) {
            throw new PlanException(PlanErrorCode.PLAN_DAY_OUT_OF_RANGE);
        }
    }

    /**
     * (day, sequence) 중복을 저장 전에 거른다. DB 유니크 인덱스(uk_plan_item_plan_id_day_sequence)가
     * 마지막 방어선이지만, 그대로 두면 위반이 500 으로 나간다 — 사용자 입력 문제는 400 으로 알려 준다.
     */
    private void validateSequenceUniqueness(List<PlanItemCommand> commands) {
        long distinctCount = commands.stream()
            .map(command -> command.day() + ":" + command.sequence())
            .distinct()
            .count();
        if (distinctCount != commands.size()) {
            throw new PlanException(PlanErrorCode.ITEM_SEQUENCE_DUPLICATED);
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

    private List<PlanPet> toPets(long planId, List<Long> petIds) {
        return petIds.stream()
            .map(petId -> PlanPet.builder()
                .id(snowflakeIdGenerator.generateId())
                .planId(planId)
                .petId(petId)
                .build())
            .toList();
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
