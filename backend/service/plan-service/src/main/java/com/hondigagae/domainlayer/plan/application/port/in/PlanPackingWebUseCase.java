package com.hondigagae.domainlayer.plan.application.port.in;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanPackingListResponse;
import com.hondigagae.domainlayer.plan.application.command.PlanPackingItemCommand;
import java.util.List;

public interface PlanPackingWebUseCase {

    PlanPackingListResponse getPackingItems(long memberId, long planId);

    /**
     * AI 생성 결과를 저장한다. {@code source = AI} 인 항목만 교체하고 사용자가 직접 추가한 항목은 남는다.
     *
     * <p>같은 이름의 체크 상태는 승계되고, 사용자 항목과 이름이 겹치는 AI 항목과 목록 안의 중복 이름은
     * 버려진다 — 저장이 붙은 뒤의 "다시 뽑기" 는 파괴적 연산이기 때문이다.
     *
     * <p>생성은 ai-service 가 하고 저장은 여기서 한다. ai-service 가 대신 저장하면 "제안만 한다" 는
     * 경계가 무너지고, 생성은 됐는데 저장이 실패한 상태를 ai-service 가 떠안게 된다.
     */
    PlanPackingListResponse replacePackingItems(long memberId, long planId, List<PlanPackingItemCommand> commands);

    PlanPackingListResponse addPackingItem(long memberId, long planId, PlanPackingItemCommand command);

    void markPackingItemChecked(long memberId, long planId, long packingItemId, boolean checked);

    void deletePackingItem(long memberId, long planId, long packingItemId);
}
