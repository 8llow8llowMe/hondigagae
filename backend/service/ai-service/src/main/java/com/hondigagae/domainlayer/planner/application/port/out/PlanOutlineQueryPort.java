package com.hondigagae.domainlayer.planner.application.port.out;

import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import java.util.Optional;

/**
 * 기존 일정 개요 조회 계약 (하루 재생성용).
 *
 * <p>반려견 특성과 달리 <b>없으면 진행할 수 없다</b> — "2일차만 다시"라는 요청에서
 * 기존 일정을 모르면 나머지 날을 유지할 방법이 없다. 비어 있으면 호출부가 잡을
 * 명확한 코드로 실패시킨다.
 */
public interface PlanOutlineQueryPort {

    Optional<PlanOutline> findOutline(long memberId, long planId);
}
