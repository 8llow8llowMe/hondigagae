package com.hondigagae.domainlayer.plan.adapter.out.client;

import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PlanWalkCourseClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlanWalkCourseClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PlanWalkCourseQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlanWalkCourseSummaryQueryResult;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanWalkCourseClientAdapter implements PlanWalkCourseQueryPort {

    private final PlanWalkCourseClient planWalkCourseClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public List<PlanWalkCourseSummaryQueryResult> findSummaries(List<Long> walkCourseIds) {
        if (walkCourseIds.isEmpty()) {
            return List.of();
        }
        List<PlanWalkCourseClientResponse> body = internalResponseSupport.requestAndUnwrapOrNull(
            InternalResponseSupport.TOUR_SERVICE,
            () -> planWalkCourseClient.getWalkCourseSummaries(walkCourseIds));
        if (body == null) {
            throw new PlanException(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
        }
        return body.stream()
            // 아이디 없는 행만 버린다. 좌표·이미지가 없는 코스는 실제로 있고(20·18-2코스),
            // 그래도 이름표와 거리·소요시간은 화면에 쓸 수 있다.
            .filter(item -> item.walkCourseId() != null)
            .map(item -> PlanWalkCourseSummaryQueryResult.builder()
                .walkCourseId(item.walkCourseId())
                .name(item.name())
                .courseLabel(item.courseLabel())
                .distanceKm(item.distanceKm())
                .durationText(item.durationText())
                .durationMaxMinutes(item.durationMaxMinutes())
                .lat(item.lat())
                .lng(item.lng())
                .firstImage(item.firstImage())
                .fitsActivityLevels(toActivityFits(item.fitsActivityLevels()))
                .build())
            .toList();
    }

    /**
     * null 을 빈 목록으로 접는다. <b>앞으로의 변경에 대한 방어다</b> — tour-service 가 이 필드를
     * 빼거나 이름을 바꾸면 Jackson 이 null 을 넣고 컴파일·테스트는 전부 통과한다. 옛 버전 대응이
     * 아니다: 엔드포인트 자체가 없던 시절이라면 404 → {@code requestAndUnwrapOrNull} 이 null →
     * 위에서 {@code INTERNAL_SERVICE_UNAVAILABLE} 로 끊긴다.
     *
     * <p>null 을 그대로 흘리면 소비처가 "맞는 활동량이 하나도 없다"로 읽는다.
     */
    private List<PlanWalkCourseSummaryQueryResult.ActivityFit> toActivityFits(
        List<PlanWalkCourseClientResponse.ActivityFit> fits) {
        if (fits == null) {
            return List.of();
        }
        return fits.stream()
            .map(fit -> PlanWalkCourseSummaryQueryResult.ActivityFit.builder()
                .code(fit.code())
                .name(fit.name())
                .description(fit.description())
                .build())
            .toList();
    }
}
