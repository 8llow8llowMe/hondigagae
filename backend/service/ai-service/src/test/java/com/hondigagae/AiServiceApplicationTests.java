package com.hondigagae;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PlanAiCommitClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PlanOutlineClient;
import com.hondigagae.domainlayer.planner.application.port.out.PlanAiCommitQueryPort;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 컨텍스트 로딩 게이트.
 *
 * <p>ai-service 의 테스트는 전부 단위 테스트라 스프링 컨텍스트를 띄우지 않았다. 그래서 같은 대상
 * (plan-service)을 부르는 Feign 인터페이스가 {@code contextId} 없이 늘거나 겹치면 빈 이름이 충돌하는데,
 * 그 결함은 컴파일을 통과하고 dev 기동에서야 드러난다(coding-conventions §10). #970 이 plan-service 를
 * 부르는 두 번째 클라이언트({@link PlanAiCommitClient})를 더하면서 이 게이트를 둔다.
 * test 프로파일은 Eureka·Config Server 비활성이며 Redis·Ollama 에는 연결하지 않는다.
 */
@SpringBootTest
@ActiveProfiles("test")
class AiServiceApplicationTests {

    @Autowired
    private PlanOutlineClient planOutlineClient;

    @Autowired
    private PlanAiCommitClient planAiCommitClient;

    @Autowired
    private PlanAiCommitQueryPort planAiCommitQueryPort;

    @Test
    void contextLoads() {
        // plan-service 를 부르는 두 클라이언트가 서로 다른 빈으로 함께 뜬다 (contextId 로 갈린다).
        assertThat(planOutlineClient).isNotNull();
        assertThat(planAiCommitClient).isNotNull();
        assertThat(planAiCommitQueryPort).isNotNull();
    }
}
