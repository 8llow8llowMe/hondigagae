package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.command.PlanPackingItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.info.PlanPackingInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanPackingItemInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPackingItemRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.enums.PackingItemSource;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanPackingItem;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class PlanPackingProcessor {

    /** 일정당 준비물 상한. AI 가 8~15개를 내므로 사용자가 30개 넘게 덧붙이는 경우를 위한 방어다. */
    private static final int MAX_PACKING_ITEMS = 50;

    /**
     * 표시 순서 비교자. {@code toInfo} 와 out-port 의 정렬({@code findByPlanIdOrderBySortOrderAscIdAsc})이
     * <b>같은 규칙</b>이어야 한다 — 한쪽만 tie-break 이 없으면 PUT 응답 순서와 직후 GET 순서가 갈린다.
     */
    private static final Comparator<PlanPackingItem> BY_DISPLAY_ORDER =
        Comparator.comparingInt(PlanPackingItem::sortOrder).thenComparingLong(PlanPackingItem::id);

    private final PlanPackingItemRepositoryPort planPackingItemRepositoryPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;

    public PlanPackingInfo getPackingItems(Plan plan) {
        return toInfo(plan.id(), planPackingItemRepositoryPort.findByPlanId(plan.id()));
    }

    /**
     * AI 생성 결과를 저장한다 — <b>{@code source = AI} 인 행만 교체하고 사용자 항목은 남긴다.</b>
     *
     * <p>저장이 붙는 순간 "다시 뽑기" 가 파괴적 연산이 되므로 세 가지를 지킨다.
     * <ul>
     *   <li>사용자가 직접 적은 항목은 건드리지 않는다 — 말없이 지우면 되돌릴 수단이 없다
     *   <li>같은 이름의 체크 상태를 승계한다 — 짐을 반쯤 싸 둔 상태에서 재생성 한 번에
     *       체크가 전부 날아가면 안 된다. "리드줄" 이 다시 나오면 <b>같은 리드줄</b>이다
     *   <li>이름이 겹치면 사용자 것이 이긴다. AI 목록 안의 중복은 첫 것만 남긴다(LLM 이 같은 것을 두 번 낼 수 있다)
     * </ul>
     *
     * <p>중복 판정은 {@link #nameKey(String)} 로 한다 — DB 콜레이션과 규칙이 갈리면 앱이 통과시킨 것을
     * MySQL 이 유니크 인덱스로 거절해 500 이 나고, 수십 초 걸린 LLM 결과가 롤백으로 통째로 날아간다.
     *
     * <p>표시 순서는 <b>AI 0..n-1 → 살아남은 USER 항목 n, n+1, ...</b> 로 다시 매긴다. 사용자 항목의
     * {@code sortOrder} 는 추가 시점의 {@code max + 1} 이라 그대로 두면 새 AI 항목과 겹쳐 동순위가 생기고,
     * 맨 뒤에 적어 둔 항목이 AI 목록 한가운데로 끼어든다. <b>재정렬만 하고 내용·체크 상태는 건드리지 않는다.</b>
     */
    @Transactional
    public PlanPackingInfo replaceAiItems(Plan plan, List<PlanPackingItemCommand> commands) {
        List<PlanPackingItem> existing = planPackingItemRepositoryPort.findByPlanId(plan.id());

        List<PlanPackingItem> userItems = existing.stream()
            .filter(item -> item.source() == PackingItemSource.USER)
            .sorted(BY_DISPLAY_ORDER)
            .toList();
        Set<String> userNameKeys = userItems.stream()
            .map(item -> nameKey(item.name()))
            .collect(Collectors.toSet());
        Map<String, Boolean> checkedByNameKey = new HashMap<>();
        existing.stream()
            .filter(item -> item.source() == PackingItemSource.AI)
            .forEach(item -> checkedByNameKey.put(nameKey(item.name()), item.checked()));

        List<PlanPackingItem> aiItems = new ArrayList<>();
        Set<String> seenNameKeys = new HashSet<>();
        for (PlanPackingItemCommand command : commands) {
            // 사용자 항목과 이름이 겹치면 버린다 — 유니크 인덱스가 두 줄을 허용하지 않고, 사용자 것이 이긴다.
            String key = nameKey(command.name());
            if (userNameKeys.contains(key) || !seenNameKeys.add(key)) {
                continue;
            }
            aiItems.add(PlanPackingItem.builder()
                .id(snowflakeIdGenerator.generateId())
                .planId(plan.id())
                .category(command.category())
                .name(command.name())
                .reason(command.reason())
                .source(PackingItemSource.AI)
                .checked(checkedByNameKey.getOrDefault(key, false))
                // 살아남은 것끼리 0부터 다시 매긴다 — 버려진 항목의 자리를 비워 두지 않는다.
                .sortOrder(aiItems.size())
                .build());
        }

        if (userItems.size() + aiItems.size() > MAX_PACKING_ITEMS) {
            throw new PlanException(PlanErrorCode.PACKING_ITEM_LIMIT_EXCEEDED);
        }

        // AI 뒤로 사용자 항목을 다시 매긴다. 상대 순서는 기존 표시 순서를 그대로 따른다.
        List<PlanPackingItem> toSave = new ArrayList<>(aiItems);
        int nextSortOrder = aiItems.size();
        for (PlanPackingItem userItem : userItems) {
            toSave.add(userItem.withSortOrder(nextSortOrder++));
        }

        // 삭제가 먼저다. 큐잉되면 같은 (planId, name) 이 옛 행과 겹쳐 유니크 인덱스 위반으로 죽는다.
        planPackingItemRepositoryPort.deleteByPlanIdAndSource(plan.id(), PackingItemSource.AI);
        try {
            List<PlanPackingItem> saved = toSave.isEmpty()
                ? List.of() : planPackingItemRepositoryPort.saveAll(toSave);
            return toInfo(plan.id(), saved);
        } catch (DataIntegrityViolationException exception) {
            // PUT 이 LLM 결과를 저장하는 사이 같은 이름이 POST 로 들어온 경우다. 유니크 인덱스
            // (uk_plan_packing_item_plan_id_name) 위반을 그대로 두면 500 이 나간다 — 409 로 알려 준다.
            throw new PlanException(PlanErrorCode.PACKING_ITEM_NAME_DUPLICATED);
        }
    }

    /**
     * 사용자가 직접 항목을 더한다. {@code source = USER} 이고 {@code reason} 은 비운다 —
     * 이 여행 데이터를 읽은 AI 만 이유를 붙일 수 있다.
     *
     * <p>중복 판정은 {@link #nameKey(String)} 로 하고, 저장하는 {@code name} 은 사용자가 적은 표기를
     * 그대로 둔다 — 겹치는지만 DB 와 같은 규칙으로 보면 되지 사용자 입력을 고쳐 쓸 이유는 없다.
     */
    @Transactional
    public PlanPackingInfo addUserItem(Plan plan, PlanPackingItemCommand command) {
        List<PlanPackingItem> existing = planPackingItemRepositoryPort.findByPlanId(plan.id());

        if (existing.size() >= MAX_PACKING_ITEMS) {
            throw new PlanException(PlanErrorCode.PACKING_ITEM_LIMIT_EXCEEDED);
        }
        // 유니크 인덱스가 마지막 방어선이지만 그대로 두면 위반이 500 으로 나간다 — 409 로 알려 준다.
        String key = nameKey(command.name());
        if (existing.stream().anyMatch(item -> nameKey(item.name()).equals(key))) {
            throw new PlanException(PlanErrorCode.PACKING_ITEM_NAME_DUPLICATED);
        }

        int nextSortOrder = existing.stream()
            .mapToInt(PlanPackingItem::sortOrder)
            .max()
            .orElse(-1) + 1;

        PlanPackingItem saved;
        try {
            saved = planPackingItemRepositoryPort.save(PlanPackingItem.builder()
                .id(snowflakeIdGenerator.generateId())
                .planId(plan.id())
                .category(command.category())
                .name(command.name())
                .source(PackingItemSource.USER)
                .checked(false)
                .sortOrder(nextSortOrder)
                .build());
        } catch (DataIntegrityViolationException exception) {
            // 위 검사와 INSERT 사이에 같은 이름이 들어온 경우다(연타·PUT 동시 진행). 유니크 인덱스가
            // 잡아 주지만 변환하지 않으면 500 으로 나간다 — 단건 검사와 같은 409 로 맞춘다.
            throw new PlanException(PlanErrorCode.PACKING_ITEM_NAME_DUPLICATED);
        }

        List<PlanPackingItem> merged = new ArrayList<>(existing);
        merged.add(saved);
        return toInfo(plan.id(), merged);
    }

    /**
     * 챙김 체크. 소유권은 일정 기준으로 보고, 항목이 그 일정의 것인지 다시 확인한다 —
     * packingItemId 만 믿으면 남의 일정 항목을 내 planId 로 체크할 수 있다.
     *
     * <p>벌크 update 로 바꾸지 않는다 — {@code @LastModifiedDate} 감사가 돌지 않게 된다. 대신
     * <b>체크 후 같은 트랜잭션에서 목록을 다시 읽지 않는다</b>는 전제를 둔다. 여기서 도는 {@code merge} 는
     * 도메인 record 의 {@code createdAt = null} 을 관리 인스턴스에 덮어쓰므로, 같은 트랜잭션에서 목록을
     * 다시 읽으면 {@code generatedAt} 이 사라진다. 컨트롤러는 체크 결과 한 건만 돌려준다.
     */
    @Transactional
    public PlanPackingItem markChecked(Plan plan, long packingItemId, boolean checked) {
        PlanPackingItem item = findOwnedItem(plan, packingItemId);
        return planPackingItemRepositoryPort.save(item.withChecked(checked));
    }

    /** 항목 삭제. AI 항목인지 사용자 항목인지 구분하지 않는다 — 둘 다 사용자가 지울 수 있어야 한다. */
    @Transactional
    public void deleteItem(Plan plan, long packingItemId) {
        PlanPackingItem item = findOwnedItem(plan, packingItemId);
        planPackingItemRepositoryPort.deleteByPlanIdAndId(plan.id(), item.id());
    }

    /**
     * DB 콜레이션(utf8mb4_unicode_ci)은 대소문자·후행 공백을 구분하지 않는다. 중복 판정을 거기에 맞춘다.
     *
     * <p>맞추지 않으면 {@code "Poop Bag"} 과 {@code "poop bag"} 을 앱은 다르다고 보고 MySQL 은 같다고 봐서
     * 유니크 인덱스가 거절한다. <b>저장하는 {@code name} 은 원문 그대로 둔다</b> — 겹치는지만 같은 규칙으로
     * 보면 되지 사용자가 적은 표기를 고쳐 쓸 이유는 없다.
     */
    private static String nameKey(String name) {
        return name.trim().toLowerCase(Locale.ROOT);
    }

    private PlanPackingItem findOwnedItem(Plan plan, long packingItemId) {
        return planPackingItemRepositoryPort.findById(packingItemId)
            .filter(found -> found.planId() == plan.id())
            .orElseThrow(() -> new PlanException(PlanErrorCode.NOT_FOUND_PACKING_ITEM));
    }

    /**
     * {@code generatedAt} 은 AI 항목 중 가장 늦은 {@code createdAt} 이다. AI 항목이 없으면 null —
     * "이 목록이 언제 뽑힌 것인가" 는 매번 다른 결과가 나오는 기능에서 사용자가 물을 수밖에 없다.
     */
    private PlanPackingInfo toInfo(long planId, List<PlanPackingItem> items) {
        List<PlanPackingItem> sorted = items.stream()
            .sorted(BY_DISPLAY_ORDER)
            .toList();

        LocalDateTime generatedAt = sorted.stream()
            .filter(item -> item.source() == PackingItemSource.AI)
            .map(PlanPackingItem::createdAt)
            .filter(Objects::nonNull)
            .max(Comparator.naturalOrder())
            .orElse(null);

        return PlanPackingInfo.builder()
            .planId(planId)
            .items(sorted.stream().map(this::toItemInfo).toList())
            .totalCount(sorted.size())
            .checkedCount((int) sorted.stream().filter(PlanPackingItem::checked).count())
            .generatedAt(generatedAt)
            .build();
    }

    private PlanPackingItemInfo toItemInfo(PlanPackingItem item) {
        return PlanPackingItemInfo.builder()
            .packingItemId(item.id())
            .category(item.category())
            .name(item.name())
            .reason(item.reason())
            .source(item.source())
            .checked(item.checked())
            .sortOrder(item.sortOrder())
            .build();
    }
}
