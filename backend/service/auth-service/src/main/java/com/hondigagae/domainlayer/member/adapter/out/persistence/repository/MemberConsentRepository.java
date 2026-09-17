package com.hondigagae.domainlayer.member.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.member.adapter.out.persistence.entity.MemberConsentEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface MemberConsentRepository extends JpaRepository<MemberConsentEntity, Long> {

    /**
     * 탈퇴 회원 정리용 물리 삭제. 파생 delete 는 엔티티를 읽어 한 행씩 지우므로 단일 delete 문으로 둔다.
     */
    @Modifying
    @Query("delete from MemberConsentEntity c where c.memberId in :memberIds")
    void deleteAllByMemberIdIn(List<Long> memberIds);
}
