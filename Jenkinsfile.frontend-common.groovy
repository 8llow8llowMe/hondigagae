// 혼디가개 프론트 공통 배포 파이프라인.
//
// BossPickSeoul(NowDoBoss-V2)의 같은 파일에서 이식했다.
// 혼디가개에서 다른 값은 아래뿐이다.
//   - Vault:      kv/hondigagae/frontend/{env}/env
//   - Credential: hondigagae-vault-role-id / hondigagae-vault-secret-id
//   - 포트 대역:  dev 7300 / prod 5300
//   - 배포 경로:  $HOME/deploy/hondigagae/frontend/web
//
// Jenkinsfile.backend-common.groovy 와 같은 게이트/같은 배포 규칙을 씁니다.
//   - PR 빌드는 CI 만 수행하고 배포하지 않습니다. 배포는 develop/main 에 **머지된 시점**의
//     브랜치 빌드에서만 일어납니다. (develop -> dev, main -> prod)
//   - 배포 대상은 PR 라벨로 지정합니다. 라벨이 없으면 배포하지 않습니다(fail-closed).
//   - 라벨을 빠뜨리고 머지한 커밋은 FORCE_DEPLOY 로 수동 배포합니다.
//
// 백엔드와 다른 점은 Next.js 특성에서 옵니다.
//   - NEXT_PUBLIC_* 는 빌드 시점에 코드로 인라인되므로 **빌드 단계에서** Vault 값을 주입합니다.
//     dev 와 prod 는 같은 커밋이라도 산출물이 다릅니다.
//   - 서버 전용 값(AUTH_SESSION_SECRET 등)은 런타임 주입이라 배포 단계에서 .env.runtime 으로 넘깁니다.
//   - 빌더는 x86_64(ollama-01), 배포 대상은 aarch64(라즈베리파이)라 번들에 네이티브 바이너리가
//     섞이면 런타임에 죽습니다. 빌드 후 이를 검사합니다.

Map<String, String> resolveGitContext() {
    String requestedTargetBranch = params.TARGET_BRANCH?.trim()
    String requestedPrSha = params.PR_SHA?.trim()
    String requestedPrNumber = params.PR_NUMBER?.trim()

    String effectiveTargetBranch = requestedTargetBranch
    if (!effectiveTargetBranch) {
        effectiveTargetBranch = env.CHANGE_TARGET?.trim() ?: env.BRANCH_NAME
    }

    String deployEnv = 'none'
    if (effectiveTargetBranch == 'main') {
        deployEnv = 'prod'
    } else if (effectiveTargetBranch == 'develop') {
        deployEnv = 'dev'
    }

    return [
        requestedTargetBranch: requestedTargetBranch ?: '',
        effectiveTargetBranch: effectiveTargetBranch ?: '',
        requestedPrSha      : requestedPrSha ?: '',
        requestedPrNumber   : requestedPrNumber ?: '',
        deployEnv           : deployEnv,
        isPullRequest       : env.CHANGE_ID?.trim() ? 'true' : 'false'
    ]
}

void checkoutSource() {
    if (params.PR_SHA?.trim()) {
        echo "요청한 PR 커밋 SHA를 체크아웃합니다: ${params.PR_SHA}"
        checkout([
            $class: 'GitSCM',
            branches: [[name: params.PR_SHA.trim()]],
            userRemoteConfigs: scm.userRemoteConfigs,
            extensions: [
                [$class: 'SubmoduleOption', recursiveSubmodules: true, parentCredentials: true]
            ]
        ])
        return
    }

    echo '멀티브랜치 파이프라인 기본 SCM 컨텍스트로 체크아웃합니다.'
    checkout([
        $class: 'GitSCM',
        branches: scm.branches,
        userRemoteConfigs: scm.userRemoteConfigs,
        extensions: [
            [$class: 'SubmoduleOption', recursiveSubmodules: true, parentCredentials: true]
        ]
    ])
}

Map<String, Object> resolveVaultSpec(Map<String, String> config, Map<String, String> ctx) {
    String projectSlug = params.PROJECT_SLUG?.trim() ?: 'hondigagae'
    String vaultSecretRoot = params.VAULT_SECRET_ROOT?.trim() ?: "kv/${projectSlug}/frontend"
    String vaultSecretPath = params.VAULT_SECRET_PATH?.trim() ?: "${vaultSecretRoot}/${ctx.deployEnv}/env"
    Integer engineVersion = (params.VAULT_ENGINE_VERSION ?: '2') as Integer

    return [
        path         : vaultSecretPath,
        // KV v2는 mount path와 secret path 사이에 /data/가 필요합니다.
        apiPath      : resolveVaultApiPath(vaultSecretPath, engineVersion),
        engineVersion: engineVersion
    ]
}

String resolveDeployAgentLabel(Map<String, Object> config, Map<String, String> ctx) {
    Map<String, String> deployAgentLabels = config.deployAgentLabels ?: [:]
    String deployAgentLabel = deployAgentLabels[ctx.deployEnv] ?: config.deployAgentLabel

    if (!deployAgentLabel?.trim()) {
        error "배포 agent label을 찾을 수 없습니다. deployEnv=${ctx.deployEnv}"
    }

    return deployAgentLabel.trim()
}

boolean shouldDeployToEnvironment(Map<String, String> ctx) {
    if (params.SKIP_DEPLOY || !(ctx.deployEnv in ['dev', 'prod'])) {
        return false
    }

    // PR 빌드는 CI(빌드/검사)만 수행하고 배포하지 않습니다.
    // 배포는 develop/main 머지 빌드에서만 일어나므로 "dev = develop 미러"가 유지됩니다.
    if (ctx.isPullRequest == 'true') {
        return false
    }

    return true
}

// 이번 빌드에서 변경된 파일 목록을 계산합니다. 판단이 불가능하면 null을 반환해 전체 빌드로 진행합니다(fail-open).
List<String> resolveChangedFiles(Map<String, String> ctx) {
    try {
        String diffOutput
        if (ctx.isPullRequest == 'true' && env.CHANGE_TARGET?.trim()) {
            // PR 빌드: 대상 브랜치와의 merge-base 기준으로 PR이 실제 건드린 파일만 계산합니다.
            //
            // 여기서 git fetch 를 직접 실행하면 안 됩니다. 파이프라인 sh 에는 checkout 단계의
            // credential(GIT_ASKPASS)이 없어 사설 레포 fetch 가 exit 128("could not read
            // Username")로 죽고, fail-open 규칙에 따라 무관한 PR 에서도 전체 CI 가 돕니다.
            // (실제 사고: 백엔드만 105개 파일 바뀐 PR 에서 프론트 잡이 CI 를 돌다 빨간불)
            // 멀티브랜치 PR 잡은 checkout 이 대상 브랜치를 refspec 에 포함해 방금
            // credential 로 받아뒀으므로(origin/<target>), 그 ref 를 그대로 씁니다.
            String target = env.CHANGE_TARGET.trim()
            int hasTargetRef = sh(returnStatus: true, script: "git rev-parse --verify --quiet refs/remotes/origin/${target}")
            if (hasTargetRef != 0) {
                echo "origin/${target} ref 가 워크스페이스에 없어 변경 파일을 판단할 수 없습니다. 전체 빌드로 진행합니다."
                return null
            }
            diffOutput = sh(returnStdout: true, script: "git diff --name-only origin/${target}...HEAD").trim()
        } else if (env.GIT_PREVIOUS_SUCCESSFUL_COMMIT?.trim()) {
            String previous = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT.trim()
            int exists = sh(returnStatus: true, script: "git cat-file -e ${previous}^{commit}")
            if (exists != 0) {
                echo "이전 성공 커밋(${previous})을 찾을 수 없어 전체 빌드로 진행합니다."
                return null
            }
            diffOutput = sh(returnStdout: true, script: "git diff --name-only ${previous} HEAD").trim()
        } else {
            echo '변경 파일 기준 커밋을 판단할 수 없어 전체 빌드로 진행합니다. (첫 빌드 등)'
            return null
        }
        return diffOutput ? diffOutput.split('\n').collect { it.trim() }.findAll { it } : []
    } catch (Exception e) {
        echo "변경 파일 계산에 실패해 전체 빌드로 진행합니다: ${e.message}"
        return null
    }
}

// 변경 파일이 이 잡에 주는 영향 "범위" 를 판단합니다.
// 모노레포라 backend/ 만 바뀐 push 에도 프론트 잡이 트리거되므로 여기서 걸러냅니다.
//   'own'      — frontend/ 하위(실제 코드) 변경 또는 판단 불가(fail-open). CI 를 반드시 돕니다.
//   'pipeline' — 이 잡의 파이프라인 정의 파일만 변경. PR 라벨 스코프로 CI 생략이 가능합니다.
//   'none'     — 이 잡과 무관. 빌드/배포를 건너뜁니다.
String resolveAffectedScope(Map<String, String> config, List<String> changedFiles) {
    if (changedFiles == null) {
        return 'own'
    }
    if (changedFiles.isEmpty()) {
        echo '변경 파일이 없어 빌드/배포를 건너뜁니다.'
        return 'none'
    }

    String servicePrefix = "${config.fsPath}/"
    // 파이프라인 정의 변경은 '이 잡의' 파일에만 반응한다.
    // 'Jenkinsfile' 프리픽스 하나로 두면 백엔드 파이프라인 파일 변경에도 프론트 잡이 CI 를 돌게 된다.
    List<String> pipelinePrefixes = [
        'Jenkinsfile.frontend-common.groovy',
        "Jenkinsfile-frontend-${config.serviceName}".toString()
    ]

    List<String> ownMatched = changedFiles.findAll { path -> path.startsWith(servicePrefix) }
    List<String> pipelineMatched = changedFiles.findAll { path ->
        pipelinePrefixes.any { prefix -> path.startsWith(prefix) }
    }

    if (ownMatched) {
        echo "이 서비스에 영향 있는 변경 ${ownMatched.size()}건: ${ownMatched.take(10).join(', ')}${ownMatched.size() > 10 ? ' ...' : ''}"
        return 'own'
    }
    if (pipelineMatched) {
        echo "파이프라인 정의 변경 ${pipelineMatched.size()}건: ${pipelineMatched.join(', ')}"
        return 'pipeline'
    }

    echo "변경 파일 ${changedFiles.size()}건 중 ${config.serviceName} 관련 변경이 없어 빌드/배포를 건너뜁니다."
    return 'none'
}

// origin remote URL에서 GitHub owner/repo 슬러그를 뽑아냅니다. 판단 불가 시 빈 문자열을 반환합니다.
// (정규식 Matcher는 CPS 직렬화 대상이 아니라 파이프라인에서 예외를 유발하므로 문자열 연산만 사용합니다.)
String resolveRepositorySlug() {
    String url = sh(returnStdout: true, script: 'git config --get remote.origin.url').trim()
    if (!url) {
        return ''
    }

    String slug = url.endsWith('.git') ? url.substring(0, url.length() - 4) : url
    int hostIndex = slug.indexOf('github.com')
    if (hostIndex < 0) {
        return ''
    }

    slug = slug.substring(hostIndex + 'github.com'.length())
    while (slug.startsWith(':') || slug.startsWith('/')) {
        slug = slug.substring(1)
    }

    return slug.contains('/') ? slug : ''
}

// GitHub REST API를 GET 호출합니다. GitHub App credential의 installation token을 사용합니다.
String githubApiGet(String apiPath, String credentialId) {
    String response = ''

    withCredentials([usernamePassword(
        credentialsId: credentialId,
        usernameVariable: 'GITHUB_API_USER',
        passwordVariable: 'GITHUB_API_TOKEN'
    )]) {
        withEnv(["GITHUB_API_URL=https://api.github.com/${apiPath}"]) {
            response = sh(
                returnStdout: true,
                script: '''#!/usr/bin/env bash
set +x
set -euo pipefail

curl --fail --silent --show-error \
  --header "Authorization: Bearer $GITHUB_API_TOKEN" \
  --header "Accept: application/vnd.github+json" \
  --header "X-GitHub-Api-Version: 2022-11-28" \
  "$GITHUB_API_URL"
'''
            ).trim()
        }
    }

    return response
}

// 이 빌드와 연결된 PR의 라벨 목록을 조회합니다.
//
// `Github label filter` 플러그인은 PR discovery 단계만 제한하므로, 머지 후 브랜치 빌드에서는
// 이렇게 직접 라벨을 확인해야 합니다.
//
// 반환: [resolved: 'true'|'false', reason: '사유 코드', labels: List<String>]
Map<String, Object> resolveDeployLabelContext(Map<String, String> ctx) {
    String credentialId = params.GITHUB_APP_CREDENTIAL_ID?.trim()
    if (!credentialId) {
        return [resolved: 'false', reason: 'NO_CREDENTIAL', labels: []]
    }

    try {
        String slug = resolveRepositorySlug()
        if (!slug) {
            return [resolved: 'false', reason: 'NO_REPOSITORY_SLUG', labels: []]
        }

        def pullRequest = null
        if (ctx.isPullRequest == 'true' && env.CHANGE_ID?.trim()) {
            pullRequest = readJSON text: githubApiGet("repos/${slug}/pulls/${env.CHANGE_ID.trim()}", credentialId)
        } else {
            String headSha = sh(returnStdout: true, script: 'git rev-parse HEAD').trim()
            def associated = readJSON text: githubApiGet("repos/${slug}/commits/${headSha}/pulls", credentialId)
            if (!associated || associated.isEmpty()) {
                // PR 없이 브랜치에 직접 push한 경우입니다. 라벨이 지정되지 않은 것과 같게 취급합니다.
                echo "커밋 ${headSha.take(8)}에 연결된 PR이 없습니다. (브랜치 직접 push)"
                return [resolved: 'true', reason: 'NO_PULL_REQUEST', labels: []]
            }
            // 머지 커밋이면 merge_commit_sha가 일치하는 PR이 정확한 출처입니다.
            associated.each { candidate ->
                if (pullRequest == null && candidate?.merge_commit_sha?.toString() == headSha) {
                    pullRequest = candidate
                }
            }
            if (pullRequest == null) {
                pullRequest = associated[0]
            }
        }

        if (pullRequest == null) {
            return [resolved: 'false', reason: 'PULL_REQUEST_PARSE_FAILED', labels: []]
        }

        List<String> labels = []
        pullRequest.labels?.each { label ->
            String name = label?.name?.toString()
            if (name) {
                labels.add(name)
            }
        }

        echo "PR #${pullRequest.number} 라벨: ${labels ? labels.join(', ') : '없음'}"
        return [resolved: 'true', reason: '', labels: labels]
    } catch (Exception e) {
        echo "PR 라벨 조회에 실패했습니다: ${e.message}"
        return [resolved: 'false', reason: 'API_ERROR', labels: []]
    }
}

// 라벨을 기준으로 이 서비스를 배포할지 판단합니다.
// PR에 `frontend-{serviceName}` 라벨이 지정된 경우에만 배포합니다.
//
// 라벨이 하나도 없으면 배포하지 않습니다(fail-closed).
// 배포는 의도적으로 지정한 대상만 나가야 하므로, 라벨이 없을 때 전체 배포로 넓히지 않습니다.
boolean isServiceDeployAllowedByLabels(Map<String, String> config, Map<String, Object> labelContext) {
    String prefix = params.DEPLOY_LABEL_PREFIX?.trim() ?: 'frontend-'

    if (labelContext.resolved != 'true') {
        // 설정/통신 문제로 라벨을 확인하지 못한 상태입니다.
        // 배포는 막되, credential 오설정으로 배포가 영구히 멈춘 것을 알아챌 수 있도록 UNSTABLE로 표시합니다.
        echo "PR 라벨을 확인할 수 없어 배포하지 않습니다. reason=${labelContext.reason}"
        currentBuild.result = 'UNSTABLE'
        currentBuild.description = "라벨 확인 실패(${labelContext.reason}) - 배포 생략"
        return false
    }

    List<String> serviceLabels = (labelContext.labels as List<String>).findAll { it.startsWith(prefix) }

    if (!serviceLabels) {
        echo "배포 대상 라벨(${prefix}*)이 지정되지 않아 배포하지 않습니다. 배포하려면 PR에 ${prefix}${config.serviceName} 라벨을 붙여주세요."
        return false
    }

    String expected = "${prefix}${config.serviceName}"
    if (serviceLabels.contains(expected)) {
        echo "라벨 ${expected}이 지정되어 배포 대상입니다."
        return true
    }

    echo "배포 대상 라벨: ${serviceLabels.join(', ')} — ${expected}이 없어 배포를 생략합니다."
    return false
}

String resolveVaultApiPath(String vaultSecretPath, Integer engineVersion) {
    if (engineVersion != 2) {
        return vaultSecretPath
    }

    List<String> parts = vaultSecretPath.tokenize('/')
    if (parts.size() < 2) {
        error "Vault KV v2 path must include mount and secret path: ${vaultSecretPath}"
    }

    String mountPath = parts.first()
    String secretPath = parts.drop(1).join('/')
    return "${mountPath}/data/${secretPath}"
}

Map<String, String> readVaultSecretValues(Map<String, Object> vaultSpec) {
    String vaultAddr = params.VAULT_ADDR?.trim()
    String roleIdCredentialId = params.VAULT_ROLE_ID_CREDENTIAL_ID?.trim()
    String secretIdCredentialId = params.VAULT_SECRET_ID_CREDENTIAL_ID?.trim()
    String authPath = params.VAULT_AUTH_PATH?.trim() ?: 'approle'

    if (!vaultAddr) {
        error 'VAULT_ADDR is required.'
    }
    if (!roleIdCredentialId || !secretIdCredentialId) {
        error 'VAULT_ROLE_ID_CREDENTIAL_ID and VAULT_SECRET_ID_CREDENTIAL_ID are required.'
    }

    String normalizedVaultAddr = vaultAddr.replaceAll('/+$', '')
    String loginResponse = ''

    withCredentials([
        string(credentialsId: roleIdCredentialId, variable: 'VAULT_ROLE_ID'),
        string(credentialsId: secretIdCredentialId, variable: 'VAULT_SECRET_ID')
    ]) {
        withEnv([
            "VAULT_ADDR=${normalizedVaultAddr}",
            "VAULT_AUTH_PATH=${authPath}"
        ]) {
            loginResponse = sh(
                returnStdout: true,
                script: '''#!/usr/bin/env bash
set +x
set -euo pipefail

login_payload=$(printf '{"role_id":"%s","secret_id":"%s"}' "$VAULT_ROLE_ID" "$VAULT_SECRET_ID")
curl --fail --silent --show-error \
  --request POST \
  --data "$login_payload" \
  "$VAULT_ADDR/v1/auth/$VAULT_AUTH_PATH/login"
'''
            ).trim()
        }
    }

    def loginPayload = readJSON text: loginResponse
    String clientToken = loginPayload?.auth?.client_token?.toString()
    if (!clientToken) {
        error 'Vault AppRole login did not return client_token.'
    }

    String secretResponse = ''
    // Jenkinsfile에 key 목록을 두지 않고 secret path 전체를 읽습니다.
    withEnv([
        "VAULT_ADDR=${normalizedVaultAddr}",
        "VAULT_CLIENT_TOKEN=${clientToken}",
        "VAULT_API_PATH=${vaultSpec.apiPath}"
    ]) {
        secretResponse = sh(
            returnStdout: true,
            script: '''#!/usr/bin/env bash
set +x
set -euo pipefail

curl --fail --silent --show-error \
  --header "X-Vault-Token: $VAULT_CLIENT_TOKEN" \
  "$VAULT_ADDR/v1/$VAULT_API_PATH"
'''
        ).trim()
    }

    // KV v2 응답은 data.data 아래에 실제 환경변수 key-value가 들어 있습니다.
    def secretPayload = readJSON text: secretResponse
    def rawSecretValues = [:]
    if (vaultSpec.engineVersion == 2) {
        rawSecretValues = secretPayload?.data?.data as Map
    } else {
        rawSecretValues = secretPayload?.data as Map
    }

    if (!rawSecretValues) {
        error "Vault secret has no key-value data: ${vaultSpec.path}"
    }

    Map<String, String> secretValues = [:]
    rawSecretValues.each { key, value ->
        // Docker Compose --env-file이 읽을 수 있는 KEY=value 형식만 허용합니다.
        String envKey = key.toString()
        if (!(envKey ==~ /[A-Za-z_][A-Za-z0-9_]*/)) {
            error "Vault key is not a valid env var name: ${envKey}"
        }

        String envValue = value == null ? '' : value.toString()
        if (envValue.contains('\n') || envValue.contains('\r')) {
            error "Vault value for ${envKey} contains a newline and cannot be rendered as a simple .env entry."
        }

        secretValues[envKey] = envValue
    }

    return secretValues
}

String renderEnvFile(Map<String, String> secretValues) {
    // 매번 같은 .env.runtime이 생성되도록 key를 정렬해서 렌더링합니다.
    return secretValues
        .keySet()
        .sort()
        .collect { key -> "${key}=${secretValues[key]}" }
        .join('\n') + '\n'
}

List<String> renderEnvBindings(Map<String, String> secretValues) {
    return secretValues
        .keySet()
        .sort()
        .collect { key -> "${key}=${secretValues[key]}" }
}

void validateRequiredEnvValues(String vaultPath, Map<String, String> envValues, List<String> requiredKeys) {
    List<String> missingKeys = requiredKeys.findAll { key -> !envValues[key]?.trim() }

    if (missingKeys) {
        error "Vault secret ${vaultPath} is missing required key(s): ${missingKeys.join(', ')}"
    }
}

Map<String, String> readBuildEnvValues(Map<String, Object> config, Map<String, String> ctx) {
    if (!(ctx.deployEnv in ['dev', 'prod'])) {
        return [:]
    }

    Map<String, Object> vaultSpec = resolveVaultSpec(config, ctx)
    Map<String, String> vaultValues = readVaultSecretValues(vaultSpec)
    validateRequiredEnvValues(vaultSpec.path as String, vaultValues, (config.requiredBuildEnvKeys ?: []) as List<String>)

    return vaultValues
}

// 배포 환경별 런타임 필수 key 목록을 만듭니다. '{ENV}' 는 DEV/PROD 로 치환됩니다.
List<String> resolveRequiredRuntimeKeys(Map<String, Object> config, Map<String, String> ctx) {
    String upperEnv = ctx.deployEnv.toUpperCase()
    return ((config.requiredRuntimeEnvKeys ?: []) as List<String>).collect { key ->
        key.replace('{ENV}', upperEnv)
    }
}

void run(Map<String, Object> config) {
    properties([
        // 프론트 번들(tar.gz, 수십 MB)은 최근 3개 빌드만 보관해 마스터 디스크를 아낍니다.
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '3')),
        disableConcurrentBuilds(),
        parameters([
            string(
                name: 'TARGET_BRANCH',
                defaultValue: '',
                description: '배포 환경을 판별할 대상 브랜치입니다. 비워두면 CHANGE_TARGET 또는 BRANCH_NAME을 사용합니다.'
            ),
            string(
                name: 'PR_SHA',
                defaultValue: '',
                description: '체크아웃할 커밋 SHA입니다. 비워두면 멀티브랜치 기본 체크아웃을 사용합니다.'
            ),
            string(
                name: 'PR_NUMBER',
                defaultValue: '',
                description: '표시와 로그 확인용 PR 번호입니다. 선택 입력입니다.'
            ),
            booleanParam(
                name: 'RUN_TESTS',
                defaultValue: true,
                description: 'next build 전에 format:check / lint / typecheck / test 를 실행할지 여부입니다.'
            ),
            booleanParam(
                name: 'SKIP_DEPLOY',
                defaultValue: false,
                description: '배포 가능한 브랜치여도 배포를 건너뛰고 빌드만 수행합니다.'
            ),
            booleanParam(
                name: 'FORCE_DEPLOY',
                defaultValue: false,
                description: '변경 감지와 PR 라벨 게이트를 우회해 강제 배포합니다. '
                    + '라벨을 빠뜨리고 머지한 커밋을 수동으로 배포할 때 사용합니다. '
                    + '브랜치 규칙(PR 빌드 배포 금지, dev/prod 브랜치 한정)과 SKIP_DEPLOY는 그대로 적용됩니다.'
            ),
            string(
                name: 'DEPLOY_BASE_PARENT',
                defaultValue: 'deploy',
                description: '배포 서버의 사용자 홈 아래에 둘 최상위 디렉터리명입니다.'
            ),
            string(
                name: 'PROJECT_SLUG',
                defaultValue: 'hondigagae',
                description: '배포 디렉터리와 Vault 경로에 사용할 프로젝트 식별자입니다.'
            ),
            string(
                name: 'DEPLOY_APP_DIR',
                defaultValue: 'frontend',
                description: '프로젝트 배포 디렉터리 아래의 애플리케이션 루트 디렉터리명입니다.'
            ),
            string(
                name: 'VAULT_ADDR',
                defaultValue: 'https://vault.8llow8llowme.com',
                description: 'Vault API 주소입니다.'
            ),
            string(
                name: 'VAULT_AUTH_PATH',
                defaultValue: 'approle',
                description: 'Vault AppRole 인증 mount path입니다.'
            ),
            string(
                name: 'VAULT_ROLE_ID_CREDENTIAL_ID',
                defaultValue: 'hondigagae-vault-role-id',
                description: 'Vault AppRole role_id를 담은 Jenkins Secret text Credential ID입니다.'
            ),
            string(
                name: 'VAULT_SECRET_ID_CREDENTIAL_ID',
                defaultValue: 'hondigagae-vault-secret-id',
                description: 'Vault AppRole secret_id를 담은 Jenkins Secret text Credential ID입니다.'
            ),
            string(
                name: 'VAULT_SECRET_ROOT',
                defaultValue: '',
                description: 'Vault KV secret 공통 루트입니다. 비워두면 kv/${PROJECT_SLUG}/frontend를 사용하고 {root}/{env}/env를 조회합니다.'
            ),
            string(
                name: 'VAULT_SECRET_PATH',
                defaultValue: '',
                description: 'Vault secret 전체 경로입니다. 입력하면 VAULT_SECRET_ROOT보다 우선합니다.'
            ),
            string(
                name: 'VAULT_ENGINE_VERSION',
                defaultValue: '2',
                description: 'HashiCorp Vault KV 엔진 버전입니다.'
            ),
            string(
                name: 'DEPLOY_LOCK_NAME',
                defaultValue: 'hondigagae-frontend-deploy',
                description: '프론트 배포를 직렬화할 때 사용할 Lockable Resource 이름입니다.'
            ),
            string(
                name: 'GITHUB_APP_CREDENTIAL_ID',
                defaultValue: 'github-app-followfollowme-jenkins',
                description: 'PR 라벨 조회에 사용할 GitHub App Credential ID입니다. 비우면 라벨을 조회할 수 없어 배포를 생략하고 빌드를 UNSTABLE로 표시합니다.'
            ),
            string(
                name: 'DEPLOY_LABEL_PREFIX',
                defaultValue: 'frontend-',
                description: '배포 대상을 지정하는 PR 라벨 접두어입니다. 라벨명은 {접두어}{serviceName} 형식입니다.'
            )
        ])
    ])

    Map<String, String> ctx = [:]

    stage('배포 문맥 확인') {
        node(config.buildAgentLabel) {
            try {
                deleteDir()
                checkoutSource()
                ctx = resolveGitContext()

                // 모노레포라 backend/ 만 바뀐 push 에도 이 잡이 트리거되므로 먼저 걸러냅니다.
                List<String> changedFiles = resolveChangedFiles(ctx)
                String affectedScope = resolveAffectedScope(config, changedFiles)

                // 파이프라인 정의 파일'만' 바뀐 PR 은 라벨 스코프로 한 번 더 거릅니다.
                // 백엔드 라벨만 붙은 PR 이 공용 Jenkinsfile 을 수정하면 프론트 잡까지 CI 를 돌아
                // GitHub 체크(jenkins/pr-merge)가 무관한 실패로 빨개지는 것을 막습니다.
                // frontend/ 코드가 실제로 바뀐 'own' 은 라벨과 무관하게 반드시 CI 를 돕니다 —
                // 라벨을 빠뜨린 PR 이 검사 0 인 채 머지되는 구멍을 만들지 않기 위해서입니다.
                if (ctx.isPullRequest == 'true' && affectedScope == 'pipeline') {
                    Map<String, Object> prLabelContext = resolveDeployLabelContext(ctx)
                    if (prLabelContext.resolved == 'true') {
                        List<String> allLabels = prLabelContext.labels as List<String>
                        // 배포 스코프 라벨 규약은 두 파이프라인 공통이다: backend-{service} / frontend-{service}
                        List<String> scopedLabels = allLabels.findAll { name ->
                            name.startsWith('backend-') || name.startsWith('frontend-')
                        }
                        String expectedLabel = "${params.DEPLOY_LABEL_PREFIX?.trim() ?: 'frontend-'}${config.serviceName}"
                        if (scopedLabels && !scopedLabels.contains(expectedLabel)) {
                            echo "PR 라벨(${scopedLabels.join(', ')})이 다른 서비스로 지정되어 파이프라인 정의 변경 CI 를 건너뜁니다."
                            ctx.skipReason = "PR 라벨 스코프 밖(${scopedLabels.join(', ')}) - CI 생략"
                            affectedScope = 'none'
                        }
                    }
                    // 라벨 조회 실패 시에는 안전하게 CI 를 그대로 돕니다(fail-open).
                }

                ctx.serviceAffected = (affectedScope != 'none') ? 'true' : 'false'

                if (params.FORCE_DEPLOY && ctx.deployEnv in ['dev', 'prod'] && ctx.isPullRequest != 'true') {
                    // 라벨을 빠뜨리고 머지한 커밋을 수동 배포하는 예외 경로.
                    // 같은 커밋 재빌드는 변경 파일이 없어 '변경 없음 - 생략'에도 걸리므로 두 게이트를 함께 우회합니다.
                    // 웹훅/자동 빌드는 파라미터 기본값(false)으로 돌기 때문에 사람이 명시적으로 켠 빌드에만 작동합니다.
                    echo 'FORCE_DEPLOY가 지정되어 변경 감지와 PR 라벨 게이트를 우회합니다.'
                    currentBuild.description = '강제 배포(FORCE_DEPLOY) - 변경 감지/라벨 게이트 우회'
                    ctx.serviceAffected = 'true'
                    ctx.deployLabelAllowed = 'true'
                } else if (ctx.deployEnv in ['dev', 'prod'] && ctx.serviceAffected == 'true' && ctx.isPullRequest != 'true') {
                    Map<String, Object> labelContext = resolveDeployLabelContext(ctx)
                    ctx.deployLabelAllowed = isServiceDeployAllowedByLabels(config, labelContext) ? 'true' : 'false'
                } else {
                    // PR 빌드와 배포 대상이 아닌 브랜치는 어차피 배포하지 않으므로 라벨을 조회하지 않습니다.
                    ctx.deployLabelAllowed = 'true'
                }

                currentBuild.displayName = "#${env.BUILD_NUMBER} ${config.serviceName} ${env.BRANCH_NAME ?: 'n/a'}"

                echo '=== 빌드 문맥 ==='
                echo "현재 브랜치: ${env.BRANCH_NAME ?: '없음'}"
                echo "서비스 이름: ${config.serviceName}"
                echo "요청 대상 브랜치: ${ctx.requestedTargetBranch ?: '없음'}"
                echo "적용 대상 브랜치: ${ctx.effectiveTargetBranch ?: '없음'}"
                echo "PR SHA: ${ctx.requestedPrSha ?: '없음'}"
                echo "PR 번호: ${ctx.requestedPrNumber ?: '없음'}"
                echo "PR 빌드 여부: ${ctx.isPullRequest}"
                echo "서비스 영향 여부: ${ctx.serviceAffected}"
                echo "라벨 배포 허용 여부: ${ctx.deployLabelAllowed}"
                echo "배포 환경: ${ctx.deployEnv}"
                echo "빌드 에이전트 라벨: ${config.buildAgentLabel}"
                if (ctx.deployEnv in ['dev', 'prod']) {
                    echo "배포 에이전트 라벨: ${resolveDeployAgentLabel(config, ctx)}"
                }
                echo "배포 경로 규칙: \$HOME/${params.DEPLOY_BASE_PARENT}/${params.PROJECT_SLUG}/${params.DEPLOY_APP_DIR}/..."
                if (ctx.deployEnv in ['dev', 'prod']) {
                    String resolvedVaultRoot = params.VAULT_SECRET_ROOT?.trim() ?: "kv/${params.PROJECT_SLUG}/frontend"
                    String resolvedVaultPath = params.VAULT_SECRET_PATH?.trim() ?: "${resolvedVaultRoot}/${ctx.deployEnv}/env"
                    echo "Vault secret path: ${resolvedVaultPath}"
                }
                echo '================='
            } finally {
                deleteDir()
            }
        }
    }

    if (ctx.serviceAffected == 'false') {
        stage('변경 없음 - 생략') {
            echo "이번 변경은 ${config.serviceName}에 영향이 없어 빌드/배포를 건너뜁니다."
            currentBuild.description = ctx.skipReason ?: '변경 없음 - 빌드/배포 생략'
        }
        return
    }

    boolean shouldDeploy = shouldDeployToEnvironment(ctx) && ctx.deployLabelAllowed != 'false'

    // 배포하지 않는 브랜치 빌드는 CI(빌드/검사)도 돌리지 않습니다.
    // CI 게이트는 PR 빌드가 담당하므로 머지/직접 push 빌드에서 다시 돌려봐야 같은 결과의
    // 반복이고, backend/ 만 바뀐 push 나 라벨 없는 머지가 이 잡을 FAILURE 로 물들입니다.
    // (배포 자체는 위 라벨 게이트가 이미 막고 있습니다 — 이 분기는 낭비와 오해를 없애는 것)
    // 단, SKIP_DEPLOY 는 "배포 없이 빌드만 수행" 이 목적이므로 이 생략 대상에서 제외합니다.
    if (ctx.isPullRequest != 'true' && !params.SKIP_DEPLOY && !shouldDeploy) {
        stage('배포 대상 아님 - 생략') {
            echo "배포하지 않는 브랜치 빌드이므로 빌드/검사를 생략합니다. deployEnv=${ctx.deployEnv}, deployLabelAllowed=${ctx.deployLabelAllowed}"
            echo 'CI 는 PR 빌드에서 수행됩니다. 이 커밋을 배포하려면 FORCE_DEPLOY 로 수동 실행하세요.'
            // 라벨 확인 실패(UNSTABLE) 시에는 isServiceDeployAllowedByLabels 가 사유 description 을 이미 설정합니다.
            if (!currentBuild.description) {
                currentBuild.description = ctx.deployLabelAllowed == 'false'
                    ? '배포 대상 라벨 미지정 - 빌드/배포 생략'
                    : '배포 대상 브랜치 아님 - 빌드/배포 생략'
            }
        }
        return
    }

    stage('프론트 빌드') {
        node(config.buildAgentLabel) {
            try {
                deleteDir()
                checkoutSource()

                // NEXT_PUBLIC_* 는 빌드 산출물에 인라인되므로 여기서 주입해야 합니다.
                // dev 와 prod 는 같은 커밋이라도 서로 다른 번들이 나옵니다.
                Map<String, String> buildEnvValues = readBuildEnvValues(config, ctx)

                // NODE_ENV 는 여기서 건드리지 않습니다. production 으로 두면 pnpm 이 devDependencies 를
                // 설치하지 않아 typescript/eslint/vitest 가 없어 검사와 빌드가 모두 실패합니다.
                // next build 는 스스로 NODE_ENV=production 으로 컴파일합니다.
                withEnv(renderEnvBindings(buildEnvValues) + [
                    'NEXT_TELEMETRY_DISABLED=1',
                    'CI=true'
                ]) {
                    dir(config.fsPath as String) {
                        sh '''#!/usr/bin/env bash
set -euo pipefail

# package.json 의 packageManager 필드에 고정된 pnpm 버전을 씁니다.
# corepack 활성화에 실패하면 빌더 이미지에 전역 설치된 pnpm 으로 진행하므로,
# lockfile 버전이 어긋나면 아래 --frozen-lockfile 에서 걸립니다.
corepack enable pnpm >/dev/null 2>&1 || echo 'corepack 활성화 실패 - 전역 pnpm 을 사용합니다.'
echo "pnpm $(pnpm --version)"

# lock 파일과 package.json 이 어긋나면 조용히 다른 버전을 설치하는 대신 실패시킵니다.
pnpm install --frozen-lockfile
'''

                        if (params.RUN_TESTS) {
                            // 배포 전 검사. pnpm qa:verify 는 build 까지 포함하지만 여기서는
                            // build 를 따로 돌려야 하므로(환경변수 주입, 산출물 처리) 검사만 골라 실행합니다.
                            sh '''#!/usr/bin/env bash
set -euo pipefail

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
'''
                        } else {
                            echo 'RUN_TESTS=false 라 format/lint/typecheck/test 를 건너뜁니다.'
                        }

                        sh '''#!/usr/bin/env bash
set -euo pipefail

# 이전 빌드 산출물이 남아 있으면 삭제된 페이지가 그대로 배포될 수 있습니다.
rm -rf .next
pnpm build

# standalone 산출물이 없으면 next.config 의 output 설정이 빠진 것입니다.
# 이대로 배포하면 컨테이너가 server.js 를 찾지 못해 기동 직후 죽습니다.
if [ ! -f .next/standalone/server.js ]; then
  echo "standalone 산출물이 없습니다. next.config.ts 의 output: 'standalone' 설정을 확인하세요."
  exit 1
fi
'''

                        // 빌더는 x86_64(ollama-01), 배포 대상은 aarch64(라즈베리파이)입니다.
                        // 번들에 네이티브 바이너리가 섞이면 배포 호스트에서 로드에 실패해 컨테이너가 죽습니다.
                        // next.config 에서 sharp 를 추적 제외했으므로 정상 상태에서는 0건이어야 합니다.
                        String nativeModules = sh(
                            returnStdout: true,
                            script: "find .next/standalone -name '*.node' -type f | head -20"
                        ).trim()

                        if (nativeModules) {
                            echo "번들에 네이티브 바이너리가 포함되어 있습니다:\n${nativeModules}"
                            echo '빌더(x86_64)와 배포 대상(aarch64)의 아키텍처가 달라 런타임에 실패할 수 있습니다. '
                                + 'next.config 의 outputFileTracingExcludes 로 제외하거나 builder-frontend 라벨을 arm64 노드로 옮기세요.'
                            currentBuild.result = 'UNSTABLE'
                            currentBuild.description = '번들에 네이티브 바이너리 포함 - 아키텍처 확인 필요'
                        }

                        if (shouldDeploy) {
                            // standalone 은 작은 파일이 수천 개라 그대로 stash 하면 매우 느립니다.
                            // 빌더에서 한 번 묶어 단일 아티팩트로 넘깁니다.
                            sh """#!/usr/bin/env bash
set -euo pipefail

# public/ 이 없는 프로젝트도 있습니다. 없으면 tar 가 여기서 죽고,
# 통과하더라도 Dockerfile 의 `COPY public ./public` 이 이미지 빌드에서 죽습니다.
# 빈 디렉터리를 만들어 두면 둘 다 통과하고 런타임 동작도 같습니다.
mkdir -p public

tar -czf ${config.bundleFile} \\
  .next/standalone \\
  .next/static \\
  public \\
  ${config.dockerfile} \\
  ${config.composeFile}

ls -lh ${config.bundleFile}
"""
                        } else {
                            echo '배포하지 않는 빌드(CI 전용)이므로 번들 생성과 stash 를 생략합니다.'
                        }
                    }
                }

                if (shouldDeploy) {
                    stash(
                        name: "bundle-${config.serviceName}",
                        includes: "${config.fsPath}/${config.bundleFile}"
                    )
                }
            } finally {
                deleteDir()
            }
        }
    }

    if (shouldDeploy) {
        stage("${ctx.deployEnv} 환경 배포") {
            lock(resource: params.DEPLOY_LOCK_NAME?.trim() ?: 'hondigagae-frontend-deploy') {
                node(resolveDeployAgentLabel(config, ctx)) {
                    try {
                        deleteDir()
                        unstash "bundle-${config.serviceName}"

                        Map<String, Object> vaultSpec = resolveVaultSpec(config, ctx)
                        Map<String, String> vaultValues = readVaultSecretValues(vaultSpec)
                        List<String> requiredRuntimeKeys = resolveRequiredRuntimeKeys(config, ctx)
                        validateRequiredEnvValues(vaultSpec.path as String, vaultValues, requiredRuntimeKeys)
                        writeFile file: '.env.runtime', text: renderEnvFile(vaultValues)

                        String containerName = "${config.containerNamePrefix}-${ctx.deployEnv}"

                        sh """#!/usr/bin/env bash
set -euo pipefail

SERVICE_DIR="\${HOME}/${params.DEPLOY_BASE_PARENT}/${params.PROJECT_SLUG}/${params.DEPLOY_APP_DIR}/${config.deploySubdir}"

# 이전 배포 산출물이 남으면 삭제된 정적 파일이 계속 서빙됩니다. 통째로 갈아엎습니다.
rm -rf "\${SERVICE_DIR}"
mkdir -p "\${SERVICE_DIR}"
tar -xzf "${config.fsPath}/${config.bundleFile}" -C "\${SERVICE_DIR}"
install -m 600 .env.runtime "\${SERVICE_DIR}/.env.runtime"

docker network inspect 8llow8llowme-net >/dev/null 2>&1 || docker network create 8llow8llowme-net >/dev/null

cd "\${SERVICE_DIR}"
test -s .env.runtime
test -f .next/standalone/server.js

echo "Runtime env key check:"
for required_key in ${requiredRuntimeKeys.join(' ')}; do
  if grep -q "^\${required_key}=" .env.runtime; then
    echo "  \${required_key}=<set>"
  else
    echo "  \${required_key}=<missing>"
    exit 1
  fi
done

# compose 프로젝트명을 디렉터리 basename(api-gateway, web ...)에 맡기지 않는다.
# BossPickSeoul 과 혼디가개가 같은 호스트에서 같은 basename 을 쓰면 하나의 프로젝트로 묶여,
# `up --remove-orphans` 가 상대 프로젝트의 같은 서비스 컨테이너를 orphan 으로 지워 버린다.
# (실제로 hondigagae auth 배포가 bosspickseoul-auth-service-dev 를 내렸다.)
COMPOSE_PROJECT="${config.containerNamePrefix}"
CONTAINER_NAME="${containerName}"

# 1회 이전: 같은 이름의 컨테이너가 옛 프로젝트(디렉터리명)에 묶여 있으면 먼저 지운다.
# 그대로 두면 compose 가 "container name already in use" 로 실패한다.
existing_project="\$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "\${CONTAINER_NAME}" 2>/dev/null || true)"
if [ -n "\${existing_project}" ] && [ "\${existing_project}" != "\${COMPOSE_PROJECT}" ]; then
  echo "기존 컨테이너 \${CONTAINER_NAME} 가 다른 compose 프로젝트(\${existing_project})에 속해 있어 정리합니다."
  docker rm -f "\${CONTAINER_NAME}" >/dev/null
fi

docker compose -p "\${COMPOSE_PROJECT}" --env-file .env.runtime -f ${config.composeFile} config >/dev/null
docker compose -p "\${COMPOSE_PROJECT}" --env-file .env.runtime -f ${config.composeFile} up -d --build --remove-orphans ${config.composeServiceName}-${ctx.deployEnv}

# 1단계: 컨테이너가 살아 있는지
for attempt in \$(seq 1 30); do
  state="\$(docker inspect -f '{{.State.Status}}' ${containerName} 2>/dev/null || true)"

  if [ "\${state}" = "running" ]; then
    break
  fi

  if [ "\${state}" = "exited" ] || [ "\${state}" = "dead" ]; then
    docker logs --tail 200 ${containerName} || true
    exit 1
  fi

  sleep 5
done

if [ "\${state}" != "running" ]; then
  docker logs --tail 200 ${containerName} || true
  exit 1
fi

# 2단계: SSR 서버가 실제로 응답하는지.
# 컨테이너는 running 인데 Next 서버가 요청을 못 받는 상태를 잡아냅니다.
# node:alpine 에는 curl 이 없으므로 Node 22 의 내장 fetch 를 씁니다.
for attempt in \$(seq 1 24); do
  if docker exec ${containerName} node -e "fetch('http://127.0.0.1:3000/').then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo "SSR 응답 확인 완료 (${containerName})"
    docker compose -p "\${COMPOSE_PROJECT}" --env-file .env.runtime -f ${config.composeFile} ps ${config.composeServiceName}-${ctx.deployEnv}
    exit 0
  fi
  sleep 5
done

echo "컨테이너는 떴지만 ${containerName} 이 HTTP 응답을 하지 않습니다."
docker logs --tail 200 ${containerName} || true
exit 1
"""
                    } finally {
                        deleteDir()
                    }
                }
            }
        }
    } else {
        stage('배포 생략') {
            echo "배포를 생략합니다. deployEnv=${ctx.deployEnv}, skipDeploy=${params.SKIP_DEPLOY}, isPullRequest=${ctx.isPullRequest}, deployLabelAllowed=${ctx.deployLabelAllowed}"
            // 라벨 확인 실패 시에는 isServiceDeployAllowedByLabels가 사유를 담은 description을 이미 설정합니다.
            if (ctx.deployLabelAllowed == 'false' && !currentBuild.description) {
                currentBuild.description = '배포 대상 라벨 미지정 - 배포 생략'
            }
        }
    }
}

return this
