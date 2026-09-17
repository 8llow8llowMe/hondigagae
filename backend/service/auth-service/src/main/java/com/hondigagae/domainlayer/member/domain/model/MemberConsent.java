package com.hondigagae.domainlayer.member.domain.model;

import com.hondigagae.domainlayer.member.domain.enums.ConsentType;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 동의 이력 한 줄. 한 번 남기면 고치지 않는다 — "그때 무엇에 동의했는가"가 증거라서,
 * 문서가 개정되면 갱신이 아니라 새 행을 쌓는다.
 *
 * <p>{@code documentVersion} 을 함께 남기는 이유가 여기 있다. 버전 없이 시각만 남기면
 * 개정 이력을 거슬러 올라가 대조해야 하고, 그 대조는 배포 시각이 기준이라 틀리기 쉽다.
 */
@Builder
public record MemberConsent(
    long id,
    long memberId,
    ConsentType type,
    String documentVersion,
    LocalDateTime agreedAt
) {

}
