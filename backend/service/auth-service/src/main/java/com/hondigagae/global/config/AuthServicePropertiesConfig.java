package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptPropertiesConfig;
import com.hondigagae.common.config.SwaggerPropertiesConfig;
import com.hondigagae.global.properties.AuthSessionProperties;
import com.hondigagae.global.properties.EmailSendLimitProperties;
import com.hondigagae.global.properties.LegalDocumentProperties;
import com.hondigagae.global.properties.LoginAttemptProperties;
import com.hondigagae.persistence.config.SnowflakePropertiesConfig;
import com.hondigagae.redis.config.RedisPropertiesConfig;
import com.hondigagae.security.auth.config.JwtAuthPropertiesConfig;
import com.hondigagae.storage.config.StoragePropertiesConfig;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptPropertiesConfig.class,
    SwaggerPropertiesConfig.class,
    JwtAuthPropertiesConfig.class,
    RedisPropertiesConfig.class,
    SnowflakePropertiesConfig.class,
    StoragePropertiesConfig.class
})
@EnableConfigurationProperties({
    LoginAttemptProperties.class, AuthSessionProperties.class, EmailSendLimitProperties.class,
    LegalDocumentProperties.class
})
public class AuthServicePropertiesConfig {

}
