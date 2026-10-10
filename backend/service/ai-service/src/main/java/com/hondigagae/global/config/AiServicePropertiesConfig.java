package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptPropertiesConfig;
import com.hondigagae.common.config.SwaggerPropertiesConfig;
import com.hondigagae.global.properties.AiLlmProperties;
import com.hondigagae.global.properties.AiPlanJobProperties;
import com.hondigagae.redis.config.RedisPropertiesConfig;
import com.hondigagae.security.resourceserver.config.JwtResourceServerPropertiesConfig;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptPropertiesConfig.class,
    SwaggerPropertiesConfig.class,
    JwtResourceServerPropertiesConfig.class,
    RedisPropertiesConfig.class
})
@EnableConfigurationProperties({
    AiPlanJobProperties.class,
    AiLlmProperties.class
})
public class AiServicePropertiesConfig {

}
