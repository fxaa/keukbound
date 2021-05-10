import * as cdk from "monocdk";
import * as ec2 from "monocdk/aws-ec2";
import * as patterns from "monocdk/aws-ecs-patterns";
import * as ecs from "monocdk/aws-ecs";
import * as assets from "monocdk/aws-ecr-assets";
import * as autoscaling from "monocdk/aws-autoscaling";
import * as gamelift from "monocdk/aws-gamelift";
import * as elb from "monocdk/aws-elasticloadbalancingv2";
import * as secrets from "monocdk/aws-secretsmanager";
import * as efs from "monocdk/aws-efs";

export class KeukboundServer extends cdk.Stack {
    constructor(parent: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(parent, id);

        const vpc = new ec2.Vpc(this, "vpc");
        const cluster = new ecs.Cluster(this, "cluster", {
            capacity: {
                instanceType: ec2.InstanceType.of(
                    ec2.InstanceClass.C5,
                    ec2.InstanceSize.XLARGE,
                ),
            },
            vpc,
        });

        const steamSecret = secrets.Secret.fromSecretNameV2(
            this,
            "steam-secret",
            "steam/creds",
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
        });
        const hostContainer = taskDefinition.addContainer("game-host", {
            image: ecs.ContainerImage.fromRegistry(
                "didstopia/starbound-server",
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
            assignPublicIp: true,
        });
    }
}
