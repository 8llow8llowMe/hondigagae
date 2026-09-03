package com.hondigagae.domainlayer.member.application.service;

import com.hondigagae.domainlayer.member.adapter.in.web.dto.request.MemberGeneralSignupRequest;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberDevSignupResponse;
import com.hondigagae.domainlayer.member.application.command.MemberGeneralSignupCommand;
import com.hondigagae.domainlayer.member.application.port.in.MemberDevSignupUseCase;
import com.hondigagae.domainlayer.member.application.service.processor.MemberGeneralSignupProcessor;
import com.hondigagae.domainlayer.member.domain.model.Member;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 개발/테스트 전용 즉시 가입 오케스트레이터.
 *
 * <p>{@code @Profile("!prod")} 라 운영에서는 빈이 등록되지 않고, 그래서 컨트롤러도 함께
 * 사라진다. 이 저장소가 Swagger 를 운영에서 끄는 데 쓰는 것과 같은 장치다.
 */
@Slf4j
@Profile("!prod")
@Service
@RequiredArgsConstructor
public class MemberDevSignupFacade implements MemberDevSignupUseCase {

    private final MemberGeneralSignupProcessor memberGeneralSignupProcessor;

    /**
     * 기동 로그에 이 API 가 살아 있다는 사실을 남긴다.
     *
     * <p>프로파일 하나에 안전이 걸려 있는 구조라, <b>프로파일을 잘못 준 배포</b>가 유일하면서도
     * 가장 그럴듯한 사고 경로다. 그때 로그에서 이 줄이 보이면 바로 알아챌 수 있다 -
     * 조용히 열려 있는 것보다 시끄럽게 열려 있는 편이 낫다.
     */
    @PostConstruct
    void warnEnabled() {
        log.warn("[DEV] 이메일 인증 없이 가입하는 개발용 API 가 활성화됐습니다. "
            + "운영이라면 spring.profiles.active 에 prod 가 빠진 것입니다.");
    }

    @Override
    @Transactional
    public MemberDevSignupResponse devSignup(MemberGeneralSignupRequest request) {
        Member member = memberGeneralSignupProcessor.devSignup(MemberGeneralSignupCommand.from(request));
        log.info("[DEV] member signed up without email verification memberId={}", member.id());

        return MemberDevSignupResponse.builder()
            // Snowflake 아이디는 문자열로 내린다. long 그대로 보내면 JS 가 조용히 절삭한다.
            .memberId(String.valueOf(member.id()))
            .email(member.email())
            .build();
    }
}
