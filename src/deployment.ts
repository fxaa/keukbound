import * as cdk from "monocdk";
import * as pipelines from "monocdk/pipelines";
import * as codepipeline from "monocdk/aws-codepipeline";
import * as actions from "monocdk/aws-codepipeline-actions";
import * as deploy from "monocdk/aws-codedeploy";
import { KeukboundStage } from "./stage";

export interface KeukboundDeployerProps extends cdk.StackProps {}

export class KeukboundDeployer extends cdk.Stack {
    constructor(
        parent: cdk.Construct,
        id: string,
        props?: KeukboundDeployerProps,
    ) {
        super(parent, id);

        const cloudAssemblyArtifact = new codepipeline.Artifact(
            "CloudAssembly",
        );
        const starboundSource = new codepipeline.Artifact("StarboundSource");
        const sourceAction = new actions.GitHubSourceAction({
            actionName: "starbound-source",
            owner: "Didstopia",
            repo: "starbound-server",
            output: starboundSource,
            oauthToken: cdk.SecretValue.secretsManager("github/token"),
            branch: "main",
        });

        const pipeline = new pipelines.CdkPipeline(this, "pipeline", {
            cloudAssemblyArtifact,
            pipelineName: "KeukboundDeployment",
            selfMutating: true,
            sourceAction,
            synthAction: pipelines.SimpleSynthAction.standardNpmSynth({
                cloudAssemblyArtifact,
                sourceArtifact: starboundSource,
            }),
        });
        const serverStage = new KeukboundStage(this, "starbound-stage");
        pipeline.addApplicationStage(serverStage);
    }
}
