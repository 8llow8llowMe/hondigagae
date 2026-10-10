package com.hondigagae.global.config;

import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addFormatters(FormatterRegistry registry) {
        // @PathVariable OAuthProvider 를 대소문자 무관하게 바인딩한다. (kakao/KAKAO 모두 허용)
        registry.addConverter(String.class, OAuthProvider.class, OAuthProvider::fromName);
    }
}
