package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptConfigurer;
import com.hondigagae.common.config.SwaggerSecurityConfigurer;
import com.hondigagae.persistence.config.SnowflakeConfigurer;
import com.hondigagae.security.resourceserver.config.ResourceServerSecurityConfigurer;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptConfigurer.class,
    SnowflakeConfigurer.class,
    ResourceServerSecurityConfigurer.class,
    SwaggerSecurityConfigurer.class
})
public class PlanServiceBeansConfig {

}
