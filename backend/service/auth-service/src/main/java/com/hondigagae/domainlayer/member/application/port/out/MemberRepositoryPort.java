package com.hondigagae.domainlayer.member.application.port.out;

import com.hondigagae.domainlayer.member.domain.model.Member;
import java.util.Optional;

public interface MemberRepositoryPort {

    Member save(Member domain);

    boolean existsByEmail(String email);

    Optional<Member> findByEmail(String email);

    Optional<Member> findById(long memberId);
}
