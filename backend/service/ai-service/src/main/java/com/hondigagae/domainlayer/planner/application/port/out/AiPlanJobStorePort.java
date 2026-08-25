package com.hondigagae.domainlayer.planner.application.port.out;

import com.hondigagae.domainlayer.planner.domain.model.AiPlanJob;
import java.util.Optional;

public interface AiPlanJobStorePort {

    Optional<AiPlanJob> findById(String jobId);

    /**
     * (memberId, requestHash) 멱등 슬롯을 원자적으로 선점한다.
     * 선점에 성공하면 {@link Optional#empty()} — 호출자는 {@link #save(AiPlanJob)}로 진행한다.
     * 다른 동시 요청이 이미 슬롯을 가져갔다면 기존 jobId를 담아 돌려준다.
     */
    Optional<String> reserveOrGetExistingJobId(Long memberId, String requestHash, String newJobId);

    void releaseIdempotencyKey(Long memberId, String requestHash);

    AiPlanJob save(AiPlanJob job);

    void deleteJob(String jobId);
}
