package com.hondigagae.apigateway.config;

import com.hondigagae.apigateway.jwt.properties.JwtVerificationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(JwtVerificationProperties.class)
public class JwtVerificationPropertiesConfig {

}
