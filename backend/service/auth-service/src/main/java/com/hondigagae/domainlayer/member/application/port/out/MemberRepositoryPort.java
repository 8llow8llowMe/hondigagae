package com.hondigagae.domainlayer.member.application.port.out;

import com.hondigagae.domainlayer.member.domain.model.Member;
import java.util.List;
import java.util.Optional;

public interface MemberRepositoryPort {

    Member save(Member domain);

    Optional<Member> findByEmail(String email);

    Optional<Member> findById(long memberId);

    /** 스토리지에 실제로 참조 중인 프로필 이미지 키 전부. 고아 객체 청소의 대조군이다. */
    List<String> findAllProfileImageKeys();
}
