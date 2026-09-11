package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.application.command.PlanPackingItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.info.PlanPackingInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanPackingItemInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPackingItemRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.enums.PackingItemSource;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanPackingItem;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * 준비물 교체 규칙 검증 — 저장이 붙는 순간 "다시 뽑기" 가 파괴적 연산이 되므로 지켜야 할 것들이다.
 *
 * <p>고정하는 것은 넷이다.
 * <ul>
 *   <li><b>사용자 항목은 재생성에 살아남는다</b> — 직접 적어 둔 것을 말없이 지우면 되돌릴 수단이 없다
 *   <li><b>체크 상태는 이름으로 승계된다</b> — "리드줄" 이 다시 나오면 같은 리드줄이다
 *   <li><b>이름이 겹치면 사용자 것이 이긴다</b> — 유니크 인덱스가 두 줄을 허용하지 않는다
 *   <li><b>남의 일정 항목은 아이디를 알아도 손대지 못한다</b> — planId 로 한 번 더 확인한다
 * </ul>
 */
class PlanPackingProcessorTest {

    private static final long MEMBER_ID = 1L;
    private static final long PLAN_ID = 100L;
    private static final long OTHER_PLAN_ID = 200L;

    private StubPlanPackingItemRepositoryPort repositoryPort;
    private PlanPackingProcessor processor;

    @BeforeEach
    void setUp() {
        repositoryPort = new StubPlanPackingItemRepositoryPort();
        processor = new PlanPackingProcessor(repositoryPort, new SnowflakeIdGenerator(1, 1));
    }

    private static Plan plan() {
        return Plan.builder()
            .id(PLAN_ID)
            .memberId(MEMBER_ID)
            .petId(7L)
            .areaCode("39")
            .title("몽실이와 제주 2박 3일")
            .startDate(LocalDate.of(2026, 9, 12))
            .endDate(LocalDate.of(2026, 9, 14))
            .status(PlanStatus.DRAFT)
            .build();
    }

    private static PlanPackingItemCommand command(String name) {
        return PlanPackingItemCommand.builder().category("반려견 케어").name(name).reason(name + " 가 필요합니다.").build();
    }

    private static PlanPackingItem stored(long id, long planId, String name, PackingItemSource source, boolean checked, int sortOrder) {
        return PlanPackingItem.builder()
            .id(id).planId(planId).category("반려견 케어").name(name)
            .source(source).checked(checked).sortOrder(sortOrder)
            .build();
    }

    @Test
    @DisplayName("AI 항목을 교체해도 사용자가 직접 추가한 항목은 남는다 — 재생성이 사용자 기록을 지우지 않는다")
    void keepsUserItemsOnReplace() {
        repositoryPort.items.add(stored(1L, PLAN_ID, "배변봉투", PackingItemSource.USER, false, 0));
        repositoryPort.items.add(stored(2L, PLAN_ID, "리드줄", PackingItemSource.AI, false, 1));

        PlanPackingInfo info = processor.replaceAiItems(plan(), List.of(command("우비")));

        assertThat(info.items()).extracting(PlanPackingItemInfo::name).containsExactlyInAnyOrder("배변봉투", "우비");
        // 옛 AI 항목("리드줄")만 사라졌다.
        assertThat(info.items()).extracting(PlanPackingItemInfo::source)
            .containsExactlyInAnyOrder(PackingItemSource.USER, PackingItemSource.AI);
        assertThat(repositoryPort.deletedSources).containsExactly(PackingItemSource.AI);
    }

    @Test
    @DisplayName("같은 이름이 다시 나오면 챙김 체크를 승계한다 — 짐을 반쯤 싼 상태에서 다시 뽑아도 체크가 날아가지 않는다")
    void inheritsCheckedByName() {
        repositoryPort.items.add(stored(2L, PLAN_ID, "리드줄", PackingItemSource.AI, true, 0));
        repositoryPort.items.add(stored(3L, PLAN_ID, "물그릇", PackingItemSource.AI, false, 1));

        PlanPackingInfo info = processor.replaceAiItems(plan(), List.of(command("리드줄"), command("물그릇"), command("우비")));

        assertThat(info.items()).filteredOn(item -> item.name().equals("리드줄")).singleElement()
            .extracting(PlanPackingItemInfo::checked).isEqualTo(true);
        assertThat(info.items()).filteredOn(item -> item.name().equals("물그릇")).singleElement()
            .extracting(PlanPackingItemInfo::checked).isEqualTo(false);
        // 없던 이름은 체크되지 않은 채로 들어온다.
        assertThat(info.items()).filteredOn(item -> item.name().equals("우비")).singleElement()
            .extracting(PlanPackingItemInfo::checked).isEqualTo(false);
        assertThat(info.checkedCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("사용자 항목과 이름이 겹치는 AI 항목은 버린다 — 유니크 인덱스가 두 줄을 허용하지 않고 사용자 것이 이긴다")
    void dropsAiItemsCollidingWithUserNames() {
        repositoryPort.items.add(stored(1L, PLAN_ID, "리드줄", PackingItemSource.USER, true, 0));

        PlanPackingInfo info = processor.replaceAiItems(plan(), List.of(command("리드줄"), command("우비")));

        assertThat(info.items()).extracting(PlanPackingItemInfo::name).containsExactlyInAnyOrder("리드줄", "우비");
        // 살아남은 "리드줄" 은 사용자 것이고 체크도 그대로다.
        assertThat(info.items()).filteredOn(item -> item.name().equals("리드줄")).singleElement()
            .satisfies(item -> {
                assertThat(item.source()).isEqualTo(PackingItemSource.USER);
                assertThat(item.checked()).isTrue();
            });
    }

    @Test
    @DisplayName("AI 목록 안에서 이름이 겹치면 첫 것만 남고, 표시 순서는 살아남은 것끼리 0부터 다시 매겨진다")
    void collapsesDuplicateNamesWithinAiList() {
        PlanPackingInfo info = processor.replaceAiItems(
            plan(), List.of(command("리드줄"), command("리드줄"), command("우비")));

        assertThat(info.items()).extracting(PlanPackingItemInfo::name).containsExactly("리드줄", "우비");
        assertThat(info.items()).extracting(PlanPackingItemInfo::sortOrder).containsExactly(0, 1);
        assertThat(info.totalCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("사용자 항목까지 합쳐 50개를 넘기면 400 PACKING_ITEM_LIMIT_EXCEEDED — 삭제 전에 막아 기존 목록을 잃지 않는다")
    void rejectsWhenExceedingLimitOnReplace() {
        IntStream.range(0, 50).forEach(index ->
            repositoryPort.items.add(stored(index + 1L, PLAN_ID, "사용자항목" + index, PackingItemSource.USER, false, index)));

        assertThatThrownBy(() -> processor.replaceAiItems(plan(), List.of(command("리드줄"))))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PACKING_ITEM_LIMIT_EXCEEDED);
        // 상한 검사는 삭제보다 먼저다 — 거부된 요청이 기존 목록을 지우면 안 된다.
        assertThat(repositoryPort.deletedSources).isEmpty();
        assertThat(repositoryPort.items).hasSize(50);
    }

    @Test
    @DisplayName("직접 추가할 때 같은 이름이 이미 있으면 409 PACKING_ITEM_NAME_DUPLICATED — 유니크 인덱스 위반을 500 으로 내보내지 않는다")
    void rejectsDuplicateNameOnAdd() {
        repositoryPort.items.add(stored(2L, PLAN_ID, "리드줄", PackingItemSource.AI, false, 0));

        assertThatThrownBy(() -> processor.addUserItem(plan(), command("리드줄")))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PACKING_ITEM_NAME_DUPLICATED);
        assertThat(repositoryPort.items).hasSize(1);
    }

    @Test
    @DisplayName("직접 추가한 항목은 USER 이고 이유가 비어 있으며 표시 순서는 맨 뒤다")
    void addsUserItemAtTheEnd() {
        repositoryPort.items.add(stored(2L, PLAN_ID, "리드줄", PackingItemSource.AI, false, 0));
        repositoryPort.items.add(stored(3L, PLAN_ID, "물그릇", PackingItemSource.AI, false, 1));

        PlanPackingInfo info = processor.addUserItem(plan(), command("배변봉투"));

        assertThat(info.items()).last().satisfies(item -> {
            assertThat(item.name()).isEqualTo("배변봉투");
            assertThat(item.source()).isEqualTo(PackingItemSource.USER);
            assertThat(item.reason()).isNull();
            assertThat(item.sortOrder()).isEqualTo(2);
        });
    }

    @Test
    @DisplayName("남의 일정 항목 아이디로 체크하면 404 NOT_FOUND_PACKING_ITEM — packingItemId 만 믿지 않는다")
    void rejectsCheckOnOtherPlansItem() {
        repositoryPort.items.add(stored(9L, OTHER_PLAN_ID, "리드줄", PackingItemSource.AI, false, 0));

        assertThatThrownBy(() -> processor.markChecked(plan(), 9L, true))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.NOT_FOUND_PACKING_ITEM);
    }

    @Test
    @DisplayName("남의 일정 항목 아이디로 삭제하면 404 NOT_FOUND_PACKING_ITEM — 남의 준비물이 지워지지 않는다")
    void rejectsDeleteOnOtherPlansItem() {
        repositoryPort.items.add(stored(9L, OTHER_PLAN_ID, "리드줄", PackingItemSource.AI, false, 0));

        assertThatThrownBy(() -> processor.deleteItem(plan(), 9L))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.NOT_FOUND_PACKING_ITEM);
        assertThat(repositoryPort.items).hasSize(1);
    }

    @Test
    @DisplayName("대소문자·앞뒤 공백만 다른 이름은 같은 것으로 본다 — DB 콜레이션(utf8mb4_unicode_ci)과 규칙이 갈리면 저장이 500 으로 죽는다")
    void treatsNamesAsEqualIgnoringCaseAndSurroundingSpace() {
        repositoryPort.items.add(stored(1L, PLAN_ID, "Poop Bag", PackingItemSource.USER, false, 0));

        PlanPackingInfo info = processor.replaceAiItems(
            plan(), List.of(command("poop bag"), command("리드줄 "), command("리드줄")));

        // "poop bag" 은 사용자 항목과 같은 것으로 보고 버린다. "리드줄 " / "리드줄" 도 서로 같은 것이다.
        assertThat(info.items()).extracting(PlanPackingItemInfo::name).containsExactly("리드줄 ", "Poop Bag");
    }

    @Test
    @DisplayName("직접 추가에서도 대소문자·공백만 다른 이름은 409 — 앱이 통과시킨 것을 MySQL 이 거절하게 두지 않는다")
    void rejectsDuplicateNameIgnoringCaseOnAdd() {
        repositoryPort.items.add(stored(2L, PLAN_ID, "리드줄", PackingItemSource.AI, false, 0));

        assertThatThrownBy(() -> processor.addUserItem(plan(), command(" 리드줄 ")))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PACKING_ITEM_NAME_DUPLICATED);
    }

    @Test
    @DisplayName("유니크 인덱스 위반이 나도 409 로 바꾼다 — 동시 요청에서 500 이 나가지 않게 하는 마지막 방어선")
    void translatesDataIntegrityViolationToConflict() {
        repositoryPort.failOnSaveWithDuplicate = true;

        assertThatThrownBy(() -> processor.addUserItem(plan(), command("리드줄")))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PACKING_ITEM_NAME_DUPLICATED);
        assertThatThrownBy(() -> processor.replaceAiItems(plan(), List.of(command("리드줄"))))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PACKING_ITEM_NAME_DUPLICATED);
    }

    @Test
    @DisplayName("재생성하면 사용자 항목이 AI 목록 뒤로 다시 매겨진다 — sortOrder 가 겹치면 적어 둔 것이 한가운데로 끼어든다")
    void movesUserItemsBehindAiItemsOnReplace() {
        repositoryPort.items.add(stored(1L, PLAN_ID, "배변봉투", PackingItemSource.USER, false, 10));
        repositoryPort.items.add(stored(2L, PLAN_ID, "여분 수건", PackingItemSource.USER, false, 11));

        PlanPackingInfo info = processor.replaceAiItems(plan(), List.of(command("리드줄"), command("우비")));

        assertThat(info.items()).extracting(PlanPackingItemInfo::name)
            .containsExactly("리드줄", "우비", "배변봉투", "여분 수건");
        assertThat(info.items()).extracting(PlanPackingItemInfo::sortOrder).containsExactly(0, 1, 2, 3);
        // 재정렬만 한다 — 체크 상태는 그대로다.
        assertThat(info.checkedCount()).isZero();
    }

    @Test
    @DisplayName("generatedAt 은 AI 항목 중 가장 늦은 createdAt 이다 — 사용자 항목이 더 늦게 저장돼 있어도 끌려가지 않는다")
    void generatedAtIsLatestCreatedAtAmongAiItems() {
        LocalDateTime userSavedAt = LocalDateTime.of(2030, 1, 1, 0, 0);
        repositoryPort.items.add(stored(1L, PLAN_ID, "배변봉투", PackingItemSource.USER, false, 0)
            .toBuilder().createdAt(userSavedAt).build());

        PlanPackingInfo info = processor.replaceAiItems(plan(), List.of(command("리드줄"), command("우비")));

        LocalDateTime latestAiCreatedAt = repositoryPort.items.stream()
            .filter(item -> item.source() == PackingItemSource.AI)
            .map(PlanPackingItem::createdAt)
            .max(Comparator.naturalOrder())
            .orElseThrow();
        assertThat(info.generatedAt()).isNotNull().isEqualTo(latestAiCreatedAt).isBefore(userSavedAt);
    }

    @Test
    @DisplayName("AI 항목이 하나도 없으면 generatedAt 은 null 이다 — 뽑은 적 없는 목록에 생성 시각을 붙이지 않는다")
    void generatedAtIsNullWithoutAiItems() {
        repositoryPort.items.add(stored(1L, PLAN_ID, "배변봉투", PackingItemSource.USER, false, 0));

        PlanPackingInfo info = processor.replaceAiItems(plan(), List.of());

        assertThat(info.generatedAt()).isNull();
        assertThat(info.items()).extracting(PlanPackingItemInfo::name).containsExactly("배변봉투");
    }

    @Test
    @DisplayName("checkedCount 는 체크된 항목 수와 같다 — 승계된 AI 항목과 사용자 항목을 함께 센다")
    void checkedCountMatchesCheckedItems() {
        repositoryPort.items.add(stored(1L, PLAN_ID, "배변봉투", PackingItemSource.USER, true, 0));
        repositoryPort.items.add(stored(2L, PLAN_ID, "리드줄", PackingItemSource.AI, true, 1));
        repositoryPort.items.add(stored(3L, PLAN_ID, "물그릇", PackingItemSource.AI, false, 2));

        PlanPackingInfo info = processor.replaceAiItems(plan(), List.of(command("리드줄"), command("우비")));

        // 리드줄(체크 승계) + 배변봉투(사용자 항목) = 2
        assertThat(info.totalCount()).isEqualTo(3);
        assertThat(info.checkedCount()).isEqualTo(2);
        assertThat(info.items()).filteredOn(PlanPackingItemInfo::checked)
            .extracting(PlanPackingItemInfo::name).containsExactlyInAnyOrder("리드줄", "배변봉투");
    }

    // ── 스텁 ───────────────────────────────────────────────────────────────

    /**
     * 저장소 대역. <b>저장 시 {@code createdAt} 을 채운다</b> — 이게 없으면 {@code generatedAt} 이 늘 null 이라
     * 응답 필드를 단언할 수 없다. 이미 채워진 항목은 그대로 둔다 (DB 의 {@code created_at} 은 updatable=false 다).
     */
    private static class StubPlanPackingItemRepositoryPort implements PlanPackingItemRepositoryPort {

        private final List<PlanPackingItem> items = new ArrayList<>();
        private final List<PackingItemSource> deletedSources = new ArrayList<>();
        private LocalDateTime clock = LocalDateTime.of(2026, 9, 11, 14, 0, 0);
        private boolean failOnSaveWithDuplicate;

        @Override
        public List<PlanPackingItem> saveAll(List<PlanPackingItem> saving) {
            if (failOnSaveWithDuplicate) {
                throw new DataIntegrityViolationException("uk_plan_packing_item_plan_id_name");
            }
            List<PlanPackingItem> saved = saving.stream().map(this::stamp).toList();
            saved.forEach(item -> items.removeIf(stored -> stored.id() == item.id()));
            items.addAll(saved);
            return saved;
        }

        @Override
        public List<PlanPackingItem> findByPlanId(long planId) {
            return items.stream()
                .filter(item -> item.planId() == planId)
                .sorted(Comparator.comparingInt(PlanPackingItem::sortOrder).thenComparingLong(PlanPackingItem::id))
                .toList();
        }

        @Override
        public Optional<PlanPackingItem> findById(long packingItemId) {
            return items.stream().filter(item -> item.id() == packingItemId).findFirst();
        }

        @Override
        public PlanPackingItem save(PlanPackingItem item) {
            if (failOnSaveWithDuplicate) {
                throw new DataIntegrityViolationException("uk_plan_packing_item_plan_id_name");
            }
            PlanPackingItem saved = stamp(item);
            items.removeIf(stored -> stored.id() == saved.id());
            items.add(saved);
            return saved;
        }

        /** 저장 순서대로 1초씩 늦은 시각을 준다 — "가장 늦은 AI 항목" 을 골라내는지 볼 수 있게. */
        private PlanPackingItem stamp(PlanPackingItem item) {
            if (item.createdAt() != null) {
                return item;
            }
            clock = clock.plusSeconds(1);
            return item.toBuilder().createdAt(clock).build();
        }

        @Override
        public void deleteByPlanIdAndSource(long planId, PackingItemSource source) {
            deletedSources.add(source);
            items.removeIf(item -> item.planId() == planId && item.source() == source);
        }

        @Override
        public void deleteByPlanIdAndId(long planId, long packingItemId) {
            items.removeIf(item -> item.planId() == planId && item.id() == packingItemId);
        }
    }
}
