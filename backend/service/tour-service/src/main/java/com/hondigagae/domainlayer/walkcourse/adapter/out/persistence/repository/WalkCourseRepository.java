package com.hondigagae.domainlayer.walkcourse.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.walkcourse.adapter.out.persistence.entity.WalkCourseEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WalkCourseRepository extends JpaRepository<WalkCourseEntity, Long> {

    /**
     * 아이디 벌크 조회 (파생 쿼리, coding-conventions §9-6).
     *
     * <p>상속받은 {@code findAllById} 를 그대로 쓰지 않는 이유는 <b>계약을 이름으로 드러내기
     * 위해서</b>다 - 없는 아이디를 빼고 준다는 것과 순서를 보장하지 않는다는 것이 포트
     * ({@code WalkCourseRepositoryPort#findByIds})의 약속인데, 상속 메서드에는 그 약속을
     * 적을 자리가 없다.
     */
    List<WalkCourseEntity> findByIdIn(Collection<Long> walkCourseIds);
}
