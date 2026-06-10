import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";
import * as path from "path";

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── VPC (public-only, no NAT Gateway — POC/demo) ─────────────────────────
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    // ── ECR Repository ───────────────────────────────────────────────────────
    const repo = new ecr.Repository(this, "BackendRepo", {
      repositoryName: "realestate-ai-backend",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // ── Secrets (API keys) ───────────────────────────────────────────────────
    const apiSecrets = new secretsmanager.Secret(this, "ApiKeys", {
      secretName: "realestate-ai/api-keys",
      description: "LLM and search API keys for realestate-ai-agent",
    });

    // ── ECS Cluster ──────────────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    // ── ALB ──────────────────────────────────────────────────────────────────
    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // ── Fargate Task Definition ──────────────────────────────────────────────
    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 1024,
      memoryLimitMiB: 2048,
    });

    taskDef.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [apiSecrets.secretArn],
      })
    );

    const container = taskDef.addContainer("backend", {
      image: ecs.ContainerImage.fromEcrRepository(repo, "latest"),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "backend",
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        PORT: "3001",
        NODE_ENV: "production",
        BROWSER_HEADED: "false",
        BROWSER_ENGINE: "chromium",
        SKIP_EXTRACTION: "true",
        PE_MODE: "private",
        COMET_ENABLED: "false",
        AGENT_MODE: "agentic",
      },
      secrets: {
        GEMINI_API_KEY: ecs.Secret.fromSecretsManager(apiSecrets, "GEMINI_API_KEY"),
        GROQ_API_KEY: ecs.Secret.fromSecretsManager(apiSecrets, "GROQ_API_KEY"),
      },
      portMappings: [{ containerPort: 3001 }],
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:3001/healthz || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ── Fargate Service (public subnet, assign public IP — no NAT needed) ───
    const fargateService = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // ── ALB Target & Listener ────────────────────────────────────────────────
    const listener = alb.addListener("Http", { port: 80 });

    const targetGroup = listener.addTargets("Backend", {
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [fargateService],
      healthCheck: {
        path: "/healthz",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyHttpCodes: "200",
      },
      deregistrationDelay: cdk.Duration.seconds(15),
    });

    // Longer idle timeout for SSE streaming
    alb.setAttribute("idle_timeout.timeout_seconds", "300");

    // ── S3 Bucket for Frontend ───────────────────────────────────────────────
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `realestate-ai-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // ── ACM Certificate for custom domain ────────────────────────────────────
    const certificate = new acm.Certificate(this, "SiteCert", {
      domainName: "reagent.selvaonline.com",
      validation: acm.CertificateValidation.fromDns(),
    });

    // ── CloudFront Distribution ──────────────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, "Cdn", {
      domainNames: ["reagent.selvaonline.com"],
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        "/run": {
          origin: new origins.LoadBalancerV2Origin(alb, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        "/run_sync": {
          origin: new origins.LoadBalancerV2Origin(alb, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        "/events/*": {
          origin: new origins.LoadBalancerV2Origin(alb, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        "/result/*": {
          origin: new origins.LoadBalancerV2Origin(alb, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        "/chat*": {
          origin: new origins.LoadBalancerV2Origin(alb, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        "/api/*": {
          origin: new origins.LoadBalancerV2Origin(alb, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        "/mcp": {
          origin: new origins.LoadBalancerV2Origin(alb, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        "/healthz": {
          origin: new origins.LoadBalancerV2Origin(alb, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
        // MkDocs documentation served by the orchestrator at /docs
        "/docs*": {
          origin: new origins.LoadBalancerV2Origin(alb, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
      defaultRootObject: "index.html",
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.seconds(0) },
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.seconds(0) },
      ],
    });

    // ════════════════════════════════════════════════════════════════════════
    // agentpack demo — M&A deal team (shares VPC, cluster, ALB, and secrets)
    // ════════════════════════════════════════════════════════════════════════
    const agentpackRepo = new ecr.Repository(this, "AgentpackRepo", {
      repositoryName: "agentpack-demo",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // Small task: no browser automation in agentpack — 0.25 vCPU is plenty.
    const agentpackTaskDef = new ecs.FargateTaskDefinition(this, "AgentpackTaskDef", {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    agentpackTaskDef.addContainer("agentpack", {
      image: ecs.ContainerImage.fromEcrRepository(agentpackRepo, "latest"),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "agentpack",
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        PORT: "3000",
        NODE_ENV: "production",
        AGENTPACK_MANIFEST: "templates/deal-ma/agentpack.yaml",
        AGENTPACK_RUN_LIMIT: "30",
      },
      secrets: {
        GEMINI_API_KEY: ecs.Secret.fromSecretsManager(apiSecrets, "GEMINI_API_KEY"),
        GROQ_API_KEY: ecs.Secret.fromSecretsManager(apiSecrets, "GROQ_API_KEY"),
      },
      portMappings: [{ containerPort: 3000 }],
      healthCheck: {
        // node:20-slim has no curl; use built-in fetch
        command: [
          "CMD-SHELL",
          "node -e \"fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"",
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(30),
      },
    });

    const agentpackService = new ecs.FargateService(this, "AgentpackService", {
      cluster,
      taskDefinition: agentpackTaskDef,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // Dedicated ALB listener on 8080 so agentpack never collides with
    // DealSense's path-based routing on :80.
    const agentpackListener = alb.addListener("AgentpackHttp", {
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    agentpackListener.addTargets("Agentpack", {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [agentpackService],
      healthCheck: {
        path: "/api/health",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyHttpCodes: "200",
      },
      deregistrationDelay: cdk.Duration.seconds(15),
    });

    // Everything (UI, API, SSE, MCP) comes from the one container — a single
    // no-cache behavior is all the distribution needs.
    const agentpackDistribution = new cloudfront.Distribution(this, "AgentpackCdn", {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          httpPort: 8080,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
    });

    new cdk.CfnOutput(this, "AgentpackUrl", {
      value: `https://${agentpackDistribution.distributionDomainName}`,
      description: "agentpack demo URL (CloudFront)",
    });

    new cdk.CfnOutput(this, "AgentpackEcrRepoUri", {
      value: agentpackRepo.repositoryUri,
      description: "ECR repository URI for the agentpack demo image",
    });

    new cdk.CfnOutput(this, "AgentpackDistributionId", {
      value: agentpackDistribution.distributionId,
      description: "agentpack CloudFront distribution ID",
    });

    // ── Outputs ──────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "Frontend URL (CloudFront)",
    });

    new cdk.CfnOutput(this, "AlbUrl", {
      value: `http://${alb.loadBalancerDnsName}`,
      description: "Backend API URL (ALB)",
    });

    new cdk.CfnOutput(this, "EcrRepoUri", {
      value: repo.repositoryUri,
      description: "ECR repository URI for docker push",
    });

    new cdk.CfnOutput(this, "SecretArn", {
      value: apiSecrets.secretArn,
      description: "Secrets Manager ARN for API keys",
    });

    new cdk.CfnOutput(this, "SiteBucketName", {
      value: siteBucket.bucketName,
      description: "S3 bucket for frontend assets",
    });

    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
      description: "CloudFront distribution ID (for cache invalidation)",
    });
  }
}
