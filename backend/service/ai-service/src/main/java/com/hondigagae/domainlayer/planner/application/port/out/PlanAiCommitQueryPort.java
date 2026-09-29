package com.hondigagae.domainlayer.planner.application.port.out;

import java.util.Optional;

/**
 * AI 일정 생성 작업을 담아 만든 일정 조회 계약 (#970).
 *
 * <p><b>담긴 사실의 정본은 plan-service 다.</b> 담기 멱등 키({@code sourceAiJobId})를 plan-service 가
 * 쥐고 있으므로 잡(Redis)에는 적지 않고 잡을 조회할 때마다 여기에 묻는다 — 잡에 적어 두면 TTL 과 함께
 * 사라지고, 담은 일정을 지워도 잡은 모른다.
 *
 * <p><b>관용이다 — 못 물으면 비어 있다.</b> 이 값은 잡 조회를 성립시키는 값이 아니라 "이미 담았어요" 를
 * 보여 주려고 덧붙이는 값이다. plan-service 가 흔들렸다고 초안 조회가 5xx 로 막히면 안 되고,
 * 비어 있을 때 화면이 담기를 다시 눌러도 plan-service 의 멱등 키가 같은 일정을 돌려준다.
 */
public interface PlanAiCommitQueryPort {

    /**
     * @return 담은 일정 아이디. 담은 적이 없거나, 담은 일정을 삭제했거나, 조회에 실패하면 비어 있다
     */
    Optional<Long> findCommittedPlanId(long memberId, String jobId);
}
