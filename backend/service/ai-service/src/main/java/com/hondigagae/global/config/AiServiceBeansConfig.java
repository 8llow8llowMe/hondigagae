package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptConfigurer;
import com.hondigagae.common.config.SwaggerSecurityConfigurer;
import com.hondigagae.redis.config.RedisConfigurer;
import com.hondigagae.security.resourceserver.config.ResourceServerSecurityConfigurer;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptConfigurer.class,
    RedisConfigurer.class,
    ResourceServerSecurityConfigurer.class,
    SwaggerSecurityConfigurer.class
})
public class AiServiceBeansConfig {

}
