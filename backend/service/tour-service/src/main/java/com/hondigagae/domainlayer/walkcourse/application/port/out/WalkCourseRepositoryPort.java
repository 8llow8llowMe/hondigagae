package com.hondigagae.domainlayer.walkcourse.application.port.out;

import com.hondigagae.domainlayer.walkcourse.application.port.out.query.WalkCourseQueryResult;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface WalkCourseRepositoryPort {

    /** 전체 코스. 29개 안팎의 고정 소량이라 조건 없이 전부 가져와 위에서 거른다. */
    List<WalkCourseQueryResult> findAll();

    Optional<WalkCourseQueryResult> findById(long walkCourseId);

    /**
     * 주어진 아이디의 코스를 <b>한 번에</b> 돌려준다 (일정 항목 요약용).
     *
     * <p>없는 아이디는 <b>조용히 빠진다</b> - plan-service 의 {@code WALK} 항목 {@code targetId} 는
     * <b>저장 시 검증되지 않고</b>(장소와 달리 존재 확인 경로가 없다), 수기로 정리된 행도 있을 수
     * 있다. 그런 아이디 하나에 예외를 던지면 일정이 통째로 안 보인다. 적재는 upsert 뿐이라
     * <b>재적재로 행이 사라지지는 않는다</b> - 근거를 거기 두면 나중에 이 정책이 되돌려진다.
     *
     * <p>빈 컬렉션이면 쿼리하지 않고 빈 목록이다 - {@code in ()} 가 나가는 것을 막는다.
     * 순서는 보장하지 않는다. 호출부가 아이디로 맵을 만들어 쓴다.
     */
    List<WalkCourseQueryResult> findByIds(Collection<Long> walkCourseIds);
}
