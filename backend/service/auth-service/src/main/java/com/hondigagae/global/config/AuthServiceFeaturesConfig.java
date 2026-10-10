package com.hondigagae.global.config;

import com.hondigagae.persistence.config.JpaAuditConfig;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JpaAuditConfig.class
})
public class AuthServiceFeaturesConfig {

}
