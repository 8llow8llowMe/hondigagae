package com.hondigagae.domainlayer.member.application.port.in;

import com.hondigagae.domainlayer.member.adapter.in.web.dto.request.MemberGeneralSignupRequest;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberDevSignupResponse;

/**
 * 개발/테스트 전용 즉시 가입.
 *
 * <p>이메일 인증 없이 계정을 만든다. 구현 빈이 {@code @Profile("!prod")} 라 운영에서는
 * <b>엔드포인트 자체가 존재하지 않는다.</b>
 *
 * <p>운영 계약인 {@code MemberWebUseCase} 와 <b>일부러 분리했다.</b> 한 인터페이스에 섞으면
 * 운영에서 부를 수 없는 메서드가 운영 계약에 남아, 읽는 사람이 "이건 왜 못 쓰지"를 매번
 * 되짚어야 한다. 계약이 갈려 있으면 프로파일 경계가 타입에 드러난다.
 */
public interface MemberDevSignupUseCase {

    MemberDevSignupResponse devSignup(MemberGeneralSignupRequest request);
}
