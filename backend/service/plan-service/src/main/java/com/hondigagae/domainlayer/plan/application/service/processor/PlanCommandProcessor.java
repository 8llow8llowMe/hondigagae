package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.command.PlanCopyCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceVerifyQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetConditionRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.shared.travel.plan.PlanItemType;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
import com.hondigagae.domainlayer.plan.domain.model.PlanPetCondition;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

@Component
@RequiredArgsConstructor
public class PlanCommandProcessor {

    /** 여행 기간 상한(일). 개인 여행 기준으로 충분하고, 일자 배열과 브리핑 루프의 상한이 된다. */
    private static final int MAX_TRIP_DAYS = 30;

    /** 복제 시 제목을 생략하면 원본 뒤에 붙인다. */
    private static final String COPY_TITLE_SUFFIX = " (복사)";

    private final PlanRepositoryPort planRepositoryPort;
    private final PlanItemRepositoryPort planItemRepositoryPort;
    private final PlanPetRepositoryPort planPetRepositoryPort;
    private final PlanPetConditionRepositoryPort planPetConditionRepositoryPort;
    private final PlaceVerifyQueryPort placeVerifyQueryPort;
    private final PetConditionQueryPort petConditionQueryPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;

    /**
     * DB 쓰기 구간만 트랜잭션으로 묶는다. 반려견 확인({@link #resolvePetIds})과 장소 검증
     * ({@link #verifyPlaceTargets})은 원격 호출이라 Facade 가 <b>이 메서드에 들어오기 전에</b>
     * 수행한다 — 트랜잭션 안에서 원격 응답을 기다리면 DB 커넥션을 잡은 채 대기하게 된다
     * (architecture-guide §3 의 문서화된 예외).
     */
    @Transactional
    public Plan createPlan(long memberId, PlanCreateCommand command, List<Long> petIds) {
        validateDateRange(command.startDate(), command.endDate());

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
            planItemRepositoryPort.saveAll(toItems(saved.id(), command.items()));
        }
        return saved;
    }

    /**
     * 지난 일정을 새 {@code DRAFT} 로 복제한다. 준비물·후기·방문 체크는 가져오지 않는다.
     *
     * <p>장소 검증({@link #verifyPlaceTargets})은 부르지 않는다 — 복제는 이미 저장된 항목을
     * 옮기는 것이고, delisted 장소는 상세 규칙대로 항목은 남기고 요약만 비운다. 생성 경로처럼
     * 검증하면 delisted 참조가 있는 일정을 복제할 수 없게 된다.
     *
     * <p>동행 반려견 필터({@link #resolveCopyPetIds})는 원격 호출이라 Facade 가 트랜잭션 밖에서 부른다.
     */
    @Transactional
    public Plan copyPlan(Plan source, PlanCopyCommand command, List<Long> petIds, List<PlanItem> sourceItems) {
        validateDateRange(command.startDate(), command.endDate());
        int newTotalDays = (int) java.time.temporal.ChronoUnit.DAYS.between(command.startDate(), command.endDate()) + 1;
        if (newTotalDays != source.totalDays()) {
            throw new PlanException(PlanErrorCode.PLAN_COPY_PERIOD_MISMATCH);
        }

        Plan plan = Plan.builder()
            .id(snowflakeIdGenerator.generateId())
            .memberId(source.memberId())
            .petId(petIds.get(0))
            .areaCode(source.areaCode())
            .sigunguCode(source.sigunguCode())
            .title(resolveCopyTitle(command.title(), source.title()))
            .startDate(command.startDate())
            .endDate(command.endDate())
            .budget(source.budget())
            .status(PlanStatus.DRAFT)
            .deleted(false)
            .build();

        Plan saved = planRepositoryPort.save(plan);
        planPetRepositoryPort.saveAll(toPets(saved.id(), petIds));

        if (!CollectionUtils.isEmpty(sourceItems)) {
            List<PlanItemCommand> itemCommands = sourceItems.stream()
                .map(item -> PlanItemCommand.builder()
                    .day(item.day())
                    .sequence(item.sequence())
                    .itemType(item.itemType())
                    .targetId(item.targetId())
                    .title(item.title())
                    .memo(item.memo())
                    .startTime(item.startTime())
                    .build())
                .toList();
            validateSequenceUniqueness(itemCommands);
            planItemRepositoryPort.saveAll(toItems(saved.id(), itemCommands));
        }
        return saved;
    }

    /**
     * 복제 시 원본 동행 반려견을 따르되, 삭제됐거나 소유가 아닌 아이는 빼고 남은 아이가 없으면
     * {@link PlanErrorCode#PET_REQUIRED} 이다 — 대표 반려견 폴백은 쓰지 않는다. 원본에 실려
     * 있던 동행 구성을 최대한 유지하되, 더 이상 내 반려견이 아닌 아이는 실어 올 수 없기 때문이다.
     */
    public List<Long> resolveCopyPetIds(long memberId, List<Long> sourcePetIds) {
        if (CollectionUtils.isEmpty(sourcePetIds)) {
            throw new PlanException(PlanErrorCode.PET_REQUIRED);
        }
        Set<Long> ownedPetIds = petConditionQueryPort.findOwnedPetIds(memberId, sourcePetIds);
        List<Long> filtered = sourcePetIds.stream()
            .filter(ownedPetIds::contains)
            .toList();
        if (filtered.isEmpty()) {
            throw new PlanException(PlanErrorCode.PET_REQUIRED);
        }
        return filtered;
    }

    /**
     * 요청이 반려견을 지정하지 않았으면 <b>대표 반려견</b>으로 대신한다 — ai-service 의 생성과 같은
     * 규칙이다. 한 마리만 키우는 사용자가 담기마다 petId 를 고르게 하지 않기 위한 기본값이고,
     * 그것도 없으면 일정을 만들 수 없다 — petId 는 NOT NULL 이고 날씨 판정의 기준이기 때문이다.
     *
     * <p>지정된 petIds 는 <b>소유·존재를 auth-service 로 검증한다.</b> 검증 없이 저장하면 남의
     * petId·없는 petId 가 그대로 plan.pet_id / plan_pet 에 남고, 이후 날씨 브리핑이 특성을 못 받아
     * 그 일정만 영구히 일반 조건으로 조용히 강등된다. 원격 호출이므로 트랜잭션 밖(Facade)에서 부른다.
     */
    public List<Long> resolvePetIds(long memberId, List<Long> requested) {
        if (!CollectionUtils.isEmpty(requested)) {
            Set<Long> ownedPetIds = petConditionQueryPort.findOwnedPetIds(memberId, requested);
            if (!ownedPetIds.containsAll(requested)) {
                throw new PlanException(PlanErrorCode.NOT_FOUND_PET);
            }
            return requested;
        }
        return petConditionQueryPort.findRepresentativePetId(memberId)
            .map(List::of)
            .orElseThrow(() -> new PlanException(PlanErrorCode.PET_REQUIRED));
    }

    /**
     * 수정 경로의 동행견 확인. 소유 검증은 생성과 같은 규칙을 그대로 쓰되 <b>폴백이 없다</b>.
     *
     * <p>생성은 빈 목록을 대표 반려견으로 대신하지만, 수정에서 빈 목록은 "동행견을 모두 빼겠다"
     * 는 뜻이다. 여기서 대표 반려견으로 되살리면 사용자가 지우려던 아이가 말없이 돌아온다.
     * 일정에는 최소 한 마리가 있어야 하므로 {@code PLAN_010} 으로 거절한다.
     */
    public List<Long> resolvePetIdsForUpdate(long memberId, List<Long> requested) {
        if (CollectionUtils.isEmpty(requested)) {
            throw new PlanException(PlanErrorCode.PET_REQUIRED);
        }
        return resolvePetIds(memberId, requested);
    }

    /**
     * @param petIds {@code null} 이면 동행견을 건드리지 않는다. 목록이 오면 {@code plan.pet_id}(대표)와
     *               {@code plan_pet}(전체)을 <b>함께</b> 맞춘다 — 한쪽만 고치면 대표와 목록이 어긋난다.
     *               소유 검증은 원격 호출이라 Facade 가 트랜잭션 밖에서 미리 끝낸다
     *               ({@link #resolvePetIdsForUpdate}).
     *               <p>날씨 판정·준비물은 여기서 다시 계산하지 않는다. 다음 조회가 새 {@code petIds} 를
     *               읽어 판정하고, 이미 만든 준비물은 지우지 않는다 — 사용자가 손으로 고친 준비물을
     *               동행견 교체가 말없이 날리는 일은 없어야 한다.
     * @param petConditionsAtCompletion 일정이 <b>이번 요청으로</b> {@code COMPLETED} 가 될 때만 채워
     *               들어오는, 그 시점의 동행 반려견 특성이다. 그 외에는 {@code null} 이고 스냅샷을
     *               건드리지 않는다. 원격 조회라 Facade 가 트랜잭션 밖에서 미리 끝낸다.
     *               <p>이미 완료된 일정을 다시 완료하는 요청은 상태가 바뀌지 않으므로 다시 찍지 않는다.
     *               되돌린 뒤 다시 완료하면 <b>그 시점으로 다시 찍는다</b> — 되돌린 동안 동행견을 바꿀 수
     *               있어서(#621), 옛 스냅샷을 그대로 두면 이번 여행에 가지도 않은 아이의 특성이 기록으로 남는다.
     */
    @Transactional
    public Plan updatePlan(Plan plan, PlanUpdateCommand command, List<Long> petIds,
        Map<Long, PetConditionQueryResult> petConditionsAtCompletion) {
        LocalDate startDate = command.startDate() != null ? command.startDate() : plan.startDate();
        LocalDate endDate = command.endDate() != null ? command.endDate() : plan.endDate();
        validateDateRange(startDate, endDate);

        // 이미 완료된 일정은 다녀온 기록이다 — 동행견을 바꾸면 그때의 판정 근거가 뒤늦게 흔들린다.
        // 같은 요청으로 완료하면서 바꾸는 것은 막지 않는다. 아직 기록이 확정되기 전이다.
        if (petIds != null && plan.status() == PlanStatus.COMPLETED) {
            throw new PlanException(PlanErrorCode.PLAN_COMPLETED_PET_LOCKED);
        }

        Plan updated = plan.toBuilder()
            .title(command.title() != null ? command.title() : plan.title())
            // 대표 반려견 = 첫 번째. 생성과 같은 규칙이다.
            .petId(petIds != null ? petIds.get(0) : plan.petId())
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

        Plan saved = planRepositoryPort.save(updated);

        if (petIds != null) {
            // 삭제가 먼저다. 큐잉되면 같은 (planId, petId) 가 옛 행과 겹쳐 유니크 인덱스 위반으로 죽는다.
            planPetRepositoryPort.deleteByPlanId(saved.id());
            planPetRepositoryPort.saveAll(toPets(saved.id(), petIds));
        }
        if (petConditionsAtCompletion != null) {
            // 같은 이유로 삭제가 먼저다 — 다시 완료하는 경로가 같은 (planId, petId) 를 재사용한다.
            planPetConditionRepositoryPort.deleteByPlanId(saved.id());
            planPetConditionRepositoryPort.saveAll(toPetConditions(saved.id(), petConditionsAtCompletion));
        }
        return saved;
    }

    /**
     * 이번 요청으로 일정이 완료되는가. 이미 완료된 일정에 다시 {@code COMPLETED} 를 보내는 것은
     * 전이가 아니다 — 그때 다시 찍으면 다녀온 뒤 고친 프로필이 "그때 기준" 으로 둔갑한다.
     */
    public static boolean completesNow(Plan plan, PlanUpdateCommand command) {
        return command.status() == PlanStatus.COMPLETED && plan.status() != PlanStatus.COMPLETED;
    }

    private List<PlanPetCondition> toPetConditions(long planId, Map<Long, PetConditionQueryResult> conditions) {
        return conditions.entrySet().stream()
            .map(entry -> PlanPetCondition.of(
                snowflakeIdGenerator.generateId(), planId, entry.getKey(), entry.getValue()))
            .toList();
    }

    @Transactional
    public void softDeletePlan(Plan plan) {
        planRepositoryPort.save(plan.markDeleted());
    }

    /**
     * 특정 일차의 항목을 일괄 교체한다. (삭제 후 재삽입)
     *
     * <p>장소 검증({@link #verifyPlaceTargets})은 원격 호출이라 Facade 가 트랜잭션 밖에서 먼저 한다.
     */
    @Transactional
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
     * 새 항목이 참조하는 것도 여기서 함께 막힌다. 원격 호출이므로 트랜잭션 밖(Facade)에서 부른다.
     */
    public void verifyPlaceTargets(List<PlanItemCommand> commands) {
        if (CollectionUtils.isEmpty(commands)) {
            return;
        }
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
    @Transactional
    public PlanItem markItemVisited(Plan plan, long planItemId, boolean visited) {
        PlanItem item = planItemRepositoryPort.findById(planItemId)
            .filter(found -> found.planId() == plan.id())
            .orElseThrow(() -> new PlanException(PlanErrorCode.NOT_FOUND_PLAN_ITEM));
        return planItemRepositoryPort.save(item.withVisited(visited));
    }

    private String resolveCopyTitle(String requestedTitle, String sourceTitle) {
        if (requestedTitle != null && !requestedTitle.isBlank()) {
            return requestedTitle;
        }
        if (sourceTitle.length() + COPY_TITLE_SUFFIX.length() <= 60) {
            return sourceTitle + COPY_TITLE_SUFFIX;
        }
        return sourceTitle.substring(0, 60 - COPY_TITLE_SUFFIX.length()) + COPY_TITLE_SUFFIX;
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
