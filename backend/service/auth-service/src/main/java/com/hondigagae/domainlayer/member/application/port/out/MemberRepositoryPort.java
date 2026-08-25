package com.hondigagae.domainlayer.member.application.port.out;

import com.hondigagae.domainlayer.member.domain.model.Member;
import java.util.Optional;

public interface MemberRepositoryPort {

    Member save(Member domain);

    Optional<Member> findById(long memberId);

    Optional<Member> findByKakaoId(long kakaoId);
}
