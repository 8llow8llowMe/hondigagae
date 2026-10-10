package com.hondigagae.domainlayer.plan.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlanWalkCourseClientResponse;
import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * tour-service 산책 코스 요약 조회.
 *
 * <p>게이트웨이를 거치지 않는 내부 경로({@code /internal/v1})를 부른다. 일정 상세의 {@code WALK}
 * 항목에 코스 이름표·거리·소요시간을 붙인다 (이슈 #619). 항목마다 상세 API 를 부르면 일정 하나
 * 조회에 HTTP 왕복이 항목 수만큼 생기므로 아이디 목록을 한 번에 묻는다.
 */
@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "planWalkCourseClient"
)
public interface PlanWalkCourseClient {

    @GetMapping("/internal/v1/walk-courses/candidates")
    Response<List<PlanWalkCourseClientResponse>> getWalkCourseSummaries(
        @RequestParam("walkCourseIds") List<Long> walkCourseIds);
}
