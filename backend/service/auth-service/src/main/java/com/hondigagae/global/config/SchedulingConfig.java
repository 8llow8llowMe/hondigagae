package com.hondigagae.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 스케줄러 활성화. 현재는 고아 프로필 이미지 청소(회원·반려견)가 쓴다.
 *
 * <p>다중 인스턴스에서 분산 락 없이 동시에 돌아도 안전한 작업만 스케줄링한다 —
 * 청소는 삭제가 멱등이라 중복 실행이 손해일 뿐 오류가 아니다.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {

}
