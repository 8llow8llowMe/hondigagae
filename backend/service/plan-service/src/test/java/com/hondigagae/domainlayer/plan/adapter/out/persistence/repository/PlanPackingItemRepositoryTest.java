package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanPackingItemEntity;
import com.hondigagae.domainlayer.plan.domain.enums.PackingItemSource;
import com.hondigagae.persistence.config.JpaAuditConfig;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

/**
 * 준비물 리포지터리의 실제 스키마 검증 — 벌크 DML 과 파생 쿼리는 컴파일로 검증되지 않는다
 * (`coding-conventions.md` §9-6).
 *
 * <p>고정하는 것은 다섯이다.
 * <ul>
 *   <li><b>같은 (planId, name) 을 지우고 곧바로 다시 넣어도 유니크 인덱스에 걸리지 않는다</b> —
 *       이 기능의 핵심 함정이다. 파생 delete 로 두면 flush 때 INSERT 가 DELETE 보다 먼저 나가 죽는다
 *   <li><b>같은 (planId, name) 두 줄은 flush 시점에 거절된다</b> — 어댑터가 저장하면서 flush 해야
 *       그 위반이 Processor 의 {@code try} 안에서 잡혀 409 가 된다
 *   <li><b>저장 직후 {@code createdAt} 이 채워진다</b> — 응답의 {@code generatedAt} 이 여기에 달려 있다
 *   <li><b>범위가 좁다</b> — source 삭제는 USER 를 남기고, 항목 삭제는 다른 일정에 닿지 않는다
 *   <li><b>정렬에 tie-break 이 있다</b> — {@code sortOrder} 가 겹쳐도 순서가 흔들리지 않는다
 * </ul>
 */
@DataJpaTest
@EntityScan("com.hondigagae.domainlayer")
@Import(JpaAuditConfig.class)
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PlanPackingItemRepositoryTest {

    /**
     * 애플리케이션 클래스({@code @EnableFeignClients}·{@code @EnableDiscoveryClient})를 슬라이스에 끌어오지
     * 않기 위한 최소 설정. 리포지터리 스캔은 자동 설정이 패키지를 모르므로 직접 지정한다.
     */
    @SpringBootConfiguration
    @EnableJpaRepositories(basePackages = "com.hondigagae.domainlayer")
    static class SliceConfig {
    }

    private static final long PLAN_ID = 100L;
    private static final long OTHER_PLAN_ID = 200L;

    @Autowired
    private PlanPackingItemRepository planPackingItemRepository;

    @Test
    @DisplayName("같은 (planId, name) 을 지우고 곧바로 다시 넣어도 유니크 인덱스에 걸리지 않는다 — 재생성의 핵심 함정")
    void reinsertsSameNameAfterBulkDeleteWithinOneTransaction() {
        planPackingItemRepository.saveAll(List.of(
            item(1L, PLAN_ID, "리드줄", PackingItemSource.AI, false, 0),
            item(2L, PLAN_ID, "물그릇", PackingItemSource.AI, false, 1)));
        planPackingItemRepository.flush();

        assertThatCode(() -> {
            planPackingItemRepository.deleteByPlanIdAndSource(PLAN_ID, PackingItemSource.AI);
            planPackingItemRepository.saveAll(List.of(
                item(11L, PLAN_ID, "리드줄", PackingItemSource.AI, true, 0),
                item(12L, PLAN_ID, "우비", PackingItemSource.AI, false, 1)));
            planPackingItemRepository.flush();
        }).doesNotThrowAnyException();

        assertThat(planPackingItemRepository.findByPlanIdOrderBySortOrderAscIdAsc(PLAN_ID))
            .extracting(PlanPackingItemEntity::getId).containsExactly(11L, 12L);
    }

    @Test
    @DisplayName("같은 (planId, name) 두 줄은 유니크 인덱스가 막고, flush 해야 그 위반이 저장 구간에서 잡힌다 — 409 로 바꾸는 전제")
    void rejectsDuplicateNameWithinPlanOnFlush() {
        planPackingItemRepository.saveAndFlush(item(1L, PLAN_ID, "리드줄", PackingItemSource.AI, false, 0));

        assertThatThrownBy(() -> planPackingItemRepository.saveAndFlush(
            item(2L, PLAN_ID, "리드줄", PackingItemSource.USER, false, 1)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("저장하면 createdAt 이 채워진다 — 응답의 generatedAt 이 AI 항목의 createdAt 에서 나온다")
    void fillsCreatedAtOnSave() {
        List<PlanPackingItemEntity> saved = planPackingItemRepository.saveAll(List.of(
            item(1L, PLAN_ID, "리드줄", PackingItemSource.AI, false, 0)));
        planPackingItemRepository.flush();

        assertThat(saved).singleElement()
            .satisfies(entity -> assertThat(entity.getCreatedAt()).isNotNull());
    }

    @Test
    @DisplayName("source 삭제는 AI 항목만 지우고 사용자 항목은 남긴다 — 재생성이 사용자 기록을 지우지 않는다")
    void deleteByPlanIdAndSourceKeepsUserItems() {
        planPackingItemRepository.saveAll(List.of(
            item(1L, PLAN_ID, "배변봉투", PackingItemSource.USER, false, 0),
            item(2L, PLAN_ID, "리드줄", PackingItemSource.AI, false, 1),
            item(3L, OTHER_PLAN_ID, "리드줄", PackingItemSource.AI, false, 0)));
        planPackingItemRepository.flush();

        planPackingItemRepository.deleteByPlanIdAndSource(PLAN_ID, PackingItemSource.AI);

        assertThat(planPackingItemRepository.findByPlanIdOrderBySortOrderAscIdAsc(PLAN_ID))
            .extracting(PlanPackingItemEntity::getId).containsExactly(1L);
        // 다른 일정은 같은 이름·같은 source 여도 남는다.
        assertThat(planPackingItemRepository.findByPlanIdOrderBySortOrderAscIdAsc(OTHER_PLAN_ID))
            .extracting(PlanPackingItemEntity::getId).containsExactly(3L);
    }

    @Test
    @DisplayName("항목 삭제는 planId 가 맞을 때만 지운다 — 항목 아이디만으로 남의 준비물을 지우는 경로를 만들지 않는다")
    void deleteByPlanIdAndIdIgnoresOtherPlan() {
        planPackingItemRepository.saveAll(List.of(
            item(9L, OTHER_PLAN_ID, "리드줄", PackingItemSource.AI, false, 0)));
        planPackingItemRepository.flush();

        planPackingItemRepository.deleteByPlanIdAndId(PLAN_ID, 9L);

        assertThat(planPackingItemRepository.findByPlanIdOrderBySortOrderAscIdAsc(OTHER_PLAN_ID))
            .extracting(PlanPackingItemEntity::getId).containsExactly(9L);

        planPackingItemRepository.deleteByPlanIdAndId(OTHER_PLAN_ID, 9L);

        assertThat(planPackingItemRepository.findByPlanIdOrderBySortOrderAscIdAsc(OTHER_PLAN_ID)).isEmpty();
    }

    @Test
    @DisplayName("sortOrder 오름차순, 같으면 아이디 오름차순으로 나온다 — 동순위에서도 순서가 흔들리지 않는다")
    void ordersBySortOrderThenId() {
        planPackingItemRepository.saveAll(List.of(
            item(30L, PLAN_ID, "우비", PackingItemSource.AI, false, 1),
            item(10L, PLAN_ID, "리드줄", PackingItemSource.AI, false, 1),
            item(20L, PLAN_ID, "물그릇", PackingItemSource.AI, false, 0)));
        planPackingItemRepository.flush();

        assertThat(planPackingItemRepository.findByPlanIdOrderBySortOrderAscIdAsc(PLAN_ID))
            .extracting(PlanPackingItemEntity::getId).containsExactly(20L, 10L, 30L);
    }

    private static PlanPackingItemEntity item(long id, long planId, String name, PackingItemSource source,
        boolean checked, int sortOrder) {
        return PlanPackingItemEntity.builder()
            .id(id).planId(planId).category("반려견 케어").name(name)
            .source(source).checked(checked).sortOrder(sortOrder)
            .build();
    }
}
