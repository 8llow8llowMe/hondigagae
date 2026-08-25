package com.hondigagae.domainlayer.member.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.member.adapter.out.persistence.entity.MemberEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRepository extends JpaRepository<MemberEntity, Long> {

    Optional<MemberEntity> findByKakaoId(long kakaoId);
}
