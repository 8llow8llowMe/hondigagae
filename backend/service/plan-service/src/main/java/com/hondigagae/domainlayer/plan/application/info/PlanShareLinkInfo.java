package com.hondigagae.domainlayer.plan.application.info;

import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 소유자에게 돌려주는 공유 링크 정보 (이슈 #627).
 *
 * <p>공개 조회 응답과 달리 이쪽은 <b>일정 주인만 본다</b> — 그래서 {@code planId} 를 담아도 된다.
 */
@Builder
public record PlanShareLinkInfo(
    long planId,
    String token,
    LocalDateTime expiresAt
) {

}
