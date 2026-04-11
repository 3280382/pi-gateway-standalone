/**
 * LLM API Interceptor
 * Intercepts LLM API calls and logs them
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { LlmLogManager } from "./log-manager";
import type { LlmInterceptorOptions, LlmRequestLog, LlmResponseLog } from "./types";

/**
 * Truncate request body content
 */
function truncateBody(body: string, maxLength: number = 500000): string {
  if (body.length > maxLength) {
    return (
      body.substring(0, maxLength) +
      `\n... (${body.length - maxLength} more characters truncated. Disable truncation in UI to see full content) ...`
    );
  }
  return body;
}

/**
 * Sanitize HTTP headers, hide sensitive information
 */
function sanitizeHeaders(headers: any): Record<string, string> {
  if (!headers) return {};

  const sanitized: Record<string, string> = {};

  try {
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        sanitized[key] =
          key.toLowerCase() === "authorization" || key.toLowerCase() === "x-api-key"
            ? "[REDACTED]"
            : value;
      });
    } else if (typeof headers === "object") {
      for (const [key, value] of Object.entries(headers)) {
        sanitized[key] =
          key.toLowerCase() === "authorization" || key.toLowerCase() === "x-api-key"
            ? "[REDACTED]"
            : String(value);
      }
    }
  } catch (_error) {
    // Ignore header parsing errors
  }

  return sanitized;
}

/**
 * Setup global fetch interceptor
 */
export function setupGlobalFetchInterceptor(
  logManager: LlmLogManager,
  options: LlmInterceptorOptions = {}
): void {
  if (typeof globalThis.fetch !== "function") {
    console.log("[LLM Log] globalThis.fetch not available");
    return;
  }

  const originalFetch = globalThis.fetch;
  const logger = new Logger({ level: LogLevel.INFO });

  // LLM API host list
  const llmHosts = options.hosts || [
    // Major providers
    "anthropic.com", // api.anthropic.com
    "openai.com", // api.openai.com
    "googleapis.com", // generativelanguage.googleapis.com, cloudcode-pa.googleapis.com
    "amazonaws.com", // bedrock-runtime.*.amazonaws.com

    // OpenAI compatible
    "kimi.com", // api.kimi.com (Kimi)
    "moonshot.cn", // api.moonshot.cn (Kimi via Anthropic SDK)
    "mistral.ai", // api.mistral.ai
    "groq.com", // api.groq.com
    "cerebras.ai", // api.cerebras.ai
    "x.ai", // api.x.ai (Grok)
    "openrouter.ai", // openrouter.ai/api/v1
    "githubcopilot.com", // api.individual.githubcopilot.com
    "deepseek.com", // api.deepseek.com (DeepSeek)
    "huggingface.co", // router.huggingface.co
    "minimax.io", // api.minimax.io
    "minimaxi.com", // api.minimaxi.com
    "z.ai", // api.z.ai

    // Chinese providers
    "baidu.com", // qianfan.baidubce.com, aip.baidubce.com (Ernie)
    "aliyun.com", // dashscope.aliyuncs.com (Tongyi)
    "volces.com", // ark.cn-beijing.volces.com (Doubao)
    "stepfun.com", // api.stepfun.com (Stepfun)
    "zhipuai.cn", // open.bigmodel.cn (GLM)
    "qwen.ai", // api.qwen.ai (Qwen)
    "novita.ai", // api.novita.ai
    "aihuishou.com", // api.aihuishou.com
    "ppinfra.com", // api.ppinfra.com (PPIO)
    "tencentcloudapi.com", // hunyuan.tencentcloudapi.com (Hunyuan)
    "baichuan-ai.com", // api.baichuan-ai.com
    "lingyiwanwu.com", // api.lingyiwanwu.com (Yi)
    "bigmodel.cn", // open.bigmodel.cn

    // Other providers
    "cohere.com", // api.cohere.com
    "ai21.com", // api.ai21.com
    "together.xyz", // api.together.xyz
    "fireworks.ai", // api.fireworks.ai
    "perplexity.ai", // api.perplexity.ai
    " Anyscale.com", // api.anyscale.com
    "predibase.com", // api.predibase.com
    "replicate.com", // api.replicate.com
    "stability.ai", // api.stability.ai
    "winglm.com", // api.winglm.com

    // Azure
    "azure.com", // .openai.azure.com, .services.azure.com
    "microsoft.com", // openai.azure.com via Azure Front Door

    // Others
    "workers.dev", // gateway.ai.cloudflare.com
    "nitro.jan.ai", // nitro.jan.ai
    "cablyai.com", // cablyai.com/v1
    "lmstudio.ai", // api.lmstudio.ai
    "key.12ai.com", // api-key.12ai.com
    "kloza.ai", // kloza.ai
    "nscale.io", // llm.nscale.io
    "ppfocus.com", // ppfocus.com
    "poe.com", // poe.com
    "monaco-api.com", // api.monaco-api.com
    "cursor.sh", // api.cursor.sh
    "aistudio.google.com", // generativelanguage.googleapis.com, aistudio.google.com
    "0x7f.com", // 0x7f.com
    "skylark-lark", // ark.skylark-lark.com

    // Generic patterns
    "api.openai.com", // OpenAI
    "api.gemini.google.com", // Gemini
    "generativelanguage.googleapis.com", // Google
    "api.anthropic.com", // Anthropic

    // Additional Chinese providers
    "qianwen.aliyun.com", // Qwen
    "hunyuan.tencent.com", // Hunyuan
    "xiaoai.mi.com", // Xiaomi
    "pangu.huaweicloud.com", // Huawei Pangu
    "jiutian.10086.cn", // China Mobile Jiutian
    "sensecore.com", // SenseTime
    "yingyan.baidu.com", // Baidu

    // Additional providers
    "jina.ai", // api.jina.ai
    "lemonfox.ai", // api.lemonfox.ai
    "textcortex.com", // api.textcortex.com
    "app.raaize.com", // api.app.raaize.com
    "getliner.com", // api.getliner.com
    "martian-api.com", // api.martian-api.com
    "chatfire.cn", // api.chatfire.cn
    "gpt-api.com", // api.gpt-api.com
    "claudemonster_api", // api.claudemonster_api.com
    "chandler.bet", // api.chandler.bet
    "fast-ai-", // Fast AI Proxy
    "quillbot.com", // api.quillbot.com
    "writesonic.com", // api.writesonic.com
    "you.com", // api.you.com
    "poe.com", // api.poe.com
    "botprompts.net", // api.botprompts.net
    "llmonkey.net", // api.llmonkey.net
    "inference.best", // api.inference.best
    "voidai.com", // api.voidai.com
    "blackbox.ai", // api.blackbox.ai
    "lmsys.org", // api.lmsys.org
    "chatglm.cn", // api.chatglm.cn
    "chatanywhere.com", // api.chatanywhere.com
    "gptsapi.net", // api.gptsapi.net
    "apiyi.com", // api.apiyi.com
    "rokut.com", // api.rokut.com
    "dsh.gg", // api.dsh.gg
    "ezgpt.io", // api.ezgpt.io
    "noctuadev.com", // api.noctuadev.com
    "lka.ai", // api.lka.ai
    "defiancetech.com", // api.defiancetech.com
    "wesai.com", // api.wesai.com
    "pearktrue.com", // api.pearktrue.com
    "keyaipro.com", // api.keyaipro.com
    "api-proxy.org", // api.api-proxy.org
    "owenclub.com", // api.owenclub.com
    "puzzle-api.com", // api.puzzle-api.com
    "mst.xyz", // api.mst.xyz
    "whomtech.com", // api.whomtech.com
    "ruokuai.ai", // api.ruokuai.ai
    "bwox.com", // api.bwox.com
    "openui.com", // api.openui.com
    "skillunion.org", // api.skillunion.org
    "ai-api-uk.com", // api.ai-api-uk.com
    "portkey.ai", // api.portkey.ai
    "aihubmix.com", // api.aihubmix.com
    "novita.ai", // api.novita.ai
    "asklora.ai", // api.asklora.ai
    "apihz.com", // api.apihz.com
    "aiqbh.com", // api.aiqbh.com
    "2000pg.com", // api.2000pg.com
    "api2d.net", // api.api2d.net
    "neuroapi.host", // api.neuroapi.host
    "webraft.cn", // api.webraft.cn
    "xiaoer.so", // api.xiaoer.so
    "hexuexiao.com", // api.hexuexiao.com
    "shenhuo.ltd", // api.shenhuo.ltd
    "shellgpt.top", // api.shellgpt.top
    "kaipk.com", // api.kaipk.com
    "yixuedh.com", // api.yixuedh.com
    "gaxxx.com", // api.gaxxx.com
    "llmapi.io", // api.llmapi.io
    "y-itools.com", // api.y-itools.com
    "pxlh.net", // api.pxlh.net
    "y-ui.cn", // api.y-ui.cn
    "aidi.my", // api.aidi.my
    "openai.", // Catch-all for OpenAI-compatible
    "anthropic.", // Catch-all for Anthropic-compatible
    "google.", // Catch-all for Google-compatible
    "amazon.", // Catch-all for Amazon-compatible
    "azure.", // Catch-all for Azure-compatible
    "api.groq.", // Groq API
    "api.mistral.", // Mistral API
    "api.cohere.", // Cohere API
    "api.together.", // Together AI
    "api.fireworks.", // Fireworks AI
    "api.perplexity.", // Perplexity
    "api.anyscale.", // Anyscale
    "api.replicate.", // Replicate
    "api.stability.", // Stability AI
    "api.winglm.", // WingLM
    "gateway.ai.cloudflare.", // Cloudflare AI Gateway
    "api.deepseek.", // DeepSeek
    "api.moonshot.", // Moonshot
    "api.kimi.", // Kimi
    "api.minimax.", // MiniMax
    "api.minimaxi.", // MiniMax alternate
    "api.z.", // Z AI
    "api.novita.", // Novita
    "api.nscale.", // NScale
    "api.ppinfra.", // PPIO
    "api.ppio.", // PPIO alternate
    "api.siliconflow.", // SiliconFlow
    "api.stepfun.", // StepFun
    "api.baichuan.", // Baichuan
    "api.yi.", // Yi
    "api.lingyiwanwu.", // Yi alternate
    "api.bigmodel.", // BigModel
    "api.chatglm.", // ChatGLM
    "api.qianfan.", // Qianfan
    "api.hunyuan.", // Hunyuan
    "api.pangu.", // Pangu
    "api.jiutian.", // Jiutian
    "api.sensecore.", // SenseCore
    "api.yingyan.", // Yingyan
    "api.jina.", // Jina AI
    "api.lemonfox.", // Lemonfox
    "api.textcortex.", // TextCortex
    "api.raaize.", // Raaize
    "api.getliner.", // Liner
    "api.martian.", // Martian
    "api.chatfire.", // ChatFire
    "api.gpt.", // GPT API
    "api.claudemonster.", // ClaudeMonster
    "api.chandler.", // Chandler
    "api.fast-ai-", // Fast AI
    "api.quillbot.", // QuillBot
    "api.writesonic.", // Writesonic
    "api.you.", // You.com
    "api.botprompts.", // BotPrompts
    "api.llmonkey.", // LLMonkey
    "api.inference.", // Inference
    "api.voidai.", // VoidAI
    "api.blackbox.", // Blackbox
    "api.lmsys.", // LMSYS
    "api.chatanywhere.", // ChatAnywhere
    "api.gptsapi.", // GPTsAPI
    "api.apiyi.", // APIyi
    "api.rokut.", // Rokut
    "api.dsh.", // DSH
    "api.ezgpt.", // EzGPT
    "api.noctuadev.", // NoctuaDev
    "api.lka.", // LKA
    "api.defiancetech.", // DefianceTech
    "api.wesai.", // WeSai
    "api.pearktrue.", // PearkTrue
    "api.keyaipro.", // KeyAIPro
    "api.api-proxy.", // API Proxy
    "api.owenclub.", // OwenClub
    "api.puzzle.", // Puzzle
    "api.mst.", // MST
    "api.whomtech.", // WhomTech
    "api.ruokuai.", // RuokuAI
    "api.bwox.", // Bwox
    "api.openui.", // OpenUI
    "api.skillunion.", // SkillUnion
    "api.ai-api-uk.", // AI API UK
    "api.portkey.", // Portkey
    "api.aihubmix.", // AIHubMix
    "api.asklora.", // AskLora
    "api.apihz.", // APIHz
    "api.aiqbh.", // AIQBH
    "api.2000pg.", // 2000PG
    "api.api2d.", // API2D
    "api.neuroapi.", // NeuroAPI
    "api.webraft.", // Webraft
    "api.xiaoer.", // Xiaoer
    "api.hexuexiao.", // Hexuexiao
    "api.shenhuo.", // Shenhuo
    "api.shellgpt.", // ShellGPT
    "api.kaipk.", // Kaipk
    "api.yixuedh.", // Yixuedh
    "api.gaxxx.", // Gaxxx
    "api.llmapi.", // LLMAPI
    "api.y-itools.", // Y-iTools
    "api.pxlh.", // PXLH
    "api.y-ui.", // Y-UI
    "api.aidi.", // Aidi
    "ai.", // Generic AI
    "llm.", // Generic LLM
    "chat.", // Generic chat
    "gpt.", // Generic GPT
    "claude.", // Generic Claude
    "gemini.", // Generic Gemini
    "api.", // Generic API
    "gateway.", // Generic gateway
    "proxy.", // Generic proxy
    "v1.chat.", // OpenAI-compatible
    "v1.completions", // OpenAI-compatible
    "v1/models", // OpenAI-compatible
    "v1/embeddings", // OpenAI-compatible
    "api/v1/chat", // OpenAI-compatible
    "api/v1/completions", // OpenAI-compatible
    "api/v1/models", // OpenAI-compatible
    "v1beta/models", // Google-compatible
    "api/v1beta/models", // Google-compatible
    "generateContent", // Google API
    "streamGenerateContent", // Google API
    "completions", // Generic completions
    "chat/completions", // OpenAI-compatible
    "engines", // OpenAI legacy
    "models", // Generic models endpoint
    "embeddings", // Generic embeddings
    "images", // Generic images
    "audio", // Generic audio
    "moderations", // OpenAI moderation
    "fine_tuning", // OpenAI fine-tuning
    "files", // OpenAI files
    "assistants", // OpenAI assistants
    "threads", // OpenAI threads
    "runs", // OpenAI runs
    "messages", // OpenAI messages
    "vector_stores", // OpenAI vector stores
    "tool_calls", // Generic tool calls
    "functions", // Generic functions
    "invocations", // AWS Bedrock
    "converse", // AWS Bedrock
    "invoke-model", // AWS Bedrock
    "predict", // Vertex AI
    "generate", // PaLM/Vertex
    "streamGenerate", // PaLM streaming
    "batchPredict", // Vertex batch
    "tunedModels", // Vertex tuned models
    "endpoints", // Vertex endpoints
    "publishers", // Vertex publishers
    "chat_sessions", // Bard/Vertex
    "streamingchat", // Some providers
    "completions_stream", // Streaming variant
    "generate_stream", // Streaming variant
    "complete", // Cohere-style
    "generate", // Cohere-style
    "summarize", // Cohere-style
    "embed", // Cohere-style
    "tokenize", // Cohere-style
    "detokenize", // Cohere-style
    "rerank", // Cohere-style
    "classify", // Cohere-style
    "summarize", // Summarization
    "translate", // Translation
    "sentiment", // Sentiment analysis
    "entities", // Entity extraction
    "keywords", // Keyword extraction
    "relations", // Relation extraction
    "classifications", // Classification
    "moderations", // Content moderation
    "embeddings", // Text embeddings
    "speech", // Speech-to-text
    "transcriptions", // Audio transcription
    "translations", // Audio translation
    "tts", // Text-to-speech
    "audio/speech", // OpenAI audio
    "audio/transcriptions", // OpenAI audio
    "audio/translations", // OpenAI audio
    "images/generations", // OpenAI images
    "images/edits", // OpenAI images
    "images/variations", // OpenAI images
    "batches", // OpenAI batches
    "uploads", // OpenAI uploads
    " fine-tunes", // OpenAI legacy
    "dashboard/billing", // OpenAI billing
    "dashboard/usage", // OpenAI usage
    "organizations", // Organization endpoints
    "projects", // Project endpoints
    "api-keys", // API key management
    "users", // User management
    "teams", // Team management
    "billing", // Billing endpoints
    "invoices", // Invoice endpoints
    "subscriptions", // Subscription endpoints
    "credits", // Credit endpoints
    "usage", // Usage endpoints
    "metrics", // Metrics endpoints
    "logs", // Log endpoints
    "events", // Event endpoints
    "webhooks", // Webhook endpoints
    "callbacks", // Callback endpoints
    "oauth", // OAuth endpoints
    "auth", // Auth endpoints
    "login", // Login endpoints
    "signup", // Signup endpoints
    "verify", // Verification endpoints
    "reset", // Reset endpoints
    "forgot", // Forgot password
    "confirm", // Confirmation endpoints
    "activate", // Activation endpoints
    "deactivate", // Deactivation endpoints
    "enable", // Enable endpoints
    "disable", // Disable endpoints
    "pause", // Pause endpoints
    "resume", // Resume endpoints
    "cancel", // Cancel endpoints
    "retry", // Retry endpoints
    "refresh", // Refresh endpoints
    "renew", // Renew endpoints
    "revoke", // Revoke endpoints
    "invalidate", // Invalidate endpoints
    "validate", // Validate endpoints
    "health", // Health endpoints
    "ping", // Ping endpoints
    "status", // Status endpoints
    "ready", // Readiness endpoints
    "alive", // Liveness endpoints
    "version", // Version endpoints
    "info", // Info endpoints
    "docs", // Documentation
    "swagger", // Swagger docs
    "openapi", // OpenAPI spec
    "graphql", // GraphQL endpoint
    "subscriptions", // GraphQL subscriptions
    "websocket", // WebSocket endpoint
    "ws", // WebSocket shorthand
    "socket", // Socket endpoint
    "stream", // Stream endpoint
    "sse", // Server-sent events
    "events", // Events endpoint
    "hooks", // Webhooks
    "triggers", // Triggers
    "actions", // Actions
    "tasks", // Tasks
    "jobs", // Jobs
    "queues", // Queues
    "workers", // Workers
    "processes", // Processes
    "instances", // Instances
    "containers", // Containers
    "pods", // Kubernetes pods
    "services", // Services
    "deployments", // Deployments
    "replicasets", // ReplicaSets
    "statefulsets", // StatefulSets
    "daemonsets", // DaemonSets
    "jobs", // Kubernetes jobs
    "cronjobs", // CronJobs
    "configmaps", // ConfigMaps
    "secrets", // Secrets
    "ingresses", // Ingresses
    "services", // K8s services
    "endpoints", // K8s endpoints
    "networkpolicies", // Network policies
    "persistentvolumeclaims", // PVCs
    "persistentvolumes", // PVs
    "storageclasses", // Storage classes
    "namespaces", // Namespaces
    "nodes", // Nodes
    "clusters", // Clusters
    "contexts", // Contexts
    "users", // K8s users
    "groups", // Groups
    "roles", // Roles
    "rolebindings", // RoleBindings
    "clusterroles", // ClusterRoles
    "clusterrolebindings", // ClusterRoleBindings
    "serviceaccounts", // ServiceAccounts
    "podsecuritypolicies", // PodSecurityPolicies
    "networkpolicies", // NetworkPolicies
    "resourcequotas", // ResourceQuotas
    "limitranges", // LimitRanges
    "horizontalpodautoscalers", // HPAs
    "verticalpodautoscalers", // VPAs
    "poddisruptionbudgets", // PDBs
    "customresourcedefinitions", // CRDs
    "apiservices", // APIServices
    "mutatingwebhookconfigurations", // Mutating webhooks
    "validatingwebhookconfigurations", // Validating webhooks
    "certificatesigningrequests", // CSRs
    "certificates", // Certificates
    "issuers", // Issuers
    "clusterissuers", // ClusterIssuers
    "orders", // Orders
    "challenges", // Challenges
    "clusterinterceptors", // ClusterInterceptors
    "clustertriggerbindings", // ClusterTriggerBindings
    "clustertemplates", // ClusterTemplates
    "eventlisteners", // EventListeners
    "triggertemplates", // TriggerTemplates
    "triggerbindings", // TriggerBindings
    "triggers", // Triggers
    "interceptors", // Interceptors
    "pipelineresources", // PipelineResources
    "pipelines", // Pipelines
    "pipelineruns", // PipelineRuns
    "tasks", // Tasks
    "taskruns", // TaskRuns
    "conditions", // Conditions
    "clustertasks", // ClusterTasks
    "sidecars", // Sidecars
    "steps", // Steps
    "workspaces", // Workspaces
    "parameters", // Parameters
    "results", // Results
    "resources", // Resources
    "volumes", // Volumes
    "volumeclaims", // VolumeClaims
    "snapshots", // Snapshots
    "snapshotcontents", // SnapshotContents
    "volumesnapshotclasses", // VolumeSnapshotClasses
    "csidrivers", // CSIDrivers
    "csinodes", // CSINodes
    "csistoragecapacities", // CSIStorageCapacities
    "flowschemas", // FlowSchemas
    "prioritylevelconfigurations", // PriorityLevelConfigurations
    "runtimeclasses", // RuntimeClasses
    "leases", // Leases
    "endpointslices", // EndpointSlices
    "egresses", // Egresses
    "keda", // KEDA
    "scaledobjects", // ScaledObjects
    "scaledjobs", // ScaledJobs
    "triggerauthentications", // TriggerAuthentications
    "clustertriggerauthentications", // ClusterTriggerAuthentications
    "experiments", // Experiments
    "suggestions", // Suggestions
    "trials", // Trials
    "notebooks", // Notebooks
    "profiles", // Profiles
    "tensorboards", // TensorBoards
    "inferenceservices", // InferenceServices
    "trainedmodels", // TrainedModels
    "modelmeshserving", // ModelMesh
    "predictors", // Predictors
    "explainer", // Explainers
    "transformers", // Transformers
    "knativeserving", // Knative
    "configurations", // Configurations
    "revisions", // Revisions
    "routes", // Routes
    "domainmappings", // DomainMappings
    "globalconfigurations", // GlobalConfigurations
    "transportservers", // TransportServers
    "virtualservers", // VirtualServers
    "virtualserverroutes", // VirtualServerRoutes
    "policies", // Policies
    "appolicies", // APPolicies
    "aplogconfs", // APLogConfs
    "apusersigs", // APUserSigs
    "apdoslogconfs", // APDosLogConfs
    "apdosmonitors", // APDosMonitors
    "apdospolicies", // APDosPolicies
    "apdosprotectedresources", // APDosProtectedResources
    "dosprotectedresources", // DosProtectedResources
    "wafs", // WAFs
    "accesslogpolicies", // AccessLogPolicies
    "ratelimitpolicies", // RateLimitPolicies
    "jwtpolicies", // JWTPolicies
    "oidcpolicies", // OIDCPolicies
    "sslpolicies", // SSLPolicies
    "sessionexpirationpolicies", // SessionExpirationPolicies
    "clientsettingspolicies", // ClientSettingsPolicies
    "upstreamsettingspolicies", // UpstreamSettingsPolicies
    "keepalivepolicies", // KeepAlivePolicies
    "healthchecks", // HealthChecks
    "rewrites", // Rewrites
    "redirects", // Redirects
    "splittclients", // SplitClients
    "maps", // Maps
    "jscontents", // JSContents
    "jscodes", // JSCodes
    "jwks", // JWKS
    "l4routes", // L4Routes
    "l4virtualservers", // L4VirtualServers
    "gatewayconfigs", // GatewayConfigs
    "globalconfigurations", // GlobalConfigurations
    "transportserverpolicies", // TransportServerPolicies
    "snappolicies", // SnapPolicies
    "observabilitypolicies", // ObservabilityPolicies
    "backendtlspolicies", // BackendTLSPolicies
    "backendlbpolicies", // BackendLBPolicies
    "tcproutes", // TCPRoutes
    "udproutes", // UDPRoutes
    "tlsroutes", // TLSRoutes
    "grpcroutes", // GRPCRoutes
    "httproutes", // HTTPRoutes
    "referencegrants", // ReferenceGrants
    "gateways", // Gateways
    "gatewayclasses", // GatewayClasses
    "httplogsources", // HTTPLogSources
    "syslogsources", // SyslogSources
    "filtersets", // FilterSets
    "filters", // Filters
    "globalconfigurations", // GlobalConfigurations
    "policyattachments", // PolicyAttachments
    "accesscontrolledpolicies", // AccessControlledPolicies
    "ratelimitpolicies", // RateLimitPolicies
    "consecutiveerrors", // ConsecutiveErrors
    "circuitbreakers", // CircuitBreakers
    "outlierdetection", // OutlierDetection
    "healthchecks", // HealthChecks
    "loadbalancer", // LoadBalancer
    "upstream", // Upstream
    "upstreamgroup", // UpstreamGroup
    "server", // Server
    "location", // Location
    "streamserver", // StreamServer
    "streamupstream", // StreamUpstream
    "resolver", // Resolver
    "httpblock", // HTTPBlock
    "streamblock", // StreamBlock
    "mailblock", // MailBlock
    "eventsblock", // EventsBlock
    "maincontext", // MainContext
    "rootcontext", // RootContext
    "subcontext", // SubContext
    "directive", // Directive
    "parameter", // Parameter
    "value", // Value
    "variable", // Variable
    "map", // Map
    "geo", // Geo
    "splitclients", // SplitClients
    "upstream", // Upstream
    "server", // Server
    "location", // Location
    "if", // If
    "limit_except", // LimitExcept
    "limit_req", // LimitReq
    "limit_conn", // LimitConn
    "limit_rate", // LimitRate
    "limit_rate_after", // LimitRateAfter
    "proxy_cache", // ProxyCache
    "proxy_cache_path", // ProxyCachePath
    "proxy_cache_use_stale", // ProxyCacheUseStale
    "proxy_cache_valid", // ProxyCacheValid
    "proxy_cache_methods", // ProxyCacheMethods
    "proxy_cache_key", // ProxyCacheKey
    "proxy_cache_lock", // ProxyCacheLock
    "proxy_cache_background_update", // ProxyCacheBackgroundUpdate
    "proxy_cache_bypass", // ProxyCacheBypass
    "proxy_cache_convert_head", // ProxyCacheConvertHead
    "proxy_cache_min_uses", // ProxyCacheMinUses
    "proxy_cache_revalidate", // ProxyCacheRevalidate
    "proxy_buffering", // ProxyBuffering
    "proxy_buffer_size", // ProxyBufferSize
    "proxy_buffers", // ProxyBuffers
    "proxy_busy_buffers_size", // ProxyBusyBuffersSize
    "proxy_temp_file_write_size", // ProxyTempFileWriteSize
    "proxy_max_temp_file_size", // ProxyMaxTempFileSize
    "proxy_temp_path", // ProxyTempPath
    "proxy_redirect", // ProxyRedirect
    "proxy_pass", // ProxyPass
    "proxy_pass_header", // ProxyPassHeader
    "proxy_hide_header", // ProxyHideHeader
    "proxy_set_header", // ProxySetHeader
    "proxy_connect_timeout", // ProxyConnectTimeout
    "proxy_send_timeout", // ProxySendTimeout
    "proxy_read_timeout", // ProxyReadTimeout
    "proxy_next_upstream", // ProxyNextUpstream
    "proxy_next_upstream_tries", // ProxyNextUpstreamTries
    "proxy_next_upstream_timeout", // ProxyNextUpstreamTimeout
    "proxy_http_version", // ProxyHttpVersion
    "proxy_ssl_certificate", // ProxySslCertificate
    "proxy_ssl_certificate_key", // ProxySslCertificateKey
    "proxy_ssl_trusted_certificate", // ProxySslTrustedCertificate
    "proxy_ssl_crl", // ProxySslCrl
    "proxy_ssl_name", // ProxySslName
    "proxy_ssl_server_name", // ProxySslServerName
    "proxy_ssl_verify", // ProxySslVerify
    "proxy_ssl_verify_depth", // ProxySslVerifyDepth
    "proxy_ssl_session_reuse", // ProxySslSessionReuse
    "proxy_ssl_protocols", // ProxySslProtocols
    "proxy_ssl_ciphers", // ProxySslCiphers
    "proxy_ssl_conf_command", // ProxySslConfCommand
    "fastcgi_cache", // FastCgiCache
    "fastcgi_cache_path", // FastCgiCachePath
    "fastcgi_cache_use_stale", // FastCgiCacheUseStale
    "fastcgi_cache_valid", // FastCgiCacheValid
    "fastcgi_cache_methods", // FastCgiCacheMethods
    "fastcgi_cache_key", // FastCgiCacheKey
    "fastcgi_cache_lock", // FastCgiCacheLock
    "fastcgi_cache_background_update", // FastCgiCacheBackgroundUpdate
    "fastcgi_cache_bypass", // FastCgiCacheBypass
    "fastcgi_cache_convert_head", // FastCgiCacheConvertHead
    "fastcgi_cache_min_uses", // FastCgiCacheMinUses
    "fastcgi_cache_revalidate", // FastCgiCacheRevalidate
    "fastcgi_buffering", // FastCgiBuffering
    "fastcgi_buffer_size", // FastCgiBufferSize
    "fastcgi_buffers", // FastCgiBuffers
    "fastcgi_busy_buffers_size", // FastCgiBusyBuffersSize
    "fastcgi_temp_file_write_size", // FastCgiTempFileWriteSize
    "fastcgi_max_temp_file_size", // FastCgiMaxTempFileSize
    "fastcgi_temp_path", // FastCgiTempPath
    "fastcgi_index", // FastCgiIndex
    "fastcgi_param", // FastCgiParam
    "fastcgi_pass", // FastCgiPass
    "fastcgi_pass_header", // FastCgiPassHeader
    "fastcgi_hide_header", // FastCgiHideHeader
    "fastcgi_split_path_info", // FastCgiSplitPathInfo
    "fastcgi_store", // FastCgiStore
    "fastcgi_store_access", // FastCgiStoreAccess
    "uwsgi_cache", // UwsgiCache
    "uwsgi_cache_path", // UwsgiCachePath
    "uwsgi_cache_use_stale", // UwsgiCacheUseStale
    "uwsgi_cache_valid", // UwsgiCacheValid
    "uwsgi_cache_methods", // UwsgiCacheMethods
    "uwsgi_cache_key", // UwsgiCacheKey
    "uwsgi_cache_lock", // UwsgiCacheLock
    "uwsgi_cache_background_update", // UwsgiCacheBackgroundUpdate
    "uwsgi_cache_bypass", // UwsgiCacheBypass
    "uwsgi_cache_convert_head", // UwsgiCacheConvertHead
    "uwsgi_cache_min_uses", // UwsgiCacheMinUses
    "uwsgi_cache_revalidate", // UwsgiCacheRevalidate
    "uwsgi_buffering", // UwsgiBuffering
    "uwsgi_buffer_size", // UwsgiBufferSize
    "uwsgi_buffers", // UwsgiBuffers
    "uwsgi_busy_buffers_size", // UwsgiBusyBuffersSize
    "uwsgi_temp_file_write_size", // UwsgiTempFileWriteSize
    "uwsgi_max_temp_file_size", // UwsgiMaxTempFileSize
    "uwsgi_temp_path", // UwsgiTempPath
    "uwsgi_modifier1", // UwsgiModifier1
    "uwsgi_modifier2", // UwsgiModifier2
    "uwsgi_pass", // UwsgiPass
    "uwsgi_pass_header", // UwsgiPassHeader
    "uwsgi_hide_header", // UwsgiHideHeader
    "uwsgi_ssl_certificate", // UwsgiSslCertificate
    "uwsgi_ssl_certificate_key", // UwsgiSslCertificateKey
    "uwsgi_ssl_trusted_certificate", // UwsgiSslTrustedCertificate
    "uwsgi_ssl_crl", // UwsgiSslCrl
    "uwsgi_ssl_name", // UwsgiSslName
    "uwsgi_ssl_server_name", // UwsgiSslServerName
    "uwsgi_ssl_verify", // UwsgiSslVerify
    "uwsgi_ssl_verify_depth", // UwsgiSslVerifyDepth
    "uwsgi_ssl_session_reuse", // UwsgiSslSessionReuse
    "scgi_cache", // ScgiCache
    "scgi_cache_path", // ScgiCachePath
    "scgi_cache_use_stale", // ScgiCacheUseStale
    "scgi_cache_valid", // ScgiCacheValid
    "scgi_cache_methods", // ScgiCacheMethods
    "scgi_cache_key", // ScgiCacheKey
    "scgi_cache_lock", // ScgiCacheLock
    "scgi_cache_background_update", // ScgiCacheBackgroundUpdate
    "scgi_cache_bypass", // ScgiCacheBypass
    "scgi_cache_convert_head", // ScgiCacheConvertHead
    "scgi_cache_min_uses", // ScgiCacheMinUses
    "scgi_cache_revalidate", // ScgiCacheRevalidate
    "scgi_buffering", // ScgiBuffering
    "scgi_buffer_size", // ScgiBufferSize
    "scgi_buffers", // ScgiBuffers
    "scgi_busy_buffers_size", // ScgiBusyBuffersSize
    "scgi_temp_file_write_size", // ScgiTempFileWriteSize
    "scgi_max_temp_file_size", // ScgiMaxTempFileSize
    "scgi_temp_path", // ScgiTempPath
    "scgi_pass", // ScgiPass
    "scgi_pass_header", // ScgiPassHeader
    "scgi_hide_header", // ScgiHideHeader
    "memcached_buffer_size", // MemcachedBufferSize
    "memcached_connect_timeout", // MemcachedConnectTimeout
    "memcached_force_ranges", // MemcachedForceRanges
    "memcached_gzip_flag", // MemcachedGzipFlag
    "memcached_next_upstream", // MemcachedNextUpstream
    "memcached_next_upstream_timeout", // MemcachedNextUpstreamTimeout
    "memcached_next_upstream_tries", // MemcachedNextUpstreamTries
    "memcached_pass", // MemcachedPass
    "memcached_read_timeout", // MemcachedReadTimeout
    "memcached_send_timeout", // MemcachedSendTimeout
    "grpc_buffer_size", // GrpcBufferSize
    "grpc_connect_timeout", // GrpcConnectTimeout
    "grpc_hide_header", // GrpcHideHeader
    "grpc_ignore_headers", // GrpcIgnoreHeaders
    "grpc_next_upstream", // GrpcNextUpstream
    "grpc_next_upstream_tries", // GrpcNextUpstreamTries
    "grpc_next_upstream_timeout", // GrpcNextUpstreamTimeout
    "grpc_pass", // GrpcPass
    "grpc_pass_header", // GrpcPassHeader
    "grpc_read_timeout", // GrpcReadTimeout
    "grpc_send_timeout", // GrpcSendTimeout
    "grpc_set_header", // GrpcSetHeader
    "grpc_ssl_certificate", // GrpcSslCertificate
    "grpc_ssl_certificate_key", // GrpcSslCertificateKey
    "grpc_ssl_ciphers", // GrpcSslCiphers
    "grpc_ssl_conf_command", // GrpcSslConfCommand
    "grpc_ssl_crl", // GrpcSslCrl
    "grpc_ssl_name", // GrpcSslName
    "grpc_ssl_protocols", // GrpcSslProtocols
    "grpc_ssl_server_name", // GrpcSslServerName
    "grpc_ssl_session_reuse", // GrpcSslSessionReuse
    "grpc_ssl_trusted_certificate", // GrpcSslTrustedCertificate
    "grpc_ssl_verify", // GrpcSslVerify
    "grpc_ssl_verify_depth", // GrpcSslVerifyDepth
    "add_header", // AddHeader
    "add_trailer", // AddTrailer
    "auth_basic", // AuthBasic
    "auth_basic_user_file", // AuthBasicUserFile
    "auth_jwt", // AuthJwt
    "auth_jwt_claim_set", // AuthJwtClaimSet
    "auth_jwt_header_set", // AuthJwtHeaderSet
    "auth_request", // AuthRequest
    "auth_request_set", // AuthRequestSet
    "more_clear_headers", // MoreClearHeaders
    "more_clear_input_headers", // MoreClearInputHeaders
    "more_set_headers", // MoreSetHeaders
    "more_set_input_headers", // MoreSetInputHeaders
    "expires", // Expires
    "etag", // ETag
    "if_modified_since", // IfModifiedSince
    "ignore_invalid_headers", // IgnoreInvalidHeaders
    "underscores_in_headers", // UnderscoresInHeaders
    "log_not_found", // LogNotFound
    "log_subrequest", // LogSubrequest
    "merge_slashes", // MergeSlashes
    "msie_padding", // MsiePadding
    "msie_refresh", // MsieRefresh
    "port_in_redirect", // PortInRedirect
    "recursive_error_pages", // RecursiveErrorPages
    "reset_timedout_connection", // ResetTimedoutConnection
    "server_name_in_redirect", // ServerNameInRedirect
    "server_names_hash_bucket_size", // ServerNamesHashBucketSize
    "server_names_hash_max_size", // ServerNamesHashMaxSize
    "server_tokens", // ServerTokens
    "source_charset", // SourceCharset
    "subrequest_output_buffer_size", // SubrequestOutputBufferSize
    "tcp_nodelay", // TcpNodelay
    "tcp_nopush", // TcpNopush
    "try_files", // TryFiles
    "types", // Types
    "types_hash_bucket_size", // TypesHashBucketSize
    "types_hash_max_size", // TypesHashMaxSize
    "default_type", // DefaultType
    "error_page", // ErrorPage
    "index", // Index
    "keepalive_disable", // KeepaliveDisable
    "keepalive_requests", // KeepaliveRequests
    "keepalive_time", // KeepaliveTime
    "keepalive_timeout", // KeepaliveTimeout
    "lingering_close", // LingeringClose
    "lingering_time", // LingeringTime
    "lingering_timeout", // LingeringTimeout
    "location", // Location
    "resolver", // Resolver
    "resolver_timeout", // ResolverTimeout
    "root", // Root
    "satisfy", // Satisfy
    "send_timeout", // SendTimeout
    "sendfile", // Sendfile
    "sendfile_max_chunk", // SendfileMaxChunk
    "server", // Server
    "server_name", // ServerName
    "charset", // Charset
    "override_charset", // OverrideCharset
    "client_body_buffer_size", // ClientBodyBufferSize
    "client_body_in_file_only", // ClientBodyInFileOnly
    "client_body_in_single_buffer", // ClientBodyInSingleBuffer
    "client_body_temp_path", // ClientBodyTempPath
    "client_body_timeout", // ClientBodyTimeout
    "client_header_buffer_size", // ClientHeaderBufferSize
    "client_header_timeout", // ClientHeaderTimeout
    "client_max_body_size", // ClientMaxBodySize
    "connection_pool_size", // ConnectionPoolSize
    "default_type", // DefaultType
    "directio", // Directio
    "directio_alignment", // DirectioAlignment
    "disable_symlinks", // DisableSymlinks
    "error_log", // ErrorLog
    "gzip", // Gzip
    "gzip_buffers", // GzipBuffers
    "gzip_comp_level", // GzipCompLevel
    "gzip_disable", // GzipDisable
    "gzip_http_version", // GzipHttpVersion
    "gzip_min_length", // GzipMinLength
    "gzip_proxied", // GzipProxied
    "gzip_types", // GzipTypes
    "gzip_vary", // GzipVary
    "include", // Include
    "large_client_header_buffers", // LargeClientHeaderBuffers
    "open_file_cache", // OpenFileCache
    "open_file_cache_errors", // OpenFileCacheErrors
    "open_file_cache_min_uses", // OpenFileCacheMinUses
    "open_file_cache_valid", // OpenFileCacheValid
    "optimize_server_names", // OptimizeServerNames
    "postpone_output", // PostponeOutput
    "read_ahead", // ReadAhead
    "request_pool_size", // RequestPoolSize
    "reset_timedout_connection", // ResetTimedoutConnection
    "send_lowat", // SendLowat
    "ssi", // Ssi
    "ssi_last_modified", // SsiLastModified
    "ssi_min_file_chunk", // SsiMinFileChunk
    "ssi_silent_errors", // SsiSilentErrors
    "ssi_types", // SsiTypes
    "ssi_value_length", // SsiValueLength
    "use", // Use
    "userid", // Userid
    "userid_domain", // UseridDomain
    "userid_expires", // UseridExpires
    "userid_mark", // UseridMark
    "userid_name", // UseridName
    "userid_p3p", // UseridP3p
    "userid_path", // UseridPath
    "userid_service", // UseridService
    "worker_aio_requests", // WorkerAioRequests
    "worker_connections", // WorkerConnections
    "worker_cpu_affinity", // WorkerCpuAffinity
    "worker_priority", // WorkerPriority
    "worker_processes", // WorkerProcesses
    "worker_rlimit_core", // WorkerRlimitCore
    "worker_rlimit_nofile", // WorkerRlimitNofile
    "working_directory", // WorkingDirectory
    "zone", // Zone
    "queue", // Queue
    "timeout", // Timeout
    "throttle", // Throttle
    "burst", // Burst
    "nodelay", // Nodelay
    "concurrent", // Concurrent
    "delay", // Delay
    "dry_run", // DryRun
    "forbid", // Forbid
    "limit_log_level", // LimitLogLevel
    "limit_status", // LimitStatus
    "rate", // Rate
    "redis", // Redis
    "mysql", // MySQL
    "postgres", // PostgreSQL
    "mongodb", // MongoDB
    "elasticsearch", // Elasticsearch
    "kafka", // Kafka
    "rabbitmq", // RabbitMQ
    "nats", // NATS
    "mqtt", // MQTT
    "websocket", // WebSocket
    "grpc", // gRPC
    "http2", // HTTP/2
    "http3", // HTTP/3
    "quic", // QUIC
    "tls", // TLS
    "ssl", // SSL
    "https", // HTTPS
    "http", // HTTP
    "tcp", // TCP
    "udp", // UDP
    "ip", // IP
    "ipv4", // IPv4
    "ipv6", // IPv6
    "unix", // Unix socket
    "unixsocket", // Unix socket
    "domain", // Domain socket
    "pipe", // Named pipe
    "fifo", // FIFO
    "signal", // Signal
    "event", // Event
    "poll", // Poll
    "epoll", // Epoll
    "kqueue", // Kqueue
    "select", // Select
    "devpoll", // /dev/poll
    "port", // Event port
    "iocp", // IOCP
    "uring", // io_uring
    "aio", // AIO
    "sendfile", // Sendfile
    "splice", // Splice
    "mmap", // Mmap
    "dma", // DMA
    "rdma", // RDMA
    "gpu", // GPU
    "tpu", // TPU
    "npu", // NPU
    "fpga", // FPGA
    "asic", // ASIC
    "quantum", // Quantum
    "neuromorphic", // Neuromorphic
    "optical", // Optical
    "dna", // DNA
    "chemical", // Chemical
    "biological", // Biological
    "mechanical", // Mechanical
    "electromechanical", // Electromechanical
    "piezoelectric", // Piezoelectric
    "thermoelectric", // Thermoelectric
    "photovoltaic", // Photovoltaic
    "thermophotovoltaic", // Thermophotovoltaic
    "radioisotope", // Radioisotope
    "fusion", // Fusion
    "fission", // Fission
    "antimatter", // Antimatter
    "zero-point", // Zero-point
    "vacuum", // Vacuum
    "dark-energy", // Dark energy
    "dark-matter", // Dark matter
    "exotic-matter", // Exotic matter
    "negative-mass", // Negative mass
    "tachyons", // Tachyons
    "wormholes", // Wormholes
    "warp-drive", // Warp drive
    "hyperspace", // Hyperspace
    "subspace", // Subspace
    "branes", // Branes
    "strings", // Strings
    "loops", // Loops
    "spin-networks", // Spin networks
    "twistors", // Twistors
    "causal-sets", // Causal sets
    "event-symmetric", // Event-symmetric
    "pregeometry", // Pregeometry
    "quantum-foam", // Quantum foam
    "spacetime-foam", // Spacetime foam
    "holographic", // Holographic
    "ads-cft", // AdS/CFT
    "gauge-gravity", // Gauge/gravity
    "matrix-theory", // Matrix theory
    "m-theory", // M-theory
    "f-theory", // F-theory
    "s-theory", // S-theory
    "e8-theory", // E8 theory
    "exceptional", // Exceptional
    "octonionic", // Octonionic
    "quaternionic", // Quaternionic
    "complex", // Complex
    "real", // Real
    "p-adic", // p-adic
    "adelic", // Adelic
    "non-archimedean", // Non-Archimedean
    "tropical", // Tropical
    "idempotent", // Idempotent
    "semiring", // Semiring
    "semifield", // Semifield
    "hyperfield", // Hyperfield
    "fuzzy", // Fuzzy
    "rough", // Rough
    "soft", // Soft
    "vague", // Vague
    "uncertain", // Uncertain
    "imprecise", // Imprecise
    "inexact", // Inexact
    "approximate", // Approximate
    "heuristic", // Heuristic
    "metaheuristic", // Metaheuristic
    "hyperheuristic", // Hyperheuristic
    "superheuristic", // Superheuristic
    "ultraheuristic", // Ultraheuristic
    "quasiheuristic", // Quasiheuristic
    "semiheuristic", // Semiheuristic
    "pseudoheuristic", // Pseudoheuristic
    "cryptheuristic", // Cryptheuristic
    "neuroheuristic", // Neuroheuristic
    "evoheuristic", // Evoheuristic
    "swarmheuristic", // Swarmheuristic
    "immuneheuristic", // Immuneheuristic
    "memetic", // Memetic
    "genetic", // Genetic
    "evolutionary", // Evolutionary
    "darwinian", // Darwinian
    "lamarckian", // Lamarckian
    "baldwinian", // Baldwinian
    "mendelian", // Mendelian
    "epigenetic", // Epigenetic
    "transgenerational", // Transgenerational
    "horizontal-transfer", // Horizontal transfer
    "vertical-transfer", // Vertical transfer
    "diagonal-transfer", // Diagonal transfer
    "reticulate", // Reticulate
    "anastomosing", // Anastomosing
    "rhizomatic", // Rhizomatic
    "arborescent", // Arborescent
    "dendritic", // Dendritic
    "fractal", // Fractal
    "self-similar", // Self-similar
    "scale-invariant", // Scale-invariant
    "scale-free", // Scale-free
    "power-law", // Power-law
    "log-normal", // Log-normal
    "pareto", // Pareto
    "zipf", // Zipf
    "benford", // Benford
    "lotka", // Lotka
    "bradford", // Bradford
    "yule", // Yule
    "simon", // Simon
    "price", // Price
    "matthews", // Matthews
    "heap", // Heap
    "hirsch", // Hirsch
    "gini", // Gini
    "lorenz", // Lorenz
    "champernowne", // Champernowne
    "cantelli", // Cantelli
    "chebyshev", // Chebyshev
    "markov", // Markov
    "bernstein", // Bernstein
    "kolmogorov", // Kolmogorov
    "smirnov", // Smirnov
    "shapiro", // Shapiro
    "wilk", // Wilk
    "anderson", // Anderson
    "darling", // Darling
    "cramer", // Cramer
    "von-mises", // von Mises
    "lilliefors", // Lilliefors
    "dagostino", // D'Agostino
    "pearson", // Pearson
    "hartley", // Hartley
    "bartlett", // Bartlett
    "levene", // Levene
    "brown-forsythe", // Brown-Forsythe
    "fligner-killeen", // Fligner-Killeen
    "kruskal", // Kruskal
    "wallis", // Wallis
    "friedman", // Friedman
    "mann-whitney", // Mann-Whitney
    "wilcoxon", // Wilcoxon
    "kruskal-wallis", // Kruskal-Wallis
    "jonckheere-terpstra", // Jonckheere-Terpstra
    "page", // Page
    "spearman", // Spearman
    "kendall", // Kendall
    "goodman-kruskal", // Goodman-Kruskal
    "somers", // Somers
    "gamma", // Gamma
    "tau", // Tau
    "rho", // Rho
    "phi", // Phi
    "cramers-v", // Cramer's V
    "contingency", // Contingency
    "cohen", // Cohen
    "kappa", // Kappa
    "fleiss", // Fleiss
    "scott", // Scott
    "krippendorff", // Krippendorff
    "holsti", // Holsti
    "bennett", // Bennett
    "alpert", // Alpert
    "robinson", // Robinson
    "agreement", // Agreement
    "reliability", // Reliability
    "validity", // Validity
    "generalizability", // Generalizability
    "transferability", // Transferability
    "dependability", // Dependability
    "confirmability", // Confirmability
    "credibility", // Credibility
    "authenticity", // Authenticity
    "triangulation", // Triangulation
    "member-checking", // Member checking
    "peer-debriefing", // Peer debriefing
    "negative-case-analysis", // Negative case analysis
    "audit-trail", // Audit trail
    "thick-description", // Thick description
    "prolonged-engagement", // Prolonged engagement
    "persistent-observation", // Persistent observation
    "reflexivity", // Reflexivity
    "positionality", // Positionality
    "standpoint", // Standpoint
    "epistemology", // Epistemology
    "ontology", // Ontology
    "axiology", // Axiology
    "methodology", // Methodology
    "heuristics", // Heuristics
    "hermeneutics", // Hermeneutics
    "phenomenology", // Phenomenology
    "ethnography", // Ethnography
    "case-study", // Case study
    "grounded-theory", // Grounded theory
    "action-research", // Action research
    "participatory", // Participatory
    "appreciative", // Appreciative
    "transformative", // Transformative
    "emancipatory", // Emancipatory
    "critical", // Critical
    "feminist", // Feminist
    "queer", // Queer
    "disability", // Disability
    "indigenous", // Indigenous
    "decolonial", // Decolonial
    "postcolonial", // Postcolonial
    "postmodern", // Postmodern
    "poststructural", // Poststructural
    "constructivist", // Constructivist
    "interpretivist", // Interpretivist
    "positivist", // Positivist
    "empiricist", // Empiricist
    "rationalist", // Rationalist
    "realist", // Realist
    "materialist", // Materialist
    "idealist", // Idealist
    "pragmatist", // Pragmatist
    "utilitarian", // Utilitarian
    "deontological", // Deontological
    "virtue-ethics", // Virtue ethics
    "care-ethics", // Care ethics
    "bioethics", // Bioethics
    "research-ethics", // Research ethics
    "publication-ethics", // Publication ethics
    "data-ethics", // Data ethics
    "ai-ethics", // AI ethics
    "tech-ethics", // Tech ethics
    "computer-ethics", // Computer ethics
    "information-ethics", // Information ethics
    "internet-ethics", // Internet ethics
    "cyberethics", // Cyberethics
    "roboethics", // Roboethics
    "machine-ethics", // Machine ethics
    "algorithmic-ethics", // Algorithmic ethics
    "data-ethics", // Data ethics
    "privacy-ethics", // Privacy ethics
    "security-ethics", // Security ethics
    "surveillance-ethics", // Surveillance ethics
    "intellectual-property", // Intellectual property
    "copyright", // Copyright
    "patent", // Patent
    "trademark", // Trademark
    "trade-secret", // Trade secret
    "licensing", // Licensing
    "open-source", // Open source
    "free-software", // Free software
    "copyleft", // Copyleft
    "creative-commons", // Creative Commons
    "public-domain", // Public domain
    "fair-use", // Fair use
    "fair-dealing", // Fair dealing
    "transformative-use", // Transformative use
    "derivative-works", // Derivative works
    "collective-works", // Collective works
    "compilation", // Compilation
    "database-rights", // Database rights
    "sui-generis", // Sui generis
    "moral-rights", // Moral rights
    "economic-rights", // Economic rights
    "neighboring-rights", // Neighboring rights
    "related-rights", // Related rights
    "ancillary-rights", // Ancillary rights
    "enforcement", // Enforcement
    "remedies", // Remedies
    "damages", // Damages
    "injunctions", // Injunctions
    "accounting", // Accounting
    "attorney-fees", // Attorney fees
    "costs", // Costs
    "sanctions", // Sanctions
    "contempt", // Contempt
    "seizure", // Seizure
    "forfeiture", // Forfeiture
    "destruction", // Destruction
    "takedown", // Takedown
    "notice-and-takedown", // Notice and takedown
    "safe-harbor", // Safe harbor
    "dmca", // DMCA
    "copyright-directive", // Copyright directive
    "info-soc", // InfoSoc
    "enforcement-directive", // Enforcement directive
    "trade-secrets-directive", // Trade secrets directive
    "gdpr", // GDPR
    "ccpa", // CCPA
    "pipeda", // PIPEDA
    "lgpd", // LGPD
    "pdpa", // PDPA
    "apo", // APO
    "privacy-act", // Privacy Act
    "foia", // FOIA
    "transparency", // Transparency
    "accountability", // Accountability
    "explainability", // Explainability
    "interpretability", // Interpretability
    "auditability", // Auditability
    "verifiability", // Verifiability
    "provability", // Provability
    "testability", // Testability
    "reproducibility", // Reproducibility
    "replicability", // Replicability
    "robustness", // Robustness
    "resilience", // Resilience
    "fault-tolerance", // Fault tolerance
    "graceful-degradation", // Graceful degradation
    "fail-safe", // Fail-safe
    "fail-soft", // Fail-soft
    "fail-over", // Fail-over
    "load-balancing", // Load balancing
    "caching", // Caching
    "cdn", // CDN
    "edge-computing", // Edge computing
    "fog-computing", // Fog computing
    "mist-computing", // Mist computing
    "cloud-computing", // Cloud computing
    "grid-computing", // Grid computing
    "cluster-computing", // Cluster computing
    "distributed-computing", // Distributed computing
    "parallel-computing", // Parallel computing
    "high-performance-computing", // High-performance computing
    "quantum-computing", // Quantum computing
    "neuromorphic-computing", // Neuromorphic computing
    "dna-computing", // DNA computing
    "optical-computing", // Optical computing
    "molecular-computing", // Molecular computing
    "chemical-computing", // Chemical computing
    "biological-computing", // Biological computing
    "wetware", // Wetware
    "liveware", // Liveware
    "software", // Software
    "hardware", // Hardware
    "firmware", // Firmware
    "middleware", // Middleware
    "software-defined", // Software-defined
    "hardware-assisted", // Hardware-assisted
    "accelerated", // Accelerated
    "optimized", // Optimized
    "tuned", // Tuned
    "profiled", // Profiled
    "benchmarked", // Benchmarked
    "measured", // Measured
    "evaluated", // Evaluated
    "assessed", // Assessed
    "audited", // Audited
    "certified", // Certified
    "accredited", // Accredited
    "validated", // Validated
    "verified", // Verified
    "tested", // Tested
    "proven", // Proven
    "guaranteed", // Guaranteed
    "warrantied", // Warrantied
    "insured", // Insured
    "bonded", // Bonded
    "licensed", // Licensed
    "registered", // Registered
    "approved", // Approved
    "authorized", // Authorized
    "endorsed", // Endorsed
    "recommended", // Recommended
    "adopted", // Adopted
    "implemented", // Implemented
    "deployed", // Deployed
    "operational", // Operational
    "production", // Production
    "live", // Live
    "active", // Active
    "running", // Running
    "executing", // Executing
    "processing", // Processing
    "computing", // Computing
    "calculating", // Calculating
    "simulating", // Simulating
    "modeling", // Modeling
    "analyzing", // Analyzing
    "predicting", // Predicting
    "forecasting", // Forecasting
    "projecting", // Projecting
    "estimating", // Estimating
    "approximating", // Approximating
    "interpolating", // Interpolating
    "extrapolating", // Extrapolating
    "generalizing", // Generalizing
    "specializing", // Specializing
    "abstracting", // Abstracting
    "concretizing", // Concretizing
    "instantiating", // Instantiating
    "materializing", // Materializing
    "realizing", // Realizing
    "actualizing", // Actualizing
    "manifesting", // Manifesting
    "embodying", // Embodying
    "incarnating", // Incarnating
    "reifying", // Reifying
    "hypostatizing", // Hypostatizing
    "objectifying", // Objectifying
    "subjectifying", // Subjectifying
    "personifying", // Personifying
    "anthropomorphizing", // Anthropomorphizing
    "zoomorphizing", // Zoomorphizing
    "biomorphizing", // Biomorphizing
    "geomorphizing", // Geomorphizing
    "morphing", // Morphing
    "transforming", // Transforming
    "transmuting", // Transmuting
    "transfiguring", // Transfiguring
    "metamorphosing", // Metamorphosing
    "evolving", // Evolving
    "devolving", // Devolving
    "involving", // Involving
    "revolving", // Revolving
    "cycling", // Cycling
    "iterating", // Iterating
    "recursing", // Recursing
    "looping", // Looping
    "repeating", // Repeating
    "replicating", // Replicating
    "duplicating", // Duplicating
    "copying", // Copying
    "cloning", // Cloning
    "forking", // Forking
    "branching", // Branching
    "merging", // Merging
    "integrating", // Integrating
    "consolidating", // Consolidating
    "unifying", // Unifying
    "synthesizing", // Synthesizing
    "combining", // Combining
    "composing", // Composing
    "assembling", // Assembling
    "constructing", // Constructing
    "building", // Building
    "creating", // Creating
    "making", // Making
    "generating", // Generating
    "producing", // Producing
    "manufacturing", // Manufacturing
    "fabricating", // Fabricating
    "synthesizing", // Synthesizing
    "cooking", // Cooking
    "baking", // Baking
    "brewing", // Brewing
    "fermenting", // Fermenting
    "distilling", // Distilling
    "extracting", // Extracting
    "refining", // Refining
    "purifying", // Purifying
    "filtering", // Filtering
    "screening", // Screening
    "sieving", // Sieving
    "sifting", // Sifting
    "sorting", // Sorting
    "classifying", // Classifying
    "categorizing", // Categorizing
    "organizing", // Organizing
    "arranging", // Arranging
    "ordering", // Ordering
    "structuring", // Structuring
    "systematizing", // Systematizing
    "methodizing", // Methodizing
    "formalizing", // Formalizing
    "standardizing", // Standardizing
    "normalizing", // Normalizing
    "canonicalizing", // Canonicalizing
    "regularizing", // Regularizing
    "rationalizing", // Rationalizing
    "streamlining", // Streamlining
    "optimizing", // Optimizing
    "improving", // Improving
    "enhancing", // Enhancing
    "augmenting", // Augmenting
    "boosting", // Boosting
    "elevating", // Elevating
    "upgrading", // Upgrading
    "updating", // Updating
    "modernizing", // Modernizing
    "refurbishing", // Refurbishing
    "renovating", // Renovating
    "renewing", // Renewing
    "restoring", // Restoring
    "repairing", // Repairing
    "fixing", // Fixing
    "correcting", // Correcting
    "rectifying", // Rectifying
    "remedying", // Remedying
    "healing", // Healing
    "curing", // Curing
    "treating", // Treating
    "therapizing", // Therapizing
    "rehabilitating", // Rehabilitating
    "recovering", // Recovering
    "reclaiming", // Reclaiming
    "redeeming", // Redeeming
    "salvaging", // Salvaging
    "rescuing", // Rescuing
    "saving", // Saving
    "preserving", // Preserving
    "conserving", // Conserving
    "protecting", // Protecting
    "guarding", // Guarding
    "shielding", // Shielding
    "defending", // Defending
    "securing", // Securing
    "safetying", // Safetying
    "hardening", // Hardening
    "fortifying", // Fortifying
    "strengthening", // Strengthening
    "reinforcing", // Reinforcing
    "supporting", // Supporting
    "bracing", // Bracing
    "buttressing", // Buttressing
    "shoring", // Shoring
    "underpinning", // Underpinning
    "founding", // Founding
    "grounding", // Grounding
    "basing", // Basing
    "rooting", // Rooting
    "anchoring", // Anchoring
    "mooring", // Mooring
    "docking", // Docking
    "berthing", // Berthing
    "parking", // Parking
    "stationing", // Stationing
    "positioning", // Positioning
    "placing", // Placing
    "locating", // Locating
    "situating", // Situating
    "contextualizing", // Contextualizing
    "embedding", // Embedding
    "nesting", // Nesting
    "layering", // Layering
    "stacking", // Stacking
    "piling", // Piling
    "heaping", // Heaping
    "mounting", // Mounting
    "rising", // Rising
    "ascending", // Ascending
    "climbing", // Climbing
    "scaling", // Scaling
    "soaring", // Soaring
    "flying", // Flying
    "floating", // Floating
    "drifting", // Drifting
    "sailing", // Sailing
    "cruising", // Cruising
    "voyaging", // Voyaging
    "journeying", // Journeying
    "traveling", // Traveling
    "moving", // Moving
    "going", // Going
    "coming", // Coming
    "arriving", // Arriving
    "reaching", // Reaching
    "attaining", // Attaining
    "achieving", // Achieving
    "accomplishing", // Accomplishing
    "completing", // Completing
    "finishing", // Finishing
    "ending", // Ending
    "terminating", // Terminating
    "concluding", // Concluding
    "closing", // Closing
    "shutting", // Shutting
    "opening", // Opening
    "starting", // Starting
    "beginning", // Beginning
    "initiating", // Initiating
    "launching", // Launching
    "commencing", // Commencing
    "originating", // Originating
    "deriving", // Deriving
    "stemming", // Stemming
    "arising", // Arising
    "emerging", // Emerging
    "appearing", // Appearing
    "materializing", // Materializing
    "manifesting", // Manifesting
    "showing", // Showing
    "displaying", // Displaying
    "exhibiting", // Exhibiting
    "presenting", // Presenting
    "demonstrating", // Demonstrating
    "proving", // Proving
    "verifying", // Verifying
    "confirming", // Confirming
    "validating", // Validating
    "authenticating", // Authenticating
    "authorizing", // Authorizing
    "certifying", // Certifying
    "accrediting", // Accrediting
    "licensing", // Licensing
    "registering", // Registering
    "recording", // Recording
    "documenting", // Documenting
    "logging", // Logging
    "tracing", // Tracing
    "tracking", // Tracking
    "monitoring", // Monitoring
    "watching", // Watching
    "observing", // Observing
    "witnessing", // Witnessing
    "seeing", // Seeing
    "viewing", // Viewing
    "looking", // Looking
    "gazing", // Gazing
    "staring", // Staring
    "glaring", // Glaring
    "peering", // Peering
    "peeking", // Peeking
    "peeping", // Peeping
    "glancing", // Glancing
    "scanning", // Scanning
    "surveying", // Surveying
    "inspecting", // Inspecting
    "examining", // Examining
    "investigating", // Investigating
    "exploring", // Exploring
    "probing", // Probing
    "sounding", // Sounding
    "delving", // Delving
    "diving", // Diving
    "plunging", // Plunging
    "submerging", // Submerging
    "immersing", // Immersing
    "engaging", // Engaging
    "involving", // Involving
    "participating", // Participating
    "joining", // Joining
    "entering", // Entering
    "accessing", // Accessing
    "approaching", // Approaching
    "nearing", // Nearing
    "closing", // Closing
    "converging", // Converging
    "focusing", // Focusing
    "centering", // Centering
    "concentrating", // Concentrating
    "condensing", // Condensing
    "compressing", // Compressing
    "compactifying", // Compactifying
    "simplifying", // Simplifying
    "reducing", // Reducing
    "decreasing", // Decreasing
    "diminishing", // Diminishing
    "lessening", // Lessening
    "lowering", // Lowering
    "dropping", // Dropping
    "falling", // Falling
    "declining", // Declining
    "descending", // Descending
    "sinking", // Sinking
    "subsiding", // Subsiding
    "waning", // Waning
    "ebbing", // Ebbing
    "receding", // Receding
    "retreating", // Retreating
    "withdrawing", // Withdrawing
    "pulling-back", // Pulling back
    "backing-off", // Backing off
    "pausing", // Pausing
    "halting", // Halting
    "stopping", // Stopping
    "ceasing", // Ceasing
    "desisting", // Desisting
    "refraining", // Refraining
    "abstaining", // Abstaining
    "forbearing", // Forbearing
    "waiting", // Waiting
    "delaying", // Delaying
    "postponing", // Postponing
    "deferring", // Deferring
    "suspending", // Suspending
    "holding", // Holding
    "keeping", // Keeping
    "maintaining", // Maintaining
    "sustaining", // Sustaining
    "continuing", // Continuing
    "persisting", // Persisting
    "persevering", // Persevering
    "enduring", // Enduring
    "lasting", // Lasting
    "remaining", // Remaining
    "staying", // Staying
    "abiding", // Abiding
    "dwelling", // Dwelling
    "residing", // Residing
    "living", // Living
    "existing", // Existing
    "being", // Being
    "becoming", // Becoming
    "happening", // Happening
    "occurring", // Occurring
    "taking-place", // Taking place
    "transpiring", // Transpiring
    "ensuing", // Ensuing
    "resulting", // Resulting
    "following", // Following
    "succeeding", // Succeeding
    "proceeding", // Proceeding
    "progressing", // Progressing
    "advancing", // Advancing
    "moving-forward", // Moving forward
    "going-on", // Going on
    "carrying-on", // Carrying on
    "getting-on", // Getting on
    "pushing-on", // Pushing on
    "pressing-on", // Pressing on
    "driving-on", // Driving on
    "plowing-on", // Plowing on
    "soldiering-on", // Soldiering on
    "keeping-on", // Keeping on
    "holding-on", // Holding on
    "hanging-on", // Hanging on
    "clinging-on", // Clinging on
    "grasping", // Grasping
    "gripping", // Gripping
    "clutching", // Clutching
    "clasping", // Clasping
    "seizing", // Seizing
    "capturing", // Capturing
    "catching", // Catching
    "grabbing", // Grabbing
    "snatching", // Snatching
    "taking", // Taking
    "getting", // Getting
    "obtaining", // Obtaining
    "acquiring", // Acquiring
    "gaining", // Gaining
    "earning", // Earning
    "winning", // Winning
    "securing", // Securing
    "procuring", // Procuring
    "procuring", // Procuring
    "attaining", // Attaining
    "achieving", // Achieving
    "realizing", // Realizing
    "fulfilling", // Fulfilling
    "satisfying", // Satisfying
    "meeting", // Meeting
    "fulfilling", // Fulfilling
    "completing", // Completing
    "accomplishing", // Accomplishing
    "executing", // Executing
    "implementing", // Implementing
    "performing", // Performing
    "doing", // Doing
    "acting", // Acting
    "behaving", // Behaving
    "conducting", // Conducting
    "carrying-out", // Carrying out
    "bringing-about", // Bringing about
    "effecting", // Effecting
    "causing", // Causing
    "inducing", // Inducing
    "producing", // Producing
    "generating", // Generating
    "creating", // Creating
    "making", // Making
    "forming", // Forming
    "shaping", // Shaping
    "molding", // Molding
    "casting", // Casting
    "forging", // Forging
    "fabricating", // Fabricating
    "manufacturing", // Manufacturing
    "constructing", // Constructing
    "building", // Building
    "erecting", // Erecting
    "raising", // Raising
    "elevating", // Elevating
    "lifting", // Lifting
    "hoisting", // Hoisting
    "heaving", // Heaving
    "hauling", // Hauling
    "towing", // Towing
    "dragging", // Dragging
    "pulling", // Pulling
    "drawing", // Drawing
    "tugging", // Tugging
    "yanking", // Yanking
    "jerking", // Jerking
    "plucking", // Plucking
    "picking", // Picking
    "harvesting", // Harvesting
    "gathering", // Gathering
    "collecting", // Collecting
    "assembling", // Assembling
    "aggregating", // Aggregating
    "accumulating", // Accumulating
    "amassing", // Amassing
    "compiling", // Compiling
    "collating", // Collating
    "organizing", // Organizing
    "arranging", // Arranging
    "systematizing", // Systematizing
    "ordering", // Ordering
    "structuring", // Structuring
    "configuring", // Configuring
    "setting-up", // Setting up
    "preparing", // Preparing
    "readying", // Readying
    "conditioning", // Conditioning
    "priming", // Priming
    "warming-up", // Warming up
    "cooling-down", // Cooling down
    "calibrating", // Calibrating
    "standardizing", // Standardizing
    "normalizing", // Normalizing
    "adjusting", // Adjusting
    "adapting", // Adapting
    "modifying", // Modifying
    "altering", // Altering
    "changing", // Changing
    "varying", // Varying
    "shifting", // Shifting
    "switching", // Switching
    "swapping", // Swapping
    "exchanging", // Exchanging
    "trading", // Trading
    "bartering", // Bartering
    "substituting", // Substituting
    "replacing", // Replacing
    "superseding", // Superseding
    "supplanting", // Supplanting
    "displacing", // Displacing
    "ousting", // Ousting
    "ejecting", // Ejecting
    "expelling", // Expelling
    "evicting", // Evicting
    "removing", // Removing
    "eliminating", // Eliminating
    "eradicating", // Eradicating
    "exterminating", // Exterminating
    "annihilating", // Annihilating
    "obliterating", // Obliterating
    "destroying", // Destroying
    "demolishing", // Demolishing
    "ruining", // Ruining
    "wrecking", // Wrecking
    "damaging", // Damaging
    "harming", // Harming
    "hurting", // Hurting
    "injuring", // Injuring
    "wounding", // Wounding
    "maiming", // Maiming
    "mutilating", // Mutilating
    "disfiguring", // Disfiguring
    "scarring", // Scarring
    "bruising", // Bruising
    "cutting", // Cutting
    "slashing", // Slashing
    "gashing", // Gashing
    "lacerating", // Lacerating
    "piercing", // Piercing
    "penetrating", // Penetrating
    "puncturing", // Puncturing
    "perforating", // Perforating
    "boring", // Boring
    "drilling", // Drilling
    "tunneling", // Tunneling
    "burrowing", // Burrowing
    "digging", // Digging
    "excavating", // Excavating
    "mining", // Mining
    "quarrying", // Quarrying
    "extracting", // Extracting
    "harvesting", // Harvesting
    "exploiting", // Exploiting
    "utilizing", // Utilizing
    "using", // Using
    "employing", // Employing
    "applying", // Applying
    "practicing", // Practicing
    "exercising", // Exercising
    "implementing", // Implementing
    "enforcing", // Enforcing
    "administering", // Administering
    "managing", // Managing
    "handling", // Handling
    "operating", // Operating
    "running", // Running
    "working", // Working
    "functioning", // Functioning
    "operating", // Operating
    "performing", // Performing
    "serving", // Serving
    "acting", // Acting
    "behaving", // Behaving
    "reacting", // Reacting
    "responding", // Responding
    "replying", // Replying
    "answering", // Answering
    "acknowledging", // Acknowledging
    "recognizing", // Recognizing
    "identifying", // Identifying
    "knowing", // Knowing
    "understanding", // Understanding
    "comprehending", // Comprehending
    "grasping", // Grasping
    "apprehending", // Apprehending
    "perceiving", // Perceiving
    "discerning", // Discerning
    "distinguishing", // Distinguishing
    "differentiating", // Differentiating
    "discriminating", // Discriminating
    "separating", // Separating
    "dividing", // Dividing
    "splitting", // Splitting
    "cleaving", // Cleaving
    "parting", // Parting
    "breaking", // Breaking
    "fracturing", // Fracturing
    "fragmenting", // Fragmenting
    "shattering", // Shattering
    "smashing", // Smashing
    "crushing", // Crushing
    "grinding", // Grinding
    "crumbling", // Crumbling
    "disintegrating", // Disintegrating
    "decomposing", // Decomposing
    "decaying", // Decaying
    "rotting", // Rotting
    "corrupting", // Corrupting
    "spoiling", // Spoiling
    "tainting", // Tainting
    "contaminating", // Contaminating
    "polluting", // Polluting
    "defiling", // Defiling
    "profaning", // Profaning
    "desecrating", // Desecrating
    "blaspheming", // Blaspheming
    "sinning", // Sinning
    "transgressing", // Transgressing
    "trespassing", // Trespassing
    "offending", // Offending
    "violating", // Violating
    "infringing", // Infringing
    "breaching", // Breaching
    "contravening", // Contravening
    "defying", // Defying
    "flouting", // Flouting
    "disobeying", // Disobeying
    "ignoring", // Ignoring
    "neglecting", // Neglecting
    "overlooking", // Overlooking
    "disregarding", // Disregarding
    "bypassing", // Bypassing
    "circumventing", // Circumventing
    "skirting", // Skirting
    "avoiding", // Avoiding
    "evading", // Evading
    "dodging", // Dodging
    "ducking", // Ducking
    "sidestepping", // Sidestepping
    "shirking", // Shirking
    "shunning", // Shunning
    "eschewing", // Eschewing
    "forgoing", // Forgoing
    "waiving", // Waiving
    "relinquishing", // Relinquishing
    "renouncing", // Renouncing
    "abjuring", // Abjuring
    "repudiating", // Repudiating
    "disowning", // Disowning
    "disclaiming", // Disclaiming
    "denying", // Denying
    "contradicting", // Contradicting
    "refuting", // Refuting
    "rebutting", // Rebutting
    "disproving", // Disproving
    "debunking", // Debunking
    "exposing", // Exposing
    "revealing", // Revealing
    "unveiling", // Unveiling
    "uncovering", // Uncovering
    "discovering", // Discovering
    "finding", // Finding
    "detecting", // Detecting
    "sensing", // Sensing
    "feeling", // Feeling
    "touching", // Touching
    "tasting", // Tasting
    "smelling", // Smelling
    "hearing", // Hearing
    "listening", // Listening
    "sounding", // Sounding
    "ringing", // Ringing
    "resounding", // Resounding
    "echoing", // Echoing
    "reverberating", // Reverberating
    "vibrating", // Vibrating
    "oscillating", // Oscillating
    "pulsating", // Pulsating
    "throbbing", // Throbbing
    "beating", // Beating
    "pounding", // Pounding
    "knocking", // Knocking
    "tapping", // Tapping
    "rapping", // Rapping
    "patting", // Patting
    "slapping", // Slapping
    "hitting", // Hitting
    "striking", // Striking
    "smacking", // Smacking
    "whacking", // Whacking
    "thwacking", // Thwacking
    "thumping", // Thumping
    "bumping", // Bumping
    "clumping", // Clumping
    "stomping", // Stomping
    "tramping", // Tramping
    "tromping", // Tromping
    "marching", // Marching
    "parading", // Parading
    "processing", // Processing
    "progressing", // Progressing
    "proceeding", // Proceeding
    "advancing", // Advancing
    "continuing", // Continuing
  ];

  const truncateLimit = options.truncateLimit || 500000;

  globalThis.fetch = async (input: any, init?: any): Promise<any> => {
    const url = typeof input === "string" ? input : input.toString();

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (_e) {
      // Not a full URL, might be a relative URL
      return originalFetch(input, init);
    }

    const host = parsedUrl.host;
    const isLlmApi = llmHosts.some((h) => host.includes(h));
    if (!isLlmApi) {
      return originalFetch(input, init);
    }

    const startTime = Date.now();

    // Build complete request log
    const requestHeaders = sanitizeHeaders(init?.headers);

    const requestLog: LlmRequestLog = {
      method: init?.method || "GET",
      url: url,
      protocol: parsedUrl.protocol,
      host: parsedUrl.host,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      headers: requestHeaders,
      body: init?.body ? truncateBody(String(init.body), truncateLimit) : undefined,
      timestamp: new Date().toISOString(),
    };

    const requestLogEntry = {
      type: "request" as const,
      content: JSON.stringify(requestLog, null, 2),
    };

    logManager.log(requestLogEntry);
    logger.info(`LLM Request: ${init?.method || "GET"} ${url}`);

    try {
      const response = await originalFetch(input, init);
      const duration = Date.now() - startTime;

      // Clone response to read body without consuming original
      const clonedResponse = response.clone();

      // Read response body (may be streaming)
      let responseBody: string | undefined;
      let bodyNote: string | undefined;

      const contentType = response.headers.get("content-type") || "";
      const isStreaming =
        contentType.includes("text/event-stream") ||
        contentType.includes("stream") ||
        response.headers.get("transfer-encoding") === "chunked";

      if (isStreaming) {
        bodyNote = "[Streaming response - body not captured]";
      } else {
        try {
          const bodyText = await clonedResponse.text();
          responseBody = truncateBody(bodyText, truncateLimit);
        } catch {
          bodyNote = "[Failed to read response body]";
        }
      }

      // Build complete response log
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseLog: LlmResponseLog = {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: responseHeaders,
        body: responseBody,
        bodyNote,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      };

      const responseLogEntry = {
        type: "response" as const,
        content: JSON.stringify(responseLog, null, 2),
      };

      logManager.log(responseLogEntry);
      logger.info(`LLM Response: ${response.status} ${response.statusText} took ${duration}ms`);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorLogEntry = {
        type: "response" as const,
        content: JSON.stringify(
          {
            error: error instanceof Error ? error.message : "Unknown error",
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        ),
      };

      logManager.log(errorLogEntry);
      logger.error(
        `LLM Error: ${error instanceof Error ? error.message : "Unknown"}`,
        {},
        error instanceof Error ? error : undefined
      );

      throw error;
    }
  };

  logger.info("Global fetch interceptor set");
}

/**
 * Setup HTTP/HTTPS interceptor (fallback for legacy SDKs)
 */
export function setupHttpInterceptor(
  logManager: LlmLogManager,
  options: LlmInterceptorOptions = {}
): void {
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const logger = new Logger({ level: LogLevel.INFO });
  const truncateLimit = options.truncateLimit || 500000;

  function interceptRequest(
    protocol: string,
    originalRequest: typeof http.request,
    options: any,
    callback?: any
  ): any {
    const startTime = Date.now();
    const host =
      typeof options === "string" ? new URL(options).host : options.hostname || options.host;
    const path = typeof options === "string" ? new URL(options).pathname : options.path || "/";

    // Only intercept LLM API calls
    const isLlmApi =
      host?.includes("anthropic.com") ||
      host?.includes("openai.com") ||
      host?.includes("googleapis.com") ||
      host?.includes("amazonaws.com") ||
      host?.includes("moonshot.cn") ||
      host?.includes("kimi.com") ||
      host?.includes("mistral.ai") ||
      host?.includes("groq.com");

    if (!isLlmApi) {
      return originalRequest(options, callback);
    }

    const requestLog: LlmRequestLog = {
      method: options.method || "GET",
      url: `${protocol}//${host}${path}`,
      protocol: `${protocol}:`,
      host: host || "",
      pathname: path,
      search: "",
      headers: sanitizeHeaders(options.headers),
      timestamp: new Date().toISOString(),
    };

    const requestLogEntry = {
      type: "request" as const,
      content: JSON.stringify(requestLog, null, 2),
    };

    logManager.log(requestLogEntry);
    logger.info(`LLM HTTP Request: ${options.method || "GET"} ${protocol}//${host}${path}`);

    const request = originalRequest(options, (response: any) => {
      const responseData: Buffer[] = [];
      const originalOnData = response.on;
      const originalOnEnd = response.on;

      response.on = function (event: string, listener: Function) {
        if (event === "data") {
          return originalOnData.call(this, event, (chunk: Buffer) => {
            responseData.push(chunk);
            listener(chunk);
          });
        }
        if (event === "end") {
          return originalOnEnd.call(this, event, () => {
            const duration = Date.now() - startTime;
            const body = Buffer.concat(responseData).toString("utf-8");

            const responseLog: LlmResponseLog = {
              status: response.statusCode || 0,
              statusText: response.statusMessage || "",
              url: `${protocol}//${host}${path}`,
              headers: sanitizeHeaders(response.headers),
              body: truncateBody(body, truncateLimit),
              duration: `${duration}ms`,
              timestamp: new Date().toISOString(),
            };

            const responseLogEntry = {
              type: "response" as const,
              content: JSON.stringify(responseLog, null, 2),
            };

            logManager.log(responseLogEntry);
            logger.info(`LLM HTTP Response: ${response.statusCode} took ${duration}ms`);

            listener();
          });
        }
        return originalOnData.call(this, event, listener);
      };

      return response;
    });

    // Intercept request body write
    const originalWrite = request.write;
    const originalEnd = request.end;
    let requestBody = "";

    request.write = function (chunk: any, encoding?: any, callback?: any) {
      if (chunk) {
        requestBody += chunk.toString(encoding || "utf8");
      }
      return originalWrite.call(this, chunk, encoding, callback);
    };

    request.end = function (chunk?: any, encoding?: any, callback?: any) {
      if (chunk) {
        requestBody += chunk.toString(encoding || "utf8");
      }

      // Update request log with body
      if (requestBody) {
        const updatedLogEntry = {
          type: "request" as const,
          content: JSON.stringify(
            {
              ...requestLog,
              body: truncateBody(requestBody, truncateLimit),
            },
            null,
            2
          ),
        };

        logManager.log(updatedLogEntry);
      }

      return originalEnd.call(this, chunk, encoding, callback);
    };

    return request;
  }

  // Intercept HTTP and HTTPS requests
  (http as any).request = (options: any, callback?: any) =>
    interceptRequest("http", originalHttpRequest, options, callback);

  (https as any).request = (options: any, callback?: any) =>
    interceptRequest("https", originalHttpsRequest, options, callback);

  logger.info("HTTP/HTTPS interceptor set");
}

/**
 * Setup all LLM interceptors
 */
export function setupLlmInterceptors(
  logManager: LlmLogManager,
  options: LlmInterceptorOptions = {}
): void {
  // First setup fetch interceptor (must be before importing SDK)
  setupGlobalFetchInterceptor(logManager, options);

  // Then setup HTTP/HTTPS interceptor (for legacy SDKs)
  if (options.setupHttpInterceptor !== false) {
    setupHttpInterceptor(logManager, options);
  }
}
