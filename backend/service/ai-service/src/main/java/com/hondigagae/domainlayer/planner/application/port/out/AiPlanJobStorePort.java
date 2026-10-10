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

    /**
     * 멱등 슬롯 해제. <b>슬롯이 지금도 이 jobId 를 가리킬 때만</b> 지운다 — 무조건 지우면
     * 취소 후 재제출된 새 잡의 슬롯을 옛 워커가 지워, 동일 요청의 중복 실행이 열린다.
     */
    void releaseIdempotencyKey(Long memberId, String requestHash, String jobId);

    /**
     * 잡 저장. <b>이미 종결(COMPLETED/FAILED/CANCELED)로 저장된 잡은 덮지 않는다</b> —
     * 취소·타임아웃 판정과 워커 진행이 서로 다른 스레드라, 여기서 막지 않으면 낡은 스냅샷이
     * 종결된 잡을 되살린다. 반환값은 <b>이긴 쪽</b>이다: 저장이 반영됐으면 넘긴 잡, 거절됐으면
     * 저장소에 남아 있는 종결 잡. 호출자는 반환값의 상태로 반영 여부를 판단한다.
     */
    AiPlanJob save(AiPlanJob job);

    void deleteJob(String jobId);
}
