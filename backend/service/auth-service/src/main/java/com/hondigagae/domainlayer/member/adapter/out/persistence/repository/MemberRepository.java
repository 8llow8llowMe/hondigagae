package com.hondigagae.domainlayer.member.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.member.adapter.out.persistence.entity.MemberEntity;
import com.hondigagae.domainlayer.member.application.port.out.query.WithdrawnMemberQueryResult;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface MemberRepository extends JpaRepository<MemberEntity, Long> {

    Optional<MemberEntity> findByEmail(String email);

    /** 재가입 차단용 — 이메일 원문과 탈퇴 다이제스트를 한 번에 본다. */
    boolean existsByEmailIn(Collection<String> emails);

    /** 고아 이미지 청소용 — 행이 남아 있는 키는 전부 참조로 본다 (탈퇴·상태 무관). */
    @Query("select m.profileImageKey from MemberEntity m where m.profileImageKey is not null")
    List<String> findAllProfileImageKeys();

    /**
     * 보존 기간이 지난 탈퇴 회원 아이디. 한 번에 가져오는 건수는 {@code pageable} 이 자른다.
     *
     * <p>{@code withdrawnAt < threshold} 비교가 null 행을 자연히 제외한다 — 값이 없는 행은
     * "기간이 지났는지 알 수 없다"이므로 지우지 않는 쪽이 안전하다.
     *
     * <p>{@code order by m.id} 는 회차 간 순서를 고정한다. 호출부가 항상 첫 페이지만 요청하고
     * 지운 만큼 대상이 줄어드는 구조라, 순서가 흔들리면 같은 행을 반복해 집는 경우가 생긴다.
     */
    @Query("select m.id from MemberEntity m "
        + "where m.status = :status and m.withdrawnAt < :threshold order by m.id")
    List<Long> findIdsByStatusAndWithdrawnAtBefore(MemberStatus status, LocalDateTime threshold, Pageable pageable);

    // --- #609 일회성 마이그레이션 (dev/prod 적용 확인 후 아래 두 메서드는 제거한다) ---

    /**
     * 이메일 원문이 남아 있는 탈퇴 행. 다이제스트(hex)에는 {@code @} 가 없으므로 이 판별이
     * 확실하다 — 64자 길이 검사보다 견고하다.
     */
    @Query("select new com.hondigagae.domainlayer.member.application.port.out.query"
        + ".WithdrawnMemberQueryResult(m.id, m.email, m.withdrawnAt, m.updatedAt) "
        + "from MemberEntity m where m.status = :status and m.email like '%@%'")
    List<WithdrawnMemberQueryResult> findWithdrawnMembersWithRawEmail(MemberStatus status);

    /** 감사 컬럼 {@code updatedAt} 을 건드리지 않도록 벌크 update 로 두 컬럼만 바꾼다. */
    @Modifying
    @Query("update MemberEntity m set m.email = :emailDigest, m.withdrawnAt = :withdrawnAt where m.id = :memberId")
    void replaceWithdrawnEmail(long memberId, String emailDigest, LocalDateTime withdrawnAt);
}
