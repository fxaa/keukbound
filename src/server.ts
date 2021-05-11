import * as cdk from "monocdk";
import * as ec2 from "monocdk/aws-ec2";
import * as ecs from "monocdk/aws-ecs";
import * as autoscaling from "monocdk/aws-autoscaling";
import * as secrets from "monocdk/aws-secretsmanager";

export class KeukboundServer extends cdk.Stack {
    constructor(parent: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(parent, id);

        const vpc = new ec2.Vpc(this, "vpc", {
            subnetConfiguration: [
                {
                    name: "public-starbound",
                    subnetType: ec2.SubnetType.PUBLIC,
                },
            ],
            enableDnsSupport: true,
            enableDnsHostnames: true,
        });

        const sg = new ec2.SecurityGroup(this, "sg", {
            vpc,
            allowAllOutbound: true,
            securityGroupName: "starbound-connection",
            description: "group used by starbound connections",
        });
        sg.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(21025),
            "allow clients inbound through 21025",
        );
        sg.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcpRange(27000, 27037),
            "allow all inbound steam traffic",
        );
        const cluster = new ecs.Cluster(this, "cluster", {
            capacity: {
                instanceType: ec2.InstanceType.of(
                    ec2.InstanceClass.C5,
                    ec2.InstanceSize.XLARGE,
                ),
                associatePublicIpAddress: true,
                instanceMonitoring: autoscaling.Monitoring.BASIC,
                healthCheck: autoscaling.HealthCheck.ec2({
                    grace: cdk.Duration.minutes(5),
                }),
                vpcSubnets: {
                    subnetType: ec2.SubnetType.PUBLIC,
                },
            },
            vpc,
        });

        const steamSecret = secrets.Secret.fromSecretNameV2(
            this,
            "steam-secret",
            "steam/creds",
        );
        const dockerSecret = secrets.Secret.fromSecretNameV2(
            this,
            "docker-secret",
            "docker/token",
        );

        const logging = new ecs.AwsLogDriver({
            streamPrefix: "starbound",
        });
        const taskDefinition = new ecs.Ec2TaskDefinition(this, "task", {
            volumes: [
                {
                    name: "starbound",
                    dockerVolumeConfiguration: {
                        driver: "local",
                        scope: ecs.Scope.SHARED,
                        autoprovision: true,
                    },
                },
            ],
            networkMode: ecs.NetworkMode.HOST,
        });
        const hostContainer = taskDefinition.addContainer("game-host", {
            image: ecs.ContainerImage.fromRegistry(
                "didstopia/starbound-server",
                {
                    credentials: dockerSecret,
                },
            ),
            secrets: {
                STEAM_USERNAME: ecs.Secret.fromSecretsManager(
                    steamSecret,
                    "STEAM_USERNAME",
                ),
                STEAM_PASSWORD: ecs.Secret.fromSecretsManager(
                    steamSecret,
                    "STEAM_PASSWORD",
                ),
            },
            portMappings: [
                {
                    containerPort: 21025,
                },
            ],
            memoryLimitMiB: 4096,
            logging,
        });
        hostContainer.addMountPoints({
            sourceVolume: "starbound",
            containerPath: "/steamcmd/starbound",
            readOnly: false,
        });
        const server = new ecs.Ec2Service(this, "server", {
            cluster,
            taskDefinition,
            circuitBreaker: {
                rollback: false,
            },
            minHealthyPercent: 50,
            maxHealthyPercent: 200,
            desiredCount: 1,
        });
    }
}
