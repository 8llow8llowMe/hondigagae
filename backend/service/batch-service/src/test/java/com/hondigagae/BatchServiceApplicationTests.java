package com.hondigagae;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.batch.core.Job;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 컨텍스트 로딩 게이트.
 *
 * <p>batch-service 의 테스트는 전부 단위 테스트라 스프링 컨텍스트를 띄우지 않았다. 그래서 잡 배선의
 * 결함 — 같은 타입({@code Step}) 빈이 10개를 넘는 상태에서 파라미터 이름으로 해소되는가,
 * {@code JobStep} 5개와 {@code .on("*")} 사슬이 조립되는가, 리스너·검증기가 빈으로 붙는가 — 는
 * 컴파일을 통과하고 dev 기동에서야 드러났다(coding-conventions §"컨텍스트 로딩 게이트"). 이 테스트가
 * 그 구멍을 막는다. test 프로파일은 H2 + Eureka 비활성이며 잡은 실행하지 않는다.
 */
@SpringBootTest
@ActiveProfiles("test")
class BatchServiceApplicationTests {

    @Autowired
    private java.util.List<Job> jobs;

    @Test
    void contextLoads() {
        // 파이프라인 + 자식 5 + 혼잡도 + 올레 코스 = 8. 잡 하나가 빈으로 조립되지 않으면 여기서 먼저 드러난다.
        assertThat(jobs).extracting(Job::getName).containsExactlyInAnyOrder(
            "placeDataPipelineJob", "placeImportJob", "cultureFacilityImportJob", "petRestaurantImportJob",
            "placeMergeJob", "placeImageBackfillJob", "congestionImportJob", "olleCourseImportJob");
    }
}
