package com.hondigagae.domainlayer.member.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

/**
 * 개발용 즉시 가입 응답.
 *
 * <p>만든 계정으로 바로 로그인 테스트를 할 수 있게 식별 정보를 돌려준다. 일반 가입은
 * 본문 없이 성공만 주지만, 여기서는 <b>방금 만든 계정이 무엇인지</b> 가 곧 이 API 의 값어치다.
 *
 * <p>비밀번호는 돌려주지 않는다. 요청한 쪽이 이미 알고 있고, 응답에 담으면 로그와 프록시에
 * 평문이 남는다.
 */
@Builder
@Schema(description = "개발용 즉시 가입 응답 DTO")
public record MemberDevSignupResponse(

    @Schema(
        description = "생성된 회원 아이디. Snowflake 라 자바스크립트 Number 의 안전 정수 범위를 넘으므로 문자열로 내린다",
        example = "212481712381923328")
    String memberId,

    @Schema(description = "가입된 이메일. 앞뒤 공백을 지우고 소문자로 정규화한 값이다", example = "tester@example.com")
    String email
) {
}
