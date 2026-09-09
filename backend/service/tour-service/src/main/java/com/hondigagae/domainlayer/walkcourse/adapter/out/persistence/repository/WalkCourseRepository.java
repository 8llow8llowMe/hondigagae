package com.hondigagae.domainlayer.walkcourse.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.walkcourse.adapter.out.persistence.entity.WalkCourseEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WalkCourseRepository extends JpaRepository<WalkCourseEntity, Long> {
}
