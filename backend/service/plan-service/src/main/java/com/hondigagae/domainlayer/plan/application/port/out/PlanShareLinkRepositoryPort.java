package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.PlanShareLink;
import java.time.LocalDateTime;
import java.util.Optional;

public interface PlanShareLinkRepositoryPort {

    PlanShareLink save(PlanShareLink shareLink);

    Optional<PlanShareLink> findByToken(String token);

    /** 폐기되지 않았고 {@code now} 기준 아직 만료 전인 링크. 멱등 발급이 재사용한다. */
    Optional<PlanShareLink> findValidByPlanId(long planId, LocalDateTime now);

    /**
     * 해당 일정의 미폐기 링크를 전부 닫는다. 이미 폐기된 행은 건드리지 않는다.
     *
     * @return 실제로 닫힌 행 수. <b>1을 넘으면 동시 발급 경쟁이 실제로 일어났다는 뜻</b>이라 호출부가
     *         로그로 남긴다 — 그 경쟁을 관측할 다른 수단이 없다
     */
    int revokeActiveByPlanId(long planId, LocalDateTime revokedAt);
}
