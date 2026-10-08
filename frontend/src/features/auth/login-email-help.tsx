'use client'

import { useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { messages } from '@/lib/messages'

/**
 * "이메일이 기억나지 않나요?" — 로그인 하단의 안내 시트 (#1283 F1, 로그인-세부명세 D13).
 *
 * **아이디 찾기 화면을 만들지 않는다.** 이 서비스의 아이디는 이메일이라 찾아 줄 값이 따로
 * 없고, 이메일을 받아 "가입돼 있어요" 를 알려 주면 계정 열거가 된다 — 비밀번호 찾기가 발송
 * 성공 문구를 하나로 묶어 둔 것과 같은 이유다(`resetTitle` 위 주석). 이 화면에서 막히는 사람은
 * 대개 **어떤 방법으로 가입했는지**를 잊은 사람이라, 그 갈래를 안내한다. 서버를 부르지 않는다.
 *
 * **시트다 — 새 화면이 아니다** (`BottomSheet` 머리주석 "흐름을 잇는 선택"). 읽고 닫으면 같은
 * 로그인 화면에서 바로 소셜 버튼을 누르거나 이메일을 친다.
 */
export function LoginEmailHelp() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/*
        **링크가 아니라 버튼이다** — 이동하지 않고 시트를 연다. 누르는 자리는 44 (`min-h-11`).
        `ghost` 버튼을 쓰지 않는 이유: 위 링크 줄과 같은 글자 크기(`body-2`) · 색의 보조 줄이어야
        하는데 `Button` 의 외형은 덮을 수 없다(component-guide.md §3). 밑줄은 두지 않는다 — 위 링크
        줄과 한 무리로 읽혀야 한다.
      */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-body-2 text-fg-muted focus-visible:ring-brand-500 inline-flex min-h-11 items-center rounded-md px-3 focus-visible:ring-2 focus-visible:outline-none"
      >
        {messages.auth.emailHelpTrigger}
      </button>
      <LoginEmailHelpSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** 표시 전용 — node 환경 렌더 테스트용으로 나눈다 (docs/testing-guide.md §1) */
export function LoginEmailHelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={messages.auth.emailHelpTitle}>
      <div className="flex flex-col gap-4 px-4 pt-1 pb-5">
        <LoginEmailHelpBody />
        <Button variant="secondary" size="lg" onClick={onClose}>
          {messages.auth.emailHelpClose}
        </Button>
      </div>
    </BottomSheet>
  )
}

/**
 * 시트 본문. **결론이 먼저다** — "이메일이 아이디" 를 굵게 한 줄, 그 아래 두 갈래(소셜 ·
 * 이메일 가입). `BottomSheet` 가 body 포털이라 렌더 테스트는 이 조각을 본다.
 */
export function LoginEmailHelpBody() {
  return (
    <div className="text-body-2 text-fg-muted flex flex-col gap-2 break-keep">
      <p className="text-body-1 text-fg font-semibold">{messages.auth.emailHelpId}</p>
      <p>{messages.auth.emailHelpSocial}</p>
      <p>{messages.auth.emailHelpMailbox}</p>
    </div>
  )
}
