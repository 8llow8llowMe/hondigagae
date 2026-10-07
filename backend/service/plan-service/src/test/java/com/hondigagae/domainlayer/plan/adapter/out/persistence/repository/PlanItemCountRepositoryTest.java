package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanItemEntity;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlanItemCountQueryResult;
import com.hondigagae.persistence.config.JpaAuditConfig;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

/**
 * 일정 목록의 항목 수 집계 JPQL 검증 (#1242) — 컴파일로 검증되지 않아 실제 스키마에 질의해 본다.
 *
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li>여러 일자·여러 유형(장소·산책 코스)의 행이 일정별로 <b>전부</b> 합쳐진다</li>
 *   <li>묻지 않은 일정의 항목은 섞이지 않는다</li>
 *   <li>항목이 없는 일정은 행이 나오지 않는다 (호출자가 0 으로 읽는다)</li>
 * </ul>
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EntityScan("com.hondigagae.domainlayer")
@Import(JpaAuditConfig.class)
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    // plan_item.day 는 H2 예약어다 (MySQL 은 아님) — 키워드에서 빼려고 접속 URL 을 직접 지정한다
    "spring.datasource.url=jdbc:h2:mem:plan-item-count;NON_KEYWORDS=DAY;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver"
})
class PlanItemCountRepositoryTest {

    @SpringBootConfiguration
    @EnableJpaRepositories(basePackages = "com.hondigagae.domainlayer")
    static class SliceConfig {
    }

    @Autowired
    private PlanItemRepository planItemRepository;

    @Test
    @DisplayName("일정마다 모든 일자·유형의 항목을 합쳐 세고, 항목 없는 일정과 묻지 않은 일정은 결과에 없다")
    void countsEveryItemPerRequestedPlan() {
        saveItem(1L, 1, 0, PlanItemType.PLACE);
        saveItem(1L, 1, 1, PlanItemType.PLACE);
        saveItem(1L, 2, 0, PlanItemType.WALK);
        saveItem(2L, 1, 0, PlanItemType.PLACE);
        saveItem(9L, 1, 0, PlanItemType.PLACE);   // 묻지 않은 일정
        saveItem(9L, 1, 1, PlanItemType.PLACE);

        List<PlanItemCountQueryResult> results = planItemRepository.countByPlanIds(List.of(1L, 2L, 3L));

        Map<Long, Long> byPlanId = results.stream()
            .collect(Collectors.toMap(PlanItemCountQueryResult::planId, PlanItemCountQueryResult::itemCount));
        assertThat(byPlanId).containsOnly(Map.entry(1L, 3L), Map.entry(2L, 1L));
    }

    private void saveItem(long planId, int day, int sequence, PlanItemType type) {
        planItemRepository.save(PlanItemEntity.builder()
            .id(planId * 100 + day * 10 + sequence)
            .planId(planId)
            .day(day)
            .sequence(sequence)
            .itemType(type)
            .targetId(1L)
            .title("항목")
            .build());
    }
}
