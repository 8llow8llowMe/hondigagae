package com.hondigagae.domainlayer.plan.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.repository.PlanItemRepository;
import com.hondigagae.domainlayer.plan.application.mapper.PlanMapper;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PlanItemRepositoryAdapterTest {

    @Test
    @DisplayName("빈 페이지의 항목 수 집계는 질의를 보내지 않는다 — 빈 in 절은 방언에 따라 문법 오류다")
    void emptyPlanIdsSkipsQuery() {
        PlanItemRepository repository = mock(PlanItemRepository.class);
        PlanItemRepositoryAdapter adapter = new PlanItemRepositoryAdapter(repository, mock(PlanMapper.class));

        assertThat(adapter.countByPlanIds(List.of())).isEmpty();

        verifyNoInteractions(repository);
    }
}
