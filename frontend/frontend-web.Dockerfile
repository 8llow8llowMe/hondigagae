# 혼디가개 프론트(Next.js SSR) 실행 이미지.
#
# 백엔드가 `app.jar` 만 복사하듯, 여기서도 Jenkins builder agent 가 미리 만든
# standalone 산출물만 복사한다. 컨테이너 안에서 pnpm install / next build 를 돌리지 않는다.
# 배포 대상(main-server / backend-1)은 라즈베리파이(aarch64)라 이미지 빌드에 몇 분씩 쓰면 안 된다.
#
# node:20-alpine 은 multi-arch 이미지라 배포 호스트에서 arm64 변형을 자동으로 받는다.
# 버전은 frontend/.nvmrc(20) 와 맞춘다. CI 도 그 파일을 읽으므로 빌드와 런타임 메이저가 같아진다.
# (package.json engines 는 >=20.9.0, Next 16 요구사항도 20.9 이상이다)
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# standalone 서버는 이 두 값으로 바인딩한다.
# HOSTNAME 을 0.0.0.0 으로 두지 않으면 컨테이너 내부 루프백에만 붙어 외부에서 접근할 수 없다.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# root 로 실행할 이유가 없어 node 이미지에 이미 있는 비특권 사용자로 돌린다.
# 소유권을 넘기지 않으면 Next 가 런타임에 /app/.next/cache 를 만들지 못해 실패한다.
#
# standalone 번들에는 서버 실행에 필요한 node_modules 가 이미 추적되어 들어 있다.
COPY --chown=node:node .next/standalone ./
# 정적 자산과 public 은 추적 대상이 아니라 따로 복사해야 한다. 빠뜨리면 JS/CSS 가 전부 404 난다.
#
# 이 저장소에는 아직 public/ 이 없다. 파이프라인이 번들을 묶기 전에 `mkdir -p public` 으로
# 빈 디렉터리를 만들어 주므로 아래 COPY 가 통과한다
# (Jenkinsfile.frontend-common.groovy 의 번들 생성 단계).
# 로컬에서 직접 이미지를 빌드한다면 같은 이유로 public/ 을 먼저 만들어야 한다.
COPY --chown=node:node .next/static ./.next/static
COPY --chown=node:node public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
