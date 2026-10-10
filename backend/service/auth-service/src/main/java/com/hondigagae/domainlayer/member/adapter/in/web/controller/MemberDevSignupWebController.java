package com.hondigagae.domainlayer.member.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.request.MemberGeneralSignupRequest;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberDevSignupResponse;
import com.hondigagae.domainlayer.member.application.port.in.MemberDevSignupUseCase;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 개발/테스트 전용 컨트롤러.
 *
 * <p>{@code @Profile("!prod")} 라 운영 프로필에서는 빈이 등록되지 않아 <b>이 경로 자체가
 * 404</b> 다. Swagger 도 운영에서는 꺼져 있어 노출 경로가 없다.
 *
 * <p>회원 컨트롤러와 파일을 나눈 것은 <b>실수로 운영에 남기지 않기 위해서다.</b> 한 파일 안에
 * 메서드로 두면 프로파일 애노테이션을 메서드에 걸 수 없어(빈 단위로만 동작한다) 결국
 * 런타임 분기를 넣게 되고, 그 분기는 지우기도 잊기도 쉽다.
 */
@Profile("!prod")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/members")
@Tag(name = "개발용 (운영 미노출)", description = "개발·테스트 편의 API 입니다. 운영 프로필에서는 존재하지 않습니다.")
public class MemberDevSignupWebController {

    private final MemberDevSignupUseCase memberDevSignupUseCase;

    @Operation(
        summary = "[개발용] 즉시 회원가입 (이메일 인증 생략)",
        description = """
            **dev 전용** — 운영 프로필(prod)에서는 이 API 가 존재하지 않습니다(404).

            이메일 인증코드 없이 테스트 계정을 바로 만듭니다.

            **이메일 인증 게이트만 건너뜁니다.** 비밀번호 규칙과 이메일 중복(409 `MEMBER_001`)은
            일반 가입과 똑같이 검사합니다 — 검증까지 느슨하게 하면 개발에서만 통과하는 값이 생겨,
            정작 운영에서 막히는 입력을 개발에서 못 잡습니다.

            응답의 `email` 과 요청에 쓴 비밀번호로 바로 `POST /api/v1/auth/login` 을 부를 수 있습니다.

            운영 프로필에서는 이 API 가 등록되지 않아 404 입니다.

            인증 불필요. **필수: 요청 바디의 email, password(영문자·숫자·특수문자 포함 8~20자), name, nickname,
            termsAgreed, privacyAgreed, ageOver14Confirmed(셋 다 true)** — 일반 가입과 같은 바디입니다.

            호출 예: `POST /api/v1/members/signup/dev` `{"email":"dev1@example.com","password":"P@ssw0rd!","name":"홍길동",
            "nickname":"길동짱","termsAgreed":true,"privacyAgreed":true,"ageOver14Confirmed":true}`"""
    )
    @PostMapping("/signup/dev")
    public ResponseEntity<Response<MemberDevSignupResponse>> devSignup(
        @Valid @RequestBody MemberGeneralSignupRequest request
    ) {
        return ResponseEntity.ok().body(Response.success(memberDevSignupUseCase.devSignup(request)));
    }
}
