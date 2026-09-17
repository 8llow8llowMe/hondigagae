package com.hondigagae.domainlayer.member.adapter.in.web.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.member.application.service.MemberDevSignupFacade;
import com.hondigagae.domainlayer.member.application.service.processor.MemberGeneralSignupProcessor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

/**
 * 개발용 가입 API 의 프로파일 차단 검증.
 *
 * <p><b>이 기능의 안전은 애노테이션 한 줄에 걸려 있다.</b> {@code @Profile("!prod")} 가 빠지거나
 * 오타가 나면 이메일 인증 없이 계정을 만드는 엔드포인트가 운영에 열린다. 컴파일은 통과하고
 * 개발에서는 잘 도니 눈으로는 잡히지 않는다.
 *
 * <p>그래서 컨텍스트를 두 프로파일로 각각 띄워 <b>빈의 유무</b>를 직접 확인한다.
 * 경로가 아니라 빈을 보는 이유는, 빈이 없으면 매핑도 없어 404 가 되는 것이 스프링의 동작이고
 * 그 지점이 실제 방어선이기 때문이다.
 */
class MemberDevSignupProfileGuardTest {

    /**
     * 스캔 범위를 개발용 빈 둘로 좁힌다. member 패키지 전체를 올리면 리포지토리·보안 설정까지
     * 딸려와 이 테스트가 확인하려는 것과 무관한 이유로 깨진다.
     */
    @TestConfiguration
    @ComponentScan(
        basePackageClasses = {MemberDevSignupWebController.class, MemberDevSignupFacade.class},
        useDefaultFilters = false,
        includeFilters = @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = {MemberDevSignupWebController.class, MemberDevSignupFacade.class}))
    static class ScanConfig {

        /**
         * 파사드가 의존하는 프로세서. 이 테스트는 <b>빈이 뜨는지</b>만 보므로 동작하지 않는
         * 껍데기로 충분하다 - 실제 가입 규칙은 {@code MemberDevSignupProcessorTest} 가 본다.
         */
        @Bean
        MemberGeneralSignupProcessor memberGeneralSignupProcessor() {
            return new MemberGeneralSignupProcessor(null, null, null, null, null, null);
        }
    }

    @Nested
    @DisplayName("운영 프로필")
    @ActiveProfiles("prod")
    @SpringJUnitConfig(ScanConfig.class)
    class ProdProfile {

        @Autowired
        private ApplicationContext context;

        @Test
        @DisplayName("개발용 가입 컨트롤러와 파사드가 등록되지 않는다")
        void registersNothing() {
            // 빈이 없으면 매핑도 없어 경로가 404 다. 이것이 유일하면서 충분한 방어선이다.
            assertThat(context.getBeanNamesForType(MemberDevSignupWebController.class)).isEmpty();
            assertThat(context.getBeanNamesForType(MemberDevSignupFacade.class)).isEmpty();
        }
    }

    @Nested
    @DisplayName("개발 프로필")
    @ActiveProfiles("dev")
    @SpringJUnitConfig(ScanConfig.class)
    class DevProfile {

        @Autowired
        private ApplicationContext context;

        @Test
        @DisplayName("개발용 가입 컨트롤러와 파사드가 등록된다")
        void registersBoth() {
            // 반대쪽도 확인해야 한다 - 오타로 항상 꺼져 있으면 "안전한데 쓸모없는" 상태가 된다.
            assertThat(context.getBeanNamesForType(MemberDevSignupWebController.class)).hasSize(1);
            assertThat(context.getBeanNamesForType(MemberDevSignupFacade.class)).hasSize(1);
        }
    }
}
