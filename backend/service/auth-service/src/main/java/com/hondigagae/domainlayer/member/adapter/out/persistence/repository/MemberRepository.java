package com.hondigagae.domainlayer.member.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.member.adapter.out.persistence.entity.MemberEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MemberRepository extends JpaRepository<MemberEntity, Long> {

    boolean existsByEmail(String email);

    Optional<MemberEntity> findByEmail(String email);

    /** 고아 이미지 청소용 — 행이 남아 있는 키는 전부 참조로 본다 (탈퇴·상태 무관). */
    @Query("select m.profileImageKey from MemberEntity m where m.profileImageKey is not null")
    List<String> findAllProfileImageKeys();
}
