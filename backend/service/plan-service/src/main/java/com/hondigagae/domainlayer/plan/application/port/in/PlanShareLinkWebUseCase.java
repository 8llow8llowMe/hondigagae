package com.hondigagae.domainlayer.plan.application.port.in;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanShareLinkResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.SharedPlanResponse;

/**
 * 일정 읽기 전용 공유 링크 (이슈 #627).
 *
 * <p>소유자 3종과 공개 조회가 한 유스케이스에 있다 — 컨트롤러는 인증 경계 때문에 둘로 나뉘지만
 * 발급·폐기와 해석은 같은 규칙(만료·폐기·공유 가능 상태)을 공유한다.
 */
public interface PlanShareLinkWebUseCase {

    /** 공유 링크 발급. 유효한 링크가 이미 있으면 그것을 그대로 돌려준다 (멱등). */
    PlanShareLinkResponse issueShareLink(long memberId, long planId);

    /**
     * 소유자가 보는 현재 유효한 링크.
     *
     * @return 유효한 링크. <b>한 번도 발급하지 않았거나 폐기·만료됐으면 {@code null}</b> 이다 — 오류가 아니라
     *         "공유 중이 아님" 이라는 정상 상태라 200 + {@code dataBody} null 로 나간다 (#979).
     *         일정이 없거나 남의 것이면 {@code PLAN_001} 404 를 던진다
     */
    PlanShareLinkResponse getShareLink(long memberId, long planId);

    /** 공유 링크 폐기. 닫을 링크가 없어도 성공이다 (멱등). */
    void revokeShareLink(long memberId, long planId);

    /** 비인증 공개 조회. 토큰만으로 열리며 주인의 사적인 필드는 빠진다. */
    SharedPlanResponse getSharedPlan(String token);
}
