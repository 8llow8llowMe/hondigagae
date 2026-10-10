package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptPropertiesConfig;
import com.hondigagae.common.config.SwaggerPropertiesConfig;
import com.hondigagae.persistence.config.SnowflakePropertiesConfig;
import com.hondigagae.security.resourceserver.config.JwtResourceServerPropertiesConfig;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptPropertiesConfig.class,
    SwaggerPropertiesConfig.class,
    SnowflakePropertiesConfig.class,
    JwtResourceServerPropertiesConfig.class
})
public class PlanServicePropertiesConfig {

}
