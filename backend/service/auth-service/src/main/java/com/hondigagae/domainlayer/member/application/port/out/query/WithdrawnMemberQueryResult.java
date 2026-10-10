package com.hondigagae.domainlayer.member.application.port.out.query;

import java.time.LocalDateTime;

/**
 * 이메일 원문이 남아 있는 탈퇴 회원 행. {@code WithdrawnEmailMigrationRunner} 전용이다.
 *
 * <p>도메인 {@code Member} 를 쓰지 않는 이유는 {@code updatedAt} 이 필요하기 때문이다 —
 * 마이그레이션은 비어 있는 {@code withdrawnAt} 을 {@code updatedAt} 으로 근사하는데, 그 값은
 * 감사 컬럼이라 도메인 모델에 없다.
 *
 * <p>#609 일회성 코드다. 마이그레이션이 제거될 때 이 타입도 함께 사라진다.
 *
 * @param email       치환 전 이메일 원문
 * @param withdrawnAt 이미 채워져 있으면 그대로 둔다 (보통 null)
 * @param updatedAt   {@code withdrawnAt} 근사치의 출처
 */
public record WithdrawnMemberQueryResult(
    long id,
    String email,
    LocalDateTime withdrawnAt,
    LocalDateTime updatedAt
) {

}
