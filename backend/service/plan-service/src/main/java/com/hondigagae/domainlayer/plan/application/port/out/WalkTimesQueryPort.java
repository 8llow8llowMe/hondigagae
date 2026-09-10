package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.WalkTimesQueryResult;
import java.util.Optional;

/**
 * 오늘의 산책 골든타임 조회 계약. 좌표 기준이며 <b>오늘 남은 시간 전용</b>이다 —
 * tour-service 의 판정이 "지금 이후" 를 보기 때문에 내일 이후는 물을 수 없다.
 */
public interface WalkTimesQueryPort {

    /**
     * @param pet 반려견 조건. 값이 없어도(모두 null/false) 조회는 나간다 — 일반 조건 판정이 된다
     * @return 조회에 실패하면 {@code Optional.empty()}. 골든타임은 브리핑의 부가 정보라
     *         tour-service 가 흔들렸다고 브리핑 전체를 막지 않는다 (날씨와 같은 결정)
     */
    Optional<WalkTimesQueryResult> findWalkTimes(double lat, double lng, PetConditionQueryResult pet);
}
